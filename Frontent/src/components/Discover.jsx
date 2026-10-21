import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, Disc3, Heart, ListMusic, Sparkles, Sun } from 'lucide-react'
import { api } from '../api.js'
import { CoastalArt, SongArt } from './Art.jsx'
import { ErrorNotice, MusicLinks, ReactionButtons, Spinner } from './UI.jsx'
import SongPreview from './SongPreview.jsx'

const tagLabels = { romantico: 'Romántico', romantica: 'Romántica', clasico: 'Clásico', clasica: 'Clásica', despecho: 'Despecho', parranda: 'Parranda', tradicional: 'Tradicional', paseo: 'Paseo', merengue: 'Merengue', puya: 'Puya', son: 'Son' }

export default function Discover({ profile, onProfile, onLibrary, onEditSeeds, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const submitting = useRef(false)
  const focusNext = useRef(false)
  const titleRef = useRef(null)
  const errorRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.recommendations(controller.signal).then((next) => {
      if (!controller.signal.aborted) setData(next)
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const recommendation = data?.recommendations?.[0]
  const song = recommendation?.song

  useEffect(() => {
    if (!loading && focusNext.current) {
      titleRef.current?.focus()
      focusNext.current = false
    }
  }, [song?.id, loading])

  async function react(reaction) {
    if (submitting.current || !song) return
    submitting.current = true
    setBusy(true)
    setActionError('')
    try {
      const result = await api.react(song.id, reaction)
      onProfile(result.profile)
      if (!result.profile.onboarded) return
      notify(reaction === 'love' ? '¡Esa va directo al corazón!' : reaction === 'like' ? 'Guardada entre las que te dan sed.' : 'Anotado, compae. Vamos con otra.')
      focusNext.current = true
      setData(null)
      setLoading(true)
      setReload((value) => value + 1)
    } catch (err) {
      setActionError(err.message)
      requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <section className="discover-page" aria-labelledby="discover-title">
      <div className="page-heading"><div><span className="eyebrow"><span className="tiny-sun" /> EL ACORDEÓN SIGUE SONANDO</span><h1 id="discover-title">Tu próxima <em>buena historia.</em></h1><p>Una canción a la vez. Dale una escucha y cuéntanos qué te mueve.</p></div><span className="live-pill"><span /> A tu ritmo</span></div>
      <div className="discover-grid">
        <div className="recommendation-area" aria-busy={loading || busy}>
          {loading ? <div className="recommendation-loading"><div className="record-loader"><Disc3 size={64} strokeWidth={1} aria-hidden="true" /><Sparkles size={21} className="record-sparkle" aria-hidden="true" /></div><Spinner label="Buscando una que te llegue al alma…" /><p>Tu gusto pone el rumbo.</p></div>
            : error ? <div className="recommendation-error"><ErrorNotice message={error} onRetry={() => setReload((value) => value + 1)} /></div>
              : !song ? <div className="catalog-exhausted"><div className="exhausted-art"><CoastalArt compact /></div><span className="eyebrow"><Check size={15} aria-hidden="true" /> TE PASEASTE POR TODO EL CATÁLOGO</span><h2 ref={titleRef} tabIndex={-1}>La parranda queda<br /><em>en tu biblioteca.</em></h2><p>Ya conociste todas las canciones disponibles. Vuelve a tus favoritas, cambia tus reacciones o elige otras cinco para empezar.</p><div className="exhausted-actions"><button className="button button-primary" onClick={onLibrary}><BookOpen size={17} aria-hidden="true" />Ir a mi biblioteca</button><button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button></div><p className="small-print">Cambiar tus cinco conserva las reacciones anteriores.</p></div>
                : <article className="recommendation-card" key={song.id}>
                  <div className="recommendation-cover"><SongArt song={song} large /><span className="cover-stamp"><Disc3 size={15} aria-hidden="true" /> EL VALLENATO VIVE AQUÍ</span></div>
                  <div className="recommendation-content"><span className="eyebrow"><Sparkles size={14} aria-hidden="true" /> DESCUBRE ESTA JOYITA</span><h2 ref={titleRef} tabIndex={-1}>{song.title}</h2><p className="recommendation-artist">{song.artist}</p><p className="recommendation-album">{[song.album, song.year].filter(Boolean).join(' · ') || 'Del cancionero vallenato'}</p>
                    <div className="song-tags">{(song.tags || []).slice(0, 4).map((tag) => <span key={tag}>{tagLabels[tag] || tag.replaceAll('_', ' ')}</span>)}</div>
                    <div className="recommendation-reason"><Sparkles size={17} aria-hidden="true" /><div><h3>¿Por qué esta canción?</h3><p>{recommendation.reason || 'Sus metadatos tienen afinidad con las canciones que te gustan.'}</p></div></div>
                    <span className="listen-label">ESCUCHA Y VUELVE A CONTARNOS</span><SongPreview song={song} /><MusicLinks song={song} preview />
                  </div>
                  <div className="recommendation-reactions"><div className="reactions-heading"><span>¿Qué dice el corazón?</span><span>Tu reacción afina la siguiente.</span></div><ReactionButtons onReact={react} busy={busy} />{busy && <Spinner label="Guardando tu reacción…" small />}{actionError && <div ref={errorRef} tabIndex={-1}><ErrorNotice compact title="Tu reacción no se guardó" message={actionError} /></div>}</div>
                </article>}
        </div>
        <aside className="discovery-sidebar" aria-label="Tu recorrido musical">
          <div className="journey-card"><span className="eyebrow"><Sun size={15} aria-hidden="true" /> ASÍ VA TU PARRANDA</span><h3>Un gusto muy tuyo.</h3><p>Cada canción que eliges le da más sabor a lo que viene.</p><div className="journey-stat"><span><Heart size={17} aria-hidden="true" />Al corazón</span><strong>{profile.stats?.loved ?? 0}</strong></div><div className="journey-stat"><span><Disc3 size={17} aria-hidden="true" />Me dan sed</span><strong>{profile.stats?.liked ?? 0}</strong></div><div className="journey-stat"><span><ListMusic size={17} aria-hidden="true" />Por descubrir</span><strong>{loading || error ? '—' : data?.remaining ?? 0}</strong></div><button className="text-button" onClick={onLibrary}>Ver mi biblioteca<ArrowRight size={16} aria-hidden="true" /></button></div>
          <div className="roots-card"><span className="roots-number">05</span><h3>Todo empieza<br />por tus raíces.</h3><p>Tus cinco canciones son el primer acorde de esta historia.</p><button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button></div>
          <p className="sidebar-note">Hecho de acordeón,<br />caja, guacharaca y recuerdos.</p>
        </aside>
      </div>
    </section>
  )
}
