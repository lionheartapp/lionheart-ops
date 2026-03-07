'use client'

export function IllustrationMaintenance({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .mnt-bg { opacity: 0; animation: mnt-fadeScale 0.6s ease-out forwards; }
        .mnt-gear { opacity: 0; animation: mnt-gearSpin 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .mnt-wrench { opacity: 0; animation: mnt-wrenchIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .mnt-gear-sm { opacity: 0; animation: mnt-gearSmIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.45s forwards; }
        .mnt-check { opacity: 0; animation: mnt-bounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .mnt-dot { opacity: 0; animation: mnt-dotFade 0.4s ease-out 0.6s forwards; }
        .mnt-sparkle { opacity: 0; animation: mnt-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes mnt-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes mnt-gearSpin { from { opacity: 0; transform: rotate(-30deg) scale(0.7); } to { opacity: 1; transform: rotate(0deg) scale(1); } }
        @keyframes mnt-wrenchIn { from { opacity: 0; transform: translate(-10px, 10px) rotate(-45deg); } to { opacity: 1; transform: translate(0, 0) rotate(-45deg); } }
        @keyframes mnt-gearSmIn { from { opacity: 0; transform: rotate(20deg) scale(0.5); } to { opacity: 1; transform: rotate(0deg) scale(1); } }
        @keyframes mnt-bounceIn { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
        @keyframes mnt-dotFade { to { opacity: 0.2; } }
        @keyframes mnt-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="maint-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="maint-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle className="mnt-bg" cx="120" cy="105" r="75" fill="url(#maint-aurora-light)" style={{ transformOrigin: '120px 105px' }} />

      {/* Decorative dots */}
      <circle className="mnt-dot" cx="44" cy="72" r="3" fill="#3B82F6" />
      <circle className="mnt-dot" cx="200" cy="58" r="2.5" fill="#6366F1" />
      <circle className="mnt-dot" cx="196" cy="155" r="2" fill="#3B82F6" />

      {/* Large gear */}
      <g className="mnt-gear" transform="translate(120, 105)" style={{ transformOrigin: '120px 105px' }}>
        <path
          d="M0,-42 L6,-38 L8,-44 L14,-40 L10,-34 L16,-28 L22,-30 L24,-22 L18,-20 L18,-14 L26,-12 L24,-4 L18,-4 L16,2 L22,6 L18,14 L12,10 L8,16 L12,22 L6,26 L2,20 L-4,22 L-4,28 L-12,26 L-12,20 L-18,16 L-22,22 L-28,16 L-22,10 L-24,4 L-30,4 L-30,-4 L-24,-6 L-22,-12 L-28,-16 L-24,-22 L-18,-18 L-14,-24 L-18,-30 L-12,-34 L-8,-28 L-4,-32 L-4,-42 L0,-42 Z"
          fill="url(#maint-aurora)"
          opacity="0.2"
          stroke="url(#maint-aurora)"
          strokeWidth="1"
          strokeOpacity="0.3"
        />
        <circle cx="0" cy="0" r="14" fill="white" stroke="url(#maint-aurora)" strokeWidth="1.5" strokeOpacity="0.4" />
        <circle cx="0" cy="0" r="5" fill="url(#maint-aurora)" opacity="0.25" />
      </g>

      {/* Wrench */}
      <g className="mnt-wrench" transform="translate(95, 68)">
        <g transform="rotate(-45)">
          <rect x="12" y="8" width="52" height="10" rx="5" fill="url(#maint-aurora)" opacity="0.7" />
          <path
            d="M0,4 C0,-2 4,-6 10,-6 L14,-6 L14,0 L10,0 C8,0 6,2 6,4 L6,22 C6,24 8,26 10,26 L14,26 L14,32 L10,32 C4,32 0,28 0,22 Z"
            fill="url(#maint-aurora)"
            opacity="0.85"
          />
          <line x1="32" y1="10" x2="32" y2="16" stroke="white" strokeWidth="1" opacity="0.4" />
          <line x1="38" y1="10" x2="38" y2="16" stroke="white" strokeWidth="1" opacity="0.4" />
          <line x1="44" y1="10" x2="44" y2="16" stroke="white" strokeWidth="1" opacity="0.4" />
        </g>
      </g>

      {/* Small gear — bottom right */}
      <g className="mnt-gear-sm" transform="translate(165, 140)" style={{ transformOrigin: '165px 140px' }}>
        <path
          d="M0,-16 L3,-14 L4,-17 L7,-15 L5,-12 L8,-10 L10,-12 L11,-8 L8,-7 L8,-4 L12,-3 L11,0 L8,0 L7,3 L10,5 L8,8 L5,6 L4,9 L6,12 L3,13 L1,10 L-1,11 L-1,14 L-5,13 L-5,10 L-8,8 L-10,11 L-13,8 L-10,5 L-11,3 L-14,3 L-14,0 L-11,-1 L-10,-4 L-13,-6 L-11,-9 L-8,-7 L-6,-10 L-8,-13 L-5,-14 L-4,-11 L-1,-13 L-1,-16 Z"
          fill="url(#maint-aurora)"
          opacity="0.15"
          stroke="url(#maint-aurora)"
          strokeWidth="0.8"
          strokeOpacity="0.3"
        />
        <circle cx="0" cy="0" r="5" fill="white" stroke="url(#maint-aurora)" strokeWidth="1" strokeOpacity="0.3" />
      </g>

      {/* Sparkle/check */}
      <g className="mnt-check" transform="translate(160, 58)" style={{ transformOrigin: '170px 68px' }}>
        <circle cx="10" cy="10" r="10" fill="url(#maint-aurora)" opacity="0.15" />
        <path d="M5,10 L9,14 L16,6" stroke="url(#maint-aurora)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </g>

      {/* Sparkle stars */}
      <g className="mnt-sparkle" transform="translate(60, 155)" style={{ transformOrigin: '64px 159px' }}>
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.3" />
      </g>
      <g className="mnt-sparkle" transform="translate(180, 85)" style={{ transformOrigin: '183px 88px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
      </g>
    </svg>
  )
}
