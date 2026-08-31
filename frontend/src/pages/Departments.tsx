import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  GraduationCap, 
  Code, 
  TrendingUp, 
  Palette, 
  Globe, 
  Share2, 
  Briefcase, 
  BookOpen, 
  Users, 
  Sparkles, 
  ArrowLeft, 
  Search,
  Layers,
  Compass
} from 'lucide-react'
import API from '../services/api'
import SEO from '../components/SEO'
import { useTaxonomyStore, type Department } from '../store/taxonomyStore'

const ICON_COMPONENTS: Record<string, any> = {
  GraduationCap,
  Code,
  TrendingUp,
  Palette,
  Globe,
  Share2,
  Briefcase,
  BookOpen,
  Users,
  Sparkles,
  Layers,
  Compass
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
}

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 80, damping: 15 }
  }
}

export default function Departments() {
  const { departments, fetchTaxonomy } = useTaxonomyStore()
  const [departmentsData, setDepartmentsData] = React.useState<Department[]>(departments)
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')

  React.useEffect(() => {
    fetchTaxonomy()
    API.get('/departments')
      .then((res) => {
        if (Array.isArray(res.data)) {
          setDepartmentsData(res.data)
        }
      })
      .catch((err) => console.error('Failed to load departments:', err))
      .finally(() => setLoading(false))
  }, [fetchTaxonomy])

  const activeDepartments = departmentsData.length > 0 ? departmentsData : departments

  const filteredDepartments = activeDepartments.filter(dept => {
    if (!dept.is_active && dept.is_active !== undefined) return false
    const matchName = dept.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchDesc = (dept.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    return matchName || matchDesc
  })

  const getIconComponent = (iconName?: string) => {
    if (!iconName) return GraduationCap
    return ICON_COMPONENTS[iconName] || GraduationCap
  }

  return (
    <div className="min-h-screen bg-background py-10 space-y-12 text-right" dir="rtl">
      <SEO 
        title="أقسام المنصة التعليمية | منصة خطوتك"
        description="استكشف الأقسام والتخصصات التعليمية المختلفة على منصة خطوتك: التعليم المدرسي، البرمجة والتكنولوجيا، التجارة والأعمال، التصميم، اللغات، والتسويق الرقمي."
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* ====================================
            1. HERO SECTION
            ==================================== */}
        <div className="relative rounded-3xl overflow-hidden border border-border-color bg-gradient-to-br from-[var(--card-bg)]/90 via-[var(--bg-color)]/95 to-[var(--card-bg)]/90 p-8 sm:p-10 md:p-12 shadow-2xl space-y-6">
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-4 max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-xs text-brand-primary font-black shadow-sm">
              <Compass className="h-4 w-4 animate-spin-slow" />
              <span>أقسام وتخصصات خطوتك ✨</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground leading-tight tracking-tight">
              أقسام المنصة <span className="text-brand-primary drop-shadow-[0_0_15px_rgba(22,196,127,0.2)]">التعليمية</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed">
              اختر مجالك التعليمي المفضل واستكشف أفضل الكورسات والشروحات مع نخبة متميزة من المعلمين والخبراء المتخصصين.
            </p>
          </div>

          {/* Search bar */}
          <div className="pt-2 max-w-md relative z-10">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن قسم أو تخصص..."
                className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pr-11 pl-4 py-3 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-primary shadow-inner"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* ====================================
            2. DEPARTMENTS GRID
            ==================================== */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 rounded-3xl bg-slate-900/40 border border-slate-800 animate-pulse p-6 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800"></div>
                <div className="w-3/4 h-6 rounded-lg bg-slate-800"></div>
                <div className="w-full h-12 rounded-lg bg-slate-800/60"></div>
              </div>
            ))}
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="bg-brand-card border border-border-color rounded-3xl p-12 text-center space-y-4">
            <Layers className="h-12 w-12 text-slate-500 mx-auto" />
            <h3 className="text-lg font-black text-foreground">لا توجد أقسام مطابقة لبحثك</h3>
            <p className="text-xs text-slate-400">جرب البحث بكلمات أخرى أو تصفح الأقسام المتاحة</p>
          </div>
        ) : (
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredDepartments.map((dept) => {
              const IconComp = getIconComponent(dept.icon)
              return (
                <motion.div
                  key={dept.id || dept.slug}
                  variants={cardVariants}
                  whileHover={{ y: -6, borderColor: 'rgba(99, 102, 241, 0.4)' }}
                  className="bg-slate-900/60 backdrop-blur-md border border-slate-800/90 rounded-3xl p-7 flex flex-col justify-between space-y-6 shadow-xl hover:shadow-[0_15px_30px_rgba(99,102,241,0.12)] transition-all duration-300 group relative overflow-hidden"
                >
                  {/* Subtle corner glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl pointer-events-none group-hover:bg-brand-primary/15 transition-all"></div>

                  <div className="space-y-4 relative z-10">
                    {/* Top: Icon & Badge */}
                    <div className="flex items-center justify-between">
                      <div className="p-3.5 rounded-2xl bg-brand-primary/10 text-brand-primary border border-brand-primary/20 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 shadow-md">
                        <IconComp className="h-7 w-7" />
                      </div>
                      {dept.badge && (
                        <span className="px-3 py-1 bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[10px] font-black rounded-full shadow-inner">
                          {dept.badge}
                        </span>
                      )}
                    </div>

                    {/* Department Title & Description */}
                    <div className="space-y-2">
                      <h3 className="text-xl font-black text-foreground group-hover:text-brand-primary transition-colors">
                        {dept.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-light leading-relaxed line-clamp-3">
                        {dept.description || 'استكشف شروحات وكورسات هذا القسم وتواصل مع نخبة من أفضل المعلمين.'}
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Stats & Link */}
                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                      {dept.courses_count !== undefined && (
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{dept.courses_count} كورس</span>
                        </span>
                      )}
                      {dept.teachers_count !== undefined && (
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-brand-primary" />
                          <span>{dept.teachers_count} معلم</span>
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/departments/${dept.slug}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-xl text-xs font-black border border-brand-primary/20 transition-all duration-200 cursor-pointer shadow-sm"
                    >
                      <span>استكشف</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

      </div>
    </div>
  )
}
