import { useId } from 'react'

/**
 * El engranaje del Oeste: la rodaja de una espuela, que es un engranaje con estrella. Ocho puntas
 * gordas, el buje en el centro y el laton de siempre, para que pegue con el resto del juego.
 */
function rodaja(puntas = 8, radio = 10, valle = 5.4): string {
  const puntos: string[] = []
  for (let i = 0; i < puntas * 2; i++) {
    const angulo = -Math.PI / 2 + (i * Math.PI) / puntas
    const r = i % 2 === 0 ? radio : valle
    puntos.push(`${(12 + Math.cos(angulo) * r).toFixed(2)} ${(12 + Math.sin(angulo) * r).toFixed(2)}`)
  }
  return `M${puntos.join(' L')} Z`
}

const RODAJA = rodaja()

export function WesternGear({ className = 'h-6 w-6' }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#ffeeb8" />
          <stop offset="0.42" stopColor="#e0b463" />
          <stop offset="1" stopColor="#8a5a1e" />
        </linearGradient>
      </defs>
      <path d={RODAJA} fill={`url(#${id})`} stroke="#3b2410" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.9" fill="#2a1707" stroke="#e0b463" strokeWidth="1.1" />
      <circle cx="12" cy="12" r="1.5" fill="#f5d69a" />
    </svg>
  )
}
