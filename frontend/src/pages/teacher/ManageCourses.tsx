import React from 'react'
import API from '../../services/api'
import { useModalStore } from '../../store/modalStore'
import { useConfigStore } from '../../store/configStore'
import { Plus, Edit3, Trash2, BookOpen, Video, FileText, Package, FolderPlus, Folder, ChevronDown, Check, Loader2 } from 'lucide-react'
import EmptyState from '../../components/EmptyState'
import * as tus from 'tus-js-client'
import { getCourseDisplayPrice } from '../../utils/pricing'

interface CourseItem {
  id: number
  title: string
  description: string
  cover_image: string
  price: string
  grade: string
  subject: string
  students_count: number
  enable_discount?: boolean
  discount_type?: 'percentage' | 'fixed' | null
  discount_value?: number | null
  final_price?: number | null
  availability?: 'online' | 'center' | 'both'
}

interface LessonItem {
  id: number
  title: string
  description: string
  order: number
  price?: string
  videos?: any[]
  pdfs?: any[]
  course_id?: number | null
  package_id?: number | null
  matching_package_id?: number | null
  is_locked?: boolean
}

interface UnitItem {
  id: number
  title: string
  order: number
  lessons: LessonItem[]
}

interface PackageItem {
  id: number
  course_id: number
  title: string
  price: string
  lessons?: any[]
  lessons_count?: number
  enrollments_count?: number
  description?: string
  cover_image?: string
  package_thumbnail?: string
}

const GRADES = [
  { key: 'first_preparatory', val: 'الصف الأول الإعدادي' },
  { key: 'second_preparatory', val: 'الصف الثاني الإعدادي' },
  { key: 'third_preparatory', val: 'الصف الثالث الإعدادي' },
  { key: 'first_secondary', val: 'الصف الأول الثانوي' },
  { key: 'second_secondary', val: 'الصف الثاني الثانوي' },
  { key: 'third_secondary', val: 'الصف الثالث الثانوي' },
]

const SUBJECTS = [
  { key: 'chemistry', val: 'الكيمياء' },
  { key: 'physics', val: 'الفيزياء' },
  { key: 'biology', val: 'الأحياء' },
  { key: 'math', val: 'الرياضيات' },
  { key: 'science', val: 'العلوم' },
  { key: 'arabic', val: 'اللغة العربية' },
  { key: 'english', val: 'اللغة الإنجليزية' },
]

export default function ManageCourses() {
  // Lists
  const [courses, setCourses] = React.useState<CourseItem[]>([])
  const [selectedCourse, setSelectedCourse] = React.useState<CourseItem | null>(null)
  const [units, setUnits] = React.useState<UnitItem[]>([])
  const [packages, setPackages] = React.useState<PackageItem[]>([])
  const [editPackageMode, setEditPackageMode] = React.useState<PackageItem | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)

  // Modals & Panels Toggles
  const [showCourseForm, setShowCourseForm] = React.useState(false)
  const [editCourseMode, setEditCourseMode] = React.useState<CourseItem | null>(null)
  const [showUnitForm, setShowUnitForm] = React.useState(false)
  const [showLessonForm, setShowLessonForm] = React.useState<number | null>(null) // unitId
  const [showVideoForm, setShowVideoForm] = React.useState<number | null>(null) // lessonId
  const [showPdfForm, setShowPdfForm] = React.useState<number | null>(null) // lessonId
  const [showPackageForm, setShowPackageForm] = React.useState(false)

  // Expand states for units accordion
  const [expandedUnits, setExpandedUnits] = React.useState<Record<number, boolean>>({})

  // Form inputs
  const [courseTitle, setCourseTitle] = React.useState('')
  const [courseDesc, setCourseDesc] = React.useState('')
  const [courseCover, setCourseCover] = React.useState('')
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const [coursePrice, setCoursePrice] = React.useState('')
  const [courseEnableDiscount, setCourseEnableDiscount] = React.useState(false)
  const [courseDiscountType, setCourseDiscountType] = React.useState<'percentage' | 'fixed'>('percentage')
  const [courseDiscountValue, setCourseDiscountValue] = React.useState('')
  const [courseGrade, setCourseGrade] = React.useState('')
  const [courseSubject, setCourseSubject] = React.useState('')
  const [courseAvailability, setCourseAvailability] = React.useState<'online' | 'center' | 'both'>('online')

  const [unitTitle, setUnitTitle] = React.useState('')
  const [lessonTitle, setLessonTitle] = React.useState('')
  const [lessonDesc, setLessonDesc] = React.useState('')
  const [lessonPrice, setLessonPrice] = React.useState('')

  const [vidTitle, setVidTitle] = React.useState('')
  const [vidStreamId, setVidStreamId] = React.useState('')
  const [vidEmbedUrl, setVidEmbedUrl] = React.useState('')
  const [vidDuration, setVidDuration] = React.useState('')
  const [vidThumbnail, setVidThumbnail] = React.useState('')
  const [uploadingThumbnailForVideo, setUploadingThumbnailForVideo] = React.useState(false)
  const [uploadingVideo, setUploadingVideo] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [videoFileDetails, setVideoFileDetails] = React.useState<{ name: string; size: string; status: string } | null>(null)
  const [isDevMode, setIsDevMode] = React.useState(false)
  const [isBunnyConfigured, setIsBunnyConfigured] = React.useState(false)

  const [pdfTitle, setPdfTitle] = React.useState('')
  const [pdfPath, setPdfPath] = React.useState('')
  const [uploadingPdf, setUploadingPdf] = React.useState(false)
  const [pdfDetails, setPdfDetails] = React.useState<{ name: string; size: string; status: string } | null>(null)
  const [pdfPageCount, setPdfPageCount] = React.useState<number | null>(null)
  const [pdfPreviewUrl, setPdfPreviewUrl] = React.useState<string>('')
  const [pdfSize, setPdfSize] = React.useState('')

  // Edit / Replace states for resources
  const [editingVideo, setEditingVideo] = React.useState<any | null>(null)
  const [replacingVideo, setReplacingVideo] = React.useState<any | null>(null)
  const [replacingPdf, setReplacingPdf] = React.useState<any | null>(null)

  React.useEffect(() => {
    const url = vidEmbedUrl.trim();
    if (!url) return;

    const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
    const isBunny = url.includes('iframe.mediadelivery.net');
    const isDirectMp4 = url.toLowerCase().endsWith('.mp4') || url.includes('.mp4?');

    if (isYoutube || isBunny) {
      const controller = new AbortController();
      const delayDebounceFn = setTimeout(async () => {
        try {
          const res = await API.post('/teacher/videos/detect-duration', { url }, { signal: controller.signal });
          if (res.data) {
            if (res.data.duration_seconds) {
              setVidDuration(res.data.duration_seconds.toString());
            }
            if (res.data.title && !vidTitle.trim()) {
              setVidTitle(res.data.title);
            }
            if (res.data.thumbnail_path && !vidThumbnail) {
              setVidThumbnail(res.data.thumbnail_path);
            }
          }
        } catch (e: any) {
          if (e.name !== 'CanceledError') {
            console.error('Failed to auto-detect video details:', e);
          }
        }
      }, 800); // 800ms debounce

      return () => {
        clearTimeout(delayDebounceFn);
        controller.abort();
      };
    } else if (isDirectMp4) {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.src = url;
      videoEl.onloadedmetadata = () => {
        const duration = Math.round(videoEl.duration);
        if (duration && duration > 0) {
          setVidDuration(duration.toString());
        }
      };
    }
  }, [vidEmbedUrl]);

  // Package settings
  const [packageTitle, setPackageTitle] = React.useState('')
  const [packagePrice, setPackagePrice] = React.useState('')
  const [packageDesc, setPackageDesc] = React.useState('')
  const [packageCoverImage, setPackageCoverImage] = React.useState('')
  const [packageThumbnail, setPackageThumbnail] = React.useState('')
  const [uploadingThumbnail, setUploadingThumbnail] = React.useState(false)
  const [isDragOver, setIsDragOver] = React.useState(false)
  const [selectedLessons, setSelectedLessons] = React.useState<number[]>([])

  const fetchCourses = () => {
    setLoading(true)
    API.get('/teacher/courses')
      .then((res) => {
        setCourses(res.data)
        if (res.data.length > 0 && !selectedCourse) {
          handleSelectCourse(res.data[0])
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => {
    fetchCourses()
    useConfigStore.getState().fetchConfig()
      .then((data) => {
        setIsDevMode(data.development_mode)
        setIsBunnyConfigured(data.bunny_stream_configured)
      })
      .catch((err) => console.error('Failed to load configuration:', err))
  }, [])

  const handleSelectCourse = (course: CourseItem) => {
    setSelectedCourse(course)
    // Fetch curriculum
    API.get(`/courses/${course.id}`)
      .then((res) => {
        setUnits(res.data.units)
        setPackages(res.data.packages || [])
        // Expand first unit
        if (res.data.units.length > 0) {
          setExpandedUnits({ [res.data.units[0].id]: true })
        }
      })
      .catch((err) => console.error(err))
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setUploadingCover(true)
    try {
      const res = await API.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setCourseCover(res.data.url)
      useModalStore.getState().showToast('تم رفع غلاف الكورس بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل رفع صورة الغلاف. تأكد من الحجم والصيغة.', 'error')
    } finally {
      setUploadingCover(false)
    }
  }

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!pdfTitle.trim()) {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setPdfTitle(baseName);
    }
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    setPdfSize(`${sizeInMB} MB`);

    setUploadingPdf(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await API.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      setPdfPath(res.data.url)
      useModalStore.getState().showToast('تم رفع ملف الـ PDF بنجاح.', 'success')
    } catch (err: any) {
      console.error(err)
      const errMsg = err.message || 'فشل رفع ملف الـ PDF. تأكد من الحجم والصيغة.';
      useModalStore.getState().showToast(errMsg, 'error')
    } finally {
      setUploadingPdf(false)
    }
  }

  // Course handlers
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    const payload = {
      title: courseTitle,
      description: courseDesc,
      cover_image: courseCover || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500',
      price: coursePrice || '0.00',
      grade: courseGrade,
      subject: courseSubject,
      enable_discount: courseEnableDiscount,
      discount_type: courseDiscountType,
      discount_value: courseDiscountValue || '0.00',
      availability: courseAvailability,
    }

    try {
      if (editCourseMode) {
        await API.put(`/teacher/courses/${editCourseMode.id}`, payload)
        useModalStore.getState().showToast('تم تعديل الكورس بنجاح.', 'success')
      } else {
        await API.post('/teacher/courses', payload)
        useModalStore.getState().showToast('تم إنشاء الكورس بنجاح.', 'success')
      }
      setShowCourseForm(false)
      setEditCourseMode(null)
      clearCourseForm()
      fetchCourses()
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('خطأ في البيانات المدخلة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditCourseClick = (course: CourseItem) => {
    setEditCourseMode(course)
    setCourseTitle(course.title)
    setCourseDesc(course.description)
    setCourseCover(course.cover_image)
    setCoursePrice(course.price)
    setCourseGrade(course.grade)
    setCourseSubject(course.subject)
    setCourseAvailability(course.availability || 'online')
    setCourseEnableDiscount(!!course.enable_discount)
    setCourseDiscountType(course.discount_type || 'percentage')
    setCourseDiscountValue(course.discount_value !== null && course.discount_value !== undefined ? course.discount_value.toString() : '')
    setShowCourseForm(true)
  }

  const handleDeleteCourse = (courseId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الكورس',
      description: 'هل أنت متأكد من حذف هذا الكورس وجميع الوحدات والمحاضرات التابعة له نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف الكورس نهائياً',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/courses/${courseId}`)
          setSelectedCourse(null)
          fetchCourses()
          useModalStore.getState().showToast('تم حذف الكورس بنجاح.', 'success')
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الكورس.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const clearCourseForm = () => {
    setCourseTitle('')
    setCourseDesc('')
    setCourseCover('')
    setCoursePrice('')
    setCourseGrade('')
    setCourseSubject('')
    setCourseAvailability('online')
    setCourseEnableDiscount(false)
    setCourseDiscountType('percentage')
    setCourseDiscountValue('')
  }

  // Unit handler
  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse || !unitTitle.trim()) return

    setActionLoading(true)
    try {
      await API.post(`/teacher/courses/${selectedCourse.id}/units`, {
        title: unitTitle,
        order: units.length + 1,
      })
      setUnitTitle('')
      setShowUnitForm(false)
      handleSelectCourse(selectedCourse)
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Lesson handler
  const handleSaveLesson = async (e: React.FormEvent, unitId: number) => {
    e.preventDefault()
    if (!selectedCourse || !lessonTitle.trim()) return

    setActionLoading(true)
    try {
      await API.post(`/teacher/units/${unitId}/lessons`, {
        title: lessonTitle,
        description: lessonDesc,
        price: lessonPrice || '0.00',
        order: 99,
      })
      setLessonTitle('')
      setLessonDesc('')
      setLessonPrice('')
      setShowLessonForm(null)
      handleSelectCourse(selectedCourse)
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Video Handler
  const detectVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.src = URL.createObjectURL(file);
      
      const timeoutId = setTimeout(() => {
        videoEl.src = '';
        reject(new Error('انتهت مهلة قراءة بيانات الفيديو.'));
      }, 10000);
      
      videoEl.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        const duration = Math.round(videoEl.duration);
        URL.revokeObjectURL(videoEl.src);
        if (duration && duration > 0) {
          resolve(duration);
        } else {
          reject(new Error('مدة الفيديو غير صالحة أو تساوي صفر.'));
        }
      };
      
      videoEl.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(videoEl.src);
        reject(new Error('تعذر تحميل ملف الفيديو لقراءة البيانات. يرجى التأكد من أن صيغة الملف مدعومة.'));
      };
    });
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const videoEl = document.createElement('video');
      videoEl.preload = 'auto';
      videoEl.src = URL.createObjectURL(file);
      videoEl.currentTime = 0.5;
      
      videoEl.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const context = canvas.getContext('2d');
          if (context) {
            context.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            URL.revokeObjectURL(videoEl.src);
            resolve(dataUrl);
          } else {
            URL.revokeObjectURL(videoEl.src);
            resolve('');
          }
        } catch (e) {
          console.error('Failed to capture video frame:', e);
          URL.revokeObjectURL(videoEl.src);
          resolve('');
        }
      };
      
      videoEl.onerror = () => {
        URL.revokeObjectURL(videoEl.src);
        resolve('');
      };
    });
  };

  const handleManualVideoThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      useModalStore.getState().showToast('عذراً، يجب اختيار ملف صورة فقط.', 'error');
      return;
    }

    setUploadingThumbnailForVideo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await API.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setVidThumbnail(res.data.url);
      useModalStore.getState().showToast('تم تعديل غلاف الفيديو بنجاح.', 'success');
    } catch (err) {
      console.error(err);
      useModalStore.getState().showToast('فشل رفع صورة الغلاف.', 'error');
    } finally {
      setUploadingThumbnailForVideo(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = ['.mp4', '.m4v', '.mov', '.webm'];
    const hasValidExt = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      useModalStore.getState().showToast('عذراً، يجب اختيار ملف فيديو بصيغة مدعومة (MP4, M4V, MOV, WEBM).', 'error');
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(0);

    // Validate storage quota before starting upload
    try {
      const subRes = await API.get('/teacher/subscription');
      const remainingStorageGb = subRes.data.subscription?.remaining_storage_gb ?? 0;
      const fileSizeGb = file.size / (1024 * 1024 * 1024);
      if (fileSizeGb > remainingStorageGb) {
        useModalStore.getState().showToast('مساحتك التخزينية المتبقية لا تسمح برفع هذا الفيديو. يمكنك طلب مساحة إضافية.', 'error');
        setUploadingVideo(false);
        return;
      }
    } catch (errQuota) {
      console.warn("Could not verify storage quota:", errQuota);
    }

    setVideoFileDetails({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: 'جاري إنشاء كائن الفيديو على Bunny Stream...'
    });

    detectVideoDuration(file).then(duration => {
      setVidDuration(duration.toString());
    }).catch(e => {
      console.warn("Could not read local video duration:", e);
    });

    try {
      // 1. Request signed upload credentials or replace credentials from our server
      let signedRes;
      if (replacingVideo) {
        signedRes = await API.post(`/teacher/videos/${replacingVideo.id}/replace`, {
          file_size: file.size,
        });
      } else {
        signedRes = await API.post('/teacher/videos/signed-upload', {
          title: file.name.replace(/\.[^/.]+$/, ''), // strip extension
          lesson_id: showVideoForm || editingVideo?.lesson_id,
          file_size: file.size,
        });
      }

      const { video_id, library_id, signature, expiration_time, embed_url } = signedRes.data;

      setVideoFileDetails({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: 'جاري بدء الرفع المباشر إلى Bunny Stream...'
      });

      // 2. Initiate direct upload using TUS protocol
      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          AuthorizationSignature: signature,
          AuthorizationExpire: String(expiration_time),
          LibraryId: String(library_id),
          VideoId: video_id,
        },
        metadata: {
          filetype: file.type,
          title: replacingVideo ? replacingVideo.title : file.name,
        },
        onError: (error) => {
          console.error('TUS upload failed:', error);
          setUploadingVideo(false);
          setUploadProgress(null);
          setVideoFileDetails({
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            status: 'فشل الرفع إلى Bunny Stream'
          });
          useModalStore.getState().showToast('فشل رفع الفيديو إلى Bunny Stream.', 'error');
        },
        onProgress: (bytesSent, bytesTotal) => {
          const percentage = Math.round((bytesSent / bytesTotal) * 100);
          setUploadProgress(percentage);
          setVideoFileDetails({
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            status: `جاري الرفع: ${percentage}%`
          });
        },
        onSuccess: () => {
          // Success! Set the embed URL, video stream ID, and metadata
          setVidEmbedUrl(embed_url);
          setVidStreamId(video_id);
          
          // Let's set a default thumbnail path using standard schema
          const defaultThumb = `https://iframe.mediadelivery.net/play/${library_id}/${video_id}/thumbnail.jpg`;
          setVidThumbnail(defaultThumb);

          setVideoFileDetails({
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            status: 'تم الرفع بنجاح! سيتم معالجة الفيديو تلقائياً.'
          });
          setUploadingVideo(false);
          setUploadProgress(null);
          useModalStore.getState().showToast('تم رفع الفيديو مباشرة إلى Bunny Stream بنجاح.', 'success');
        }
      });

      upload.start();

    } catch (err: any) {
      console.error(err);
      setUploadingVideo(false);
      setUploadProgress(null);
      setVideoFileDetails(null);
      const errMsg = err.response?.data?.message || err.message || 'حدث خطأ غير متوقع.';
      useModalStore.getState().showToast(`فشل إعداد الرفع: ${errMsg}`, 'error');
    }
  };

  const handleSaveVideo = async (e: React.FormEvent, lessonId: number) => {
    e.preventDefault()
    if (!selectedCourse || !vidTitle.trim() || !vidEmbedUrl.trim()) {
      useModalStore.getState().showToast('يرجى التأكد من ملء الحقول المطلوبة.', 'warning')
      return
    }

    const url = vidEmbedUrl.trim()
    const detectedProvider = (() => {
      if (!url) return null;
      if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
      if (url.includes('.mp4')) return 'direct';
      if (url.includes('iframe.mediadelivery.net')) return 'bunny';
      return 'unknown';
    })();

    if (detectedProvider === 'bunny' && isBunnyConfigured && !isDevMode && !vidStreamId.trim()) {
      useModalStore.getState().showToast('يرجى إدخال معرف الفيديو الخاص بـ Bunny Stream.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      await API.post(`/teacher/lessons/${lessonId}/video`, {
        title: vidTitle,
        bunny_stream_id: (detectedProvider === 'youtube' || detectedProvider === 'direct') ? '' : vidStreamId,
        bunny_embed_url: vidEmbedUrl,
        duration_seconds: Number(vidDuration) || 300,
        thumbnail_path: vidThumbnail,
      })
      setVidTitle('')
      setVidStreamId('')
      setVidEmbedUrl('')
      setVidDuration('')
      setVidThumbnail('')
      setVideoFileDetails(null)
      setShowVideoForm(null)
      handleSelectCourse(selectedCourse)
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join('\n') 
        : (err.response?.data?.message || err.message || 'الرجاء التحقق من صحة البيانات والمحاولة مرة أخرى.');
      useModalStore.getState().showToast(errMsg, 'warning')
    } finally {
      setActionLoading(false)
    }
  }

  // PDF Handler
  const handleSavePdf = async (e: React.FormEvent, lessonId: number) => {
    e.preventDefault()
    if (!selectedCourse || !pdfTitle.trim() || !pdfPath.trim()) {
      useModalStore.getState().showToast('يرجى إدخال رابط ملف الـ PDF وعنوان للمذكرة.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      await API.post(`/teacher/lessons/${lessonId}/pdf`, {
        title: pdfTitle,
        file_path: pdfPath,
        page_count: pdfPageCount,
        file_size: pdfSize || '',
        preview_path: pdfPreviewUrl,
      })
      setPdfTitle('')
      setPdfPath('')
      setPdfPageCount(null)
      setPdfPreviewUrl('')
      setPdfSize('')
      setPdfDetails(null)
      setShowPdfForm(null)
      handleSelectCourse(selectedCourse)
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join('\n') 
        : (err.response?.data?.message || err.message || 'فشل إضافة المذكرة.');
      useModalStore.getState().showToast(errMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Resource Action Handlers
  const handleEditVideoClick = (video: any) => {
    setEditingVideo(video)
    setVidTitle(video.title)
    setVidDuration(video.duration_seconds?.toString() || '')
    setVidThumbnail(video.thumbnail_path || '')
    setVidEmbedUrl(video.bunny_embed_url || '')
    setVidStreamId(video.bunny_stream_id || '')
  }

  const handleSaveEditVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVideo || !vidTitle.trim() || !vidEmbedUrl.trim()) {
      useModalStore.getState().showToast('يرجى التأكد من ملء الحقول المطلوبة.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      await API.put(`/teacher/videos/${editingVideo.id}`, {
        title: vidTitle,
        bunny_stream_id: vidStreamId,
        bunny_embed_url: vidEmbedUrl,
        duration_seconds: Number(vidDuration) || 300,
        thumbnail_path: vidThumbnail,
      })
      setVidTitle('')
      setVidStreamId('')
      setVidEmbedUrl('')
      setVidDuration('')
      setVidThumbnail('')
      setEditingVideo(null)
      if (selectedCourse) handleSelectCourse(selectedCourse)
      useModalStore.getState().showToast('تم تعديل الفيديو بنجاح.', 'success')
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join('\n') 
        : (err.response?.data?.message || err.message || 'فشل تعديل الفيديو.');
      useModalStore.getState().showToast(errMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReplaceVideoClick = (video: any) => {
    setReplacingVideo(video)
    setVidTitle(video.title)
    setVidDuration('')
    setVidThumbnail('')
    setVidEmbedUrl('')
    setVidStreamId('')
    setVideoFileDetails(null)
  }

  const handleSaveReplaceVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replacingVideo || !vidEmbedUrl.trim()) {
      useModalStore.getState().showToast('يرجى اختيار فيديو جديد أو إدخال رابط.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      await API.put(`/teacher/videos/${replacingVideo.id}`, {
        title: vidTitle || replacingVideo.title,
        bunny_stream_id: vidStreamId,
        bunny_embed_url: vidEmbedUrl,
        duration_seconds: Number(vidDuration) || replacingVideo.duration_seconds || 300,
        thumbnail_path: vidThumbnail || replacingVideo.thumbnail_path,
      })
      setVidTitle('')
      setVidStreamId('')
      setVidEmbedUrl('')
      setVidDuration('')
      setVidThumbnail('')
      setVideoFileDetails(null)
      setReplacingVideo(null)
      if (selectedCourse) handleSelectCourse(selectedCourse)
      useModalStore.getState().showToast('تم استبدال الفيديو بنجاح.', 'success')
    } catch (err: any) {
      console.error(err)
      const errMsg = err.response?.data?.errors 
        ? Object.values(err.response.data.errors).flat().join('\n') 
        : (err.response?.data?.message || err.message || 'فشل استبدال الفيديو.');
      useModalStore.getState().showToast(errMsg, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteVideo = (videoId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الفيديو المرفق',
      description: 'هل أنت متأكد من حذف هذا الفيديو نهائياً من المحاضرة؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف الفيديو',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/videos/${videoId}`)
          if (selectedCourse) handleSelectCourse(selectedCourse)
          useModalStore.getState().showToast('تم حذف الفيديو بنجاح.', 'success')
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الفيديو.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleReplacePdfClick = (pdf: any) => {
    setReplacingPdf(pdf)
    setPdfTitle(pdf.title)
    setPdfPath(pdf.file_path || '')
    setPdfPreviewUrl(pdf.preview_path || '')
    setPdfPageCount(pdf.page_count || null)
    setPdfSize(pdf.file_size || '')
    setPdfDetails(null)
  }

  const handleSaveReplacePdf = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replacingPdf || !pdfPath.trim()) {
      useModalStore.getState().showToast('يرجى إدخال رابط ملف الـ PDF الجديد.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      await API.put(`/teacher/pdfs/${replacingPdf.id}`, {
        title: pdfTitle || replacingPdf.title,
        file_path: pdfPath,
        page_count: pdfPageCount || replacingPdf.page_count,
        file_size: pdfSize || replacingPdf.file_size || '',
        preview_path: pdfPreviewUrl || replacingPdf.preview_path || '',
      })
      setPdfTitle('')
      setPdfPath('')
      setPdfPageCount(null)
      setPdfPreviewUrl('')
      setPdfSize('')
      setPdfDetails(null)
      setReplacingPdf(null)
      if (selectedCourse) handleSelectCourse(selectedCourse)
      useModalStore.getState().showToast('تم استبدال ملف الـ PDF بنجاح.', 'success')
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast('فشل استبدال ملف الـ PDF.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePdf = (pdfId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف ملف الـ PDF',
      description: 'هل أنت متأكد من حذف هذه المذكرة / ملف الـ PDF نهائياً من المحاضرة؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف الملف',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/pdfs/${pdfId}`)
          if (selectedCourse) handleSelectCourse(selectedCourse)
          useModalStore.getState().showToast('تم حذف ملف الـ PDF بنجاح.', 'success')
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف ملف الـ PDF.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  // Package builder
  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCourse || !packageTitle.trim() || selectedLessons.length === 0) {
      useModalStore.getState().showToast('يجب تحديد عنوان للباقة واختيار محاضرة واحدة على الأقل.', 'warning')
      return
    }

    setActionLoading(true)
    try {
      if (editPackageMode) {
        await API.put(`/teacher/packages/${editPackageMode.id}`, {
          title: packageTitle,
          price: packagePrice || '0.00',
          description: packageDesc,
          cover_image: packageCoverImage,
          package_thumbnail: packageThumbnail,
          lesson_ids: selectedLessons,
        })
        useModalStore.getState().showToast('تم تعديل الباقة المجمعة بنجاح.', 'success')
      } else {
        await API.post(`/teacher/courses/${selectedCourse.id}/packages`, {
          title: packageTitle,
          price: packagePrice || '0.00',
          description: packageDesc,
          cover_image: packageCoverImage,
          package_thumbnail: packageThumbnail,
          lesson_ids: selectedLessons,
        })
        useModalStore.getState().showToast('تم إنشاء الباقة الشهرية وربط المحاضرات بنجاح.', 'success')
      }
      setPackageTitle('')
      setPackagePrice('')
      setPackageDesc('')
      setPackageCoverImage('')
      setPackageThumbnail('')
      setSelectedLessons([])
      setShowPackageForm(false)
      setEditPackageMode(null)
      handleSelectCourse(selectedCourse)
    } catch (err) {
      console.error(err)
      useModalStore.getState().showToast(editPackageMode ? 'فشل تعديل الباقة.' : 'فشل إنشاء الباقة.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePackage = (packageId: number) => {
    useModalStore.getState().showConfirm({
      title: 'حذف الباقة المجمعة',
      description: 'هل أنت متأكد من حذف هذه الباقة؟ لن يؤثر حذف الباقة على اشتراكات الطلاب الحالية ولكن لن يتمكن طلاب جدد من الاشتراك بها.',
      confirmText: 'حذف الباقة',
      cancelText: 'إلغاء',
      type: 'delete',
      onConfirm: async () => {
        setLoading(true)
        try {
          await API.delete(`/teacher/packages/${packageId}`)
          if (selectedCourse) {
            handleSelectCourse(selectedCourse)
          }
          useModalStore.getState().showToast('تم حذف الباقة بنجاح.', 'success')
        } catch (err) {
          console.error(err)
          useModalStore.getState().showToast('فشل حذف الباقة.', 'error')
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const toggleLessonInPackage = (lessonId: number) => {
    setSelectedLessons((prev) => {
      if (prev.includes(lessonId)) {
        return prev.filter((id) => id !== lessonId)
      } else {
        return [...prev, lessonId]
      }
    })
  }

  const toggleUnitAccordion = (unitId: number) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      {/* Title & action */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black">إدارة المواد التعليمية والدروس</h1>
          <p className="text-sm text-slate-400 font-light mt-1">أنشئ كورسات، أضف مذكرات ومقاطع فيديو، وقم ببناء باقات الاشتراك الشهرية</p>
        </div>
        <button
          onClick={() => {
            clearCourseForm()
            setEditCourseMode(null)
            setShowCourseForm(true)
          }}
          className="px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-brand-primary/20 glow-btn w-fit"
        >
          <Plus className="h-4.5 w-4.5" /> <span>إنشاء كورس جديد</span>
        </button>
      </div>

      {/* Main layout grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Courses List */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-brand-card border border-[var(--border-color)] p-6 rounded-3xl space-y-4 shadow-sm">
            <h3 className="font-bold text-base border-b border-[var(--border-color)] pb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand-primary" />
              <span>قائمة كورساتي الدراسية:</span>
            </h3>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-light text-xs">
                لا توجد كورسات مضافة بعد. اضغط على زر الإنشاء بالأعلى.
              </div>
            ) : (
              <div className="space-y-3">
                {courses.map((course) => {
                  const isSelected = selectedCourse?.id === course.id
                  return (
                    <div
                      key={course.id}
                      onClick={() => handleSelectCourse(course)}
                      className={`p-4 border rounded-2xl cursor-pointer transition-all flex justify-between items-start ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold'
                          : 'border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] text-slate-300 hover:border-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">{course.title}</div>
                        <div className="text-[10px] text-slate-450 font-light flex gap-2 items-center flex-wrap">
                          {(() => {
                            const pricing = getCourseDisplayPrice(course)
                            return pricing.hasDiscount ? (
                              <span className="flex items-center gap-1">
                                <span className="line-through text-slate-500">{pricing.formattedOriginalPrice}</span>
                                <span className="text-emerald-400 font-bold">{pricing.formattedFinalPrice}</span>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-semibold px-1.5 py-0.5 rounded">
                                  {pricing.discountText}
                                </span>
                              </span>
                            ) : (
                              <span>{pricing.formattedOriginalPrice}</span>
                            )
                          })()}
                          <span>•</span>
                          <span>{course.students_count} طالب</span>
                        </div>
                      </div>

                      {/* Course actions */}
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditCourseClick(course)
                          }}
                          className="p-1.5 hover:bg-slate-700/30 rounded text-slate-400 hover:text-slate-200"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCourse(course.id)
                          }}
                          className="p-1.5 hover:bg-rose-500/10 rounded text-rose-500/80 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: selected course Curriculum details builder */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCourse ? (
            <div className="bg-brand-card border border-[var(--border-color)] p-8 rounded-3xl space-y-6 shadow-sm">
              
              {/* Course Title header */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-4">
                <div>
                  <span className="text-[10px] text-slate-400">الكورس المختار:</span>
                  <h3 className="text-xl font-black">{selectedCourse.title}</h3>
                </div>
              </div>

              {/* Units builder list */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm">الوحدات والدروس المضافة:</h4>
                  <button
                    onClick={() => setShowUnitForm(true)}
                    className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="h-4 w-4" /> <span>إضافة وحدة دراسية</span>
                  </button>
                </div>

                {units.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-[var(--border-color)] rounded-2xl text-slate-500 text-sm font-light">
                    لا يوجد أي وحدات بعد. اضغط على زر الإضافة لإدراج أول وحدة دراسية.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {units.map((unit) => {
                      const isExpanded = !!expandedUnits[unit.id]
                      return (
                        <div key={unit.id} className="border border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] rounded-2xl overflow-hidden transition-all duration-300">
                          
                          {/* Unit Title Header */}
                          <div className="flex justify-between items-center p-4 bg-[rgba(255,255,255,0.01)] border-b border-[var(--border-color)]">
                            <button
                              onClick={() => toggleUnitAccordion(unit.id)}
                              className="flex items-center gap-2 font-bold text-xs sm:text-sm text-right cursor-pointer text-slate-200 hover:text-white"
                            >
                              <Folder className="h-4 w-4 text-brand-primary" />
                              <span>{unit.title}</span>
                              <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            <button
                              onClick={() => setShowLessonForm(unit.id)}
                              className="text-[10px] font-bold text-brand-primary hover:underline flex items-center gap-0.5"
                            >
                              <Plus className="h-3 w-3" /> إضافة درس
                            </button>
                          </div>

                          {/* Lessons inside unit */}
                          {isExpanded && (
                            <div className="p-4 space-y-4 divide-y divide-[var(--border-color)]">
                              {unit.lessons.length === 0 ? (
                                <div className="text-center py-4 text-[10px] text-slate-500 font-light">لا توجد محاضرات في هذه الوحدة حالياً.</div>
                              ) : (
                                unit.lessons.map((lesson, idx) => (
                                  <div key={lesson.id} className={`pt-4 first:pt-0 space-y-3`}>
                                    <div className="flex justify-between items-start gap-4">
                                      <h5 className="font-semibold text-xs sm:text-sm text-slate-300 flex items-center flex-wrap gap-2">
                                        <span>المحاضرة {idx + 1}: {lesson.title}</span>
                                        {lesson.price !== undefined && (
                                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                                            {lesson.price} ج.م
                                          </span>
                                        )}
                                      </h5>
                                      
                                      {/* Quick file attach links */}
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setShowVideoForm(lesson.id)}
                                          className="p-1 px-2 bg-emerald-500/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/10 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <Video className="h-3 w-3" /> ربط فيديو
                                        </button>
                                        <button
                                          onClick={() => setShowPdfForm(lesson.id)}
                                          className="p-1 px-2 bg-emerald-500/10 hover:bg-brand-primary text-brand-primary hover:text-white border border-brand-primary/10 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer"
                                        >
                                          <FileText className="h-3 w-3" /> ربط مذكرات
                                        </button>
                                      </div>
                                    </div>

                                    {lesson.description && (
                                      <p className="text-[10px] sm:text-xs text-slate-400 font-light leading-relaxed max-w-xl">
                                        {lesson.description}
                                      </p>
                                    )}

                                    {/* Linked Resources Section */}
                                    <div className="mt-3 space-y-3 border-t border-[var(--border-color)]/30 pt-3">
                                      
                                      {/* Videos List */}
                                      {lesson.videos && lesson.videos.length > 0 && (
                                        <div className="space-y-2">
                                          <h6 className="text-[10px] font-bold text-slate-400">الفيديوهات المرتبطة:</h6>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {lesson.videos.map((video) => (
                                              <div key={video.id} className="flex gap-3 p-3 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-xl relative group">
                                                {/* Thumbnail */}
                                                <div className="w-20 aspect-video shrink-0 bg-slate-900 border border-[var(--border-color)] rounded-lg overflow-hidden flex items-center justify-center relative">
                                                  {video.thumbnail_path ? (
                                                    <img src={video.thumbnail_path} alt={video.title} className="w-full h-full object-cover" />
                                                  ) : (
                                                    <Video className="h-6 w-6 text-brand-primary" />
                                                  )}
                                                </div>
                                                
                                                {/* Metadata */}
                                                <div className="flex-grow flex flex-col justify-between text-right min-w-0">
                                                  <div className="space-y-0.5">
                                                    <h4 className="font-bold text-[11px] text-slate-200 truncate">{video.title}</h4>
                                                    <div className="text-[9px] text-slate-400 font-light space-y-0.5">
                                                      <div>المدة: {Math.floor(video.duration_seconds / 60)}:{(video.duration_seconds % 60).toString().padStart(2, '0')} دقيقة</div>
                                                      <div>تاريخ الرفع: {new Date(video.created_at).toLocaleDateString('ar-EG')}</div>
                                                      <div className="flex items-center gap-1 mt-0.5">
                                                        <span className="text-slate-500">الحالة:</span>
                                                        {video.bunny_embed_url?.includes('youtube.com') || video.bunny_embed_url?.includes('youtu.be') ? (
                                                          <span className="px-1 bg-red-500/10 text-red-500 rounded text-[8px] font-bold">YouTube</span>
                                                        ) : video.bunny_embed_url?.includes('mediadelivery.net') || video.bunny_embed_url?.includes('bunny') ? (
                                                          <span className="flex items-center gap-1">
                                                            <span className="px-1 bg-purple-500/10 text-purple-500 rounded text-[8px] font-bold">Bunny Stream</span>
                                                            {video.bunny_status === 'finished' ? (
                                                              <span className="px-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[8px] font-bold">Ready</span>
                                                            ) : video.bunny_status === 'processing' ? (
                                                              <span className="px-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[8px] font-bold">Processing on Bunny</span>
                                                            ) : video.bunny_status === 'failed' ? (
                                                              <span className="px-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[8px] font-bold">Failed</span>
                                                            ) : video.bunny_status === 'uploaded' ? (
                                                              <span className="px-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded text-[8px] font-bold">Uploaded</span>
                                                            ) : (
                                                              <span className="px-1 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded text-[8px] font-bold">Queued</span>
                                                            )}
                                                          </span>
                                                        ) : (
                                                          <span className="px-1 bg-blue-500/10 text-blue-500 rounded text-[8px] font-bold">مباشر (MP4)</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Actions */}
                                                  <div className="flex gap-2 mt-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleEditVideoClick(video)}
                                                      className="text-[9px] font-bold text-brand-primary hover:underline cursor-pointer"
                                                    >
                                                      تعديل
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleReplaceVideoClick(video)}
                                                      className="text-[9px] font-bold text-amber-500 hover:underline cursor-pointer"
                                                    >
                                                      استبدال
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteVideo(video.id)}
                                                      className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                                                    >
                                                      حذف
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* PDFs List */}
                                      {lesson.pdfs && lesson.pdfs.length > 0 && (
                                        <div className="space-y-2 mt-3">
                                          <h6 className="text-[10px] font-bold text-slate-400">الملفات والمذكرات المرتبطة:</h6>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {lesson.pdfs.map((pdf) => (
                                              <div key={pdf.id} className="flex gap-3 p-3 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] rounded-xl relative group">
                                                {/* Preview Image */}
                                                <div className="w-12 h-16 shrink-0 bg-slate-900 border border-[var(--border-color)] rounded-lg overflow-hidden flex items-center justify-center relative">
                                                  {pdf.preview_path ? (
                                                    <img src={pdf.preview_path} alt={pdf.title} className="w-full h-full object-cover" />
                                                  ) : (
                                                    <FileText className="h-6 w-6 text-brand-primary" />
                                                  )}
                                                </div>
                                                
                                                {/* Metadata */}
                                                <div className="flex-grow flex flex-col justify-between text-right min-w-0">
                                                  <div className="space-y-0.5">
                                                    <h4 className="font-bold text-[11px] text-slate-200 truncate">{pdf.title}</h4>
                                                    <div className="text-[9px] text-slate-400 font-light space-y-0.5">
                                                      {pdf.file_size && <div>الحجم: {pdf.file_size}</div>}
                                                      {pdf.page_count && <div>الصفحات: {pdf.page_count}</div>}
                                                    </div>
                                                  </div>
                                                  
                                                  {/* Actions */}
                                                  <div className="flex gap-2 mt-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleReplacePdfClick(pdf)}
                                                      className="text-[9px] font-bold text-amber-500 hover:underline cursor-pointer"
                                                    >
                                                      استبدال
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeletePdf(pdf.id)}
                                                      className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                                                    >
                                                      حذف
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                    </div>

                                  </div>
                                ))
                              )}
                            </div>
                          )}

                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Packages List */}
              <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm">الباقات المجمعة النشطة (الاشتراك الشهري):</h4>
                  <button
                    onClick={() => {
                      setEditPackageMode(null)
                      setPackageTitle('')
                      setPackagePrice('')
                      setPackageDesc('')
                      setPackageCoverImage('')
                      setPackageThumbnail('')
                      setSelectedLessons([])
                      setShowPackageForm(true)
                    }}
                    className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> <span>بناء باقة مجمعة</span>
                  </button>
                </div>

                {packages.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[var(--border-color)] rounded-2xl text-slate-500 text-sm font-light">
                    لا توجد باقات مجمعة لهذا الكورس بعد. اضغط على زر "بناء باقة مجمعة" لإنشاء باقة.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className="border border-[var(--border-color)] bg-[rgba(255,255,255,0.01)] p-5 rounded-2xl space-y-4 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-sm text-slate-200">{pkg.title}</h5>
                            <span className="text-xs font-bold text-brand-success bg-brand-success/10 px-2 py-1 rounded-lg">
                              {pkg.price} ج.م
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-light">
                            <div>عدد الكورسات: 1</div>
                            <div>عدد المحاضرات: {pkg.lessons?.length || pkg.lessons_count || 0}</div>
                            <div className="col-span-2">عدد المشتركين: {pkg.enrollments_count || 0} طالباً</div>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
                          <button
                            onClick={() => {
                              setEditPackageMode(pkg)
                              setPackageTitle(pkg.title)
                              setPackagePrice(pkg.price)
                              setPackageDesc(pkg.description || '')
                              setPackageCoverImage(pkg.cover_image || '')
                              setPackageThumbnail(pkg.package_thumbnail || '')
                              setSelectedLessons(pkg.lessons ? pkg.lessons.map((l: any) => l.id) : [])
                              setShowPackageForm(true)
                            }}
                            className="flex-1 py-1.5 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" /> <span>تعديل</span>
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="flex-1 py-1.5 bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> <span>حذف</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-brand-card border border-[var(--border-color)] p-12 text-center rounded-3xl text-slate-400">
              يرجى اختيار كورس دراسي من القائمة الجانبية لعرض المنهج وتعديله.
            </div>
          )}
        </div>

      </div>

      {/* 3. MODAL FORMS POPUPS */}

      {/* Course Form Modal */}
      {showCourseForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => { setShowCourseForm(false); setEditCourseMode(null); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3">
              {editCourseMode ? 'تعديل بيانات الكورس' : 'إنشاء كورس دراسي جديد'}
            </h3>
            
            <form onSubmit={handleSaveCourse} className="space-y-4 text-right">
              
              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">عنوان الكورس</label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="مثال: مراجعة الباب الثاني كيمياء..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Desc */}
              <div className="space-y-1">
                <label className="text-xs font-semibold">وصف الكورس</label>
                <textarea
                  rows={3}
                  value={courseDesc || ''}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  placeholder="اكتب وصفاً تفصيلياً عما سيتعلمه الطالب في هذا الكورس..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl p-4 text-xs focus:outline-none focus:border-brand-primary"
                />
              </div>

              {/* Cover Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block">صورة غلاف الكورس (Thumbnail Image)</label>
                <div className="flex items-center gap-4 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] p-4 rounded-2xl">
                  <div className="relative aspect-video w-32 shrink-0 rounded-xl border border-[var(--border-color)] overflow-hidden bg-slate-800 flex items-center justify-center">
                    {courseCover ? (
                      <img
                        src={courseCover}
                        alt="Cover Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-light">لا توجد صورة</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="text-xs text-slate-400 file:ml-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                    />
                    <div className="text-[9px] text-slate-500 font-light">يقبل صيغ JPEG, PNG, WEBP بحد أقصى 2 ميجابايت</div>
                  </div>
                  {uploadingCover && <div className="text-xs text-brand-primary animate-pulse font-bold">جاري الرفع...</div>}
                </div>
              </div>

              {/* Grid pricing/grade/subject */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Price */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">سعر الاشتراك (ج.م)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={coursePrice}
                    onChange={(e) => setCoursePrice(e.target.value)}
                    placeholder="مثال: 50.00"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
                  />
                </div>

                {/* Availability */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">نظام إتاحة الكورس</label>
                  <select
                    required
                    value={courseAvailability}
                    onChange={(e: any) => setCourseAvailability(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
                  >
                    <option value="online">أونلاين فقط</option>
                    <option value="center">سنتر فقط</option>
                    <option value="both">أونلاين + سنتر</option>
                  </select>
                </div>

                {/* Enable Discount Toggle */}
                <div className="space-y-2 col-span-2 bg-[rgba(255,255,255,0.01)] border border-[var(--border-color)] p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-color)]">تفعيل خصم على هذا الكورس</span>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={courseEnableDiscount}
                        onChange={(e) => setCourseEnableDiscount(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                    </label>
                  </div>

                  {courseEnableDiscount && (
                    <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-[var(--border-color)]/30 animate-in slide-in-from-top duration-200">
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-secondary)] font-bold block">نوع الخصم</label>
                        <select
                          value={courseDiscountType}
                          onChange={(e) => setCourseDiscountType(e.target.value as any)}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none font-bold"
                        >
                          <option value="percentage">نسبة مئوية (%)</option>
                          <option value="fixed">مبلغ ثابت (ج.م)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-[var(--text-secondary)] font-bold block">قيمة الخصم</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={courseDiscountValue}
                          onChange={(e) => setCourseDiscountValue(e.target.value)}
                          placeholder={courseDiscountType === 'percentage' ? '20' : '50'}
                          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] rounded-lg px-3 py-2 text-xs focus:outline-none font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Grade */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold">الصف الدراسي</label>
                  <select
                    required
                    value={courseGrade}
                    onChange={(e) => setCourseGrade(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
                  >
                    <option value="">اختر الصف الدراسي...</option>
                    {GRADES.map((g) => (
                      <option key={g.key} value={g.key}>{g.val}</option>
                    ))}
                  </select>
                </div>

                {/* Subject */}
                <div className="space-y-1 col-span-2">
                  <label className="text-xs font-semibold">المادة العلمية</label>
                  <select
                    required
                    value={courseSubject}
                    onChange={(e) => setCourseSubject(e.target.value)}
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-primary"
                  >
                    <option value="">اختر المادة...</option>
                    {SUBJECTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.val}</option>
                    ))}
                  </select>
                </div>

              </div>

              {/* Form buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => {
                    setShowCourseForm(false)
                    setEditCourseMode(null)
                  }}
                  className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs font-semibold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold"
                >
                  {actionLoading ? 'جاري الحفظ...' : 'حفظ الكورس'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Unit Form Modal */}
      {showUnitForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setShowUnitForm(false)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">إضافة وحدة دراسية جديدة</h3>
            
            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان الوحدة</label>
                <input
                  type="text"
                  required
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="مثال: الباب الأول: الكهربية التيارية..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setShowUnitForm(false)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Form Modal */}
      {showLessonForm !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setShowLessonForm(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">إضافة محاضرة/درس جديد للوحدة</h3>
            
            <form onSubmit={(e) => handleSaveLesson(e, showLessonForm)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان الدرس</label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="مثال: قانون أوم للدوائر المغلقة..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">وصف الدرس (اختياري)</label>
                <input
                  type="text"
                  value={lessonDesc}
                  onChange={(e) => setLessonDesc(e.target.value)}
                  placeholder="شرح مبسط لمحتوى المحاضرة..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              {/* <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">سعر الدرس الفردي (للمعلومات فقط - ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  value={lessonPrice}
                  onChange={(e) => setLessonPrice(e.target.value)}
                  placeholder="مثال: 50.00"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-right"
                />
              </div> */}

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setShowLessonForm(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Form Modal */}
      {showVideoForm !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setShowVideoForm(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black flex items-center justify-between">
              <span>ربط فيديو شرح</span>
              {isDevMode && (
                <span className="px-2 py-0.5 text-[9px] bg-amber-500/20 text-amber-500 rounded-full font-bold">وضع التطوير</span>
              )}
            </h3>
            
            <form onSubmit={(e) => handleSaveVideo(e, showVideoForm)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان مقطع الفيديو</label>
                <input
                  type="text"
                  required
                  value={vidTitle}
                  onChange={(e) => setVidTitle(e.target.value)}
                  placeholder="مثال: شرح قانون أوم..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              {isBunnyConfigured ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">رفع مباشر إلى Bunny Stream</label>
                  <div className="border-2 border-dashed border-[var(--border-color)] bg-brand-surface/10 rounded-2xl p-4 text-center">
                    {uploadingVideo ? (
                      <div className="space-y-2 text-right">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                          <span className="animate-pulse">{videoFileDetails?.status || 'جاري الرفع المباشر...'}</span>
                          {uploadProgress !== null && <span>{uploadProgress}%</span>}
                        </div>
                        {uploadProgress !== null && (
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        )}
                      </div>
                    ) : vidEmbedUrl && videoFileDetails ? (
                      <div className="space-y-2 text-xs text-right">
                        <div className="font-bold text-slate-200 truncate">{videoFileDetails.name}</div>
                        <div className="text-[10px] text-slate-400 flex justify-between px-2">
                          <span>الحجم: {videoFileDetails.size}</span>
                          <span className="text-emerald-500 font-bold">{videoFileDetails.status}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { setVidEmbedUrl(''); setVidDuration(''); setVideoFileDetails(null); }}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black cursor-pointer transition-all"
                        >
                          إزالة وتغيير الفيديو
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 block font-medium">اسحب ملف الفيديو هنا أو اضغط للاختيار (الحد الأقصى 250 ميجابايت)</span>
                        <label className="inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow shadow-brand-primary/10">
                          <span>اختر ملف فيديو</span>
                          <input 
                            type="file" 
                            accept="video/mp4,video/m4v,video/quicktime,video/webm" 
                            className="hidden" 
                            onChange={handleVideoUpload}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-3 text-right">
                  <div className="text-[11px] font-bold text-amber-500">
                    تكامل Bunny Stream غير مهيأ حالياً على السيرفر. الرفع المباشر معطل.
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 font-bold">أو أدخل رابط الفيديو يدوياً</label>
                <input
                  type="text"
                  required
                  value={vidEmbedUrl}
                  onChange={(e) => setVidEmbedUrl(e.target.value)}
                  placeholder="رابط YouTube، ملف MP4 مباشر، أو كود تضمين Bunny..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
                {(() => {
                  const url = vidEmbedUrl.trim();
                  if (!url) return null;
                  const detected = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' :
                                   url.includes('.mp4') ? 'direct' :
                                   url.includes('iframe.mediadelivery.net') ? 'bunny' : 'unknown';
                  return (
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] select-none">
                      <span className="text-slate-400">مزود الفيديو:</span>
                      {detected === 'youtube' && (
                        <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-md font-bold">YouTube</span>
                      )}
                      {detected === 'direct' && (
                        <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-md font-bold">فيديو مباشر (MP4)</span>
                      )}
                      {detected === 'bunny' && (
                        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded-md font-bold">Bunny Stream</span>
                      )}
                      {detected === 'unknown' && (
                        <span className="px-1.5 py-0.5 bg-slate-500/20 text-slate-400 rounded-md font-bold">إطار تضمين عام (Iframe)</span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const url = vidEmbedUrl.trim();
                const detected = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' :
                                 url.includes('.mp4') ? 'direct' :
                                 url.includes('iframe.mediadelivery.net') ? 'bunny' : 'unknown';
                
                if (detected === 'youtube' || detected === 'direct') return null;

                return (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">
                      معرف الفيديو على Bunny (Video ID) {isBunnyConfigured && !isDevMode ? '' : '(اختياري)'}
                    </label>
                    <input
                      type="text"
                      required={isBunnyConfigured && !isDevMode}
                      value={vidStreamId}
                      onChange={(e) => setVidStreamId(e.target.value)}
                      placeholder="d74ff7e1-88f1-4db5-9e67-ea26c3619be9"
                      className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                );
              })()}


              {/* Thumbnail Display & Manual replacement */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">غلاف الفيديو (تم توليده تلقائياً أو تعديله يدوياً)</label>
                <div className="border border-[var(--border-color)] bg-brand-surface/30 rounded-2xl p-4 flex flex-col items-center gap-3">
                  {vidThumbnail ? (
                    <img src={vidThumbnail} alt="Video cover" className="w-full aspect-video object-cover rounded-xl border border-[var(--border-color)]" />
                  ) : (
                    <div className="w-full aspect-video bg-brand-surface rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-slate-500 text-[10px] font-bold">لا يوجد غلاف بعد (سيتم توليده تلقائياً عند اختيار فيديو)</div>
                  )}
                  
                  <label className="inline-block px-3 py-1.5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                    <span>{vidThumbnail ? 'استبدال الغلاف يدوياً' : 'رفع غلاف يدوياً'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleManualVideoThumbnailUpload}
                    />
                  </label>
                  {uploadingThumbnailForVideo && (
                    <div className="text-[10px] text-brand-primary animate-pulse font-bold">جاري رفع الغلاف الجديد...</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setShowVideoForm(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">ربط الفيديو</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Form Modal */}
      {showPdfForm !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setShowPdfForm(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">ربط مذكرة / ملف PDF للدرس</h3>
            
            <form onSubmit={(e) => handleSavePdf(e, showPdfForm)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان المذكرة</label>
                <input
                  type="text"
                  required
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="مثال: ملخص قوانين كيرشوف للدوائر الكهربية..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">رفع ملف PDF محلي</label>
                <div className="border border-[var(--border-color)] bg-brand-surface/30 rounded-2xl p-4 flex flex-col items-center gap-3">
                  {pdfPath && pdfPath.startsWith('http') && !pdfPath.includes('drive.google.com') && !pdfPath.includes('docs.google.com') ? (
                    <div className="text-[10px] text-emerald-400 font-bold text-center break-all leading-normal">
                      تم رفع الملف بنجاح!
                      <br/>
                      <span className="text-slate-400 font-normal">{pdfPath}</span>
                    </div>
                  ) : (
                    <div className="w-full bg-brand-surface rounded-xl border border-dashed border-[var(--border-color)] p-4 text-center text-slate-500 text-[10px] font-bold">
                      لا يوجد ملف مرفوع بعد. يمكنك رفع ملف أو إدخال رابط خارجي/جوجل درايف بالأسفل.
                    </div>
                  )}
                  
                  <label className="inline-block px-3 py-1.5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                    <span>{uploadingPdf ? 'جاري الرفع...' : pdfPath ? 'استبدال الملف المرفوع' : 'اختر ملف PDF'}</span>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      disabled={uploadingPdf}
                      onChange={handlePdfUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">أو أدخل رابط ملف الـ PDF / Google Drive يدوياً</label>
                <input
                  type="text"
                  required={!pdfPath}
                  value={pdfPath}
                  onChange={(e) => setPdfPath(e.target.value)}
                  placeholder="https://drive.google.com/... أو رابط مباشر للـ PDF..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">حجم الملف (اختياري)</label>
                  <input
                    type="text"
                    value={pdfSize}
                    onChange={(e) => setPdfSize(e.target.value)}
                    placeholder="مثال: 1.5 MB"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">عدد الصفحات (اختياري)</label>
                  <input
                    type="number"
                    value={pdfPageCount === null ? '' : pdfPageCount}
                    onChange={(e) => setPdfPageCount(e.target.value ? Number(e.target.value) : null)}
                    placeholder="مثال: 12"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">رابط صورة غلاف المعاينة (اختياري)</label>
                <input
                  type="url"
                  value={pdfPreviewUrl}
                  onChange={(e) => setPdfPreviewUrl(e.target.value)}
                  placeholder="رابط صورة الغلاف..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setShowPdfForm(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">ربط الملف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Video Form Modal */}
      {editingVideo !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setEditingVideo(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">تعديل بيانات الفيديو المرفق</h3>
            
            <form onSubmit={handleSaveEditVideo} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان مقطع الفيديو</label>
                <input
                  type="text"
                  required
                  value={vidTitle}
                  onChange={(e) => setVidTitle(e.target.value)}
                  placeholder="مثال: شرح قانون أوم..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">رابط الفيديو</label>
                <input
                  type="text"
                  required
                  value={vidEmbedUrl}
                  onChange={(e) => setVidEmbedUrl(e.target.value)}
                  placeholder="رابط YouTube، ملف MP4 مباشر، أو كود Bunny..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">معرف الفيديو على Bunny (Video ID - اختياري)</label>
                <input
                  type="text"
                  value={vidStreamId}
                  onChange={(e) => setVidStreamId(e.target.value)}
                  placeholder="d74ff7e1-88f1-4db5-9e67-ea26c3619be9"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                />
              </div>


              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">غلاف الفيديو (تحميل يدوي)</label>
                <div className="border border-[var(--border-color)] bg-brand-surface/30 rounded-2xl p-4 flex flex-col items-center gap-3">
                  {vidThumbnail ? (
                    <img src={vidThumbnail} alt="Video cover" className="w-full aspect-video object-cover rounded-xl border border-[var(--border-color)]" />
                  ) : (
                    <div className="w-full aspect-video bg-brand-surface rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-slate-500 text-[10px] font-bold">لا يوجد غلاف</div>
                  )}
                  
                  <label className="inline-block px-3 py-1.5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                    <span>رفع غلاف جديد</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleManualVideoThumbnailUpload}
                    />
                  </label>
                  {uploadingThumbnailForVideo && (
                    <div className="text-[10px] text-brand-primary animate-pulse font-bold">جاري رفع الغلاف...</div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setEditingVideo(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">{actionLoading ? 'جاري الحفظ...' : 'تعديل البيانات'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace Video Form Modal */}
      {replacingVideo !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setReplacingVideo(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">استبدال ملف الفيديو</h3>
            
            <form onSubmit={handleSaveReplaceVideo} className="space-y-4">
              
              {isBunnyConfigured ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">رفع مباشر إلى Bunny Stream</label>
                  <div className="border-2 border-dashed border-[var(--border-color)] bg-brand-surface/10 rounded-2xl p-4 text-center">
                    {uploadingVideo ? (
                      <div className="space-y-2 text-right">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-300">
                          <span className="animate-pulse">{videoFileDetails?.status || 'جاري الرفع المباشر...'}</span>
                          {uploadProgress !== null && <span>{uploadProgress}%</span>}
                        </div>
                        {uploadProgress !== null && (
                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                          </div>
                        )}
                      </div>
                    ) : vidEmbedUrl && videoFileDetails ? (
                      <div className="space-y-2 text-xs text-right">
                        <div className="font-bold text-slate-200 truncate">{videoFileDetails.name}</div>
                        <div className="text-[10px] text-slate-400 flex justify-between px-2">
                          <span>الحجم: {videoFileDetails.size}</span>
                          <span className="text-emerald-500 font-bold">{videoFileDetails.status}</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => { setVidEmbedUrl(''); setVidDuration(''); setVideoFileDetails(null); }}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black cursor-pointer transition-all"
                        >
                          إزالة الفيديو
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 block font-medium">اسحب ملف الفيديو هنا أو اضغط للاختيار</span>
                        <label className="inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all">
                          <span>اختر ملف فيديو</span>
                          <input 
                            type="file" 
                            accept="video/mp4,video/m4v,video/quicktime,video/webm" 
                            className="hidden" 
                            onChange={handleVideoUpload}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl p-3 text-right">
                  <div className="text-[11px] font-bold text-amber-500">
                    تكامل Bunny Stream غير مهيأ حالياً على السيرفر. الرفع المباشر معطل.
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 font-bold">أو أدخل رابط الفيديو الجديد يدوياً</label>
                <input
                  type="text"
                  required
                  value={vidEmbedUrl}
                  onChange={(e) => setVidEmbedUrl(e.target.value)}
                  placeholder="رابط YouTube، ملف MP4، أو Bunny..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">معرف الفيديو على Bunny (اختياري)</label>
                <input
                  type="text"
                  value={vidStreamId}
                  onChange={(e) => setVidStreamId(e.target.value)}
                  placeholder="Bunny Stream ID..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                />
              </div>


              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setReplacingVideo(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">{actionLoading ? 'جاري الاستبدال...' : 'استبدال الفيديو'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Replace PDF Form Modal */}
      {replacingPdf !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => setReplacingPdf(null)} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl z-10 text-right">
            <h3 className="text-base font-black">استبدال ملف الـ PDF</h3>
            
            <form onSubmit={handleSaveReplacePdf} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">عنوان المذكرة</label>
                <input
                  type="text"
                  required
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="مثال: ملخص قوانين كيرشوف للدوائر الكهربية..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">رفع ملف PDF محلي جديد</label>
                <div className="border border-[var(--border-color)] bg-brand-surface/30 rounded-2xl p-4 flex flex-col items-center gap-3">
                  {pdfPath && pdfPath.startsWith('http') && !pdfPath.includes('drive.google.com') && !pdfPath.includes('docs.google.com') ? (
                    <div className="text-[10px] text-emerald-400 font-bold text-center break-all leading-normal">
                      تم رفع الملف بنجاح!
                      <br/>
                      <span className="text-slate-400 font-normal">{pdfPath}</span>
                    </div>
                  ) : (
                    <div className="w-full bg-brand-surface rounded-xl border border-dashed border-[var(--border-color)] p-4 text-center text-slate-500 text-[10px] font-bold">
                      لا يوجد ملف مرفوع بعد. يمكنك رفع ملف أو إدخال رابط خارجي/جوجل درايف بالأسفل.
                    </div>
                  )}
                  
                  <label className="inline-block px-3 py-1.5 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] border border-[var(--border-color)] text-slate-300 hover:text-white rounded-xl text-[10px] font-bold cursor-pointer transition-all shadow-sm">
                    <span>{uploadingPdf ? 'جاري الرفع...' : pdfPath ? 'استبدال الملف المرفوع' : 'اختر ملف PDF'}</span>
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      disabled={uploadingPdf}
                      onChange={handlePdfUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">أو أدخل رابط ملف الـ PDF الجديد / Google Drive يدوياً</label>
                <input
                  type="text"
                  required={!pdfPath}
                  value={pdfPath}
                  onChange={(e) => setPdfPath(e.target.value)}
                  placeholder="https://drive.google.com/... أو رابط مباشر للـ PDF الجديد..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">حجم الملف (اختياري)</label>
                  <input
                    type="text"
                    value={pdfSize}
                    onChange={(e) => setPdfSize(e.target.value)}
                    placeholder="مثال: 1.5 MB"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">عدد الصفحات (اختياري)</label>
                  <input
                    type="number"
                    value={pdfPageCount === null ? '' : pdfPageCount}
                    onChange={(e) => setPdfPageCount(e.target.value ? Number(e.target.value) : null)}
                    placeholder="مثال: 12"
                    className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">رابط صورة غلاف المعاينة (اختياري)</label>
                <input
                  type="url"
                  value={pdfPreviewUrl}
                  onChange={(e) => setPdfPreviewUrl(e.target.value)}
                  placeholder="رابط صورة الغلاف..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none text-left"
                  dir="ltr"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setReplacingPdf(null)} className="px-4 py-2 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" disabled={actionLoading} className="px-5 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">{actionLoading ? 'جاري الاستبدال...' : 'استبدال الملف'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Package Form Modal */}
      {showPackageForm && selectedCourse && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-transparent" onClick={() => { setShowPackageForm(false); setEditPackageMode(null); }} />
          <div className="relative bg-brand-card border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] z-10 text-right">
            <h3 className="text-lg font-black border-b border-[var(--border-color)] pb-3">
              {editPackageMode ? 'تعديل الباقة المجمعة' : 'بناء باقة مجمعة (عرض شهري)'}
            </h3>
            
            <form onSubmit={handleSavePackage} className="space-y-4 text-right">
              
              <div className="space-y-1">
                <label className="text-xs font-semibold">عنوان الباقة</label>
                <input
                  type="text"
                  required
                  value={packageTitle}
                  onChange={(e) => setPackageTitle(e.target.value)}
                  placeholder="مثال: باقة محاضرات شهر أكتوبر كيمياء..."
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">سعر الباقة المجمعة (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={packagePrice}
                  onChange={(e) => setPackagePrice(e.target.value)}
                  placeholder="مثال: 80.00"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">وصف الباقة المجمعة</label>
                <textarea
                  value={packageDesc}
                  onChange={(e) => setPackageDesc(e.target.value)}
                  placeholder="مثال: تشمل الباقة جميع محاضرات الباب الأول في الكيمياء العضوية..."
                  rows={3}
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none resize-none text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">رابط غلاف الباقة (اختياري)</label>
                <input
                  type="text"
                  value={packageCoverImage}
                  onChange={(e) => setPackageCoverImage(e.target.value)}
                  placeholder="رابط الصورة أو اتركها فارغة لاستخدام غلاف الكورس"
                  className="w-full bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold block">صورة الباقة المجمعة (تحميل مباشر)</label>
                
                {/* Drag & Drop area */}
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const formData = new FormData();
                      formData.append('file', file);
                      setUploadingThumbnail(true);
                      try {
                        const res = await API.post('/upload', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        setPackageThumbnail(res.data.url);
                        useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                      } catch (err) {
                        useModalStore.getState().showToast('فشل الرفع.', 'error');
                      } finally {
                        setUploadingThumbnail(false);
                      }
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isDragOver ? 'border-brand-primary bg-brand-primary/5' : 'border-border-color bg-brand-surface/10'
                  }`}
                >
                  {packageThumbnail ? (
                    <div className="space-y-3">
                      <img src={packageThumbnail} alt="Preview" className="h-28 mx-auto rounded-xl object-cover aspect-video border border-border-color" />
                      <button 
                        type="button" 
                        onClick={() => setPackageThumbnail('')}
                        className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black"
                      >
                        إزالة الصورة
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-[10px] text-text-secondary block font-bold">اسحب صورة الباقة وأفلتها هنا، أو اضغط على الزر أدناه</span>
                      <label className="inline-block px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow shadow-brand-primary/10">
                        <span>اختر صورة للباقة</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('file', file);
                              setUploadingThumbnail(true);
                              try {
                                const res = await API.post('/upload', formData, {
                                  headers: { 'Content-Type': 'multipart/form-data' },
                                });
                                setPackageThumbnail(res.data.url);
                                useModalStore.getState().showToast('تم رفع صورة الباقة بنجاح.', 'success');
                              } catch (err) {
                                useModalStore.getState().showToast('فشل الرفع.', 'error');
                              } finally {
                                setUploadingThumbnail(false);
                              }
                            }
                          }}
                        />
                      </label>
                      {uploadingThumbnail && (
                        <div className="text-[10px] text-brand-primary animate-pulse font-bold">جاري رفع الصورة...</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">اختر المحاضرات التابعة للباقة:</label>
                
                <div className="space-y-2 border border-[var(--border-color)] p-4 rounded-2xl max-h-40 overflow-y-auto bg-[rgba(0,0,0,0.05)]">
                  {units.flatMap((u) => u.lessons).length === 0 ? (
                    <div className="text-center py-4 text-[10px] text-slate-500 font-light">لا توجد محاضرات مضافة بالكورس لتضمينها بالباقة بعد.</div>
                  ) : (
                    units.flatMap((u) => u.lessons).map((lesson) => {
                      const isChecked = selectedLessons.includes(lesson.id)
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          onClick={() => toggleLessonInPackage(lesson.id)}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-colors ${
                            isChecked ? 'border-brand-primary bg-brand-primary/5 text-slate-100 font-bold' : 'border-[var(--border-color)] text-slate-400'
                          }`}
                        >
                          <span className="text-xs">{lesson.title}</span>
                          {isChecked && <Check className="h-4 w-4 text-brand-primary" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => { setShowPackageForm(false); setEditPackageMode(null); }} className="px-4 py-2.5 bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs rounded-xl">إلغاء</button>
                <button type="submit" className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl">
                  {editPackageMode ? 'حفظ التعديلات' : 'حفظ الباقة وتنشيطها'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}
