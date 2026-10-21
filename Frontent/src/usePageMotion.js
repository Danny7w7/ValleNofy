import { useEffect } from 'react'

// Scroll work runs at most once per animation frame. It never updates React state
// or touches the swipe card, so pointer gestures and the player stay independent.
export default function usePageMotion(rootRef, screen) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const known = new WeakSet()
    let frame = 0
    let scanFrame = 0
    let scenes = []
    let tickers = []
    let observer

    function paint() {
      frame = 0
      const height = window.innerHeight
      const scrollRange = document.documentElement.scrollHeight - height
      const progress = scrollRange > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollRange)) : 0
      const reduced = preference.matches
      const travel = window.innerWidth < 760 ? 26 : 62
      const positions = scenes.map((element) => {
        const box = (element.closest('.onboarding-hero, .library-heading') || element).getBoundingClientRect()
        const distance = Math.max(-1, Math.min(1, (height / 2 - box.top - box.height / 2) / (height / 2 + box.height / 2)))
        return { element, distance: reduced ? 0 : distance }
      })
      const widths = tickers.map((element) => ({ element, width: element.firstElementChild?.getBoundingClientRect().width || 1 }))
      document.documentElement.style.setProperty('--scroll-progress', progress)
      for (const { element, distance } of positions) {
        element.style.setProperty('--parallax-y', `${(distance * travel).toFixed(2)}px`)
        element.style.setProperty('--parallax-turn', `${(distance * 13).toFixed(2)}deg`)
      }
      for (const { element, width } of widths) {
        element.style.setProperty('--marquee-x', reduced ? '0px' : `${-((window.scrollY * 0.24) % width).toFixed(2)}px`)
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(paint)
    }

    function scan() {
      scanFrame = 0
      scenes = [...root.querySelectorAll('[data-parallax]')]
      tickers = [...root.querySelectorAll('[data-marquee]')]
      const elements = root.querySelectorAll('[data-reveal]')
      elements.forEach((element, index) => {
        if (preference.matches) {
          element.classList.remove('reveal-pending')
          element.classList.add('is-revealed')
        } else if (!known.has(element)) {
          known.add(element)
          if (observer) {
            element.style.setProperty('--reveal-delay', `${(index % 4) * 65}ms`)
            element.classList.add('reveal-pending')
            observer.observe(element)
          }
        }
      })
      schedule()
    }

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.remove('reveal-pending')
          entry.target.classList.add('is-revealed')
          observer.unobserve(entry.target)
        }
      }, { threshold: 0.06, rootMargin: '0px 0px -15px 0px' })
    }

    // Search results and recommendation panels arrive after the first render.
    const mutations = new MutationObserver(() => {
      if (!scanFrame) scanFrame = requestAnimationFrame(scan)
    })
    mutations.observe(root, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(root)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    preference.addEventListener('change', scan)
    scan()

    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(scanFrame)
      observer?.disconnect()
      mutations.disconnect()
      resize.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      preference.removeEventListener('change', scan)
      root.querySelectorAll('.reveal-pending').forEach((element) => element.classList.remove('reveal-pending'))
    }
  }, [rootRef, screen])
}
