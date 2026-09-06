import React from 'react'
import { useThemeStore } from '../../store/themeStore'

interface EducationalElement {
  id: string
  subject: string
  accent: 'purple' | 'orange' | 'green' | 'cyan' | 'pink' | 'blue'
  desktopPos: { top: number; left?: number; right?: number }
  size: number
  rotation: number
  duration: number
  delay: number
  layer: 1 | 2 | 3
  mobileClass?: string
  renderSvg: (color: string) => React.ReactNode
}

// Saturated, theme-optimized educational accent color palette
// Directly passed to SVG vector strokes and fills for 100% WebKit/iOS Safari reliability
const ACCENT_PALETTE: Record<'purple' | 'orange' | 'green' | 'cyan' | 'pink' | 'blue', { dark: string; light: string }> = {
  purple: {
    dark: '#c084fc', // purple-400 (vibrant lavender)
    light: '#7c3aed', // purple-600 (rich royal purple)
  },
  orange: {
    dark: '#fb923c', // orange-400 (vibrant amber)
    light: '#ea580c', // orange-600 (deep warm orange)
  },
  green: {
    dark: '#34d399', // emerald-400 (vibrant emerald)
    light: '#059669', // emerald-600 (deep emerald)
  },
  cyan: {
    dark: '#22d3ee', // cyan-400 (electric cyan)
    light: '#0891b2', // cyan-600 (deep ocean cyan)
  },
  pink: {
    dark: '#f472b6', // pink-400 (vibrant rose pink)
    light: '#db2777', // pink-600 (rich rose)
  },
  blue: {
    dark: '#60a5fa', // blue-400 (vibrant sky blue)
    light: '#2563eb', // blue-600 (royal blue)
  },
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
      rotation: 14,
      duration: 19,
      delay: 0,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-0',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <polygon points="18,82 82,82 82,18" />
          <path d="M74,82 L74,74 L82,74" />
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
      rotation: 10,
      duration: 21,
      delay: 1.2,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <path d="M16,26 Q35,32 50,24 Q65,32 84,26 L84,74 Q65,80 50,72 Q35,80 16,74 Z" />
          <path d="M50,24 L50,72" />
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
      rotation: -12,
      duration: 23,
      delay: 0.9,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-4',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.0" className="edu-svg-icon">
          <circle cx="50" cy="50" r="34" />
          <ellipse cx="50" cy="50" rx="34" ry="13" />
          <ellipse cx="50" cy="50" rx="13" ry="34" />
          <line x1="16" y1="50" x2="84" y2="50" />
          <line x1="50" y1="16" x2="50" y2="84" />
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
      rotation: -8,
      duration: 17,
      delay: 0.8,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <path d="M22,30 L78,30 M36,30 Q36,70 30,70 M44,30 L44,70 M62,30 Q62,70 70,70" />
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
      rotation: 10,
      duration: 21,
      delay: 0.6,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-2',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <path d="M42,20 L42,35 L20,78 Q17,84 23,84 L77,84 Q83,84 80,78 L58,35 L58,20" />
          <path d="M38,20 L62,20" />
          <path d="M28,68 L72,68" strokeDasharray="4 3" />
          <circle cx="44" cy="55" r="3.5" fill={color} stroke="none" />
          <circle cx="56" cy="62" r="2.5" fill={color} stroke="none" />
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
      rotation: -10,
      duration: 22,
      delay: 1.0,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-5',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <rect x="24" y="24" width="52" height="36" rx="3" />
          <path d="M14,66 L86,66 L80,74 L20,74 Z" />
          <line x1="44" y1="66" x2="56" y2="66" strokeWidth="3.5" />
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
      rotation: -10,
      duration: 18,
      delay: 0.3,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-1',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.4" strokeLinecap="round" className="edu-svg-icon">
          <path d="M75,30 Q80,62 50,76 Q20,90 20,55 C20,35 30,30 35,45" />
          <circle cx="48" cy="38" r="5.5" fill={color} stroke="none" />
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
      rotation: 5,
      duration: 26,
      delay: 2.0,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinejoin="round" className="edu-svg-icon">
          <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" />
          <polygon points="50,24 73,37 73,63 50,76 27,63 27,37" strokeWidth="1.8" strokeDasharray="5 3" />
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
      rotation: 25,
      duration: 25,
      delay: 1.5,
      layer: 2,
      mobileClass: 'edu-mob-card edu-mob-pos-3',
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="2.8" className="edu-svg-icon">
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(30, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(90, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(150, 50, 50)" />
          <circle cx="50" cy="50" r="7" fill={color} stroke="none" />
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
      rotation: 35,
      duration: 24,
      delay: 1.4,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" className="edu-svg-icon">
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
      rotation: -10,
      duration: 27,
      delay: 2.2,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" className="edu-svg-icon">
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
      rotation: -14,
      duration: 25,
      delay: 1.8,
      layer: 1,
      renderSvg: (color) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" fill="none" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="edu-svg-icon">
          <rect x="25" y="15" width="55" height="70" rx="5" />
          <line x1="25" y1="30" x2="15" y2="30" strokeWidth="3.5" />
          <line x1="25" y1="45" x2="15" y2="45" strokeWidth="3.5" />
          <line x1="25" y1="60" x2="15" y2="60" strokeWidth="3.5" />
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
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
        }
        .glow-particle {
          animation: particleDrift var(--part-dur) infinite linear;
          -webkit-animation: particleDrift var(--part-dur) infinite linear;
          animation-delay: var(--part-delay);
        }

        /* Glass Card Base */
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
          position: relative;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        /* Dedicated Hardware-Accelerated Vector Host (Immune to WebKit culling/collapse) */
        .edu-icon-host {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 5;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          pointer-events: none;
          overflow: visible;
        }

        /* Direct SVG rendering rules */
        .edu-svg-icon {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          display: block !important;
          overflow: visible !important;
          pointer-events: none !important;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }

        /* ----------------------------------------------------
           6 TASTEFUL CHROMATIC ACCENTS (Subtle, Not Neon)
           ---------------------------------------------------- */
        /* 1. Purple / Violet */
        .glass-accent-purple.dark-glass,
        html:not(.light-theme) .glass-accent-purple {
          background: linear-gradient(135deg, rgba(49, 46, 129, 0.55) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(139, 92, 246, 0.25) 100%) !important;
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
          background: linear-gradient(135deg, rgba(120, 53, 15, 0.5) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(245, 158, 11, 0.25) 100%) !important;
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
          background: linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(16, 185, 129, 0.25) 100%) !important;
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
          background: linear-gradient(135deg, rgba(22, 78, 99, 0.5) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(6, 182, 212, 0.25) 100%) !important;
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
          background: linear-gradient(135deg, rgba(131, 24, 67, 0.5) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(236, 72, 153, 0.25) 100%) !important;
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
          background: linear-gradient(135deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(59, 130, 246, 0.25) 100%) !important;
          border: 1.5px solid rgba(96, 165, 250, 0.5) !important;
          box-shadow: 0 6px 22px -2px rgba(59, 130, 246, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.25) !important;
        }
        .glass-accent-blue.light-glass,
        html.light-theme .glass-accent-blue {
          background: linear-gradient(135deg, rgba(239, 246, 255, 0.95) 0%, rgba(255, 255, 255, 0.96) 100%) !important;
          border: 1.5px solid rgba(59, 130, 246, 0.42) !important;
          box-shadow: 0 4px 18px -2px rgba(59, 130, 246, 0.22), inset 0 1px 2px rgba(255, 255, 255, 0.95) !important;
        }

        /* Mobile-only perimeter positioning & WebKit/iOS Safari-safe rendering (< 768px) */
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
            z-index: 1 !important;
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

          /* Mobile glass cards: disable backdrop-filter to prevent WebKit vector dropping */
          .edu-mob-card .luminous-glass-card {
            border-radius: 0.85rem !important;
            padding: 0.42rem !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* Solid semi-opaque backgrounds for flawless rendering on all mobile iOS Safari devices */
          html:not(.light-theme) .edu-mob-card .glass-accent-purple,
          .edu-mob-card .glass-accent-purple.dark-glass {
            background: linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-purple,
          .edu-mob-card .glass-accent-purple.light-glass {
            background: linear-gradient(135deg, rgba(245, 243, 255, 0.98) 0%, rgba(238, 242, 255, 0.98) 100%) !important;
          }

          html:not(.light-theme) .edu-mob-card .glass-accent-orange,
          .edu-mob-card .glass-accent-orange.dark-glass {
            background: linear-gradient(135deg, rgba(67, 20, 7, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-orange,
          .edu-mob-card .glass-accent-orange.light-glass {
            background: linear-gradient(135deg, rgba(255, 251, 235, 0.98) 0%, rgba(254, 243, 199, 0.98) 100%) !important;
          }

          html:not(.light-theme) .edu-mob-card .glass-accent-green,
          .edu-mob-card .glass-accent-green.dark-glass {
            background: linear-gradient(135deg, rgba(6, 78, 59, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-green,
          .edu-mob-card .glass-accent-green.light-glass {
            background: linear-gradient(135deg, rgba(236, 253, 245, 0.98) 0%, rgba(209, 250, 229, 0.98) 100%) !important;
          }

          html:not(.light-theme) .edu-mob-card .glass-accent-cyan,
          .edu-mob-card .glass-accent-cyan.dark-glass {
            background: linear-gradient(135deg, rgba(22, 78, 99, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-cyan,
          .edu-mob-card .glass-accent-cyan.light-glass {
            background: linear-gradient(135deg, rgba(236, 254, 255, 0.98) 0%, rgba(207, 250, 254, 0.98) 100%) !important;
          }

          html:not(.light-theme) .edu-mob-card .glass-accent-pink,
          .edu-mob-card .glass-accent-pink.dark-glass {
            background: linear-gradient(135deg, rgba(76, 5, 25, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-pink,
          .edu-mob-card .glass-accent-pink.light-glass {
            background: linear-gradient(135deg, rgba(253, 242, 248, 0.98) 0%, rgba(252, 231, 243, 0.98) 100%) !important;
          }

          html:not(.light-theme) .edu-mob-card .glass-accent-blue,
          .edu-mob-card .glass-accent-blue.dark-glass {
            background: linear-gradient(135deg, rgba(30, 58, 138, 0.95) 0%, rgba(15, 23, 42, 0.96) 100%) !important;
          }
          html.light-theme .edu-mob-card .glass-accent-blue,
          .edu-mob-card .glass-accent-blue.light-glass {
            background: linear-gradient(135deg, rgba(239, 246, 255, 0.98) 0%, rgba(219, 234, 254, 0.98) 100%) !important;
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
          const activeColor = theme === 'light' ? ACCENT_PALETTE[el.accent].light : ACCENT_PALETTE[el.accent].dark

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
                  <div className="edu-icon-host">
                    {el.renderSvg(activeColor)}
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
