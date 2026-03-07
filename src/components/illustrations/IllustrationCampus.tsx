'use client'

export function IllustrationCampus({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .cmp-bg { opacity: 0; animation: cmp-fadeScale 0.6s ease-out forwards; }
        .cmp-ground { opacity: 0; animation: cmp-fadeIn 0.3s ease-out 0.1s forwards; }
        .cmp-bldg-c { opacity: 0; animation: cmp-riseUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s forwards; }
        .cmp-bldg-l { opacity: 0; animation: cmp-riseUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .cmp-bldg-r { opacity: 0; animation: cmp-riseUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards; }
        .cmp-tree-l { opacity: 0; animation: cmp-treePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .cmp-tree-r { opacity: 0; animation: cmp-treePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .cmp-cloud { opacity: 0; animation: cmp-cloudIn 0.6s ease-out 0.45s forwards; }
        .cmp-dot { opacity: 0; animation: cmp-dotFade 0.4s ease-out 0.6s forwards; }
        .cmp-sparkle { opacity: 0; animation: cmp-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes cmp-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes cmp-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmp-riseUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cmp-treePop { from { opacity: 0; transform: scale(0.3) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes cmp-cloudIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 0.15; transform: translateX(0); } }
        @keyframes cmp-dotFade { to { opacity: 0.2; } }
        @keyframes cmp-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="camp-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="camp-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="camp-aurora-vert" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="cmp-bg" cx="120" cy="112" rx="85" ry="68" fill="url(#camp-aurora-light)" style={{ transformOrigin: '120px 112px' }} />

      {/* Decorative dots */}
      <circle className="cmp-dot" cx="38" cy="68" r="2.5" fill="#3B82F6" />
      <circle className="cmp-dot" cx="205" cy="62" r="3" fill="#6366F1" />

      {/* Ground line */}
      <line className="cmp-ground" x1="40" y1="160" x2="200" y2="160" stroke="#E5E7EB" strokeWidth="1.5" />

      {/* Left building (shorter) */}
      <g className="cmp-bldg-l">
        <rect x="52" y="100" width="44" height="60" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="48" y="94" width="52" height="10" rx="3" fill="url(#camp-aurora)" opacity="0.7" />
        <rect x="60" y="110" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="78" y="110" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="60" y="128" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="78" y="128" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="67" y="144" width="14" height="16" rx="2" fill="url(#camp-aurora)" opacity="0.25" />
        <circle cx="78" cy="153" r="1.5" fill="url(#camp-aurora)" opacity="0.5" />
      </g>

      {/* Center building (tallest, main) */}
      <g className="cmp-bldg-c">
        <rect x="100" y="68" width="52" height="92" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        <path d="M96,68 L126,48 L156,68 Z" fill="url(#camp-aurora)" opacity="0.6" />
        <rect x="96" y="64" width="60" height="8" rx="2" fill="url(#camp-aurora)" opacity="0.8" />
        <circle cx="126" cy="56" r="6" fill="white" stroke="url(#camp-aurora)" strokeWidth="1.5" />
        <line x1="126" y1="56" x2="126" y2="52" stroke="url(#camp-aurora)" strokeWidth="1" strokeLinecap="round" />
        <line x1="126" y1="56" x2="129" y2="56" stroke="url(#camp-aurora)" strokeWidth="1" strokeLinecap="round" />
        <rect x="108" y="80" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="134" y="80" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="108" y="98" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.12" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="134" y="98" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.12" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="108" y="116" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.2" />
        <rect x="134" y="116" width="10" height="10" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.2" />
        <path d="M118,160 L118,140 C118,136 122,134 126,134 C130,134 134,136 134,140 L134,160" fill="url(#camp-aurora)" opacity="0.3" />
        <circle cx="131" cy="148" r="1.5" fill="url(#camp-aurora)" opacity="0.6" />
      </g>

      {/* Right building (medium) */}
      <g className="cmp-bldg-r">
        <rect x="156" y="108" width="40" height="52" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        <rect x="152" y="102" width="48" height="10" rx="3" fill="url(#camp-aurora)" opacity="0.65" />
        <rect x="163" y="118" width="9" height="9" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="180" y="118" width="9" height="9" rx="2" fill="url(#camp-aurora)" opacity="0.15" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.3" />
        <rect x="163" y="134" width="9" height="9" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="180" y="134" width="9" height="9" rx="2" fill="url(#camp-aurora)" opacity="0.1" stroke="url(#camp-aurora)" strokeWidth="0.5" strokeOpacity="0.25" />
        <rect x="170" y="148" width="12" height="12" rx="2" fill="url(#camp-aurora)" opacity="0.2" />
      </g>

      {/* Tree — left */}
      <g className="cmp-tree-l" transform="translate(38, 130)" style={{ transformOrigin: '46px 148px' }}>
        <rect x="6" y="18" width="4" height="12" rx="1" fill="#9CA3AF" opacity="0.4" />
        <ellipse cx="8" cy="14" rx="10" ry="14" fill="#3B82F6" opacity="0.12" />
        <ellipse cx="8" cy="14" rx="7" ry="10" fill="#6366F1" opacity="0.1" />
      </g>

      {/* Tree — right */}
      <g className="cmp-tree-r" transform="translate(198, 134)" style={{ transformOrigin: '204px 150px' }}>
        <rect x="5" y="16" width="3" height="10" rx="1" fill="#9CA3AF" opacity="0.4" />
        <ellipse cx="6.5" cy="12" rx="8" ry="12" fill="#3B82F6" opacity="0.12" />
        <ellipse cx="6.5" cy="12" rx="5.5" ry="8" fill="#6366F1" opacity="0.1" />
      </g>

      {/* Cloud */}
      <g className="cmp-cloud" transform="translate(160, 30)">
        <ellipse cx="12" cy="10" rx="12" ry="8" fill="#6366F1" />
        <ellipse cx="26" cy="10" rx="10" ry="7" fill="#6366F1" />
        <ellipse cx="19" cy="5" rx="8" ry="6" fill="#6366F1" />
      </g>

      {/* Sparkles */}
      <g className="cmp-sparkle" transform="translate(42, 95)" style={{ transformOrigin: '45px 98px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.3" />
      </g>
    </svg>
  )
}
