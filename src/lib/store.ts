import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Account, ImageItem, ViewMode, SortBy, SortOrder } from './types'
import type { ApiAccount, ApiImage } from './api'

// Convert API account shape → local Account shape
function fromApiAccount(a: ApiAccount): Account {
  const storage = Array.isArray(a.account_storage)
    ? (a.account_storage[0] ?? null)
    : a.account_storage
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    color: a.color,
    storageUsed: storage?.storage_used ?? 0,
    storageLimit: a.storage_limit,
    createdAt: new Date(a.created_at),
    accountId: a.cf_account_id ?? undefined,
  }
}

// Convert API image shape → local ImageItem shape
function fromApiImage(i: ApiImage): ImageItem {
  return {
    id: i.id,
    accountId: i.account_id,
    filename: i.filename,
    url: i.url,
    thumbnailUrl: i.thumbnail_url,
    size: i.size,
    width: i.width,
    height: i.height,
    mimeType: i.mime_type,
    tags: i.tags,
    isPublic: i.is_public,
    uploadedAt: new Date(i.uploaded_at),
  }
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
]


interface AppState {
  accounts: Account[]
  activeAccountId: string
  images: ImageItem[]
  viewMode: ViewMode
  sortBy: SortBy
  sortOrder: SortOrder
  searchQuery: string
  selectedTags: string[]
  selectedImages: string[]

  setActiveAccount: (id: string) => void
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'storageUsed'>) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  removeAccount: (id: string) => void

  addImage: (image: Omit<ImageItem, 'id' | 'uploadedAt'>) => void
  removeImage: (id: string) => void
  removeImages: (ids: string[]) => void
  toggleImageVisibility: (id: string) => void
  updateImageTags: (id: string, tags: string[]) => void

  setViewMode: (mode: ViewMode) => void
  setSortBy: (sort: SortBy) => void
  setSortOrder: (order: SortOrder) => void
  setSearchQuery: (query: string) => void
  toggleTag: (tag: string) => void
  clearTagFilter: () => void
  toggleSelectImage: (id: string) => void
  clearSelection: () => void
  selectAll: () => void

  // API sync helpers
  syncAccounts: (apiAccounts: ApiAccount[]) => void
  syncImages: (apiImages: ApiImage[]) => void
  upsertImage: (apiImage: ApiImage) => void
  reset: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      accounts: [],
      activeAccountId: '',
      images: [],
      viewMode: 'grid',
      sortBy: 'date',
      sortOrder: 'desc',
      searchQuery: '',
      selectedTags: [],
      selectedImages: [],

      setActiveAccount: (id) =>
        set({ activeAccountId: id, selectedImages: [], selectedTags: [], searchQuery: '' }),

      addAccount: (account) =>
        set((s) => ({
          accounts: [
            ...s.accounts,
            {
              ...account,
              id: `acc-${Date.now()}`,
              createdAt: new Date(),
              storageUsed: 0,
            },
          ],
        })),

      updateAccount: (id, updates) =>
        set((s) => ({
          accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      removeAccount: (id) =>
        set((s) => {
          const remaining = s.accounts.filter((a) => a.id !== id)
          const newActiveId =
            s.activeAccountId === id && remaining.length > 0
              ? remaining[0].id
              : s.activeAccountId
          return {
            accounts: remaining,
            images: s.images.filter((img) => img.accountId !== id),
            activeAccountId: newActiveId,
          }
        }),

      addImage: (image) =>
        set((s) => {
          const newImage: ImageItem = {
            ...image,
            id: `img-${Date.now()}`,
            uploadedAt: new Date(),
          }
          const account = s.accounts.find((a) => a.id === image.accountId)
          return {
            images: [newImage, ...s.images],
            accounts: account
              ? s.accounts.map((a) =>
                  a.id === image.accountId
                    ? { ...a, storageUsed: a.storageUsed + image.size }
                    : a
                )
              : s.accounts,
          }
        }),

      removeImage: (id) =>
        set((s) => {
          const img = s.images.find((i) => i.id === id)
          return {
            images: s.images.filter((i) => i.id !== id),
            accounts: img
              ? s.accounts.map((a) =>
                  a.id === img.accountId
                    ? { ...a, storageUsed: Math.max(0, a.storageUsed - img.size) }
                    : a
                )
              : s.accounts,
            selectedImages: s.selectedImages.filter((sid) => sid !== id),
          }
        }),

      removeImages: (ids) => {
        ids.forEach((id) => get().removeImage(id))
        set({ selectedImages: [] })
      },

      toggleImageVisibility: (id) =>
        set((s) => ({
          images: s.images.map((i) =>
            i.id === id ? { ...i, isPublic: !i.isPublic } : i
          ),
        })),

      updateImageTags: (id, tags) =>
        set((s) => ({
          images: s.images.map((i) => (i.id === id ? { ...i, tags } : i)),
        })),

      setViewMode: (mode) => set({ viewMode: mode }),
      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (sortOrder) => set({ sortOrder }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      toggleTag: (tag) =>
        set((s) => ({
          selectedTags: s.selectedTags.includes(tag)
            ? s.selectedTags.filter((t) => t !== tag)
            : [...s.selectedTags, tag],
        })),

      clearTagFilter: () => set({ selectedTags: [] }),

      toggleSelectImage: (id) =>
        set((s) => ({
          selectedImages: s.selectedImages.includes(id)
            ? s.selectedImages.filter((sid) => sid !== id)
            : [...s.selectedImages, id],
        })),

      clearSelection: () => set({ selectedImages: [] }),

      selectAll: () =>
        set((s) => {
          const visible = s.images.filter((i) => i.accountId === s.activeAccountId)
          return { selectedImages: visible.map((i) => i.id) }
        }),

      // ── API sync helpers ──────────────────────────────────────────────

      syncAccounts: (apiAccounts) =>
        set((s) => {
          const converted = apiAccounts.map(fromApiAccount)
          // keep activeAccountId valid
          const ids = new Set(converted.map((a) => a.id))
          const newActiveId = ids.has(s.activeAccountId)
            ? s.activeAccountId
            : converted[0]?.id ?? s.activeAccountId
          return { accounts: converted, activeAccountId: newActiveId }
        }),

      syncImages: (apiImages) =>
        set({ images: apiImages.map(fromApiImage) }),

      upsertImage: (apiImage) =>
        set((s) => {
          const converted = fromApiImage(apiImage)
          const exists = s.images.some((i) => i.id === converted.id)
          return {
            images: exists
              ? s.images.map((i) => (i.id === converted.id ? converted : i))
              : [converted, ...s.images],
          }
        }),

      reset: () =>
        set({
          accounts: [],
          activeAccountId: '',
          images: [],
          selectedImages: [],
          selectedTags: [],
          searchQuery: '',
        }),
    }),
    {
      name: 'cf-image-store',
      version: 3, // v3: single-account mode, clear old multi-account data
      partialize: (s) => ({
        accounts: s.accounts,
        activeAccountId: s.activeAccountId,
        images: s.images,
        viewMode: s.viewMode,
        sortBy: s.sortBy,
        sortOrder: s.sortOrder,
      }),
    }
  )
)

/** Returns the active account, or null while accounts are loading / empty. */
export const useActiveAccount = (): Account | null => {
  const { accounts, activeAccountId } = useStore()
  return accounts.find((a) => a.id === activeAccountId) ?? accounts[0] ?? null
}

export const useCurrentImages = () => {
  const { images, activeAccountId, searchQuery, selectedTags, sortBy, sortOrder } =
    useStore()

  let filtered = images.filter((i) => i.accountId === activeAccountId)

  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (i) =>
        i.filename.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  if (selectedTags.length > 0) {
    filtered = filtered.filter((i) =>
      selectedTags.every((tag) => i.tags.includes(tag))
    )
  }

  filtered.sort((a, b) => {
    let cmp = 0
    if (sortBy === 'date') cmp = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
    else if (sortBy === 'name') cmp = a.filename.localeCompare(b.filename)
    else if (sortBy === 'size') cmp = a.size - b.size
    return sortOrder === 'asc' ? cmp : -cmp
  })

  return filtered
}

export const useAllTags = () => {
  const { images, activeAccountId } = useStore()
  const tags = new Set<string>()
  images.filter((i) => i.accountId === activeAccountId).forEach((i) => i.tags.forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
}

export { COLORS }
