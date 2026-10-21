import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Disc3, Headphones, LockKeyhole, Music2, Plus, Search, Sparkles, X } from 'lucide-react'
import { api } from '../api.js'
import { CoastalArt, SongArt } from './Art.jsx'
import { ErrorNotice, MusicLinks, Spinner } from './UI.jsx'
import SongPreview from './SongPreview.jsx'

export default function Onboarding({ profile, onComplete, onCancel }) {
  const editing = profile.onboarded
  const [selected, setSelected] = useState([])
  const [previewSong, setPreviewSong] = useState(null)
  const [query, setQuery] = useState('')
  const [artist, setArtist] = useState('')
  const [artists, setArtists] = useState([])
  const [songs, setSongs] = useState([])
  const [appleError, setAppleError] = useState('')
  const [appleExcludedCount, setAppleExcludedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [hydrating, setHydrating] = useState(editing)
  const [error, setError] = useState('')
  const [seedError, setSeedError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [retry, setRetry] = useState(0)
  const [seedRetry, setSeedRetry] = useState(0)
  const [limit, setLimit] = useState(8)
  const [saving, setSaving] = useState(false)
  const searchRef = useRef(null)
  const selectionRef = useRef(null)

  useEffect(() => {
    if (!editing) return
    const controller = new AbortController()
    setHydrating(true)
    setSeedError('')
    api.library(controller.signal).then((data) => {
      if (controller.signal.aborted) return
      const seedIds = new Set(profile.seed_ids)
      const seeds = data.entries.filter((entry) => seedIds.has(entry.song.id)).map((entry) => entry.song).slice(0, 5)
      setSelected(seeds)
      setPreviewSong(seeds.at(-1) ?? null)
    }).catch((err) => {
      if (!controller.signal.aborted) setSeedError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setHydrating(false) })
    return () => controller.abort()
  }, [editing, profile.seed_ids, seedRetry])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setAppleError('')
    setAppleExcludedCount(0)
    setLimit(8)
    const timer = setTimeout(() => {
      api.songs(query.trim(), artist, controller.signal).then((data) => {
        if (controller.signal.aborted) return
        setSongs(data.songs)
        setAppleError(data.apple_error || '')
        setAppleExcludedCount(data.apple_excluded_count || 0)
        setArtists((current) => [...new Set([...current, ...data.artists])].sort((a, b) => a.localeCompare(b, 'es')))
      }).catch((err) => {
        if (!controller.signal.aborted) setError(err.message)
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query ? 280 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, artist, retry])

  const songKey = (song) => song.selection_key || `${song.source || 'catalog'}:${song.id}`
  const selectedIds = new Set(selected.map(songKey))
  const full = selected.length === 5
  const blocked = saving || hydrating

  function toggleSong(song) {
    if (blocked) return
    setSubmitError('')
    if (selected.some((item) => songKey(item) === songKey(song))) {
      const next = selected.filter((item) => songKey(item) !== songKey(song))
      setSelected(next)
      if (previewSong && songKey(previewSong) === songKey(song)) setPreviewSong(next.at(-1) ?? null)
      return
    }
    if (selected.length < 5) {
      setSelected([...selected, song])
      setPreviewSong(song)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!full || blocked || seedError) return
    setSaving(true)
    setSubmitError('')
    try {
      const nextProfile = await api.onboard(selected.map((song) => (
        song.source === 'apple'
          ? { source: 'apple', track_id: song.apple_track_id }
          : { source: 'catalog', id: song.id }
      )))
      onComplete(nextProfile)
    } catch (err) {
      setSubmitError(err.message)
      selectionRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <section className="onboarding-hero" aria-labelledby="welcome-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="tiny-sun" /> DE NUESTRA TIERRA, PARA TUS OÍDOS</div>
          <h1 id="welcome-title">Hay canciones<br />que te <em>saben a vida.</em></h1>
          <p>Un acordeón, un recuerdo y esa canción que nunca falla.<br className="desktop-break" /> Elige tus cinco favoritas. Nosotros ponemos la siguiente.</p>
          <div className="hero-details"><span><Disc3 size={16} aria-hidden="true" /> Vallenato del bueno</span><span className="detail-dot" /><span>Clásicos hasta 2013</span></div>
        </div>
        <div className="hero-art-wrap"><CoastalArt /><span className="art-handwritten">Donde suena un acordeón,<br />siempre hay una historia.</span></div>
      </section>

      <section className="onboarding-section" aria-labelledby="selection-title">
        <div className="section-heading">
          <div><span className="eyebrow muted">01 / EL COMIENZO DE TU PARRANDA</span><h2 id="selection-title">{editing ? 'Volvamos a tus raíces.' : 'Dinos cuáles son las tuyas.'}</h2><p>{editing ? 'Cambia tus cinco canciones de partida. Tu historial sigue contigo.' : 'Escoge exactamente 5 canciones y encuentra tu próxima favorita.'}</p></div>
          {editing ? <button className="text-button" onClick={onCancel} disabled={saving}><ArrowLeft size={16} aria-hidden="true" />Volver</button> : <span className="step-pill"><span>1</span> Elige tus favoritas <ArrowRight size={13} aria-hidden="true" /><span className="step-inactive">2</span> Descubre</span>}
        </div>
        <div className="onboarding-grid">
          <div className="catalog-panel">
            <div className="catalog-filters">
              <div className="search-field"><Search size={19} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Una canción, un artista, un recuerdo…" aria-label="Buscar canciones o artistas en el catálogo" autoComplete="off" />{query && <button className="icon-button" onClick={() => { setQuery(''); searchRef.current?.focus() }} aria-label="Borrar búsqueda"><X size={16} /></button>}</div>
              <div className="artist-select"><label className="sr-only" htmlFor="artist-filter">Filtrar por artista</label><select id="artist-filter" value={artist} onChange={(event) => setArtist(event.target.value)}><option value="">Todos los artistas</option>{artists.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></div>
            </div>
            <div className="catalog-meta"><span>{query || artist ? 'APPLE MUSIC + CATÁLOGO' : 'DEL BAÚL DE LOS CLÁSICOS'}</span><span role="status">{loading ? 'Buscando…' : `${songs.length} canciones`}</span></div>
            {(query || artist) && <p className="apple-search-note" role="status">
              {appleError
                ? 'Apple Music no respondió: ' + appleError + ' Se muestran las coincidencias del catálogo local.'
                : 'Resultados de Apple Music Colombia y del catálogo local. Apple puede marcar vallenatos con géneros generales como “Latino”; escoge las canciones que reconozcas.'}
              {appleExcludedCount > 0 && ' Se omitieron ' + appleExcludedCount + ' resultados posteriores a 2013 o sin año confirmado.'}
            </p>}
            {loading ? <div className="song-skeletons" aria-busy="true"><span className="sr-only" role="status">Buscando canciones en el catálogo…</span>{Array.from({ length: 5 }, (_, i) => <div className="song-skeleton" key={i}><span /><div><span /><span /></div><span /></div>)}</div>
              : error ? <ErrorNotice message={error} onRetry={() => setRetry((value) => value + 1)} />
                : songs.length === 0 ? <div className="empty-search"><Search size={30} aria-hidden="true" /><h3>Esa tonada no aparece por aquí.</h3><p>Prueba con otro título o artista; solo aparecen canciones con año confirmado hasta 2013.</p><button className="button button-secondary" onClick={() => { setQuery(''); setArtist(''); searchRef.current?.focus() }}>Ver todo el catálogo</button></div>
                  : <><div className="song-list">{songs.slice(0, limit).map((song, index) => {
                    const checked = selectedIds.has(songKey(song))
                    return <div className={`catalog-song ${checked ? 'is-selected' : ''}`} key={songKey(song)}>
                      <button type="button" className="song-select-button" onClick={() => toggleSong(song)} disabled={blocked || Boolean(seedError) || (full && !checked)} aria-pressed={checked} aria-label={`${checked ? 'Quitar' : 'Elegir'} ${song.title}, de ${song.artist}`}>
                        <span className="track-number">{String(index + 1).padStart(2, '0')}</span><SongArt song={song} /><span className="song-text"><strong>{song.title}</strong><span>{song.artist}{song.year && <><span className="metadata-dot">·</span>{song.year}</>}</span>{song.genre && <span className="song-genre">Apple: {song.genre}</span>}</span><span className="select-indicator">{checked ? <Check size={17} /> : <Plus size={17} />}</span>
                      </button><MusicLinks song={song} preview />
                    </div>
                  })}</div>{songs.length > limit && <button className="load-more" onClick={() => setLimit((value) => value + 12)}>Más canciones para recordar<ChevronDown size={16} aria-hidden="true" /></button>}</>}
            <p className="catalog-footnote"><Headphones size={14} aria-hidden="true" />Apple puede usar géneros generales como “Latino”; confirma que la canción sea vallenato antes de elegirla.</p>
          </div>

          <form className="selection-card" onSubmit={submit} aria-labelledby="your-five-title" ref={selectionRef} tabIndex={-1}>
            <div className="selection-card-top"><span className="eyebrow"><Sparkles size={14} aria-hidden="true" /> TU ESENCIA VALLENATA</span><span className="selection-count" aria-label={`${selected.length} de 5 canciones elegidas`}>{selected.length}<span>/5</span></span></div>
            <h3 id="your-five-title">Cinco para empezar.<br /><em>Muchas por descubrir.</em></h3>
            <div className="selection-progress" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} className={index < selected.length ? 'filled' : ''} />)}</div>
            <div className="sr-only" role="status" aria-live="polite">{selected.length} de 5 canciones elegidas. {full ? 'Ya puedes comenzar la parranda.' : `Te faltan ${5 - selected.length}.`}</div>
            {hydrating ? <Spinner label="Recuperando tus cinco…" /> : seedError ? <ErrorNotice compact message={seedError} onRetry={() => setSeedRetry((value) => value + 1)} /> : <><ol className="selected-songs">{Array.from({ length: 5 }, (_, index) => {
              const song = selected[index]
              return <li key={index} className={song ? 'has-song' : ''}><span className="selection-number">{String(index + 1).padStart(2, '0')}</span>{song ? <><span className="selected-song-text"><strong>{song.title}</strong><span>{song.artist}</span></span><button className={`icon-button selected-preview-button ${previewSong?.id === song.id ? 'is-active' : ''}`} type="button" onClick={() => setPreviewSong(song)} aria-pressed={previewSong?.id === song.id} aria-label={`Mostrar preview de ${song.title}`}><Headphones size={15} aria-hidden="true" /></button><button className="icon-button" type="button" onClick={() => toggleSong(song)} disabled={blocked} aria-label={`Quitar ${song.title} de tu selección`}><X size={15} /></button></> : <span className="empty-slot">Aquí va uno de tus clásicos</span>}</li>
            })}</ol>{previewSong && <SongPreview key={songKey(previewSong)} song={previewSong} />}</>}
            <p className={`selection-hint ${full ? 'is-ready' : ''}`}>{full ? <><Check size={14} aria-hidden="true" />¡Qué buena selección, compae!</> : <><Music2 size={14} aria-hidden="true" />{selected.length ? `Faltan ${5 - selected.length} para que suene el acordeón.` : 'Cada canción cuenta un poquito de ti.'}</>}</p>
            {submitError && <ErrorNotice compact title="No pudimos guardar tus cinco" message={submitError} />}
            <button type="submit" className="button button-primary start-button" disabled={!full || blocked || Boolean(seedError)}>{saving ? <Spinner small label="Preparando tu parranda…" /> : <>Que empiece la parranda<ArrowRight size={18} aria-hidden="true" /></>}</button>
            <span className="privacy-note"><LockKeyhole size={12} aria-hidden="true" />Sin cuentas. Solo tú y tu música.</span>
          </form>
        </div>
      </section>
    </>
  )
}
