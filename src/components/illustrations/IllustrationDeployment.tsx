'use client'

export function IllustrationDeployment({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .dpl-bg { opacity: 0; animation: dpl-fadeScale 0.6s ease-out forwards; }
        .dpl-main { opacity: 0; animation: dpl-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .dpl-flame { opacity: 0; animation: dpl-flameIn 0.4s ease-out 0.3s forwards; }
        .dpl-trail1 { opacity: 0; animation: dpl-trailIn 0.4s ease-out 0.35s forwards; }
        .dpl-trail2 { opacity: 0; animation: dpl-trailIn 0.4s ease-out 0.45s forwards; }
        .dpl-trail3 { opacity: 0; animation: dpl-trailIn 0.4s ease-out 0.55s forwards; }
        .dpl-float-r { opacity: 0; animation: dpl-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .dpl-float-l { opacity: 0; animation: dpl-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .dpl-dot { opacity: 0; animation: dpl-dotFade 0.4s ease-out 0.6s forwards; }
        .dpl-sparkle { opacity: 0; animation: dpl-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes dpl-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes dpl-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dpl-flameIn { from { opacity: 0; transform: scaleY(0.5); } to { opacity: 1; transform: scaleY(1); } }
        @keyframes dpl-trailIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 0.15; transform: translateY(0); } }
        @keyframes dpl-floatInR { from { opacity: 0; transform: translate(12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes dpl-floatInL { from { opacity: 0; transform: translate(-12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes dpl-dotFade { to { opacity: 0.2; } }
        @keyframes dpl-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="dpl-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="dpl-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="dpl-bg" cx="120" cy="105" r="75" fill="url(#dpl-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="dpl-dot" cx="42" cy="56" r="2.5" fill="#3B82F6" />
      <circle className="dpl-dot" cx="200" cy="66" r="3" fill="#6366F1" />
      <circle className="dpl-dot" cx="48" cy="158" r="2" fill="#6366F1" />

      {/* Rocket body */}
      <g className="dpl-main">
        {/* Shadow */}
        <path d="M120 38 C108 55 104 72 104 92 L136 92 C136 72 132 55 120 38 Z" fill="#E5E7EB" opacity="0.2" transform="translate(3, 3)" />
        {/* Nose cone */}
        <path d="M120 38 C108 55 104 72 104 92 L136 92 C136 72 132 55 120 38 Z" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        {/* Window */}
        <circle cx="120" cy="68" r="8" fill="url(#dpl-aurora)" opacity="0.2" stroke="url(#dpl-aurora)" strokeWidth="1" strokeOpacity="0.4" />
        <circle cx="120" cy="68" r="4" fill="url(#dpl-aurora)" opacity="0.15" />
        {/* Tip gradient */}
        <path d="M120 38 C115 48 112 55 110 62 L130 62 C128 55 125 48 120 38 Z" fill="url(#dpl-aurora)" opacity="0.12" />
        {/* Body stripe */}
        <rect x="108" y="80" width="24" height="4" rx="1" fill="url(#dpl-aurora)" opacity="0.15" />
        {/* Fins */}
        <path d="M104 86 L92 100 L92 106 L104 96 Z" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <path d="M136 86 L148 100 L148 106 L136 96 Z" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        {/* Base */}
        <rect x="106" y="92" width="28" height="8" rx="2" fill="white" stroke="#D1D5DB" strokeWidth="1" />
      </g>

      {/* Exhaust flame */}
      <g className="dpl-flame" style={{ transformOrigin: '120px 100px' }}>
        <ellipse cx="120" cy="108" rx="8" ry="10" fill="url(#dpl-aurora)" opacity="0.25" />
        <ellipse cx="120" cy="106" rx="5" ry="7" fill="url(#dpl-aurora)" opacity="0.15" />
      </g>

      {/* Trail particles */}
      <g className="dpl-trail1">
        <circle cx="116" cy="124" r="3" fill="url(#dpl-aurora)" opacity="0.15" />
        <circle cx="126" cy="122" r="2" fill="url(#dpl-aurora)" opacity="0.1" />
      </g>
      <g className="dpl-trail2">
        <circle cx="112" cy="136" r="2.5" fill="url(#dpl-aurora)" opacity="0.1" />
        <circle cx="128" cy="134" r="1.5" fill="url(#dpl-aurora)" opacity="0.08" />
      </g>
      <g className="dpl-trail3">
        <circle cx="118" cy="148" r="2" fill="url(#dpl-aurora)" opacity="0.06" />
        <circle cx="124" cy="146" r="1.5" fill="url(#dpl-aurora)" opacity="0.05" />
      </g>

      {/* Floating package — right */}
      <g className="dpl-float-r">
        <g transform="translate(170, 58) rotate(6)">
          <rect x="0" y="0" width="32" height="28" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          {/* Package icon */}
          <rect x="8" y="8" width="16" height="12" rx="1.5" fill="url(#dpl-aurora)" opacity="0.2" stroke="url(#dpl-aurora)" strokeWidth="0.8" strokeOpacity="0.3" />
          <line x1="16" y1="8" x2="16" y2="20" stroke="url(#dpl-aurora)" strokeWidth="0.8" opacity="0.3" />
          <line x1="8" y1="13" x2="24" y2="13" stroke="url(#dpl-aurora)" strokeWidth="0.8" opacity="0.3" />
        </g>
      </g>

      {/* Floating progress badge — left */}
      <g className="dpl-float-l">
        <g transform="translate(30, 78) rotate(-5)">
          <rect x="0" y="0" width="34" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          {/* Progress bar */}
          <rect x="5" y="8" width="24" height="4" rx="2" fill="#F3F4F6" />
          <rect x="5" y="8" width="16" height="4" rx="2" fill="url(#dpl-aurora)" opacity="0.35" />
          <rect x="5" y="15" width="18" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="dpl-sparkle" style={{ transformOrigin: '188px 115px' }}>
        <g transform="translate(184, 111)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
        </g>
      </g>
      <g className="dpl-sparkle" style={{ transformOrigin: '54px 44px' }}>
        <g transform="translate(51, 41)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
