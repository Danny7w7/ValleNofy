import { useEffect, useState } from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { api } from '../api.js'

export default function SongPreview({ song }) {
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setPreview(null)
    setError('')
    if (song.source === 'apple' || song.preview_embed_url) {
      setPreview({
        available: Boolean(song.preview_embed_url),
        embed_url: song.preview_embed_url || '',
        source_url: song.preview_source_url || song.source_url,
      })
      return () => controller.abort()
    }
    api.preview(song.id, controller.signal).then((data) => {
      if (!controller.signal.aborted) setPreview(data)
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [song.id, song.source, song.preview_embed_url, song.preview_source_url, song.source_url, retry])

  if (error) {
    return <div className="song-preview-message" role="alert"><span>No pudimos cargar el reproductor de {song.title}.</span><button className="text-button" type="button" onClick={() => setRetry((value) => value + 1)}><RotateCcw size={14} aria-hidden="true" />Reintentar</button></div>
  }

  if (!preview) {
    return <div className="song-preview-message" role="status" aria-live="polite">Buscando el preview de {song.title}…</div>
  }

  if (!preview.available) {
    return <div className="song-preview-message"><span>No hay un preview integrado disponible para esta grabación.</span><a href={preview.source_url} target="_blank" rel="noopener noreferrer">Abrir en Apple Music<ExternalLink size={13} aria-hidden="true" /></a></div>
  }

  return (
    <section className="song-preview" aria-label={`Preview de ${song.title}`}>
      <span className="song-preview-label">PREVIEW DE ESTA CANCIÓN</span>
      <iframe
        title={`Reproductor de Apple Music para ${song.title} de ${song.artist}`}
        src={preview.embed_url}
        allow="autoplay *; encrypted-media *; clipboard-write"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="song-preview-credit"><span>Muestra cortesía de iTunes.</span><a href={preview.source_url} target="_blank" rel="noopener noreferrer">Abrir en Apple Music<ExternalLink size={12} aria-hidden="true" /></a></div>
    </section>
  )
}
