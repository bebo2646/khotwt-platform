import React, { useState, useEffect } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

export interface ExamImagePreviewProps {
  src?: string | null
  alt?: string
  title?: string
  maxHeightClass?: string
  isOption?: boolean
  className?: string
  /**
   * Deprecated caption prop. Maintained only for backwards compatibility.
   * Caption text and its container are completely removed per platform UX rules.
   */
  caption?: string
  onOpenLightbox?: (src: string, title?: string) => void
}

/**
 * Reusable Exam Image component for questions and options.
 *
 * Requirements:
 * - NO modals, lightboxes, or new window/tab navigation (Inline Expand only).
 * - Clicking toggles inline expansion inside its natural place on the page.
 * - Clicking again returns to normal size.
 * - Preserves aspect ratio with `object-fit: contain`.
 * - Responsive: prevents overflowing screen bounds or covering navigation / submit buttons.
 * - Option images: clicking/tapping stops event propagation to NEVER change or trigger selected answer.
 * - Preserves student position, answers, and countdown timer without page reloads.
 */
export function ExamImagePreview({
  src,
  alt = 'صورة',
  title = 'عرض الصورة',
  maxHeightClass = 'max-h-64 sm:max-h-72 md:max-h-80',
  isOption = false,
  className = '',
}: ExamImagePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Reset expansion when image src changes (e.g., navigating between questions)
  useEffect(() => {
    setIsExpanded(false)
  }, [src])

  if (!src) return null

  const handleToggle = (e: React.MouseEvent | React.KeyboardEvent) => {
    // Stop propagation and prevent default to guarantee parent button selection is NEVER triggered
    e.stopPropagation()
    e.preventDefault()
    setIsExpanded((prev) => !prev)
  }

  const handleStopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation()
  }

  // --------------------------------------------------------------------------
  // OPTION IMAGE DISPLAY (Inline Expand inside option card)
  // --------------------------------------------------------------------------
  if (isOption) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'تصغير صورة الخيار' : 'تكبير صورة الخيار'}
        title={isExpanded ? 'انقر لتصغير الصورة' : 'انقر لتكبير الصورة'}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle(e)
          }
        }}
        onPointerDown={handleStopPropagation}
        onPointerUp={handleStopPropagation}
        onMouseDown={handleStopPropagation}
        onTouchStart={handleStopPropagation}
        className={`group/optimg relative overflow-hidden transition-all duration-300 select-none ${
          isExpanded
            ? 'block w-full max-w-full rounded-2xl border-2 border-brand-primary bg-slate-950/80 p-2 shadow-xl ring-2 ring-brand-primary/20 cursor-zoom-out'
            : 'inline-block max-w-full rounded-xl border border-border-color/70 bg-black/40 p-1.5 hover:border-brand-primary/60 hover:bg-black/60 cursor-zoom-in'
        } ${className}`}
      >
        <div className="relative flex items-center justify-center w-full max-w-full overflow-hidden">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            draggable={false}
            className={`w-auto max-w-full object-contain transition-all duration-300 ${
              isExpanded
                ? 'max-h-72 sm:max-h-96 md:max-h-[420px] rounded-xl'
                : 'max-h-32 sm:max-h-36 rounded-lg group-hover/optimg:scale-[1.02]'
            }`}
          />

          {/* Inline Toggle Pill / Badge */}
          <div
            className={`absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md shadow-md text-xs font-bold transition-all ${
              isExpanded
                ? 'bg-slate-900/90 text-brand-primary border border-brand-primary/40 opacity-100'
                : 'bg-black/75 text-slate-200 border border-white/10 opacity-0 group-hover/optimg:opacity-100'
            }`}
          >
            {isExpanded ? (
              <>
                <ZoomOut className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-[10px]">تصغير</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-[10px]">تكبير</span>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // QUESTION IMAGE DISPLAY (Inline Expand inside question card)
  // --------------------------------------------------------------------------
  return (
    <div className={`w-full max-w-full ${className}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={isExpanded ? 'تصغير صورة السؤال' : 'تكبير صورة السؤال'}
        title={isExpanded ? 'انقر لإعادة الحجم الطبيعي' : 'انقر لتكبير الصورة'}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle(e)
          }
        }}
        onPointerDown={handleStopPropagation}
        onPointerUp={handleStopPropagation}
        onMouseDown={handleStopPropagation}
        onTouchStart={handleStopPropagation}
        className={`group/qimg transition-all duration-300 select-none relative max-w-full ${
          isExpanded
            ? 'flex flex-col items-center w-full rounded-2xl border-2 border-brand-primary bg-slate-950/85 p-2.5 sm:p-3 shadow-2xl ring-2 ring-brand-primary/20 cursor-zoom-out'
            : 'inline-flex flex-col items-center sm:items-start rounded-2xl border border-border-color/80 bg-slate-950/40 hover:bg-slate-950/60 hover:border-brand-primary/50 p-2 sm:p-2.5 shadow-md cursor-zoom-in'
        }`}
      >
        <div className="relative overflow-hidden rounded-xl bg-black/20 flex items-center justify-center w-full max-w-full">
          <img
            src={src}
            alt={alt}
            loading="lazy"
            draggable={false}
            className={`w-auto h-auto max-w-full object-contain transition-all duration-300 ${
              isExpanded
                ? 'max-h-[60vh] sm:max-h-[70vh] md:max-h-[75vh] rounded-xl'
                : `${maxHeightClass} rounded-xl group-hover/qimg:scale-[1.01]`
            }`}
          />

          {/* Inline Toggle Pill / Badge */}
          <div
            className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md text-[11px] font-bold transition-all ${
              isExpanded
                ? 'bg-slate-900/90 text-brand-primary border border-brand-primary/40 opacity-100'
                : 'bg-slate-900/85 text-brand-primary border border-white/10 opacity-0 group-hover/qimg:opacity-100'
            }`}
          >
            {isExpanded ? (
              <>
                <ZoomOut className="w-3.5 h-3.5" />
                <span>تصغير</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5" />
                <span>تكبير</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExamImagePreview
