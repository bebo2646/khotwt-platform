import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop - Authoritative global scroll restoration manager.
 * 
 * Ensures every normal route navigation starts at the very top (scroll position = 0),
 * while preserving in-page anchor navigation (e.g. #curriculum),
 * and without breaking modals, drawers, tabs, or accordions.
 */
export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation()

  // 1. Enforce manual scroll restoration so browser does not override SPA routing
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  // 2. Authoritative scroll reset on route changes
  useEffect(() => {
    // If navigating to an intentional in-page anchor (hash link), scroll to it
    if (hash) {
      const targetId = hash.replace(/^#/, '')
      const element = document.getElementById(targetId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }

    // Immediate synchronous reset
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // Also reset any internal scroll containers (e.g. AdminLayout main or overflow containers)
    const mainContainers = document.querySelectorAll('main, [data-scroll-container], .overflow-y-auto')
    mainContainers.forEach((container) => {
      // Exclude modals, dropdowns, and drawers from being reset inappropriately
      if (!container.closest('[role="dialog"]') && !container.closest('.fixed') && container.tagName.toLowerCase() === 'main') {
        container.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
        container.scrollTop = 0
      }
    })

    // Secondary micro-tick reset via requestAnimationFrame
    // Ensures that even if dynamic lazy-loaded (Suspense) chunks mount slightly after route change,
    // the viewport remains anchored at the very top (0, 0).
    const rafId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    })

    return () => cancelAnimationFrame(rafId)
  }, [pathname])

  return null
}
