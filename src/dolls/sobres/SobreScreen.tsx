import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CardDef, Rarity } from '../cards/model'
import { LEVEL_LABEL, RARITY_ORDER, SHOT_MODES, cardPower, patternLevelFor, rarityInfo, rarityOf, specialOf } from '../cards/model'
import { todasLasCartasDelJuego } from '../cards/store'
import { arquetipoInfo } from '../cards/arquetipos'
import { CardViewer } from '../card3d/CardViewer'
import { PatternGlyph } from '../deck/CardTile'
import { GameCard } from '../deck/GameCard'
import { patternById } from '../cards/patterns'
import { SafeCanvas } from '../SafeCanvas'
import { capturePointer } from '../debugClock'
import { sfx, tic } from '../battle/sfx'
import { arquetipoDe, getPlayer, progresoDe, sobresPendientes, usePlayer } from '../game/players'
import { hacer } from '../game/hacer'
import { progresoDeCarta } from '../game/progreso'

/**
 * Abrir sobres, como en los juegos de cartas de verdad:
 *
 *  1. **El sobre** se mueve con el dedo (se inclina y le corre el brillo) y **brilla del color de
 *     la mejor carta que trae**: si brilla morado o dorado, algo gordo hay dentro. Se abre
 *     arrastrando la tira de arriba (o con el botón).
 *  2. Al rasgarlo, un fogonazo, y las cartas van saliendo **de una en una, en grande**, de la más
 *     floja a la mejor. Cada una sale de espalda con el color de su rareza: se toca y se gira, con
 *     un efecto que crece con la rareza (chispas, onda, temblor… y lluvia de oro en las divinas).
 *     Otro toque y pasa a la siguiente. Con "Saltar" se ven todas.
 *  3. Al final, **el resumen**: las cartas del sobre en su rejilla. Tocando una se ve toda su ficha.
 *  4. "Abrir todos de golpe" va directo al resumen con todas las cartas.
 */

/** Una carta de las que han salido, con lo que hace falta para enseñarla. */
interface Salida {
  key: number
  card: CardDef
  /** No la tenias antes de abrir el sobre. */
  nueva: boolean
}

const NOMBRE_RAREZA: Record<Rarity, string> = { normal: 'NORMAL', especial: 'ESPECIAL', epica: 'ÉPICA', divina: 'DIVINA' }

/** Lo que se nota cada rareza al girarla: chispas, onda, temblor y fogonazo. */
const EFECTO: Record<Rarity, { chispas: number; onda: boolean; tiembla: boolean; flash: number; rayos: number }> = {
  normal: { chispas: 10, onda: false, tiembla: false, flash: 0, rayos: 0.25 },
  especial: { chispas: 18, onda: true, tiembla: false, flash: 0.25, rayos: 0.5 },
  epica: { chispas: 28, onda: true, tiembla: true, flash: 0.5, rayos: 0.8 },
  divina: { chispas: 44, onda: true, tiembla: true, flash: 0.9, rayos: 1 },
}

/** El color de cada rareza para los efectos (las normales, bronce: el gris no luce). */
function colorDe(rareza: Rarity): string {
  return rareza === 'normal' ? '#e0a85c' : rarityInfo(rareza).color
}

/** Un borde dentado (de papel rasgado) para recortar la tira y el sobre. */
function dientes(alto: number, pasos: number, desdeArriba: boolean): string {
  const puntos: string[] = []
  for (let i = 0; i <= pasos; i++) {
    const x = (i / pasos) * 100
    puntos.push(`${x}% ${i % 2 === 0 ? alto : alto - 5}px`)
  }
  return desdeArriba
    ? `polygon(0 0, 100% 0, ${puntos.reverse().join(', ')})`
    : `polygon(${puntos.join(', ')}, 100% 100%, 0 100%)`
}

const TIRA_H = 52
const TIRA_CLIP = dientes(TIRA_H, 16, true)
const CUERPO_CLIP = dientes(TIRA_H - 2, 16, false)

/** La mejor rareza que trae el siguiente sobre (para que brille de su color antes de abrirlo). */
function mejorDelSobre(ids: string[] | undefined): Rarity {
  const cartas = todasLasCartasDelJuego()
  let mejor: Rarity = 'normal'
  for (const id of ids ?? []) {
    const carta = cartas.find((item) => item.id === id)
    if (carta && RARITY_ORDER.indexOf(rarityOf(carta)) > RARITY_ORDER.indexOf(mejor)) mejor = rarityOf(carta)
  }
  return mejor
}

export function SobreScreen({ onCerrar }: { onCerrar: () => void }) {
  const player = usePlayer()
  const quedan = sobresPendientes(player)
  const [salieron, setSalieron] = useState<Salida[] | null>(null)
  /** 'revelar' = de una en una; 'resumen' = todas en la rejilla. */
  const [fase, setFase] = useState<'revelar' | 'resumen'>('revelar')
  /** La carta de la que se esta viendo la ficha entera. */
  const [ficha, setFicha] = useState<Salida | null>(null)
  const contador = useRef(1)

  /** Mientras el servidor abre el sobre (unas décimas): no se abre otro a la vez. */
  const abriendo = useRef(false)
  const [aviso, setAviso] = useState<string | null>(null)

  /**
   * Abre `cuantos` sobres seguidos (lo que sale lo decide el servidor, si lo hay). Con uno, se
   * revelan de una en una; con varios, al resumen.
   */
  const abrir = async (cuantos: number) => {
    if (abriendo.current) return
    abriendo.current = true
    setAviso(null)
    const catalogo = new Map(todasLasCartasDelJuego().map((card) => [card.id, card]))
    const nuevas: Salida[] = []
    for (let i = 0; i < cuantos; i++) {
      // Lo que llevabas de las cartas del sobre ANTES de abrirlo: asi se sabe cuales son nuevas.
      const antes = getPlayer()
      const registro: Record<string, number> = {}
      for (const id of antes.sobres[0] ?? []) registro[id] = progresoDe(antes, id)
      const hecho = await hacer({ tipo: 'abrirSobre' })
      if (hecho.error && i === 0) setAviso(hecho.error)
      const cartas = (hecho.cartas ?? []).map((id) => catalogo.get(id)).filter((card): card is CardDef => Boolean(card))
      if (cartas.length === 0) break
      const vistas = new Set<string>()
      for (const card of cartas) {
        nuevas.push({
          key: contador.current++,
          card,
          // Una repetida dentro del mismo sobre solo cuenta como nueva la primera vez.
          nueva: (registro[card.id] ?? 0) < 1 && !vistas.has(card.id),
        })
        vistas.add(card.id)
      }
    }
    abriendo.current = false
    if (nuevas.length === 0) return
    setFase(cuantos === 1 ? 'revelar' : 'resumen')
    setSalieron(nuevas)
  }

  if (!salieron) {
    return (
      <>
        <SobreAbrir quedan={quedan} brillo={mejorDelSobre(player.sobres[0])} onAbrir={(n) => void abrir(n)} onCerrar={onCerrar} />
        {aviso && <p className="absolute inset-x-4 bottom-6 z-30 rounded-xl bg-black/80 p-3 text-center text-[14px] font-bold text-rose-200">{aviso}</p>}
      </>
    )
  }

  if (fase === 'revelar') {
    return <Revelar cartas={salieron} onAcabar={() => setFase('resumen')} />
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 20%, #4a2a12 0%, #1d0f06 60%, #0b0603 100%)' }}>
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 pb-1 pt-3">
        <div>
          <p className="font-west text-[22px] leading-none text-amber-50" style={{ textShadow: '0 2px 0 #1a0d04' }}>
            ¡{salieron.length} cartas!
          </p>
          <p className="mt-0.5 text-[13px] uppercase tracking-wider text-amber-100/75">Toca una para ver todo sobre ella</p>
        </div>
        <button type="button" onClick={onCerrar} className="rounded-full border-2 border-black/40 bg-black/40 px-3 py-1 text-[13px] font-bold text-amber-100">
          SALIR
        </button>
      </div>

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
        <div className="mx-auto grid max-w-[860px] grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {salieron.map((item, i) => (
            <button
              key={item.key}
              type="button"
              className="carta-sale relative text-left"
              style={{ animationDelay: `${Math.min(i, 20) * 45}ms` }}
              onClick={() => setFicha(item)}
            >
              <span className="pointer-events-none block">
                <GameCard card={item.card} owned pill={null} corner={item.nueva ? <Nueva /> : undefined} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex gap-2 border-t-2 border-black/30 bg-[#1b1108]/90 px-3 py-3">
        {quedan > 0 ? (
          <>
            <button type="button" onClick={() => setSalieron(null)} className="boton flex-1 text-[14px]">
              📦 Siguiente sobre ({quedan})
            </button>
            <button type="button" onClick={onCerrar} className="boton boton-fantasma text-[15px]">
              Cerrar
            </button>
          </>
        ) : (
          <button type="button" onClick={onCerrar} className="boton flex-1 text-[14px]">
            ✅ Ya está
          </button>
        )}
      </div>

      {ficha && <Ficha item={ficha} onCerrar={() => setFicha(null)} />}
    </div>
  )
}

/** La chapa de "nueva" en la esquina de la carta. */
function Nueva() {
  return (
    <span className="absolute right-[5%] top-[4%] z-10 rounded bg-rose-600 px-1.5 py-0.5 font-west text-[12px] uppercase tracking-wider text-white shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
      nueva
    </span>
  )
}

// ---------------------------------------------------------------------------
// Las cartas de una en una, en grande
// ---------------------------------------------------------------------------

/** Chispas que salen disparadas desde el centro (posiciones fijas por semilla: no cambian al repintar). */
function Estallido({ color, cuantas, semilla, oro = false }: { color: string; cuantas: number; semilla: number; oro?: boolean }) {
  const chispas = useMemo(
    () =>
      Array.from({ length: cuantas }, (_, i) => {
        const a = ((i * 137.5 + semilla * 31) % 360) * (Math.PI / 180)
        const lejos = 120 + ((i * 53 + semilla * 7) % 140)
        return {
          dx: Math.cos(a) * lejos,
          dy: Math.sin(a) * lejos - (oro ? 40 : 0),
          tam: 5 + ((i * 7) % 9),
          retraso: (i % 5) * 0.03,
          dur: 0.7 + ((i * 11) % 6) * 0.08,
          moneda: oro && i % 3 === 0,
        }
      }),
    [cuantas, semilla, oro],
  )
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20">
      {chispas.map((c, i) => (
        <span
          key={i}
          className="revelar-chispa absolute rounded-full"
          style={
            {
              width: c.moneda ? c.tam + 8 : c.tam,
              height: c.moneda ? c.tam + 8 : c.tam,
              marginLeft: -c.tam / 2,
              marginTop: -c.tam / 2,
              background: c.moneda ? 'radial-gradient(circle at 35% 35%, #fff7c2, #f59e0b 55%, #92400e)' : '#fffdf2',
              boxShadow: c.moneda ? '0 0 6px #fbbf24' : `0 0 8px 2px ${color}, 0 0 16px 4px ${color}88`,
              '--dx': `${c.dx}px`,
              '--dy': `${c.dy}px`,
              animationDelay: `${c.retraso}s`,
              animationDuration: `${c.dur}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}

/**
 * La revelación: una carta en el centro, de espalda y con el color de su rareza. Toque → se gira
 * con su efecto. Toque → sale volando a la fila de abajo y llega la siguiente.
 */
function Revelar({ cartas, onAcabar }: { cartas: Salida[]; onAcabar: () => void }) {
  const [indice, setIndice] = useState(0)
  const [girada, setGirada] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  /** Cuenta los giros, para relanzar las animaciones de cada uno. */
  const [giros, setGiros] = useState(0)
  const item = cartas[indice]!
  const rareza = rarityOf(item.card)
  const color = colorDe(rareza)
  const efecto = EFECTO[rareza]
  const ultima = indice === cartas.length - 1
  const ocupado = useRef(false)
  /** Donde va la carta: tiembla con las buenas. */
  const escena = useRef<HTMLDivElement>(null)

  // El fogonazo de abrir el sobre, al entrar.
  const [abierto, setAbierto] = useState(true)
  useEffect(() => {
    const reloj = window.setTimeout(() => setAbierto(false), 700)
    return () => window.clearTimeout(reloj)
  }, [])

  const tocar = () => {
    if (ocupado.current) return
    if (!girada) {
      setGirada(true)
      setGiros((n) => n + 1)
      if (efecto.tiembla) {
        escena.current?.animate(
          [
            { transform: 'translate(0, 0)' },
            { transform: 'translate(-9px, 4px)' },
            { transform: 'translate(8px, -6px)' },
            { transform: 'translate(-6px, -3px)' },
            { transform: 'translate(5px, 4px)' },
            { transform: 'translate(0, 0)' },
          ],
          { duration: rareza === 'divina' ? 620 : 420, delay: 140, easing: 'ease-out' },
        )
      }
      if (rareza === 'normal') tic()
      else sfx.invocar(rareza)
      return
    }
    if (ultima) {
      onAcabar()
      return
    }
    // Sale volando y llega la siguiente.
    ocupado.current = true
    setSaliendo(true)
    window.setTimeout(() => {
      setSaliendo(false)
      setGirada(false)
      setIndice((i) => i + 1)
      ocupado.current = false
    }, 320)
  }

  return (
    <div
      className="absolute inset-0 z-40 flex select-none flex-col overflow-hidden"
      style={{ background: `radial-gradient(ellipse at 50% 42%, ${girada ? color : '#7a4a1c'}55 0%, #1a0d05 55%, #070402 100%), #070402`, transition: 'background 500ms' }}
      onClick={tocar}
    >
      {/* Los rayos que giran detrás de la carta: más fuertes cuanto mejor es */}
      <div
        className="revelar-rayos pointer-events-none absolute left-1/2 top-[44%] aspect-square w-[180vmax]"
        style={{
          opacity: girada ? efecto.rayos : 0.12,
          background: `repeating-conic-gradient(from 0deg, ${girada ? color : '#fbbf24'}66 0deg 6deg, transparent 6deg 18deg)`,
          transition: 'opacity 500ms',
        }}
      />

      {/* Arriba: cuántas van y saltar */}
      <div className="relative z-30 flex items-center justify-between px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="rounded-full border-2 border-amber-200/40 bg-black/50 px-3 py-1 font-west text-[16px] text-amber-100">
          {indice + 1} / {cartas.length}
        </span>
        <button
          type="button"
          onClick={(evento) => {
            evento.stopPropagation()
            onAcabar()
          }}
          className="rounded-full border-2 border-black/40 bg-black/50 px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-amber-100"
        >
          Saltar ⏭
        </button>
      </div>

      {/* La carta */}
      <div ref={escena} className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
        {girada && efecto.onda && (
          <span
            className="revelar-onda pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[70vmin] rounded-full"
            style={{ border: `6px solid ${color}`, boxShadow: `0 0 30px ${color}, inset 0 0 30px ${color}` }}
          />
        )}
        {girada && <Estallido key={giros} color={color} cuantas={efecto.chispas} semilla={giros} oro={rareza === 'divina'} />}
        <div
          key={item.key}
          className={saliendo ? 'revelar-sale' : 'revelar-entra'}
          style={{ width: 'min(64vw, 36vh, 300px)', perspective: 1100 }}
        >
          <div
            className="relative aspect-[5/7] w-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: 'transform 620ms cubic-bezier(.3,1.35,.4,1)',
              transform: girada ? 'rotateY(180deg) scale(1.04)' : 'rotateY(0deg)',
            }}
          >
            <Dorso rareza={rareza} grande />
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              {girada && (
                <div className="pointer-events-none">
                  <GameCard card={item.card} owned pill={null} corner={item.nueva ? <Nueva /> : undefined} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lo que es: rareza, nombre y si es nueva */}
      <div className="relative z-10 min-h-[92px] px-4 pb-1 text-center">
        {girada ? (
          <div key={`n${giros}`} className="revelar-nombre">
            <p className="font-west text-[14px] uppercase tracking-[0.4em]" style={{ color, textShadow: `0 0 12px ${color}` }}>
              {rareza === 'divina' ? '✨ ¡DIVINA! ✨' : rareza === 'epica' ? '◆ ¡ÉPICA! ◆' : NOMBRE_RAREZA[rareza]}
            </p>
            <p
              className="mt-1 font-west leading-none text-amber-50"
              style={{ textShadow: '0 3px 0 #000', fontSize: item.card.name.length > 15 ? 22 : 30 }}
            >
              {item.card.name}
            </p>
            <p className="mt-1.5 text-[13px] font-bold uppercase tracking-wider text-amber-100/70">
              {item.nueva ? <span className="text-emerald-300">¡Nueva para tu colección!</span> : 'Repetida · sube de nivel'}
            </p>
          </div>
        ) : (
          <p className="revelar-pulso pt-6 font-west text-[18px] text-amber-100/90">Toca para girar</p>
        )}
      </div>

      {/* Las que ya han salido, en fila */}
      <div className="relative z-10 flex justify-center gap-1.5 px-3 pb-[max(14px,env(safe-area-inset-bottom))] pt-1">
        {cartas.map((c, i) => {
          const vista = i < indice || (i === indice && girada)
          const r = rarityOf(c.card)
          return (
            <span
              key={c.key}
              className="block h-[46px] w-[33px] rounded-md border-2 transition-all duration-300"
              style={{
                borderColor: vista ? colorDe(r) : '#ffffff22',
                background: vista ? `linear-gradient(160deg, ${colorDe(r)}, #1a0d05)` : '#ffffff0d',
                boxShadow: vista && (r === 'epica' || r === 'divina') ? `0 0 10px ${colorDe(r)}` : undefined,
                transform: i === indice ? 'translateY(-4px)' : undefined,
              }}
            />
          )
        })}
      </div>

      {/* El fogonazo: al abrir el sobre y al girar las buenas */}
      {abierto && <div className="destello pointer-events-none absolute inset-0 z-40 bg-[#fff8e1]" />}
      {girada && efecto.flash > 0 && (
        <div className="pointer-events-none absolute inset-0 z-40" style={{ opacity: efecto.flash, mixBlendMode: 'screen' }}>
          <div key={`f${giros}`} className="destello absolute inset-0" style={{ background: color }} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// El sobre: se inclina con el dedo, brilla de su mejor carta y se rasga arrastrando la tira
// ---------------------------------------------------------------------------

function SobreAbrir({
  quedan,
  brillo,
  onAbrir,
  onCerrar,
}: {
  quedan: number
  /** La mejor rareza que trae: el sobre brilla de su color. */
  brillo: Rarity
  onAbrir: (cuantos: number) => void
  onCerrar: () => void
}) {
  const caja = useRef<HTMLDivElement>(null)
  /** Inclinacion y brillo, segun donde esté el dedo. */
  const [mira, setMira] = useState({ x: 0.5, y: 0.5, dentro: false })
  /** Lo rasgada que esta la tira (0 = cerrada, 1 = fuera). */
  const [rasgado, setRasgado] = useState(0)
  const arrastre = useRef<{ x: number; base: number } | null>(null)
  const [muelle, setMuelle] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [sacudir, setSacudir] = useState(0)
  const aura = colorDe(brillo)
  const fuerte = brillo === 'epica' || brillo === 'divina'

  const abrirYa = () => {
    if (abriendo || quedan === 0) return
    setAbriendo(true)
    setMuelle(true)
    setRasgado(1.6)
    window.setTimeout(() => onAbrir(1), 560)
  }

  const bajar = (evento: ReactPointerEvent<HTMLDivElement>) => {
    if (abriendo || quedan === 0) return
    capturePointer(evento.currentTarget, evento.pointerId)
    arrastre.current = { x: evento.clientX, base: rasgado }
    setMuelle(false)
  }
  const mover = (evento: ReactPointerEvent<HTMLDivElement>) => {
    const rect = caja.current?.getBoundingClientRect()
    if (rect) {
      setMira({
        x: Math.min(1, Math.max(0, (evento.clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (evento.clientY - rect.top) / rect.height)),
        dentro: true,
      })
    }
    const a = arrastre.current
    if (!a || !rect) return
    setRasgado(Math.min(1.2, Math.max(0, a.base + (evento.clientX - a.x) / (rect.width * 0.75))))
  }
  const soltar = () => {
    const a = arrastre.current
    arrastre.current = null
    setMira((m) => ({ ...m, dentro: false }))
    if (!a) return
    setMuelle(true)
    if (rasgado >= 0.7) {
      abrirYa()
    } else {
      // No ha llegado: vuelve a su sitio, y si apenas lo ha movido, se sacude para que lo intente.
      if (rasgado < 0.08) setSacudir((n) => n + 1)
      setRasgado(0)
    }
  }

  const inclinacion: CSSProperties = {
    transform: `rotateY(${(mira.x - 0.5) * 34}deg) rotateX(${(0.5 - mira.y) * 26}deg) scale(${abriendo ? 1.12 : 1})`,
    transition: mira.dentro ? 'transform 60ms linear' : 'transform 500ms cubic-bezier(.2,.8,.2,1)',
  }
  const tira: CSSProperties = {
    transform: `translate3d(${rasgado * 120}%, ${-rasgado * 18}px, ${rasgado * 40}px) rotateZ(${rasgado * 14}deg)`,
    opacity: rasgado > 1.15 ? 0 : 1,
    transition: muelle ? 'transform 380ms cubic-bezier(.2,1.2,.4,1), opacity 300ms' : 'none',
  }

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-hidden px-5"
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #5a3214 0%, #1d0f06 58%, #080402 100%)' }}
    >
      {/* Los rayos de detrás del sobre, del color de lo mejor que trae */}
      <div
        className="revelar-rayos pointer-events-none absolute left-1/2 top-[45%] aspect-square w-[180vmax]"
        style={{ opacity: fuerte ? 0.75 : 0.35, background: `repeating-conic-gradient(from 0deg, ${aura}55 0deg 6deg, transparent 6deg 18deg)` }}
      />
      <button
        type="button"
        onClick={onCerrar}
        className="absolute right-3 top-3 z-20 rounded-full border-2 border-black/40 bg-black/40 px-3 py-1 text-[13px] font-bold text-amber-100"
      >
        SALIR
      </button>

      <div className="relative z-10 flex w-full max-w-[340px] flex-col items-center">
        <p className="mb-3 font-west text-[16px] uppercase tracking-[0.3em] text-amber-100/90">
          {quedan} {quedan === 1 ? 'sobre' : 'sobres'} por abrir
        </p>

        <div
          ref={caja}
          className="relative touch-none select-none"
          style={{ width: 250, height: 360, perspective: 900 }}
          onPointerDown={bajar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          onPointerLeave={() => !arrastre.current && setMira((m) => ({ ...m, dentro: false }))}
        >
          {/* El aura: late del color de la mejor carta */}
          <span
            className="sobre-aura pointer-events-none absolute -inset-8 rounded-[40px]"
            style={{ background: `radial-gradient(closest-side, ${aura}${fuerte ? 'cc' : '77'}, transparent 80%)` }}
          />
          <div
            key={sacudir}
            className={`relative h-full w-full ${sacudir > 0 ? 'sobre-sacude' : 'sobre-flota'}`}
            style={{ transformStyle: 'preserve-3d', ...inclinacion }}
          >
            {/* El cuerpo del sobre, con su borde rasgado arriba */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: CUERPO_CLIP,
                background:
                  'radial-gradient(circle at 50% 30%, rgba(255,236,170,0.7), transparent 50%), linear-gradient(170deg, #f7da8c 0%, #d9a742 40%, #9a6118 75%, #5b3409 100%)',
                borderRadius: 14,
                boxShadow: `inset 0 0 40px rgba(60,30,0,0.55), inset 0 0 0 3px ${aura}`,
              }}
            >
              <span className="absolute inset-3 rounded-[10px] border-2 border-dashed border-[#2a1a10]/35" />
              <span className="absolute inset-x-0 top-[70px] text-center font-west text-[15px] uppercase tracking-[0.35em] text-[#5b3a1c]">
                Guns &amp; Gold
              </span>
              {/* La estrella de sheriff */}
              <span
                className="absolute left-1/2 top-[98px] grid h-[120px] w-[120px] -translate-x-1/2 place-items-center"
                style={{
                  clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
                  background: 'linear-gradient(160deg, #fff4c2, #c98a1c 45%, #6b3d07)',
                  filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.35))',
                }}
              >
                <span className="mt-3 font-west text-[30px] text-[#3a1f08]">7</span>
              </span>
              <span className="absolute inset-x-0 bottom-[46px] text-center font-west text-[30px] leading-none text-[#3a1f08]">7 cartas</span>
              <span className="absolute inset-x-0 bottom-[22px] text-center text-[12px] font-bold uppercase tracking-[0.2em] text-[#3a1f08]">
                {fuerte ? '¡algo brilla dentro…!' : 'de todas las rarezas'}
              </span>
              {/* El brillo de papel de aluminio: corre con el dedo */}
              <span
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(${105 + (mira.x - 0.5) * 50}deg, transparent ${mira.x * 100 - 24}%, rgba(255,255,255,0.6) ${mira.x * 100}%, transparent ${mira.x * 100 + 24}%)`,
                  mixBlendMode: 'soft-light',
                }}
              />
              {/* La luz que sale por la raja al rasgarlo */}
              <span
                className="pointer-events-none absolute inset-x-0 top-0 h-24"
                style={{ background: `linear-gradient(180deg, ${aura}, transparent)`, opacity: Math.min(1, rasgado * 1.2), mixBlendMode: 'screen' }}
              />
            </div>

            {/* La tira de arriba: se arrastra hacia el lado para rasgarla */}
            <div
              className="absolute inset-x-0 top-0 cursor-grab overflow-hidden"
              style={{
                height: TIRA_H,
                clipPath: TIRA_CLIP,
                background: 'repeating-linear-gradient(90deg,#f1cf70 0 10px,#c99a33 10px 20px)',
                borderRadius: '14px 14px 0 0',
                boxShadow: '0 4px 8px rgba(0,0,0,0.45)',
                transformOrigin: '0% 50%',
                ...tira,
              }}
            >
              <span className="absolute inset-x-0 top-[12px] text-center text-[12px] font-black uppercase tracking-[0.3em] text-[#2a1a10]">
                arrastra y rasga ➜
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex w-full flex-col gap-2">
          <button type="button" onClick={abrirYa} disabled={quedan === 0 || abriendo} className="boton w-full text-[15px]">
            {quedan === 0 ? '📦 No te quedan sobres' : '✂️ Rasgar el sobre'}
          </button>
          {quedan > 1 && (
            <button
              type="button"
              onClick={() => {
                setAbriendo(true)
                onAbrir(quedan)
              }}
              disabled={abriendo}
              className="boton boton-fantasma w-full text-[14px]"
            >
              📦📦 Abrir todos ({quedan}) de golpe
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// El dorso de una carta
// ---------------------------------------------------------------------------

/**
 * El dorso: cuero oscuro con la estrella de sheriff, y el borde y el brillo del color de su
 * rareza (así ya se intuye lo que viene). Las divinas, con su cinta de oro girando.
 */
function Dorso({ rareza, grande = false }: { rareza: Rarity; grande?: boolean }) {
  const color = colorDe(rareza)
  const dorada = rareza === 'divina'
  const fuerte = rareza === 'epica' || dorada
  return (
    <div
      className={`absolute inset-0 overflow-hidden rounded-2xl ${dorada ? 'divina-brilla' : ''}`}
      style={{
        backfaceVisibility: 'hidden',
        padding: grande ? 6 : 4,
        background: `linear-gradient(155deg, #ffffff, ${color} 30%, ${color}88 60%, #1a0d05)`,
        boxShadow: `0 0 ${fuerte ? 34 : 16}px ${color}${fuerte ? 'cc' : '88'}, 0 14px 30px rgba(0,0,0,0.6)`,
      }}
    >
      {dorada && <span className="card-cinta opacity-80" />}
      <div
        className="relative h-full w-full overflow-hidden rounded-xl"
        style={{
          background: `radial-gradient(circle at 50% 42%, ${color}66, transparent 55%), repeating-linear-gradient(45deg, #2a1608 0 8px, #24130a 8px 16px)`,
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.7)',
        }}
      >
        <span className="absolute inset-[6%] rounded-lg border-2 border-dashed" style={{ borderColor: `${color}77` }} />
        <span
          className="absolute left-1/2 top-[42%] aspect-square w-[52%] -translate-x-1/2 -translate-y-1/2"
          style={{
            clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            background: `linear-gradient(160deg, #ffffff, ${color} 45%, #3a1f08)`,
          }}
        />
        <span
          className="absolute inset-x-0 bottom-[12%] text-center font-west uppercase tracking-[0.25em]"
          style={{ color, fontSize: grande ? 18 : 12, textShadow: `0 0 10px ${color}` }}
        >
          {NOMBRE_RAREZA[rareza]}
        </span>
        <span className="revelar-brillo pointer-events-none absolute inset-0" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// La ficha entera de una carta girada (la rejilla no tiene sitio para tanto)
// ---------------------------------------------------------------------------

function Ficha({ item, onCerrar }: { item: Salida; onCerrar: () => void }) {
  const player = usePlayer()
  const carta = item.card
  const raro = rarityInfo(rarityOf(carta))
  const tipo = carta.kind === 'batalla' ? arquetipoDe(player, carta.id) : undefined
  const tipoInfo = tipo ? arquetipoInfo(tipo) : undefined
  const ahora = progresoDe(player, carta.id)
  const avance = useMemo(() => progresoDeCarta(ahora), [ahora])
  /** La barra: arranca en 0 y se llena nada mas abrir la ficha. */
  const [barra, setBarra] = useState(0)
  useEffect(() => {
    const reloj = window.setTimeout(() => setBarra(1), 250)
    return () => window.clearTimeout(reloj)
  }, [])

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 md:items-center md:p-6" onClick={onCerrar}>
      <div
        className="max-h-[94%] w-full max-w-[860px] overflow-y-auto rounded-t-3xl border-2 bg-[#1b1108] p-3 md:rounded-3xl md:p-4"
        style={{ borderColor: raro.color }}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-5">
          <SafeCanvas note="La carta 3D no está disponible en este dispositivo.">
            <CardViewer
              card={carta}
              sacudir={carta.kind === 'batalla'}
              className="h-[46vh] max-h-[560px] min-h-[300px] w-full rounded-2xl border border-amber-900/50 bg-[#24150a]"
            />
          </SafeCanvas>

          <div className="min-w-0">
            <p className="font-west text-[28px] leading-none text-amber-100">{carta.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="sello" style={{ background: `${raro.color}33`, borderColor: raro.color, color: '#fef3c7' }}>
                {raro.label}
              </span>
              {item.nueva && <span className="sello border-rose-300/70 bg-rose-600 text-white">new</span>}
              {carta.kind === 'batalla' && tipoInfo && (
                <span className="sello" style={{ background: `${tipoInfo.color}33`, borderColor: tipoInfo.color, color: '#fef3c7' }}>
                  🎯 {tipoInfo.label}
                </span>
              )}
              {carta.kind === 'arma' && <span className="sello border-amber-300/60 bg-white/20 text-amber-50">🔫 Arma</span>}
            </div>

            {carta.kind === 'batalla' && tipoInfo && (
              <p className="mt-1.5 rounded-lg border border-amber-200/30 bg-black/30 px-2 py-1 text-[13px] leading-snug text-amber-100/90">
                <b>{tipoInfo.label}:</b> {tipoInfo.note}
              </p>
            )}

            {/* La barra: 0 a 1 si es nueva, o el % que llevas para el siguiente nivel */}
            <div className="mt-2 rounded-xl border border-amber-200/25 bg-black/40 p-2">
              <div className="flex items-baseline justify-between text-[12px] uppercase tracking-wider">
                <span className="text-amber-200/80">{item.nueva ? 'nueva' : `nivel ${avance.nivel} → ${avance.nivel + 1}`}</span>
                <span className="font-mono text-amber-100">
                  {item.nueva ? `${Math.round(barra * 100)}%` : `${Math.round(avance.llevo)}% / ${avance.pide}%`}
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full border border-amber-200/30 bg-black/60">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${item.nueva ? barra * 100 : Math.min(100, (avance.llevo / avance.pide) * 100)}%`,
                    background: `linear-gradient(90deg, ${raro.color}, #fde68a)`,
                    transition: 'width 900ms cubic-bezier(.2,.8,.2,1)',
                  }}
                />
              </div>
              <p className="mt-1.5 text-center text-[13px] font-bold" style={{ color: item.nueva ? '#86efac' : '#fde68a' }}>
                {item.nueva
                  ? '🎉 ¡Ya es tuya! Puedes equiparla en tu baraja.'
                  : `Llevas ${Math.round(avance.llevo)}% de ${avance.pide}% para subirla de nivel.`}
              </p>
            </div>

            <div className="mt-2 rounded-xl border-2 bg-black/35 p-2" style={{ borderColor: raro.color, boxShadow: `0 0 14px ${raro.color}55` }}>
              {carta.kind === 'batalla' ? (
                <>
                  <Numero label="Daño" valor={String(carta.damage)} />
                  <Numero label="Escudos" valor={String(carta.shields)} />
                  <Numero label="Alcance" valor={`${carta.range.toFixed(1)} m`} />
                  <Numero label="Dispara cada" valor={`${(carta.fireMs / 1000).toFixed(1)} s`} />
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/30 p-1.5">
                    <PatternGlyph points={patternById(carta.pattern).points} size={34} color={carta.accent} />
                    <div className="text-[13px] leading-tight">
                      <p className="text-amber-50">Patrón: {patternById(carta.pattern).name}</p>
                      <p className="text-amber-200/70">Calidad del patrón: {LEVEL_LABEL[patternLevelFor(cardPower(carta))]}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-[14px] leading-snug text-amber-100/90">
                  {specialOf(carta)?.note ?? SHOT_MODES.find((modo) => modo.id === carta.shot.mode)?.note}
                </p>
              )}
            </div>

            <button type="button" onClick={onCerrar} className="boton mt-3 w-full text-[14px]">
              Volver a las cartas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Un número de la ficha, en su fila. */
function Numero({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-amber-900/30 py-1 last:border-b-0">
      <span className="text-[14px] text-amber-200/70">{label}</span>
      <span className="font-mono text-[15px] text-amber-50">{valor}</span>
    </div>
  )
}
