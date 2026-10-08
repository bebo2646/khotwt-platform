import React from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import API from '../../services/api'
import { Play, FileText, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ShieldAlert, MonitorPlay, CheckSquare, Wallet, Maximize, Minimize, Lock } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useModalStore } from '../../store/modalStore'
import { isYoutubeUrl, isDirectVideoUrl, getYoutubeEmbedUrl, formatDurationArabic } from '../../utils/video'
import { useAuthStore } from '../../store/authStore'
import { checkExamAvailability } from '../../utils/exam'

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
    playerjs?: any;
  }
}

const isBunnyVideo = (video: VideoItem | null | undefined): boolean => {
  if (!video) return false;
  const url = video.bunny_embed_url || video.video_url || '';
  if (isYoutubeUrl(url) || isDirectVideoUrl(url)) return false;
  return Boolean(
    video.bunny_video_id ||
    video.bunny_stream_id ||
    video.bunny_id ||
    url.includes('mediadelivery.net') ||
    url.includes('b-cdn.net') ||
    url.includes('bunny')
  );
};

const loadPlayerjsAPI = (callback?: () => void) => {
  if (typeof window !== 'undefined' && window.playerjs) {
    if (callback) callback();
    return;
  }
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('playerjs-script');
  if (existing) {
    existing.addEventListener('load', () => { if (callback) callback(); });
    return;
  }
  const tag = document.createElement('script');
  tag.id = 'playerjs-script';
  tag.src = 'https://assets.mediadelivery.net/playerjs/player-0.1.0.min.js';
  tag.onload = () => {
    console.log('[Bunny Player] player.js loaded successfully');
    if (callback) callback();
  };
  document.head.appendChild(tag);
};

interface VideoItem {
  id: number
  title: string
  bunny_stream_id?: string
  bunny_video_id?: string | null
  bunny_id?: string | null
  bunny_embed_url: string
  video_url?: string | null
  duration_seconds: number
  thumbnail_path?: string | null
  bunny_status?: string | null
  progress?: {
    watched_seconds: number
    watched_percentage: string
    completed: boolean
    last_position_seconds: number
    watched_segments?: Array<{ start: number; end: number }>
    view_limit_details?: any
    views_used?: number
    views_allowed?: number
    views_remaining?: number
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
  max_attempts?: number
  attempts_count?: number
  is_paid?: boolean
  price?: string
  is_purchased?: boolean
  is_expired?: boolean
  close_date?: string
  end_date?: string
  close_time?: string
  end_time?: string
  progress?: {
    attempts_used?: number
    attempts_remaining?: number
    status?: string
    score?: number | null
    is_expired?: boolean
  } | null
  last_attempt?: {
    id: number
    score: number | null
    status: 'started' | 'submitted' | 'graded' | 'not_started' | 'terminated_for_cheating' | 'expired' | string
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
  course_id?: number | null
  package_id?: number | null
  matching_package_id?: number | null
  is_locked?: boolean
}

interface LessonViewerProps {
  overrideLessonId?: number
  overrideCourseId?: number
  isEmbedded?: boolean
  initialVideoId?: number
  initialPdfId?: number
  activeVideoProp?: VideoItem | null
  onVideoChange?: (video: VideoItem) => void
  onClose?: () => void
}

export default function LessonViewer({
  overrideLessonId,
  overrideCourseId,
  isEmbedded = false,
  initialVideoId,
  initialPdfId,
  activeVideoProp,
  onVideoChange,
  onClose
}: LessonViewerProps = {}) {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const id = overrideLessonId ? overrideLessonId.toString() : routeId
  const preSelectedVideoId = initialVideoId ? initialVideoId.toString() : (searchParams.get('video_id') || searchParams.get('play'))
  const courseId = overrideCourseId ? overrideCourseId.toString() : searchParams.get('course_id')
  const packageId = searchParams.get('package_id')

  const { user } = useAuthStore()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  const [viewLimitExceeded, setViewLimitExceeded] = React.useState(false)
  const [viewLimitDetails, setViewLimitDetails] = React.useState<any>(null)
  const [rechargeCode, setRechargeCode] = React.useState('')
  const [redeemingCode, setRedeemingCode] = React.useState(false)
  const [subscriptionExpired, setSubscriptionExpired] = React.useState(false)
  const [expirationMessage, setExpirationMessage] = React.useState('')

  const watchSessionIdRef = React.useRef<string>(Math.random().toString(36).substring(2) + Date.now().toString(36))
  const sessionWatchTimeRef = React.useRef<number>(0)
  const initialViewsUsedRef = React.useRef<Record<number, number>>({})
  const isSessionAuthorizedRef = React.useRef<boolean>(true)
  const activeLessonIdRef = React.useRef<string | undefined>(id)
  React.useEffect(() => { activeLessonIdRef.current = id }, [id])

  // Detect iOS (iPhone/iPad/iPod)
  const isIOSDevice = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
    );
  };

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isNativeFs);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        if (
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        ) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        }
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Lock body scroll and position when pseudo-fullscreen is active (e.g. iOS Safari)
  React.useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalWidth = document.body.style.width;
      const originalHeight = document.body.style.height;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';

      // Permit rotation to landscape during fullscreen video
      try {
        if (typeof window !== 'undefined' && 'screen' in window && (screen as any)?.orientation?.unlock) {
          (screen as any).orientation.unlock();
        }
      } catch {}

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.height = originalHeight;

        // Restore portrait orientation lock when leaving fullscreen
        try {
          if (typeof window !== 'undefined' && 'screen' in window && (screen as any)?.orientation?.lock) {
            (screen as any).orientation.lock('portrait').catch(() => {});
          }
        } catch {}
      };
    }
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    const isNativeFs = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

    if (isFullscreen || isNativeFs) {
      if (isNativeFs) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
      setIsFullscreen(false);
    } else {
      if (isIOSDevice() || !containerRef.current.requestFullscreen) {
        // iOS or browsers without Element.requestFullscreen support:
        // Use viewport-covering CSS pseudo-fullscreen to preserve watermark overlay
        setIsFullscreen(true);
      } else {
        const req =
          containerRef.current.requestFullscreen ||
          (containerRef.current as any).webkitRequestFullscreen ||
          (containerRef.current as any).mozRequestFullScreen ||
          (containerRef.current as any).msRequestFullscreen;

        if (req) {
          req.call(containerRef.current)
            .then(() => {
              setIsFullscreen(true);
            })
            .catch((err: any) => {
              console.warn('Native requestFullscreen failed, falling back to CSS pseudo-fullscreen:', err);
              setIsFullscreen(true);
            });
        } else {
          setIsFullscreen(true);
        }
      }
    }
  };

  // States
  const [lesson, setLesson] = React.useState<LessonItem | null>(null)
  const [videos, setVideos] = React.useState<VideoItem[]>([])
  const [pdfs, setPdfs] = React.useState<PdfItem[]>([])
  const [exams, setExams] = React.useState<ExamItem[]>([])
  
  const [loading, setLoading] = React.useState(!activeVideoProp)
  const [activeTab, setActiveTab] = React.useState<'videos' | 'pdfs' | 'exams'>('videos')
  
  // Selected content - initialize immediately with activeVideoProp if provided to eliminate blank/jumping states
  const [activeVideo, setActiveVideo] = React.useState<VideoItem | null>(activeVideoProp || null)
  const [activePdf, setActivePdf] = React.useState<PdfItem | null>(null)
  
  // Progress tracker variables
  const [secondsWatched, setSecondsWatched] = React.useState(0)
  const [lastPosition, setLastPosition] = React.useState(0)
  const [progressSaving, setProgressSaving] = React.useState(false)
  const [progressPercentage, setProgressPercentage] = React.useState(0)
  const [watchedTime, setWatchedTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [watchedSegments, setWatchedSegments] = React.useState<Array<{ start: number; end: number }>>([])

  // Diagnostic logs
  React.useEffect(() => {
    console.log('[Diagnostic Log] viewLimitDetails updated:', viewLimitDetails);
  }, [viewLimitDetails]);

  React.useEffect(() => {
    console.log('[Diagnostic Log] activeVideo updated:', activeVideo);
  }, [activeVideo]);

  React.useEffect(() => {
    console.log('[Diagnostic Log] isSessionAuthorizedRef updated/checked. Current value:', isSessionAuthorizedRef.current);
  }, [activeVideo?.id, viewLimitDetails]);

  console.log('[Diagnostic Render] views_used:', viewLimitDetails?.views_used, 'views_remaining:', viewLimitDetails?.remaining_views ?? viewLimitDetails?.remaining, 'isSessionAuthorized:', isSessionAuthorizedRef.current, 'viewLimitDetails:', viewLimitDetails);

  // Stable video embed URL cache per video ID to strictly prevent iframe reload/remount during playback
  const initialEmbedUrlsRef = React.useRef<Record<number, string>>({})
  const hasRestoredPositionRef = React.useRef<Record<number, boolean>>({})

  const [videoEmbedUrl, setVideoEmbedUrl] = React.useState<string>('')
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const bunnyIframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const bunnyPlayerRef = React.useRef<any>(null)

  // Refs for tracking segments without stale closure issues
  const watchedSegmentsRef = React.useRef<Array<{ start: number; end: number }>>([])
  const currentSegmentRef = React.useRef<{ start: number; end: number } | null>(null)

  React.useEffect(() => {
    watchedSegmentsRef.current = watchedSegments
  }, [watchedSegments])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getEmbedUrl = (video: VideoItem) => {
    let url = video.bunny_embed_url || video.video_url || '';
    const videoGuid = video.bunny_video_id || video.bunny_stream_id || video.bunny_id;
    if (!url && videoGuid) {
      url = `https://iframe.mediadelivery.net/embed/766707/${videoGuid}`;
    }
    const pos = video.progress?.last_position_seconds || 0;
    
    // Normalize legacy player URLs to standard embed
    if (url.includes('player.mediadelivery.net/play/')) {
      url = url.replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/');
    }

    if (isYoutubeUrl(url)) {
      const embedBase = getYoutubeEmbedUrl(url);
      const origin = typeof window !== 'undefined' && window.location.origin ? encodeURIComponent(window.location.origin) : '';
      const originQuery = origin ? `&origin=${origin}` : '';
      return `${embedBase}?enablejsapi=1&widgetid=1&playsinline=1${originQuery}${pos > 0 ? `&start=${pos}` : ''}`;
    } else if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}autoplay=false&playsinline=true&playerjs=true${pos > 0 ? `&t=${pos}` : ''}`;
    } else {
      if (pos > 0) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${pos}`;
      }
      return url;
    }
  };

  const getStableEmbedUrl = React.useCallback((video: VideoItem) => {
    if (!video || !video.id) return '';
    if (!initialEmbedUrlsRef.current[video.id]) {
      initialEmbedUrlsRef.current[video.id] = getEmbedUrl(video);
    }
    return initialEmbedUrlsRef.current[video.id];
  }, []);

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
    const requestedLessonId = id
    setLoading(true)
    const params: any = {}
    if (preSelectedVideoId) params.play = preSelectedVideoId
    if (courseId) params.course_id = courseId
    if (packageId) params.package_id = packageId

    API.get(`/student/lessons/${id}`, { params })
      .then((res) => {
        if (activeLessonIdRef.current !== requestedLessonId) {
          return;
        }
        if (res.data.is_views_exceeded) {
          setViewLimitExceeded(true)
          setViewLimitDetails(res.data.view_limit_details)
          setLesson(res.data.lesson)
          setVideos([])
          setPdfs([])
          setExams([])
          setActiveVideo(null)
          setVideoEmbedUrl('')
          return
        }

        setViewLimitExceeded(false)
        setViewLimitDetails(res.data.view_limit_details)
        setLesson(res.data.lesson)
        setVideos(res.data.videos)
        setPdfs(res.data.pdfs)
        setExams(res.data.exams)

        // Determine active video: either from query params or first in list
        if (initialPdfId && res.data.pdfs.length > 0) {
          const match = res.data.pdfs.find((p: PdfItem) => p.id === initialPdfId)
          if (match) {
            setActivePdf(match)
            setActiveTab('pdfs')
          }
        } else if (res.data.videos.length > 0) {
          const currentId = activeVideoRef.current?.id;
          const targetId = activeVideoProp?.id || (preSelectedVideoId ? Number(preSelectedVideoId) : (currentId || undefined));
          const apiMatch = res.data.videos.find((v: VideoItem) => v.id === targetId) || res.data.videos[0];
          const defaultVideo = activeVideoProp ? { ...apiMatch, ...activeVideoProp, bunny_embed_url: apiMatch?.bunny_embed_url || activeVideoProp.bunny_embed_url } : apiMatch;
          
          setActiveVideo(defaultVideo)
          activeVideoRef.current = defaultVideo
          if (defaultVideo.progress?.view_limit_details) {
            setViewLimitDetails(defaultVideo.progress.view_limit_details)
            isSessionAuthorizedRef.current = defaultVideo.progress.view_limit_details.remaining > 0 || defaultVideo.progress.view_limit_details.is_unlimited;
          } else if (res.data.view_limit_details) {
            setViewLimitDetails({
              ...res.data.view_limit_details,
              views_used: 0,
              remaining_views: res.data.view_limit_details.total_allowed_views !== -1 ? res.data.view_limit_details.total_allowed_views : -1,
              remaining: res.data.view_limit_details.total_allowed_views !== -1 ? res.data.view_limit_details.total_allowed_views : -1,
            })
            isSessionAuthorizedRef.current = res.data.view_limit_details.total_allowed_views === -1 || res.data.view_limit_details.total_allowed_views > 0;
          } else {
            isSessionAuthorizedRef.current = true;
          }
          const pos = defaultVideo.progress?.last_position_seconds || 0
          const watchedSecs = Number(defaultVideo.progress?.watched_seconds) || 0
          const segments = defaultVideo.progress?.watched_segments || []
          const merged = mergeSegments(segments)
          const segSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0)
          const totalSecs = Math.max(watchedSecs, segSecs, pos)
          const videoDuration = defaultVideo.duration_seconds || 300
          const savedPercentage = Number(defaultVideo.progress?.watched_percentage) || 0
          const computedPercentage = videoDuration > 0 ? (totalSecs / videoDuration) * 100 : 0

          if (!isPlayingRef.current && (lastPositionRef.current === 0 || activeVideoRef.current?.id !== defaultVideo.id)) {
            setLastPosition(pos)
            lastPositionRef.current = pos
          }
          setWatchedTime(totalSecs)
          setSecondsWatched(totalSecs)
          setWatchedSegments(segments)
          currentSegmentRef.current = null
          
          setDuration(videoDuration)
          setProgressPercentage(Math.min(100, Math.max(savedPercentage, computedPercentage)))

          // Set stable video embed URL once initially
          const initialEmbedUrl = getStableEmbedUrl(defaultVideo)
          setVideoEmbedUrl(initialEmbedUrl)
          console.log('[YouTube Player Debug] fetchLessonData - Set initial embed URL:', initialEmbedUrl)
          
          if (preSelectedVideoId || !initialPdfId) {
            setActiveTab('videos')
          }
        } else {
          setActiveVideo(null)
          setVideoEmbedUrl('')
          setActiveTab('pdfs')
        }
      })
      .catch((err) => {
        if (activeLessonIdRef.current !== requestedLessonId) {
          return;
        }
        console.error(err)
        if (err.response?.data?.subscription_expired) {
          setSubscriptionExpired(true)
          setExpirationMessage(err.response.data.message)
          setLesson(err.response.data.lesson)
        } else {
          // Redirect back on permission block
          if (isEmbedded && onClose) {
            onClose()
          } else {
            navigate(`/courses`)
          }
        }
      })
      .finally(() => {
        if (activeLessonIdRef.current === requestedLessonId) {
          setLoading(false);
        }
      })
  }

  const handleRedeemRechargeCode = async () => {
    if (!rechargeCode.trim()) return
    setRedeemingCode(true)
    try {
      const res = await API.post('/wallet/redeem', { code: rechargeCode })
      useModalStore.getState().showToast(res.data.message || 'تم شحن الكود بنجاح!', 'success')
      setRechargeCode('')
      fetchLessonData()
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'كود غير صالح أو منتهي الصلاحية.'
      useModalStore.getState().showAlert({
        title: 'فشل التفعيل',
        description: errorMsg,
        type: 'error'
      })
    } finally {
      setRedeemingCode(false)
    }
  }

  React.useEffect(() => {
    fetchLessonData()
  }, [id])

  // Auto-poll video status while active video is transcoding/processing on Bunny
  React.useEffect(() => {
    if (!activeVideo || !activeVideo.id) return;
    const isBunny = Boolean(activeVideo.bunny_video_id || activeVideo.bunny_stream_id || activeVideo.bunny_embed_url);
    const isPending = activeVideo.bunny_status && !['finished', 'ready', 'failed'].includes(activeVideo.bunny_status);

    if (!isBunny || !isPending) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/videos/${activeVideo.id}/status`);
        if (!isMounted) return;
        if (res.data && res.data.is_ready) {
          setActiveVideo((prev: any) => prev ? { ...prev, bunny_status: 'ready', ...res.data } : null);
          setVideos((prev: VideoItem[]) => prev.map((v) => v.id === activeVideo.id ? { ...v, bunny_status: 'ready', ...res.data } : v));
        } else if (res.data && res.data.is_failed) {
          setActiveVideo((prev: any) => prev ? { ...prev, bunny_status: 'failed' } : null);
          setVideos((prev: VideoItem[]) => prev.map((v) => v.id === activeVideo.id ? { ...v, bunny_status: 'failed' } : v));
        }
      } catch (err) {
        console.warn('Video status polling check error:', err);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeVideo?.id, activeVideo?.bunny_status])

  const [isPlaying, setIsPlaying] = React.useState(false)
  const isPlayingRef = React.useRef(isPlaying)
  React.useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Refs for tracking values without stale closures in listeners
  const activeVideoRef = React.useRef(activeVideo)
  const secondsWatchedRef = React.useRef(secondsWatched)
  const lastPositionRef = React.useRef(lastPosition)
  const durationRef = React.useRef(duration)
  const progressSavingRef = React.useRef(false)
  const lastSaveTimeRef = React.useRef<number>(0)

  React.useEffect(() => { activeVideoRef.current = activeVideo }, [activeVideo])
  React.useEffect(() => { secondsWatchedRef.current = secondsWatched }, [secondsWatched])
  React.useEffect(() => { lastPositionRef.current = lastPosition }, [lastPosition])
  React.useEffect(() => { durationRef.current = duration }, [duration])

  const handleLoadedMetadata = () => {
    if (videoRef.current && activeVideo) {
      const pos = activeVideo.progress?.last_position_seconds || 0;
      videoRef.current.currentTime = pos;
    }
  }

  // Merge active segment helper
  const pushAndMergeCurrentSegment = () => {
    if (currentSegmentRef.current) {
      const active = currentSegmentRef.current;
      if (active.end - active.start > 0) {
        setWatchedSegments(prev => {
          const next = mergeSegments([...prev, active]);
          return next;
        });
      }
    }
  };

  const getMergedSegmentsIncludingActive = (segmentsList: Array<{ start: number; end: number }>, active: { start: number; end: number } | null) => {
    if (!active || active.end <= active.start) {
      return mergeSegments(segmentsList);
    }
    return mergeSegments([...segmentsList, active]);
  };

  const getWatchedSeconds = (segmentsList: Array<{ start: number; end: number }>, active: { start: number; end: number } | null) => {
    const merged = getMergedSegmentsIncludingActive(segmentsList, active);
    return merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
  };

  // Save lesson progress API helper
  const saveLessonProgress = async (data: { 
    lessonId: number; 
    videoId?: number;
    last_position_seconds: number; 
    watched_seconds?: number; 
    progress_percentage: number;
    watched_segments?: Array<{ start: number; end: number }>;
    duration_seconds?: number;
    force?: boolean;
  }) => {
    const targetVideoId = data.videoId || activeVideoRef.current?.id
    if (!targetVideoId || progressSavingRef.current) return

    // Prevent saving to an inactive lesson unless explicitly forced
    if (!data.force && data.lessonId.toString() !== activeLessonIdRef.current) {
      return;
    }

    // Throttle non-forced saves to at most once per 2 seconds
    const now = Date.now();
    if (!data.force && now - lastSaveTimeRef.current < 2000) {
      return;
    }

    progressSavingRef.current = true
    try {
      const currentPos = Math.floor(data.last_position_seconds);
      const watched = data.watched_seconds !== undefined ? Math.floor(data.watched_seconds) : Math.max(secondsWatchedRef.current, currentPos);
      const segments = data.watched_segments || watchedSegmentsRef.current;
      const durVal = data.duration_seconds || durationRef.current || activeVideoRef.current?.duration_seconds || 300;

      const currentVideo = activeVideoRef.current?.id === targetVideoId ? activeVideoRef.current : videos.find(v => v.id === targetVideoId);
      const currentViewsUsed = currentVideo?.progress?.views_used || 0;
      if (initialViewsUsedRef.current[targetVideoId] === undefined) {
        initialViewsUsedRef.current[targetVideoId] = currentViewsUsed;
      }
      const initialViewsUsed = initialViewsUsedRef.current[targetVideoId];
      const isAlreadyConsumed = currentViewsUsed > initialViewsUsed;

      console.log('[Diagnostic Log] saveLessonProgress values:', {
        video_id: targetVideoId,
        currentViewsUsed,
        initialViewsUsed,
        isAlreadyConsumed,
        watchSessionId: watchSessionIdRef.current,
        sessionWatchTime: sessionWatchTimeRef.current
      });

      const payload = {
        watched_seconds: watched,
        last_position_seconds: currentPos,
        watched_segments: segments,
        duration_seconds: durVal,
        session_id: watchSessionIdRef.current,
        session_watch_time: Math.floor(sessionWatchTimeRef.current),
        skip_view_increment: isAlreadyConsumed,
        course_id: courseId ? Number(courseId) : undefined,
        package_id: packageId ? Number(packageId) : undefined,
      };

      console.log('Saving progress payload:', payload);

      const res = await API.post(`/videos/${targetVideoId}/progress`, payload)
      lastSaveTimeRef.current = Date.now();
      if (res.data) {
        const progressData = res.data;
        console.log('[Diagnostic Log] Progress save response:', progressData);

        // Async request isolation: discard stale responses if active video or lesson changed
        if (activeVideoRef.current?.id !== targetVideoId || (activeLessonIdRef.current && activeLessonIdRef.current !== data.lessonId.toString())) {
          console.log('[saveLessonProgress] Video or lesson changed while saving progress. Discarding stale response for video:', targetVideoId);
          return;
        }

        if (progressData.view_limit_details && activeVideoRef.current?.id === targetVideoId) {
          setViewLimitDetails(progressData.view_limit_details);
        }
        setVideos(prev => prev.map(v => {
          if (v.id === targetVideoId) {
            return {
              ...v,
              progress: progressData
            };
          }
          return v;
        }));
        setActiveVideo(prev => {
          if (prev && prev.id === targetVideoId) {
            return {
              ...prev,
              progress: progressData
            };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to save lesson progress:', err)
    } finally {
      progressSavingRef.current = false
    }
  }

  const syncProgressToDb = async (force: boolean = true) => {
    const video = activeVideoRef.current;
    if (!video) return;

    const current = lastPositionRef.current;
    const durVal = durationRef.current || video.duration_seconds || 300;
    
    // Commit active segment
    pushAndMergeCurrentSegment();
    
    const merged = mergeSegments(watchedSegmentsRef.current);
    const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const savedWatched = Number(video.progress?.watched_seconds) || 0;
    const effectiveWatched = Math.max(savedWatched, totalSecs);
    
    // Progress must ALWAYS be calculated from the actual unique watched duration
    const currentProgress = durVal > 0 ? (effectiveWatched / durVal) * 100 : 0;
    const savedPercentage = Number(video.progress?.watched_percentage) || 0;
    const percentage = Math.min(100, Math.max(savedPercentage, currentProgress));
    
    await saveLessonProgress({
      lessonId: Number(activeLessonIdRef.current || id),
      videoId: video.id,
      last_position_seconds: current,
      watched_seconds: effectiveWatched,
      progress_percentage: percentage,
      watched_segments: merged,
      duration_seconds: durVal,
      force
    });
  }

  const saveLessonProgressRef = React.useRef(saveLessonProgress)
  React.useEffect(() => { saveLessonProgressRef.current = saveLessonProgress }, [saveLessonProgress])

  const syncProgressToDbRef = React.useRef(syncProgressToDb)
  React.useEffect(() => { syncProgressToDbRef.current = syncProgressToDb }, [syncProgressToDb])

  // Keep embed URL in sync when video ID changes
  React.useEffect(() => {
    if (activeVideo) {
      const embedUrl = getEmbedUrl(activeVideo);
      setVideoEmbedUrl(embedUrl);
      console.log('[YouTube Player Debug] sync effect - videoEmbedUrl set to:', embedUrl, 'for video ID:', activeVideo.id);
    } else {
      setVideoEmbedUrl('');
    }
  }, [activeVideo?.id]);

  // Completion check hook: completion must happen only when progress >= 90 based on unique watched segments
  React.useEffect(() => {
    if (!activeVideo || duration <= 0) return;
    if (progressPercentage >= 90 && !activeVideo.progress?.completed && !progressSavingRef.current) {
      // Temporarily mark completed locally
      setVideos(prev => prev.map(v => {
        if (v.id === activeVideo.id) {
          return {
            ...v,
            progress: {
              watched_seconds: v.progress?.watched_seconds || 0,
              last_position_seconds: v.progress?.last_position_seconds || 0,
              watched_percentage: v.progress?.watched_percentage || '0.00',
              ...v.progress,
              completed: true
            }
          };
        }
        return v;
      }));
      setActiveVideo(prev => {
        if (prev && prev.id === activeVideo.id) {
          return {
            ...prev,
            progress: {
              watched_seconds: prev.progress?.watched_seconds || 0,
              last_position_seconds: prev.progress?.last_position_seconds || 0,
              watched_percentage: prev.progress?.watched_percentage || '0.00',
              ...prev.progress,
              completed: true
            }
          };
        }
        return prev;
      });
      
      const current = lastPositionRef.current;
      const merged = mergeSegments(watchedSegmentsRef.current);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      
      saveLessonProgress({
        lessonId: Number(activeLessonIdRef.current || id),
        videoId: activeVideo.id,
        last_position_seconds: current,
        watched_seconds: totalSecs,
        progress_percentage: progressPercentage,
        watched_segments: merged
      });
    }
  }, [progressPercentage, activeVideo]);

  // Safe postMessage helpers for YouTube IFrame API protocol
  const postToYouTube = React.useCallback((func: string, args: any[] = []) => {
    try {
      const iframe = (document.getElementById('youtube-player') as HTMLIFrameElement | null) || iframeRef.current;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func,
          args
        }), '*');
      }
    } catch (e) {}
  }, []);

  const sendYouTubeListening = React.useCallback(() => {
    try {
      const iframe = (document.getElementById('youtube-player') as HTMLIFrameElement | null) || iframeRef.current;
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'listening'
        }), '*');
      }
    } catch (e) {}
  }, []);

  // Player lifecycle token & generation guard to strictly isolate player instances
  const playerGenerationRef = React.useRef<number>(0);
  const ytPlayerRef = React.useRef<any>(null);
  const ytPlayerVideoIdRef = React.useRef<number | null>(null);
  const ytRetryTimeoutRef = React.useRef<any>(null);
  const bunnyTimeoutsRef = React.useRef<any[]>([]);

  // Safe YouTube player stop helper - NEVER calls .destroy() because YT.Player.prototype.destroy
  // physically removes the <iframe> DOM element behind React's back, causing React commit-phase
  // "DOMException: Failed to execute 'removeChild' on 'Node'" crashes on unmount.
  const safelyStopYoutubePlayer = React.useCallback(() => {
    if (ytRetryTimeoutRef.current) {
      clearTimeout(ytRetryTimeoutRef.current);
      ytRetryTimeoutRef.current = null;
    }
    if (ytPlayerRef.current) {
      try {
        if (typeof ytPlayerRef.current.stopVideo === 'function') {
          ytPlayerRef.current.stopVideo();
        } else if (typeof ytPlayerRef.current.pauseVideo === 'function') {
          ytPlayerRef.current.pauseVideo();
        }
      } catch (e) {}
      ytPlayerRef.current = null;
    }
    ytPlayerVideoIdRef.current = null;
  }, []);

  // Safe Bunny player cleanup helper
  const safelyCleanUpBunnyPlayer = React.useCallback(() => {
    for (const to of bunnyTimeoutsRef.current) {
      clearTimeout(to);
    }
    bunnyTimeoutsRef.current = [];

    if (bunnyPlayerRef.current) {
      try {
        bunnyPlayerRef.current.off('ready');
        bunnyPlayerRef.current.off('play');
        bunnyPlayerRef.current.off('pause');
        bunnyPlayerRef.current.off('ended');
        bunnyPlayerRef.current.off('timeupdate');
        bunnyPlayerRef.current.off('seeking');
        bunnyPlayerRef.current.off('seeked');
      } catch (e) {}
      bunnyPlayerRef.current = null;
    }
    bunnyIframeRef.current = null;
  }, []);

  // Safe postMessage helper for Bunny Stream PlayerJS protocol
  const postToBunny = React.useCallback((method: string, value?: any) => {
    try {
      const iframe = bunnyIframeRef.current || (document.getElementById('bunny-stream-player') as HTMLIFrameElement | null);
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(JSON.stringify({
          context: 'player.js',
          version: '0.0.11',
          method,
          value,
          listener: method
        }), '*');
      }
    } catch (e) {}
  }, []);

  // Register Bunny PlayerJS event listeners and restore position
  const registerBunnyEvents = React.useCallback(() => {
    const currentVid = activeVideoRef.current;
    if (!currentVid || !isBunnyVideo(currentVid)) return;

    const events = ['timeupdate', 'play', 'pause', 'ended', 'seeking', 'seeked'];
    for (const ev of events) {
      postToBunny('addEventListener', ev);
    }
    if (currentVid.id && !hasRestoredPositionRef.current[currentVid.id]) {
      const pos = currentVid.progress?.last_position_seconds || 0;
      if (pos > 0) {
        postToBunny('setCurrentTime', pos);
      }
      hasRestoredPositionRef.current[currentVid.id] = true;
    }
    postToBunny('getDuration');
    postToBunny('getCurrentTime');
    postToBunny('getPaused');
  }, [postToBunny]);

  React.useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let msg = e.data
        if (typeof msg === 'string') {
          try {
            msg = JSON.parse(msg)
          } catch (e) {
            return
          }
        }

        if (!msg || typeof msg !== 'object') return;

        const currentVid = activeVideoRef.current;
        if (!currentVid) return;

        const currentUrl = currentVid.bunny_embed_url || currentVid.video_url || '';
        const isCurrentYt = isYoutubeUrl(currentUrl);
        const isCurrentBunny = isBunnyVideo(currentVid);

        // Identify message origin
        const isBunnyMsg = msg.context === 'player.js' || 
          ['ready', 'play', 'pause', 'ended', 'timeupdate', 'seeking', 'seeked', 'getCurrentTime', 'getDuration', 'getPaused'].includes(msg.event) ||
          ['getCurrentTime', 'getDuration', 'getPaused'].includes(msg.method);

        const isYouTubeMsg = msg.event === 'infoDelivery' || 
          msg.event === 'initialDelivery' || 
          msg.event === 'onStateChange';

        // Guard: Never allow cross-player contamination!
        if (isBunnyMsg && !isCurrentBunny) {
          return;
        }
        if (isYouTubeMsg && !isCurrentYt) {
          return;
        }

        if (isCurrentBunny && isBunnyMsg) {
          // Bunny Stream events (PlayerJS specification)
          if (msg.event === 'ready') {
            registerBunnyEvents();
          } else if (msg.event === 'play') {
            setIsPlaying(true)
            isPlayingRef.current = true
          } else if (msg.event === 'pause') {
            setIsPlaying(false)
            isPlayingRef.current = false
            syncProgressToDbRef.current(true)
          } else if (msg.event === 'ended') {
            setIsPlaying(false)
            isPlayingRef.current = false
            const durVal = durationRef.current || currentVid.duration_seconds || 300;
            setLastPosition(durVal);
            lastPositionRef.current = durVal;
            setWatchedTime(durVal);
            setSecondsWatched(durVal);
            setProgressPercentage(100);
            watchedSegmentsRef.current = [{ start: 0, end: durVal }];
            saveLessonProgressRef.current({
              lessonId: Number(activeLessonIdRef.current || id),
              videoId: currentVid.id,
              last_position_seconds: durVal,
              watched_seconds: durVal,
              progress_percentage: 100,
              watched_segments: [{ start: 0, end: durVal }],
              duration_seconds: durVal,
              force: true
            });
          } else if (msg.event === 'timeupdate') {
            let time: number | undefined = undefined;
            let dur: number | undefined = undefined;

            if (msg.value?.seconds !== undefined) {
              time = Math.floor(msg.value.seconds);
            } else if (typeof msg.value === 'number') {
              time = Math.floor(msg.value);
            } else if (msg.data?.currentTime !== undefined) {
              time = Math.floor(msg.data.currentTime);
            }

            if (msg.value?.duration !== undefined) {
              dur = Math.floor(msg.value.duration);
            } else if (msg.data?.duration !== undefined) {
              dur = Math.floor(msg.data.duration);
            }

            if (time !== undefined && time >= 0) {
              const prev = lastPositionRef.current;
              setLastPosition(time);
              lastPositionRef.current = time;
              if (!isPlayingRef.current && time > prev) {
                setIsPlaying(true);
                isPlayingRef.current = true;
              }
            }
            if (dur !== undefined && dur > 0) {
              setDuration(dur);
              durationRef.current = dur;
            }
          } else if (msg.event === 'seeking' || msg.event === 'seeked') {
            let time: number | undefined = undefined;
            if (msg.value?.seconds !== undefined) {
              time = Math.floor(msg.value.seconds);
            } else if (typeof msg.value === 'number') {
              time = Math.floor(msg.value);
            } else if (msg.data?.currentTime !== undefined) {
              time = Math.floor(msg.data.currentTime);
            }

            if (time !== undefined && time >= 0) {
              setLastPosition(time);
              lastPositionRef.current = time;
              syncProgressToDbRef.current(true);
            }
          } else if (msg.event === 'getCurrentTime' || msg.method === 'getCurrentTime') {
            const time = typeof msg.value === 'number' ? Math.floor(msg.value) : (typeof msg.data === 'number' ? Math.floor(msg.data) : undefined);
            if (time !== undefined && time >= 0) {
              const prev = lastPositionRef.current;
              setLastPosition(time);
              lastPositionRef.current = time;
              if (!isPlayingRef.current && time > prev) {
                setIsPlaying(true);
                isPlayingRef.current = true;
              }
            }
          } else if (msg.event === 'getDuration' || msg.method === 'getDuration') {
            const dur = typeof msg.value === 'number' ? Math.floor(msg.value) : (typeof msg.data === 'number' ? Math.floor(msg.data) : undefined);
            if (dur !== undefined && dur > 0) {
              setDuration(dur);
              durationRef.current = dur;
            }
          } else if (msg.event === 'getPaused' || msg.method === 'getPaused') {
            const isPaused = typeof msg.value === 'boolean' ? msg.value : (typeof msg.data === 'boolean' ? msg.data : undefined);
            if (isPaused !== undefined) {
              setIsPlaying(!isPaused);
              isPlayingRef.current = !isPaused;
            }
          }
        }

        if (isCurrentYt && isYouTubeMsg) {
          // YouTube Embed events (when enablejsapi=1 is passed)
          if (msg && (msg.event === 'infoDelivery' || msg.event === 'initialDelivery')) {
            if (msg.info) {
              const state = msg.info.playerState;
              if (state === 1) { // Playing
                setIsPlaying(true);
                isPlayingRef.current = true;
              } else if (state === 2 || state === 0) { // Paused or Ended
                setIsPlaying(false);
                isPlayingRef.current = false;
                if (state === 0) {
                  const durVal = durationRef.current || currentVid.duration_seconds || 300;
                  setLastPosition(durVal);
                  lastPositionRef.current = durVal;
                }
                syncProgressToDbRef.current(true);
              }
              if (typeof msg.info.duration === 'number' && msg.info.duration > 0) {
                const durVal = Math.floor(msg.info.duration);
                setDuration(durVal);
                durationRef.current = durVal;
              }
              // Do NOT update lastPosition from infoDelivery or initialDelivery!
              // ytPlayerRef.current.getCurrentTime() is the sole authoritative writer for live YouTube playback.
            }
          } else if (msg && msg.event === 'onStateChange') {
            const state = typeof msg.info === 'number' ? msg.info : (typeof msg.data === 'number' ? msg.data : undefined);
            if (state === 1) {
              setIsPlaying(true);
              isPlayingRef.current = true;
            } else if (state === 2 || state === 0) {
              setIsPlaying(false);
              isPlayingRef.current = false;
              if (state === 0) {
                const durVal = durationRef.current || currentVid.duration_seconds || 300;
                setLastPosition(durVal);
                lastPositionRef.current = durVal;
              }
              syncProgressToDbRef.current(true);
            }
          }
        }
      } catch (err) {
        // Not a JSON message or unrelated source
      }
    }

    window.addEventListener('message', handlePlayerMessage)
    return () => window.removeEventListener('message', handlePlayerMessage)
  }, [id, registerBunnyEvents])

  // Initialize and reset segments when active video changes
  React.useEffect(() => {
    if (activeVideo) {
      const segments = activeVideo.progress?.watched_segments || [];
      const merged = mergeSegments(segments);
      const segSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const savedWatchedSecs = Number(activeVideo.progress?.watched_seconds) || 0;
      const pos = activeVideo.progress?.last_position_seconds || 0;
      const totalSecs = Math.max(savedWatchedSecs, segSecs, pos);
      const durVal = activeVideo.duration_seconds || durationRef.current || 300;
      const savedPercentage = Number(activeVideo.progress?.watched_percentage) || 0;
      const computedPercentage = durVal > 0 ? (totalSecs / durVal) * 100 : 0;
      
      setLastPosition(pos);
      lastPositionRef.current = pos;
      setWatchedSegments(segments);
      setWatchedTime(totalSecs);
      setSecondsWatched(totalSecs);
      setDuration(durVal);
      durationRef.current = durVal;
      if (durVal > 0) {
        setProgressPercentage(Math.min(100, Math.max(savedPercentage, computedPercentage)));
      }
      currentSegmentRef.current = null;
      watchSessionIdRef.current = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionWatchTimeRef.current = 0;
    }
  }, [activeVideo?.id]);

  // Unified reactive tracking effect
  React.useEffect(() => {
    if (!activeVideo) return;
    
    // Ignore hidden tab
    if (document.visibilityState === 'hidden') {
      if (currentSegmentRef.current) {
        pushAndMergeCurrentSegment();
        currentSegmentRef.current = null;
      }
      return;
    }

    // Detect playback rate to pause progress on fast speeds (> 2.0x)
    let playbackRate = 1.0;
    const currentVideoUrl = activeVideo.bunny_embed_url || activeVideo.video_url || '';
    if (isYoutubeUrl(currentVideoUrl)) {
      playbackRate = ytPlayerRef.current?.getPlaybackRate() || 1.0;
    } else if (videoRef.current) {
      playbackRate = videoRef.current.playbackRate || 1.0;
    }

    if (playbackRate > 2.0) {
      if (currentSegmentRef.current) {
        pushAndMergeCurrentSegment();
        currentSegmentRef.current = null;
      }
      return;
    }

    if (isPlaying) {
      const t = lastPosition;
      const active = currentSegmentRef.current;
      if (!active) {
        currentSegmentRef.current = { start: t, end: t };
      } else {
        const elapsed = t - active.end;
        if (elapsed >= 0 && elapsed <= 2.5) {
          // Continuous playing forward
          active.end = t;
          if (elapsed > 0) {
            sessionWatchTimeRef.current += elapsed;
          }
        } else {
          // Seeking/jumping/reversing
          pushAndMergeCurrentSegment();
          currentSegmentRef.current = { start: t, end: t };
        }
      }
    }

    // Update real-time progress for display
    const totalSecs = getWatchedSeconds(watchedSegmentsRef.current, currentSegmentRef.current);
    const savedWatchedSecs = Number(activeVideo.progress?.watched_seconds) || 0;
    const effectiveSecs = Math.max(savedWatchedSecs, totalSecs);
    const durVal = duration || activeVideo.duration_seconds || 300;
    setWatchedTime(effectiveSecs);
    setSecondsWatched(effectiveSecs);
    if (durVal > 0) {
      const currentProgress = (effectiveSecs / durVal) * 100;
      const savedPercentage = Number(activeVideo.progress?.watched_percentage) || 0;
      setProgressPercentage(Math.min(100, Math.max(savedPercentage, currentProgress)));
    }
  }, [lastPosition, isPlaying, activeVideo?.id, duration]);

  // Handle document visibility change to stop/pause active segments
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pushAndMergeCurrentSegment();
        currentSegmentRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Save progress on page unload or navigation
  React.useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeVideoRef.current && lastPositionRef.current > 0) {
        pushAndMergeCurrentSegment();
        const current = lastPositionRef.current;
        const durVal = durationRef.current || activeVideoRef.current.duration_seconds || 300;
        const merged = mergeSegments(watchedSegmentsRef.current);
        const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        const savedWatched = Number(activeVideoRef.current?.progress?.watched_seconds) || 0;
        const effectiveWatched = Math.max(savedWatched, totalSecs);
        const percentage = durVal > 0 ? (effectiveWatched / durVal) * 100 : 0;
        
        saveLessonProgressRef.current({
          lessonId: Number(activeLessonIdRef.current || id),
          videoId: activeVideoRef.current.id,
          last_position_seconds: current,
          watched_seconds: effectiveWatched,
          progress_percentage: percentage,
          watched_segments: merged,
          duration_seconds: durVal,
          force: true
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [id]);

  // Save progress when paused
  React.useEffect(() => {
    if (!isPlaying && activeVideoRef.current) {
      pushAndMergeCurrentSegment();
      currentSegmentRef.current = null;
      
      const current = lastPositionRef.current;
      const durVal = durationRef.current || activeVideoRef.current.duration_seconds || 300;
      const merged = mergeSegments(watchedSegmentsRef.current);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const savedWatched = Number(activeVideoRef.current?.progress?.watched_seconds) || 0;
      const effectiveWatched = Math.max(savedWatched, totalSecs);
      const percentage = durVal > 0 ? (effectiveWatched / durVal) * 100 : 0;
      
      saveLessonProgressRef.current({
        lessonId: Number(activeLessonIdRef.current || id),
        videoId: activeVideoRef.current.id,
        last_position_seconds: current,
        watched_seconds: effectiveWatched,
        progress_percentage: percentage,
        watched_segments: merged,
        duration_seconds: durVal,
        force: true
      });
    }
  }, [isPlaying]);

  // Controlled smooth state updates for YouTube and Bunny videos (every 350ms)
  React.useEffect(() => {
    let interval: any = null;

    if (activeVideo) {
      const currentGen = playerGenerationRef.current;
      const targetVideoId = activeVideo.id;
      const url = activeVideo.bunny_embed_url || activeVideo.video_url || '';
      const isYt = isYoutubeUrl(url);
      const isBunny = isBunnyVideo(activeVideo);

      if (isYt) {
        interval = setInterval(() => {
          if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) {
            return;
          }

          const player = ytPlayerRef.current;
          if (player) {
            try {
              if (typeof player.getCurrentTime === 'function') {
                const current = Number(player.getCurrentTime());
                if (!isNaN(current) && current >= 0) {
                  const roundedCurrent = Math.floor(current);
                  setLastPosition(roundedCurrent);
                  lastPositionRef.current = roundedCurrent;
                }
              }
              if (typeof player.getDuration === 'function') {
                const durVal = Number(player.getDuration());
                if (!isNaN(durVal) && durVal > 0) {
                  const roundedDur = Math.floor(durVal);
                  setDuration(roundedDur);
                  durationRef.current = roundedDur;
                }
              }
              if (typeof player.getPlayerState === 'function') {
                const state = player.getPlayerState();
                const playing = (state === 1);
                setIsPlaying(playing);
                isPlayingRef.current = playing;
              }
            } catch (e) {}
          }
        }, 350);
      } else if (isBunny) {
        interval = setInterval(() => {
          if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) {
            return;
          }

          const player = bunnyPlayerRef.current;
          if (player && typeof player.getCurrentTime === 'function') {
            try {
              player.getCurrentTime((t: number) => {
                if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) return;
                if (typeof t === 'number' && t >= 0) {
                  const current = Math.floor(t);
                  setLastPosition(current);
                  lastPositionRef.current = current;
                }
              });
              player.getDuration((d: number) => {
                if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) return;
                if (typeof d === 'number' && d > 0) {
                  const durVal = Math.floor(d);
                  setDuration(durVal);
                  durationRef.current = durVal;
                }
              });
              player.getPaused((p: boolean) => {
                if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) return;
                if (typeof p === 'boolean') {
                  setIsPlaying(!p);
                  isPlayingRef.current = !p;
                }
              });
            } catch (e) {}
          } else {
            postToBunny('getCurrentTime');
            postToBunny('getDuration');
            postToBunny('getPaused');
          }
        }, 500);
      }
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeVideo?.id, postToBunny]);

  // Periodic progress saving to DB (running every 5 seconds while playing)
  React.useEffect(() => {
    let interval: any = null;

    if (activeVideo && isPlaying) {
      const currentGen = playerGenerationRef.current;
      const targetVideoId = activeVideo.id;
      console.log('[Video Progress] Starting periodic progress save interval');
      interval = setInterval(() => {
        if (playerGenerationRef.current !== currentGen || activeVideoRef.current?.id !== targetVideoId) {
          return;
        }
        const current = lastPositionRef.current;
        const durVal = durationRef.current || activeVideoRef.current?.duration_seconds || 300;
        if (durVal > 0 && current >= 0) {
          const active = currentSegmentRef.current;
          const merged = getMergedSegmentsIncludingActive(watchedSegmentsRef.current, active);
          const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
          const savedWatched = Number(activeVideoRef.current?.progress?.watched_seconds) || 0;
          const effectiveWatched = Math.max(savedWatched, totalSecs);
          const percentage = (effectiveWatched / durVal) * 100;
          
          saveLessonProgressRef.current({
            lessonId: Number(activeLessonIdRef.current || id),
            videoId: activeVideoRef.current?.id,
            last_position_seconds: current,
            watched_seconds: effectiveWatched,
            progress_percentage: percentage,
            watched_segments: merged,
            duration_seconds: durVal,
            force: false
          });
        }
      }, 5000);
    }

    return () => {
      if (interval) {
        console.log('[Video Progress] Clearing periodic progress save interval');
        clearInterval(interval);
      }
    };
  }, [activeVideo?.id, isPlaying, id]);

  // Log active video player src
  React.useEffect(() => {
    if (activeVideo) {
      console.log('--- [LessonViewer Debug] Video Playback Info ---')
      console.log('Video ID:', activeVideo.id)
      console.log('Video Title:', activeVideo.title)
      console.log('Video Player Source (src):', activeVideo.bunny_embed_url || activeVideo.video_url)
      console.log('------------------------------------------------')
    }
  }, [activeVideo])

  const initYoutubePlayer = React.useCallback(() => {
    const activeVid = activeVideoRef.current;
    if (!activeVid) return;
    const url = activeVid.bunny_embed_url || activeVid.video_url || '';
    if (!isYoutubeUrl(url)) return;

    const element = document.getElementById('youtube-player') as HTMLIFrameElement | null;
    if (!element || !window.YT || !window.YT.Player) {
      return;
    }

    if (ytPlayerRef.current && ytPlayerVideoIdRef.current === activeVid.id) {
      return;
    }

    const targetGeneration = playerGenerationRef.current;
    const targetVideoId = activeVid.id;

    safelyStopYoutubePlayer();

    try {
      console.log('[YouTube Player Debug] Creating window.YT.Player instance for video ID:', activeVid.id);
      ytPlayerVideoIdRef.current = targetVideoId;

      const ytPlayer = new window.YT.Player(element, {
        events: {
          onReady: (event: any) => {
            if (playerGenerationRef.current !== targetGeneration || activeVideoRef.current?.id !== targetVideoId) {
              return;
            }
            console.log('[YouTube Player Debug] YT Player onReady triggered for video:', targetVideoId);
            ytPlayerRef.current = event.target;
            const targetVideo = activeVideoRef.current;
            const pos = targetVideo?.progress?.last_position_seconds || 0;
            if (pos > 0 && typeof event.target.seekTo === 'function') {
              console.log('[YouTube Player Debug] Seeking to position:', pos);
              event.target.seekTo(pos, true);
            }
            if (typeof event.target.getDuration === 'function') {
              const durVal = Math.floor(event.target.getDuration() || targetVideo?.duration_seconds || 300);
              if (durVal > 0) {
                setDuration(durVal);
                durationRef.current = durVal;
              }
            }
            const savedPercentage = Number(targetVideo?.progress?.watched_percentage) || 0;
            if (savedPercentage > 0) {
              setProgressPercentage(savedPercentage);
            }
          },
          onStateChange: (event: any) => {
            if (playerGenerationRef.current !== targetGeneration || activeVideoRef.current?.id !== targetVideoId) {
              return;
            }
            ytPlayerRef.current = event.target;
            const state = event.data;
            console.log('[YouTube Player Debug] YT Player onStateChange. State:', state);
            if (state === 1) { // Playing
              setIsPlaying(true);
              isPlayingRef.current = true;
              if (typeof event.target.getCurrentTime === 'function') {
                const current = Math.floor(event.target.getCurrentTime());
                if (current >= 0) {
                  setLastPosition(current);
                  lastPositionRef.current = current;
                }
              }
              if (typeof event.target.getDuration === 'function') {
                const durVal = Math.floor(event.target.getDuration());
                if (durVal > 0) {
                  setDuration(durVal);
                  durationRef.current = durVal;
                }
              }
            } else if (state === 2 || state === 0) { // Paused or Ended
              setIsPlaying(false);
              isPlayingRef.current = false;
              if (typeof event.target.getCurrentTime === 'function') {
                const current = Math.floor(event.target.getCurrentTime());
                if (current >= 0) {
                  setLastPosition(current);
                  lastPositionRef.current = current;
                }
              }
              if (typeof event.target.getDuration === 'function') {
                const durVal = Math.floor(event.target.getDuration());
                if (durVal > 0) {
                  setDuration(durVal);
                  durationRef.current = durVal;
                }
              }
              if (state === 0) {
                const durVal = durationRef.current || activeVideoRef.current?.duration_seconds || 300;
                setLastPosition(durVal);
                lastPositionRef.current = durVal;
              }
              syncProgressToDbRef.current(true);
            }
          }
        }
      });
      ytPlayerRef.current = ytPlayer;
    } catch (e) {
      console.error('[YouTube Player Debug] Failed to initialize YT Player:', e);
    }
  }, [safelyStopYoutubePlayer]);

  React.useEffect(() => {
    let attempts = 0;
    const targetGen = playerGenerationRef.current;
    const targetVideoId = activeVideoRef.current?.id;

    const tryInit = () => {
      if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVideoId) {
        return;
      }
      const activeVid = activeVideoRef.current;
      if (!activeVid) return;
      const url = activeVid.bunny_embed_url || activeVid.video_url || '';
      if (!isYoutubeUrl(url)) return;

      const element = document.getElementById('youtube-player');
      if (!element || !window.YT || !window.YT.Player) {
        if (attempts < 40) {
          attempts++;
          ytRetryTimeoutRef.current = setTimeout(tryInit, 100);
        }
        return;
      }
      initYoutubePlayer();
    };

    const loadYoutubeAPI = () => {
      if (!window.YT || !window.YT.Player) {
        if (!document.getElementById('yt-iframe-api-script')) {
          console.log('[YouTube Player Debug] Injecting YouTube IFrame API script tag');
          const tag = document.createElement('script');
          tag.id = 'yt-iframe-api-script';
          tag.src = 'https://www.youtube.com/iframe_api';
          const firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
        }
        
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevCallback) prevCallback();
          console.log('[YouTube Player Debug] onYouTubeIframeAPIReady callback fired');
          tryInit();
        };
      } else {
        console.log('[YouTube Player Debug] YouTube API already script-injected. Initializing player.');
        tryInit();
      }
    };

    const currentUrl = activeVideo ? (activeVideo.bunny_embed_url || activeVideo.video_url || '') : '';
    if (activeVideo && isYoutubeUrl(currentUrl) && activeTab === 'videos') {
      loadYoutubeAPI();
    }

    return () => {
      safelyStopYoutubePlayer();
    };
  }, [activeVideo?.id, activeTab === 'videos', initYoutubePlayer, safelyStopYoutubePlayer]);

  const initBunnyPlayer = React.useCallback(() => {
    registerBunnyEvents();

    const iframe = bunnyIframeRef.current || (document.getElementById('bunny-stream-player') as HTMLIFrameElement | null);
    if (!iframe) {
      return;
    }

    const targetGen = playerGenerationRef.current;
    const targetVidId = activeVideoRef.current?.id;

    const attachPlayerJs = () => {
      if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) {
        return;
      }
      if (!window.playerjs || !window.playerjs.Player) {
        return;
      }

      try {
        if (bunnyPlayerRef.current) {
          try {
            bunnyPlayerRef.current.off('ready');
            bunnyPlayerRef.current.off('play');
            bunnyPlayerRef.current.off('pause');
            bunnyPlayerRef.current.off('ended');
            bunnyPlayerRef.current.off('timeupdate');
            bunnyPlayerRef.current.off('seeking');
            bunnyPlayerRef.current.off('seeked');
          } catch (e) {}
          bunnyPlayerRef.current = null;
        }

        const player = new window.playerjs.Player(iframe);
        bunnyPlayerRef.current = player;
        player.loaded = true;

        player.on('ready', () => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          registerBunnyEvents();
          const targetVid = activeVideoRef.current;
          if (targetVid && targetVid.id && !hasRestoredPositionRef.current[targetVid.id]) {
            const pos = targetVid.progress?.last_position_seconds || 0;
            if (pos > 0) {
              try { player.setCurrentTime(pos); } catch (e) {}
            }
            hasRestoredPositionRef.current[targetVid.id] = true;
          }
          try {
            player.getDuration((d: number) => {
              if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
              if (d && d > 0) {
                setDuration(Math.floor(d));
                durationRef.current = Math.floor(d);
              }
            });
            player.getCurrentTime((t: number) => {
              if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
              if (t !== undefined && t >= 0) {
                setLastPosition(Math.floor(t));
                lastPositionRef.current = Math.floor(t);
              }
            });
          } catch (e) {}
        });

        player.on('play', () => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          setIsPlaying(true);
          isPlayingRef.current = true;
        });

        player.on('pause', () => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          setIsPlaying(false);
          isPlayingRef.current = false;
          syncProgressToDbRef.current(true);
        });

        player.on('seeking', (data: any) => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          const current = typeof data?.seconds === 'number' ? Math.floor(data.seconds) : (typeof data === 'number' ? Math.floor(data) : null);
          if (current !== null && current >= 0) {
            setLastPosition(current);
            lastPositionRef.current = current;
          }
        });

        player.on('seeked', (data: any) => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          const current = typeof data?.seconds === 'number' ? Math.floor(data.seconds) : (typeof data === 'number' ? Math.floor(data) : null);
          if (current !== null && current >= 0) {
            setLastPosition(current);
            lastPositionRef.current = current;
            syncProgressToDbRef.current(true);
          }
        });

        player.on('ended', () => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          setIsPlaying(false);
          isPlayingRef.current = false;
          const durVal = durationRef.current || activeVideoRef.current?.duration_seconds || 300;
          setLastPosition(durVal);
          lastPositionRef.current = durVal;
          setWatchedTime(durVal);
          setSecondsWatched(durVal);
          setProgressPercentage(100);
          watchedSegmentsRef.current = [{ start: 0, end: durVal }];
          saveLessonProgressRef.current({
            lessonId: Number(activeLessonIdRef.current || id),
            videoId: targetVidId,
            last_position_seconds: durVal,
            watched_seconds: durVal,
            progress_percentage: 100,
            watched_segments: [{ start: 0, end: durVal }],
            duration_seconds: durVal,
            force: true
          });
        });

        player.on('timeupdate', (data: any) => {
          if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
          const current = typeof data?.seconds === 'number' ? Math.floor(data.seconds) : (typeof data === 'number' ? Math.floor(data) : null);
          const durVal = typeof data?.duration === 'number' ? Math.floor(data.duration) : null;
          if (durVal && durVal > 0) {
            setDuration(durVal);
            durationRef.current = durVal;
          }
          if (current !== null && current >= 0) {
            const prev = lastPositionRef.current;
            setLastPosition(current);
            lastPositionRef.current = current;
            if (!isPlayingRef.current && current > prev) {
              setIsPlaying(true);
              isPlayingRef.current = true;
            }
          }
        });

        try {
          player.getDuration((d: number) => {
            if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
            if (d && d > 0) {
              setDuration(Math.floor(d));
              durationRef.current = Math.floor(d);
            }
          });
          player.getCurrentTime((t: number) => {
            if (playerGenerationRef.current !== targetGen || activeVideoRef.current?.id !== targetVidId) return;
            if (t !== undefined && t >= 0) {
              setLastPosition(Math.floor(t));
              lastPositionRef.current = Math.floor(t);
            }
          });
        } catch (e) {}
      } catch (err) {
        console.error('[Bunny Player] Failed to instantiate playerjs:', err);
      }
    };

    if (window.playerjs) {
      attachPlayerJs();
    } else {
      loadPlayerjsAPI(() => attachPlayerJs());
    }
  }, [id, registerBunnyEvents]);

  React.useEffect(() => {
    if (activeVideo && isBunnyVideo(activeVideo) && activeTab === 'videos') {
      const targetGen = playerGenerationRef.current;
      const targetVidId = activeVideo.id;
      registerBunnyEvents();
      loadPlayerjsAPI(() => {
        const to = setTimeout(() => {
          if (playerGenerationRef.current === targetGen && activeVideoRef.current?.id === targetVidId) {
            initBunnyPlayer();
          }
        }, 150);
        bunnyTimeoutsRef.current.push(to);
      });
    }

    return () => {
      safelyCleanUpBunnyPlayer();
    };
  }, [activeVideo?.id, activeTab === 'videos', initBunnyPlayer, registerBunnyEvents, safelyCleanUpBunnyPlayer]);

  // Handle active video selection switch - SYNCHRONOUS, IMMEDIATE, NON-BLOCKING
  const selectVideo = React.useCallback((video: VideoItem) => {
    if (!video) return;
    if (activeVideoRef.current && activeVideoRef.current.id === video.id) return;

    // Increment player generation so all existing callbacks/intervals from the previous player become no-ops
    playerGenerationRef.current += 1;

    console.log('[LessonViewer Debug] Switching video:', {
      from: activeVideoRef.current?.id,
      to: video.id,
      title: video.title
    });

    // 1. Non-blocking flush of previous video progress (never block state updates with await)
    const prevVideo = activeVideoRef.current;
    if (prevVideo) {
      pushAndMergeCurrentSegment();
      const current = lastPositionRef.current;
      const durVal = durationRef.current || prevVideo.duration_seconds || 300;
      const merged = mergeSegments(watchedSegmentsRef.current);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const savedWatched = Number(prevVideo.progress?.watched_seconds) || 0;
      const effectiveWatched = Math.max(savedWatched, totalSecs);
      
      const currentProgress = durVal > 0 ? (effectiveWatched / durVal) * 100 : 0;
      const savedPercentage = Number(prevVideo.progress?.watched_percentage) || 0;
      const percentage = Math.max(savedPercentage, currentProgress);

      saveLessonProgressRef.current({
        lessonId: Number(activeLessonIdRef.current || id),
        videoId: prevVideo.id,
        last_position_seconds: current,
        watched_seconds: effectiveWatched,
        progress_percentage: percentage,
        watched_segments: merged,
        duration_seconds: durVal,
        force: true
      }).catch(() => {});
    }

    // 2. Immediately reset playback and session
    setIsPlaying(false);
    isPlayingRef.current = false;
    currentSegmentRef.current = null;
    watchSessionIdRef.current = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessionWatchTimeRef.current = 0;

    // 3. Immediately reset metrics for the incoming video
    const pos = video.progress?.last_position_seconds || 0;
    const watchedSecs = Number(video.progress?.watched_seconds) || 0;
    const segments = video.progress?.watched_segments || [];
    const merged = mergeSegments(segments);
    const segSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const totalSecs = Math.max(watchedSecs, segSecs);
    const videoDuration = video.duration_seconds || 300;
    const savedPercentage = Number(video.progress?.watched_percentage) || 0;
    const computedPercentage = videoDuration > 0 ? (totalSecs / videoDuration) * 100 : 0;

    setLastPosition(pos);
    setWatchedTime(totalSecs);
    setSecondsWatched(totalSecs);
    setWatchedSegments(segments);
    setDuration(videoDuration);
    setProgressPercentage(Math.min(100, Math.max(savedPercentage, computedPercentage)));

    // 4. Update view limits
    if (video.progress?.view_limit_details) {
      setViewLimitDetails(video.progress.view_limit_details);
      isSessionAuthorizedRef.current = video.progress.view_limit_details.remaining > 0 || video.progress.view_limit_details.is_unlimited;
    } else if (viewLimitDetails) {
      setViewLimitDetails({
        ...viewLimitDetails,
        views_used: 0,
        remaining_views: viewLimitDetails.total_allowed_views !== -1 ? viewLimitDetails.total_allowed_views : -1,
        remaining: viewLimitDetails.total_allowed_views !== -1 ? viewLimitDetails.total_allowed_views : -1,
      });
      isSessionAuthorizedRef.current = viewLimitDetails.total_allowed_views === -1 || viewLimitDetails.total_allowed_views > 0;
    } else {
      isSessionAuthorizedRef.current = true;
    }

    // 5. Cleanup YouTube and Bunny player instances safely (without calling .destroy() to avoid React DOM unmount crash)
    safelyStopYoutubePlayer();
    safelyCleanUpBunnyPlayer();

    // 6. Set embed URL and active video synchronously
    const newEmbedUrl = getStableEmbedUrl(video);
    setVideoEmbedUrl(newEmbedUrl);
    setActiveVideo(video);
    activeVideoRef.current = video;

    // 7. Seek native video element if applicable
    if (videoRef.current) {
      videoRef.current.currentTime = pos;
    }

    // 8. If standalone viewer, sync searchParams
    if (!isEmbedded) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('video_id', video.id.toString());
        return next;
      });
    }

    if (onVideoChange) {
      onVideoChange(video);
    }
  }, [id, viewLimitDetails, isEmbedded, onVideoChange, safelyStopYoutubePlayer, safelyCleanUpBunnyPlayer]);

  // React to activeVideoProp from parent
  React.useEffect(() => {
    if (activeVideoProp && activeVideoProp.id !== activeVideoRef.current?.id) {
      selectVideo(activeVideoProp);
    }
  }, [activeVideoProp, selectVideo]);

  // React to initialVideoId or searchParams video_id changes while viewer is open
  React.useEffect(() => {
    const targetVideoId = initialVideoId || (searchParams.get('video_id') ? Number(searchParams.get('video_id')) : null);
    if (!targetVideoId) return;

    if (activeVideoRef.current && activeVideoRef.current.id === targetVideoId) return;

    if (videos && videos.length > 0) {
      const found = videos.find(v => v.id === targetVideoId);
      if (found && found.id !== activeVideoRef.current?.id) {
        selectVideo(found);
      }
    }
  }, [initialVideoId, searchParams.get('video_id'), videos, selectVideo]);

  // React to initialPdfId or searchParams pdf_id changes while viewer is open
  React.useEffect(() => {
    const targetPdfId = initialPdfId || (searchParams.get('pdf_id') ? Number(searchParams.get('pdf_id')) : null);
    if (!targetPdfId) return;

    if (activePdf && activePdf.id === targetPdfId) return;

    if (pdfs && pdfs.length > 0) {
      const found = pdfs.find(p => p.id === targetPdfId);
      if (found) {
        setActivePdf(found);
        setActiveTab('pdfs');
      }
    }
  }, [initialPdfId, searchParams.get('pdf_id'), pdfs, activePdf?.id]);

  // Handle page visibility change or unload
  React.useEffect(() => {
    const handleVisibilityOrUnload = () => {
      const video = activeVideoRef.current
      if (video) {
        // Commit active segment
        if (currentSegmentRef.current) {
          const active = currentSegmentRef.current;
          if (active.end - active.start > 0) {
            watchedSegmentsRef.current = mergeSegments([...watchedSegmentsRef.current, active]);
          }
          currentSegmentRef.current = null;
        }
        
        const current = lastPositionRef.current;
        const merged = mergeSegments(watchedSegmentsRef.current);
        const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        
        const durVal = durationRef.current || video.duration_seconds || 300;
        const payload = {
          watched_seconds: totalSecs,
          last_position_seconds: current,
          watched_segments: merged,
          duration_seconds: durVal,
          session_id: watchSessionIdRef.current,
          session_watch_time: Math.floor(sessionWatchTimeRef.current),
          course_id: courseId ? Number(courseId) : undefined,
          package_id: packageId ? Number(packageId) : undefined,
        };
        
        console.log('Saving progress on exit', payload);

        try {
          const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
          fetch(`/api/videos/${video.id}/progress`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload),
            keepalive: true
          }).catch(() => {});
        } catch (e) {
          API.post(`/videos/${video.id}/progress`, payload).catch((err) => console.error('Failed to save progress on exit:', err));
        }
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

  if (subscriptionExpired) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center font-sans" dir="rtl">
        <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl p-8 md:p-12 shadow-2xl flex flex-col items-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center animate-bounce">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-xl md:text-2xl font-black text-[var(--text-color)]">المحتوى غير متاح حالياً</h2>
          <p className="text-sm md:text-base text-slate-400 max-w-lg leading-relaxed text-center font-mono" dir="ltr">
            {expirationMessage || 'This course is temporarily unavailable because the teacher subscription has expired. Access will automatically resume after renewal.'}
          </p>
          <div className="pt-4 w-full flex justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] hover:bg-[rgba(255,255,255,0.06)] text-xs rounded-xl flex items-center gap-2 text-[var(--text-color)] cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-indigo-400" /> الرجوع للخلف
            </button>
          </div>
        </div>
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
    <div className={isEmbedded ? "w-full space-y-6" : "max-w-7xl mx-auto px-4 py-8 space-y-8"}>
      
      {/* Back button & title */}
      {!isEmbedded && (
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
            to={courseId ? `/course/${courseId}` : (packageId ? `/course/${packageId}` : `/course/${lesson.unit.course_id}`)}
            className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl hover:bg-[rgba(255,255,255,0.06)] flex items-center gap-1.5 w-fit"
          >
            <ArrowLeft className="h-4 w-4" /> العودة لصفحة الكورس
          </Link>
        </div>
      )}

      {/* Main viewer grid */}
      {viewLimitExceeded ? (
        <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-3xl text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 animate-pulse">
            <Lock className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-100 font-bold">انتهت عدد المشاهدات المسموح بها لهذا الكورس.</h2>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              لقد استنفدت جميع المشاهدات المتاحة لهذا الكورس.
              <br />
              للاستمرار في الدراسة يجب شحن كود جديد أو التواصل مع إدارة المنصة أو المدرس.
            </p>
          </div>

          {/* Recharge Code Form */}
          <div className="p-5 bg-black/20 rounded-2xl border border-slate-850 space-y-3">
            <label className="block text-xs font-bold text-slate-300 text-right">إدخال كود شحن الكورس:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rechargeCode}
                onChange={(e) => setRechargeCode(e.target.value)}
                placeholder="أدخل كود الشحن هنا..."
                className="flex-grow px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-brand-primary text-center font-mono font-bold text-slate-200"
              />
              <button
                onClick={handleRedeemRechargeCode}
                disabled={redeemingCode}
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 shrink-0"
              >
                {redeemingCode ? 'جاري التفعيل...' : 'تفعيل الكود'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/courses"
              className="px-6 py-3 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all"
            >
              العودة إلى الكورسات
            </Link>
          </div>
        </div>
      ) : (
        <div className={isEmbedded ? "w-full space-y-6" : "grid grid-cols-1 lg:grid-cols-3 gap-8"}>
        
        {/* Playback content column */}
        <div className={isEmbedded ? "w-full space-y-6" : "lg:col-span-2 space-y-6"}>
          
          {/* Video Player Display */}
          {activeTab === 'videos' && activeVideo && (
            <div className="space-y-4">
              <div 
                ref={containerRef}
                className={`bg-black overflow-hidden relative transition-all duration-200 ${
                  isFullscreen 
                    ? 'fixed inset-0 w-screen h-screen h-[100dvh] w-[100dvw] z-[99999999] rounded-none border-none m-0 p-0 flex items-center justify-center' 
                    : 'aspect-video rounded-3xl border border-[var(--border-color)]'
                }`}
              >
                
                {/* Fullscreen Button */}
                {activeVideo && (
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="absolute top-4 left-4 p-2.5 bg-black/75 hover:bg-black/90 border border-slate-700/70 rounded-xl text-slate-200 hover:text-white transition-all cursor-pointer z-[99999999] shadow-lg flex items-center gap-1.5 backdrop-blur-sm"
                    title={isFullscreen ? "خروج من ملء الشاشة (Esc)" : "ملء الشاشة"}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize className="h-4.5 w-4.5 text-white" />
                        <span className="text-xs font-bold hidden sm:inline">خروج</span>
                      </>
                    ) : (
                      <Maximize className="h-4.5 w-4.5 text-white" />
                    )}
                  </button>
                )}

                {/* Watermark Overlay */}
                {user && user.role === 'student' && (
                  <VideoWatermark name={user.name} phone={user.phone} />
                )}

                {/* Transparent interceptor over player's bottom-right fullscreen button to redirect native click to platform fullscreen */}
                {activeVideo && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleFullscreen();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleFullscreen();
                    }}
                    className="absolute bottom-0 right-0 w-16 h-14 z-30 cursor-pointer"
                    title={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
                    aria-label="ملء الشاشة"
                  />
                )}
                
                {(() => {
                  console.log('[Diagnostic Lock Check] viewLimitDetails:', viewLimitDetails, 'isSessionAuthorizedRef.current:', isSessionAuthorizedRef.current);
                  if (viewLimitDetails && viewLimitDetails.limit_enabled && !viewLimitDetails.is_unlimited && viewLimitDetails.remaining <= 0 && !isSessionAuthorizedRef.current) {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20">
                          <Lock className="w-6 h-6 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-200">لقد استنفدت جميع المشاهدات المتاحة لهذا الفيديو.</h4>
                        <p className="text-xs font-light max-w-xs leading-relaxed text-slate-400">
                          لقد شاهدت هذا الفيديو {viewLimitDetails.views_used} من {viewLimitDetails.total_allowed_views} مرات.
                        </p>
                      </div>
                    );
                  }

                  let url = activeVideo.bunny_embed_url || activeVideo.video_url || '';
                  const videoGuid = activeVideo.bunny_video_id || activeVideo.bunny_stream_id || activeVideo.bunny_id;
                  if (!url && videoGuid) {
                    url = `https://iframe.mediadelivery.net/embed/766707/${videoGuid}`;
                  }
                  
                  // Normalize legacy player URLs to standard embed
                  if (url.includes('player.mediadelivery.net/play/')) {
                    url = url.replace('player.mediadelivery.net/play/', 'iframe.mediadelivery.net/embed/');
                  }

                  if (!url) {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                        <Play className="h-12 w-12 text-amber-500 mb-3" />
                        <h4 className="text-base font-bold text-slate-200 mb-2">الفيديو غير متاح حالياً</h4>
                        <p className="text-xs font-light text-slate-400 max-w-sm mb-4">
                          عذراً، محتوى هذا الفيديو غير متوفر في مكتبة العرض أو قيد المعالجة من قبل المحاضر.
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchLessonData()}
                          className="px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    );
                  }

                  // If Bunny Stream video is still processing or failed, show proper status overlay
                  if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
                    const status = activeVideo.bunny_status;
                    if (status === 'failed') {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                          <AlertCircle className="h-12 w-12 text-rose-500 mb-3" />
                          <h4 className="text-base font-bold text-slate-200 mb-2">فشل معالجة الفيديو على السيرفر</h4>
                          <p className="text-xs font-light text-slate-400 max-w-sm mb-4">
                            حدث خطأ أثناء معالجة وترميز الفيديو على Bunny Stream. يرجى التواصل مع المحاضر أو إعادة الفحص.
                          </p>
                          <button
                            type="button"
                            onClick={() => fetchLessonData()}
                            className="px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            إعادة الفحص الآن
                          </button>
                        </div>
                      );
                    }

                    if (status && status !== 'finished' && status !== 'ready') {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                          <div className="relative flex items-center justify-center mb-3">
                            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-brand-primary opacity-25"></span>
                            <Play className="h-10 w-10 text-brand-primary animate-pulse relative" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-200 mb-1 font-bold">الفيديو قيد المعالجة حالياً (Transcoding on Bunny)</h4>
                          <p className="text-[10px] text-slate-400 font-light max-w-xs mb-3">يجري تجهيز جودات الفيديو للبث المباشر. يتم الفحص التلقائي باستمرار...</p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await API.get(`/videos/${activeVideo.id}/status`);
                                if (res.data?.is_ready) {
                                  setActiveVideo((prev: any) => prev ? { ...prev, bunny_status: 'ready', ...res.data } : null);
                                } else {
                                  fetchLessonData();
                                }
                              } catch {
                                fetchLessonData();
                              }
                            }}
                            className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            فحص الجاهزية الآن 🔄
                          </button>
                        </div>
                      );
                    }
                  }

                  if (isYoutubeUrl(url)) {
                    const finalSrc = getStableEmbedUrl(activeVideo);
                    console.log('[YouTube Player Debug] Rendering YouTube iframe. finalSrc:', finalSrc);
                    return (
                      <iframe
                        key={`yt-${activeVideo.id}`}
                        id="youtube-player"
                        src={finalSrc}
                        className="w-full h-full relative z-[1]"
                        style={{ border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        onLoad={() => {
                          console.log('[YouTube Player Debug] YouTube iframe onLoad triggered');
                          initYoutubePlayer();
                        }}
                        ref={(el) => {
                          if (el) {
                            if (iframeRef.current !== el) {
                              console.log('[YouTube Player Debug] YouTube iframe DOM element MOUNTED / CHANGED. src:', el.src);
                              iframeRef.current = el;
                            }
                          } else {
                            console.log('[YouTube Player Debug] YouTube iframe DOM element UNMOUNTED.');
                            iframeRef.current = null;
                          }
                        }}
                      />
                    );
                  } else if (isDirectVideoUrl(url)) {
                    return (
                      <video
                        key={`vid-${activeVideo.id}`}
                        ref={videoRef}
                        src={url}
                        controls
                        playsInline
                        webkit-playsinline="true"
                        className="w-full h-full object-contain relative z-[1]"
                        controlsList="nodownload"
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onTimeUpdate={(e) => {
                          const time = Math.floor(e.currentTarget.currentTime)
                          setLastPosition(time)
                          const durVal = Math.floor(e.currentTarget.duration || duration || activeVideo.duration_seconds)
                          setDuration(durVal)
                        }}
                        onSeeking={(e) => {
                          const time = Math.floor(e.currentTarget.currentTime)
                          setLastPosition(time)
                          syncProgressToDbRef.current()
                        }}
                        onEnded={() => {
                          setIsPlaying(false)
                          syncProgressToDbRef.current()
                        }}
                        onLoadedMetadata={handleLoadedMetadata}
                      />
                    );
                  } else {
                    // Bunny Stream player embed
                    const finalSrc = getStableEmbedUrl(activeVideo);
                    return (
                      <iframe
                        id="bunny-stream-player"
                        key={`bunny-${activeVideo.id}`}
                        ref={(el) => {
                          bunnyIframeRef.current = el;
                          if (el) {
                            iframeRef.current = el;
                          } else {
                            bunnyIframeRef.current = null;
                            if (iframeRef.current?.id === 'bunny-stream-player') {
                              iframeRef.current = null;
                            }
                          }
                        }}
                        src={finalSrc}
                        className="w-full h-full relative z-[1]"
                        style={{ border: 'none' }}
                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                        referrerPolicy="no-referrer-when-downgrade"
                        onLoad={() => {
                          console.log('[Bunny Player] Bunny iframe onLoad triggered');
                          const targetGen = playerGenerationRef.current;
                          const targetVidId = activeVideo.id;
                          registerBunnyEvents();
                          initBunnyPlayer();
                          const t1 = setTimeout(() => {
                            if (playerGenerationRef.current === targetGen && activeVideoRef.current?.id === targetVidId) {
                              registerBunnyEvents();
                            }
                          }, 400);
                          const t2 = setTimeout(() => {
                            if (playerGenerationRef.current === targetGen && activeVideoRef.current?.id === targetVidId) {
                              registerBunnyEvents();
                            }
                          }, 1200);
                          const t3 = setTimeout(() => {
                            if (playerGenerationRef.current === targetGen && activeVideoRef.current?.id === targetVidId) {
                              registerBunnyEvents();
                            }
                          }, 2500);
                          bunnyTimeoutsRef.current.push(t1, t2, t3);
                        }}
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
                    {(() => {
                      const totalDur = duration || activeVideo.duration_seconds || 0;
                      const playbackPercentage = totalDur > 0 ? (lastPosition / totalDur) * 100 : 0;
                      const clampedPercentage = Math.min(100, Math.max(0, playbackPercentage));
                      return (
                        <>
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span className="font-medium">
                              شاهدت: {formatTime(lastPosition)} من {formatTime(totalDur)}
                            </span>
                            <span className="font-black text-brand-primary">
                              {clampedPercentage.toFixed(0)}%
                            </span>
                          </div>
                          {/* Progress Bar */}
                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative">
                            <div
                              className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-300"
                              style={{ width: `${clampedPercentage}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}
                    {/* Completion status indicator */}
                    <div className="text-xs mt-1">
                      {(activeVideo.progress?.completed || progressPercentage >= 90) ? (
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
            activePdf ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-brand-card border border-[var(--border-color)] p-4 rounded-3xl">
                  <span className="font-bold text-sm">{activePdf.title}</span>
                  <button 
                    onClick={() => setActivePdf(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    العودة لقائمة الملفات
                  </button>
                </div>
                <div className="aspect-[3/4] md:aspect-[4/3] w-full bg-slate-950 rounded-3xl overflow-hidden relative border border-[var(--border-color)]" style={{ height: '600px' }}>
                  {(() => {
                    const isGoogle = activePdf.file_path.includes('drive.google.com') || activePdf.file_path.includes('docs.google.com');
                    let embedUrl = activePdf.file_path;
                    if (isGoogle) {
                      const match = activePdf.file_path.match(/\/d\/([a-zA-Z0-9-_]+)/);
                      if (match && match[1]) {
                        embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
                      }
                    } else {
                      embedUrl = `${activePdf.file_path}#page=1`;
                    }
                    return (
                      <iframe 
                        src={embedUrl}
                        className="w-full h-full border-none bg-slate-900"
                        title={activePdf.title}
                        allow="fullscreen"
                      />
                    );
                  })()}
                </div>
              </div>
            ) : (
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
            )
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
                    const attempt = exam.last_attempt;
                    const maxAttempts = Math.max(1, Number(exam.max_attempts || 1));
                    const attemptsUsed = Number(exam.attempts_count ?? (exam.progress?.attempts_used ?? (attempt && attempt.status !== 'not_started' ? 1 : 0)));
                    const isExpired = exam.progress?.status === 'expired' || exam.progress?.is_expired || Boolean(exam.is_expired) || (() => {
                      const endD = exam.close_date || exam.end_date;
                      if (!endD) return false;
                      const endT = exam.close_time || exam.end_time || '23:59:59';
                      const endDT = new Date(`${endD}T${endT}`);
                      return !isNaN(endDT.getTime()) && Date.now() > endDT.getTime();
                    })();
                    const hasRemainingAttempts = attemptsUsed < maxAttempts && !isExpired;
                    const isSolved = !!attempt && (attempt.status === 'submitted' || attempt.status === 'graded');
                    
                    return (
                      <div key={exam.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-2xl hover:border-slate-800 transition-colors">
                        <div className="space-y-1 min-w-0">
                          <div className="font-bold text-sm flex items-center gap-2 flex-wrap">
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
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>الدرجة النهائية: {exam.max_score} نقطة</span>
                            {maxAttempts > 1 && (
                              <span className="text-slate-500" dir="ltr">({attemptsUsed} / {maxAttempts} محاولات)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isSolved && (
                            <div className="flex items-center gap-2">
                              {attempt.status === 'graded' ? (
                                <div className="text-xs font-bold text-brand-success">
                                  الدرجة: <span dir="ltr" className="inline-block font-sans">{attempt.score} / {exam.max_score}</span>
                                </div>
                              ) : (
                                <div className="text-xs font-bold text-amber-500">تم التسليم - قيد التصحيح</div>
                              )}
                              <Link to="/student/results" className="px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 text-slate-300 rounded-lg text-xs font-bold">التفاصيل</Link>
                            </div>
                          )}

                          {(!isSolved || hasRemainingAttempts) && (
                            isExpired ? (
                              <button
                                disabled
                                className="px-4 py-2 bg-slate-800/50 text-slate-400 border border-slate-700/60 rounded-lg text-xs font-bold cursor-not-allowed whitespace-nowrap"
                              >
                                انتهى الموعد
                              </button>
                            ) : exam.is_paid && !exam.is_purchased ? (
                              <button
                                onClick={() => handlePurchaseExam(exam)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 hover:text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                <span>شراء الامتحان</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  checkExamAvailability(exam.id).then((allowed) => {
                                    if (allowed) {
                                      navigate(`/student/exams/${exam.id}${courseId ? `?course_id=${courseId}` : packageId ? `?package_id=${packageId}` : ''}`);
                                    }
                                  })
                                }}
                                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                              >
                                {attemptsUsed > 0 ? `بدء المحاولة ${attemptsUsed + 1 === 2 ? 'الثانية' : attemptsUsed + 1 === 3 ? 'الثالثة' : attemptsUsed + 1}` : 'ابدأ الاختبار'}
                              </button>
                            )
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
        {!isEmbedded && (
          <div className="space-y-6">
          
          {/* Remaining views card */}
          {viewLimitDetails && (
            <div className="bg-brand-card border border-[var(--border-color)] p-4 rounded-3xl text-right space-y-1">
              {!viewLimitDetails.limit_enabled || viewLimitDetails.is_unlimited ? (
                <>
                  <span className="text-[10px] text-slate-400 block">عدد المشاهدات:</span>
                  <span className="text-base font-black text-brand-primary">غير محدود</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] text-slate-400 block">المشاهدات المتبقية:</span>
                  <span className="text-base font-black text-brand-primary">
                    {`${viewLimitDetails.remaining_views ?? viewLimitDetails.remaining} من ${viewLimitDetails.total_allowed_views ?? viewLimitDetails.max_views}`}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Quick tab switchers */}
          <div className="bg-brand-card border border-[var(--border-color)] p-2 sm:p-4 rounded-3xl grid grid-cols-3 gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('videos')}
              className={`py-2.5 sm:py-3 text-center text-[10px] xs:text-xs font-bold rounded-2xl cursor-pointer ${
                activeTab === 'videos' ? 'bg-brand-primary text-white' : 'hover:bg-[rgba(255,255,255,0.02)] text-slate-400'
              }`}
            >
              شرح الفيديو
            </button>
            <button
              onClick={() => setActiveTab('pdfs')}
              className={`py-2.5 sm:py-3 text-center text-[10px] xs:text-xs font-bold rounded-2xl cursor-pointer ${
                activeTab === 'pdfs' ? 'bg-brand-primary text-white' : 'hover:bg-[rgba(255,255,255,0.02)] text-slate-400'
              }`}
            >
              الملخصات
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`py-2.5 sm:py-3 text-center text-[10px] xs:text-xs font-bold rounded-2xl cursor-pointer ${
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
                             <div className="text-[10px] text-slate-500 font-medium">مدة الفيديو: {formatDurationArabic(vid.duration_seconds || 0)}</div>
                           </div>
                           {(vid.progress?.completed || (isActive && progressPercentage >= 90)) ? (
                             <CheckCircle2 className="h-4 w-4 text-brand-success shrink-0 mt-0.5" />
                           ) : (
                             <Play className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                           )}
                          </div>

                          {/* Visual progress bar and stats */}
                          {(() => {
                             const currentWatched = isActive ? watchedTime : (vid.progress ? (vid.progress.watched_seconds ?? vid.progress.last_position_seconds ?? 0) : 0);
                             const totalDuration = isActive ? (duration || vid.duration_seconds || 300) : (vid.duration_seconds || 300);
                             const percentage = isActive ? progressPercentage : Math.min(100, (currentWatched / totalDuration) * 100);

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
        )}

      </div>
      )}

      {/* Platform PDF Viewer Modal */}
      {activePdf !== null && !isEmbedded && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/90" onClick={() => setActivePdf(null)} />
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

// Helper functions for watched segments tracking
const mergeSegments = (segments: Array<{ start: number; end: number }>) => {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
};

interface VideoWatermarkProps {
  name: string
  phone?: string
}

// Predefined safe positions across the player canvas
// Designed to keep watermark strictly inside the video frame while avoiding:
// - Top bar / title area (~12%)
// - Bottom control bar, progress seekbar, and volume/fullscreen buttons (~22%)
const WATERMARK_POSITIONS = [
  { top: '15%', left: '68%' }, // Top-Right (safe for RTL layout)
  { top: '65%', left: '8%' },  // Bottom-Left (safe above control bar)
  { top: '44%', left: '38%' }, // Center
  { top: '15%', left: '8%' },  // Top-Left (below exit button)
  { top: '65%', left: '68%' }, // Bottom-Right (safe above control bar)
];

function VideoWatermark({ name, phone }: VideoWatermarkProps) {
  const [posIndex, setPosIndex] = React.useState(0);

  React.useEffect(() => {
    // Pick an initial random safe position
    setPosIndex(Math.floor(Math.random() * WATERMARK_POSITIONS.length));

    // Slowly cycle to next predefined safe position every 8 seconds
    const interval = setInterval(() => {
      setPosIndex((prev) => (prev + 1) % WATERMARK_POSITIONS.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const currentPos = WATERMARK_POSITIONS[posIndex];

  return (
    <div
      className="absolute pointer-events-none select-none z-[9999999] text-right font-black"
      style={{
        top: currentPos.top,
        left: currentPos.left,
        transition: 'top 1.5s cubic-bezier(0.4, 0, 0.2, 1), left 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: 0.85,
        color: '#B00000',
        textShadow: '1.5px 1.5px 0px #000000, -1.5px -1.5px 0px #000000, 1.5px -1.5px 0px #000000, -1.5px 1.5px 0px #000000, 0 2px 5px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.85)',
        WebkitTextStroke: '0.6px rgba(0,0,0,0.9)',
        fontSize: 'clamp(11px, 1.8vw, 17px)',
        lineHeight: '1.35',
        direction: 'rtl',
        whiteSpace: 'nowrap',
      }}
    >
      <div className="font-extrabold tracking-wide drop-shadow-md">{name}</div>
      {phone && (
        <div className="text-[0.9em] font-mono font-bold tracking-wider opacity-95">
          {phone}
        </div>
      )}
    </div>
  );
}
