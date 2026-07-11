import React from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Minimize2, Download, FileText, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import API from '../../services/api'
import { Skeleton } from '../../components/ui/Skeleton'
import { useModalStore } from '../../store/modalStore'

interface PdfData {
  id: number
  title: string
  file_path: string
  page_count: number | null
  file_size: string | null
}

interface LessonData {
  id: number
  title: string
}

export default function PdfViewerPage() {
  const { pdfId } = useParams<{ pdfId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const courseId = searchParams.get('course_id')
  const packageId = searchParams.get('package_id')

  // State
  const [pdf, setPdf] = React.useState<PdfData | null>(null)
  const [lesson, setLesson] = React.useState<LessonData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isPublic, setIsPublic] = React.useState(true)

  // Viewer Controls State (for local PDFs)
  const [page, setPage] = React.useState(1)
  const [zoom, setZoom] = React.useState(100)
  const [fitMode, setFitMode] = React.useState<'width' | 'page' | 'none'>('none')
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!pdfId) return

    setLoading(true)
    setError(null)

    const params: any = {}
    if (courseId) params.course_id = courseId
    if (packageId) params.package_id = packageId

    API.get(`/student/pdfs/${pdfId}`, { params })
      .then((res) => {
        setPdf(res.data.pdf)
        setLesson(res.data.lesson)
        setIsPublic(res.data.is_public)
        if (!res.data.is_public) {
          setError(res.data.error_message || 'This file is not publicly shared.')
        }
      })
      .catch((err: any) => {
        console.error('Error fetching PDF details:', err)
        setError(err.response?.data?.message || 'فشل تحميل الملف. يرجى التأكد من الاشتراك في الكورس.')
      })
      .finally(() => setLoading(false))
  }, [pdfId])

  // Monitor fullscreen state change
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Skeleton Header */}
        <div className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg bg-slate-800" />
            <Skeleton className="h-5 w-48 rounded bg-slate-800" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-lg bg-slate-800" />
            <Skeleton className="h-8 w-8 rounded-lg bg-slate-800" />
          </div>
        </div>
        {/* Skeleton Canvas */}
        <div className="flex-grow p-6 flex justify-center bg-slate-950">
          <div className="max-w-4xl w-full h-full bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8 flex flex-col gap-4 animate-pulse">
            <Skeleton className="h-8 w-3/4 rounded bg-slate-800" />
            <Skeleton className="flex-grow rounded-xl bg-slate-800/50" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !pdf) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full mb-6">
          <AlertTriangle className="h-12 w-12" />
        </div>
        <h2 className="text-xl font-black mb-2 text-slate-200">
          {!isPublic ? 'الملف غير مشترك للعامة' : 'فشل تحميل الملف'}
        </h2>
        <p className="text-sm text-slate-400 font-light max-w-md mb-8 leading-relaxed">
          {!isPublic 
            ? 'عذراً، هذا الملف غير متاح للمشاركة العامة على Google Drive. يرجى من المعلم تعديل صلاحيات الملف إلى "أي شخص لديه الرابط".'
            : error}
        </p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
        >
          العودة للخلف
        </button>
      </div>
    )
  }

  const isGoogleDrive = pdf.file_path.includes('drive.google.com') || pdf.file_path.includes('docs.google.com')
  
  // Format Google Drive link to preview
  let embedUrl = pdf.file_path
  if (isGoogleDrive) {
    let fileId = ''
    const dMatch = pdf.file_path.match(/\/d\/([a-zA-Z0-9-_]+)/)
    const idMatch = pdf.file_path.match(/id=([a-zA-Z0-9-_]+)/)
    if (dMatch) fileId = dMatch[1]
    else if (idMatch) fileId = idMatch[1]

    if (fileId) {
      embedUrl = `https://drive.google.com/file/d/${fileId}/preview`
    }
  } else {
    // Add PDF parameters for local files
    let params = `#page=${page}`
    if (fitMode === 'width') {
      params += '&zoom=Page-Width'
    } else if (fitMode === 'page') {
      params += '&zoom=Page-Fit'
    } else {
      params += `&zoom=${zoom}`
    }
    embedUrl = `${pdf.file_path}${params}`
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" ref={containerRef}>
      {/* 1. Immersive Header */}
      <div className="h-16 border-b border-slate-800/80 px-6 flex flex-row-reverse items-center justify-between bg-slate-900/50 backdrop-blur-md shrink-0">
        
        {/* Right side: Back button and Titles */}
        <div className="flex items-center gap-3 flex-row-reverse text-right min-w-0">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-100"
            title="العودة"
          >
            <ArrowLeft className="h-5 w-5 transform rotate-180" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-xs sm:text-sm text-slate-100 truncate leading-snug">{pdf.title}</h1>
            {lesson && (
              <p className="text-[10px] text-slate-400 font-light truncate">{lesson.title}</p>
            )}
          </div>
        </div>

        {/* Center: Viewer Controls (Only show if local PDF, Google Drive has its own built-in controls) */}
        {!isGoogleDrive ? (
          <div className="hidden lg:flex items-center gap-6 bg-slate-950/60 border border-slate-800/80 px-4 py-1.5 rounded-2xl text-xs font-semibold">
            {/* Page navigation */}
            <div className="flex items-center gap-2 border-l border-slate-800/80 pl-4">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5">
                <input 
                  type="number" 
                  value={page}
                  min={1}
                  max={pdf.page_count || 999}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (val > 0) setPage(val)
                  }}
                  className="w-12 bg-slate-900 text-center border border-slate-800 rounded px-1.5 py-0.5 font-bold text-slate-100 focus:outline-none focus:border-brand-primary"
                />
                <span className="text-slate-400">/ {pdf.page_count || '-'}</span>
              </div>
              <button 
                onClick={() => setPage(p => p + 1)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setFitMode('none')
                  setZoom(z => Math.max(50, z - 10))
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-12 text-center font-bold text-slate-300">{zoom}%</span>
              <button 
                onClick={() => {
                  setFitMode('none')
                  setZoom(z => Math.min(250, z + 10))
                }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Fit Modes */}
            <div className="flex items-center gap-1.5 border-r border-slate-800/80 pr-4">
              <button
                onClick={() => setFitMode(fitMode === 'width' ? 'none' : 'width')}
                className={`px-2 py-1 rounded text-[10px] transition-all cursor-pointer ${fitMode === 'width' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                ملائمة العرض
              </button>
              <button
                onClick={() => setFitMode(fitMode === 'page' ? 'none' : 'page')}
                className={`px-2 py-1 rounded text-[10px] transition-all cursor-pointer ${fitMode === 'page' ? 'bg-brand-primary text-white' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                ملائمة الصفحة
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span>مستند Google Drive مدمج (استخدم عناصر تحكم Google Drive للتصفح)</span>
          </div>
        )}

        {/* Left side: Downloader and Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button 
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900/60 border border-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-100"
            title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
          </button>

          {/* Download Button */}
          <a 
            href={pdf.file_path}
            download
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl shadow-lg transition-all"
            title="تحميل الملف"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">تحميل مباشر</span>
          </a>
        </div>
      </div>

      {/* 2. Embedded Reader Container */}
      <div className="flex-grow p-4 sm:p-6 bg-slate-950 flex justify-center items-center overflow-hidden">
        <div className="w-full h-full max-w-7xl relative bg-slate-900/20 border border-slate-800/40 rounded-3xl overflow-hidden shadow-2xl">
          <iframe 
            key={`${page}-${zoom}-${fitMode}`} // Force rerender on local PDF control change
            src={embedUrl}
            className="w-full h-full border-none bg-slate-900"
            title={pdf.title}
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  )
}
