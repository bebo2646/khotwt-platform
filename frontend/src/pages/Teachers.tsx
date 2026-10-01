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
      
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <h1 className="text-3xl sm:text-5xl font-black text-foreground">نخبة المعلمين والخبراء</h1>
        <p className="text-xs sm:text-sm text-[var(--text-muted)] font-medium mt-1">تصفح أفضل الكوادر التعليمية وتعرف على شروحاتهم ومؤهلاتهم على منصة خطوتك</p>
      </div>

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
