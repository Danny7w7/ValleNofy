import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Beer, Disc3, Headphones, Heart, RotateCcw, Search, Sprout, X } from 'lucide-react'
import { api } from '../api.js'
import SongPreview from './SongPreview.jsx'
import { SongArt } from './Art.jsx'
import { CoastalTicker, ErrorNotice, MusicLinks, ReactionButtons, ResetProfileDialog, Spinner } from './UI.jsx'

const tabs = [
  { id: 'seeds', label: 'Mis cinco', Icon: Sprout, description: 'Las canciones con las que empezó tu historia.' },
  { id: 'like', label: 'Me dan sed', Icon: Beer, description: 'Las que te dan ganas de otra ronda.' },
  { id: 'love', label: 'Al corazón', Icon: Heart, description: 'Las que se cantan con el alma.' },
  { id: 'dislike', label: 'Paso, compae', Icon: X, description: 'Las que prefieres dejar pasar. Siempre puedes cambiar de opinión.' },
]

export default function Library({ profile, onProfile, onReset, onDiscover, onEditSeeds, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [tab, setTab] = useState('seeds')
  const [query, setQuery] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [reload, setReload] = useState(0)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const submitting = useRef(false)
  const resultsRef = useRef(null)
  const tabRefs = useRef([])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.library(controller.signal).then((next) => {
      if (!controller.signal.aborted) setData(next)
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [reload])

  const entries = data?.entries || []
  const currentTab = tabs.find((item) => item.id === tab)
  const count = (id) => entries.filter((entry) => id === 'seeds' ? entry.is_seed : entry.reaction === id).length
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matching = entries.filter((entry) => (tab === 'seeds' ? entry.is_seed : entry.reaction === tab)
    && normalize(`${entry.song.title} ${entry.song.artist}`).includes(normalize(query.trim())))

  function changeTab(id) {
    setTab(id)
    setPreviewId(null)
    setQuery('')
    setActionError(null)
  }

  function tabKeyDown(event, index) {
    let next = index
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    changeTab(tabs[next].id)
    tabRefs.current[next]?.focus()
  }

  async function react(entry, reaction) {
    if (submitting.current || entry.reaction === reaction) return
    submitting.current = true
    setBusyId(entry.song.id)
    setActionError(null)
    try {
      const result = await api.react(entry.song.id, reaction)
      onProfile(result.profile)
      if (!result.profile.onboarded) return
      setData((current) => ({ ...current, stats: result.profile.stats, entries: current.entries.map((item) => item.song.id === entry.song.id ? { ...item, reaction: result.reaction, updated_at: new Date().toISOString() } : item) }))
      notify('Reacción actualizada. Tu biblioteca sigue tu ritmo.')
      if (tab !== 'seeds') requestAnimationFrame(() => resultsRef.current?.focus())
    } catch (err) {
      setActionError({ id: entry.song.id, message: err.message })
    } finally {
      submitting.current = false
      setBusyId(null)
    }
  }

  async function resetProfile() {
    if (submitting.current) return
    submitting.current = true
    setResetting(true)
    setResetError('')
    try {
      const next = await api.resetProfile()
      setResetOpen(false)
      setResetting(false)
      onReset(next)
    } catch (err) {
      setResetError(err.message)
      setResetting(false)
    } finally {
      submitting.current = false
    }
  }

  return (
    <section className="library-page" aria-labelledby="library-title">
      <div className="page-heading library-heading">
        <div><span className="eyebrow"><Disc3 size={15} aria-hidden="true" /> TU COLECCIÓN, TU SABOR</span><h1 id="library-title">Aquí se queda<br /><em>lo que te mueve.</em></h1><p>Las de siempre, los nuevos flechazos y las que se cantan con el alma.</p><button className="button button-primary" onClick={onDiscover}>Seguir descubriendo<ArrowRight size={17} aria-hidden="true" /></button></div>
        <div className="library-hero-art" data-parallax="vinyl" aria-hidden="true"><Disc3 strokeWidth={1} /><span>PURO<br />SENTIMIENTO</span><Heart size={35} fill="currentColor" /></div>
      </div>
      <div className="library-overview" aria-label="Resumen de tu colección" data-reveal>
        <div><span className="overview-icon"><Disc3 size={22} aria-hidden="true" /></span><strong>{profile.stats?.total ?? entries.length}</strong><span>Canciones en tu historia</span></div>
        <div><span className="overview-icon"><Beer size={22} aria-hidden="true" /></span><strong>{profile.stats?.liked ?? 0}</strong><span>Te dan sed</span></div>
        <div><span className="overview-icon"><Heart size={22} aria-hidden="true" /></span><strong>{profile.stats?.loved ?? 0}</strong><span>Directo al corazón</span></div>
      </div>
      <div className="library-tabs" role="tablist" aria-label="Secciones de tu biblioteca">
        {tabs.map(({ id, label, Icon }, index) => <button role="tab" key={id} id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} ref={(element) => { tabRefs.current[index] = element }} onClick={() => changeTab(id)} onKeyDown={(event) => tabKeyDown(event, index)}><Icon size={18} aria-hidden="true" /><span>{label}</span><span className="tab-count">{loading || error ? '—' : count(id)}</span></button>)}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="library-panel">
        <div className="library-panel-header">
          <div><h2>{currentTab.label}<span className="heading-dot">.</span></h2><p>{currentTab.description}</p></div>
          <div className="library-tools">{tab === 'seeds' && <button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button>}<div className="search-field library-search"><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar en esta sección de tu biblioteca" placeholder="Busca en tu colección…" />{query && <button className="icon-button" onClick={() => setQuery('')} aria-label="Borrar búsqueda"><X size={15} /></button>}</div></div>
        </div>
        {loading ? <div className="library-loading"><Spinner label="Abriendo tu cancionero…" /></div>
          : error ? <ErrorNotice message={error} onRetry={() => setReload((value) => value + 1)} />
            : <div className="library-results" ref={resultsRef} tabIndex={-1}>
              <span className="sr-only" role="status">{matching.length} canciones en {currentTab.label}</span>
              {matching.length === 0 ? <div className="library-empty"><currentTab.Icon size={42} strokeWidth={1.5} aria-hidden="true" /><h3>{query ? 'Esa canción se nos esconde.' : 'Tu próximo flechazo va aquí.'}</h3><p>{query ? 'Prueba con otro título o artista.' : 'Sal a descubrir. Las canciones que elijas irán llenando este rincón.'}</p>{query ? <button className="text-button" onClick={() => setQuery('')}>Borrar búsqueda<X size={14} aria-hidden="true" /></button> : <button className="button button-primary" onClick={onDiscover}>Encontrar mi siguiente canción<ArrowRight size={16} aria-hidden="true" /></button>}</div>
                : <div className="library-song-list">{matching.map((entry) => <article className="library-song" key={entry.song.id} aria-label={`${entry.song.title}, ${entry.song.artist}`} data-reveal="card">
                  <div className="library-song-cover"><SongArt song={entry.song} large />{entry.is_seed && <span className="seed-badge"><Sprout size={13} aria-hidden="true" />De mis cinco</span>}<span className="library-year">{entry.song.year}</span></div>
                  <div className="library-song-body"><div className="song-text"><h3>{entry.song.title}</h3><span>{entry.song.artist}</span><span className="library-song-meta">{entry.song.album}</span></div>
                    <div className="library-song-links"><button className={`text-button preview-toggle ${previewId === entry.song.id ? 'is-active' : ''}`} onClick={() => setPreviewId((current) => current === entry.song.id ? null : entry.song.id)} aria-expanded={previewId === entry.song.id} aria-controls={`library-preview-${entry.song.id}`}><Headphones size={16} aria-hidden="true" />{previewId === entry.song.id ? 'Cerrar preview' : 'Dale oído'}</button><MusicLinks song={entry.song} compact /></div>
                    <div id={`library-preview-${entry.song.id}`} hidden={previewId !== entry.song.id}>{previewId === entry.song.id && <SongPreview song={entry.song} />}</div>
                    <div className="library-song-reactions"><ReactionButtons compact value={entry.reaction} busy={busyId !== null || resetting} onReact={(reaction) => react(entry, reaction)} />{busyId === entry.song.id && <Spinner label="Guardando…" small />}</div>
                    {actionError?.id === entry.song.id && <ErrorNotice compact title="No pudimos cambiar esta reacción" message={actionError.message} />}
                  </div>
                </article>)}</div>}
            </div>}
      </div>
      <div className="library-bottom-bar"><span>Tu gusto puede cambiar. Tu biblioteca también.</span><button className="text-button reset-profile-button" onClick={() => { setResetError(''); setResetOpen(true) }} disabled={resetting || busyId !== null}><RotateCcw size={15} aria-hidden="true" />Empezar de cero</button></div>
      <CoastalTicker />
      {resetOpen && <ResetProfileDialog busy={resetting} error={resetError} onCancel={() => setResetOpen(false)} onConfirm={resetProfile} />}
    </section>
  )
}
