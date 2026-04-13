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
        <linearGradient id="ath-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
        <linearGradient id="ath-gold-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#FCD34D" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse cx="120" cy="108" rx="80" ry="72" fill="#3B82F6" opacity="0.07" />

      {/* Decorative dots */}
      <circle cx="48" cy="70" r="2.5" fill="#3B82F6" opacity="0.3" />
      <circle cx="195" cy="60" r="3" fill="#6366F1" opacity="0.3" />
      <circle cx="40" cy="150" r="2" fill="#6366F1" opacity="0.25" />
      <circle cx="200" cy="145" r="2.5" fill="#3B82F6" opacity="0.25" />

      {/* Podium base card — white card with shadow */}
      <g>
        <rect x="65" y="120" width="110" height="50" rx="10" fill="#E5E7EB" opacity="0.3" transform="translate(3, 3)" />
        <rect x="65" y="120" width="110" height="50" rx="10" fill="white" stroke="#E5E7EB" strokeWidth="1" />
        {/* Podium stripes */}
        <rect x="75" y="132" width="26" height="28" rx="4" fill="url(#ath-aurora)" opacity="0.15" />
        <rect x="107" y="126" width="26" height="34" rx="4" fill="url(#ath-aurora)" opacity="0.25" />
        <rect x="139" y="136" width="26" height="24" rx="4" fill="url(#ath-aurora)" opacity="0.12" />
        {/* Podium numbers */}
        <text x="88" y="151" fontSize="12" fontWeight="700" fill="url(#ath-aurora)" textAnchor="middle" opacity="0.5">2</text>
        <text x="120" y="149" fontSize="14" fontWeight="700" fill="url(#ath-aurora)" textAnchor="middle" opacity="0.7">1</text>
        <text x="152" y="153" fontSize="12" fontWeight="700" fill="url(#ath-aurora)" textAnchor="middle" opacity="0.4">3</text>
      </g>

      {/* Trophy — sitting on podium */}
      <g>
        {/* Trophy cup */}
        <path d="M102,68 L138,68 C138,68 140,105 120,115 C100,105 102,68 102,68 Z" fill="url(#ath-gold)" />
        {/* Cup shine */}
        <path d="M110,74 C110,74 108,98 120,108 C112,102 110,74 110,74 Z" fill="white" opacity="0.4" />
        {/* Left handle */}
        <path d="M102,76 C94,76 88,84 88,92 C88,100 94,106 102,106" stroke="url(#ath-gold)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* Right handle */}
        <path d="M138,76 C146,76 152,84 152,92 C152,100 146,106 138,106" stroke="url(#ath-gold)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* Rim */}
        <rect x="98" y="63" width="44" height="7" rx="3.5" fill="url(#ath-gold)" />
        {/* Rim shine */}
        <rect x="100" y="64" width="40" height="3" rx="1.5" fill="white" opacity="0.3" />
        {/* Stem */}
        <rect x="116" y="115" width="8" height="10" rx="2" fill="url(#ath-gold)" opacity="0.8" />
        {/* Base */}
        <rect x="106" y="123" width="28" height="5" rx="2.5" fill="url(#ath-gold)" opacity="0.7" />
      </g>

      {/* Star on trophy */}
      <g transform="translate(113, 82)">
        <path d="M7,0 L9,4.5 L14,5 L10.5,8.5 L11.5,13 L7,10.5 L2.5,13 L3.5,8.5 L0,5 L5,4.5 Z" fill="white" opacity="0.7" />
      </g>

      {/* Sparkles */}
      <g transform="translate(160, 55)">
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#F59E0B" opacity="0.6" />
      </g>
      <g transform="translate(72, 50)">
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#6366F1" opacity="0.5" />
      </g>
      <g transform="translate(168, 110)">
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.4" />
      </g>

      {/* Confetti pieces */}
      <rect x="76" y="45" width="5" height="5" rx="1" fill="#3B82F6" opacity="0.35" transform="rotate(20, 78, 47)" />
      <rect x="162" y="48" width="5" height="5" rx="1" fill="#F59E0B" opacity="0.4" transform="rotate(-15, 164, 50)" />
      <circle cx="60" cy="95" r="2.5" fill="#6366F1" opacity="0.25" />
      <circle cx="180" cy="85" r="2" fill="#F59E0B" opacity="0.3" />
    </svg>
  )
}
