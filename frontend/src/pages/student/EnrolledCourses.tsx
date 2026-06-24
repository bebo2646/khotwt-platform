import React from 'react'
import { Link } from 'react-router-dom'
import API from '../../services/api'
import { BookOpen, User, Calendar, ArrowRight } from 'lucide-react'
import EmptyState from '../../components/EmptyState'

interface EnrolledCourse {
  id: number
  enrolled_at: string
  course: {
    id: number
    title: string
    description: string
    cover_image: string
    subject: string
    teacher: {
      name: string
    }
  }
}

const SUBJECTS_TRANSLATION: Record<string, string> = {
  chemistry: 'الكيمياء',
  physics: 'الفيزياء',
  biology: 'الأحياء',
  math: 'الرياضيات',
  science: 'العلوم',
  arabic: 'اللغة العربية',
  english: 'اللغة الإنجليزية',
}

export default function EnrolledCourses() {
  const [enrollments, setEnrollments] = React.useState<EnrolledCourse[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    API.get('/student/courses')
      .then((res) => {
        setEnrollments(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      
      <div>
        <h1 className="text-3xl font-black">كورساتي ومحاضراتي المشترك بها</h1>
        <p className="text-sm text-slate-400 font-light mt-1">تابع دروسك وامتحاناتك اليومية والنهائية مباشرة</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : enrollments.length === 0 ? (
        <EmptyState
          type="courses"
          title="لم تشترك في أي كورسات بعد"
          description="يمكنك تصفح صفحة الكورسات والاشتراك بالكامل في المادة أو في باقة شهرية."
          actionButton={
            <Link to="/courses" className="px-6 py-3 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-lg">
              تصفح الكورسات المتاحة
            </Link>
          }
        />
      ) : (
        /* Enrolled Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {enrollments.map((enr) => (
            <div key={enr.id} className="bg-brand-card border border-[var(--border-color)] rounded-3xl overflow-hidden hover:border-brand-primary/30 transition-all group">
              <div className="aspect-video bg-slate-800 relative overflow-hidden">
                <img src={enr.course.cover_image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500'} alt={enr.course.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                <div className="absolute top-3 right-3 px-3 py-1 bg-black/75 rounded-full text-xs font-semibold text-brand-primary">
                  {SUBJECTS_TRANSLATION[enr.course.subject] || enr.course.subject}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-brand-primary" />
                  <span className="text-xs text-slate-400 font-semibold">{enr.course.teacher.name}</span>
                </div>
                <h3 className="font-bold text-lg line-clamp-1 group-hover:text-brand-primary transition-colors">{enr.course.title}</h3>
                
                <div className="flex items-center gap-2 text-xs text-slate-400 font-light">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span>تاريخ الاشتراك: {new Date(enr.enrolled_at).toLocaleDateString('ar-EG')}</span>
                </div>

                <div className="pt-4 border-t border-[var(--border-color)] flex justify-end">
                  <Link to={`/course/${enr.course.id}`} className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5">
                    <span>دخول المحتوى الدراسي</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
