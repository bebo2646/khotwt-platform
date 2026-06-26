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
  slug?: string
}

export default function Teachers() {
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    API.get('/teachers')
      .then((res) => {
        setTeachers(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <SEO 
        title="نخبة المعلمين | منصة خطوتك"
        description="تصفح قائمة المعلمين المميزين على منصة خطوتك، والذين يقدمون أفضل شروحات المناهج الإعدادية والثانوية مع المتابعة والاختبارات المستمرة."
        keywords="مدرسين ثانوية عامة, معلمي منصة خطوتك, مدرس الكيمياء, مدرس الفيزياء"
      />
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black">أعضاء هيئة التدريس</h1>
        <p className="text-sm text-text-secondary font-light mt-1">كبار معلمي وموجهي المواد بمصر لمساعدتك في رحلة التعلم</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary"></div>
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState
          type="teachers"
          title="لا يوجد مدرسون مسجلون"
          description="لا يوجد معلمون مسجلون في المنصة حالياً."
        />
      ) : (
        /* Teachers Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {teachers.map((teacher) => (
            <TeacherCard
              key={teacher.id}
              id={teacher.id}
              name={teacher.name}
              subject={teacher.subject}
              avatar={teacher.avatar}
              experience={teacher.experience}
              bio={teacher.bio}
              coursesCount={teacher.courses_count || 0}
              studentsCount={teacher.students_count || 0}
              slug={teacher.slug}
            />
          ))}
        </div>
      )}

    </div>
  )
}
