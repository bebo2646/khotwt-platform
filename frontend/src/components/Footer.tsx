import React from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="relative bg-slate-950 border-t border-slate-800/80 pt-16 pb-12 overflow-hidden transition-all duration-300 text-right">
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-8 space-y-12">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Brand & Description */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="شعار خطوتك" className="h-8 w-8 object-contain" />
              <h3 className="text-2xl font-black text-brand-primary">خطوتك</h3>
            </div>
            <p className="text-xs sm:text-sm text-text-secondary font-medium leading-relaxed">
              منصة تعليمية تفاعلية تجمع أفضل المعلمين والدورات والاختبارات الذكية في مكان واحد، لتمنحك تجربة تساعدك على التفوق بثقة.
            </p>
            <div className="flex gap-3 pt-2">
              <a 
                href="https://www.facebook.com/profile.php?id=61591376162499" 
                target="_blank"
                rel="noopener noreferrer"
                aria-label="فيسبوك" 
                className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-brand-primary/20 border border-slate-800 hover:border-brand-primary/40 text-slate-300 hover:text-brand-primary transition-all duration-200"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                aria-label="إنستجرام" 
                className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-brand-primary/20 border border-slate-800 hover:border-brand-primary/40 text-slate-300 hover:text-brand-primary transition-all duration-200"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                aria-label="تويتر" 
                className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-brand-primary/20 border border-slate-800 hover:border-brand-primary/40 text-slate-300 hover:text-brand-primary transition-all duration-200"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a 
                href="#" 
                aria-label="يوتيوب" 
                className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/40 text-slate-300 hover:text-rose-400 transition-all duration-200"
              >
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links 1 */}
          <div className="space-y-4">
            <h4 className="font-black text-sm text-foreground border-r-2 border-brand-primary pr-3">المراحل الدراسية</h4>
            <ul className="space-y-2.5 text-xs font-semibold text-text-secondary">
              <li><Link to="/courses?grade=first_secondary" className="hover:text-brand-primary transition-colors">الصف الأول الثانوي</Link></li>
              <li><Link to="/courses?grade=second_secondary" className="hover:text-brand-primary transition-colors">الصف الثاني الثانوي</Link></li>
              <li><Link to="/courses?grade=third_secondary" className="hover:text-brand-primary transition-colors">الصف الثالث الثانوي</Link></li>
              <li><Link to="/courses?grade=third_preparatory" className="hover:text-brand-primary transition-colors">الصف الثالث الإعدادي</Link></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="space-y-4">
            <h4 className="font-black text-sm text-foreground border-r-2 border-brand-primary pr-3">روابط سريعة</h4>
            <ul className="space-y-2.5 text-xs font-semibold text-text-secondary">
              <li><Link to="/departments" className="hover:text-brand-primary transition-colors">أقسام المنصة</Link></li>
              <li><Link to="/courses" className="hover:text-brand-primary transition-colors">تصفح الكورسات</Link></li>
              <li><Link to="/teachers" className="hover:text-brand-primary transition-colors">معلمو المنصة</Link></li>
              <li><Link to="/monthly-exams" className="hover:text-brand-primary transition-colors">الامتحانات الشهرية</Link></li>
              <li><Link to="/login" className="hover:text-brand-primary transition-colors">بوابة الدخول</Link></li>
              <li><Link to="/register" className="hover:text-brand-primary transition-colors">تسجيل حساب طالب</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-4">
            <h4 className="font-black text-sm text-foreground border-r-2 border-brand-primary pr-3">تواصل معنا</h4>
            <div className="space-y-3 text-xs font-semibold text-text-secondary">
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-brand-primary shrink-0" />
                <span dir="ltr">+20 100 946 9745</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-brand-primary shrink-0" />
                <span>btaha7760@gmail.com</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-brand-primary shrink-0" />
                <span>القاهرة، جمهورية مصر العربية</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Part */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col items-center justify-center text-center text-xs space-y-2">
          <img 
            src="/logo.png" 
            alt="شعار خطوتك" 
            className="h-8 w-8 object-contain mb-1 opacity-80" 
          />
          <p className="font-black text-sm text-foreground">جميع الحقوق محفوظة © منصة خطوتك</p>
          <p className="text-text-secondary font-medium">Developed By: ENG Belal Ahmed</p>
          <p className="flex items-center gap-1.5 justify-center">
            <a 
              href="https://belal-portfolio1.vercel.app" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand-primary hover:underline font-bold"
            >
             https://belal-portfolio1.vercel.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
