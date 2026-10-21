import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Beer, BookOpen, Check, Disc3, Headphones, Heart, ListMusic, MoveHorizontal, Sparkles } from 'lucide-react'
import { api } from '../api.js'
import { CoastalArt } from './Art.jsx'
import { CoastalTicker, ErrorNotice, MusicLinks, ReactionButtons, Spinner } from './UI.jsx'
import SongPreview from './SongPreview.jsx'
import SwipeCard from './SwipeCard.jsx'

export default function Discover({ profile, onProfile, onLibrary, onEditSeeds, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [failedReaction, setFailedReaction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [exit, setExit] = useState(null)
  const [reload, setReload] = useState(0)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const focusNext = useRef(false)
  const cardRef = useRef(null)
  const titleRef = useRef(null)
  const errorRef = useRef(null)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.recommendations(controller.signal).then((next) => {
      if (!controller.signal.aborted) {
        setData(next)
        setExit(null)
      }
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const recommendation = data?.recommendations?.[0]
  const song = recommendation?.song

  useEffect(() => {
    if (!loading && focusNext.current) {
      ;(cardRef.current || titleRef.current)?.focus({ preventScroll: true })
      focusNext.current = false
    }
  }, [song?.id, loading])

  async function react(reaction) {
    if (submitting.current || loading || !song) return
    submitting.current = true
    setBusy(true)
    setExit(reaction)
    setActionError('')
    setFailedReaction(reaction)
    try {
      // Let the outgoing card finish before replacing it, including on fast local requests.
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320
      const [result] = await Promise.all([
        api.react(song.id, reaction),
        new Promise((resolve) => setTimeout(resolve, duration)),
      ])
      if (!mounted.current) return
      onProfile(result.profile)
      if (!result.profile.onboarded) return
      notify(reaction === 'love' ? '¡Sírvelooo! Una más para el corazón.' : reaction === 'like' ? '¡Hay match! Guardada entre las que te dan sed.' : 'Paso anotado, compae. Que venga la siguiente.')
      focusNext.current = true
      setData(null)
      setLoading(true)
      setReload((value) => value + 1)
    } catch (err) {
      if (!mounted.current) return
      setExit(null)
      setActionError(err.message)
      requestAnimationFrame(() => errorRef.current?.focus({ preventScroll: true }))
    } finally {
      submitting.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="discover-page" aria-labelledby="discover-title">
      <div className="page-heading" data-reveal>
        <div><span className="eyebrow"><span className="tiny-sun" /> TU GUSTO TIENE BUEN OÍDO</span><h1 id="discover-title">Haz match con <em>tu vallenato.</em></h1><p>Escucha, desliza y deja que el corazón ponga la siguiente.</p></div>
        <span className="live-pill"><span /> La parranda está viva</span>
      </div>
      <div className="discover-grid">
        <aside className="discovery-sidebar" aria-label="Tu recorrido musical">
          <div className="journey-card" data-reveal>
            <span className="eyebrow"><Disc3 size={15} aria-hidden="true" /> TU PARRANDA</span>
            <h3>Cada vez<br />más tuya.</h3>
            <p>Tu colección crece con cada flechazo.</p>
            <div className="journey-stat stat-love"><span><Heart size={17} aria-hidden="true" />Al corazón</span><strong>{profile.stats?.loved ?? 0}</strong></div>
            <div className="journey-stat stat-like"><span><Beer size={17} aria-hidden="true" />Me dan sed</span><strong>{profile.stats?.liked ?? 0}</strong></div>
            <div className="journey-stat"><span><ListMusic size={17} aria-hidden="true" />Por descubrir</span><strong>{loading || error ? '—' : data?.remaining ?? 0}</strong></div>
            <button className="text-button" onClick={onLibrary}>Mi biblioteca<ArrowRight size={16} aria-hidden="true" /></button>
          </div>
          <div className="roots-card" data-reveal><span className="roots-number" aria-hidden="true">05<span>★</span></span><h3>Todo empezó<br />con tus cinco.</h3><p>¿Cambió el mood? Dale otro rumbo a tu música.</p><button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button></div>
        </aside>

        <div className="recommendation-area" aria-busy={loading || busy}>
          <div className="deck-heading"><span><Sparkles size={14} aria-hidden="true" /> TU PRÓXIMO FLECHAZO</span><MoveHorizontal size={19} aria-hidden="true" /></div>
          {loading ? <div className="recommendation-loading"><div className="record-loader"><Disc3 size={70} strokeWidth={1.3} aria-hidden="true" /><Sparkles size={24} className="record-sparkle" aria-hidden="true" /></div><Spinner label="Buscando tu siguiente joyita…" /><p>Tu gusto pone el rumbo.</p></div>
            : error ? <div className="recommendation-error" ref={titleRef} tabIndex={-1}><ErrorNotice message={error} onRetry={() => setReload((value) => value + 1)} /></div>
              : !song ? <div className="catalog-exhausted"><div className="exhausted-art"><CoastalArt compact /></div><span className="eyebrow"><Check size={15} aria-hidden="true" /> TE RECORRISTE EL CATÁLOGO</span><h2 ref={titleRef} tabIndex={-1}>¡Tremenda<br /><em>parranda!</em></h2><p>Ya escuchaste todas las propuestas. Tus favoritas te esperan en la biblioteca.</p><div className="exhausted-actions"><button className="button button-primary" onClick={onLibrary}><BookOpen size={17} aria-hidden="true" />Ir a mi biblioteca</button><button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button></div><p className="small-print">Cambiar tus cinco conserva tus reacciones anteriores.</p></div>
                : <>
                  <SwipeCard key={song.id} song={song} busy={busy} exit={exit} onReact={react} cardRef={cardRef} />
                  <div className="swipe-actions"><ReactionButtons onReact={react} busy={busy} swipe /></div>
                  <p className="swipe-caption" id="swipe-instructions">Desliza la tarjeta: izquierda para pasar, derecha si te gusta. <span>También puedes enfocarla y usar <kbd><ArrowLeft size={12} aria-label="Flecha izquierda" /></kbd> <kbd><ArrowUp size={12} aria-label="Flecha arriba: favorita especial" /></kbd> <kbd><ArrowRight size={12} aria-label="Flecha derecha" /></kbd>.</span></p>
                  <div className="swipe-status" role="status" aria-live="polite">{busy ? <Spinner label="Guardando tu reacción…" small /> : <span><Check size={13} aria-hidden="true" />Cada reacción afina tus recomendaciones</span>}</div>
                  {actionError && <div ref={errorRef} tabIndex={-1}><ErrorNotice compact title="Tu reacción no se guardó" message={actionError} onRetry={() => react(failedReaction)} /></div>}
                </>}
        </div>

        <aside className="listening-sidebar" aria-label="Escucha esta recomendación">
          <div className="listening-card" data-reveal>
            <span className="eyebrow"><Headphones size={15} aria-hidden="true" /> PRIMERO, DALE OÍDO</span>
            <h3>Suena a<br /><em>buena compañía.</em></h3>
            {song && !loading && !error ? <div className="current-listen" key={song.id}><div className="listening-track"><Disc3 size={22} aria-hidden="true" /><div><strong>{song.title}</strong><span>{[song.album, song.year].filter(Boolean).join(' · ')}</span></div></div><SongPreview song={song} /><p className="listen-label">¿LA QUIERES ESCUCHAR COMPLETA?</p><MusicLinks song={song} preview /><div className="recommendation-reason"><Sparkles size={18} aria-hidden="true" /><div><h4>Esta va contigo porque…</h4><p>{recommendation.reason || 'Comparte artista, época o estilo con tus favoritas.'}</p></div></div></div>
              : <p className="listening-placeholder">{loading ? 'En un momentico llega el siguiente acordeón.' : 'Cada buena canción merece otra vuelta. Encuentra las tuyas en tu biblioteca.'}</p>}
          </div>
          <div className="swipe-guide"><span className="guide-icon"><MoveHorizontal size={24} aria-hidden="true" /></span><div><h4>Deja hablar al corazón.</h4><p>Izquierda: paso. Derecha: me gusta.<br />¿Te encantó? Dale a <strong>¡Sírvelooo!</strong></p></div></div>
          <p className="sidebar-note">Del Valle, con todo el sabor. <span>✳</span></p>
        </aside>
      </div>
      <CoastalTicker />
    </section>
  )
}
