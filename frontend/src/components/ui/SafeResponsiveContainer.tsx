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
      width: container.clientWidth,
      height: container.clientHeight || height
    })

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return
      const { width, height } = entries[0].contentRect
      setDimensions({ 
        width: width || container.clientWidth, 
        height: height || container.clientHeight || height 
      })
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [height])

  return (
    <div ref={containerRef} className="w-full" style={{ minHeight: `${height}px`, height: `${height}px` }}>
      {dimensions.width > 0 && dimensions.height > 0 ? (
        <ResponsiveContainer width={dimensions.width} height={dimensions.height}>
          {children as any}
        </ResponsiveContainer>
      ) : null}
    </div>
  )
}
