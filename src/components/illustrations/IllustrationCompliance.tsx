'use client'

export function IllustrationCompliance({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .comp-bg { opacity: 0; animation: comp-fadeScale 0.6s ease-out forwards; }
        .comp-board { opacity: 0; animation: comp-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .comp-clip { opacity: 0; animation: comp-bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .comp-line1 { opacity: 0; animation: comp-fadeIn 0.3s ease-out 0.4s forwards; }
        .comp-line2 { opacity: 0; animation: comp-fadeIn 0.3s ease-out 0.5s forwards; }
        .comp-line3 { opacity: 0; animation: comp-fadeIn 0.3s ease-out 0.6s forwards; }
        .comp-check1 { opacity: 0; animation: comp-checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .comp-check2 { opacity: 0; animation: comp-checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.65s forwards; }
        .comp-check3 { opacity: 0; animation: comp-checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.75s forwards; }
        .comp-shield { opacity: 0; animation: comp-shieldIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .comp-dot { opacity: 0; animation: comp-dotFade 0.4s ease-out 0.6s forwards; }
        .comp-sparkle { opacity: 0; animation: comp-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.8s forwards; }

        @keyframes comp-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes comp-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes comp-bounceIn { from { opacity: 0; transform: scaleY(0.3); } to { opacity: 1; transform: scaleY(1); } }
        @keyframes comp-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes comp-checkPop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes comp-shieldIn { from { opacity: 0; transform: translate(8px, 8px) scale(0.7); } to { opacity: 1; transform: translate(0, 0) scale(1); } }
        @keyframes comp-dotFade { to { opacity: 0.25; } }
        @keyframes comp-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="comp-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="comp-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="comp-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="comp-bg" cx="115" cy="108" rx="82" ry="72" fill="url(#comp-aurora-light)" style={{ transformOrigin: '115px 108px' }} />

      {/* Decorative dots */}
      <circle className="comp-dot" cx="42" cy="68" r="2.5" fill="#3B82F6" />
      <circle className="comp-dot" cx="188" cy="58" r="3" fill="#6366F1" />
      <circle className="comp-dot" cx="50" cy="152" r="2" fill="#6366F1" />

      {/* Clipboard body */}
      <g className="comp-board">
        {/* Shadow */}
        <rect x="68" y="50" width="105" height="130" rx="10" fill="#E5E7EB" opacity="0.3" transform="translate(3, 3)" />
        {/* Board */}
        <rect x="68" y="50" width="105" height="130" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="1" />
      </g>

      {/* Clipboard clip */}
      <g className="comp-clip" style={{ transformOrigin: '120px 50px' }}>
        <rect x="100" y="42" width="40" height="16" rx="4" fill="url(#comp-aurora)" />
        <rect x="110" y="46" width="20" height="8" rx="3" fill="white" opacity="0.4" />
      </g>

      {/* Checklist row 1 */}
      <g className="comp-line1">
        <rect x="82" y="74" width="12" height="12" rx="3" fill="url(#comp-aurora)" opacity="0.12" stroke="url(#comp-aurora)" strokeWidth="0.8" />
        <rect x="100" y="77" width="56" height="4" rx="2" fill="#E5E7EB" />
        <rect x="100" y="77" width="56" height="4" rx="2" fill="url(#comp-aurora)" opacity="0.15" />
      </g>
      <g className="comp-check1" style={{ transformOrigin: '88px 80px' }}>
        <path d="M84 80 L87 83 L92 76" stroke="url(#comp-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Checklist row 2 */}
      <g className="comp-line2">
        <rect x="82" y="96" width="12" height="12" rx="3" fill="url(#comp-aurora)" opacity="0.12" stroke="url(#comp-aurora)" strokeWidth="0.8" />
        <rect x="100" y="99" width="46" height="4" rx="2" fill="#E5E7EB" />
        <rect x="100" y="99" width="46" height="4" rx="2" fill="url(#comp-aurora)" opacity="0.15" />
      </g>
      <g className="comp-check2" style={{ transformOrigin: '88px 102px' }}>
        <path d="M84 102 L87 105 L92 98" stroke="url(#comp-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Checklist row 3 */}
      <g className="comp-line3">
        <rect x="82" y="118" width="12" height="12" rx="3" fill="url(#comp-aurora)" opacity="0.12" stroke="url(#comp-aurora)" strokeWidth="0.8" />
        <rect x="100" y="121" width="50" height="4" rx="2" fill="#E5E7EB" />
        <rect x="100" y="121" width="50" height="4" rx="2" fill="url(#comp-aurora)" opacity="0.15" />
      </g>
      <g className="comp-check3" style={{ transformOrigin: '88px 124px' }}>
        <path d="M84 124 L87 127 L92 120" stroke="url(#comp-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Progress bar at bottom of clipboard */}
      <g className="comp-line3">
        <rect x="82" y="148" width="78" height="5" rx="2.5" fill="#E5E7EB" opacity="0.5" />
        <rect x="82" y="148" width="58" height="5" rx="2.5" fill="url(#comp-aurora)" opacity="0.3" />
      </g>

      {/* Shield badge (overlapping bottom-right) */}
      <g className="comp-shield" style={{ transformOrigin: '168px 142px' }}>
        {/* Shield shadow */}
        <path d="M168 120 L190 128 L190 148 Q190 160 168 168 Q146 160 146 148 L146 128 Z" fill="#E5E7EB" opacity="0.3" transform="translate(2, 2)" />
        {/* Shield body */}
        <path d="M168 120 L190 128 L190 148 Q190 160 168 168 Q146 160 146 148 L146 128 Z" fill="url(#comp-aurora)" />
        {/* Shield inner highlight */}
        <path d="M168 126 L184 132 L184 148 Q184 156 168 162 Q152 156 152 148 L152 132 Z" fill="white" opacity="0.15" />
        {/* Shield checkmark */}
        <path d="M158 144 L164 150 L178 136" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Sparkles */}
      <g className="comp-sparkle" style={{ transformOrigin: '196px 118px' }}>
        <g transform="translate(192, 114)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.35" />
        </g>
      </g>
      <g className="comp-sparkle" style={{ transformOrigin: '54px 94px' }}>
        <g transform="translate(51, 91)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
