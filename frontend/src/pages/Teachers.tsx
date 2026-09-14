import React from 'react'
import API from '../services/api'
import SEO from '../components/SEO'
import TeachersCarousel, { type TeacherItem } from '../components/ui/TeachersCarousel'

export default function Teachers() {
  const [teachers, setTeachers] = React.useState<TeacherItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    API.get('/teachers')
      .then((res) => {
        setTeachers(Array.isArray(res.data) ? res.data : [])
      })
      .catch((err) => {
        console.error('Failed to fetch teachers:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="w-full text-right" dir="rtl">
      <SEO 
        title="نخبة المعلمين والخبراء | منصة خطوتك"
        description="تصفح قائمة المعلمين والخبراء المميزين على منصة خطوتك في مختلف المجالات: التعليم المدرسي، البرمجة، التجارة، والتصميم."
        keywords="مدرسين ثانوية عامة, معلمي منصة خطوتك, مدرس الكيمياء, كورسات برمجة, خبراء تصميم"
      />
      
      <TeachersCarousel
        teachers={teachers}
        loading={loading}
        title="هيئة التدريس والنخبة"
        subtitle="كبار معلمي وموجهي المواد بمصر والخبراء في مجالات التكنولوجيا والأعمال"
        badge="👨‍🏫 الكادر التعليمي والخبراء"
        showFilters={true}
      />
    </div>
  )
}
