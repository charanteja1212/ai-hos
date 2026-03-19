"use client"

/**
 * Custom medical illustration SVGs for AI-HOS brand identity.
 * Used on login pages, empty states, and onboarding.
 */

export function MedicalHeroIllustration({ className = "w-80 h-80" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background circle */}
      <circle cx="200" cy="200" r="180" fill="url(#heroGrad)" opacity="0.08" />
      <circle cx="200" cy="200" r="140" fill="url(#heroGrad)" opacity="0.06" />

      {/* Hospital building */}
      <rect x="140" y="120" width="120" height="160" rx="8" fill="url(#heroGrad)" opacity="0.15" />
      <rect x="155" y="130" width="90" height="50" rx="4" fill="white" opacity="0.9" />
      <rect x="155" y="190" width="40" height="40" rx="4" fill="white" opacity="0.7" />
      <rect x="205" y="190" width="40" height="40" rx="4" fill="white" opacity="0.7" />
      <rect x="175" y="240" width="50" height="40" rx="4" fill="url(#heroGrad)" opacity="0.3" />

      {/* Cross symbol */}
      <rect x="188" y="138" width="24" height="8" rx="2" fill="#0891B2" />
      <rect x="196" y="130" width="8" height="24" rx="2" fill="#0891B2" />

      {/* Heartbeat line */}
      <path
        d="M80 220 L120 220 L135 195 L150 240 L165 210 L175 220 L320 220"
        stroke="#0891B2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.6"
      />

      {/* Floating elements — stethoscope circle */}
      <circle cx="90" cy="150" r="25" fill="#0891B2" opacity="0.1" />
      <circle cx="90" cy="150" r="15" stroke="#0891B2" strokeWidth="2" fill="none" opacity="0.4" />
      <path d="M90 165 L90 185 Q90 195 100 195" stroke="#0891B2" strokeWidth="2" fill="none" opacity="0.4" />

      {/* DNA helix */}
      <path d="M310 130 Q325 150 310 170 Q295 190 310 210" stroke="#22D3EE" strokeWidth="2" fill="none" opacity="0.4" />
      <path d="M320 130 Q305 150 320 170 Q335 190 320 210" stroke="#0891B2" strokeWidth="2" fill="none" opacity="0.3" />
      <line x1="310" y1="140" x2="320" y2="140" stroke="#0891B2" strokeWidth="1.5" opacity="0.3" />
      <line x1="310" y1="160" x2="320" y2="160" stroke="#0891B2" strokeWidth="1.5" opacity="0.3" />
      <line x1="310" y1="180" x2="320" y2="180" stroke="#0891B2" strokeWidth="1.5" opacity="0.3" />
      <line x1="310" y1="200" x2="320" y2="200" stroke="#0891B2" strokeWidth="1.5" opacity="0.3" />

      {/* Shield / security */}
      <path
        d="M320 260 L320 290 Q320 310 300 320 Q280 310 280 290 L280 260 L300 250 Z"
        fill="#0891B2"
        opacity="0.1"
        stroke="#0891B2"
        strokeWidth="1.5"
        strokeOpacity="0.3"
      />
      <path d="M293 280 L298 288 L310 272" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />

      {/* Dots decoration */}
      <circle cx="70" cy="280" r="4" fill="#22D3EE" opacity="0.3" />
      <circle cx="85" cy="295" r="3" fill="#0891B2" opacity="0.2" />
      <circle cx="75" cy="310" r="5" fill="#22D3EE" opacity="0.15" />
      <circle cx="340" cy="320" r="4" fill="#0891B2" opacity="0.2" />
      <circle cx="355" cy="310" r="3" fill="#22D3EE" opacity="0.3" />

      <defs>
        <linearGradient id="heroGrad" x1="0" y1="0" x2="400" y2="400">
          <stop offset="0%" stopColor="#0E7490" />
          <stop offset="50%" stopColor="#0891B2" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function EmptyAppointmentsIllustration({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="100" cy="100" r="80" fill="#0891B2" opacity="0.05" />
      {/* Calendar */}
      <rect x="55" y="60" width="90" height="80" rx="8" fill="white" stroke="#0891B2" strokeWidth="1.5" strokeOpacity="0.3" />
      <rect x="55" y="60" width="90" height="20" rx="8" fill="#0891B2" opacity="0.1" />
      <rect x="65" y="56" width="4" height="12" rx="2" fill="#0891B2" opacity="0.4" />
      <rect x="131" y="56" width="4" height="12" rx="2" fill="#0891B2" opacity="0.4" />
      {/* Calendar dots */}
      <circle cx="80" cy="100" r="4" fill="#0891B2" opacity="0.15" />
      <circle cx="100" cy="100" r="4" fill="#0891B2" opacity="0.15" />
      <circle cx="120" cy="100" r="4" fill="#0891B2" opacity="0.15" />
      <circle cx="80" cy="120" r="4" fill="#0891B2" opacity="0.15" />
      <circle cx="100" cy="120" r="4" fill="#22D3EE" opacity="0.4" />
      <circle cx="120" cy="120" r="4" fill="#0891B2" opacity="0.15" />
      {/* Check mark */}
      <circle cx="100" cy="120" r="8" fill="#0891B2" opacity="0.2" />
    </svg>
  )
}

export function EmptyPatientsIllustration({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="100" cy="100" r="80" fill="#0891B2" opacity="0.05" />
      {/* Person */}
      <circle cx="100" cy="75" r="20" fill="#0891B2" opacity="0.15" stroke="#0891B2" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M65 135 Q65 105 100 105 Q135 105 135 135" fill="#0891B2" opacity="0.1" stroke="#0891B2" strokeWidth="1.5" strokeOpacity="0.3" />
      {/* Plus icon */}
      <circle cx="140" cy="130" r="16" fill="#ECFEFF" stroke="#0891B2" strokeWidth="1.5" strokeOpacity="0.4" />
      <line x1="134" y1="130" x2="146" y2="130" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="140" y1="124" x2="140" y2="136" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

export function SecureShieldIllustration({ className = "w-32 h-32" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="60" cy="60" r="50" fill="#0891B2" opacity="0.05" />
      <path
        d="M60 20 L90 35 L90 60 Q90 85 60 100 Q30 85 30 60 L30 35 Z"
        fill="url(#shieldGrad)"
        opacity="0.15"
        stroke="#0891B2"
        strokeWidth="2"
        strokeOpacity="0.4"
      />
      <path d="M48 58 L55 68 L75 45" stroke="#0891B2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <defs>
        <linearGradient id="shieldGrad" x1="30" y1="20" x2="90" y2="100">
          <stop offset="0%" stopColor="#0891B2" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
    </svg>
  )
}
