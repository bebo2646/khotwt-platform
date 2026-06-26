import React from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import API from '../../services/api'
import { Play, FileText, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, ShieldAlert, MonitorPlay, CheckSquare, Wallet } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import { useModalStore } from '../../store/modalStore'
import { isYoutubeUrl, isDirectVideoUrl, getYoutubeEmbedUrl } from '../../utils/video'

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface VideoItem {
  id: number
  title: string
  bunny_stream_id: string
  bunny_embed_url: string
  duration_seconds: number
  thumbnail_path?: string | null
  bunny_status?: string | null
  progress?: {
    watched_seconds: number
    watched_percentage: string
    completed: boolean
    last_position_seconds: number
    watched_segments?: Array<{ start: number; end: number }>
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
  const [progressPercentage, setProgressPercentage] = React.useState(0)
  const [watchedTime, setWatchedTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [watchedSegments, setWatchedSegments] = React.useState<Array<{ start: number; end: number }>>([])

  // Stable video embed URL state to prevent iframe reload/remount
  const [videoEmbedUrl, setVideoEmbedUrl] = React.useState<string>('')
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)

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
    let url = video.bunny_embed_url || '';
    const pos = video.progress?.last_position_seconds || 0;
    
    // Auto-regeneration fallback if URL is empty or misconfigured
    if ((!url || !url.includes('691418') || (video.bunny_stream_id && !url.includes(video.bunny_stream_id))) && video.bunny_stream_id) {
      url = `https://iframe.mediadelivery.net/embed/691418/${video.bunny_stream_id}`;
    }

    if (isYoutubeUrl(url)) {
      const embedBase = getYoutubeEmbedUrl(url);
      return `${embedBase}?enablejsapi=1&start=${pos}`;
    } else if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}autoplay=false&playerjs=true${pos > 0 ? `&t=${pos}` : ''}`;
    } else {
      if (pos > 0) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${pos}`;
      }
      return url;
    }
  };

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
          const pos = defaultVideo.progress?.last_position_seconds || 0
          const watchedSecs = defaultVideo.progress?.watched_seconds || 0
          const segments = defaultVideo.progress?.watched_segments || []
          setLastPosition(pos)
          setWatchedTime(watchedSecs)
          setSecondsWatched(watchedSecs)
          setWatchedSegments(segments)
          currentSegmentRef.current = null
          
          const videoDuration = defaultVideo.duration_seconds || 300
          setDuration(videoDuration)
          setProgressPercentage(videoDuration > 0 ? (watchedSecs / videoDuration) * 100 : 0)

          // Set stable video embed URL once initially
          const initialEmbedUrl = getEmbedUrl(defaultVideo)
          setVideoEmbedUrl(initialEmbedUrl)
          console.log('[YouTube Player Debug] fetchLessonData - Set initial embed URL:', initialEmbedUrl)
        } else {
          setActiveVideo(null)
          setVideoEmbedUrl('')
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
  const durationRef = React.useRef(duration)
  const progressSavingRef = React.useRef(false)

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
    last_position_seconds: number; 
    watched_seconds?: number; 
    progress_percentage: number;
    watched_segments?: Array<{ start: number; end: number }>;
  }) => {
    const video = activeVideoRef.current
    if (!video || progressSavingRef.current) return
    progressSavingRef.current = true
    try {
      const currentPos = Math.floor(data.last_position_seconds);
      const watched = data.watched_seconds !== undefined ? Math.floor(data.watched_seconds) : Math.max(secondsWatchedRef.current, currentPos);
      const segments = data.watched_segments || watchedSegmentsRef.current;

      const payload = {
        watched_seconds: watched,
        last_position_seconds: currentPos,
        watched_segments: segments,
      };

      console.log('Saving progress', payload);

      const res = await API.post(`/videos/${video.id}/progress`, payload)
      if (res.data) {
        setVideos(prev => prev.map(v => {
          if (v.id === video.id) {
            return {
              ...v,
              progress: res.data
            };
          }
          return v;
        }));
        setActiveVideo(prev => {
          if (prev && prev.id === video.id) {
            return {
              ...prev,
              progress: res.data
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

  const syncProgressToDb = async () => {
    const current = lastPositionRef.current;
    const durVal = durationRef.current || activeVideoRef.current?.duration_seconds || 300;
    
    // Commit active segment
    pushAndMergeCurrentSegment();
    
    const merged = mergeSegments(watchedSegmentsRef.current);
    const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const percentage = durVal > 0 ? (totalSecs / durVal) * 100 : 0;
    
    await saveLessonProgress({
      lessonId: Number(id),
      last_position_seconds: current,
      watched_seconds: totalSecs,
      progress_percentage: percentage,
      watched_segments: merged
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
        lessonId: Number(id),
        last_position_seconds: current,
        watched_seconds: totalSecs,
        progress_percentage: progressPercentage,
        watched_segments: merged
      });
    }
  }, [progressPercentage, activeVideo]);

  React.useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let msg = e.data
        if (typeof msg === 'string') {
          msg = JSON.parse(msg)
        }

        if (msg && typeof msg === 'object') {
          // Temporary logging of incoming player messages
          console.log('[Player Message Debug] Received message:', msg);

          // Bunny Stream events (PlayerJS specification)
          if (msg.event === 'play') {
            setIsPlaying(true)
          } else if (msg.event === 'pause') {
            setIsPlaying(false)
            syncProgressToDbRef.current()
          } else if (msg.event === 'ended') {
            setIsPlaying(false)
            syncProgressToDbRef.current()
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

            if (time !== undefined) {
              setLastPosition(time);
            }
            if (dur !== undefined && dur > 0) {
              setDuration(dur);
            }
          } else if (msg.event === 'seeking') {
            let time: number | undefined = undefined;
            if (msg.value?.seconds !== undefined) {
              time = Math.floor(msg.value.seconds);
            } else if (typeof msg.value === 'number') {
              time = Math.floor(msg.value);
            } else if (msg.data?.currentTime !== undefined) {
              time = Math.floor(msg.data.currentTime);
            }

            if (time !== undefined) {
              setLastPosition(time);
              syncProgressToDbRef.current();
            }
          }
        }

        // YouTube Embed events (when enablejsapi=1 is passed)
        if (msg && msg.event === 'infoDelivery' && msg.info) {
          const state = msg.info.playerState
          if (state === 1) { // Playing
            setIsPlaying(true)
          } else if (state === 2) { // Paused
            setIsPlaying(false)
            syncProgressToDbRef.current()
          } else if (state === 0) { // Ended
            setIsPlaying(false)
            syncProgressToDbRef.current()
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

  // Initialize and reset segments when active video changes
  React.useEffect(() => {
    if (activeVideo) {
      const segments = activeVideo.progress?.watched_segments || [];
      const merged = mergeSegments(segments);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const durVal = duration || activeVideo.duration_seconds || 300;
      
      setWatchedSegments(segments);
      setWatchedTime(totalSecs);
      setSecondsWatched(totalSecs);
      if (durVal > 0) {
        setProgressPercentage(Math.min(100, (totalSecs / durVal) * 100));
      }
      currentSegmentRef.current = null;
    }
  }, [activeVideo?.id]);

  // Unified reactive tracking effect
  React.useEffect(() => {
    if (!activeVideo || !isPlaying) return;
    
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
    if (isYoutubeUrl(activeVideo.bunny_embed_url || '')) {
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

    const t = lastPosition;
    const active = currentSegmentRef.current;
    if (!active) {
      currentSegmentRef.current = { start: t, end: t };
    } else {
      const elapsed = t - active.end;
      if (elapsed >= 0 && elapsed <= 2.5) {
        // Continuous playing forward
        active.end = t;
      } else {
        // Seeking/jumping/reversing
        pushAndMergeCurrentSegment();
        currentSegmentRef.current = { start: t, end: t };
      }
    }

    // Update real-time progress for display
    const totalSecs = getWatchedSeconds(watchedSegmentsRef.current, currentSegmentRef.current);
    const durVal = duration || activeVideo.duration_seconds || 300;
    setWatchedTime(totalSecs);
    setSecondsWatched(totalSecs);
    if (durVal > 0) {
      setProgressPercentage(Math.min(100, (totalSecs / durVal) * 100));
    }
  }, [lastPosition, isPlaying, activeVideo?.id]);

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

  // Save progress when paused
  React.useEffect(() => {
    if (!isPlaying && activeVideoRef.current) {
      pushAndMergeCurrentSegment();
      currentSegmentRef.current = null;
      
      const current = lastPositionRef.current;
      const durVal = durationRef.current || activeVideoRef.current.duration_seconds || 300;
      const merged = mergeSegments(watchedSegmentsRef.current);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const percentage = durVal > 0 ? (totalSecs / durVal) * 100 : 0;
      
      saveLessonProgressRef.current({
        lessonId: Number(id),
        last_position_seconds: current,
        watched_seconds: totalSecs,
        progress_percentage: percentage,
        watched_segments: merged
      });
    }
  }, [isPlaying]);

  // 1-second smooth state updates for YouTube videos
  React.useEffect(() => {
    let interval: any = null;

    if (activeVideo && isPlaying && isYoutubeUrl(activeVideo.bunny_embed_url || '')) {
      console.log('[YouTube Player Debug] Starting YT currentTime query interval');
      interval = setInterval(() => {
        const player = ytPlayerRef.current;
        if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
          try {
            const current = Math.floor(player.getCurrentTime());
            const durVal = Math.floor(player.getDuration());
            if (durVal > 0 && current >= 0) {
              setLastPosition(current);
              setDuration(durVal);
            }
          } catch (e) {}
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        console.log('[YouTube Player Debug] Clearing YT currentTime query interval');
        clearInterval(interval);
      }
    };
  }, [activeVideo?.id, isPlaying]);

  // Periodic progress saving to DB (running every 5 seconds while playing)
  React.useEffect(() => {
    let interval: any = null;

    if (activeVideo && isPlaying) {
      console.log('[Video Progress] Starting periodic progress save interval');
      interval = setInterval(() => {
        const current = lastPositionRef.current;
        const durVal = durationRef.current || activeVideoRef.current?.duration_seconds || 300;
        if (durVal > 0 && current >= 0) {
          const active = currentSegmentRef.current;
          const merged = getMergedSegmentsIncludingActive(watchedSegmentsRef.current, active);
          const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
          const percentage = (totalSecs / durVal) * 100;
          
          saveLessonProgressRef.current({
            lessonId: Number(id),
            last_position_seconds: current,
            watched_seconds: totalSecs,
            progress_percentage: percentage,
            watched_segments: merged
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
      console.log('Video Player Source (src):', activeVideo.bunny_embed_url)
      console.log('------------------------------------------------')
    }
  }, [activeVideo])

  const ytPlayerRef = React.useRef<any>(null);

  React.useEffect(() => {
    let ytPlayer: any = null;

    const initPlayer = () => {
      const element = document.getElementById('youtube-player');
      if (!element || !window.YT || !window.YT.Player) {
        console.log('[YouTube Player Debug] Cannot init player yet. Element found:', !!element, 'window.YT:', !!window.YT);
        return;
      }

      console.log('[YouTube Player Debug] Creating window.YT.Player instance for video ID:', activeVideoRef.current?.id);

      try {
        ytPlayer = new window.YT.Player('youtube-player', {
          events: {
            onStateChange: (event: any) => {
              const state = event.data;
              console.log('[YouTube Player Debug] YT Player onStateChange. State:', state);
              if (state === 1) {
                setIsPlaying(true);
              } else if (state === 2 || state === 0) {
                setIsPlaying(false);
                const current = Math.floor(event.target.getCurrentTime());
                const durVal = Math.floor(event.target.getDuration());
                if (durVal > 0) {
                  const percentage = (current / durVal) * 100;
                  setLastPosition(current);
                  setProgressPercentage(percentage);
                  setWatchedTime(current);
                  setDuration(durVal);
                  console.log('[YouTube Player Debug] Saving progress from onStateChange. Position:', current);
                  saveLessonProgressRef.current({
                    lessonId: Number(id),
                    last_position_seconds: current,
                    watched_seconds: current,
                    progress_percentage: percentage
                  });
                }
              }
            },
            onReady: (event: any) => {
              console.log('[YouTube Player Debug] YT Player onReady triggered');
              const pos = activeVideoRef.current?.progress?.last_position_seconds || 0;
              if (pos > 0) {
                console.log('[YouTube Player Debug] Seeking to position:', pos);
                event.target.seekTo(pos, true);
              }
              const durVal = Math.floor(event.target.getDuration() || activeVideoRef.current?.duration_seconds || 300);
              setDuration(durVal);
              if (durVal > 0) {
                setProgressPercentage((pos / durVal) * 100);
              }
            }
          }
        });
        ytPlayerRef.current = ytPlayer;
      } catch (e) {
        console.error('[YouTube Player Debug] Failed to initialize YT Player:', e);
      }
    };

    const loadYoutubeAPI = () => {
      if (!window.YT) {
        console.log('[YouTube Player Debug] Injecting YouTube IFrame API script tag');
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          if (prevCallback) prevCallback();
          console.log('[YouTube Player Debug] onYouTubeIframeAPIReady callback fired');
          initPlayer();
        };
      } else {
        console.log('[YouTube Player Debug] YouTube API already script-injected. Initializing player.');
        setTimeout(initPlayer, 300);
      }
    };

    if (activeVideo && isYoutubeUrl(activeVideo.bunny_embed_url) && activeTab === 'videos') {
      loadYoutubeAPI();
    }

    return () => {
      console.log('[YouTube Player Debug] YT Player useEffect cleanup. Active video ID:', activeVideoRef.current?.id);
      if (ytPlayer && typeof ytPlayer.destroy === 'function') {
        console.log('[YouTube Player Debug] Destroying YT Player instance for video ID:', activeVideoRef.current?.id);
        try {
          ytPlayer.destroy();
        } catch (e) {
          console.error('[YouTube Player Debug] Error destroying player:', e);
        }
      }
      ytPlayerRef.current = null;
    };
  }, [activeVideo?.id, activeTab === 'videos']);

  // Handle active video selection switch
  const selectVideo = async (video: VideoItem) => {
    setIsPlaying(false)
    const prevVideo = activeVideoRef.current
    if (prevVideo) {
      pushAndMergeCurrentSegment();
      const current = lastPositionRef.current;
      const durVal = durationRef.current || prevVideo.duration_seconds || 300;
      const merged = mergeSegments(watchedSegmentsRef.current);
      const totalSecs = merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const percentage = durVal > 0 ? (totalSecs / durVal) * 100 : 0;
      await saveLessonProgressRef.current({
        lessonId: Number(id),
        last_position_seconds: current,
        watched_seconds: totalSecs,
        progress_percentage: percentage,
        watched_segments: merged
      });
    }
    setActiveVideo(video)
    
    // Set stable video embed URL for the new video
    const newEmbedUrl = getEmbedUrl(video)
    setVideoEmbedUrl(newEmbedUrl)
    console.log('[YouTube Player Debug] selectVideo - Set new embed URL:', newEmbedUrl)

    const pos = video.progress?.last_position_seconds || 0
    const watchedSecs = video.progress?.watched_seconds || 0
    const segments = video.progress?.watched_segments || []
    setLastPosition(pos)
    setWatchedTime(watchedSecs)
    setSecondsWatched(watchedSecs)
    setWatchedSegments(segments)
    currentSegmentRef.current = null
    
    const videoDuration = video.duration_seconds || 300
    setDuration(videoDuration)
    setProgressPercentage(videoDuration > 0 ? (watchedSecs / videoDuration) * 100 : 0)
    
    // Seek native video element if it's rendered
    if (videoRef.current) {
      videoRef.current.currentTime = pos
    }
  }

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
        
        const payload = {
          watched_seconds: totalSecs,
          last_position_seconds: current,
          watched_segments: merged,
        };
        
        console.log('Saving progress', payload);

        API.post(`/videos/${video.id}/progress`, payload).catch((err) => console.error('Failed to save progress on exit:', err))
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
                  let url = activeVideo.bunny_embed_url || '';
                  
                  // Auto-regeneration fallback if URL is empty or misconfigured
                  if ((!url || !url.includes('691418') || (activeVideo.bunny_stream_id && !url.includes(activeVideo.bunny_stream_id))) && activeVideo.bunny_stream_id) {
                    url = `https://iframe.mediadelivery.net/embed/691418/${activeVideo.bunny_stream_id}`;
                  }

                  if (!url) {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                        <Play className="h-12 w-12 text-rose-500 mb-3 animate-pulse" />
                        <h4 className="text-sm font-bold text-slate-200 mb-1">رابط الفيديو غير متوفر</h4>
                        <p className="text-xs font-light max-w-xs">يرجى التواصل مع المعلم أو إدارة المنصة لحل هذه المشكلة.</p>
                      </div>
                    );
                  }

                  // If Bunny Stream video is still processing, show processing warning
                  if (url.includes('mediadelivery.net') || url.includes('bunny') || url.includes('b-cdn.net')) {
                    const status = activeVideo.bunny_status;
                    if (status && status !== 'finished' && status !== 'ready') {
                      return (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 p-6 text-center">
                          <div className="relative flex items-center justify-center mb-3">
                            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-brand-primary opacity-25"></span>
                            <Play className="h-10 w-10 text-brand-primary animate-pulse relative" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-200 mb-1 font-bold">الفيديو قيد المعالجة حالياً (Transcoding on Bunny)</h4>
                          <p className="text-[10px] text-slate-400 font-light max-w-xs">يرجى الانتظار بضع دقائق حتى ينتهي السيرفر من معالجة وترميز جودات الفيديو.</p>
                        </div>
                      );
                    }
                  }

                  if (isYoutubeUrl(url)) {
                    const finalSrc = videoEmbedUrl || getEmbedUrl(activeVideo);
                    console.log('[YouTube Player Debug] Rendering YouTube iframe. finalSrc:', finalSrc);
                    return (
                      <iframe
                        id="youtube-player"
                        src={finalSrc}
                        className="w-full h-full"
                        style={{ border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="origin"
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
                    // Fallback to normal embed (mediadelivery.net / bunny CDN, etc.)
                    const finalSrc = videoEmbedUrl || getEmbedUrl(activeVideo);
                    return (
                      <iframe
                        src={finalSrc}
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
                        شاهدت: {formatTime(watchedTime)} من {formatTime(duration || activeVideo.duration_seconds)}
                      </span>
                      <span className="font-black text-brand-primary">
                        {progressPercentage.toFixed(0)}%
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
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
