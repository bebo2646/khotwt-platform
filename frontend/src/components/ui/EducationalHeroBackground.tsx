import React from 'react'
import { useThemeStore } from '../../store/themeStore'

interface EducationalElement {
  id: string
  subject: string
  accent: 'purple' | 'orange' | 'green' | 'cyan' | 'pink' | 'blue'
  desktopPos: { top: number; left?: number; right?: number }
  size: number
  color: string
  rotation: number
  duration: number
  delay: number
  layer: 1 | 2 | 3
  svg: React.ReactNode
  mobileClass?: string
}

export default function EducationalHeroBackground() {
  const theme = useThemeStore((state) => state.theme)
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x, y })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // EXACTLY 12 curated educational icons on Desktop, EXACTLY 6 visible on Mobile
  // All positioned strictly in negative space (zero overlap with text, cards, buttons, navbar)
  const elements: EducationalElement[] = [
    // =========================================================================
    // TOP PERIMETER ARCH (6 icons: 1 of each color, y = 88-115px)
    // =========================================================================
    // 1. Top Far-Left: Math Triangle (Purple) — Mobile Icon 0
    {
      id: 'math-tri',
      subject: 'math',
      accent: 'purple',
      desktopPos: { top: 95, left: 36 },
      size: 70,
      color: 'rgba(167, 139, 250, 0.95)', // Violet
      rotation: 14,
      duration: 19,
      delay: 0,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-0',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="15,85 85,85 85,15" />
          <path d="M78,85 L78,78 L85,78" />
        </svg>
      )
    },
    // 2. Top Mid-Left: Open Arabic Book (Orange) — Desktop only
    {
      id: 'ar-book',
      subject: 'arabic',
      accent: 'orange',
      desktopPos: { top: 115, left: 220 },
      size: 66,
      color: 'rgba(245, 158, 11, 0.95)', // Amber
      rotation: 10,
      duration: 21,
      delay: 1.2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15,25 Q35,30 50,22 Q65,30 85,25 L85,75 Q65,80 50,70 Q35,80 15,75 Z" />
          <path d="M50,22 L50,70" />
        </svg>
      )
    },
    // 3. Top Center-Left: Geography Globe (Cyan) — Mobile Icon 4
    {
      id: 'geo-globe',
      subject: 'geography',
      accent: 'cyan',
      desktopPos: { top: 88, left: 450 },
      size: 72,
      color: 'rgba(34, 211, 238, 0.95)', // Sky Cyan
      rotation: -12,
      duration: 23,
      delay: 0.9,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-4',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="50" cy="50" r="35" />
          <ellipse cx="50" cy="50" rx="35" ry="12" />
          <ellipse cx="50" cy="50" rx="12" ry="35" />
          <line x1="15" y1="50" x2="85" y2="50" />
          <line x1="50" y1="15" x2="50" y2="85" />
        </svg>
      )
    },
    // 4. Top Center-Right: Math Pi (Pink) — Desktop only
    {
      id: 'math-pi',
      subject: 'math',
      accent: 'pink',
      desktopPos: { top: 88, right: 450 },
      size: 64,
      color: 'rgba(251, 113, 133, 0.95)', // Coral Pink
      rotation: -8,
      duration: 17,
      delay: 0.8,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M25,30 L75,30 M35,30 Q35,70 30,70 M42,30 L42,70 M60,30 Q60,70 68,70" />
        </svg>
      )
    },
    // 5. Top Mid-Right: Chemistry Flask (Green) — Mobile Icon 2
    {
      id: 'chem-flask',
      subject: 'chemistry',
      accent: 'green',
      desktopPos: { top: 115, right: 220 },
      size: 68,
      color: 'rgba(52, 211, 153, 0.95)', // Emerald Green
      rotation: 10,
      duration: 21,
      delay: 0.6,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-2',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42,20 L42,35 L20,78 Q17,84 23,84 L77,84 Q83,84 80,78 L58,35 L58,20" />
          <path d="M38,20 L62,20" />
          <path d="M28,68 L72,68" strokeDasharray="3 3" />
          <circle cx="44" cy="55" r="3.5" fill="currentColor" stroke="none" />
          <circle cx="56" cy="62" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    // 6. Top Far-Right: CS Laptop (Blue) — Mobile Icon 5
    {
      id: 'cs-laptop',
      subject: 'cs',
      accent: 'blue',
      desktopPos: { top: 95, right: 36 },
      size: 68,
      color: 'rgba(96, 165, 250, 0.95)', // Sky Blue
      rotation: -10,
      duration: 22,
      delay: 1.0,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-5',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="25" width="50" height="35" rx="3" />
          <path d="M15,65 L85,65 L80,72 L20,72 Z" />
          <line x1="45" y1="65" x2="55" y2="65" strokeWidth="3" />
        </svg>
      )
    },

    // =========================================================================
    // UPPER-MID LEFT (above stats card, y = 230-310px)
    // =========================================================================
    // 7. Upper-Mid Far-Left: Arabic Noon (Orange) — Mobile Icon 1
    {
      id: 'ar-noon',
      subject: 'arabic',
      accent: 'orange',
      desktopPos: { top: 230, left: 45 },
      size: 70,
      color: 'rgba(251, 146, 60, 0.95)', // Warm Orange
      rotation: -10,
      duration: 18,
      delay: 0.3,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-1',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M75,30 Q80,60 50,75 Q20,90 20,55 C20,35 30,30 35,45" />
          <circle cx="48" cy="38" r="5.5" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    // 8. Upper-Mid Inner-Left: Chemistry Benzene (Green) — Desktop only
    {
      id: 'chem-benzene',
      subject: 'chemistry',
      accent: 'green',
      desktopPos: { top: 300, left: 210 },
      size: 68,
      color: 'rgba(16, 185, 129, 0.95)', // Jade Green
      rotation: 5,
      duration: 26,
      delay: 2.0,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" />
          <polygon points="50,23 74,37 74,63 50,77 26,63 26,37" strokeWidth="1" strokeDasharray="4 2" />
        </svg>
      )
    },

    // =========================================================================
    // LOWER-MID LEFT (below stats card, y = 915-955px)
    // =========================================================================
    // 9. Lower Far-Left: Physics Atom (Pink) — Mobile Icon 3
    {
      id: 'phys-atom',
      subject: 'physics',
      accent: 'pink',
      desktopPos: { top: 915, left: 45 },
      size: 72,
      color: 'rgba(244, 114, 182, 0.95)', // Rose Pink
      rotation: 25,
      duration: 25,
      delay: 1.5,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-3',
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.0">
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(30, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(90, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(150, 50, 50)" />
          <circle cx="50" cy="50" r="7.5" fill="currentColor" />
        </svg>
      )
    },
    // 10. Lower Mid-Left: Biology DNA Helix (Cyan) — Desktop only
    {
      id: 'bio-dna',
      subject: 'biology',
      accent: 'cyan',
      desktopPos: { top: 955, left: 220 },
      size: 70,
      color: 'rgba(45, 212, 191, 0.95)', // Teal
      rotation: 35,
      duration: 24,
      delay: 1.4,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M20,20 Q35,50 50,50 T80,80" />
          <path d="M20,80 Q35,50 50,50 T80,20" />
          <line x1="28" y1="32" x2="28" y2="68" />
          <line x1="40" y1="42" x2="40" y2="58" />
          <line x1="60" y1="58" x2="60" y2="42" />
          <line x1="72" y1="68" x2="72" y2="32" />
        </svg>
      )
    },
    // 11. Lower Inner-Left: History Column (Purple) — Desktop only
    {
      id: 'hist-column',
      subject: 'history',
      accent: 'purple',
      desktopPos: { top: 915, left: 400 },
      size: 70,
      color: 'rgba(192, 132, 252, 0.95)', // Soft Purple
      rotation: -10,
      duration: 27,
      delay: 2.2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M25,20 L75,20 M30,20 L30,80 M40,20 L40,80 M50,20 L50,80 M60,20 L60,80 M70,20 L70,80 M25,80 L75,80 M20,85 L80,85" />
        </svg>
      )
    },

    // =========================================================================
    // BOTTOM RIGHT (below trust badges, y = 1040px)
    // =========================================================================
    // 12. Bottom Right: Student Notebook (Blue) — Desktop only
    {
      id: 'student-notebook',
      subject: 'notebook',
      accent: 'blue',
      desktopPos: { top: 1040, right: 180 },
      size: 66,
      color: 'rgba(129, 140, 248, 0.95)', // Indigo
      rotation: -14,
      duration: 25,
      delay: 1.8,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="15" width="55" height="70" rx="5" />
          <line x1="25" y1="30" x2="15" y2="30" strokeWidth="3" />
          <line x1="25" y1="45" x2="15" y2="45" strokeWidth="3" />
          <line x1="25" y1="60" x2="15" y2="60" strokeWidth="3" />
          <line x1="38" y1="30" x2="70" y2="30" />
          <line x1="38" y1="45" x2="70" y2="45" />
          <line x1="38" y1="60" x2="70" y2="60" />
        </svg>
      )
    }
  ]

  // Subtle drifting glowing background ambient specks (12 total for clean spacious atmosphere)
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: `p-${i}`,
    left: (i * 8.3 + 4) % 94,
    top: ((i * 17) + 8) % 88,
    size: (i % 3) + 3,
    delay: (i * 0.7) % 6,
    duration: (i % 4) + 12,
    driftX: ((i % 2 === 0 ? 1 : -1) * 30)
  }))

  return (
    <div className="edu-hero-container">
      
      {/* Self-contained cross-device hardware accelerated styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        .edu-hero-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 1120px;
          overflow: hidden;
          pointer-events: none;
          user-select: none;
          z-index: 0;
          background: radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.08) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(236, 72, 153, 0.05) 0%, transparent 50%);
        }
        @media (max-width: 767px) {
          .edu-hero-container {
            height: 1650px;
          }
        }

        @keyframes eduFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--base-rot)); -webkit-transform: translate3d(0, 0, 0) rotate(var(--base-rot)); }
          50% { transform: translate3d(0, -16px, 0) rotate(calc(var(--base-rot) + 5deg)); -webkit-transform: translate3d(0, -16px, 0) rotate(calc(var(--base-rot) + 5deg)); }
        }
        @keyframes eduBreathe {
          0%, 100% { opacity: 0.88; transform: scale(0.98); }
          50% { opacity: 1.0; transform: scale(1.02); }
        }
        @keyframes particleDrift {
          0% { transform: translate3d(0, 0, 0); -webkit-transform: translate3d(0, 0, 0); opacity: 0; }
          20% { opacity: 0.75; }
          80% { opacity: 0.75; }
          100% { transform: translate3d(var(--drift), -140px, 0); -webkit-transform: translate3d(var(--drift), -140px, 0); opacity: 0; }
        }
        .edu-float-box {
          animation: eduFloat var(--float-dur) infinite ease-in-out;
          -webkit-animation: eduFloat var(--float-dur) infinite ease-in-out;
          animation-delay: var(--float-delay);
          will-change: transform;
        }
        .edu-breathe-element {
          animation: eduBreathe 6s infinite ease-in-out;
          -webkit-animation: eduBreathe 6s infinite ease-in-out;
          animation-delay: var(--float-delay);
        }
        .glow-particle {
          animation: particleDrift var(--part-dur) infinite linear;
          -webkit-animation: particleDrift var(--part-dur) infinite linear;
          animation-delay: var(--part-delay);
        }
        .luminous-glass-card {
          width: 100%;
          height: 100%;
          border-radius: 1.25rem;
          padding: 0.75rem;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        /* ----------------------------------------------------
           6 TASTEFUL CHROMATIC ACCENTS (Subtle, Not Neon)
           ---------------------------------------------------- */
        /* 1. Purple / Violet */
        .glass-accent-purple.dark-glass,
        html:not(.light-theme) .glass-accent-purple {
          background: linear-gradient(135deg, rgba(49, 46, 129, 0.55) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(139, 92, 246, 0.25) 100%) !important;
          border: 1.5px solid rgba(167, 139, 250, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(139, 92, 246, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-purple.light-glass,
        html.light-theme .glass-accent-purple {
          background: linear-gradient(135deg, rgba(245, 243, 255, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(139, 92, 246, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(139, 92, 246, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* 2. Orange / Amber */
        .glass-accent-orange.dark-glass,
        html:not(.light-theme) .glass-accent-orange {
          background: linear-gradient(135deg, rgba(120, 53, 15, 0.5) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(245, 158, 11, 0.25) 100%) !important;
          border: 1.5px solid rgba(251, 146, 60, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(245, 158, 11, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-orange.light-glass,
        html.light-theme .glass-accent-orange {
          background: linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(245, 158, 11, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(245, 158, 11, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* 3. Green / Emerald */
        .glass-accent-green.dark-glass,
        html:not(.light-theme) .glass-accent-green {
          background: linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(16, 185, 129, 0.25) 100%) !important;
          border: 1.5px solid rgba(52, 211, 153, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(16, 185, 129, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-green.light-glass,
        html.light-theme .glass-accent-green {
          background: linear-gradient(135deg, rgba(236, 253, 245, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(16, 185, 129, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(16, 185, 129, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* 4. Cyan / Teal */
        .glass-accent-cyan.dark-glass,
        html:not(.light-theme) .glass-accent-cyan {
          background: linear-gradient(135deg, rgba(22, 78, 99, 0.5) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(6, 182, 212, 0.25) 100%) !important;
          border: 1.5px solid rgba(34, 211, 238, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(6, 182, 212, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-cyan.light-glass,
        html.light-theme .glass-accent-cyan {
          background: linear-gradient(135deg, rgba(236, 254, 255, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(6, 182, 212, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(6, 182, 212, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* 5. Pink / Rose */
        .glass-accent-pink.dark-glass,
        html:not(.light-theme) .glass-accent-pink {
          background: linear-gradient(135deg, rgba(131, 24, 67, 0.5) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(236, 72, 153, 0.25) 100%) !important;
          border: 1.5px solid rgba(244, 114, 182, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(236, 72, 153, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-pink.light-glass,
        html.light-theme .glass-accent-pink {
          background: linear-gradient(135deg, rgba(253, 242, 248, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(236, 72, 153, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(236, 72, 153, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* 6. Blue / Sky */
        .glass-accent-blue.dark-glass,
        html:not(.light-theme) .glass-accent-blue {
          background: linear-gradient(135deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(59, 130, 246, 0.25) 100%) !important;
          border: 1.5px solid rgba(96, 165, 250, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(59, 130, 246, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-blue.light-glass,
        html.light-theme .glass-accent-blue {
          background: linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(59, 130, 246, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(59, 130, 246, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        .luminous-icon-glow {
          filter: drop-shadow(0 0 6px currentColor);
          -webkit-filter: drop-shadow(0 0 6px currentColor);
        }

        /* Mobile-only perimeter positioning & hardware-safe rendering (< 768px) */
        @media (max-width: 767px) {
          .edu-mob-card {
            display: block !important;
            position: absolute !important;
            width: 42px !important;
            height: 42px !important;
            transform: none !important;
            -webkit-transform: none !important;
            transition: none !important;
            will-change: auto !important;
            pointer-events: none !important;
            z-index: 0 !important;
          }
          /* EXACTLY 6 curated icons on mobile placed strictly in verified negative space */
          /* Icon 0 (Purple Math Tri): Top Left between navbar & ticker */
          .edu-mob-pos-0 { left: 14px !important; right: auto !important; top: 92px !important; }
          /* Icon 1 (Orange Arabic Noon): Top Right between navbar & ticker */
          .edu-mob-pos-1 { right: 14px !important; left: auto !important; top: 92px !important; }
          /* Icon 2 (Green Chemistry Flask): Upper Left beside H1 line 1 (left empty zone) */
          .edu-mob-pos-2 { left: 14px !important; right: auto !important; top: 245px !important; }
          /* Icon 3 (Pink Physics Atom): Mid Left beside H1 line 4 (70px above paragraph) */
          .edu-mob-pos-3 { left: 14px !important; right: auto !important; top: 360px !important; }
          /* Icon 4 (Cyan Geography Globe): Lower Right between trust badges and stats card */
          .edu-mob-pos-4 { right: 18px !important; left: auto !important; top: 1075px !important; }
          /* Icon 5 (Blue CS Laptop): Bottom Left below stats card in section padding */
          .edu-mob-pos-5 { left: 18px !important; right: auto !important; top: 1548px !important; }

          @keyframes eduFloatMobile {
            0%, 100% {
              transform: translateY(0px) rotate(var(--base-rot));
              -webkit-transform: translateY(0px) rotate(var(--base-rot));
            }
            50% {
              transform: translateY(-6px) rotate(calc(var(--base-rot) + 3deg));
              -webkit-transform: translateY(-6px) rotate(calc(var(--base-rot) + 3deg));
            }
          }
          .edu-mob-card .edu-float-box {
            animation: eduFloatMobile var(--float-dur) infinite ease-in-out !important;
            -webkit-animation: eduFloatMobile var(--float-dur) infinite ease-in-out !important;
            will-change: transform;
          }
          .edu-mob-card .luminous-glass-card {
            border-radius: 0.8rem !important;
            padding: 0.38rem !important;
          }
        }
      `}} />

      {/* 12 KNOWLEDGE NODES WITH INDEPENDENT PARALLAX + FLOAT */}
      <div className="absolute inset-0 w-full h-full">
        {elements.map((el) => {
          const factor = el.layer === 1 ? 14 : el.layer === 2 ? 24 : 36
          const pxTransX = mousePos.x * factor
          const pxTransY = mousePos.y * factor
          const isMobile = !!el.mobileClass

          return (
            <div
              key={el.id}
              className={isMobile ? `${el.mobileClass} edu-hero-node` : 'hidden md:block edu-hero-node'}
              style={{
                position: 'absolute',
                top: `${el.desktopPos.top}px`,
                left: el.desktopPos.left !== undefined ? `${el.desktopPos.left}px` : undefined,
                right: el.desktopPos.right !== undefined ? `${el.desktopPos.right}px` : undefined,
                width: `${el.size}px`,
                height: `${el.size}px`,
                transform: `translate3d(${pxTransX}px, ${pxTransY}px, 0)`,
                WebkitTransform: `translate3d(${pxTransX}px, ${pxTransY}px, 0)`,
                transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), -webkit-transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'transform',
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: el.layer,
              }}
            >
              <div
                className="edu-float-box w-full h-full"
                style={{
                  '--base-rot': `${el.rotation}deg`,
                  '--float-dur': `${el.duration}s`,
                  '--float-delay': `${el.delay}s`,
                } as any}
              >
                <div className={`luminous-glass-card glass-accent-${el.accent} ${theme === 'light' ? 'light-glass' : 'dark-glass'}`}>
                  <div 
                    className="w-full h-full edu-breathe-element flex items-center justify-center luminous-icon-glow"
                    style={{ color: el.color }}
                  >
                    {el.svg}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* SUBTLE DRIFTING PARTICLES */}
      <div className="absolute inset-0 w-full h-full opacity-60">
        {particles.map((p) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: 'radial-gradient(circle, rgba(129,140,248,0.7) 0%, rgba(129,140,248,0) 70%)',
            boxShadow: '0 0 6px rgba(129, 140, 248, 0.4)',
            borderRadius: '50%',
            '--part-dur': `${p.duration}s`,
            '--part-delay': `${p.delay}s`,
            '--drift': `${p.driftX}px`
          } as any

          return (
            <div key={p.id} style={style} className="glow-particle" />
          )
        })}
      </div>

    </div>
  )
}
