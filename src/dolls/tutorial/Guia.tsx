import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { todasLasCartasDelJuego } from '../cards/store'
import { usePortrait } from '../card3d/portraits'
import { sfx } from '../battle/sfx'

/**
 * **Bigotes, el sheriff del pueblo**: el que te enseña el juego. Habla en bocadillos cortos (lo
 * justo para entenderlo; lo demás, en "Más info"), te pone misiones que se cumplen haciéndolas y
 * te da una estrella de sheriff por cada una.
 */

/** Los capítulos del tutorial (la barra de arriba del bocadillo). */
export const CAPITULOS = ['🏘️ El pueblo', '⚔️ El duelo', '🎉 ¡Listo!'] as const

/** Las estrellas que se pueden ganar: 5 en el pueblo y 4 en el duelo. */
export const ESTRELLAS_TOTALES = 9

/** La cara de Bigotes: el retrato del vaquero de siempre. */
export function useCaraDelGuia(): string | null {
  const carta = useMemo(() => {
    const todas = todasLasCartasDelJuego()
    return todas.find((c) => c.id === 'vaquero') ?? todas.find((c) => c.kind === 'batalla') ?? todas[0]!
  }, [])
  return usePortrait(carta)
}

/** La cara de Bigotes en su chapa de sheriff. */
export function CaraDelGuia({ tam = 64, habla = false }: { tam?: number; habla?: boolean }) {
  const cara = useCaraDelGuia()
  return (
    <span className={`relative block shrink-0 ${habla ? 'guia-habla' : ''}`} style={{ width: tam, height: tam }}>
      <span
        className="absolute inset-0 overflow-hidden rounded-full border-[3px] border-amber-300 bg-gradient-to-b from-[#f7c56b] to-[#b8692f] shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
      >
        {cara ? (
          <img src={cara} alt="" draggable={false} className="h-[150%] w-full object-cover object-top" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[30px]">🤠</span>
        )}
      </span>
      <span className="absolute -bottom-1 -right-1 text-[20px] drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]">⭐</span>
    </span>
  )
}

/**
 * El bocadillo de Bigotes. Arriba los capítulos y las estrellas que llevas; luego su cara y lo que
 * dice; la misión (si la hay: se cumple haciéndola, sin botón de siguiente) y los botones.
 */
export function Bocadillo({
  capitulo,
  paso,
  pasos,
  estrellas,
  titulo,
  children,
  masInfo,
  mision,
  onAtras,
  onSiguiente,
  siguiente = 'Siguiente',
}: {
  /** 0 = pueblo, 1 = duelo, 2 = final. */
  capitulo: number
  /** Por qué paso va dentro del capítulo (empieza en 0) y cuántos tiene. */
  paso: number
  pasos: number
  estrellas: number
  titulo: string
  children: ReactNode
  /** Lo que explica el porqué: plegado, para quien quiera saber más. */
  masInfo?: ReactNode
  /** Lo que tienes que hacer tú. */
  mision?: ReactNode
  onAtras?: () => void
  onSiguiente?: () => void
  siguiente?: string
}) {
  const [info, setInfo] = useState(false)
  return (
    <div className="guia-pop pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-2xl border-[3px] border-[#2a1a10] bg-[#fdf3dc] shadow-[0_14px_40px_rgba(0,0,0,0.7)]">
      {/* Capítulos y estrellas */}
      <div className="flex items-center gap-1 bg-[#2a1a10] px-2 py-1">
        {CAPITULOS.map((nombre, i) => (
          <span
            key={nombre}
            className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px] font-black uppercase tracking-wide ${
              i === capitulo ? 'bg-amber-400 text-[#2a1a10]' : i < capitulo ? 'text-emerald-300' : 'text-amber-100/40'
            }`}
          >
            {i < capitulo ? '✔ ' : ''}
            {nombre}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-0.5 rounded-full bg-black/40 px-2 py-0.5 text-[12px] font-black text-amber-200">
          ⭐ {estrellas}/{ESTRELLAS_TOTALES}
        </span>
      </div>
      {/* Los pasos del capítulo */}
      <div className="flex gap-0.5 px-2 pt-1.5">
        {Array.from({ length: pasos }).map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= paso ? 'bg-[#c2410c]' : 'bg-[#2a1a10]/15'}`} />
        ))}
      </div>

      <div className="flex gap-2.5 p-2.5 pb-2">
        <CaraDelGuia habla />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#a15b1c]">Bigotes, el sheriff</p>
          <p className="font-west text-[19px] leading-[1.05] text-[#2a1a10]">{titulo}</p>
          <div className="mt-1 space-y-1 text-[14px] leading-snug text-[#3b2410]">{children}</div>
        </div>
      </div>

      {mision && (
        <div className="mx-2.5 mb-2 flex items-center gap-2 rounded-xl border-2 border-dashed border-[#c2410c]/60 bg-amber-200/60 px-2.5 py-2 text-[14px] font-bold leading-snug text-[#3b1d07]">
          <span className="tuto-latido text-[22px]">👉</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-[#c2410c]">Tu misión · ⭐</span>
            {mision}
          </span>
        </div>
      )}

      {masInfo && (
        <div className="mx-2.5 mb-2">
          <button
            type="button"
            onClick={() => setInfo((v) => !v)}
            className="text-[12px] font-bold uppercase tracking-wider text-[#a15b1c] underline decoration-dotted underline-offset-2"
          >
            💡 {info ? 'Menos info' : 'Más info'}
          </button>
          {info && <p className="guia-pop mt-1 rounded-lg bg-amber-100 px-2 py-1.5 text-[13px] leading-snug text-[#3b2410]">{masInfo}</p>}
        </div>
      )}

      {(onAtras || onSiguiente) && (
        <div className="flex gap-2 px-2.5 pb-2.5">
          {onAtras && (
            <button type="button" onClick={onAtras} className="boton boton-fantasma px-4 py-2 text-[15px]">
              ‹
            </button>
          )}
          {onSiguiente && (
            <button type="button" onClick={onSiguiente} className="boton flex-1 py-2 text-[15px]">
              {siguiente} ›
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Confeti de colores (posiciones fijas: no cambian al repintar). */
const CONFETI = Array.from({ length: 34 }, (_, i) => ({
  x: ((i * 61) % 100) - 50,
  giro: (i * 47) % 360,
  color: ['#fbbf24', '#ef4444', '#22c55e', '#38bdf8', '#e879f9', '#fde68a'][i % 6]!,
  retraso: (i % 7) * 0.04,
  caida: 55 + ((i * 13) % 35),
}))

/**
 * **¡Misión cumplida!** El sello que sale al hacer una misión: una estrella que salta, confeti y su
 * sonido. Dura un segundo y medio y se va solo.
 */
export function Celebracion({ texto, onFin }: { texto: string; onFin: () => void }) {
  useEffect(() => {
    sfx.invocar('especial')
    const reloj = window.setTimeout(onFin, 1500)
    return () => window.clearTimeout(reloj)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="pointer-events-none absolute inset-0 z-[95] flex items-center justify-center">
      <div className="relative">
        {CONFETI.map((c, i) => (
          <span
            key={i}
            className="guia-confeti absolute left-1/2 top-1/2 block h-3 w-2 rounded-[2px]"
            style={
              {
                background: c.color,
                '--x': `${c.x * 3.4}px`,
                '--y': `${c.caida * 3}px`,
                '--giro': `${c.giro + 540}deg`,
                animationDelay: `${c.retraso}s`,
              } as CSSProperties
            }
          />
        ))}
        <div className="guia-sello flex flex-col items-center rounded-3xl border-4 border-amber-300 bg-[#2a1a10]/95 px-7 py-4 text-center shadow-[0_0_40px_rgba(251,191,36,0.6)]">
          <span className="guia-estrella text-[54px] leading-none">⭐</span>
          <span className="mt-1 font-west text-[26px] leading-none text-amber-100">{texto}</span>
          <span className="mt-1 text-[12px] font-black uppercase tracking-[0.3em] text-amber-300">+1 estrella de sheriff</span>
        </div>
      </div>
    </div>
  )
}
