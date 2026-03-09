'use client'

export function IllustrationSync({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .syn-bg { opacity: 0; animation: syn-fadeScale 0.6s ease-out forwards; }
        .syn-main { opacity: 0; animation: syn-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .syn-arrow1 { opacity: 0; animation: syn-arrowIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .syn-arrow2 { opacity: 0; animation: syn-arrowIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .syn-node1 { opacity: 0; animation: syn-nodeIn 0.4s ease-out 0.35s forwards; }
        .syn-node2 { opacity: 0; animation: syn-nodeIn 0.4s ease-out 0.45s forwards; }
        .syn-node3 { opacity: 0; animation: syn-nodeIn 0.4s ease-out 0.55s forwards; }
        .syn-float-r { opacity: 0; animation: syn-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .syn-float-l { opacity: 0; animation: syn-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .syn-dot { opacity: 0; animation: syn-dotFade 0.4s ease-out 0.6s forwards; }
        .syn-sparkle { opacity: 0; animation: syn-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes syn-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes syn-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes syn-arrowIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        @keyframes syn-nodeIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
        @keyframes syn-floatInR { from { opacity: 0; transform: translate(12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes syn-floatInL { from { opacity: 0; transform: translate(-12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes syn-dotFade { to { opacity: 0.2; } }
        @keyframes syn-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="syn-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="syn-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="syn-bg" cx="120" cy="105" r="75" fill="url(#syn-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="syn-dot" cx="38" cy="60" r="2.5" fill="#3B82F6" />
      <circle className="syn-dot" cx="206" cy="68" r="3" fill="#6366F1" />
      <circle className="syn-dot" cx="44" cy="154" r="2" fill="#6366F1" />

      {/* Cloud shape */}
      <g className="syn-main">
        {/* Shadow */}
        <g transform="translate(3, 3)">
          <path d="M168 100 C168 100 172 80 158 70 C144 60 132 68 128 72 C124 56 108 48 94 56 C80 64 78 80 80 88 C66 88 60 100 64 110 C68 120 80 122 80 122 L168 122 C168 122 180 120 180 108 C180 96 168 100 168 100 Z" fill="#E5E7EB" opacity="0.2" />
        </g>
        {/* Cloud body */}
        <path d="M168 100 C168 100 172 80 158 70 C144 60 132 68 128 72 C124 56 108 48 94 56 C80 64 78 80 80 88 C66 88 60 100 64 110 C68 120 80 122 80 122 L168 122 C168 122 180 120 180 108 C180 96 168 100 168 100 Z" fill="white" stroke="#D1D5DB" strokeWidth="1" />
      </g>

      {/* Circular sync arrows */}
      <g className="syn-arrow1" style={{ transformOrigin: '120px 95px' }}>
        {/* Clockwise arrow arc */}
        <path d="M108 82 A16 16 0 0 1 138 88" stroke="url(#syn-aurora)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M136 84 L138 88 L134 90" stroke="url(#syn-aurora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
      </g>
      <g className="syn-arrow2" style={{ transformOrigin: '120px 95px' }}>
        {/* Counter-clockwise arrow arc */}
        <path d="M132 108 A16 16 0 0 1 102 102" stroke="url(#syn-aurora)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
        <path d="M104 106 L102 102 L106 100" stroke="url(#syn-aurora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6" />
      </g>

      {/* Connection nodes below cloud */}
      <g className="syn-node1" style={{ transformOrigin: '88px 144px' }}>
        <line x1="88" y1="124" x2="88" y2="138" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="76" y="138" width="24" height="16" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <rect x="80" y="142" width="8" height="3" rx="1.5" fill="url(#syn-aurora)" opacity="0.3" />
        <rect x="80" y="148" width="16" height="2" rx="1" fill="#E5E7EB" />
      </g>
      <g className="syn-node2" style={{ transformOrigin: '120px 148px' }}>
        <line x1="120" y1="124" x2="120" y2="142" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="108" y="142" width="24" height="16" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <rect x="112" y="146" width="10" height="3" rx="1.5" fill="url(#syn-aurora)" opacity="0.3" />
        <rect x="112" y="152" width="16" height="2" rx="1" fill="#E5E7EB" />
      </g>
      <g className="syn-node3" style={{ transformOrigin: '152px 144px' }}>
        <line x1="152" y1="124" x2="152" y2="138" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="3 2" />
        <rect x="140" y="138" width="24" height="16" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <rect x="144" y="142" width="12" height="3" rx="1.5" fill="url(#syn-aurora)" opacity="0.3" />
        <rect x="144" y="148" width="16" height="2" rx="1" fill="#E5E7EB" />
      </g>

      {/* Floating status badge — right */}
      <g className="syn-float-r">
        <g transform="translate(186, 62) rotate(6)">
          <rect x="0" y="0" width="28" height="22" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          <circle cx="9" cy="11" r="3" fill="url(#syn-aurora)" opacity="0.25" />
          <rect x="15" y="9" width="10" height="3" rx="1.5" fill="#E5E7EB" />
        </g>
      </g>

      {/* Floating data badge — left */}
      <g className="syn-float-l">
        <g transform="translate(26, 82) rotate(-5)">
          <rect x="0" y="0" width="30" height="22" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          <rect x="5" y="6" width="6" height="6" rx="1" fill="url(#syn-aurora)" opacity="0.2" />
          <rect x="14" y="6" width="12" height="2.5" rx="1.25" fill="#E5E7EB" />
          <rect x="14" y="11" width="8" height="2.5" rx="1.25" fill="#F3F4F6" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="syn-sparkle" style={{ transformOrigin: '192px 112px' }}>
        <g transform="translate(188, 108)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
        </g>
      </g>
      <g className="syn-sparkle" style={{ transformOrigin: '50px 50px' }}>
        <g transform="translate(47, 47)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
