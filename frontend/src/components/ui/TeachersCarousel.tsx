import React from 'react'
import { ChevronRight, ChevronLeft, Users, ChevronDown, RotateCcw } from 'lucide-react'
import TeacherCard from './TeacherCard'
import { useTaxonomyStore } from '../../store/taxonomyStore'

export interface TeacherItem {
  id: number
  name: string
  subject: string
  avatar?: string
  experience?: string
  bio?: string
  students_count?: number
  courses_count?: number
  published_courses_count?: number
  slug?: string
  teaching_mode?: string
  grades?: string[] | string | null
  category?: string | null
}

interface TeachersCarouselProps {
  teachers: TeacherItem[]
  loading?: boolean
  title?: string
  subtitle?: string
  badge?: string
  showFilters?: boolean
}

export default function TeachersCarousel({
  teachers = [],
  loading = false,
  title = 'هيئة التدريس والنخبة',
  subtitle = 'كبار معلمي وموجهي المواد بمصر والخبراء في مجالات التكنولوجيا والأعمال',
  badge = '👨‍🏫 الكادر التعليمي والخبراء',
  showFilters = true,
}: TeachersCarouselProps) {
  const { departments, grades, fetchTaxonomy } = useTaxonomyStore()

  // Filter States
  const [selectedGrade, setSelectedGrade] = React.useState<string>('')
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>('')
  const [selectedMode, setSelectedMode] = React.useState<string>('')

  // Layout Measurement
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [viewportWidth, setViewportWidth] = React.useState<number>(() => {
    if (typeof window !== 'undefined') return window.innerWidth
    return 1200
  })

  // Dragging & Swipe state
  const [isDragging, setIsDragging] = React.useState<boolean>(false)
  const [dragDeltaX, setDragDeltaX] = React.useState<number>(0)
  const touchStartRef = React.useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 })
  const isHorizontalSwipeRef = React.useRef<boolean | null>(null)

  React.useEffect(() => {
    fetchTaxonomy()
  }, [fetchTaxonomy])

  // Measure container viewport width with ResizeObserver & Window Resize
  React.useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        setViewportWidth(containerRef.current.clientWidth)
      } else if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth)
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)

    let observer: ResizeObserver | null = null
    if (containerRef.current) {
      observer = new ResizeObserver(updateWidth)
      observer.observe(containerRef.current)
    }

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [loading])

  // Filtered teachers list backed by real data
  const filteredTeachers = React.useMemo(() => {
    if (!Array.isArray(teachers)) return []

    return teachers.filter((teacher) => {
      // 1. Mode Filter (online / center / both)
      if (selectedMode) {
        if (selectedMode === 'online' && !['online', 'both'].includes(teacher.teaching_mode || '')) return false
        if (selectedMode === 'center' && !['center', 'both'].includes(teacher.teaching_mode || '')) return false
        if (selectedMode === 'both' && teacher.teaching_mode !== 'both') return false
      }

      // 2. Grade Filter ("اختر الصف الدراسي")
      if (selectedGrade) {
        let matchesGrade = false
        if (Array.isArray(teacher.grades)) {
          matchesGrade = teacher.grades.some((g) => typeof g === 'string' && (g === selectedGrade || g.includes(selectedGrade)))
        } else if (typeof teacher.grades === 'string') {
          matchesGrade = teacher.grades.includes(selectedGrade)
        }
        if (!matchesGrade) return false
      }

      // 3. Department / Branch Filter ("اختر الشعبة العلمية")
      if (selectedDepartment) {
        const tCat = (teacher.category || '').toLowerCase()
        const sDept = selectedDepartment.toLowerCase()
        let matchesDept = tCat === sDept
        if (sDept === 'school' && (!tCat || tCat === 'school' || tCat === 'general_education')) {
          matchesDept = true
        }
        if (!matchesDept && teacher.subject) {
          const tSub = teacher.subject.toLowerCase()
          matchesDept = tSub.includes(sDept)
        }
        if (!matchesDept) return false
      }

      return true
    })
  }, [teachers, selectedMode, selectedGrade, selectedDepartment])

  const N = filteredTeachers.length

  // Infinite Carousel Cloned Buffer Setup
  const { safeRepeatCount, centerSetIndex, clonedTeachers } = React.useMemo(() => {
    if (N <= 1) {
      return { safeRepeatCount: 1, centerSetIndex: 0, clonedTeachers: filteredTeachers }
    }
    // At least 7 sets or enough to span 21+ cards
    const rawCount = Math.max(7, Math.ceil(21 / N))
    const count = rawCount % 2 === 0 ? rawCount + 1 : rawCount
    const center = Math.floor(count / 2)

    const cloned: TeacherItem[] = []
    for (let r = 0; r < count; r++) {
      for (let i = 0; i < N; i++) {
        cloned.push(filteredTeachers[i])
      }
    }
    return { safeRepeatCount: count, centerSetIndex: center, clonedTeachers: cloned }
  }, [filteredTeachers, N])

  // Virtual Index inside cloned array
  const [virtualIndex, setVirtualIndex] = React.useState<number>(() => {
    return centerSetIndex * (N || 1)
  })

  // Silent normalization flag (disables transition temporarily)
  const [disableTransition, setDisableTransition] = React.useState<boolean>(false)

  // Reset virtual index on filter change
  React.useEffect(() => {
    if (N > 0) {
      setDisableTransition(true)
      setVirtualIndex(centerSetIndex * N)
    }
  }, [selectedGrade, selectedDepartment, selectedMode, N, centerSetIndex])

  // Reflow and re-enable transition after silent reset
  React.useLayoutEffect(() => {
    if (disableTransition) {
      if (trackRef.current) {
        void trackRef.current.offsetHeight // Force synchronous DOM reflow
      }
      const raf = requestAnimationFrame(() => {
        setDisableTransition(false)
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [disableTransition])

  // Normalization logic: seamlessly jump back to center set clone without animation
  const normalizeIndex = React.useCallback(() => {
    if (N <= 1) return
    const logical = ((virtualIndex % N) + N) % N
    const targetVirtual = centerSetIndex * N + logical
    if (virtualIndex !== targetVirtual) {
      setDisableTransition(true)
      setVirtualIndex(targetVirtual)
    }
  }, [N, virtualIndex, centerSetIndex])

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== trackRef.current || e.propertyName !== 'transform') return
    normalizeIndex()
  }

  // Fallback timer: guarantees normalization even if transitionEnd event is skipped
  React.useEffect(() => {
    if (disableTransition || isDragging || N <= 1) return
    const logical = ((virtualIndex % N) + N) % N
    const targetVirtual = centerSetIndex * N + logical
    if (virtualIndex === targetVirtual) return

    const timer = setTimeout(() => {
      normalizeIndex()
    }, 550)

    return () => clearTimeout(timer)
  }, [virtualIndex, disableTransition, isDragging, N, centerSetIndex, normalizeIndex])

  // Responsive layout calculations
  const isMobile = (typeof window !== 'undefined' && window.innerWidth < 768) || viewportWidth < 768
  const isTablet = !isMobile && ((typeof window !== 'undefined' && window.innerWidth < 1280) || viewportWidth < 1280)

  const { slideWidth, gap, sideInset } = React.useMemo(() => {
    if (isMobile) {
      const sw = Math.max(280, Math.min(350, Math.round(viewportWidth * 0.85)))
      return {
        slideWidth: sw,
        gap: 14,
        sideInset: Math.max(12, Math.round((viewportWidth - sw) / 2)),
      }
    }
    if (isTablet) {
      const vc = viewportWidth >= 1024 ? 3 : 2
      const g = 20
      return {
        slideWidth: Math.round((viewportWidth - (vc * g)) / (vc + 0.35)),
        gap: g,
        sideInset: 8,
      }
    }
    const g = 24
    return {
      slideWidth: Math.min(330, Math.round((viewportWidth - (4 * g)) / 4.25)),
      gap: g,
      sideInset: 8,
    }
  }, [isMobile, isTablet, viewportWidth])

  // Navigation Handlers: Infinite with zero lockouts
  const handleNext = () => {
    if (N <= 1) return
    setVirtualIndex((prev) => {
      const next = prev + 1
      if (next >= (safeRepeatCount - 1) * N) {
        const logical = ((next % N) + N) % N
        return centerSetIndex * N + logical
      }
      return next
    })
  }

  const handlePrev = () => {
    if (N <= 1) return
    setVirtualIndex((prev) => {
      const next = prev - 1
      if (next < N) {
        const logical = ((next % N) + N) % N
        return centerSetIndex * N + logical
      }
      return next
    })
  }

  // Active Logical Index for pagination dots
  const activeLogicalIndex = N > 0 ? ((virtualIndex % N) + N) % N : 0

  const handleDotClick = (targetLogical: number) => {
    if (N <= 1) return
    let diff = targetLogical - activeLogicalIndex
    if (diff > N / 2) diff -= N
    else if (diff < -N / 2) diff += N
    setVirtualIndex((prev) => prev + diff)
  }

  // Touch and Pointer Drag handlers for infinite swipe
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (N <= 1) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    touchStartRef.current = { x: clientX, y: clientY, time: Date.now() }
    setIsDragging(true)
    setDragDeltaX(0)
    isHorizontalSwipeRef.current = null
  }

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaX = clientX - touchStartRef.current.x
    const deltaY = clientY - touchStartRef.current.y

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY)
      }
    }

    if (isHorizontalSwipeRef.current) {
      setDragDeltaX(deltaX)
    }
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    const deltaX = dragDeltaX
    const elapsed = Date.now() - touchStartRef.current.time
    const velocity = Math.abs(deltaX) / (elapsed || 1)
    const threshold = velocity > 0.2 ? 20 : 45

    if (deltaX > threshold) {
      // Dragged right -> in RTL, advance to next teacher
      handleNext()
    } else if (deltaX < -threshold) {
      // Dragged left -> in RTL, go back to previous teacher
      handlePrev()
    }

    setDragDeltaX(0)
    isHorizontalSwipeRef.current = null
  }

  // RTL translation offset: positive translateX shifts track to the right, advancing slides in RTL
  const effectiveIndex = N <= 1 ? 0 : virtualIndex
  const trackTranslateX = (effectiveIndex * (slideWidth + gap)) + dragDeltaX

  return (
    /* =========================================================================
       1. FULL-WIDTH STRONG BLUE OUTER BACKGROUND
       ========================================================================= */
    <section
      data-testid="teachers-carousel"
      data-active-index={activeLogicalIndex}
      data-virtual-index={virtualIndex}
      data-total-teachers={N}
      style={{
        background: 'var(--teacher-section-bg)',
      }}
      className="teacher-theme-transition w-full py-8 sm:py-14 md:py-20 px-3 sm:px-6 lg:px-8 text-right overflow-hidden select-none"
      dir="rtl"
    >
      {/* =========================================================================
         2. CENTERED REFINED CONTAINER PANEL
         ========================================================================= */}
      <div
        style={{
          backgroundColor: 'var(--teacher-panel-bg)',
          borderColor: 'var(--teacher-panel-border)',
          boxShadow: 'var(--teacher-panel-shadow)',
        }}
        className="teacher-theme-transition max-w-[1440px] mx-auto border-2 rounded-[26px] sm:rounded-[36px] md:rounded-[44px] p-4 sm:p-7 md:p-10 relative overflow-hidden"
      >
        
        {/* Subtle decorative depth glows */}
        <div
          style={{ backgroundColor: 'var(--teacher-glow-1)' }}
          className="teacher-theme-transition absolute -top-28 -right-28 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        />
        <div
          style={{ backgroundColor: 'var(--teacher-glow-2)' }}
          className="teacher-theme-transition absolute -bottom-28 -left-28 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        />

        {/* =========================================================================
           3. HEADER / FILTER ROW
           ========================================================================= */}
        <div className="relative z-10 space-y-5 mb-6 md:mb-8">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            
            {/* Right Side: Title & Subtitle */}
            <div className="space-y-2 max-w-xl">
              <span
                style={{
                  backgroundColor: 'var(--teacher-header-badge-bg)',
                  color: 'var(--teacher-header-badge-text)',
                  borderColor: 'var(--teacher-header-badge-border)',
                }}
                className="teacher-theme-transition px-3.5 py-1.5 text-xs sm:text-sm font-black rounded-full border shadow-xs inline-flex items-center gap-1.5"
              >
                {badge}
              </span>
              <h2
                style={{ color: 'var(--teacher-title-text)' }}
                className="teacher-theme-transition text-2xl sm:text-4xl lg:text-[40px] font-black tracking-tight"
              >
                {title}
              </h2>
              <p
                style={{ color: 'var(--teacher-subtitle-text)' }}
                className="teacher-theme-transition text-xs sm:text-base font-bold leading-relaxed"
              >
                {subtitle}
              </p>
            </div>

            {/* Left Side: Filter Dropdowns & Circular Navigation Controls */}
            {showFilters && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                
                {/* 1. "اختر الصف الدراسي" Filter Dropdown */}
                <div className="relative min-w-[180px]">
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    style={{
                      backgroundColor: 'var(--teacher-control-bg)',
                      color: 'var(--teacher-control-text)',
                      borderColor: selectedGrade ? '#6D5DFC' : 'var(--teacher-control-border)',
                    }}
                    className={`teacher-theme-transition teacher-filter-select w-full border-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black shadow-xs hover:border-[#6D5DFC] focus:outline-none focus:ring-2 focus:ring-[#6D5DFC]/25 cursor-pointer appearance-none text-right pr-3.5 pl-8 transition-colors ${
                      selectedGrade ? 'ring-1 ring-[#6D5DFC]/30' : ''
                    }`}
                    aria-label="اختر الصف الدراسي"
                  >
                    <option value="" style={{ backgroundColor: 'var(--teacher-control-bg)', color: 'var(--teacher-control-text)' }} className="font-black">اختر الصف الدراسي (الكل)</option>
                    {grades
                      .filter((g) => g.is_active)
                      .map((g) => (
                        <option key={g.slug} value={g.slug} style={{ backgroundColor: 'var(--teacher-control-bg)', color: 'var(--teacher-control-text)' }} className="font-bold">
                          {g.name}
                        </option>
                      ))}
                  </select>
                  <div
                    style={{ color: 'var(--teacher-control-icon)' }}
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2.5"
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                {/* 2. "اختر الشعبة العلمية" Filter Dropdown */}
                <div className="relative min-w-[180px]">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    style={{
                      backgroundColor: 'var(--teacher-control-bg)',
                      color: 'var(--teacher-control-text)',
                      borderColor: selectedDepartment ? '#6D5DFC' : 'var(--teacher-control-border)',
                    }}
                    className={`teacher-theme-transition teacher-filter-select w-full border-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-black shadow-xs hover:border-[#6D5DFC] focus:outline-none focus:ring-2 focus:ring-[#6D5DFC]/25 cursor-pointer appearance-none text-right pr-3.5 pl-8 transition-colors ${
                      selectedDepartment ? 'ring-1 ring-[#6D5DFC]/30' : ''
                    }`}
                    aria-label="اختر الشعبة العلمية"
                  >
                    <option value="" style={{ backgroundColor: 'var(--teacher-control-bg)', color: 'var(--teacher-control-text)' }} className="font-black">اختر الشعبة العلمية (الكل)</option>
                    {departments
                      .filter((d) => d.is_active)
                      .map((d) => (
                        <option key={d.slug} value={d.slug} style={{ backgroundColor: 'var(--teacher-control-bg)', color: 'var(--teacher-control-text)' }} className="font-bold">
                          {d.name}
                        </option>
                      ))}
                  </select>
                  <div
                    style={{ color: 'var(--teacher-control-icon)' }}
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2.5"
                  >
                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                {/* Circular Navigation Arrows on Left Side */}
                <div className="flex items-center gap-2.5 justify-end sm:justify-start shrink-0 pt-1 sm:pt-0">
                  <button
                    onClick={handlePrev}
                    disabled={N <= 1}
                    data-testid="carousel-prev"
                    aria-label="المعلم السابق"
                    style={{
                      backgroundColor: 'var(--teacher-arrow-bg)',
                      borderColor: 'var(--teacher-arrow-border)',
                      color: 'var(--teacher-arrow-icon)',
                      boxShadow: 'var(--teacher-arrow-shadow)',
                    }}
                    className="teacher-theme-transition w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center hover:border-[#6D5DFC] hover:!text-[#6D5DFC] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-6 h-6 stroke-[2.5]" />
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={N <= 1}
                    data-testid="carousel-next"
                    aria-label="المعلم التالي"
                    style={{
                      backgroundColor: 'var(--teacher-arrow-bg)',
                      borderColor: 'var(--teacher-arrow-border)',
                      color: 'var(--teacher-arrow-icon)',
                      boxShadow: 'var(--teacher-arrow-shadow)',
                    }}
                    className="teacher-theme-transition w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center hover:border-[#6D5DFC] hover:!text-[#6D5DFC] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
                  </button>
                </div>

              </div>
            )}

          </div>

          {/* Mode Filter Pills Bar (Online / Center / Both) */}
          {showFilters && (
            <div
              style={{ borderColor: 'var(--teacher-control-border)' }}
              className="teacher-theme-transition flex flex-wrap items-center gap-2 pt-2 border-t text-xs sm:text-sm font-black"
            >
              {[
                { label: 'الكل', value: '' },
                { label: '🟢 أونلاين', value: 'online' },
                { label: '🏫 سنتر', value: 'center' },
                { label: '🟣 أونلاين + سنتر', value: 'both' },
              ].map((pill) => {
                const isActive = selectedMode === pill.value
                return (
                  <button
                    key={pill.value}
                    onClick={() => setSelectedMode(pill.value)}
                    style={{
                      backgroundColor: isActive ? 'var(--teacher-control-active-bg)' : 'var(--teacher-control-bg)',
                      color: isActive ? 'var(--teacher-control-active-text)' : 'var(--teacher-control-text)',
                      borderColor: isActive ? 'var(--teacher-control-active-border)' : 'var(--teacher-control-border)',
                      boxShadow: isActive ? '0 4px 12px var(--teacher-control-active-shadow)' : 'none',
                    }}
                    className="teacher-theme-transition px-3.5 py-1.5 rounded-xl border-2 hover:border-[#6D5DFC] font-black cursor-pointer"
                  >
                    {pill.label}
                  </button>
                )
              })}

              {(selectedGrade || selectedDepartment || selectedMode) && (
                <button
                  onClick={() => {
                    setSelectedGrade('')
                    setSelectedDepartment('')
                    setSelectedMode('')
                  }}
                  style={{
                    backgroundColor: 'var(--teacher-reset-bg)',
                    borderColor: 'var(--teacher-reset-border)',
                    color: 'var(--teacher-reset-text)',
                  }}
                  className="teacher-theme-transition px-3.5 py-1.5 text-xs font-black flex items-center gap-1 cursor-pointer mr-auto rounded-xl border-2 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>إعادة تعيين</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* =========================================================================
           4. HORIZONTAL TEACHER CAROUSEL (TRUE INFINITE LOOP TRACK)
           ========================================================================= */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div
              style={{ borderBottomColor: 'var(--teacher-title-text)' }}
              className="animate-spin rounded-full h-12 w-12 border-b-2"
            />
          </div>
        ) : N === 0 ? (
          /* Polished Empty State inside Carousel Area */
          <div
            style={{
              backgroundColor: 'var(--teacher-empty-bg)',
              borderColor: 'var(--teacher-empty-border)',
            }}
            className="teacher-theme-transition backdrop-blur-md rounded-3xl border p-8 sm:p-12 text-center max-w-md mx-auto my-8 space-y-4 shadow-sm"
          >
            <div
              style={{
                backgroundColor: 'var(--teacher-empty-icon-bg)',
                color: 'var(--teacher-empty-icon)',
              }}
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xs"
            >
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3
                style={{ color: 'var(--teacher-title-text)' }}
                className="text-lg sm:text-xl font-black"
              >
                لا توجد خيارات متاحة
              </h3>
              <p
                style={{ color: 'var(--teacher-subtitle-text)' }}
                className="text-xs sm:text-sm font-bold leading-relaxed"
              >
                لم نتمكن من العثور على معلمين يطابقون خيارات التصفية الحالية.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedGrade('')
                setSelectedDepartment('')
                setSelectedMode('')
              }}
              style={{
                backgroundColor: 'var(--teacher-cta-bg)',
                color: 'var(--teacher-cta-text)',
              }}
              className="teacher-theme-transition px-5 py-2.5 hover:!bg-[#5B4AE3] rounded-xl text-xs sm:text-sm font-black shadow-sm active:scale-95 cursor-pointer"
            >
              عرض جميع المعلمين
            </button>
          </div>
        ) : (
          /* Carousel Viewport Container */
          <div
            ref={containerRef}
            className="w-full overflow-hidden relative select-none py-2 cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
          >
            {/* Carousel Moving Track with Smooth 500ms ease-in-out Slide Animation */}
            <div
              ref={trackRef}
              onTransitionEnd={handleTransitionEnd}
              className="flex items-stretch will-change-transform"
              style={{
                gap: `${gap}px`,
                paddingRight: `${sideInset}px`,
                transform: `translateX(${trackTranslateX}px)`,
                transition: disableTransition || isDragging ? 'none' : 'transform 500ms ease-in-out',
                width: 'max-content',
              }}
            >
              {clonedTeachers.map((teacher, flatIdx) => (
                <div
                  key={`${teacher.id}-clone-${flatIdx}`}
                  style={{ width: `${slideWidth}px` }}
                  className="shrink-0 transition-opacity duration-300"
                >
                  <TeacherCard
                    id={teacher.id}
                    name={teacher.name}
                    subject={teacher.subject}
                    avatar={teacher.avatar}
                    experience={teacher.experience}
                    bio={teacher.bio}
                    coursesCount={teacher.published_courses_count || teacher.courses_count || 0}
                    studentsCount={teacher.students_count}
                    slug={teacher.slug}
                    teaching_mode={teacher.teaching_mode}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
           5. CENTERED PAGINATION DOTS (Brand Primary & High Contrast)
           ========================================================================= */}
        {N > 1 && (
          <div className="flex items-center justify-center gap-2.5 mt-6 md:mt-8 pt-2">
            {Array.from({ length: N }).map((_, idx) => {
              const isActive = activeLogicalIndex === idx
              return (
                <button
                  key={idx}
                  onClick={() => handleDotClick(idx)}
                  data-testid={`pagination-dot-${idx}`}
                  aria-label={`الانتقال إلى المعلم ${idx + 1}`}
                  style={{
                    backgroundColor: isActive ? 'var(--teacher-dot-active)' : 'var(--teacher-dot-inactive)',
                    borderColor: isActive ? 'var(--teacher-dot-active)' : 'var(--teacher-dot-inactive-border)',
                  }}
                  className={`teacher-theme-transition transition-all duration-300 rounded-full cursor-pointer ${
                    isActive
                      ? 'w-8 h-3 shadow-md ring-2 ring-[#6D5DFC]/25'
                      : 'w-3 h-3 border hover:scale-110 shadow-xs'
                  }`}
                />
              )
            })}
          </div>
        )}

      </div>

    </section>
  )
}
