import React from 'react'

interface EducationalElement {
  id: string
  subject: string
  left?: number
  top?: number
  right?: number
  bottom?: number
  size: number
  color: string // pastel color
  rotation: number
  duration: number
  delay: number
  layer: 1 | 2 | 3
  svg: React.ReactNode
}

export default function EducationalHeroBackground() {
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

  const elements: EducationalElement[] = [
    // === TOP LEFT ZONE ===
    {
      id: 'math-tri',
      subject: 'math',
      left: 3,
      top: 5,
      size: 72,
      color: 'rgba(129, 140, 248, 0.42)', // Indigo
      rotation: 15,
      duration: 18,
      delay: 0,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="15,85 85,85 85,15" />
          <path d="M78,85 L78,78 L85,78" />
        </svg>
      )
    },
    {
      id: 'math-pi',
      subject: 'math',
      left: 15,
      top: 8,
      size: 58,
      color: 'rgba(96, 165, 250, 0.45)', // Blue
      rotation: -10,
      duration: 15,
      delay: 1.5,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M25,30 L75,30 M35,30 Q35,70 30,70 M42,30 L42,70 M60,30 Q60,70 68,70" />
        </svg>
      )
    },
    {
      id: 'math-ruler',
      subject: 'math',
      left: 25,
      top: 4,
      size: 68,
      color: 'rgba(79, 70, 229, 0.38)', // Indigo dark
      rotation: -25,
      duration: 22,
      delay: 1,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="15" y="42" width="70" height="18" rx="2" />
          <line x1="25" y1="42" x2="25" y2="47" />
          <line x1="35" y1="42" x2="35" y2="50" />
          <line x1="45" y1="42" x2="45" y2="47" />
          <line x1="55" y1="42" x2="55" y2="50" />
          <line x1="65" y1="42" x2="65" y2="47" />
          <line x1="75" y1="42" x2="75" y2="50" />
        </svg>
      )
    },

    // === MIDDLE LEFT ZONE ===
    {
      id: 'math-integral',
      subject: 'math',
      left: 2,
      top: 22,
      size: 62,
      color: 'rgba(139, 92, 246, 0.42)', // Violet
      rotation: 5,
      duration: 20,
      delay: 0.5,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M60,20 C50,20 45,28 45,38 L45,62 C45,72 40,80 30,80" />
          <text x="58" y="55" fontSize="18" fontFamily="serif" fontStyle="italic" fill="currentColor" stroke="none">dx</text>
        </svg>
      )
    },
    {
      id: 'math-geometry',
      subject: 'math',
      left: 12,
      top: 28,
      size: 68,
      color: 'rgba(167, 139, 250, 0.4)', // Purple
      rotation: 12,
      duration: 24,
      delay: 2,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="30" />
          <polygon points="50,20 80,70 20,70" />
        </svg>
      )
    },
    {
      id: 'math-calc',
      subject: 'math',
      left: 24,
      top: 20,
      size: 68,
      color: 'rgba(129, 140, 248, 0.38)',
      rotation: -8,
      duration: 19,
      delay: 3,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="15" width="50" height="70" rx="6" />
          <rect x="33" y="25" width="34" height="16" rx="2" />
          <circle cx="38" cy="54" r="3.5" fill="currentColor" />
          <circle cx="50" cy="54" r="3.5" fill="currentColor" />
          <circle cx="62" cy="54" r="3.5" fill="currentColor" />
          <circle cx="38" cy="68" r="3.5" fill="currentColor" />
          <circle cx="50" cy="68" r="3.5" fill="currentColor" />
          <circle cx="62" cy="68" r="3.5" fill="currentColor" />
        </svg>
      )
    },

    // === LOWER LEFT ZONE ===
    {
      id: 'phys-atom',
      subject: 'physics',
      left: 2,
      top: 45,
      size: 78,
      color: 'rgba(244, 63, 94, 0.42)', // Rose
      rotation: 30,
      duration: 25,
      delay: 1.5,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.0">
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(30, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(90, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="14" transform="rotate(150, 50, 50)" />
          <circle cx="50" cy="50" r="7.5" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'phys-emc2',
      subject: 'physics',
      left: 14,
      top: 48,
      size: 72,
      color: 'rgba(251, 113, 133, 0.4)', // Rose light
      rotation: -5,
      duration: 17,
      delay: 3.2,
      layer: 3,
      svg: (
        <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M10,25 L30,25 M10,25 L10,55 M10,38 L25,38 M10,55 L30,55" />
          <path d="M38,38 L50,38 M38,45 L50,45" />
          <path d="M58,55 L58,35 Q64,27 70,35 L70,55" />
          <path d="M90,35 A10,10 0 1 0 90,55" />
          <path d="M102,25 Q105,20 108,25 T102,35 L108,35" strokeWidth="1.8" />
        </svg>
      )
    },
    {
      id: 'phys-wave',
      subject: 'physics',
      left: 25,
      top: 40,
      size: 62,
      color: 'rgba(244, 63, 94, 0.38)',
      rotation: 10,
      duration: 21,
      delay: 2.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M10,50 Q25,20 40,50 T70,50 T100,50" />
        </svg>
      )
    },

    // === BOTTOM LEFT ZONE ===
    {
      id: 'bio-dna',
      subject: 'biology',
      left: 3,
      top: 66,
      size: 72,
      color: 'rgba(45, 212, 191, 0.42)', // Teal
      rotation: 40,
      duration: 23,
      delay: 4,
      layer: 2,
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
    {
      id: 'chem-benzene',
      subject: 'chemistry',
      left: 12,
      top: 72,
      size: 78,
      color: 'rgba(16, 185, 129, 0.4)', // Emerald
      rotation: 0,
      duration: 26,
      delay: 1.2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
          <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" />
          <polygon points="50,23 74,37 74,63 50,77 26,63 26,37" strokeWidth="1" strokeDasharray="4 2" />
        </svg>
      )
    },
    {
      id: 'bio-microscope',
      subject: 'biology',
      left: 24,
      top: 64,
      size: 68,
      color: 'rgba(20, 184, 166, 0.38)', // Teal dark
      rotation: -5,
      duration: 22,
      delay: 3,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30,80 L70,80 M50,80 L50,70 M50,70 C35,70 30,55 35,45 M35,45 L45,25 M32,22 L42,17 M48,22 L38,42 M55,30 A12,12 0 0,0 67,42" />
        </svg>
      )
    },
    {
      id: 'chem-flask',
      subject: 'chemistry',
      left: 8,
      top: 84,
      size: 68,
      color: 'rgba(52, 211, 153, 0.42)', // Emerald light
      rotation: 12,
      duration: 20,
      delay: 0.5,
      layer: 2,
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
    {
      id: 'math-graph',
      subject: 'math',
      left: 20,
      top: 82,
      size: 68,
      color: 'rgba(45, 212, 191, 0.38)',
      rotation: 8,
      duration: 24,
      delay: 1.8,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="15" y1="85" x2="85" y2="85" />
          <line x1="15" y1="15" x2="15" y2="85" />
          <path d="M15,25 Q50,80 85,25" />
        </svg>
      )
    },

    // === TOP RIGHT ZONE ===
    {
      id: 'ar-noon',
      subject: 'arabic',
      right: 3,
      top: 5,
      size: 72,
      color: 'rgba(245, 158, 11, 0.45)', // Amber
      rotation: -10,
      duration: 17,
      delay: 0.2,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M75,30 Q80,60 50,75 Q20,90 20,55 C20,35 30,30 35,45" />
          <circle cx="48" cy="38" r="5.5" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    {
      id: 'ar-ain',
      subject: 'arabic',
      right: 15,
      top: 8,
      size: 58,
      color: 'rgba(251, 191, 36, 0.42)', // Amber light
      rotation: 8,
      duration: 20,
      delay: 1.2,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M65,25 C65,15 45,15 45,30 C45,40 60,40 55,55 C45,80 15,70 25,50" />
        </svg>
      )
    },
    {
      id: 'ar-book',
      subject: 'arabic',
      right: 25,
      top: 4,
      size: 68,
      color: 'rgba(217, 119, 6, 0.38)', // Orange
      rotation: 12,
      duration: 21,
      delay: 0.8,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15,25 Q35,30 50,22 Q65,30 85,25 L85,75 Q65,80 50,70 Q35,80 15,75 Z" />
          <path d="M50,22 L50,70" />
        </svg>
      )
    },

    // === MIDDLE RIGHT ZONE ===
    {
      id: 'eng-abc',
      subject: 'english',
      right: 2,
      top: 22,
      size: 62,
      color: 'rgba(59, 130, 246, 0.45)', // Blue
      rotation: -8,
      duration: 18,
      delay: 2.8,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18,55 L28,25 L38,55 M22,45 L34,45" />
          <path d="M48,25 L48,55 M48,25 Q58,25 55,40 Q62,40 56,55 L48,55" />
          <path d="M82,32 Q70,22 70,40 T82,48" />
        </svg>
      )
    },
    {
      id: 'eng-cap',
      subject: 'english',
      right: 12,
      top: 28,
      size: 72,
      color: 'rgba(96, 165, 250, 0.42)', // Sky
      rotation: 5,
      duration: 23,
      delay: 1.6,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 L90,30 L50,45 L10,30 Z M25,36 L25,65 Q50,75 75,65 L75,36 M90,30 L90,60" />
        </svg>
      )
    },
    {
      id: 'eng-pencil',
      subject: 'english',
      right: 24,
      top: 20,
      size: 58,
      color: 'rgba(30, 64, 175, 0.38)', // Dark Blue
      rotation: 45,
      duration: 25,
      delay: 0.5,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20,70 L25,80 L35,75 L30,65 Z M30,65 L75,20 L80,25 L35,75 M75,20 L80,25" />
        </svg>
      )
    },

    // === LOWER RIGHT ZONE ===
    {
      id: 'geo-globe',
      subject: 'geography',
      right: 2,
      top: 45,
      size: 78,
      color: 'rgba(6, 182, 212, 0.45)', // Cyan
      rotation: 15,
      duration: 26,
      delay: 3.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.0">
          <circle cx="50" cy="50" r="35" />
          <ellipse cx="50" cy="50" rx="35" ry="12" />
          <ellipse cx="50" cy="50" rx="12" ry="35" />
          <line x1="15" y1="50" x2="85" y2="50" />
          <line x1="50" y1="15" x2="50" y2="85" />
        </svg>
      )
    },
    {
      id: 'geo-compass',
      subject: 'geography',
      right: 14,
      top: 48,
      size: 68,
      color: 'rgba(34, 211, 238, 0.42)', // Cyan light
      rotation: 45,
      duration: 21,
      delay: 1,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="50" cy="50" r="35" />
          <path d="M50,15 L55,45 L85,50 L55,55 L50,85 L45,55 L15,50 L45,45 Z" />
          <polygon points="50,15 50,50 55,45" fill="currentColor" stroke="none" />
          <polygon points="50,85 50,50 45,55" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    {
      id: 'geo-pin',
      subject: 'geography',
      right: 25,
      top: 40,
      size: 62,
      color: 'rgba(8, 145, 178, 0.38)', // Cyan dark
      rotation: 0,
      duration: 24,
      delay: 2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 C35,15 25,25 25,40 C25,62 50,85 50,85 C50,85 75,62 75,40 C75,25 65,15 50,15 Z" />
          <circle cx="50" cy="40" r="9" />
        </svg>
      )
    },

    // === BOTTOM RIGHT ZONE ===
    {
      id: 'hist-column',
      subject: 'history',
      right: 3,
      top: 66,
      size: 72,
      color: 'rgba(168, 85, 247, 0.42)', // Purple
      rotation: -12,
      duration: 28,
      delay: 4.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M25,20 L75,20 M30,20 L30,80 M40,20 L40,80 M50,20 L50,80 M60,20 L60,80 M70,20 L70,80 M25,80 L75,80 M20,85 L80,85" />
        </svg>
      )
    },
    {
      id: 'hist-hourglass',
      subject: 'history',
      right: 12,
      top: 72,
      size: 68,
      color: 'rgba(192, 132, 252, 0.4)', // Purple light
      rotation: 18,
      duration: 25,
      delay: 0.3,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30,20 L70,20 M30,80 L70,80 M35,20 Q35,45 50,50 Q65,45 65,25 M35,80 Q35,55 50,50 Q65,55 65,75" />
        </svg>
      )
    },
    {
      id: 'cs-circuit',
      subject: 'cs',
      right: 24,
      top: 64,
      size: 72,
      color: 'rgba(99, 102, 241, 0.42)', // Indigo CS
      rotation: 90,
      duration: 20,
      delay: 1.8,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M15,50 L45,50 L45,20 L85,20" />
          <circle cx="15" cy="50" r="5" fill="currentColor" stroke="none" />
          <circle cx="85" cy="20" r="5" fill="currentColor" stroke="none" />
          <circle cx="45" cy="35" r="4" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    {
      id: 'cs-laptop',
      subject: 'cs',
      right: 8,
      top: 84,
      size: 68,
      color: 'rgba(139, 92, 246, 0.4)', // Violet CS
      rotation: -10,
      duration: 23,
      delay: 2.2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="25" width="50" height="35" rx="3" />
          <path d="M15,65 L85,65 L80,72 L20,72 Z" />
          <line x1="45" y1="65" x2="55" y2="65" strokeWidth="3" />
        </svg>
      )
    },
    {
      id: 'cs-binary',
      subject: 'cs',
      right: 20,
      top: 82,
      size: 62,
      color: 'rgba(99, 102, 241, 0.38)',
      rotation: 0,
      duration: 27,
      delay: 1,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <text x="15" y="42" fontSize="32" fontWeight="black" fill="currentColor" stroke="none">0</text>
          <text x="65" y="42" fontSize="32" fontWeight="black" fill="currentColor" stroke="none">1</text>
          <text x="15" y="82" fontSize="32" fontWeight="black" fill="currentColor" stroke="none">1</text>
          <text x="65" y="82" fontSize="32" fontWeight="black" fill="currentColor" stroke="none">0</text>
        </svg>
      )
    },

    // === LOWER BOTTOM MARGINS ===
    {
      id: 'music-note',
      subject: 'music',
      left: 32,
      top: 86,
      size: 62,
      color: 'rgba(236, 72, 153, 0.35)', // Pink
      rotation: 12,
      duration: 22,
      delay: 0.4,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="32" cy="72" r="10" fill="currentColor" />
          <circle cx="72" cy="62" r="10" fill="currentColor" />
          <line x1="42" y1="72" x2="42" y2="25" strokeWidth="2.5" />
          <line x1="82" y1="62" x2="82" y2="15" strokeWidth="2.5" />
          <path d="M42,25 L82,15" strokeWidth="4" />
        </svg>
      )
    },
    {
      id: 'student-notebook',
      subject: 'notebook',
      right: 32,
      top: 86,
      size: 62,
      color: 'rgba(16, 185, 129, 0.38)', // Emerald
      rotation: -15,
      duration: 25,
      delay: 2.8,
      layer: 2,
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

  // Drifting glowing particles
  const particles = Array.from({ length: 25 }, (_, i) => ({
    id: `p-${i}`,
    left: Math.random() * 92 + 4,
    top: Math.random() * 85 + 5,
    size: Math.random() * 5 + 3,
    delay: Math.random() * 6,
    duration: Math.random() * 9 + 6,
    driftX: (Math.random() - 0.5) * 60
  }))

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 0,
    background: 'radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 75%, rgba(236, 72, 153, 0.08) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.02) 0%, transparent 60%)',
  }

  return (
    <div style={containerStyle}>
      
      {/* Self-contained cross-device hardware accelerated styling */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes eduFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--base-rot)); -webkit-transform: translate3d(0, 0, 0) rotate(var(--base-rot)); }
          50% { transform: translate3d(0, -22px, 0) rotate(calc(var(--base-rot) + 7deg)); -webkit-transform: translate3d(0, -22px, 0) rotate(calc(var(--base-rot) + 7deg)); }
        }
        @keyframes eduBreathe {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1.0; }
        }
        @keyframes particleDrift {
          0% { transform: translate3d(0, 0, 0); -webkit-transform: translate3d(0, 0, 0); opacity: 0; }
          20% { opacity: 0.75; }
          80% { opacity: 0.75; }
          100% { transform: translate3d(var(--drift), -160px, 0); -webkit-transform: translate3d(var(--drift), -160px, 0); opacity: 0; }
        }
        .edu-float-box {
          animation: eduFloat var(--float-dur) infinite ease-in-out;
          -webkit-animation: eduFloat var(--float-dur) infinite ease-in-out;
          animation-delay: var(--float-delay);
        }
        .edu-breathe-element {
          animation: eduBreathe 5s infinite ease-in-out;
          -webkit-animation: eduBreathe 5s infinite ease-in-out;
          animation-delay: var(--float-delay);
        }
        .glow-particle {
          animation: particleDrift var(--part-dur) infinite linear;
          -webkit-animation: particleDrift var(--part-dur) infinite linear;
          animation-delay: var(--part-delay);
        }
      `}} />

      {/* B. DETAILED SUBJECT FLOATING OUTLINE ICONS */}
      <div className="absolute inset-0 w-full h-full">
        {elements.map((el) => {
          const factor = el.layer === 1 ? 12 : el.layer === 2 ? 24 : 36
          const pxTransX = mousePos.x * factor
          const pxTransY = mousePos.y * factor

          const style: React.CSSProperties = {
            position: 'absolute',
            left: el.left !== undefined ? `${el.left}%` : undefined,
            right: el.right !== undefined ? `${el.right}%` : undefined,
            top: `${el.top}%`,
            width: `${el.size}px`,
            height: `${el.size}px`,
            color: el.color,
            transform: `translate3d(${pxTransX}px, ${pxTransY}px, 0)`,
            WebkitTransform: `translate3d(${pxTransX}px, ${pxTransY}px, 0)`,
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), -webkit-transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)', 
            '--base-rot': `${el.rotation}deg`,
            '--float-dur': `${el.duration}s`,
            '--float-delay': `${el.delay}s`,
          } as any

          return (
            <div key={el.id} style={style} className="edu-float-box select-none pointer-events-none">
              <div className="w-full h-full edu-breathe-element flex items-center justify-center">
                {el.svg}
              </div>
            </div>
          )
        })}
      </div>

      {/* C. SLOW-DRIFTING GLOWING PARTICLES */}
      <div className="absolute inset-0 w-full h-full opacity-80">
        {particles.map((p) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: 'rgba(129, 140, 248, 0.35)',
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
