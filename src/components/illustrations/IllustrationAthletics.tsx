'use client'

export function IllustrationAthletics({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .ath-bg { opacity: 0; animation: ath-fadeScale 0.6s ease-out forwards; }
        .ath-trophy { opacity: 0; animation: ath-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .ath-star { opacity: 0; animation: ath-starBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s forwards; }
        .ath-laurel-l { opacity: 0; animation: ath-laurelL 0.5s ease-out 0.35s forwards; }
        .ath-laurel-r { opacity: 0; animation: ath-laurelR 0.5s ease-out 0.4s forwards; }
        .ath-confetti { opacity: 0; animation: ath-confettiPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .ath-dot { opacity: 0; animation: ath-dotFade 0.4s ease-out 0.6s forwards; }
        .ath-sparkle { opacity: 0; animation: ath-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes ath-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes ath-slideUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ath-starBounce { from { opacity: 0; transform: scale(0) rotate(-20deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
        @keyframes ath-laurelL { from { opacity: 0; transform: translateX(-8px) rotate(5deg); } to { opacity: 0.35; transform: translateX(0) rotate(0deg); } }
        @keyframes ath-laurelR { from { opacity: 0; transform: translateX(8px) rotate(-5deg); } to { opacity: 0.35; transform: translateX(0) rotate(0deg); } }
        @keyframes ath-confettiPop { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes ath-dotFade { to { opacity: 0.25; } }
        @keyframes ath-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="ath-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="ath-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="ath-aurora-vert" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="ath-bg" cx="120" cy="108" rx="82" ry="70" fill="url(#ath-aurora-light)" style={{ transformOrigin: '120px 108px' }} />

      {/* Decorative dots */}
      <circle className="ath-dot" cx="42" cy="65" r="2.5" fill="#3B82F6" />
      <circle className="ath-dot" cx="200" cy="55" r="3" fill="#6366F1" />
      <circle className="ath-dot" cx="50" cy="155" r="2" fill="#6366F1" />
      <circle className="ath-dot" cx="195" cy="150" r="2.5" fill="#3B82F6" />

      {/* Trophy cup */}
      <g className="ath-trophy" transform="translate(82, 58)">
        <path d="M20,10 L56,10 C56,10 58,50 38,60 C18,50 20,10 20,10 Z" fill="url(#ath-aurora)" opacity="0.8" />
        <path d="M28,16 C28,16 26,42 38,52 C30,46 28,16 28,16 Z" fill="white" opacity="0.3" />
        <path d="M20,16 C14,16 8,22 8,30 C8,38 14,44 20,44" stroke="url(#ath-aurora)" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d="M56,16 C62,16 68,22 68,30 C68,38 62,44 56,44" stroke="url(#ath-aurora)" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
        <rect x="16" y="6" width="44" height="6" rx="3" fill="url(#ath-aurora)" opacity="0.9" />
        <rect x="34" y="60" width="8" height="14" rx="2" fill="url(#ath-aurora)" opacity="0.6" />
        <rect x="24" y="72" width="28" height="6" rx="3" fill="url(#ath-aurora)" opacity="0.7" />
      </g>

      {/* Star above trophy */}
      <g className="ath-star" transform="translate(112, 26)" style={{ transformOrigin: '120px 34px' }}>
        <path d="M8,0 L10.5,5.5 L16,6 L12,10.5 L13,16 L8,13 L3,16 L4,10.5 L0,6 L5.5,5.5 Z" fill="url(#ath-aurora)" opacity="0.6" />
      </g>

      {/* Laurel — left */}
      <g className="ath-laurel-l" transform="translate(64, 100)">
        <path d="M20,0 C10,8 4,20 4,34" stroke="#3B82F6" strokeWidth="1.5" fill="none" />
        <ellipse cx="12" cy="8" rx="6" ry="3" transform="rotate(-30, 12, 8)" fill="#3B82F6" opacity="0.5" />
        <ellipse cx="8" cy="18" rx="6" ry="3" transform="rotate(-20, 8, 18)" fill="#3B82F6" opacity="0.4" />
        <ellipse cx="6" cy="28" rx="6" ry="3" transform="rotate(-10, 6, 28)" fill="#3B82F6" opacity="0.3" />
      </g>

      {/* Laurel — right */}
      <g className="ath-laurel-r" transform="translate(156, 100)">
        <path d="M0,0 C10,8 16,20 16,34" stroke="#6366F1" strokeWidth="1.5" fill="none" />
        <ellipse cx="8" cy="8" rx="6" ry="3" transform="rotate(30, 8, 8)" fill="#6366F1" opacity="0.5" />
        <ellipse cx="12" cy="18" rx="6" ry="3" transform="rotate(20, 12, 18)" fill="#6366F1" opacity="0.4" />
        <ellipse cx="14" cy="28" rx="6" ry="3" transform="rotate(10, 14, 28)" fill="#6366F1" opacity="0.3" />
      </g>

      {/* Confetti dots */}
      <g className="ath-confetti">
        <rect x="70" y="38" width="4" height="4" rx="1" fill="#3B82F6" opacity="0.3" transform="rotate(20, 72, 40)" />
        <rect x="168" y="42" width="4" height="4" rx="1" fill="#6366F1" opacity="0.3" transform="rotate(-15, 170, 44)" />
        <circle cx="85" cy="50" r="2" fill="#6366F1" opacity="0.2" />
        <circle cx="160" cy="35" r="2.5" fill="#3B82F6" opacity="0.2" />
      </g>

      {/* Sparkles */}
      <g className="ath-sparkle" transform="translate(175, 95)" style={{ transformOrigin: '179px 99px' }}>
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
      </g>
      <g className="ath-sparkle" transform="translate(52, 50)" style={{ transformOrigin: '55px 53px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
      </g>
    </svg>
  )
}
