'use client'

export function IllustrationKnowledgeBase({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="kb-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="kb-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="120" cy="110" r="72" fill="url(#kb-aurora-light)" />

      {/* Decorative dots */}
      <circle cx="52" cy="60" r="3" fill="#3B82F6" opacity="0.3" />
      <circle cx="190" cy="55" r="2.5" fill="#6366F1" opacity="0.3" />
      <circle cx="45" cy="140" r="2" fill="#6366F1" opacity="0.2" />
      <circle cx="198" cy="135" r="3" fill="#3B82F6" opacity="0.2" />

      {/* Open book — left page */}
      <path
        d="M120 80 L68 72 C62 71 58 75 58 81 L58 148 C58 154 62 158 68 157 L120 150 Z"
        fill="white"
        stroke="#E5E7EB"
        strokeWidth="1"
      />
      {/* Open book — right page */}
      <path
        d="M120 80 L172 72 C178 71 182 75 182 81 L182 148 C182 154 178 158 172 157 L120 150 Z"
        fill="white"
        stroke="#E5E7EB"
        strokeWidth="1"
      />
      {/* Book spine */}
      <line x1="120" y1="80" x2="120" y2="150" stroke="url(#kb-aurora)" strokeWidth="2" />

      {/* Text lines — left page */}
      <rect x="72" y="90" width="36" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="72" y="99" width="30" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="72" y="108" width="34" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="72" y="117" width="28" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="72" y="126" width="32" height="3" rx="1.5" fill="#E5E7EB" />

      {/* Text lines — right page */}
      <rect x="132" y="90" width="36" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="132" y="99" width="30" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="132" y="108" width="34" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="132" y="117" width="28" height="3" rx="1.5" fill="#E5E7EB" />

      {/* Floating page — top left */}
      <g transform="rotate(-12, 80, 45)">
        <rect x="64" y="30" width="32" height="40" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <rect x="69" y="37" width="16" height="2" rx="1" fill="url(#kb-aurora)" opacity="0.5" />
        <rect x="69" y="42" width="22" height="2" rx="1" fill="#E5E7EB" />
        <rect x="69" y="47" width="18" height="2" rx="1" fill="#E5E7EB" />
        <rect x="69" y="52" width="20" height="2" rx="1" fill="#E5E7EB" />
      </g>

      {/* Floating page — top right */}
      <g transform="rotate(8, 168, 38)">
        <rect x="152" y="20" width="32" height="40" rx="3" fill="white" stroke="#D1D5DB" strokeWidth="0.8" />
        <rect x="157" y="27" width="16" height="2" rx="1" fill="url(#kb-aurora)" opacity="0.5" />
        <rect x="157" y="32" width="22" height="2" rx="1" fill="#E5E7EB" />
        <rect x="157" y="37" width="18" height="2" rx="1" fill="#E5E7EB" />
        <rect x="157" y="42" width="20" height="2" rx="1" fill="#E5E7EB" />
      </g>

      {/* Lightbulb icon above */}
      <g transform="translate(112, 30)">
        <path
          d="M8 0 C3.6 0 0 3.6 0 8 C0 11 1.8 13.6 4.4 14.8 L4.4 18 C4.4 19 5.2 20 6.4 20 L9.6 20 C10.8 20 11.6 19 11.6 18 L11.6 14.8 C14.2 13.6 16 11 16 8 C16 3.6 12.4 0 8 0Z"
          fill="url(#kb-aurora)"
          opacity="0.8"
        />
        <line x1="8" y1="23" x2="8" y2="26" stroke="url(#kb-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <line x1="0" y1="8" x2="-3" y2="8" stroke="url(#kb-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        <line x1="16" y1="8" x2="19" y2="8" stroke="url(#kb-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        <line x1="2.3" y1="2.3" x2="0.2" y2="0.2" stroke="url(#kb-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        <line x1="13.7" y1="2.3" x2="15.8" y2="0.2" stroke="url(#kb-aurora)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      </g>

      {/* Small sparkle stars */}
      <g transform="translate(178, 80)" opacity="0.4">
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" />
      </g>
      <g transform="translate(55, 48)" opacity="0.3">
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" />
      </g>
    </svg>
  )
}
