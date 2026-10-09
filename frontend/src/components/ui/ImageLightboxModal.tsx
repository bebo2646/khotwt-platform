import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react'

export interface ImageLightboxModalProps {
  isOpen: boolean
  src: string | null
  alt?: string
  title?: string
  onClose: () => void
}

/**
 * Reusable full-screen Lightbox Modal for displaying exam question and option images.
 * Rendered via createPortal to guarantee proper viewport positioning above fullscreen containers.
 */
export function ImageLightboxModal({
  isOpen,
  src,
  alt = 'صورة بالحجم الكامل',
  title = 'عرض الصورة بالحجم الكامل',
  onClose,
}: ImageLightboxModalProps) {
  const [scale, setScale] = React.useState(1)

  // Reset zoom level whenever modal opens or image changes
  React.useEffect(() => {
    if (isOpen) {
      setScale(1)
    }
  }, [isOpen, src])

  // Handle ESC key and scroll lock
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    window.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isOpen, onClose])

  if (!isOpen || !src) return null

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((prev) => Math.min(prev + 0.35, 3))
  }

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale((prev) => Math.max(prev - 0.35, 0.75))
  }

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation()
    setScale(1)
  }

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[999999] flex flex-col items-center justify-between p-3 sm:p-5 select-none font-sans"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Backdrop Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute inset-0 bg-black/90 backdrop-blur-md cursor-zoom-out"
        />

        {/* Top Header Bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-5xl flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-700/60 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-2xl text-slate-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 rounded-xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30 shrink-0">
              <Maximize2 className="w-4 h-4" />
            </span>
            <span className="text-xs sm:text-sm font-bold truncate text-slate-100">
              {title}
            </span>
          </div>

          {/* Controls: Zoom In, Zoom Out, Reset, Close */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-0.5 border border-slate-700/50">
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 3}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.75}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              {scale !== 1 && (
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                  title="إعادة الحجم الافتراضي"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Prominent Close Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="إغلاق (Esc)"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">إغلاق</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-black/40 text-slate-400 rounded border border-white/10 font-mono">
                Esc
              </kbd>
            </button>
          </div>
        </motion.div>

        {/* Center Image Container */}
        <div
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="relative z-10 flex-1 w-full flex items-center justify-center p-2 sm:p-4 overflow-auto cursor-zoom-out"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-full max-h-full flex items-center justify-center cursor-default"
          >
            <img
              src={src}
              alt={alt}
              style={{
                transform: `scale(${scale})`,
                transition: 'transform 0.15s ease-out',
              }}
              className="max-w-[94vw] max-h-[78vh] sm:max-h-[82vh] w-auto h-auto object-contain rounded-xl sm:rounded-2xl shadow-2xl ring-1 ring-white/10 bg-slate-950/70 select-none pointer-events-auto"
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Bottom Helper Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 text-[11px] text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-full px-4 py-1 backdrop-blur-xs select-none"
        >
          <span>انقر خارج الصورة أو اضغط على Esc للإغلاق</span>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}

export { ExamImagePreview } from './ExamImagePreview'
export type { ExamImagePreviewProps } from './ExamImagePreview'

export default ImageLightboxModal

