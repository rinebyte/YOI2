import { useState } from 'react'
import { LayoutGrid, List, Trash2, Eye, EyeOff, Copy, Check, Tag, SortAsc, SortDesc, Expand, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useStore, useCurrentImages, useAllTags } from '@/lib/store'
import { imagesApi } from '@/lib/api'
import { useImages } from '@/hooks/useImages'
import { formatBytes, formatDate, cn } from '@/lib/utils'
import type { ImageItem } from '@/lib/types'

function ImagePreviewModal({ image, onClose }: { image: ImageItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="max-w-5xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        <img
          src={image.url}
          alt={image.filename}
          className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
        />
        <div className="mt-3 flex items-center justify-between text-sm text-white/70">
          <span className="font-medium text-white">{image.filename}</span>
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            Open original
          </a>
        </div>
      </div>
    </div>
  )
}

function ImageCard({ image, selected, onSelect }: { image: ImageItem; selected: boolean; onSelect: () => void }) {
  const { removeImage, toggleImageVisibility, upsertImage } = useStore()
  const [copied, setCopied] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(image.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      <div className="aspect-square relative overflow-hidden bg-muted">
        <img
          src={image.thumbnailUrl}
          alt={image.filename}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = image.url }}
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Selection checkbox */}
        <div
          className={cn(
            'absolute top-2 left-2 h-5 w-5 rounded border-2 border-white bg-white/20 backdrop-blur-sm transition-all',
            selected ? 'bg-primary border-primary' : 'opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => { e.stopPropagation(); onSelect() }}
        >
          {selected && <Check className="h-3 w-3 text-white m-auto mt-0.5" />}
        </div>

        {/* Visibility badge */}
        <div className="absolute top-2 right-2">
          <Badge variant={image.isPublic ? 'default' : 'secondary'} className="text-xs">
            {image.isPublic ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewing(true) }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={copyUrl}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const newPublic = !image.isPublic
              toggleImageVisibility(image.id)
              imagesApi.update(image.id, { is_public: newPublic })
                .then(upsertImage)
                .catch(() => toggleImageVisibility(image.id)) // rollback on error
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
          >
            {image.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600/80 text-white backdrop-blur-sm hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete image?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{image.filename}" from Cloudflare Images. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    removeImage(image.id)
                    imagesApi.delete(image.id).catch(console.error)
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium truncate">{image.filename}</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{formatBytes(image.size)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(image.uploadedAt)}</p>
        </div>
        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {image.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs py-0 px-1.5">{tag}</Badge>
            ))}
            {image.tags.length > 2 && (
              <Badge variant="outline" className="text-xs py-0 px-1.5">+{image.tags.length - 2}</Badge>
            )}
          </div>
        )}
      </div>

      {previewing && <ImagePreviewModal image={image} onClose={() => setPreviewing(false)} />}
    </Card>
  )
}

function ImageRow({ image, selected, onSelect }: { image: ImageItem; selected: boolean; onSelect: () => void }) {
  const { removeImage, toggleImageVisibility, upsertImage } = useStore()

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border bg-card px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50',
        selected && 'ring-2 ring-primary'
      )}
      onClick={onSelect}
    >
      <div
        className={cn(
          'h-5 w-5 shrink-0 rounded border-2 border-muted-foreground/40 transition-all',
          selected && 'bg-primary border-primary'
        )}
      >
        {selected && <Check className="h-3 w-3 text-white m-auto mt-0.5" />}
      </div>
      <img
        src={image.thumbnailUrl}
        alt={image.filename}
        className="h-12 w-12 rounded object-cover shrink-0"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).src = image.url }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{image.filename}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">{formatBytes(image.size)}</span>
          <span className="text-xs text-muted-foreground">{image.width}×{image.height}</span>
          {image.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs py-0 px-1.5">{tag}</Badge>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant={image.isPublic ? 'default' : 'secondary'} className="text-xs">
          {image.isPublic ? 'Public' : 'Private'}
        </Badge>
        <span className="text-xs text-muted-foreground ml-2">{formatDate(image.uploadedAt)}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          onClick={() => {
            const newPublic = !image.isPublic
            toggleImageVisibility(image.id)
            imagesApi.update(image.id, { is_public: newPublic })
              .then(upsertImage)
              .catch(() => toggleImageVisibility(image.id))
          }}
        >
          {image.isPublic ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete image?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "{image.filename}" from Cloudflare Images.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  removeImage(image.id)
                  imagesApi.delete(image.id).catch(console.error)
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}

export function ImageGrid() {
  useImages() // sync images from API on account switch

  const { viewMode, setViewMode, sortBy, setSortBy, sortOrder, setSortOrder,
    selectedImages, toggleSelectImage, clearSelection, selectAll, removeImages,
    selectedTags, toggleTag, clearTagFilter } = useStore()
  const images = useCurrentImages()
  const allTags = useAllTags()

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
                  selectedTags.includes(tag)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent'
                )}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button onClick={clearTagFilter} className="text-xs text-muted-foreground hover:text-foreground underline">
                Clear
              </button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'date' | 'name' | 'size')}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>

          {/* View toggle */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-l-none border-l"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Selection bar */}
      {selectedImages.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-primary/10 border border-primary/20 px-4 py-2">
          <span className="text-sm font-medium">{selectedImages.length} selected</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={selectAll}>Select all</Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>Deselect</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete {selectedImages.length}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedImages.length} images?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all selected images. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => {
                    const ids = [...selectedImages]
                    removeImages(ids)
                    imagesApi.deleteBulk(ids).catch(console.error)
                  }}
                >
                  Delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Images */}
      {images.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground font-medium">No images found</p>
          <p className="text-sm text-muted-foreground mt-1">Upload images or adjust your filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              selected={selectedImages.includes(image.id)}
              onSelect={() => toggleSelectImage(image.id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {images.map((image) => (
            <ImageRow
              key={image.id}
              image={image}
              selected={selectedImages.includes(image.id)}
              onSelect={() => toggleSelectImage(image.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-right">
        {images.length} image{images.length !== 1 ? 's' : ''}
        {selectedImages.length > 0 ? ` · ${selectedImages.length} selected` : ''}
      </p>
    </div>
  )
}
