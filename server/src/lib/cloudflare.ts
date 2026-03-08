import type { CfUploadResponse, CfDeleteResponse } from '../types'

const CF_BASE = 'https://api.cloudflare.com/client/v4'

// ──────────────────────────────────────────────
// Image delivery URL helpers
// ──────────────────────────────────────────────

/** Public variant — returned for public images */
export function deliveryUrl(accountHash: string, imageId: string, variant = 'public') {
  return `https://imagedelivery.net/${accountHash}/${imageId}/${variant}`
}

/** Thumbnail using flexible variant quality=50 */
export function thumbnailUrl(accountHash: string, imageId: string) {
  return deliveryUrl(accountHash, imageId, 'quality=50')
}

// ──────────────────────────────────────────────
// Cloudflare Images REST API wrappers
// ──────────────────────────────────────────────

/**
 * Upload a file to Cloudflare Images.
 * Returns the raw CF API response on success.
 * Throws a descriptive error on failure.
 */
export async function uploadToCF(
  cfAccountId: string,
  apiKey: string,
  file: File,
  options: { requireSignedURLs?: boolean; metadata?: Record<string, string> } = {}
): Promise<CfUploadResponse> {
  const form = new FormData()
  form.append('file', file, file.name)
  form.append('requireSignedURLs', String(options.requireSignedURLs ?? false))

  if (options.metadata) {
    form.append('metadata', JSON.stringify(options.metadata))
  }

  const res = await fetch(`${CF_BASE}/accounts/${cfAccountId}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  const json: CfUploadResponse = await res.json()

  if (!res.ok || !json.success) {
    const msgs = json.errors?.map((e) => e.message).join('; ') ?? res.statusText
    throw new Error(`Cloudflare upload failed: ${msgs}`)
  }

  return json
}

/**
 * Delete an image from Cloudflare Images by its CF image ID.
 */
export async function deleteFromCF(
  cfAccountId: string,
  apiKey: string,
  cfImageId: string
): Promise<void> {
  const res = await fetch(`${CF_BASE}/accounts/${cfAccountId}/images/v1/${cfImageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const json: CfDeleteResponse = await res.json().catch(() => ({
      result: {},
      success: false,
      errors: [{ code: res.status, message: res.statusText }],
    }))
    const msgs = json.errors?.map((e) => e.message).join('; ')
    throw new Error(`Cloudflare delete failed: ${msgs}`)
  }
}

/**
 * Fetch image dimensions from CF (via a HEAD request on the delivery URL).
 * Returns { width, height } or { width: 0, height: 0 } if unavailable.
 */
export async function fetchImageDimensions(
  accountHash: string,
  cfImageId: string
): Promise<{ width: number; height: number }> {
  try {
    const url = deliveryUrl(accountHash, cfImageId, 'public')
    const res = await fetch(url, { method: 'HEAD' })
    const w = res.headers.get('cf-image-width')
    const h = res.headers.get('cf-image-height')
    if (w && h) return { width: Number(w), height: Number(h) }
  } catch {
    // non-critical
  }
  return { width: 0, height: 0 }
}
