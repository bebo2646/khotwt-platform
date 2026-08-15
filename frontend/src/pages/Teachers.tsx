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
  const [filterCategory, setFilterCategory] = React.useState<string>('')

  React.useEffect(() => {
    setLoading(true)
    API.get('/teachers', { 
      params: { 
        teaching_mode: filterMode || undefined,
        category: filterCategory || undefined 
      } 
    })
      .then((res) => {
        setTeachers(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [filterMode, filterCategory])

  const safeTeachers = Array.isArray(teachers) ? teachers : []

  return (
    <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-right" dir="rtl">
      <SEO 
        title="نخبة المعلمين والخبراء | منصة خطوتك"
        description="تصفح قائمة المعلمين والخبراء المميزين على منصة خطوتك في مختلف المجالات: التعليم المدرسي، البرمجة، التجارة، والتصميم."
        keywords="مدرسين ثانوية عامة, معلمي منصة خطوتك, مدرس الكيمياء, كورسات برمجة, خبراء تصميم"
      />
      
      {/* Header and Filter */}
      <div className="bg-slate-950/80 border border-slate-800 p-8 rounded-[32px] shadow-xl relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <span className="px-3.5 py-1 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-black rounded-full inline-block">
              👨‍🏫 الكادر التعليمي والخبراء
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-foreground">هيئة التدريس والنخبة</h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">كبار معلمي وموجهي المواد بمصر والخبراء في مجالات التكنولوجيا والأعمال</p>
          </div>

          {/* Mode Filter Pills */}
          <div className="flex flex-wrap gap-2 text-xs font-black relative z-10 shrink-0">
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
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Pills Bar */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800/80 text-xs font-black">
          {[
            { label: '🌐 جميع المجالات', value: '' },
            { label: '🎓 التعليم المدرسي', value: 'school' },
            { label: '💻 البرمجة والتكنولوجيا', value: 'programming' },
            { label: '📈 التجارة والأعمال', value: 'business' },
            { label: '🎨 التصميم والإبداع', value: 'design' },
            { label: '🌍 اللغات والترجمة', value: 'languages' },
            { label: '📱 التسويق الرقمي', value: 'marketing' },
            { label: '💼 المهارات المهنية', value: 'skills' }
          ].map((catPill) => (
            <button
              key={catPill.value}
              onClick={() => setFilterCategory(catPill.value)}
              className={`px-3.5 py-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                filterCategory === catPill.value
                  ? 'bg-brand-secondary text-white border-brand-secondary shadow-md'
                  : 'bg-slate-900/40 hover:bg-slate-900 border-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              {catPill.label}
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
