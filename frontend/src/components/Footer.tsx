import React from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[rgba(27,30,36,0.3)] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand & Description */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-brand-primary">خطوتك</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-light">
              منصة تعليمية حديثة تجمع أفضل المعلمين والدورات والاختبارات التفاعلية في مكان واحد، لتمنحك تجربة تعليمية ذكية تساعدك على التفوق وتحقيق أهدافك الأكاديمية بثقة.
            </p>
            <div className="flex gap-4">
              <a href="#" aria-label="فيسبوك" className="p-2 bg-[rgba(255,255,255,0.02)] hover:bg-brand-primary/10 border border-[var(--border-color)] hover:border-brand-primary/40 rounded-full text-slate-400 hover:text-brand-primary">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" aria-label="إنستجرام" className="p-2 bg-[rgba(255,255,255,0.02)] hover:bg-brand-primary/10 border border-[var(--border-color)] hover:border-brand-primary/40 rounded-full text-slate-400 hover:text-brand-primary">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="تويتر" className="p-2 bg-[rgba(255,255,255,0.02)] hover:bg-brand-primary/10 border border-[var(--border-color)] hover:border-brand-primary/40 rounded-full text-slate-400 hover:text-brand-primary">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" aria-label="يوتيوب" className="p-2 bg-[rgba(255,255,255,0.02)] hover:bg-brand-primary/10 border border-[var(--border-color)] hover:border-brand-primary/40 rounded-full text-slate-400 hover:text-brand-primary">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links 1 */}
          <div>
            <h4 className="font-semibold text-base mb-4">المراحل الدراسية</h4>
            <ul className="space-y-2 text-sm text-slate-400 font-light">
              <li><Link to="/courses?grade=first_secondary" className="hover:text-brand-primary transition-colors">الصف الأول الثانوي</Link></li>
              <li><Link to="/courses?grade=second_secondary" className="hover:text-brand-primary transition-colors">الصف الثاني الثانوي</Link></li>
              <li><Link to="/courses?grade=third_secondary" className="hover:text-brand-primary transition-colors">الصف الثالث الثانوي</Link></li>
              <li><Link to="/courses?grade=third_preparatory" className="hover:text-brand-primary transition-colors">الصف الثالث الإعدادي</Link></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div>
            <h4 className="font-semibold text-base mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm text-slate-400 font-light">
              <li><Link to="/courses" className="hover:text-brand-primary transition-colors">تصفح الكورسات</Link></li>
              <li><Link to="/teachers" className="hover:text-brand-primary transition-colors">معلمو المنصة</Link></li>
              <li><Link to="/login" className="hover:text-brand-primary transition-colors">بوابة الدخول</Link></li>
              <li><Link to="/register" className="hover:text-brand-primary transition-colors">تسجيل حساب طالب</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="space-y-3 text-sm text-slate-400 font-light">
            <h4 className="font-semibold text-base text-current mb-4">تواصل معنا</h4>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-brand-primary" />
              <span>+201009469745 (بسعر الدقيقة العادية)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-primary" />
              <span>btaha7760@gmail.com</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-primary" />
              <span>القاهرة، جمهورية مصر العربية</span>
            </div>
          </div>

        </div>

        <div className="border-t border-[var(--border-color)] mt-12 pt-6 flex flex-col items-center justify-center text-center text-xs text-slate-500 font-light space-y-2">
          <img 
            src="/logo.png" 
            alt="شعار خطوتك" 
            className="h-8 w-8 object-contain mb-1 opacity-80" 
          />
          <p className="text-slate-400 font-bold text-sm">جميع الحقوق محفوظة © خطوتك</p>
          <p className="text-slate-500 font-medium">Developed By: ENG Belal Ahmed</p>
          <p className="flex items-center gap-1.5 justify-center">
            
            <a 
              href="https://belal-portfolio1.netlify.app/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-brand-primary hover:underline hover:text-brand-primary-hover font-bold transition-all duration-200"
            >
              https://belal-portfolio1.netlify.app/
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
