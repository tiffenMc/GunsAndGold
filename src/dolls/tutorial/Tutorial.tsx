import { useCallback, useState } from 'react'
import { PartidaDeEjemplo } from './PartidaDeEjemplo'
import { TourDeMenus } from './TourDeMenus'
import type { Donde, PantallaDelTour } from './TourDeMenus'
import { CaraDelGuia, Celebracion, ESTRELLAS_TOTALES } from './Guia'
import { useEscalaPc } from '../escalaPc'

/** Se apunta por personaje: si se cierra el juego a medias, el tutorial vuelve a salir al entrar. */
const CLAVE = (jugadorId: string) => `oeste-tutorial-pendiente:${jugadorId}`

export function marcarTutorialPendiente(jugadorId: string, pendiente: boolean) {
  try {
    if (pendiente) localStorage.setItem(CLAVE(jugadorId), '1')
    else localStorage.removeItem(CLAVE(jugadorId))
  } catch {
    // Sin almacenamiento: el tutorial sale solo esta vez.
  }
}

export function tutorialPendiente(jugadorId: string): boolean {
  try {
    return localStorage.getItem(CLAVE(jugadorId)) === '1'
  } catch {
    return false
  }
}

/**
 * **El tutorial** de un personaje nuevo, con Bigotes el sheriff, en tres capítulos: el paseo por el
 * pueblo (con misiones), el duelo de práctica (se aprende jugando) y la fiesta del final. Cada
 * misión cumplida da una estrella de sheriff. Se puede omitir en cualquier momento dejando pulsado
 * el botón de omitir.
 */
export function Tutorial({
  irA,
  donde,
  onTerminar,
}: {
  irA: (pantalla: PantallaDelTour) => void
  /** Donde anda el jugador (para las misiones del pueblo). */
  donde: Donde
  onTerminar: () => void
}) {
  const [tramo, setTramo] = useState<'pueblo' | 'duelo' | 'fin'>('pueblo')
  const [estrellas, setEstrellas] = useState(0)
  /** La celebración que se está viendo ("¡Buen paso!", "¡Torre en pie!"…). */
  const [fiesta, setFiesta] = useState<{ texto: string; n: number } | null>(null)
  const escala = useEscalaPc()

  const onMision = useCallback((texto: string) => {
    setEstrellas((n) => Math.min(ESTRELLAS_TOTALES, n + 1))
    setFiesta((antes) => ({ texto, n: (antes?.n ?? 0) + 1 }))
  }, [])
  const celebracion = fiesta && <Celebracion key={fiesta.n} texto={fiesta.texto} onFin={() => setFiesta(null)} />

  if (tramo === 'pueblo') {
    return (
      <>
        <TourDeMenus
          irA={irA}
          donde={donde}
          estrellas={estrellas}
          onMision={onMision}
          onAcabado={() => setTramo('duelo')}
          onOmitir={onTerminar}
        />
        {celebracion}
      </>
    )
  }

  if (tramo === 'duelo') {
    return (
      // La batalla es vertical: como la de verdad, con forma de móvil y centrada.
      <div className="absolute inset-0 z-[80] flex justify-center bg-[#0c0804]">
        <div className="relative h-full w-full" style={{ maxWidth: 'min(100%, calc(100dvh * 9 / 16))' }}>
          <PartidaDeEjemplo estrellas={estrellas} onMision={onMision} onAcabado={() => setTramo('fin')} onOmitir={onTerminar} />
          {celebracion}
        </div>
      </div>
    )
  }

  // La fiesta del final: las estrellas ganadas y lo más importante, en tres dibujos.
  const rango = estrellas >= ESTRELLAS_TOTALES ? 'Sheriff de honor' : estrellas >= 6 ? 'Ayudante del sheriff' : 'Forastero con futuro'
  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center overflow-hidden p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #6b3a12 0%, #1d0f06 60%, #070402 100%)' }}
    >
      <div
        className="revelar-rayos pointer-events-none absolute left-1/2 top-[40%] aspect-square w-[180vmax] opacity-60"
        style={{ background: 'repeating-conic-gradient(from 0deg, #fbbf2455 0deg 6deg, transparent 6deg 18deg)' }}
      />
      <div className="guia-pop relative w-full max-w-[400px] text-center" style={escala > 1 ? { zoom: escala } : undefined}>
        <div className="flex justify-center">
          <CaraDelGuia tam={96} habla />
        </div>
        <p className="mt-2 font-west text-[32px] leading-none text-amber-100" style={{ textShadow: '0 3px 0 #7a2d0c' }}>
          ¡Ya eres de los nuestros!
        </p>
        {/* Las estrellas ganadas, una a una */}
        <div className="mt-3 flex justify-center gap-1">
          {Array.from({ length: ESTRELLAS_TOTALES }).map((_, i) => (
            <span
              key={i}
              className={`text-[26px] ${i < estrellas ? 'guia-estrella-fin' : 'opacity-20 grayscale'}`}
              style={{ animationDelay: `${0.3 + i * 0.12}s` }}
            >
              ⭐
            </span>
          ))}
        </div>
        <p className="mt-1 text-[13px] font-black uppercase tracking-[0.25em] text-amber-300">
          {estrellas}/{ESTRELLAS_TOTALES} · {rango}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-[12.5px] leading-snug text-amber-50">
          {[
            ['✍️', 'Dibuja bien el patrón: ¡más fuerza!'],
            ['🏰', 'Torre para defender, soldado para atacar'],
            ['📈', 'Entrena, incursiona y sube de rango'],
          ].map(([icono, texto]) => (
            <div key={texto} className="rounded-xl border-2 border-amber-300/40 bg-black/40 p-2">
              <p className="text-[28px] leading-none">{icono}</p>
              <p className="mt-1">{texto}</p>
            </div>
          ))}
        </div>

        <button type="button" onClick={onTerminar} className="clase-boton boton relative mt-5 w-full overflow-hidden py-3 text-[17px]">
          📦 ¡Abrir mis sobres de regalo!
        </button>
        <p className="mt-1.5 text-[12px] text-amber-100/60">Puedes repetir el tutorial cuando quieras desde ⚙️ Ajustes.</p>
      </div>
    </div>
  )
}
