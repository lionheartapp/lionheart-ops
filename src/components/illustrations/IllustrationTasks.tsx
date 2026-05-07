'use client'

export function IllustrationTasks({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .task-bg, .task-body, .task-row1, .task-row2, .task-row3, .task-check, .task-dot, .task-sparkle { animation: none !important; opacity: 1 !important; }
        }
        .task-bg { opacity: 0; animation: task-fadeScale 0.6s ease-out forwards; }
        .task-body { opacity: 0; animation: task-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .task-row1 { opacity: 0; animation: task-fadeIn 0.3s ease-out 0.3s forwards; }
        .task-row2 { opacity: 0; animation: task-fadeIn 0.3s ease-out 0.4s forwards; }
        .task-row3 { opacity: 0; animation: task-fadeIn 0.3s ease-out 0.5s forwards; }
        .task-check { opacity: 0; animation: task-checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.55s forwards; }
        .task-dot { opacity: 0; animation: task-dotFade 0.4s ease-out 0.6s forwards; }
        .task-sparkle { opacity: 0; animation: task-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes task-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes task-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes task-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes task-checkPop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes task-dotFade { to { opacity: 0.25; } }
        @keyframes task-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="task-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="task-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="task-bg" cx="120" cy="108" rx="80" ry="72" fill="url(#task-aurora-light)" style={{ transformOrigin: '120px 108px' }} />

      {/* Decorative dots */}
      <circle className="task-dot" cx="50" cy="68" r="2.5" fill="#3B82F6" />
      <circle className="task-dot" cx="192" cy="58" r="3" fill="#6366F1" />
      <circle className="task-dot" cx="44" cy="148" r="2" fill="#6366F1" />

      {/* Clipboard body */}
      <g className="task-body">
        <rect x="70" y="46" width="104" height="130" rx="10" fill="#E5E7EB" opacity="0.3" transform="translate(3, 3)" />
        <rect x="70" y="46" width="104" height="130" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="1" />
        {/* Clipboard clip */}
        <rect x="100" y="38" width="44" height="18" rx="5" fill="url(#task-aurora)" />
        <rect x="108" y="42" width="28" height="10" rx="3" fill="white" opacity="0.3" />
      </g>

      {/* Task row 1 — completed */}
      <g className="task-row1">
        <circle cx="90" cy="82" r="7" fill="#10B981" opacity="0.15" />
        <path d="M86.5 82 L89 84.5 L93.5 79.5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="104" y="79" width="54" height="6" rx="3" fill="#CBD5E1" />
      </g>

      {/* Task row 2 — completed */}
      <g className="task-row2">
        <circle cx="90" cy="106" r="7" fill="#10B981" opacity="0.15" />
        <path d="M86.5 106 L89 108.5 L93.5 103.5" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="104" y="103" width="42" height="6" rx="3" fill="#CBD5E1" />
      </g>

      {/* Task row 3 — open */}
      <g className="task-row3">
        <circle cx="90" cy="130" r="7" fill="none" stroke="#CBD5E1" strokeWidth="1.2" />
        <rect x="104" y="127" width="48" height="6" rx="3" fill="#E2E8F0" />
      </g>

      {/* Big checkmark accent */}
      <g className="task-check" style={{ transformOrigin: '176px 140px' }}>
        <circle cx="176" cy="140" r="18" fill="url(#task-aurora)" />
        <path d="M167 140 L173 146 L185 134" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shine */}
        <ellipse cx="170" cy="132" rx="4" ry="6" fill="white" opacity="0.2" transform="rotate(-20, 170, 132)" />
      </g>

      {/* Sparkles */}
      <g className="task-sparkle" style={{ transformOrigin: '186px 60px' }}>
        <path d="M186 54 L186 66 M180 60 L192 60" stroke="url(#task-aurora)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="task-sparkle" style={{ transformOrigin: '60px 120px' }}>
        <path d="M60 116 L60 124 M56 120 L64 120" stroke="#3B82F6" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      </g>
    </svg>
  )
}
