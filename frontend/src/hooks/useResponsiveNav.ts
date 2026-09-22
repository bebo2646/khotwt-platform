import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react'
import type { DashboardNavItem } from '../components/navigation/dashboardNavConfig'

export interface UseResponsiveNavOptions {
  items: DashboardNavItem[]
  currentPath: string
  safetyBuffer?: number
}

export interface UseResponsiveNavReturn {
  visibleItems: DashboardNavItem[]
  overflowItems: DashboardNavItem[]
  hasActiveOverflow: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
  measureContainerRef: React.RefObject<HTMLDivElement | null>
  isMeasured: boolean
  isItemActive: (to: string) => boolean
}

export function useResponsiveNav({
  items,
  currentPath,
  safetyBuffer = 12,
}: UseResponsiveNavOptions): UseResponsiveNavReturn {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const measureContainerRef = useRef<HTMLDivElement | null>(null)

  const [containerWidth, setContainerWidth] = useState<number>(0)
  const [itemWidths, setItemWidths] = useState<Record<string, number>>({})
  const [isMeasured, setIsMeasured] = useState<boolean>(false)

  // Determine active route state
  const isItemActive = React.useCallback(
    (to: string) => {
      if (to === '/' || to === '/teacher/dashboard' || to === '/student/dashboard') {
        return currentPath === to
      }
      return currentPath === to || currentPath.startsWith(to + '/')
    },
    [currentPath]
  )

  // Measure individual item widths from hidden off-screen elements
  const measureItems = React.useCallback(() => {
    if (!measureContainerRef.current) return
    const widths: Record<string, number> = {}
    let allFound = true

    for (const item of items) {
      const el = measureContainerRef.current.querySelector(
        `[data-measure-id="${item.id}"]`
      ) as HTMLElement | null
      if (el) {
        // Use ceil to avoid fractional pixel wrapping issues
        widths[item.id] = Math.ceil(el.getBoundingClientRect().width)
      } else {
        allFound = false
      }
    }

    if (Object.keys(widths).length > 0) {
      setItemWidths(widths)
      if (allFound) {
        setIsMeasured(true)
      }
    }
  }, [items])

  // Measure items on mount, when items change, and when web fonts load
  useLayoutEffect(() => {
    measureItems()
    if (containerRef.current) {
      const initialWidth = Math.floor(
        containerRef.current.clientWidth || containerRef.current.getBoundingClientRect().width
      )
      if (initialWidth > 0) {
        setContainerWidth(initialWidth)
      }
    }
  }, [measureItems])

  useEffect(() => {
    measureItems()

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        measureItems()
      })
    }
  }, [measureItems])

  // Measure container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleResize = (entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(Math.floor(entry.contentRect.width))
        }
      }
    }

    // Initial measurement
    const initialWidth = Math.floor(el.clientWidth || el.getBoundingClientRect().width)
    if (initialWidth > 0) {
      setContainerWidth(initialWidth)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(el)

    window.addEventListener('resize', measureItems)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureItems)
    }
  }, [measureItems])

  // Dynamic calculation of visible vs overflow items
  const { visibleItems, overflowItems } = useMemo(() => {
    // If width not available, keep items in initial state
    if (containerWidth <= 0) {
      return {
        visibleItems: items,
        overflowItems: [],
      }
    }

    // Measure or estimate gap between items in container
    let gap = 12
    if (containerRef.current) {
      const computed = window.getComputedStyle(containerRef.current)
      const parsedGap = parseFloat(computed.columnGap || computed.gap)
      if (!isNaN(parsedGap) && parsedGap > 0) {
        gap = parsedGap
      }
    }

    const availableSpace = Math.max(0, containerWidth - safetyBuffer)

    // Estimate or measured item width
    const getItemWidth = (item: DashboardNavItem) => {
      if (itemWidths[item.id] && itemWidths[item.id] > 0) {
        return itemWidths[item.id]
      }
      return Math.max(70, item.label.length * 11 + 32)
    }

    // Calculate total required width for all items
    const calculateWidth = (candidateItems: DashboardNavItem[]) => {
      if (candidateItems.length === 0) return 0
      const itemsSum = candidateItems.reduce((acc, it) => acc + getItemWidth(it), 0)
      const gapsTotal = (candidateItems.length - 1) * gap
      return itemsSum + gapsTotal
    }

    const totalWidthAll = calculateWidth(items)

    // If everything fits, no overflow needed
    if (totalWidthAll <= availableSpace) {
      return {
        visibleItems: items,
        overflowItems: [],
      }
    }

    // Priority-based collapse:
    // Sort items by priority: priority 1 (highest) to priority N (lowest)
    // We drop the lowest-priority item (highest priority number) iteratively until the remainder fits.
    const currentSet = new Set(items.map((i) => i.id))
    // Candidates to drop ordered from lowest priority (highest number) to highest priority
    const dropCandidates = [...items].sort((a, b) => b.priority - a.priority)

    for (const candidate of dropCandidates) {
      // Always preserve at least the highest priority item if possible
      if (currentSet.size <= 1) break

      currentSet.delete(candidate.id)
      const remainingItems = items.filter((i) => currentSet.has(i.id))
      const width = calculateWidth(remainingItems)

      if (width <= availableSpace) {
        break
      }
    }

    const visible = items.filter((i) => currentSet.has(i.id))
    const overflow = items.filter((i) => !currentSet.has(i.id))

    return {
      visibleItems: visible,
      overflowItems: overflow,
    }
  }, [containerWidth, itemWidths, items, safetyBuffer])

  // Check if any overflow item is the current active route
  const hasActiveOverflow = useMemo(() => {
    return overflowItems.some((item) => isItemActive(item.to))
  }, [overflowItems, isItemActive])

  return {
    visibleItems,
    overflowItems,
    hasActiveOverflow,
    containerRef,
    measureContainerRef,
    isMeasured,
    isItemActive,
  }
}
