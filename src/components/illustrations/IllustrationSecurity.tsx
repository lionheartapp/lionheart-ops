'use client'

export function IllustrationSecurity({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .sec-bg { opacity: 0; animation: sec-fadeScale 0.6s ease-out forwards; }
        .sec-main { opacity: 0; animation: sec-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .sec-check { opacity: 0; animation: sec-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards; }
        .sec-ring1 { opacity: 0; animation: sec-ringIn 0.5s ease-out 0.3s forwards; }
        .sec-ring2 { opacity: 0; animation: sec-ringIn 0.5s ease-out 0.4s forwards; }
        .sec-float-r { opacity: 0; animation: sec-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .sec-float-l { opacity: 0; animation: sec-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .sec-dot { opacity: 0; animation: sec-dotFade 0.4s ease-out 0.6s forwards; }
        .sec-sparkle { opacity: 0; animation: sec-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes sec-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes sec-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sec-bounceIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        @keyframes sec-ringIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes sec-floatInR { from { opacity: 0; transform: translate(12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes sec-floatInL { from { opacity: 0; transform: translate(-12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes sec-dotFade { to { opacity: 0.2; } }
        @keyframes sec-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="sec-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="sec-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="sec-bg" cx="120" cy="105" r="75" fill="url(#sec-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="sec-dot" cx="40" cy="58" r="2.5" fill="#3B82F6" />
      <circle className="sec-dot" cx="204" cy="72" r="3" fill="#6366F1" />
      <circle className="sec-dot" cx="46" cy="156" r="2" fill="#6366F1" />

      {/* Pulse rings around shield */}
      <circle className="sec-ring2" cx="120" cy="98" r="62" fill="none" stroke="url(#sec-aurora)" strokeWidth="0.6" opacity="0.08" style={{ transformOrigin: '120px 98px' }} />
      <circle className="sec-ring1" cx="120" cy="98" r="50" fill="none" stroke="url(#sec-aurora)" strokeWidth="0.8" opacity="0.12" style={{ transformOrigin: '120px 98px' }} />

      {/* Shield shape */}
      <g className="sec-main">
        {/* Shadow */}
        <path d="M120 44 L160 60 L160 100 C160 130 140 148 120 158 C100 148 80 130 80 100 L80 60 Z" fill="#E5E7EB" opacity="0.2" transform="translate(3, 3)" />
        {/* White fill */}
        <path d="M120 44 L160 60 L160 100 C160 130 140 148 120 158 C100 148 80 130 80 100 L80 60 Z" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        {/* Gradient top band */}
        <path d="M120 44 L160 60 L160 72 L80 72 L80 60 Z" fill="url(#sec-aurora)" opacity="0.12" />
      </g>

      {/* Checkmark inside shield */}
      <g className="sec-check" style={{ transformOrigin: '120px 102px' }}>
        <circle cx="120" cy="102" r="18" fill="url(#sec-aurora)" opacity="0.12" />
        <path d="M110 102 L117 109 L131 95" stroke="url(#sec-aurora)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Floating lock badge — right */}
      <g className="sec-float-r">
        <g transform="translate(172, 58) rotate(8)">
          <rect x="0" y="0" width="32" height="28" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          {/* Lock icon */}
          <rect x="11" y="13" width="10" height="9" rx="2" fill="url(#sec-aurora)" opacity="0.3" />
          <path d="M13 13 L13 10 Q13 6 16 6 Q19 6 19 10 L19 13" fill="none" stroke="url(#sec-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        </g>
      </g>

      {/* Floating key badge — left */}
      <g className="sec-float-l">
        <g transform="translate(30, 80) rotate(-6)">
          <rect x="0" y="0" width="30" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          {/* Key icon */}
          <circle cx="12" cy="12" r="4" fill="none" stroke="url(#sec-aurora)" strokeWidth="1.2" opacity="0.4" />
          <path d="M16 12 L24 12 M22 12 L22 15" stroke="url(#sec-aurora)" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="sec-sparkle" style={{ transformOrigin: '188px 120px' }}>
        <g transform="translate(184, 116)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
        </g>
      </g>
      <g className="sec-sparkle" style={{ transformOrigin: '52px 48px' }}>
        <g transform="translate(49, 45)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
