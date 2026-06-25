import React from 'react'
import API from '../../services/api'
import { Film, UploadCloud, Copy, Check, Trash2, RefreshCw, AlertTriangle, HardDrive, Play, ArrowRight, Loader2, Link2 } from 'lucide-react'
import { useModalStore } from '../../store/modalStore'
import * as tus from 'tus-js-client'

interface VideoItem {
  id: number
  title: string
  lesson_id: number
  bunny_video_id: string
  bunny_embed_url: string
  bunny_thumbnail_url: string
  bunny_duration: number
  bunny_size_bytes: number
  bunny_status: string
  lesson_title: string
  course_title: string
  created_at: string
}

interface StorageStats {
  bunny_storage_used_gb: number
  bunny_storage_limit_gb: number
  bunny_storage_remaining_gb: number
  used_percentage: number
}

interface CourseItem {
  id: number
  title: string
}

interface UnitItem {
  id: number
  title: string
  lessons: { id: number; title: string }[]
}

export default function VideosManager() {
  const [videos, setVideos] = React.useState<VideoItem[]>([])
  const [storage, setStorage] = React.useState<StorageStats | null>(null)
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [units, setUnits] = React.useState<UnitItem[]>([])
  
  const [loading, setLoading] = React.useState(true)
  const [coursesLoading, setCoursesLoading] = React.useState(false)
  const [unitsLoading, setUnitsLoading] = React.useState(false)

  // Upload Form State
  const [title, setTitle] = React.useState('')
  const [selectedCourseId, setSelectedCourseId] = React.useState('')
  const [selectedUnitId, setSelectedUnitId] = React.useState('')
  const [selectedLessonId, setSelectedLessonId] = React.useState('')
  const [videoFile, setVideoFile] = React.useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [uploadStatusText, setUploadStatusText] = React.useState('')
  const [uploading, setUploading] = React.useState(false)

  // Replace Video State
  const [replacingVideo, setReplacingVideo] = React.useState<VideoItem | null>(null)
  const [replaceFile, setReplaceFile] = React.useState<File | null>(null)
  const [replaceProgress, setReplaceProgress] = React.useState<number | null>(null)
  const [replaceStatusText, setReplaceStatusText] = React.useState('')
  const [replacing, setReplacing] = React.useState(false)

  // Copy success indicator
  const [copiedId, setCopiedId] = React.useState<number | null>(null)
  const [isBunnyConfigured, setIsBunnyConfigured] = React.useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [videosRes, storageRes] = await Promise.all([
        API.get('/teacher/videos'),
        API.get('/teacher/storage')
      ])
      setVideos(videosRes.data)
      setStorage(storageRes.data)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل تحميل الفيديوهات وبيانات المساحة.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true)
      const res = await API.get('/teacher/courses')
      setCourses(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setCoursesLoading(false)
    }
  }

  React.useEffect(() => {
    fetchData()
    fetchCourses()
    API.get('/config')
      .then((res) => {
        setIsBunnyConfigured(res.data.bunny_stream_configured)
      })
      .catch((err) => console.error(err))
  }, [])

  // When course selection changes, load units & lessons
  React.useEffect(() => {
    if (!selectedCourseId) {
      setUnits([])
      setSelectedUnitId('')
      setSelectedLessonId('')
      return
    }

    const loadCourseDetails = async () => {
      try {
        setUnitsLoading(true)
        const res = await API.get(`/courses/${selectedCourseId}`)
        setUnits(res.data.units || [])
      } catch (err) {
        console.error(err)
        useModalStore.getState().showToast('فشل تحميل الوحدات والدروس الخاصة بالكورس.', 'error')
      } finally {
        setUnitsLoading(false)
      }
    }
    loadCourseDetails()
  }, [selectedCourseId])

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedLessonId || !videoFile) {
      useModalStore.getState().showToast('يرجى ملء جميع حقول الرفع وتحديد ملف الفيديو.', 'warning')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)
      setUploadStatusText('جاري إنشاء كائن الفيديو على خوادم Bunny Stream...')

      // 1. Get signed upload credentials from our server
      const signedRes = await API.post('/teacher/videos/signed-upload', {
        title: title.trim(),
        lesson_id: selectedLessonId,
      });

      const { video_id, library_id, signature, expiration_time } = signedRes.data;

      setUploadStatusText('جاري بدء الرفع المباشر إلى Bunny Stream...')

      // 2. Upload file binary directly to Bunny Stream using TUS
      const upload = new tus.Upload(videoFile, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: String(expiration_time),
          LibraryId: String(library_id),
          VideoId: video_id,
        },
        metadata: {
          filetype: videoFile.type,
          title: title.trim(),
        },
        onError: (error) => {
          console.error('TUS upload failed:', error);
          setUploading(false);
          setUploadProgress(null);
          setUploadStatusText('');
          useModalStore.getState().showToast('فشل رفع الفيديو إلى Bunny Stream.', 'error');
        },
        onProgress: (bytesSent, bytesTotal) => {
          const percentage = Math.round((bytesSent / bytesTotal) * 100);
          setUploadProgress(percentage);
          setUploadStatusText(`جاري الرفع المباشر: ${percentage}%`);
        },
        onSuccess: () => {
          useModalStore.getState().showToast('تم رفع الفيديو مباشرة إلى Bunny Stream بنجاح وجاري المعالجة.', 'success');
          
          // Reset form
          setTitle('')
          setSelectedCourseId('')
          setSelectedUnitId('')
          setSelectedLessonId('')
          setVideoFile(null)
          const fileInput = document.getElementById('video-upload-input') as HTMLInputElement
          if (fileInput) fileInput.value = ''

          setUploading(false);
          setUploadProgress(null);
          setUploadStatusText('');

          // Reload list and storage
          fetchData();
        }
      });

      upload.start();

    } catch (err: any) {
      console.error(err)
      setUploading(false)
      setUploadProgress(null)
      setUploadStatusText('')
      const errMsg = err.response?.data?.message || err.message || 'حدث خطأ أثناء رفع الفيديو.'
      useModalStore.getState().showToast(errMsg, 'error')
    }
  }

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replacingVideo || !replaceFile) return

    try {
      setReplacing(true)
      setReplaceProgress(0)
      setReplaceStatusText('جاري التحضير واستدعاء خادم المزامنة...')

      // 1. Get signed credentials for replacement
      const signedRes = await API.post(`/teacher/videos/${replacingVideo.id}/replace`);

      const { video_id, library_id, signature, expiration_time } = signedRes.data;

      setReplaceStatusText('جاري بدء الرفع البديل المباشر إلى Bunny Stream...')

      // 2. Upload replacement file directly to Bunny Stream using TUS
      const upload = new tus.Upload(replaceFile, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: String(expiration_time),
          LibraryId: String(library_id),
          VideoId: video_id,
        },
        metadata: {
          filetype: replaceFile.type,
          title: replacingVideo.title,
        },
        onError: (error) => {
          console.error('TUS replace failed:', error);
          setReplacing(false);
          setReplaceProgress(null);
          setReplaceStatusText('');
          useModalStore.getState().showToast('فشل استبدال الفيديو على Bunny Stream.', 'error');
        },
        onProgress: (bytesSent, bytesTotal) => {
          const percentage = Math.round((bytesSent / bytesTotal) * 100);
          setReplaceProgress(percentage);
          setReplaceStatusText(`جاري رفع الفيديو الجديد: ${percentage}%`);
        },
        onSuccess: () => {
          useModalStore.getState().showToast('تم استبدال الفيديو مباشرة على Bunny Stream بنجاح وجاري المعالجة.', 'success');
          
          // Reset replace state
          setReplacingVideo(null)
          setReplaceFile(null)

          setReplacing(false);
          setReplaceProgress(null);
          setReplaceStatusText('');

          // Reload list and storage
          fetchData();
        }
      });

      upload.start();

    } catch (err: any) {
      console.error(err)
      setReplacing(false)
      setReplaceProgress(null)
      setReplaceStatusText('')
      const errMsg = err.response?.data?.message || err.message || 'حدث خطأ أثناء استبدال الفيديو.'
      useModalStore.getState().showToast(errMsg, 'error')
    }
  }

  const handleDeleteVideo = async (id: number) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا الفيديو نهائياً من المنصة ومن خوادم Bunny Stream؟')) {
      return
    }

    try {
      await API.delete(`/teacher/videos/${id}`)
      useModalStore.getState().showToast('تم حذف الفيديو نهائياً وتحديث المساحة التخزينية.', 'success')
      fetchData()
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.message || 'حدث خطأ أثناء حذف الفيديو.'
      useModalStore.getState().showToast(errMsg, 'error')
    }
  }

  const copyEmbedLink = (video: VideoItem) => {
    if (!video.bunny_embed_url) return
    navigator.clipboard.writeText(video.bunny_embed_url)
    setCopiedId(video.id)
    useModalStore.getState().showToast('تم نسخ كود التضمين بنجاح.', 'success')
    setTimeout(() => setCopiedId(null), 3000)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12 rtl" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Film className="text-brand-primary h-8 w-8" />
            <span>إدارة الفيديوهات التفاعلية</span>
          </h1>
          <p className="text-sm text-slate-400 font-light mt-1">
            قم برفع فيديوهاتك واستبدالها ومتابعة مساحتك التخزينية الآمنة عبر Bunny Stream.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl transition-all"
        >
          <RefreshCw className="h-4 w-4" />
          <span>تحديث البيانات</span>
        </button>
      </div>

      {/* Storage Dashboard Card */}
      {storage && (
        <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl shadow-sm hover:border-brand-primary/10 transition-all duration-300">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                <HardDrive className="h-5 w-5" />
              </div>
              <span className="text-md font-bold text-slate-200">حالة سعة التخزين والاشتراك</span>
            </div>
            <span className="text-xs bg-brand-primary/10 text-brand-primary px-3 py-1.5 rounded-full font-semibold">
              سحابية مشفرة Bunny CDN
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Progress bar info */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">سعة التخزين المستخدمة: <strong className="text-slate-200">{storage.bunny_storage_used_gb.toFixed(3)} GB</strong></span>
                <span className="text-slate-400">الحد الأقصى: <strong className="text-slate-200">{storage.bunny_storage_limit_gb} GB</strong></span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full bg-slate-800 h-3.5 rounded-full overflow-hidden flex">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    storage.used_percentage > 90 
                      ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' 
                      : storage.used_percentage > 70 
                        ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                        : 'bg-brand-primary shadow-[0_0_12px_rgba(var(--brand-primary-rgb),0.4)]'
                  }`}
                  style={{ width: `${storage.used_percentage}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">تم استهلاك {storage.used_percentage}% من المساحة</span>
                <span className="text-emerald-500 font-medium">المتبقي: {storage.bunny_storage_remaining_gb.toFixed(3)} GB</span>
              </div>
            </div>

            {/* Warning block if near limit */}
            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 shrink-0 ${storage.used_percentage > 90 ? 'text-rose-500' : 'text-amber-500'}`} />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-300">ملاحظة أمنية هامّة</h4>
                <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                  يتم تشفير وتوزيع الفيديوهات عالمياً لمنع السرقة والتنزيل، ويتم حظر الرفع تلقائياً عند تجاوز الحد المسموح.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Main Grid: Upload Form + Video List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form Card */}
        <div className="lg:col-span-1 bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl h-fit space-y-6 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <UploadCloud className="text-brand-primary h-5 w-5" />
              <span>رفع فيديو جديد مباشر</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 font-light">
              اختر الدرس واكتب العنوان لرفع الفيديو مباشرة إلى خوادم Bunny المشفرة.
            </p>
          </div>

          <form onSubmit={handleUploadSubmit} className="space-y-4">
            {/* Course select */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">الكورس الدراسي</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={uploading || coursesLoading}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="">-- اختر الكورس --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
            </div>

            {/* Unit select */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">الوحدة الدراسية</label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={uploading || unitsLoading || !selectedCourseId}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="">-- اختر الوحدة --</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.title}</option>
                ))}
              </select>
            </div>

            {/* Lesson select */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">الدرس / الحصة</label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                disabled={uploading || !selectedUnitId}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="">-- اختر الدرس --</option>
                {units
                  .find((u) => u.id === parseInt(selectedUnitId))
                  ?.lessons.map((l) => (
                    <option key={l.id} value={l.id}>{l.title}</option>
                  ))}
              </select>
            </div>

            {/* Title field */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">عنوان الفيديو</label>
              <input
                type="text"
                placeholder="مثال: شرح قانون نيوتن الأول"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-brand-primary focus:outline-none transition-all"
              />
            </div>

            {/* File picker */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block">ملف الفيديو (.MP4, .MOV, .WEBM)</label>
              <input
                type="file"
                id="video-upload-input"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                disabled={uploading || !isBunnyConfigured}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2 text-xs text-slate-300 file:bg-slate-800 file:border-none file:text-slate-300 file:px-3 file:py-1 file:rounded-lg file:ml-4 file:hover:bg-slate-700 file:cursor-pointer disabled:opacity-50"
              />
            </div>

            {/* Upload Button & Status */}
            <div className="pt-2">
              {!isBunnyConfigured ? (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 text-right">
                  <span className="text-[11px] font-bold text-amber-500">تكامل Bunny Stream غير مهيأ حالياً على السيرفر. الرفع المباشر معطل.</span>
                </div>
              ) : uploading ? (
                <div className="space-y-2 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-primary" />
                      <span>{uploadStatusText}</span>
                    </span>
                    {uploadProgress !== null && <span>{uploadProgress}%</span>}
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand-primary h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!title.trim() || !selectedLessonId || !videoFile}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/95 disabled:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-brand-primary/10"
                >
                  <UploadCloud className="h-5 w-5" />
                  <span>بدء الرفع الآمن الآن</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Video List Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl shadow-sm">
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Film className="text-brand-primary h-5 w-5" />
              <span>فيديوهاتك المرفوعة ({videos.length})</span>
            </h3>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
                <span className="text-sm text-slate-400">جاري تحميل قائمة الفيديوهات...</span>
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                <Film className="h-12 w-12 text-slate-600" />
                <div className="space-y-1">
                  <h4 className="text-slate-300 font-bold">لا يوجد فيديوهات مرفوعة حالياً</h4>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    قم برفع أول كورس دراسي وفيديو من النموذج الجانبي ليظهر هنا ويشاهده طلابك بأمان.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
                      <th className="pb-3 text-right">الفيديو / الحصة</th>
                      <th className="pb-3 text-right">الكورس / الدرس</th>
                      <th className="pb-3 text-right">الحجم / المدة</th>
                      <th className="pb-3 text-right">الحالة</th>
                      <th className="pb-3 text-left">العمليات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <tr key={video.id} className="border-b border-slate-800/50 hover:bg-slate-900/10 text-sm transition-all">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {/* Thumbnail overlay */}
                            <div className="relative h-12 w-20 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-800 flex items-center justify-center">
                              {video.bunny_thumbnail_url ? (
                                <img src={video.bunny_thumbnail_url} className="h-full w-full object-cover" alt="" />
                              ) : (
                                <Play className="h-5 w-5 text-slate-600" />
                              )}
                              {video.bunny_status === 'finished' && (
                                <span className="absolute bottom-1 right-1 bg-slate-950/80 text-[10px] text-slate-300 px-1 py-0.5 rounded font-mono">
                                  {formatDuration(video.bunny_duration)}
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-slate-200 line-clamp-1">{video.title}</h4>
                              <p className="text-[10px] text-slate-500 font-mono select-all shrink-0 flex items-center gap-1">
                                <Link2 className="h-3 w-3" />
                                <span>{video.bunny_video_id || 'N/A'}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4">
                          <div className="space-y-0.5">
                            <span className="text-xs text-slate-300 font-semibold block">{video.course_title}</span>
                            <span className="text-[10px] text-slate-500 font-light block">{video.lesson_title}</span>
                          </div>
                        </td>

                        <td className="py-4 font-mono text-xs text-slate-400">
                          <div className="space-y-0.5">
                            <span>{formatBytes(video.bunny_size_bytes)}</span>
                            <span className="block text-[10px] text-slate-500">{video.bunny_duration ? `${Math.round(video.bunny_duration / 60)} دقيقة` : 'N/A'}</span>
                          </div>
                        </td>

                        <td className="py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                            video.bunny_status === 'finished' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : video.bunny_status === 'processing' 
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                                : video.bunny_status === 'failed'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {video.bunny_status === 'finished' && 'مكتمل'}
                            {video.bunny_status === 'processing' && 'جاري التجهيز'}
                            {video.bunny_status === 'uploaded' && 'تم الرفع'}
                            {video.bunny_status === 'failed' && 'فشل المعالجة'}
                            {video.bunny_status === 'queued' && 'في الانتظار'}
                          </span>
                        </td>

                        <td className="py-4 text-left">
                          <div className="flex items-center justify-start gap-1">
                            {/* Copy embed link */}
                            <button
                              onClick={() => copyEmbedLink(video)}
                              disabled={!video.bunny_embed_url}
                              title="نسخ كود التضمين"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-all"
                            >
                              {copiedId === video.id ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>

                            {/* Replace */}
                            <button
                              onClick={() => setReplacingVideo(video)}
                              title="استبدال ملف الفيديو"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteVideo(video.id)}
                              title="حذف الفيديو نهائياً"
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal for replacing video */}
      {replacingVideo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl w-full max-w-md space-y-6 shadow-2xl relative">
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                <RefreshCw className="text-brand-primary h-5 w-5 animate-spin-slow" />
                <span>استبدال ملف الفيديو</span>
              </h3>
              <p className="text-xs text-slate-400 font-light">
                الفيديو المستهدف: <strong className="text-slate-200 font-semibold">{replacingVideo.title}</strong>
              </p>
            </div>

            <div className="bg-slate-800/40 p-3.5 rounded-2xl flex items-start gap-2 border border-slate-700/50">
              <AlertTriangle className="text-amber-500 h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-relaxed font-light">
                عند استبدال الفيديو، سيتم حذف الملف القديم من خوادم Bunny Stream نهائياً ورفع الملف الجديد. وسيظل الفيديو مسنداً لنفس المحاضرة/الدرس تلقائياً.
              </p>
            </div>

            <form onSubmit={handleReplaceSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 block">ملف الفيديو الجديد (.MP4, .MOV, .WEBM)</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  disabled={replacing || !isBunnyConfigured}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2 text-xs text-slate-300 file:bg-slate-800 file:border-none file:text-slate-300 file:px-3 file:py-1 file:rounded-lg file:ml-4 disabled:opacity-50"
                />
              </div>

              {!isBunnyConfigured ? (
                <div className="space-y-3">
                  <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 text-right">
                    <span className="text-[11px] font-bold text-amber-500">تكامل Bunny Stream غير مهيأ حالياً على السيرفر.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingVideo(null)
                      setReplaceFile(null)
                    }}
                    className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              ) : replacing ? (
                <div className="space-y-2 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-primary" />
                      <span>{replaceStatusText}</span>
                    </span>
                    {replaceProgress !== null && <span>{replaceProgress}%</span>}
                  </div>
                  {replaceProgress !== null && (
                    <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                      <div className="bg-brand-primary h-full transition-all" style={{ width: `${replaceProgress}%` }}></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!replaceFile}
                    className="flex-1 bg-brand-primary hover:bg-brand-primary/95 disabled:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md"
                  >
                    بدء الاستبدال الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingVideo(null)
                      setReplaceFile(null)
                    }}
                    className="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
