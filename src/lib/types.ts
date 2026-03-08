export interface Account {
  id: string
  name: string
  email: string
  avatarUrl?: string
  color: string
  storageUsed: number
  storageLimit: number
  createdAt: Date
  apiKey?: string
  accountId?: string
}

export interface ImageItem {
  id: string
  accountId: string
  filename: string
  url: string
  thumbnailUrl: string
  size: number
  width: number
  height: number
  mimeType: string
  tags: string[]
  uploadedAt: Date
  isPublic: boolean
}

export type ViewMode = 'grid' | 'list'
export type SortBy = 'date' | 'name' | 'size'
export type SortOrder = 'asc' | 'desc'
