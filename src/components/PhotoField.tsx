/**
 * Optional photograph attachment.
 *
 * Two rules govern this control. The image never leaves the device — it is
 * written to IndexedDB and nowhere else. And it is never visible by accident:
 * it renders blurred behind a veil and only resolves on a deliberate tap,
 * because the realistic place someone opens this app is a shared room, and
 * nobody else in it consented to see this.
 *
 * Reveal state is local and resets on navigation. It is never persisted.
 */
import { useRef, useState } from 'react'
import { usePhotoUrl } from '../store'
import { IconCamera, IconEye, IconEyeOff, IconLock, IconTrash } from './icons'

export function PhotoField({
  photoId,
  onAdd,
  onRemove,
  busy,
}: {
  photoId: string | null
  onAdd: (file: File) => void
  onRemove: () => void
  busy?: boolean
}) {
  const url = usePhotoUrl(photoId)
  const [revealed, setRevealed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!photoId) {
    return (
      <div className="field">
        <span className="field__label">Photograph (optional)</span>
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <IconCamera />
          {busy ? 'Processing…' : 'Attach a photograph'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onAdd(file)
            e.target.value = ''
          }}
        />
        <p className="field__hint">
          <IconLock style={{ width: 12, height: 12, verticalAlign: '-1px' }} /> Stored on this device
          only, blurred until you tap to reveal. Location data is stripped before saving.
        </p>
      </div>
    )
  }

  return (
    <div className="field">
      <span className="field__label">Photograph</span>
      <div className="photo" data-revealed={revealed}>
        {url ? (
          <img src={url} alt={revealed ? 'Attached photograph of this stool event' : ''} />
        ) : (
          <div style={{ width: '100%', height: '100%' }} />
        )}
        {!revealed && (
          <button
            type="button"
            className="photo__veil"
            onClick={() => setRevealed(true)}
            aria-label="Reveal photograph"
          >
            <IconEye />
            Tap to reveal
            <small>Hidden so it is not shown by accident</small>
          </button>
        )}
        {revealed && (
          <button type="button" className="photo__hide" onClick={() => setRevealed(false)}>
            <IconEyeOff style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Hide
          </button>
        )}
      </div>
      <button
        type="button"
        className="btn btn--danger btn--block"
        onClick={() => {
          setRevealed(false)
          onRemove()
        }}
      >
        <IconTrash />
        Remove photograph
      </button>
    </div>
  )
}
