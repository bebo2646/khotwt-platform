import React from 'react'

interface EducationalElement {
  id: string
  subject: string
  left?: number
  top?: number
  right?: number
  bottom?: number
  size: number
  color: string // pastel hex/rgba
  rotation: number
  duration: number
  delay: number
  layer: 1 | 2 | 3 // Parallax layers: 1 = deepest, 3 = closest
  svg: React.ReactNode
}

export default function EducationalHeroBackground() {
  const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized mouse coords from -1 to 1
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2
      setMousePos({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Subject SVG drawings
  const elements: EducationalElement[] = [
    // --- MATHEMATICS (Top Left & Mid Left) ---
    {
      id: 'math-tri',
      subject: 'math',
      left: 8,
      top: 15,
      size: 65,
      color: 'rgba(129, 140, 248, 0.07)', // indigo
      rotation: 12,
      duration: 22,
      delay: 0,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="15,85 85,85 85,15" />
          <path d="M80,85 L80,80 L85,80" />
        </svg>
      )
    },
    {
      id: 'math-pi',
      subject: 'math',
      left: 18,
      top: 25,
      size: 40,
      color: 'rgba(96, 165, 250, 0.08)', // blue
      rotation: -15,
      duration: 18,
      delay: 2,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M25,30 L75,30 M35,30 Q35,70 30,70 M42,30 L42,70 M60,30 Q60,70 68,70" />
        </svg>
      )
    },
    {
      id: 'math-x2',
      subject: 'math',
      left: 5,
      top: 45,
      size: 55,
      color: 'rgba(139, 92, 246, 0.06)', // violet
      rotation: 8,
      duration: 25,
      delay: 1,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {/* x */}
          <path d="M20,35 L45,65 M45,35 L20,65" />
          {/* squared 2 */}
          <path d="M55,25 Q60,20 65,25 T55,38 L65,38" strokeWidth="1.2" />
        </svg>
      )
    },

    // --- PHYSICS (Top Mid-Left & Low Left) ---
    {
      id: 'phys-atom',
      subject: 'physics',
      left: 12,
      top: 58,
      size: 75,
      color: 'rgba(244, 63, 94, 0.06)', // rose
      rotation: 30,
      duration: 28,
      delay: 3,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2">
          <ellipse cx="50" cy="50" rx="42" ry="12" transform="rotate(30, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="12" transform="rotate(90, 50, 50)" />
          <ellipse cx="50" cy="50" rx="42" ry="12" transform="rotate(150, 50, 50)" />
          <circle cx="50" cy="50" r="6" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'phys-fma',
      subject: 'physics',
      left: 20,
      top: 80,
      size: 60,
      color: 'rgba(232, 121, 249, 0.08)', // fuchsia
      rotation: -8,
      duration: 20,
      delay: 0.5,
      layer: 3,
      svg: (
        <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          {/* F */}
          <path d="M15,20 L40,20 M15,20 L15,60 M15,38 L32,38" />
          {/* = */}
          <path d="M48,35 L60,35 M48,45 L60,45" />
          {/* m */}
          <path d="M68,60 L68,35 Q74,27 80,35 L80,60 M80,35 Q86,27 92,35 L92,60" />
          {/* a */}
          <path d="M106,60 A6,6 0 1 1 106,48 Z M106,48 L106,60" />
        </svg>
      )
    },

    // --- CHEMISTRY (Bottom Left & Low Mid-Left) ---
    {
      id: 'chem-flask',
      subject: 'chemistry',
      left: 5,
      top: 78,
      size: 70,
      color: 'rgba(34, 197, 94, 0.07)', // green
      rotation: 18,
      duration: 24,
      delay: 4,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M42,20 L42,35 L20,78 Q17,84 23,84 L77,84 Q83,84 80,78 L58,35 L58,20" />
          <path d="M38,20 L62,20" />
          <path d="M28,68 L72,68" strokeDasharray="3 3" />
          <circle cx="44" cy="55" r="3" fill="currentColor" />
          <circle cx="56" cy="60" r="2" fill="currentColor" />
        </svg>
      )
    },
    {
      id: 'chem-benzene',
      subject: 'chemistry',
      left: 28,
      top: 15,
      size: 75,
      color: 'rgba(45, 212, 191, 0.06)', // teal
      rotation: 0,
      duration: 30,
      delay: 1.5,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
          <polygon points="50,15 80,32 80,68 50,85 20,68 20,32" />
          <polygon points="50,22 74,36 74,64 50,78 26,64 26,36" strokeWidth="1" strokeDasharray="4 2" />
        </svg>
      )
    },

    // --- BIOLOGY (Top Center-Left & Mid Left) ---
    {
      id: 'bio-dna',
      subject: 'biology',
      left: 28,
      top: 55,
      size: 65,
      color: 'rgba(16, 185, 129, 0.07)', // emerald
      rotation: 45,
      duration: 26,
      delay: 5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M20,20 Q35,50 50,50 T80,80" />
          <path d="M20,80 Q35,50 50,50 T80,20" />
          <line x1="28" y1="32" x2="28" y2="68" />
          <line x1="40" y1="42" x2="40" y2="58" />
          <line x1="60" y1="58" x2="60" y2="42" />
          <line x1="72" y1="68" x2="72" y2="32" />
        </svg>
      )
    },

    // --- ARABIC (Top Right & Mid Right) ---
    {
      id: 'ar-noon',
      subject: 'arabic',
      right: 8,
      top: 15,
      size: 65,
      color: 'rgba(245, 158, 11, 0.08)', // amber
      rotation: -10,
      duration: 21,
      delay: 0,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {/* stylized calligraphy "ن" */}
          <path d="M75,30 Q80,60 50,75 Q20,90 20,55 C20,35 30,30 35,45" />
          <circle cx="48" cy="40" r="4.5" fill="currentColor" stroke="none" />
        </svg>
      )
    },
    {
      id: 'ar-book',
      subject: 'arabic',
      right: 18,
      top: 25,
      size: 55,
      color: 'rgba(217, 119, 6, 0.06)', // orange
      rotation: 15,
      duration: 24,
      delay: 2.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15,25 Q35,30 50,22 Q65,30 85,25 L85,75 Q65,80 50,70 Q35,80 15,75 Z" />
          <path d="M50,22 L50,70" />
        </svg>
      )
    },
    {
      id: 'ar-ain',
      subject: 'arabic',
      right: 5,
      top: 45,
      size: 60,
      color: 'rgba(239, 68, 68, 0.07)', // red
      rotation: 5,
      duration: 19,
      delay: 1,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {/* stylized calligraphy "ع" */}
          <path d="M65,25 C65,15 45,15 45,30 C45,40 60,40 55,55 C45,80 15,70 25,50" />
        </svg>
      )
    },

    // --- ENGLISH (Top Mid-Right & Low Right) ---
    {
      id: 'eng-abc',
      subject: 'english',
      right: 12,
      top: 58,
      size: 60,
      color: 'rgba(59, 130, 246, 0.08)', // blue
      rotation: -12,
      duration: 27,
      delay: 3.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          {/* A */}
          <path d="M20,60 L30,25 L40,60 M24,48 L36,48" />
          {/* B */}
          <path d="M50,25 L50,60 M50,25 Q62,25 58,42 Q64,42 58,60 L50,60" />
          {/* C */}
          <path d="M85,32 Q70,22 70,42 T85,52" />
        </svg>
      )
    },
    {
      id: 'eng-envelope',
      subject: 'english',
      right: 20,
      top: 78,
      size: 55,
      color: 'rgba(14, 165, 233, 0.06)', // sky
      rotation: 8,
      duration: 23,
      delay: 0.8,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="15" y="25" width="70" height="50" rx="5" />
          <path d="M15,25 L50,55 L85,25" />
        </svg>
      )
    },

    // --- GEOGRAPHY (Bottom Right & Low Mid-Right) ---
    {
      id: 'geo-globe',
      subject: 'geography',
      right: 5,
      top: 78,
      size: 75,
      color: 'rgba(6, 182, 212, 0.08)', // cyan
      rotation: 20,
      duration: 29,
      delay: 4.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="50" cy="50" r="35" />
          <ellipse cx="50" cy="50" rx="35" ry="12" />
          <ellipse cx="50" cy="50" rx="12" ry="35" />
          <line x1="15" y1="50" x2="85" y2="50" />
          <line x1="50" y1="15" x2="50" y2="85" />
        </svg>
      )
    },
    {
      id: 'geo-pin',
      subject: 'geography',
      right: 28,
      top: 15,
      size: 55,
      color: 'rgba(20, 184, 166, 0.07)', // teal
      rotation: -5,
      duration: 22,
      delay: 1.2,
      layer: 3,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50,15 C35,15 25,25 25,40 C25,62 50,85 50,85 C50,85 75,62 75,40 C75,25 65,15 50,15 Z" />
          <circle cx="50" cy="40" r="10" />
        </svg>
      )
    },

    // --- HISTORY (Bottom Center-Right & Mid Right) ---
    {
      id: 'hist-column',
      subject: 'history',
      right: 28,
      top: 55,
      size: 65,
      color: 'rgba(168, 85, 247, 0.07)', // purple
      rotation: -18,
      duration: 25,
      delay: 5.5,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M25,20 L75,20 M30,20 L30,80 M40,20 L40,80 M50,20 L50,80 M60,20 L60,80 M70,20 L70,80 M25,80 L75,80 M20,85 L80,85" />
        </svg>
      )
    },

    // --- COMPUTER SCIENCE (Center Left & Center Right Outskirts) ---
    {
      id: 'cs-laptop',
      subject: 'cs',
      left: 32,
      top: 32,
      size: 60,
      color: 'rgba(139, 92, 246, 0.08)', // violet
      rotation: -10,
      duration: 26,
      delay: 2,
      layer: 1,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="25" y="25" width="50" height="35" rx="3" />
          <path d="M15,65 L85,65 L80,72 L20,72 Z" />
          <line x1="45" y1="65" x2="55" y2="65" strokeWidth="2.5" />
        </svg>
      )
    },
    {
      id: 'cs-circuit',
      subject: 'cs',
      right: 32,
      top: 32,
      size: 70,
      color: 'rgba(99, 102, 241, 0.07)', // indigo
      rotation: 90,
      duration: 24,
      delay: 1.8,
      layer: 2,
      svg: (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M15,50 L45,50 L45,20 L85,20" />
          <circle cx="15" cy="50" r="4.5" fill="currentColor" />
          <circle cx="85" cy="20" r="4.5" fill="currentColor" />
          <circle cx="45" cy="35" r="3.5" fill="currentColor" />
        </svg>
      )
    }
  ]

  // Generate glowing particles
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: `p-${i}`,
    left: Math.random() * 90 + 5,
    top: Math.random() * 85 + 5,
    size: Math.random() * 4 + 2,
    delay: Math.random() * 8,
    duration: Math.random() * 12 + 8,
    driftX: (Math.random() - 0.5) * 50
  }))

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none -z-10 bg-background select-none">
      
      {/* Self-contained premium animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes meshBlob1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.15); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
        }
        @keyframes meshBlob2 {
          0%, 100% { transform: translate(0px, 0px) scale(1.1); }
          50% { transform: translate(-60px, 50px) scale(0.85); }
        }
        @keyframes meshBlob3 {
          0%, 100% { transform: translate(0px, 0px) scale(0.9); }
          40% { transform: translate(50px, 40px) scale(1.1); }
          75% { transform: translate(-20px, -50px) scale(0.95); }
        }
        @keyframes eduFloat {
          0%, 100% { transform: translateY(0px) rotate(var(--base-rot)); }
          50% { transform: translateY(-16px) rotate(calc(var(--base-rot) + 6deg)); }
        }
        @keyframes eduBreathe {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1.0; }
        }
        @keyframes particleDrift {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          20% { opacity: 0.4; }
          80% { opacity: 0.4; }
          100% { transform: translateY(-120px) translateX(var(--drift)); opacity: 0; }
        }
        .animate-blob-1 {
          animation: meshBlob1 22s infinite ease-in-out;
        }
        .animate-blob-2 {
          animation: meshBlob2 28s infinite ease-in-out;
        }
        .animate-blob-3 {
          animation: meshBlob3 25s infinite ease-in-out;
        }
        .edu-float-box {
          animation: eduFloat var(--float-dur) infinite ease-in-out;
          animation-delay: var(--float-delay);
        }
        .edu-breathe-element {
          animation: eduBreathe 6s infinite ease-in-out;
          animation-delay: var(--float-delay);
        }
        .glow-particle {
          animation: particleDrift var(--part-dur) infinite linear;
          animation-delay: var(--part-delay);
        }
      `}} />

      {/* A. PREMIUM MESH GRADIENT BACKDROP (Apple/Stripe Style) */}
      <div className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen dark:mix-blend-normal">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-brand-primary/10 blur-[130px] animate-blob-1"
          style={{ transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)` }}
        />
        <div 
          className="absolute top-[25%] right-[-10%] w-[60%] h-[60%] rounded-full bg-brand-accent/8 blur-[150px] animate-blob-2"
          style={{ transform: `translate3d(${mousePos.x * -16}px, ${mousePos.y * -16}px, 0)` }}
        />
        <div 
          className="absolute bottom-[-15%] left-[15%] w-[50%] h-[50%] rounded-full bg-brand-primary/6 blur-[120px] animate-blob-3"
          style={{ transform: `translate3d(${mousePos.x * 8}px, ${mousePos.y * 8}px, 0)` }}
        />
      </div>

      {/* B. DETAILED SUBJECT FLOATING OUTLINE ICONS */}
      <div className="absolute inset-0 w-full h-full">
        {elements.map((el) => {
          // Define parallax depth factors
          const factor = el.layer === 1 ? 8 : el.layer === 2 ? 18 : 28
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
            transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)', // buttery smooth parallax lag
            '--base-rot': `${el.rotation}deg`,
            '--float-dur': `${el.duration}s`,
            '--float-delay': `${el.delay}s`,
          } as any

          return (
            <div key={el.id} style={style} className="edu-float-box select-none pointer-events-none">
              <div className="w-full h-full edu-breathe-element">
                {el.svg}
              </div>
            </div>
          )
        })}
      </div>

      {/* C. SLOW-DRIFTING GLOWING PARTICLES */}
      <div className="absolute inset-0 w-full h-full opacity-60">
        {particles.map((p) => {
          const style: React.CSSProperties = {
            position: 'absolute',
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: 'radial-gradient(circle, rgba(99,102,241,0.5) 0%, rgba(99,102,241,0) 70%)',
            boxShadow: '0 0 8px rgba(99, 102, 241, 0.35)',
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

      {/* D. RADIAL VIGNETTE GLASS EFFECT */}
      <div className="absolute inset-0 w-full h-full bg-[radial-gradient(circle_at_center,transparent_30%,var(--background)_85%)] opacity-85 pointer-events-none" />
    </div>
  )
}
