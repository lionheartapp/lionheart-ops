'use client'

export function IllustrationCalendar({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <style>{`
        .cal-bg { opacity: 0; animation: cal-fadeScale 0.6s ease-out forwards; }
        .cal-body { opacity: 0; animation: cal-slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s forwards; }
        .cal-header { opacity: 0; animation: cal-slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s forwards; }
        .cal-rings { opacity: 0; animation: cal-bounceIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.35s forwards; }
        .cal-days { opacity: 0; animation: cal-fadeIn 0.4s ease-out 0.4s forwards; }
        .cal-grid1 { opacity: 0; animation: cal-fadeIn 0.3s ease-out 0.45s forwards; }
        .cal-grid2 { opacity: 0; animation: cal-fadeIn 0.3s ease-out 0.5s forwards; }
        .cal-grid3 { opacity: 0; animation: cal-fadeIn 0.3s ease-out 0.55s forwards; }
        .cal-grid4 { opacity: 0; animation: cal-fadeIn 0.3s ease-out 0.6s forwards; }
        .cal-pencil { opacity: 0; animation: cal-pencilIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s forwards; }
        .cal-dot { opacity: 0; animation: cal-dotFade 0.4s ease-out 0.6s forwards; }
        .cal-sparkle { opacity: 0; animation: cal-sparklePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.7s forwards; }

        @keyframes cal-fadeScale { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes cal-slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cal-slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cal-bounceIn { from { opacity: 0; transform: scaleY(0.3); } to { opacity: 1; transform: scaleY(1); } }
        @keyframes cal-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cal-pencilIn { from { opacity: 0; transform: translate(8px, -8px) rotate(25deg); } to { opacity: 1; transform: translate(0, 0) rotate(25deg); } }
        @keyframes cal-dotFade { to { opacity: 0.25; } }
        @keyframes cal-sparklePop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <defs>
        <linearGradient id="cal-aurora" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="cal-aurora-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.12" />
        </linearGradient>
      </defs>

      {/* Background blob */}
      <ellipse className="cal-bg" cx="120" cy="108" rx="80" ry="72" fill="url(#cal-aurora-light)" style={{ transformOrigin: '120px 108px' }} />

      {/* Decorative dots */}
      <circle className="cal-dot" cx="48" cy="70" r="2.5" fill="#3B82F6" />
      <circle className="cal-dot" cx="195" cy="60" r="3" fill="#6366F1" />
      <circle className="cal-dot" cx="40" cy="150" r="2" fill="#6366F1" />

      {/* Calendar body */}
      <g className="cal-body">
        <rect x="62" y="52" width="120" height="120" rx="12" fill="#E5E7EB" opacity="0.3" transform="translate(3, 3)" />
        <rect x="62" y="52" width="120" height="120" rx="12" fill="white" stroke="#E5E7EB" strokeWidth="1" />
      </g>

      {/* Calendar header bar */}
      <g className="cal-header">
        <rect x="62" y="52" width="120" height="28" rx="12" fill="url(#cal-aurora)" />
        <rect x="62" y="68" width="120" height="12" fill="url(#cal-aurora)" />
      </g>

      {/* Calendar ring holes */}
      <g className="cal-rings" style={{ transformOrigin: '120px 54px' }}>
        <rect x="88" y="46" width="4" height="16" rx="2" fill="url(#cal-aurora)" />
        <rect x="118" y="46" width="4" height="16" rx="2" fill="url(#cal-aurora)" />
        <rect x="148" y="46" width="4" height="16" rx="2" fill="url(#cal-aurora)" />
      </g>

      {/* Day labels */}
      <g className="cal-days">
        <text x="82" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">S</text>
        <text x="96" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">M</text>
        <text x="110" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">T</text>
        <text x="124" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">W</text>
        <text x="138" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">T</text>
        <text x="152" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">F</text>
        <text x="166" y="72" fontSize="6" fill="white" fontWeight="600" opacity="0.9">S</text>
      </g>

      {/* Date grid — row 1 */}
      <g className="cal-grid1">
        <text x="82" y="94" fontSize="7" fill="#9CA3AF">1</text>
        <text x="96" y="94" fontSize="7" fill="#6B7280">2</text>
        <text x="110" y="94" fontSize="7" fill="#6B7280">3</text>
        <text x="124" y="94" fontSize="7" fill="#6B7280">4</text>
        <text x="138" y="94" fontSize="7" fill="#6B7280">5</text>
        <text x="152" y="94" fontSize="7" fill="#6B7280">6</text>
        <text x="166" y="94" fontSize="7" fill="#9CA3AF">7</text>
      </g>

      {/* Date grid — row 2 */}
      <g className="cal-grid2">
        <text x="82" y="110" fontSize="7" fill="#9CA3AF">8</text>
        <text x="96" y="110" fontSize="7" fill="#6B7280">9</text>
        <text x="108" y="110" fontSize="7" fill="#6B7280">10</text>
        <text x="122" y="110" fontSize="7" fill="#6B7280">11</text>
        <circle cx="141" cy="107" r="7" fill="url(#cal-aurora)" opacity="0.15" />
        <text x="138" y="110" fontSize="7" fill="#4F46E5" fontWeight="700">12</text>
        <text x="152" y="110" fontSize="7" fill="#6B7280">13</text>
        <text x="165" y="110" fontSize="7" fill="#9CA3AF">14</text>
      </g>

      {/* Date grid — row 3 */}
      <g className="cal-grid3">
        <text x="81" y="126" fontSize="7" fill="#9CA3AF">15</text>
        <text x="95" y="126" fontSize="7" fill="#6B7280">16</text>
        <text x="109" y="126" fontSize="7" fill="#6B7280">17</text>
        <text x="123" y="126" fontSize="7" fill="#6B7280">18</text>
        <text x="137" y="126" fontSize="7" fill="#6B7280">19</text>
        <text x="151" y="126" fontSize="7" fill="#6B7280">20</text>
        <text x="165" y="126" fontSize="7" fill="#9CA3AF">21</text>
      </g>

      {/* Date grid — row 4 */}
      <g className="cal-grid4">
        <text x="81" y="142" fontSize="7" fill="#9CA3AF">22</text>
        <text x="95" y="142" fontSize="7" fill="#6B7280">23</text>
        <text x="109" y="142" fontSize="7" fill="#6B7280">24</text>
        <text x="123" y="142" fontSize="7" fill="#6B7280">25</text>
        <text x="137" y="142" fontSize="7" fill="#6B7280">26</text>
        <text x="151" y="142" fontSize="7" fill="#6B7280">27</text>
        <text x="165" y="142" fontSize="7" fill="#9CA3AF">28</text>
      </g>

      {/* Small event indicators */}
      <g className="cal-grid2">
        <circle cx="99" cy="97" r="1.5" fill="#3B82F6" opacity="0.5" />
      </g>
      <g className="cal-grid3">
        <circle cx="127" cy="129" r="1.5" fill="#6366F1" opacity="0.5" />
      </g>
      <g className="cal-grid2">
        <circle cx="155" cy="113" r="1.5" fill="#3B82F6" opacity="0.4" />
      </g>

      {/* Pencil */}
      <g className="cal-pencil" transform="translate(170, 38)">
        <g transform="rotate(25)">
          <rect x="0" y="0" width="5" height="36" rx="1" fill="#FCD34D" />
          <rect x="0" y="0" width="5" height="6" rx="1" fill="#F59E0B" />
          <polygon points="0,36 5,36 2.5,42" fill="#374151" />
          <rect x="0" y="30" width="5" height="3" fill="#D1D5DB" />
        </g>
      </g>

      {/* Sparkles */}
      <g className="cal-sparkle" transform="translate(50, 88)" style={{ transformOrigin: '54px 92px' }}>
        <path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill="#6366F1" opacity="0.35" />
      </g>
      <g className="cal-sparkle" transform="translate(192, 130)" style={{ transformOrigin: '195px 133px' }}>
        <path d="M3 0 L3.75 2.25 L6 3 L3.75 3.75 L3 6 L2.25 3.75 L0 3 L2.25 2.25 Z" fill="#3B82F6" opacity="0.25" />
      </g>
    </svg>
  )
}
