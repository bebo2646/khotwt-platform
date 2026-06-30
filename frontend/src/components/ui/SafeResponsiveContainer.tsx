import React, { useState, useEffect, useRef } from 'react'
import { ResponsiveContainer } from 'recharts'

interface SafeResponsiveContainerProps {
  children: React.ReactNode
  height?: number
}

export const SafeResponsiveContainer: React.FC<SafeResponsiveContainerProps> = ({ children, height = 320 }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    
    // Initial size
    setDimensions({
      width: container.clientWidth || 0,
      height: container.clientHeight || height || 0
    })

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return
      const { width, height: entryHeight } = entries[0].contentRect
      setDimensions({ 
        width: width || container.clientWidth || 0, 
        height: entryHeight || container.clientHeight || height || 0
      })
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [height])

  // Explicit validation to prevent rendering charts with invalid width/height
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    return (
      <div ref={containerRef} className="w-full h-full" style={{ minHeight: `${height}px`, height: `${height}px` }} />
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: `${height}px`, height: `${height}px` }}>
      <ResponsiveContainer width={dimensions.width} height={dimensions.height}>
        {children as any}
      </ResponsiveContainer>
    </div>
  )
}
