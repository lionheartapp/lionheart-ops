'use client'

export function IllustrationTeam({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .tm-bg { opacity: 0; animation: tm-fadeScale 0.6s ease-out forwards; }
        .tm-center { opacity: 0; animation: tm-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .tm-left { opacity: 0; animation: tm-slideInL 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .tm-right { opacity: 0; animation: tm-slideInR 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards; }
        .tm-lines { opacity: 0; animation: tm-fadeIn 0.4s ease-out 0.45s forwards; }
        .tm-shield { opacity: 0; animation: tm-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .tm-badge { opacity: 0; animation: tm-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .tm-dot { opacity: 0; animation: tm-dotFade 0.4s ease-out 0.6s forwards; }
        .tm-sparkle { opacity: 0; animation: tm-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes tm-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes tm-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tm-slideInL { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tm-slideInR { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tm-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tm-bounceIn { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes tm-dotFade { to { opacity: 0.25; } }
        @keyframes tm-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="team-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="team-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="tm-bg" cx="120" cy="108" rx="82" ry="70" fill="url(#team-aurora-light)" style={{ transformOrigin: '120px 108px' }} />

      {/* Decorative dots */}
      <circle className="tm-dot" cx="42" cy="62" r="2.5" fill="#3B82F6" />
      <circle className="tm-dot" cx="200" cy="58" r="3" fill="#6366F1" />
      <circle className="tm-dot" cx="48" cy="158" r="2" fill="#6366F1" />
      <circle className="tm-dot" cx="198" cy="148" r="2.5" fill="#3B82F6" />

      {/* Center person (larger) */}
      <g className="tm-center" transform="translate(104, 62)">
        <circle cx="16" cy="16" r="16" fill="url(#team-aurora)" opacity="0.7" />
        <path
          d="M0,52 C0,40 8,34 16,34 C24,34 32,40 32,52 L32,60 C32,62 30,64 28,64 L4,64 C2,64 0,62 0,60 Z"
          fill="url(#team-aurora)"
          opacity="0.5"
        />
        <circle cx="11" cy="14" r="2" fill="white" opacity="0.5" />
        <circle cx="21" cy="14" r="2" fill="white" opacity="0.5" />
        <path d="M12,20 Q16,24 20,20" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
      </g>

      {/* Left person */}
      <g className="tm-left" transform="translate(50, 80)">
        <circle cx="14" cy="14" r="14" fill="url(#team-aurora)" opacity="0.4" />
        <path
          d="M0,44 C0,34 6,28 14,28 C22,28 28,34 28,44 L28,52 C28,54 26,56 24,56 L4,56 C2,56 0,54 0,52 Z"
          fill="url(#team-aurora)"
          opacity="0.25"
        />
        <circle cx="10" cy="12" r="1.5" fill="white" opacity="0.4" />
        <circle cx="18" cy="12" r="1.5" fill="white" opacity="0.4" />
      </g>

      {/* Right person */}
      <g className="tm-right" transform="translate(162, 80)">
        <circle cx="14" cy="14" r="14" fill="url(#team-aurora)" opacity="0.4" />
        <path
          d="M0,44 C0,34 6,28 14,28 C22,28 28,34 28,44 L28,52 C28,54 26,56 24,56 L4,56 C2,56 0,54 0,52 Z"
          fill="url(#team-aurora)"
          opacity="0.25"
        />
        <circle cx="10" cy="12" r="1.5" fill="white" opacity="0.4" />
        <circle cx="18" cy="12" r="1.5" fill="white" opacity="0.4" />
      </g>

      {/* Connection lines between people */}
      <g className="tm-lines">
        <line x1="82" y1="105" x2="104" y2="95" stroke="url(#team-aurora)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.25" />
        <line x1="136" y1="95" x2="162" y2="105" stroke="url(#team-aurora)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.25" />
      </g>

      {/* Shield icon — top right */}
      <g className="tm-shield" transform="translate(166, 52)" style={{ transformOrigin: '174px 62px' }}>
        <path d="M8,0 L16,4 L16,10 C16,15 12,19 8,20 C4,19 0,15 0,10 L0,4 Z" fill="url(#team-aurora)" opacity="0.35" />
        <path d="M5,10 L7,12 L12,7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Badge icon — top left */}
      <g className="tm-badge" transform="translate(58, 55)" style={{ transformOrigin: '66px 64px' }}>
        <rect x="0" y="0" width="16" height="18" rx="3" fill="url(#team-aurora)" opacity="0.3" />
        <rect x="4" y="4" width="8" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="4" y="8" width="6" height="2" rx="1" fill="white" opacity="0.4" />
        <rect x="4" y="12" width="8" height="2" rx="1" fill="white" opacity="0.3" />
      </g>

      {/* Sparkle stars */}
      <g className="tm-sparkle" transform="translate(185, 130)" style={{ transformOrigin: '189px 134px' }}>
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
      </g>
      <g className="tm-sparkle" transform="translate(42, 120)" style={{ transformOrigin: '45px 123px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
      </g>
    </svg>
  )
}
