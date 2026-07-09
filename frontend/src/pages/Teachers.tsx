import React from 'react'
import API from '../services/api'
import EmptyState from '../components/EmptyState'
import TeacherCard from '../components/ui/TeacherCard'
import SEO from '../components/SEO'

interface TeacherItem {
  id: number
  name: string
  subject: string
  avatar?: string
  experience: string
  bio: string
  students_count: number
  courses_count: number
  published_courses_count?: number
  slug?: string
  teaching_mode?: string
}

export default function Teachers() {
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filterMode, setFilterMode] = React.useState<string>('')

  React.useEffect(() => {
    setLoading(true)
    API.get('/teachers', { params: { teaching_mode: filterMode || undefined } })
      .then((res) => {
        setTeachers(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [filterMode])

  const safeTeachers = Array.isArray(teachers) ? teachers : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12" dir="rtl">
      <SEO 
        title="نخبة المعلمين | منصة خطوتك"
        description="تصفح قائمة المعلمين المميزين على منصة خطوتك، والذين يقدمون أفضل شروحات المناهج الإعدادية والثانوية مع المتابعة والاختبارات المستمرة."
        keywords="مدرسين ثانوية عامة, معلمي منصة خطوتك, مدرس الكيمياء, مدرس الفيزياء"
      />
      
      {/* Header and Filter */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[var(--border-color)] pb-6">
        <div>
          <h1 className="text-3xl font-black">أعضاء هيئة التدريس</h1>
          <p className="text-sm text-text-secondary font-light mt-1">كبار معلمي وموجهي المواد بمصر لمساعدتك في رحلة التعلم</p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-black">
          {[
            { label: 'الكل', value: '' },
            { label: '🟢 أونلاين', value: 'online' },
            { label: '🏫 سنتر', value: 'center' },
            { label: '🟣 أونلاين + سنتر', value: 'both' }
          ].map((pill) => (
            <button
              key={pill.value}
              onClick={() => setFilterMode(pill.value)}
              className={`px-4 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                filterMode === pill.value
                  ? 'bg-brand-primary text-white border-brand-primary shadow-md'
                  : 'bg-brand-card hover:bg-brand-surface border-[var(--border-color)] text-text-secondary hover:text-foreground'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : safeTeachers.length === 0 ? (
        <EmptyState
          type="teachers"
          title="لا يوجد مدرسون مسجلون"
          description="لا يوجد معلمون يطابقون خيارات التصفية الحالية."
        />
      ) : (
        /* Teachers Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {safeTeachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              id={teacher.id}
              name={teacher.name}
              subject={teacher.subject}
              avatar={teacher.avatar}
              experience={teacher.experience}
              bio={teacher.bio}
              coursesCount={teacher.published_courses_count || 0}
              studentsCount={teacher.students_count || 0}
              slug={teacher.slug}
              teaching_mode={teacher.teaching_mode}
            />
          ))}
        </div>
      )}

    </div>
  )
}
