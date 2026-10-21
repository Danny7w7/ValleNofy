import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Beer, Disc3, Heart, Search, Sprout, X } from 'lucide-react'
import { api } from '../api.js'
import { SongArt } from './Art.jsx'
import { ErrorNotice, MusicLinks, ReactionButtons, Spinner } from './UI.jsx'

const tabs = [
  { id: 'seeds', label: 'Mis cinco', Icon: Sprout, description: 'Las canciones con las que empezó tu historia.' },
  { id: 'like', label: 'Me dan sed', Icon: Beer, description: 'Las que te dan ganas de otra ronda.' },
  { id: 'love', label: 'Al corazón', Icon: Heart, description: 'Las que se cantan con el alma.' },
  { id: 'dislike', label: 'Paso, compae', Icon: X, description: 'Las que prefieres dejar pasar. Siempre puedes cambiar de opinión.' },
]

export default function Library({ profile, onProfile, onDiscover, onEditSeeds, notify }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [tab, setTab] = useState('seeds')
  const [query, setQuery] = useState('')
  const [reload, setReload] = useState(0)
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

  return (
    <section className="library-page" aria-labelledby="library-title">
      <div className="page-heading"><div><span className="eyebrow"><Disc3 size={15} aria-hidden="true" /> TU PROPIO CANCIONERO</span><h1 id="library-title">Aquí vive <em>tu parranda.</em></h1><p>Las de siempre, las que llegaron y las que se quedaron en el corazón.</p></div><button className="button button-secondary" onClick={onDiscover}>Seguir descubriendo<ArrowRight size={17} aria-hidden="true" /></button></div>
      <div className="library-overview"><span><strong>{profile.stats?.total ?? entries.length}</strong> canciones en tu historia</span><span><span className="tiny-sun" /> Cada gusto tiene su propio vallenato.</span></div>
      <div className="library-tabs" role="tablist" aria-label="Secciones de tu biblioteca">{tabs.map(({ id, label, Icon }, index) => <button role="tab" key={id} id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} ref={(element) => { tabRefs.current[index] = element }} onClick={() => changeTab(id)} onKeyDown={(event) => tabKeyDown(event, index)}><Icon size={17} aria-hidden="true" /><span>{label}</span><span className="tab-count">{loading || error ? '—' : count(id)}</span></button>)}</div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="library-panel">
        <div className="library-panel-header"><div><h2>{currentTab.label}</h2><p>{currentTab.description}</p></div>{tab === 'seeds' ? <button className="text-button" onClick={onEditSeeds}>Cambiar mis cinco<ArrowRight size={15} aria-hidden="true" /></button> : <div className="search-field library-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar en esta sección de tu biblioteca" placeholder="Buscar en esta lista…" /></div>}</div>
        {loading ? <div className="library-loading"><Spinner label="Abriendo tu cancionero…" /></div> : error ? <ErrorNotice message={error} onRetry={() => setReload((value) => value + 1)} /> : <div className="library-results" ref={resultsRef} tabIndex={-1}>
          <span className="sr-only" role="status">{matching.length} canciones en {currentTab.label}</span>
          {matching.length === 0 ? <div className="library-empty"><currentTab.Icon size={36} strokeWidth={1.2} aria-hidden="true" /><h3>{query ? 'Por aquí no aparece esa canción.' : 'Esta página aún está por escribir.'}</h3><p>{query ? 'Prueba con otro título o artista.' : 'Tus reacciones irán llenando este rincón de tu biblioteca.'}</p>{query ? <button className="text-button" onClick={() => setQuery('')}>Borrar búsqueda<X size={14} aria-hidden="true" /></button> : <button className="button button-primary" onClick={onDiscover}>Encontrar mi siguiente canción<ArrowRight size={16} aria-hidden="true" /></button>}</div>
            : <div className="library-song-list">{matching.map((entry) => <article className="library-song" key={entry.song.id} aria-label={`${entry.song.title}, ${entry.song.artist}`}><div className="library-song-main"><SongArt song={entry.song} /><div className="song-text"><strong>{entry.song.title}</strong><span>{entry.song.artist}</span><span className="library-song-meta">{[entry.song.album, entry.song.year].filter(Boolean).join(' · ')}</span></div>{entry.is_seed && <span className="seed-badge"><Sprout size={12} aria-hidden="true" />De mis cinco</span>}<MusicLinks song={entry.song} compact /></div><div className="library-song-reactions"><ReactionButtons compact value={entry.reaction} busy={busyId !== null} onReact={(reaction) => react(entry, reaction)} />{busyId === entry.song.id && <Spinner label="Guardando…" small />}</div>{actionError?.id === entry.song.id && <ErrorNotice compact title="No pudimos cambiar esta reacción" message={actionError.message} />}</article>)}</div>}
        </div>}
      </div>
    </section>
  )
}
