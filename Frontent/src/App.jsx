import { Component, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Check, Compass, Cookie, Info, Moon, Music2, ShieldCheck, Sun, X } from 'lucide-react'
import { api } from './api.js'
import usePageMotion from './usePageMotion.js'
import { BrandMark } from './components/Art.jsx'
import { AboutModal, ErrorNotice, Spinner } from './components/UI.jsx'
import Onboarding from './components/Onboarding.jsx'
import Discover from './components/Discover.jsx'
import Library from './components/Library.jsx'

class InterfaceBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="fatal-error"><BrandMark /><h1>Hagamos una pequeña pausa.</h1><p>No pudimos mostrar esta página. Recarga para volver a tu parranda.</p><button className="button button-primary" onClick={() => window.location.reload()}>Volver a cargar</button></div> : this.props.children
  }
}

function ValleNofy() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [view, setView] = useState('discover')
  const [about, setAbout] = useState(false)
  const [toast, setToast] = useState(null)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const mainRef = useRef(null)
  const screen = profile?.onboarded ? view : 'onboarding'
  usePageMotion(mainRef, screen)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#10272b' : '#fff9ec'
    try { localStorage.setItem('vallenofy-theme', theme) } catch { /* The toggle also works without storage. */ }
  }, [theme])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    api.profile(controller.signal).then((data) => {
      if (!controller.signal.aborted) setProfile(data)
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [retry])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (loading || error) return
    document.title = `${screen === 'library' ? 'Mi biblioteca' : screen === 'onboarding' ? 'Tus cinco favoritas' : 'Descubre tu próxima canción'} · ValleNofy`
    mainRef.current?.focus({ preventScroll: true })
  }, [screen, loading, error])

  function notify(message) { setToast({ message, key: Date.now() }) }

  function navigate(next) {
    setView(next)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function updateProfile(next) {
    setProfile(next)
    if (!next.onboarded) {
      setView('discover')
      window.scrollTo({ top: 0, behavior: 'instant' })
      notify('Tu gusto cambió de rumbo. Elige otras cinco para seguir descubriendo.')
    }
  }

  function onboarded(next) {
    setProfile(next)
    navigate('discover')
    notify('Tus cinco ya pusieron el primer acorde. ¡Que suene!')
  }

  function profileReset(next) {
    setProfile(next)
    navigate('onboarding')
    notify('Listo, compae. Empezamos de cero: elige tus cinco favoritas.')
  }

  return (
    <div className="app-shell">
      <div className="scroll-progress" aria-hidden="true" />
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <header className="site-header"><div className="header-inner">
        <button className="brand" onClick={() => navigate('discover')} aria-label="ValleNofy, inicio"><BrandMark /><span>Valle<span>Nofy</span><small>VALLENATO CON EL CORAZÓN</small></span></button>
        {!profile?.onboarded && <span className="header-tagline"><span className="colombia-flag" aria-hidden="true" />ACORDEÓN, BRISA Y BUENA PARRANDA.</span>}
        {profile?.onboarded && <nav className="main-nav" aria-label="Navegación principal"><button className={screen === 'discover' ? 'active' : ''} onClick={() => navigate('discover')} aria-current={screen === 'discover' ? 'page' : undefined}><Compass size={17} aria-hidden="true" />Descubrir</button><button className={screen === 'library' ? 'active' : ''} onClick={() => navigate('library')} aria-current={screen === 'library' ? 'page' : undefined}><BookOpen size={17} aria-hidden="true" />Mi biblioteca</button></nav>}
        <div className="header-actions"><button className="theme-toggle" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}>{theme === 'dark' ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}<span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span></button><button className="about-button" onClick={() => setAbout(true)} aria-label="Cómo funciona ValleNofy"><Info size={17} aria-hidden="true" /><span>Cómo funciona</span></button><span className="profile-badge" title="Tu perfil está vinculado a este navegador"><Music2 size={18} aria-hidden="true" /><span>Tu parche</span></span></div>
      </div></header>

      <main id="main-content" className="main-content" ref={mainRef} tabIndex={-1}>
        {loading ? <div className="boot-state"><BrandMark className="boot-mark" /><span className="eyebrow">UN MOMENTICO, COMPAE</span><h1>La música ya viene.</h1><Spinner label="Preparando tu rincón vallenato…" /></div>
          : error ? <div className="boot-error"><BrandMark className="boot-mark" /><h1>El acordeón hace una pausa.</h1><ErrorNotice message={error} onRetry={() => setRetry((value) => value + 1)} /></div>
            : profile && <>{!profile.onboarded && profile.seed_ids?.length > 0 && <div className="reset-banner" role="status"><Info size={18} aria-hidden="true" /><p>Tu gusto cambió de rumbo. Elige cinco canciones que te gusten para volver a empezar. Tu historial sigue guardado.</p></div>}
              {screen === 'onboarding' ? <Onboarding profile={profile} onComplete={onboarded} onCancel={() => navigate('discover')} /> : screen === 'library' ? <Library profile={profile} onProfile={updateProfile} onReset={profileReset} onDiscover={() => navigate('discover')} onEditSeeds={() => navigate('onboarding')} notify={notify} /> : <Discover profile={profile} onProfile={updateProfile} onLibrary={() => navigate('library')} onEditSeeds={() => navigate('onboarding')} notify={notify} />}
            </>}
      </main>

      <footer className="site-footer"><div className="footer-inner"><div className="footer-signature"><BrandMark /><span>Del Valle, <em>con alma.</em><small><span className="colombia-flag" aria-hidden="true" />Alma colombiana. Sabor costeño.</small></span></div><div className="footer-right"><span className="cookie-note"><ShieldCheck size={14} aria-hidden="true" />Tu perfil, en este navegador.</span><button className="text-button" onClick={() => setAbout(true)}>Sobre ValleNofy<ArrowUpRight size={14} aria-hidden="true" /></button><span className="footer-cookie"><Cookie size={12} aria-hidden="true" />Sin registro · Con cookies de sesión</span></div></div></footer>
      <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast && <div className="toast" key={toast.key}><Check size={18} aria-hidden="true" /><span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label="Cerrar aviso"><X size={16} /></button></div>}</div>
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  )
}

export default function App() { return <InterfaceBoundary><ValleNofy /></InterfaceBoundary> }
