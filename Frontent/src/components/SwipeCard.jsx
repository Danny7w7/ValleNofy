import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Disc3, Heart, Sparkles } from 'lucide-react'
import { SongArt } from './Art.jsx'

const tagLabels = { romantico: 'Romántico', romantica: 'Romántica', clasico: 'Clásico', clasica: 'Clásica', despecho: 'Despecho', parranda: 'Parranda', tradicional: 'Tradicional', paseo: 'Paseo', merengue: 'Merengue', puya: 'Puya', son: 'Son' }

export default function SwipeCard({ song, busy, exit, onReact, cardRef }) {
  const gesture = useRef(null)
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  function release(element, pointerId) {
    gesture.current = null
    setDragging(false)
    setOffset(0)
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
  }

  function start(event) {
    if (busy || event.button !== 0 || !event.isPrimary || gesture.current) return
    event.currentTarget.focus({ preventScroll: true })
    gesture.current = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY,
      x: event.clientX, time: event.timeStamp, velocity: 0, horizontal: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId || busy) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        release(event.currentTarget, event.pointerId)
        return
      }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.15) return
      current.horizontal = true
      setDragging(true)
    }
    const elapsed = event.timeStamp - current.time
    if (elapsed > 0) current.velocity = (event.clientX - current.x) / elapsed
    current.x = event.clientX
    current.time = event.timeStamp
    setOffset(dx)
  }

  function finish(event) {
    const current = gesture.current
    if (!current || current.id !== event.pointerId) return
    const dx = event.clientX - current.startX
    const threshold = Math.min(110, event.currentTarget.clientWidth * 0.25)
    const flick = event.timeStamp - current.time < 100 && Math.abs(current.velocity) > 0.6
      && Math.abs(dx) > 45 && Math.sign(current.velocity) === Math.sign(dx)
    const accepted = current.horizontal && (Math.abs(dx) >= threshold || flick)
    release(event.currentTarget, event.pointerId)
    if (accepted && !busy) onReact(dx > 0 ? 'like' : 'dislike')
  }

  function cancel(event) {
    if (gesture.current?.id === event.pointerId) release(event.currentTarget, event.pointerId)
  }

  function keyboard(event) {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return
    const reaction = { ArrowLeft: 'dislike', ArrowRight: 'like', ArrowUp: 'love' }[event.key]
    if (reaction) {
      event.preventDefault()
      if (!busy && !event.repeat) onReact(reaction)
    }
  }

  const direction = offset > 0 ? 'like' : 'dislike'
  const feedback = exit || direction
  const intensity = exit ? 1 : Math.min(Math.abs(offset) / 90, 1)

  return (
    <div className="swipe-stage">
      <div className="deck-back deck-back-far" aria-hidden="true" />
      <div className="deck-back deck-back-near" aria-hidden="true" />
      <article
        ref={cardRef}
        className={`swipe-card ${dragging ? 'is-dragging' : ''} ${exit ? `is-leaving is-leaving-${exit}` : ''}`}
        style={{ '--swipe-x': `${offset}px`, '--swipe-rotation': `${Math.max(-18, Math.min(18, offset / 22))}deg` }}
        tabIndex={0}
        aria-label={`${song.title}, de ${song.artist}`}
        aria-describedby="swipe-instructions"
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp"
        aria-busy={busy}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={keyboard}
        onDragStart={(event) => event.preventDefault()}
      >
        <SongArt song={song} large />
        <div className="swipe-card-top"><span className="match-badge"><Sparkles size={14} aria-hidden="true" />PARA TU GUSTO</span><span className="record-year">{song.year || 'CLÁSICO'}</span></div>
        <div className={`swipe-verdict verdict-${feedback}`} style={{ opacity: intensity }} aria-hidden="true">
          {feedback === 'love' ? <><Heart size={25} />¡SÍRVELOOO!</> : feedback === 'like' ? <><ArrowRight size={25} />ME DA SED</> : <><ArrowLeft size={25} />PASO, COMPAE</>}
        </div>
        <div className="swipe-card-copy"><span className="card-category"><Disc3 size={13} aria-hidden="true" /> UNA JOYITA DEL VALLENATO</span><h2>{song.title}</h2><p>{song.artist}</p><div className="song-tags">{(song.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tagLabels[tag] || tag.replaceAll('_', ' ')}</span>)}</div></div>
      </article>
    </div>
  )
}
