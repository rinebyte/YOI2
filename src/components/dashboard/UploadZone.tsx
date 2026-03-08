import { useRef, useState, useCallback } from 'react'
import { Upload, Image as ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useStore, useActiveAccount } from '@/lib/store'
import { imagesApi } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PendingFile {
  file: File
  preview: string
}

interface UploadResult {
  name: string
  ok: boolean
  error?: string
}

export function UploadZone() {
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const { upsertImage } = useStore()
  const account = useActiveAccount()

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr: PendingFile[] = []
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        arr.push({ file, preview: URL.createObjectURL(file) })
      }
    })
    setPending((p) => [...p, ...arr])
    setResults([])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  const removePending = (i: number) => {
    URL.revokeObjectURL(pending[i].preview)
    setPending((p) => p.filter((_, j) => j !== i))
  }

  const handleUpload = async () => {
    if (!pending.length || !account) return
    setUploading(true)
    setResults([])

    const settled = await Promise.allSettled(
      pending.map(({ file }) =>
        imagesApi.upload(account.id, file, { isPublic: true }).then((img) => {
          upsertImage(img)
          return { name: file.name, ok: true } as UploadResult
        })
      )
    )

    const res: UploadResult[] = settled.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : { name: pending[i].file.name, ok: false, error: (r.reason as Error).message }
    )

    setResults(res)
    pending.forEach(({ preview }) => URL.revokeObjectURL(preview))
    setPending([])
    setUploading(false)
  }

  return (
    <Card>
      <CardContent className="p-6">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm font-medium">Drop images here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, GIF — up to 10 MB each</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Pending queue */}
        {pending.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{pending.length} file{pending.length > 1 ? 's' : ''} ready</p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPending([])}>Clear all</Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload to Cloudflare'}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {pending.map(({ file, preview }, i) => (
                <div key={i} className="group relative rounded-md overflow-hidden border bg-muted aspect-square">
                  <img src={preview} alt={file.name} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                    <span className="text-xs text-white truncate">{file.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removePending(i) }}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload results */}
        {results.length > 0 && (
          <div className="mt-3 space-y-1">
            {results.map((r, i) => (
              <div key={i} className={cn(
                'flex items-center gap-2 rounded px-2 py-1 text-xs',
                r.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              )}>
                <span className="font-medium">{r.ok ? '✓' : '✗'}</span>
                <span className="truncate">{r.name}</span>
                {r.error && <span className="ml-auto text-red-500 truncate">{r.error}</span>}
              </div>
            ))}
          </div>
        )}

        {pending.length === 0 && results.length === 0 && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>
              Uploading to: <Badge variant="secondary" className="ml-1 text-xs">{account?.name ?? '—'}</Badge>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
