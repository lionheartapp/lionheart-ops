'use client'

export function IllustrationDevices({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .dev-bg { opacity: 0; animation: dev-fadeScale 0.6s ease-out forwards; }
        .dev-main { opacity: 0; animation: dev-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .dev-screen { opacity: 0; animation: dev-fadeIn 0.4s ease-out 0.3s forwards; }
        .dev-line1 { opacity: 0; animation: dev-slideRight 0.4s ease-out 0.35s forwards; }
        .dev-line2 { opacity: 0; animation: dev-slideRight 0.4s ease-out 0.45s forwards; }
        .dev-line3 { opacity: 0; animation: dev-slideRight 0.4s ease-out 0.55s forwards; }
        .dev-float-r { opacity: 0; animation: dev-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .dev-float-l { opacity: 0; animation: dev-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .dev-dot { opacity: 0; animation: dev-dotFade 0.4s ease-out 0.6s forwards; }
        .dev-sparkle { opacity: 0; animation: dev-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes dev-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes dev-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dev-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dev-slideRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes dev-floatInR { from { opacity: 0; transform: translate(12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes dev-floatInL { from { opacity: 0; transform: translate(-12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes dev-dotFade { to { opacity: 0.2; } }
        @keyframes dev-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="dev-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="dev-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="dev-bg" cx="120" cy="105" r="75" fill="url(#dev-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="dev-dot" cx="38" cy="62" r="2.5" fill="#3B82F6" />
      <circle className="dev-dot" cx="206" cy="70" r="3" fill="#6366F1" />
      <circle className="dev-dot" cx="44" cy="152" r="2" fill="#6366F1" />

      {/* Laptop body */}
      <g className="dev-main">
        {/* Shadow */}
        <rect x="68" y="48" width="104" height="72" rx="6" fill="#E5E7EB" opacity="0.25" transform="translate(3, 3)" />
        {/* Screen */}
        <rect x="68" y="48" width="104" height="72" rx="6" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        {/* Screen bezel */}
        <rect x="72" y="52" width="96" height="60" rx="3" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="0.5" />
        {/* Base/keyboard */}
        <path d="M56 124 L68 120 L172 120 L184 124 L56 124 Z" fill="white" stroke="#D1D5DB" strokeWidth="1" strokeLinejoin="round" />
        <rect x="60" y="124" width="120" height="8" rx="2" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        {/* Trackpad */}
        <rect x="104" y="126" width="32" height="4" rx="1" fill="#F3F4F6" stroke="#E5E7EB" strokeWidth="0.5" />
      </g>

      {/* Screen content */}
      <g className="dev-screen">
        {/* Aurora header bar */}
        <rect x="76" y="56" width="88" height="10" rx="2" fill="url(#dev-aurora)" opacity="0.15" />
        <circle cx="82" cy="61" r="2" fill="url(#dev-aurora)" opacity="0.4" />
        <rect x="88" y="59" width="20" height="3" rx="1.5" fill="url(#dev-aurora)" opacity="0.3" />
      </g>

      {/* Screen content rows */}
      <g className="dev-line1">
        <g transform="translate(80, 72)">
          <rect x="0" y="0" width="10" height="10" rx="2" fill="url(#dev-aurora)" opacity="0.15" />
          <rect x="14" y="1" width="30" height="3" rx="1.5" fill="#D1D5DB" />
          <rect x="14" y="6" width="20" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      <g className="dev-line2">
        <g transform="translate(80, 86)">
          <rect x="0" y="0" width="10" height="10" rx="2" fill="url(#dev-aurora)" opacity="0.15" />
          <rect x="14" y="1" width="36" height="3" rx="1.5" fill="#D1D5DB" />
          <rect x="14" y="6" width="24" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      <g className="dev-line3">
        <g transform="translate(80, 100)">
          <rect x="0" y="0" width="10" height="10" rx="2" fill="url(#dev-aurora)" opacity="0.15" />
          <rect x="14" y="1" width="26" height="3" rx="1.5" fill="#E5E7EB" />
          <rect x="14" y="6" width="18" height="2.5" rx="1.25" fill="#F3F4F6" />
        </g>
      </g>

      {/* Floating status badge — right */}
      <g className="dev-float-r">
        <g transform="translate(178, 56) rotate(6)">
          <rect x="0" y="0" width="32" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          <circle cx="10" cy="8" r="3" fill="url(#dev-aurora)" opacity="0.3" />
          <rect x="16" y="6" width="12" height="3" rx="1.5" fill="url(#dev-aurora)" opacity="0.4" />
          <rect x="5" y="15" width="22" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      {/* Floating wifi badge — left */}
      <g className="dev-float-l">
        <g transform="translate(28, 84) rotate(-5)">
          <rect x="0" y="0" width="30" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          {/* WiFi icon */}
          <path d="M15 18 L15 17" stroke="url(#dev-aurora)" strokeWidth="2" strokeLinecap="round" />
          <path d="M11 14 Q15 10 19 14" stroke="url(#dev-aurora)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5" />
          <path d="M8 11 Q15 5 22 11" stroke="url(#dev-aurora)" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.3" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="dev-sparkle" style={{ transformOrigin: '192px 118px' }}>
        <g transform="translate(188, 114)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
        </g>
      </g>
      <g className="dev-sparkle" style={{ transformOrigin: '50px 50px' }}>
        <g transform="translate(47, 47)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
