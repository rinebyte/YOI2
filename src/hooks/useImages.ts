import { useEffect, useRef } from 'react'
import { useStore, useActiveAccount } from '@/lib/store'
import { imagesApi } from '@/lib/api'

/**
 * Loads images from the API whenever the active account changes.
 * Syncs results into the Zustand store.
 */
export function useImages() {
  const account = useActiveAccount()
  const { syncImages } = useStore()
  const lastAccountId = useRef<string | null>(null)

  useEffect(() => {
    if (!account?.id) return
    if (lastAccountId.current === account.id) return
    lastAccountId.current = account.id

    imagesApi
      .list({ account_id: account.id, limit: 200 })
      .then((res) => syncImages(res.data))
      .catch(console.error)
  }, [account?.id, syncImages])
}
