import { useEffect, useRef } from 'react'
import { AlertCircle, ArrowRight, Beer, Check, ExternalLink, Flame, Heart, LoaderCircle, Music2, RotateCcw, X } from 'lucide-react'

function Youtube({ size = 20, ...props }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" {...props}><rect x="2" y="5" width="20" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" /><path d="m10 9 6 3-6 3Z" fill="currentColor" /></svg>
}

export const REACTIONS = [
  { value: 'like', label: 'Esa canción me da sed', short: 'Me da sed', Icon: Beer, className: 'like' },
  { value: 'love', label: '¡Sírvelooo!', short: '¡Sírvelooo!', Icon: Heart, className: 'love' },
  { value: 'dislike', label: 'Paso, compae', short: 'Paso, compae', Icon: X, className: 'dislike' },
]

export function Spinner({ label = 'Cargando la parranda…', small = false }) {
  return <span className={`loading ${small ? 'loading-small' : ''}`} role="status"><LoaderCircle className="spin" size={small ? 18 : 25} aria-hidden="true" /><span>{label}</span></span>
}

export function ErrorNotice({ message, onRetry, title = 'Se nos fue un momentico la señal', compact = false }) {
  return (
    <div className={`error-notice ${compact ? 'error-compact' : ''}`} role="alert">
      <AlertCircle size={23} aria-hidden="true" />
      <div><h3>{title}</h3><p>{message}</p>{onRetry && <button className="text-button" onClick={onRetry}><RotateCcw size={15} aria-hidden="true" />Volver a intentar</button>}</div>
    </div>
  )
}

function externalUrl(value, fallback) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.href : fallback
  } catch {
    return fallback
  }
}

export function MusicLinks({ song, compact = false, preview = false }) {
  const query = encodeURIComponent(`${song.title} ${song.artist}`)
  const youtube = externalUrl(song.youtube_url, `https://www.youtube.com/results?search_query=${query}`)
  const spotify = externalUrl(song.spotify_url, `https://open.spotify.com/search/${query}`)
  return (
    <div className={`music-links ${compact ? 'music-links-compact' : ''} ${preview ? 'music-links-preview' : ''}`}>
      <a href={youtube} target="_blank" rel="noopener noreferrer" aria-label={`Buscar ${song.title} de ${song.artist} en YouTube; abre los resultados en otra pestaña`}><Youtube size={compact ? 17 : 20} aria-hidden="true" />{preview ? <span>Escuchar en YouTube</span> : !compact && <span>YouTube</span>}<ExternalLink size={12} className="link-external" aria-hidden="true" /></a>
      <a href={spotify} target="_blank" rel="noopener noreferrer" aria-label={`Buscar ${song.title} de ${song.artist} en Spotify; abre los resultados en otra pestaña`}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.6 14.4a.7.7 0 0 1-1 .2c-2.5-1.5-5.5-1.8-9-1a.7.7 0 1 1-.3-1.4c3.9-.9 7.2-.5 10 1.2.3.2.4.7.3 1Zm1.3-3a.9.9 0 0 1-1.2.3c-2.8-1.7-7.1-2.2-10.4-1.2a.9.9 0 0 1-.5-1.7c3.8-1.1 8.6-.6 11.8 1.4.4.2.5.8.3 1.2Zm.1-3.2C14.6 8.2 9 8 5.8 9a1 1 0 0 1-.6-2c3.7-1.1 10-1 13.8 1.3a1.1 1.1 0 0 1-1 1.9Z" /></svg>{preview ? <span>Escuchar en Spotify</span> : !compact && <span>Spotify</span>}<ExternalLink size={12} className="link-external" aria-hidden="true" /></a>
    </div>
  )
}

export function ReactionButtons({ value, onReact, busy = false, compact = false }) {
  return (
    <div className={`reaction-buttons ${compact ? 'reaction-buttons-compact' : ''}`} role="group" aria-label="Tu reacción a esta canción" aria-busy={busy}>
      {REACTIONS.map(({ value: reaction, label, Icon, className }) => (
        <button key={reaction} className={`reaction-button reaction-${className} ${value === reaction ? 'is-active' : ''}`} disabled={busy} aria-pressed={value === reaction} onClick={() => onReact(reaction)} title={label}>
          <Icon size={compact ? 17 : 23} aria-hidden="true" fill={reaction === 'love' && value === reaction ? 'currentColor' : 'none'} />
          <span>{label}</span>{value === reaction && <Check className="reaction-check" size={13} aria-hidden="true" />}
        </button>
      ))}
    </div>
  )
}

export function AboutModal({ onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous; dialog.close() }
  }, [])
  return (
    <dialog ref={ref} className="about-dialog" aria-labelledby="about-title" onCancel={(event) => { event.preventDefault(); onClose() }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="about-content">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Cerrar información"><X size={21} /></button>
        <span className="eyebrow"><Music2 size={15} aria-hidden="true" /> HECHO CON SABOR A VALLE</span>
        <h2 id="about-title">Detrás de<br /><em>la parranda.</em></h2>
        <p>ValleNofy te ayuda a descubrir vallenato a partir de cinco canciones que ya te gustan. Cada reacción afina el recorrido.</p>
        <div className="about-detail"><Flame size={20} aria-hidden="true" /><div><h3>La afinidad está en los detalles</h3><p>El recomendador usa artista, época y etiquetas con TF-IDF y similitud coseno de scikit-learn. Tus canciones de Apple también sirven como preferencias, sin ampliar el catálogo de candidatas. La afinidad compara esos datos; no es una probabilidad de que una canción te guste.</p></div></div>
        <div className="about-detail"><Music2 size={20} aria-hidden="true" /><div><h3>Un paseo por los clásicos</h3><p>El catálogo recomendado reúne canciones hasta 2013. Puedes buscar vallenatos de Apple Music de esa época y previsualizarlos aquí; YouTube y Spotify abren búsquedas externas.</p></div></div>
        <div className="about-detail"><Heart size={20} aria-hidden="true" /><div><h3>Tu gusto se queda contigo</h3><p>No necesitas una cuenta. Una cookie identifica tu perfil en este navegador y tus preferencias se guardan en el servidor. Si borras las cookies, pierdes el acceso a ese perfil desde este navegador.</p></div></div>
        <button className="button button-primary" onClick={onClose}>Que siga la música<ArrowRight size={17} aria-hidden="true" /></button>
      </div>
    </dialog>
  )
}
