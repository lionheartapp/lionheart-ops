'use client'

export function IllustrationAnalytics({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .anl-bg { opacity: 0; animation: anl-fadeScale 0.6s ease-out forwards; }
        .anl-main { opacity: 0; animation: anl-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .anl-bar1 { opacity: 0; animation: anl-barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s forwards; }
        .anl-bar2 { opacity: 0; animation: anl-barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards; }
        .anl-bar3 { opacity: 0; animation: anl-barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s forwards; }
        .anl-bar4 { opacity: 0; animation: anl-barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .anl-bar5 { opacity: 0; animation: anl-barGrow 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.65s forwards; }
        .anl-line { opacity: 0; animation: anl-lineIn 0.6s ease-out 0.5s forwards; }
        .anl-float-r { opacity: 0; animation: anl-floatInR 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .anl-float-l { opacity: 0; animation: anl-floatInL 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .anl-dot { opacity: 0; animation: anl-dotFade 0.4s ease-out 0.6s forwards; }
        .anl-sparkle { opacity: 0; animation: anl-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes anl-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes anl-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes anl-barGrow { from { opacity: 0; transform: scaleY(0); } to { opacity: 1; transform: scaleY(1); } }
        @keyframes anl-lineIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes anl-floatInR { from { opacity: 0; transform: translate(12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes anl-floatInL { from { opacity: 0; transform: translate(-12px, -8px); } to { opacity: 1; transform: translate(0, 0); } }
        @keyframes anl-dotFade { to { opacity: 0.2; } }
        @keyframes anl-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="anl-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="anl-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="anl-aurora-bar" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="anl-bg" cx="120" cy="105" r="75" fill="url(#anl-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="anl-dot" cx="40" cy="58" r="2.5" fill="#3B82F6" />
      <circle className="anl-dot" cx="204" cy="72" r="3" fill="#6366F1" />
      <circle className="anl-dot" cx="46" cy="156" r="2" fill="#6366F1" />

      {/* Chart container */}
      <g className="anl-main">
        {/* Shadow */}
        <rect x="66" y="44" width="108" height="120" rx="8" fill="#E5E7EB" opacity="0.25" transform="translate(3, 3)" />
        {/* Background */}
        <rect x="66" y="44" width="108" height="120" rx="8" fill="white" stroke="#D1D5DB" strokeWidth="1" />
        {/* Header */}
        <rect x="70" y="48" width="100" height="14" rx="4" fill="url(#anl-aurora)" opacity="0.08" />
        <rect x="76" y="53" width="24" height="4" rx="2" fill="url(#anl-aurora)" opacity="0.3" />
        <rect x="104" y="53" width="16" height="4" rx="2" fill="#E5E7EB" />
        {/* X axis */}
        <line x1="82" y1="146" x2="162" y2="146" stroke="#E5E7EB" strokeWidth="1" />
        {/* Y axis grid lines */}
        <line x1="82" y1="78" x2="162" y2="78" stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1="82" y1="96" x2="162" y2="96" stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1="82" y1="114" x2="162" y2="114" stroke="#F3F4F6" strokeWidth="0.5" />
        <line x1="82" y1="132" x2="162" y2="132" stroke="#F3F4F6" strokeWidth="0.5" />
      </g>

      {/* Chart bars (growing from bottom) */}
      <g className="anl-bar1" style={{ transformOrigin: '92px 146px' }}>
        <rect x="86" y="118" width="12" height="28" rx="2" fill="url(#anl-aurora-bar)" />
      </g>
      <g className="anl-bar2" style={{ transformOrigin: '108px 146px' }}>
        <rect x="102" y="98" width="12" height="48" rx="2" fill="url(#anl-aurora-bar)" />
      </g>
      <g className="anl-bar3" style={{ transformOrigin: '124px 146px' }}>
        <rect x="118" y="82" width="12" height="64" rx="2" fill="url(#anl-aurora-bar)" />
      </g>
      <g className="anl-bar4" style={{ transformOrigin: '140px 146px' }}>
        <rect x="134" y="106" width="12" height="40" rx="2" fill="url(#anl-aurora-bar)" />
      </g>
      <g className="anl-bar5" style={{ transformOrigin: '156px 146px' }}>
        <rect x="150" y="90" width="12" height="56" rx="2" fill="url(#anl-aurora-bar)" />
      </g>

      {/* Trend line */}
      <g className="anl-line">
        <polyline
          points="92,116 108,96 124,80 140,104 156,88"
          stroke="url(#anl-aurora)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.5"
        />
        <circle cx="92" cy="116" r="2.5" fill="url(#anl-aurora)" opacity="0.4" />
        <circle cx="108" cy="96" r="2.5" fill="url(#anl-aurora)" opacity="0.4" />
        <circle cx="124" cy="80" r="2.5" fill="url(#anl-aurora)" opacity="0.4" />
        <circle cx="140" cy="104" r="2.5" fill="url(#anl-aurora)" opacity="0.4" />
        <circle cx="156" cy="88" r="2.5" fill="url(#anl-aurora)" opacity="0.4" />
      </g>

      {/* Floating stat badge — right */}
      <g className="anl-float-r">
        <g transform="translate(176, 54) rotate(6)">
          <rect x="0" y="0" width="32" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          <rect x="5" y="6" width="10" height="5" rx="1" fill="url(#anl-aurora)" opacity="0.3" />
          <rect x="18" y="6" width="8" height="3" rx="1.5" fill="#E5E7EB" />
          <rect x="5" y="15" width="22" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      {/* Floating percentage badge — left */}
      <g className="anl-float-l">
        <g transform="translate(28, 76) rotate(-5)">
          <rect x="0" y="0" width="30" height="24" rx="4" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
          <rect x="5" y="5" width="20" height="6" rx="1.5" fill="url(#anl-aurora)" opacity="0.15" />
          <rect x="8" y="7" width="14" height="2.5" rx="1.25" fill="url(#anl-aurora)" opacity="0.35" />
          <rect x="5" y="15" width="18" height="2.5" rx="1.25" fill="#E5E7EB" />
        </g>
      </g>

      {/* Sparkle stars */}
      <g className="anl-sparkle" style={{ transformOrigin: '190px 118px' }}>
        <g transform="translate(186, 114)">
          <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
        </g>
      </g>
      <g className="anl-sparkle" style={{ transformOrigin: '52px 48px' }}>
        <g transform="translate(49, 45)">
          <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
        </g>
      </g>
    </svg>
  )
}
