import React from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import API from '../../services/api'
import { Play, FileText, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ShieldAlert, MonitorPlay, CheckSquare, Wallet } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useModalStore } from '../../store/modalStore'
import { isYoutubeUrl, isDirectVideoUrl, getYoutubeEmbedUrl } from '../../utils/video'

interface VideoItem {
  id: number
  title: string
  bunny_stream_id: string
  bunny_embed_url: string
  duration_seconds: number
  thumbnail_path?: string | null
  progress?: {
    watched_seconds: number
    watched_percentage: string
    completed: boolean
    last_position_seconds: number
  } | null
}

interface PdfItem {
  id: number
  title: string
  file_path: string
  page_count?: number | null
  file_size?: string | null
  preview_path?: string | null
}

interface ExamItem {
  id: number
  title: string
  type: 'quiz' | 'homework' | 'monthly_exam'
  max_score: number
  is_paid?: boolean
  price?: string
  is_purchased?: boolean
  last_attempt?: {
    id: number
    score: number | null
    status: 'started' | 'submitted' | 'graded'
    submitted_at: string
    graded_at: string | null
    teacher_feedback: string | null
  } | null
}

interface LessonItem {
  id: number
  title: string
  description: string
  unit: {
    title: string
    course_id: number
    course: {
      title: string
    }
  }
}

export default function LessonViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preSelectedVideoId = searchParams.get('play')

  // States
  const [lesson, setLesson] = React.useState<LessonItem | null>(null)
  const [videos, setVideos] = React.useState<VideoItem[]>([])
  const [pdfs, setPdfs] = React.useState<PdfItem[]>([])
  const [exams, setExams] = React.useState<ExamItem[]>([])
  
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'videos' | 'pdfs' | 'exams'>('videos')
  
  // Selected content
  const [activeVideo, setActiveVideo] = React.useState<VideoItem | null>(null)
  const [activePdf, setActivePdf] = React.useState<PdfItem | null>(null)
  
  // Progress tracker variables
  const [secondsWatched, setSecondsWatched] = React.useState(0)
  const [lastPosition, setLastPosition] = React.useState(0)
  const [progressSaving, setProgressSaving] = React.useState(false)

  const handlePurchaseExam = (exam: ExamItem) => {
    useModalStore.getState().showConfirm({
      title: 'شراء امتحان مدفوع',
      description: `هل أنت متأكد من رغبتك في شراء الامتحان "${exam.title}" بقيمة ${exam.price} ج.م من رصيد محفظتك؟`,
      confirmText: 'شراء الآن',
      cancelText: 'إلغاء',
      type: 'question',
      onConfirm: () => {
        API.post(`/exams/${exam.id}/purchase`)
          .then((res) => {
            useModalStore.getState().showToast(res.data.message || 'تم شراء الامتحان بنجاح!', 'success')
            fetchLessonData() // Refresh status
          })
          .catch((err) => {
            const errorMsg = err.response?.data?.message || 'فشل شراء الامتحان. تأكد من وجود رصيد كافٍ في محفظتك.'
            useModalStore.getState().showAlert({
              title: 'فشل الشراء',
              description: errorMsg,
              type: 'error'
            })
          })
      }
    })
  }

  // Fetch lesson contents
  const fetchLessonData = () => {
    setLoading(true)
    API.get(`/student/lessons/${id}`)
      .then((res) => {
        setLesson(res.data.lesson)
        setVideos(res.data.videos)
        setPdfs(res.data.pdfs)
        setExams(res.data.exams)

        // Determine active video: either from query params or first in list
        if (res.data.videos.length > 0) {
          const match = res.data.videos.find((v: VideoItem) => v.id.toString() === preSelectedVideoId)
          const defaultVideo = match || res.data.videos[0]
          
          setActiveVideo(defaultVideo)
          setLastPosition(defaultVideo.progress?.last_position_seconds || 0)
          setSecondsWatched(defaultVideo.progress?.watched_seconds || 0)
        } else {
          setActiveVideo(null)
          setActiveTab('pdfs')
        }
      })
      .catch((err) => {
        console.error(err)
        // Redirect back on permission block
        navigate(`/courses`)
      })
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchLessonData()
  }, [id])

  const [isPlaying, setIsPlaying] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Refs for tracking values without stale closures in listeners
  const activeVideoRef = React.useRef(activeVideo)
  const secondsWatchedRef = React.useRef(secondsWatched)
  const lastPositionRef = React.useRef(lastPosition)
  const progressSavingRef = React.useRef(false)

  React.useEffect(() => { activeVideoRef.current = activeVideo }, [activeVideo])
  React.useEffect(() => { secondsWatchedRef.current = secondsWatched }, [secondsWatched])
  React.useEffect(() => { lastPositionRef.current = lastPosition }, [lastPosition])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && activeVideo) {
      const pos = activeVideo.progress?.last_position_seconds || 0;
      videoRef.current.currentTime = pos;
    }
  }

  // Sync progress function using refs
  const syncProgressToDb = async () => {
    const video = activeVideoRef.current
    if (!video || progressSavingRef.current) return
    progressSavingRef.current = true
    try {
      await API.post(`/videos/${video.id}/progress`, {
        watched_seconds: secondsWatchedRef.current,
        last_position_seconds: lastPositionRef.current,
      })
    } catch (err) {
      console.error('Failed to sync video progress:', err)
    } finally {
      progressSavingRef.current = false
    }
  }

  // Message listener for YouTube and Bunny Stream players
  React.useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let msg = e.data
        if (typeof msg === 'string') {
          msg = JSON.parse(msg)
        }

        // Bunny Stream events
        if (msg.event === 'play') {
          setIsPlaying(true)
        } else if (msg.event === 'pause') {
          setIsPlaying(false)
          syncProgressToDb()
        } else if (msg.event === 'timeupdate' && msg.data?.currentTime !== undefined) {
          const time = Math.floor(msg.data.currentTime)
          setLastPosition(time)
        } else if (msg.event === 'seeking' && msg.data?.currentTime !== undefined) {
          const time = Math.floor(msg.data.currentTime)
          setLastPosition(time)
          syncProgressToDb()
        }

        // YouTube Embed events (when enablejsapi=1 is passed)
        if (msg.event === 'infoDelivery' && msg.info) {
          const state = msg.info.playerState
          if (state === 1) { // Playing
            setIsPlaying(true)
          } else if (state === 2) { // Paused
            setIsPlaying(false)
            syncProgressToDb()
          } else if (state === 0) { // Ended
            setIsPlaying(false)
            syncProgressToDb()
          }
          if (msg.info.currentTime !== undefined) {
            const time = Math.floor(msg.info.currentTime)
            setLastPosition(time)
          }
        }
      } catch (err) {
        // Not a JSON message or unrelated source
      }
    }

    window.addEventListener('message', handlePlayerMessage)
    return () => window.removeEventListener('message', handlePlayerMessage)
  }, [])

  // Actual watched time tracking (continuously update while playing and tab visible)
  React.useEffect(() => {
    let intervalId: any = null;

    const startTimer = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && isPlaying) {
          setSecondsWatched(prev => prev + 1);
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (isPlaying && document.visibilityState === 'visible') {
      startTimer();
    } else {
      stopTimer();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isPlaying) {
        startTimer();
      } else {
        stopTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying]);

  // Periodic progress saving (every 12 seconds while playing)
  React.useEffect(() => {
    if (!isPlaying || !activeVideo) return

    const saveInterval = setInterval(() => {
      syncProgressToDb()
    }, 12000)

    return () => clearInterval(saveInterval)
  }, [isPlaying, activeVideo])

  // Save progress when paused
  React.useEffect(() => {
    if (!isPlaying && activeVideo) {
      syncProgressToDb()
    }
  }, [isPlaying])

  // Log active video player src
  React.useEffect(() => {
    if (activeVideo) {
      console.log('--- [LessonViewer Debug] Video Playback Info ---')
      console.log('Video ID:', activeVideo.id)
      console.log('Video Title:', activeVideo.title)
      console.log('Video Player Source (src):', activeVideo.bunny_embed_url)
      console.log('------------------------------------------------')
    }
  }, [activeVideo])

  // Handle active video selection switch
  const selectVideo = async (video: VideoItem) => {
    setIsPlaying(false)
    await syncProgressToDb() // Save progress of the active video
    setActiveVideo(video)
    const pos = video.progress?.last_position_seconds || 0
    setLastPosition(pos)
    setSecondsWatched(video.progress?.watched_seconds || 0)
    
    // Seek native video element if it's rendered
    if (videoRef.current) {
      videoRef.current.currentTime = pos
    }
  }

  const getEmbedUrl = (video: VideoItem) => {
    let url = video.bunny_embed_url || '';
    const pos = video.progress?.last_position_seconds || 0;
    
    if (isYoutubeUrl(url)) {
      return getYoutubeEmbedUrl(url, pos) || url;
    } else if (url.includes('mediadelivery.net') || url.includes('bunny')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}autoplay=false${pos > 0 ? `&t=${pos}` : ''}`;
    } else {
      if (pos > 0) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${pos}`;
      }
      return url;
    }
  };

  // Handle page visibility change or unload
  React.useEffect(() => {
    const handleVisibilityOrUnload = () => {
      const video = activeVideoRef.current
      if (video) {
        API.post(`/videos/${video.id}/progress`, {
          watched_seconds: secondsWatchedRef.current,
          last_position_seconds: lastPositionRef.current,
        }).catch((err) => console.error('Failed to save progress on exit:', err))
      }
    }

    window.addEventListener('beforeunload', handleVisibilityOrUnload)
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleVisibilityOrUnload()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('beforeunload', handleVisibilityOrUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      // Save progress on component unmount
      handleVisibilityOrUnload()
    }
  }, [])

  if (loading && !lesson) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20">
        <EmptyState type="general" title="المحاضرة غير متوفرة" description="لم نتمكن من جلب تفاصيل المحاضرة المطلوبة." />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      
      {/* Back button & title */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{lesson.unit.course.title}</span>
            <span>/</span>
            <span>{lesson.unit.title}</span>
          </div>
          <h1 className="text-2xl font-black">{lesson.title}</h1>
        </div>

        <Link
          to={`/course/${lesson.unit.course_id}`}
          className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl hover:bg-[rgba(255,255,255,0.06)] flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="h-4 w-4" /> العودة لصفحة الكورس
        </Link>
      </div>

      {/* Main viewer grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Playback content column */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Video Player Display */}
          {activeTab === 'videos' && activeVideo && (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-3xl overflow-hidden border border-[var(--border-color)] relative">
                
                {(() => {
                  const url = activeVideo.bunny_embed_url || '';
                  
                  if (!url) {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                        <Play className="h-12 w-12 text-rose-500 mb-3 animate-pulse" />
                        <h4 className="text-sm font-bold text-slate-200 mb-1">رابط الفيديو غير متوفر</h4>
                        <p className="text-xs font-light max-w-xs">يرجى التواصل مع المعلم أو إدارة المنصة لحل هذه المشكلة.</p>
                      </div>
                    );
                  }

                  if (isYoutubeUrl(url)) {
                    const embedUrlStr = getYoutubeEmbedUrl(url, lastPosition);
                    
                    if (!embedUrlStr) {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                          <AlertCircle className="h-12 w-12 text-amber-500 mb-3" />
                          <h4 className="text-sm font-bold text-slate-200 mb-1">رابط YouTube غير صالح</h4>
                          <p className="text-xs font-light max-w-xs">الرابط الموفر لا يحتوي على معرف فيديو صحيح لـ YouTube.</p>
                        </div>
                      );
                    }
                    
                    return (
                      <iframe
                        src={embedUrlStr}
                        className="w-full h-full"
                        style={{ border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="origin"
                      />
                    );
                  } else if (isDirectVideoUrl(url)) {
                    return (
                      <video
                        ref={videoRef}
                        src={url}
                        controls
                        className="w-full h-full object-contain"
                        controlsList="nodownload"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => {
                          const time = Math.floor(e.currentTarget.currentTime)
                          setLastPosition(time)
                        }}
                        onSeeking={(e) => {
                          const time = Math.floor(e.currentTarget.currentTime)
                          setLastPosition(time)
                          syncProgressToDb()
                        }}
                        onEnded={() => {
                          setIsPlaying(false)
                          syncProgressToDb()
                        }}
                        onLoadedMetadata={handleLoadedMetadata}
                      />
                    );
                  } else {
                    // Fallback to normal embed (mediadelivery.net / bunny CDN, etc.)
                    const embedUrlStr = getEmbedUrl(activeVideo);
                    return (
                      <iframe
                        src={embedUrlStr}
                        className="w-full h-full"
                        style={{ border: 'none' }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                        allowFullScreen
                        referrerPolicy="origin"
                      />
                    );
                  }
                })()}

              </div>

              {/* Video play info */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 p-6 bg-brand-card border border-[var(--border-color)] rounded-3xl">
                <div className="space-y-1 w-full">
                  <h3 className="font-bold text-base">{activeVideo.title}</h3>
                  <div className="flex flex-col gap-2 mt-2 w-full">
                    {/* Live Progress Stats */}
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span className="font-medium">
                        شاهدت: {formatTime(secondsWatched)} من {formatTime(activeVideo.duration_seconds)}
                      </span>
                      <span className="font-black text-brand-primary">
                        {activeVideo.duration_seconds > 0 ? ((secondsWatched / activeVideo.duration_seconds) * 100).toFixed(0) : '0'}%
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-300"
                        style={{ width: `${activeVideo.duration_seconds > 0 ? (secondsWatched / activeVideo.duration_seconds) * 100 : 0}%` }}
                      />
                    </div>
                    {/* Completion status indicator */}
                    <div className="text-xs mt-1">
                      {(activeVideo.duration_seconds > 0 && (secondsWatched / activeVideo.duration_seconds) * 100 >= 90) ? (
                        <span className="text-brand-success font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> مكتمل المشاهدة (تجاوز 90%)
                        </span>
                      ) : (
                        <span className="text-amber-500 font-bold flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" /> غير مكتمل (شاهد 90% للاكتمال التلقائي)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'videos' && !activeVideo && (
            <div className="p-12 text-center border border-dashed border-[var(--border-color)] rounded-3xl text-slate-400">
              لا يوجد فيديوهات شرح في هذه المحاضرة.
            </div>
          )}

          {/* PDF files list view */}
          {activeTab === 'pdfs' && (
            <div className="bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6">
              <h3 className="font-bold text-base">مرفقات وأوراق عمل المحاضرة</h3>
              
              {pdfs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-light">لا توجد مذكرات أو ملفات PDF مرفقة.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {pdfs.map((pdf) => (
                    <div key={pdf.id} className="flex gap-4 p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-3xl hover:border-brand-primary/30 transition-all group">
                      {/* Preview / Icon */}
                      <div className="w-16 h-20 shrink-0 bg-brand-surface border border-[var(--border-color)] rounded-xl overflow-hidden flex items-center justify-center relative">
                        {pdf.preview_path ? (
                          <img src={pdf.preview_path} alt={pdf.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                        ) : (
                          <FileText className="h-8 w-8 text-brand-primary animate-pulse" />
                        )}
                        <div className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded text-[7px] font-black uppercase">PDF</div>
                      </div>

                      {/* Details */}
                      <div className="flex-grow flex flex-col justify-between text-right">
                        <div className="space-y-1">
                          <h4 className="font-bold text-xs text-slate-100 line-clamp-1">{pdf.title}</h4>
                          <div className="flex gap-3 text-[10px] text-slate-400 font-medium">
                            {pdf.page_count && (
                              <span>عدد الصفحات: {pdf.page_count}</span>
                            )}
                            {pdf.file_size && (
                              <span>الحجم: {pdf.file_size}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => setActivePdf(pdf)}
                            className="px-3 py-1.5 bg-brand-primary/15 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            عرض في المنصة
                          </button>
                          <a
                            href={pdf.file_path}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                          >
                            <span>تحميل مباشر</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Exams list view */}
          {activeTab === 'exams' && (
            <div className="bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6">
              <h3 className="font-bold text-base">الامتحانات والواجبات المنزلية المقررة</h3>
              
              {exams.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-light">لا توجد اختبارات واجبة الحل في هذه المحاضرة.</div>
              ) : (
                <div className="space-y-4">
                  {exams.map((exam) => {
                    const attempt = exam.last_attempt
                    const isSolved = !!attempt && (attempt.status === 'submitted' || attempt.status === 'graded')
                    
                    return (
                      <div key={exam.id} className="flex justify-between items-center p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl hover:border-slate-800 transition-colors">
                        <div className="space-y-1">
                          <div className="font-bold text-sm flex items-center gap-2">
                            <span>{exam.title}</span>
                            <span className="px-2 py-0.5 bg-slate-500/15 text-slate-300 text-[9px] font-semibold rounded-full uppercase">
                              {exam.type === 'quiz' ? 'كويز' : exam.type === 'homework' ? 'واجب' : 'امتحان شهري'}
                            </span>
                            {exam.is_paid && (
                              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-bold rounded-full">
                                {exam.price} ج.م
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">الدرجة النهائية: {exam.max_score} نقطة</div>
                        </div>

                        <div>
                          {isSolved ? (
                            <div className="flex items-center gap-2">
                              {attempt.status === 'graded' ? (
                                <div className="text-xs font-bold text-brand-success">الدرجة: {attempt.score} / {exam.max_score}</div>
                              ) : (
                                <div className="text-xs font-bold text-amber-500">تم التسليم - قيد التصحيح</div>
                              )}
                              <Link to="/student/results" className="px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 text-slate-300 rounded-lg text-xs font-bold">التفاصيل</Link>
                            </div>
                          ) : exam.is_paid && !exam.is_purchased ? (
                            <button
                              onClick={() => handlePurchaseExam(exam)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <Wallet className="h-3.5 w-3.5" />
                              <span>شراء الامتحان</span>
                            </button>
                          ) : (
                            <Link
                              to={`/student/exams/${exam.id}`}
                              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold transition-all"
                            >
                              ابدأ الاختبار
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Sidebar / Tabs list column */}
        <div className="space-y-6">
          
          {/* Quick tab switchers */}
          <div className="bg-brand-card border border-[var(--border-color)] p-4 rounded-3xl grid grid-cols-3 gap-2">
            <button
              onClick={() => setActiveTab('videos')}
              className={`py-3 text-center text-xs font-bold rounded-2xl cursor-pointer ${
                activeTab === 'videos' ? 'bg-brand-primary text-white' : 'hover:bg-[rgba(255,255,255,0.02)] text-slate-400'
              }`}
            >
              شرح الفيديو
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`py-3 text-center text-xs font-bold rounded-2xl cursor-pointer ${
                activeTab === 'pdfs' ? 'bg-brand-primary text-white' : 'hover:bg-[rgba(255,255,255,0.02)] text-slate-400'
              }`}
            >
              الملخصات
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`py-3 text-center text-xs font-bold rounded-2xl cursor-pointer ${
                activeTab === 'exams' ? 'bg-brand-primary text-white' : 'hover:bg-[rgba(255,255,255,0.02)] text-slate-400'
              }`}
            >
              الامتحانات
            </button>
          </div>

          {/* Videos lists inside sidebar (if activeTab is videos) */}
          {activeTab === 'videos' && (
            <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <MonitorPlay className="h-4 w-4 text-brand-primary" />
                <span>فيديوهات المحاضرة:</span>
              </h3>
              
              <div className="space-y-2.5">
                {videos.map((vid) => {
                   const isActive = activeVideo?.id === vid.id
                   return (
                     <button
                       key={vid.id}
                       onClick={() => selectVideo(vid)}
                       className={`w-full flex gap-3.5 p-3 rounded-2xl border text-right cursor-pointer transition-all ${
                         isActive
                           ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold shadow-[0_0_15px_rgba(34,197,94,0.1)]'
                           : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-slate-300 hover:border-slate-800'
                       }`}
                     >
                       {/* Video Thumbnail */}
                       <div className="w-20 aspect-video shrink-0 bg-brand-surface rounded-xl overflow-hidden border border-[var(--border-color)] relative">
                         {vid.thumbnail_path ? (
                           <img src={vid.thumbnail_path} alt={vid.title} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                             <Play className="h-4 w-4" />
                           </div>
                         )}
                       </div>

                       {/* Video info & progress */}
                       <div className="flex-grow flex flex-col justify-between min-w-0">
                         <div className="flex justify-between items-start w-full gap-2">
                           <div className="space-y-0.5 text-right">
                             <div className="text-xs font-bold line-clamp-2 leading-relaxed">{vid.title}</div>
                             <div className="text-[10px] text-slate-500 font-medium">مدة الفيديو: {Math.floor(vid.duration_seconds / 60)} دقيقة</div>
                           </div>
                           {vid.progress?.completed ? (
                             <CheckCircle2 className="h-4 w-4 text-brand-success shrink-0 mt-0.5" />
                           ) : (
                             <Play className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                           )}
                          </div>

                          {/* Visual progress bar and stats */}
                          {(() => {
                            const currentWatched = isActive ? secondsWatched : (vid.progress ? vid.progress.watched_seconds : 0);
                            const totalDuration = vid.duration_seconds || 300;
                            const percentage = Math.min(100, (currentWatched / totalDuration) * 100);

                            // ASCII block style (e.g. ██████████░░░░ 65%)
                            const filledCount = Math.round(percentage / 10);
                            const emptyCount = 10 - filledCount;
                            const asciiBar = '█'.repeat(filledCount) + '░'.repeat(emptyCount);

                            return (
                              <div className="w-full mt-3 pt-2.5 border-t border-[var(--border-color)] space-y-1.5">
                                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                                  <span>شاهدت: {formatTime(currentWatched)} من {formatTime(totalDuration)}</span>
                                  <span className="font-black text-brand-primary">{percentage.toFixed(0)}%</span>
                                </div>
                                
                                <div className="font-mono text-brand-primary text-[8px] tracking-tight text-left leading-none" dir="ltr">
                                  {asciiBar}
                                </div>

                                {/* Glowing bar */}
                                <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden relative">
                                  <div
                                    className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-300"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                               </div>
                            );
                          })()}
                        </div>
                      </button>
                   )
                })}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Platform PDF Viewer Modal */}
      {activePdf !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md" onClick={() => setActivePdf(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden z-10 text-right">
            
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-color)] flex justify-between items-center bg-brand-surface/40">
              <button 
                onClick={() => setActivePdf(null)}
                className="p-2 text-slate-400 hover:text-slate-200 bg-brand-surface/60 rounded-xl transition-all cursor-pointer text-xs"
              >
                إغلاق المعاين
              </button>
              
              <div className="flex items-center gap-3">
                <div className="space-y-0.5 text-right">
                  <h3 className="text-sm font-black text-slate-100">{activePdf.title}</h3>
                  <div className="flex gap-2.5 text-[10px] text-slate-400 font-bold">
                    {activePdf.page_count && <span>عدد الصفحات: {activePdf.page_count}</span>}
                    {activePdf.file_size && <span>الحجم: {activePdf.file_size}</span>}
                  </div>
                </div>
                <div className="p-2 bg-emerald-500/10 text-brand-primary rounded-xl">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
            </div>

            {/* Viewer Iframe container */}
            <div className="flex-grow bg-black relative">
              <iframe 
                src={`${activePdf.file_path}#toolbar=1`}
                title={activePdf.title}
                className="w-full h-full border-none"
              />
            </div>
            
          </div>
        </div>
      )}

    </div>
  )
}
