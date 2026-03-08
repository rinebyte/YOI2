import { Header } from '@/components/layout/Header'
import { ImageGrid } from '@/components/dashboard/ImageGrid'
import { UploadZone } from '@/components/dashboard/UploadZone'
import { useCurrentImages, useActiveAccount } from '@/lib/store'

export function Gallery() {
  const images = useCurrentImages()
  const account = useActiveAccount()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header title="Gallery" showSearch />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Image Gallery</h2>
            <p className="text-muted-foreground">
              {images.length} images{account ? <> in <span className="font-medium text-foreground">{account.name}</span></> : ''}
            </p>
          </div>
        </div>
        <UploadZone />
        <ImageGrid />
      </div>
    </div>
  )
}
