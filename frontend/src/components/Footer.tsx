import React from 'react'
import { Link } from 'react-router-dom'
import { Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer-custom transition-all duration-300">
      <div className="max-w-[1600px] w-full mx-auto px-6 lg:px-8 footer-container flex flex-col">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 footer-grid">
          
          {/* Brand & Description */}
          <div className="footer-section">
            <h3 className="text-xl font-black text-brand-primary">خطوتك</h3>
            <p className="text-sm footer-desc font-light">
              منصة تعليمية حديثة تجمع أفضل المعلمين والدورات والاختبارات التفاعلية في مكان واحد، لتمنحك تجربة تعليمية ذكية تساعدك على التفوق وتحقيق أهدافك الأكاديمية بثقة.
            </p>
            <div className="flex gap-4 justify-center">
              <a href="#" aria-label="فيسبوك" className="social-icon">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="#" aria-label="إنستجرام" className="social-icon">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="تويتر" className="social-icon">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" aria-label="يوتيوب" className="social-icon">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links 1 */}
          <div className="footer-section">
            <h4 className="font-bold text-base footer-title">المراحل الدراسية</h4>
            <ul className="space-y-2 text-sm font-light">
              <li><Link to="/courses?grade=first_secondary" className="footer-link">الصف الأول الثانوي</Link></li>
              <li><Link to="/courses?grade=second_secondary" className="footer-link">الصف الثاني الثانوي</Link></li>
              <li><Link to="/courses?grade=third_secondary" className="footer-link">الصف الثالث الثانوي</Link></li>
              <li><Link to="/courses?grade=third_preparatory" className="footer-link">الصف الثالث الإعدادي</Link></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="footer-section">
            <h4 className="font-bold text-base footer-title">روابط سريعة</h4>
            <ul className="space-y-2 text-sm font-light">
              <li><Link to="/courses" className="footer-link">تصفح الكورسات</Link></li>
              <li><Link to="/teachers" className="footer-link">معلمو المنصة</Link></li>
              <li><Link to="/login" className="footer-link">بوابة الدخول</Link></li>
              <li><Link to="/register" className="footer-link">تسجيل حساب طالب</Link></li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="footer-section space-y-3">
            <h4 className="font-bold text-base footer-title">تواصل معنا</h4>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-primary" />
                <span>+201009469745</span>
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

        </div>

        {/* Bottom Part */}
        <div className="footer-bottom flex flex-col items-center justify-center text-center text-xs font-light space-y-2">
          <img 
            src="/logo.png" 
            alt="شعار خطوتك" 
            className="h-8 w-8 object-contain mb-1 opacity-80" 
          />
          <p className="footer-copyright font-bold text-sm">جميع الحقوق محفوظة © خطوتك</p>
          <p className="footer-credit font-medium">Developed By: ENG Belal Ahmed</p>
          <p className="flex items-center gap-1.5 justify-center">
            <a 
              href="https://belal-portfolio1.netlify.app/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="footer-credit-link font-bold"
            >
              https://belal-portfolio1.netlify.app/
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
