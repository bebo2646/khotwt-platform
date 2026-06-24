import React from 'react'
import { useLocation } from 'react-router-dom'
import { initGA, trackPageView } from '../utils/analytics'

export default function AnalyticsTracker() {
  const location = useLocation()

  React.useEffect(() => {
    // Initialize Google Analytics once on mount
    initGA()
  }, [])

  React.useEffect(() => {
    // Track page views on route changes
    trackPageView(location.pathname + location.search)
  }, [location])

  return null
}
