'use client'

export function IllustrationAthletics({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
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
      <ellipse cx="120" cy="108" rx="82" ry="70" fill="url(#ath-aurora-light)" />

      {/* Decorative dots */}
      <circle cx="42" cy="65" r="2.5" fill="#3B82F6" opacity="0.25" />
      <circle cx="200" cy="55" r="3" fill="#6366F1" opacity="0.2" />
      <circle cx="50" cy="155" r="2" fill="#6366F1" opacity="0.15" />
      <circle cx="195" cy="150" r="2.5" fill="#3B82F6" opacity="0.2" />

      {/* Trophy cup */}
      <g transform="translate(82, 58)">
        {/* Cup body */}
        <path
          d="M20,10 L56,10 C56,10 58,50 38,60 C18,50 20,10 20,10 Z"
          fill="url(#ath-aurora)"
          opacity="0.8"
        />
        {/* Cup shine */}
        <path
          d="M28,16 C28,16 26,42 38,52 C30,46 28,16 28,16 Z"
          fill="white"
          opacity="0.3"
        />
        {/* Left handle */}
        <path
          d="M20,16 C14,16 8,22 8,30 C8,38 14,44 20,44"
          stroke="url(#ath-aurora)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        {/* Right handle */}
        <path
          d="M56,16 C62,16 68,22 68,30 C68,38 62,44 56,44"
          stroke="url(#ath-aurora)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        {/* Cup rim */}
        <rect x="16" y="6" width="44" height="6" rx="3" fill="url(#ath-aurora)" opacity="0.9" />
        {/* Stem */}
        <rect x="34" y="60" width="8" height="14" rx="2" fill="url(#ath-aurora)" opacity="0.6" />
        {/* Base */}
        <rect x="24" y="72" width="28" height="6" rx="3" fill="url(#ath-aurora)" opacity="0.7" />
      </g>

      {/* Star above trophy */}
      <g transform="translate(112, 26)">
        <path
          d="M8,0 L10.5,5.5 L16,6 L12,10.5 L13,16 L8,13 L3,16 L4,10.5 L0,6 L5.5,5.5 Z"
          fill="url(#ath-aurora)"
          opacity="0.6"
        />
      </g>

      {/* Laurel — left */}
      <g transform="translate(64, 100)" opacity="0.35">
        <path d="M20,0 C10,8 4,20 4,34" stroke="#3B82F6" strokeWidth="1.5" fill="none" />
        <ellipse cx="12" cy="8" rx="6" ry="3" transform="rotate(-30, 12, 8)" fill="#3B82F6" opacity="0.5" />
        <ellipse cx="8" cy="18" rx="6" ry="3" transform="rotate(-20, 8, 18)" fill="#3B82F6" opacity="0.4" />
        <ellipse cx="6" cy="28" rx="6" ry="3" transform="rotate(-10, 6, 28)" fill="#3B82F6" opacity="0.3" />
      </g>

      {/* Laurel — right */}
      <g transform="translate(156, 100)" opacity="0.35">
        <path d="M0,0 C10,8 16,20 16,34" stroke="#6366F1" strokeWidth="1.5" fill="none" />
        <ellipse cx="8" cy="8" rx="6" ry="3" transform="rotate(30, 8, 8)" fill="#6366F1" opacity="0.5" />
        <ellipse cx="12" cy="18" rx="6" ry="3" transform="rotate(20, 12, 18)" fill="#6366F1" opacity="0.4" />
        <ellipse cx="14" cy="28" rx="6" ry="3" transform="rotate(10, 14, 28)" fill="#6366F1" opacity="0.3" />
      </g>

      {/* Confetti dots */}
      <rect x="70" y="38" width="4" height="4" rx="1" fill="#3B82F6" opacity="0.3" transform="rotate(20, 72, 40)" />
      <rect x="168" y="42" width="4" height="4" rx="1" fill="#6366F1" opacity="0.3" transform="rotate(-15, 170, 44)" />
      <circle cx="85" cy="50" r="2" fill="#6366F1" opacity="0.2" />
      <circle cx="160" cy="35" r="2.5" fill="#3B82F6" opacity="0.2" />

      {/* Sparkle */}
      <g transform="translate(175, 95)" opacity="0.3">
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" />
      </g>
      <g transform="translate(52, 50)" opacity="0.25">
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" />
      </g>
    </svg>
  )
}
