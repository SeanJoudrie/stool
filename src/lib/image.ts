/**
 * Image intake.
 *
 * Photos are downscaled and re-encoded before they are stored, for two
 * reasons: a phone camera file is several megabytes and IndexedDB quota is not
 * generous, and re-encoding through a canvas drops the EXIF block — which is
 * where the GPS coordinates and the original capture device live. For this
 * particular kind of photo, losing that metadata is a feature.
 */
export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
  mime: string
}

const MAX_EDGE = 1600
const QUALITY = 0.82

export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('That file is not an image.')
  }

  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image on this device.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) throw new Error('Could not process the image on this device.')

  return { blob, width, height, mime: 'image/jpeg' }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // `from-image` applies the EXIF orientation rather than carrying it over.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to the <img> path on browsers that reject the option.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = url
    })
  } finally {
    // Revoked after decode; the canvas draw below uses the decoded bitmap.
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
