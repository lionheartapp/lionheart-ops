'use client'

export function IllustrationTickets({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .tix-bg { opacity: 0; animation: tix-fadeScale 0.6s ease-out forwards; }
        .tix-main { opacity: 0; animation: tix-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .tix-clip { opacity: 0; animation: tix-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .tix-row1 { opacity: 0; animation: tix-slideRight 0.4s ease-out 0.35s forwards; }
        .tix-row2 { opacity: 0; animation: tix-slideRight 0.4s ease-out 0.45s forwards; }
        .tix-row3 { opacity: 0; animation: tix-slideRight 0.4s ease-out 0.55s forwards; }
        .tix-row4 { opacity: 0; animation: tix-slideRight 0.4s ease-out 0.65s forwards; }
        .tix-float-r { opacity: 0; animation: tix-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .tix-float-l { opacity: 0; animation: tix-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .tix-dot { opacity: 0; animation: tix-dotFade 0.4s ease-out 0.6s forwards; }
        .tix-sparkle { opacity: 0; animation: tix-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes tix-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes tix-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tix-bounceIn { from { opacity: 0; transform: scale(0.5) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes tix-slideRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tix-floatInR { from { opacity: 0; transform: translate(12px, -8px) rotate(6deg); } to { opacity: 1; transform: translate(0, 0) rotate(6deg); } }
        @keyframes tix-floatInL { from { opacity: 0; transform: translate(-12px, -8px) rotate(-5deg); } to { opacity: 1; transform: translate(0, 0) rotate(-5deg); } }
        @keyframes tix-dotFade { to { opacity: 0.2; } }
        @keyframes tix-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="tix-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="tix-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="tix-bg" cx="120" cy="105" r="75" fill="url(#tix-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="tix-dot" cx="42" cy="60" r="2.5" fill="#3B82F6" />
      <circle className="tix-dot" cx="202" cy="68" r="3" fill="#6366F1" />
      <circle className="tix-dot" cx="48" cy="155" r="2" fill="#6366F1" />

      {/* Clipboard body + shadow */}
      <g className="tix-main">
        <rect x="76" y="38" width="88" height="130" rx="8" fill="#E5E7EB" opacity="0.25" transform="translate(3, 3)" />
        <rect x="76" y="38" width="88" height="130" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1" />
      </g>

      {/* Clipboard clip */}
      <g className="tix-clip" style={{ transformOrigin: '120px 39px' }}>
        <rect x="104" y="30" width="32" height="18" rx="4" fill="url(#tix-aurora)" opacity="0.85" />
        <rect x="112" y="34" width="16" height="8" rx="3" fill="white" />
      </g>

      {/* Task rows — staggered slide in */}
      <g className="tix-row1" transform="translate(90, 60)">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="url(#tix-aurora)" opacity="0.2" stroke="url(#tix-aurora)" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M3,7 L6,10 L11,4" stroke="url(#tix-aurora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="20" y="2" width="38" height="4" rx="2" fill="#D1D5DB" />
        <rect x="20" y="9" width="24" height="3" rx="1.5" fill="#E5E7EB" />
      </g>

      <g className="tix-row2" transform="translate(90, 86)">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="url(#tix-aurora)" opacity="0.2" stroke="url(#tix-aurora)" strokeWidth="1" strokeOpacity="0.4" />
        <path d="M3,7 L6,10 L11,4" stroke="url(#tix-aurora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="20" y="2" width="32" height="4" rx="2" fill="#D1D5DB" />
        <rect x="20" y="9" width="28" height="3" rx="1.5" fill="#E5E7EB" />
      </g>

      <g className="tix-row3" transform="translate(90, 112)">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="20" y="2" width="36" height="4" rx="2" fill="#E5E7EB" />
        <rect x="20" y="9" width="20" height="3" rx="1.5" fill="#F3F4F6" />
      </g>

      <g className="tix-row4" transform="translate(90, 138)">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="20" y="2" width="42" height="4" rx="2" fill="#E5E7EB" />
        <rect x="20" y="9" width="26" height="3" rx="1.5" fill="#F3F4F6" />
      </g>

      {/* Floating mini card — right */}
      <g className="tix-float-r" transform="translate(172, 62)">
        <rect x="0" y="0" width="36" height="28" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" transform="rotate(6)" />
        <g transform="rotate(6)">
          <rect x="5" y="5" width="16" height="3" rx="1.5" fill="url(#tix-aurora)" opacity="0.4" />
          <rect x="5" y="11" width="26" height="2.5" rx="1.25" fill="#E5E7EB" />
          <rect x="5" y="16" width="20" height="2.5" rx="1.25" fill="#E5E7EB" />
          <circle cx="28" cy="22" r="3" fill="url(#tix-aurora)" opacity="0.15" />
        </g>
      </g>

      {/* Floating mini card — left */}
      <g className="tix-float-l" transform="translate(32, 80)">
        <rect x="0" y="0" width="34" height="26" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" transform="rotate(-5)" />
        <g transform="rotate(-5)">
          <rect x="5" y="5" width="14" height="3" rx="1.5" fill="url(#tix-aurora)" opacity="0.35" />
          <rect x="5" y="11" width="24" height="2.5" rx="1.25" fill="#E5E7EB" />
          <rect x="5" y="16" width="18" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="tix-sparkle" transform="translate(185, 115)" style={{ transformOrigin: '189px 119px' }}>
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
      </g>
      <g className="tix-sparkle" transform="translate(50, 52)" style={{ transformOrigin: '53px 55px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
      </g>
    </svg>
  )
}
