'use client'

export function IllustrationTeam({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
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
      <ellipse cx="120" cy="108" rx="82" ry="70" fill="url(#team-aurora-light)" />

      {/* Decorative dots */}
      <circle cx="42" cy="62" r="2.5" fill="#3B82F6" opacity="0.25" />
      <circle cx="200" cy="58" r="3" fill="#6366F1" opacity="0.2" />
      <circle cx="48" cy="158" r="2" fill="#6366F1" opacity="0.15" />
      <circle cx="198" cy="148" r="2.5" fill="#3B82F6" opacity="0.2" />

      {/* Center person (larger) */}
      <g transform="translate(104, 62)">
        {/* Head */}
        <circle cx="16" cy="16" r="16" fill="url(#team-aurora)" opacity="0.7" />
        {/* Body */}
        <path
          d="M0,52 C0,40 8,34 16,34 C24,34 32,40 32,52 L32,60 C32,62 30,64 28,64 L4,64 C2,64 0,62 0,60 Z"
          fill="url(#team-aurora)"
          opacity="0.5"
        />
        {/* Face highlights */}
        <circle cx="11" cy="14" r="2" fill="white" opacity="0.5" />
        <circle cx="21" cy="14" r="2" fill="white" opacity="0.5" />
        <path d="M12,20 Q16,24 20,20" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.4" />
      </g>

      {/* Left person */}
      <g transform="translate(50, 80)">
        {/* Head */}
        <circle cx="14" cy="14" r="14" fill="url(#team-aurora)" opacity="0.4" />
        {/* Body */}
        <path
          d="M0,44 C0,34 6,28 14,28 C22,28 28,34 28,44 L28,52 C28,54 26,56 24,56 L4,56 C2,56 0,54 0,52 Z"
          fill="url(#team-aurora)"
          opacity="0.25"
        />
        {/* Face */}
        <circle cx="10" cy="12" r="1.5" fill="white" opacity="0.4" />
        <circle cx="18" cy="12" r="1.5" fill="white" opacity="0.4" />
      </g>

      {/* Right person */}
      <g transform="translate(162, 80)">
        {/* Head */}
        <circle cx="14" cy="14" r="14" fill="url(#team-aurora)" opacity="0.4" />
        {/* Body */}
        <path
          d="M0,44 C0,34 6,28 14,28 C22,28 28,34 28,44 L28,52 C28,54 26,56 24,56 L4,56 C2,56 0,54 0,52 Z"
          fill="url(#team-aurora)"
          opacity="0.25"
        />
        {/* Face */}
        <circle cx="10" cy="12" r="1.5" fill="white" opacity="0.4" />
        <circle cx="18" cy="12" r="1.5" fill="white" opacity="0.4" />
      </g>

      {/* Connection lines between people */}
      <line x1="82" y1="105" x2="104" y2="95" stroke="url(#team-aurora)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.25" />
      <line x1="136" y1="95" x2="162" y2="105" stroke="url(#team-aurora)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.25" />

      {/* Shield icon — top right (for roles/permissions) */}
      <g transform="translate(166, 52)" opacity="0.35">
        <path
          d="M8,0 L16,4 L16,10 C16,15 12,19 8,20 C4,19 0,15 0,10 L0,4 Z"
          fill="url(#team-aurora)"
        />
        <path d="M5,10 L7,12 L12,7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Badge icon — top left (for team membership) */}
      <g transform="translate(58, 55)" opacity="0.3">
        <rect x="0" y="0" width="16" height="18" rx="3" fill="url(#team-aurora)" />
        <rect x="4" y="4" width="8" height="2" rx="1" fill="white" opacity="0.5" />
        <rect x="4" y="8" width="6" height="2" rx="1" fill="white" opacity="0.4" />
        <rect x="4" y="12" width="8" height="2" rx="1" fill="white" opacity="0.3" />
      </g>

      {/* Sparkle stars */}
      <g transform="translate(185, 130)" opacity="0.3">
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" />
      </g>
      <g transform="translate(42, 120)" opacity="0.25">
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" />
      </g>
    </svg>
  )
}
