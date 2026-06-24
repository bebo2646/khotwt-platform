import React from 'react'
import { useLocation } from 'react-router-dom'
import SEO from './SEO'

export default function RobotsTracker() {
  const location = useLocation()

  const isDashboardRoute = React.useMemo(() => {
    const path = location.pathname.toLowerCase()
    return (
      path.startsWith('/admin') ||
      path.startsWith('/student') ||
      path.startsWith('/teacher') ||
      path === '/change-password'
    );
  }, [location.pathname])

  if (isDashboardRoute) {
    return (
      <SEO 
        title="لوحة التحكم" 
        description="لوحة التحكم الخاصة بمنصة خطوتك التعليمية." 
        noindex={true} 
      />
    )
  }

  return null
}
