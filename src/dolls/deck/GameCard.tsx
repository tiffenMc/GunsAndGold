import { infoDeSello } from '../battle/sellos'
import type { CSSProperties, ReactNode } from 'react'
import type { Arquetipo } from '../cards/arquetipos'
import type { CardDef, Rarity } from '../cards/model'
import { cardStrength, rarityInfo, rarityOf } from '../cards/model'
import { usePortrait } from '../card3d/portraits'
import { CardViewer } from '../card3d/CardViewer'
import { useCartas3d } from '../ajustes/cartas3d'

/**
 * La carta como se ve en el juego. El marco es lo que canta su rareza: fino y de acero el de las
 * normales, azul el de las especiales, de rombos morados el de las epicas y de oro girando con
 * estrellas en las esquinas el de las divinas. Debajo, la chapa con su fuerza (1-6) y la placa con
 * el nombre. Las que no tienes van con marco apagado, silueta negra y candado.
 */

interface FrameLook {
  /** Grosor del marco, en pixeles. */
  pad: number
  /** Radio de la esquina. */
  radius: number
  /** El borde. */
  band: string
  /** El brillo que suelta hacia fuera (variable --frame-glow). */
  glow: string
  /** Adornos de las esquinas. */
  corners: 'ninguno' | 'rombos' | 'estrellas'
}

const FRAMES: Record<Rarity, FrameLook> = {
  normal: {
    pad: 3,
    radius: 13,
    band: 'linear-gradient(155deg, #fbe7b8, #c08a45 30%, #7a4a1f 62%, #3a210c 85%, #b98b4e)',
    glow: 'rgba(224,170,99,0.35)',
    corners: 'ninguno',
  },
  especial: {
    pad: 3,
    radius: 15,
    band: 'linear-gradient(155deg, #dbf1ff, #38bdf8 40%, #0e5f8f 72%, #082f49)',
    glow: 'rgba(56,189,248,0.55)',
    corners: 'ninguno',
  },
  epica: {
    pad: 4,
    radius: 17,
    band: 'linear-gradient(155deg, #f5e9ff, #c084fc 36%, #7e22ce 70%, #3b0764)',
    glow: 'rgba(192,132,252,0.60)',
    corners: 'rombos',
  },
  divina: {
    pad: 5,
    radius: 19,
    band: 'linear-gradient(155deg, #fff8dc, #fbbf24 34%, #b45309 62%, #fffbeb)',
    glow: 'rgba(251,191,36,0.75)',
    corners: 'estrellas',
  },
}

/** La forma de la gema de la fuerza: un escudo. */
const ESCUDO = 'polygon(50% 0%, 100% 14%, 100% 58%, 50% 100%, 0% 58%, 0% 14%)'

const ESQUINAS = ['left-0 top-0', 'right-0 top-0', 'bottom-0 left-0', 'bottom-0 right-0'] as const

/**
 * El fondo de cada carta: un cielo del Oeste con su horizonte de mesetas, que cambia con la rareza
 * (atardecer en las normales, cielo azul en las especiales, noche morada en las épicas y oro en las
 * divinas). Es lo que hace que hasta la carta más normal tenga su color.
 */
const CIELOS: Record<Rarity, { cielo: string; mesa: string; suelo: string; foco: string }> = {
  normal: { cielo: 'linear-gradient(180deg, #ffd59a 0%, #f4a259 30%, #d9692f 54%)', mesa: '#8c3d1c', suelo: '#4a2410', foco: 'rgba(255,236,190,0.75)' },
  especial: { cielo: 'linear-gradient(180deg, #e0f4ff 0%, #7cc4f5 32%, #3b82c4 54%)', mesa: '#4b5f86', suelo: '#2a2f45', foco: 'rgba(230,248,255,0.8)' },
  epica: { cielo: 'linear-gradient(180deg, #f0d4ff 0%, #b06ef5 30%, #5b21b6 54%)', mesa: '#3b0f6e', suelo: '#1c0838', foco: 'rgba(245,220,255,0.8)' },
  divina: { cielo: 'linear-gradient(180deg, #fffbe6 0%, #fde68a 28%, #f59e0b 54%)', mesa: '#9a4a07', suelo: '#4a2600', foco: 'rgba(255,250,220,0.9)' },
}

/** Las mesetas del horizonte (una silueta, la misma en todas). */
const MESETAS =
  'polygon(0% 100%, 0% 62%, 7% 62%, 9% 48%, 21% 48%, 23% 60%, 38% 60%, 40% 70%, 58% 70%, 60% 44%, 64% 40%, 75% 40%, 78% 52%, 86% 52%, 88% 64%, 100% 64%, 100% 100%)'

/** El tamaño del nombre para que quepa: manda la palabra más larga (así no se corta "CAZARRECOMPENSAS"). */
function tamanoDelNombre(nombre: string): string {
  const larga = Math.max(...nombre.split(/\s+/).map((palabra) => palabra.length))
  const porPalabra = 84 / (larga * 0.74)
  // En una linea si es corto; si no, en dos (cada una con la mitad de letras, mas o menos).
  const porTotal = nombre.length > 12 ? 84 / ((nombre.length / 2 + 1) * 0.72) : 84 / (nombre.length * 0.72)
  return `${Math.min(13, porPalabra, porTotal).toFixed(2)}cqw`
}

/** El cielo y las mesetas, detrás del personaje. */
function Cielo({ rarity }: { rarity: Rarity }) {
  const c = CIELOS[rarity]
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: `${c.cielo}, ${c.suelo}`, borderRadius: 'inherit' }}>
      {/* El foco que hay detrás del personaje */}
      <span
        className="absolute left-1/2 top-[34%] aspect-square w-[95%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: `radial-gradient(circle, ${c.foco}, transparent 62%)` }}
      />
      {/* Las mesetas y el suelo */}
      <span className="absolute inset-x-0 bottom-0 h-[58%]" style={{ background: `linear-gradient(180deg, ${c.mesa}, ${c.suelo} 70%)`, clipPath: MESETAS }} />
      <span className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: `linear-gradient(180deg, transparent, ${c.suelo})` }} />
    </span>
  )
}

/** Los adornos de las esquinas: rombos en las epicas, estrellas que laten en las divinas. */
function Adornos({ look, color }: { look: FrameLook; color: string }) {
  if (look.corners === 'ninguno') return null
  if (look.corners === 'estrellas') {
    return (
      <>
        {ESQUINAS.map((sitio) => (
          <span
            key={sitio}
            className={`card-gema pointer-events-none absolute ${sitio} z-10 text-[11px] leading-none`}
            style={{ color, textShadow: `0 0 6px ${color}` }}
          >
            ✦
          </span>
        ))}
      </>
    )
  }
  return (
    <>
      {ESQUINAS.map((sitio) => (
        <span
          key={sitio}
          className={`pointer-events-none absolute ${sitio} z-10 h-[9px] w-[9px] rotate-45`}
          style={{
            background: `linear-gradient(140deg, #ffffff, ${color})`,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ))}
    </>
  )
}

/** Chispas que suben por la carta (posicion, retraso y duracion fijos: no cambian al repintar). */
const CHISPAS = Array.from({ length: 9 }, (_, i) => ({
  left: `${((i * 37 + 11) % 92) + 4}%`,
  delay: `${-((i * 0.73) % 3.2).toFixed(2)}s`,
  dur: `${(2.4 + ((i * 0.41) % 1.6)).toFixed(2)}s`,
  size: 2 + (i % 3),
}))

/**
 * La magia de dentro de las cartas grandes. Epicas: niebla morada, runas que suben y un
 * holografico violeta. Divinas: rayos de sol girando detras del personaje, aureola, polvo de oro
 * y un holografico de arcoiris que recorre la carta.
 */
function Magia({ rarity, capa }: { rarity: Rarity; capa: 'detras' | 'delante' }) {
  if (rarity !== 'epica' && rarity !== 'divina') return null
  const divina = rarity === 'divina'
  if (capa === 'detras') {
    return (
      <span className="pointer-events-none absolute inset-0 overflow-hidden">
        {divina ? (
          <>
            <span className="card-rayos" />
            <span className="card-aureola" />
          </>
        ) : (
          <span className="card-niebla" />
        )}
      </span>
    )
  }
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit', containerType: 'inline-size' }}>
      <span className={divina ? 'card-holo card-holo-divina' : 'card-holo card-holo-epica'} />
      {CHISPAS.map((c, i) => (
        <span
          key={i}
          className={divina ? 'card-chispa card-chispa-oro' : 'card-chispa card-chispa-runa'}
          style={{ left: c.left, width: c.size, height: c.size, animationDelay: c.delay, animationDuration: c.dur }}
        />
      ))}
      <span className={divina ? 'card-sello card-sello-divina' : 'card-sello card-sello-epica'}>{divina ? '✶ Divina' : '◆ Épica'}</span>
    </span>
  )
}

/** El marco de una rareza, con su cinta y sus adornos. */
function Marco({ rarity, children }: { rarity: Rarity; children: ReactNode }) {
  const look = FRAMES[rarity]
  return (
    <div
      className="card-frame relative"
      data-rarity={rarity}
      style={{ '--frame-glow': look.glow } as CSSProperties}
    >
      <div
        className="relative aspect-[5/7] w-full overflow-hidden transition active:scale-[0.97]"
        style={{ borderRadius: look.radius, padding: look.pad, background: look.band }}
      >
        {rarity === 'divina' && <span className="card-cinta" />}
        {rarity === 'epica' && <span className="card-cinta card-cinta-epica" />}
        {rarity === 'especial' && <span className="card-cinta card-cinta-especial" />}
        {children}
      </div>
    </div>
  )
}

export function GameCard({
  card,
  owned,
  selected = false,
  onClick,
  corner,
  pill,
}: {
  card: CardDef
  /** Sin desbloquear: silueta, candado y sin datos. */
  owned: boolean
  selected?: boolean
  onClick?: () => void
  /** Chapa de la esquina de arriba a la derecha (la usa la baraja para marcar lo que llevas). */
  corner?: ReactNode
  /** La chapa de abajo. Por defecto, "Tienes" / "No tienes". */
  pill?: { text: string; tone: 'green' | 'grey' | 'amber' } | null
  /** (Ya no se escribe en la carta, para que se vea el personaje: va en la ficha.) */
  arquetipo?: Arquetipo
  /** (Idem: el nivel va en la ficha.) */
  nivel?: number
}) {
  const portrait = usePortrait(card)
  /** Si el jugador ha elegido verlas en 3D (Ajustes). */
  const en3d = useCartas3d()
  const rarityId = rarityOf(card)
  const rarity = rarityInfo(rarityId)
  const look = FRAMES[rarityId]
  const shown: { text: string; tone: 'green' | 'grey' | 'amber' } | null =
    pill === undefined ? { text: owned ? 'Tienes' : 'No tienes', tone: owned ? 'green' : 'grey' } : pill
  const tones: Record<'green' | 'grey' | 'amber', string> = {
    green: 'bg-emerald-600 text-emerald-50 border-emerald-300/60',
    grey: 'bg-zinc-700 text-zinc-200 border-zinc-500/50',
    amber: 'bg-amber-500 text-amber-950 border-amber-200/70',
  }

  const strength = cardStrength(card)
  // El color de la gema y de la cinta: el de la rareza (en las normales, bronce y no gris).
  const tinte = rarityId === 'normal' ? '#e0a85c' : rarity.color
  const carriage = (
    <button
      type="button"
      onClick={onClick}
      className={`no-select relative block h-full w-full overflow-hidden ${selected ? 'ring-2 ring-amber-200' : ''}`}
      // Todo el texto de la carta escala con su ancho: se lee igual de pequeña que de grande.
      style={{ borderRadius: look.radius - look.pad, containerType: 'inline-size' }}
    >
      {en3d && owned ? (
        // La misma carta, con su modelo 3D (lo elige el jugador en Ajustes).
        <span className="pointer-events-none absolute inset-0 block">
          <CardViewer card={card} limpio className="h-full w-full" />
        </span>
      ) : portrait ? (
        <>
          {/* La sombra en el suelo, para que el muñeco pise */}
          {owned && <span className="absolute bottom-[19%] left-1/2 h-[7%] w-[58%] -translate-x-1/2 rounded-[50%] bg-black/45 blur-[2px]" />}
          <img
            src={portrait}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover object-top"
            style={
              owned
                ? { filter: 'drop-shadow(0 3px 2px rgba(0,0,0,0.55)) saturate(1.12) contrast(1.05)' }
                : { filter: 'brightness(0) opacity(0.75)' }
            }
          />
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-2xl opacity-50">
          {card.kind === 'batalla' ? '🤠' : '🔫'}
        </span>
      )}

      {/* Un solo numero arriba: su fuerza (las cifras sueltas se ven en la ficha) */}
      {owned && (
        // La gema de la fuerza: un escudo con bisel, del color de su rareza
        <span className="absolute left-[4%] top-[3%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" style={{ width: '23cqw', height: '26cqw' }}>
          <span className="absolute inset-0 bg-black/85" style={{ clipPath: ESCUDO }} />
          <span
            className="absolute flex items-center justify-center font-west leading-none text-white"
            style={{
              inset: '1.8cqw',
              clipPath: ESCUDO,
              fontSize: '13cqw',
              paddingBottom: '2cqw',
              background: `linear-gradient(160deg, #ffffff 0%, ${tinte} 38%, ${tinte} 62%, #1a0d04 120%)`,
              textShadow: '0 1.5px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 0 -1px 0 #000',
            }}
          >
            {strength}
          </span>
        </span>
      )}

      {/* El sello de la carta, estampado encima del nombre: lo primero que se ve */}
      {card.kind === 'batalla' && (() => {
        const sello = infoDeSello(card)
        return (
          <span
            className="absolute right-[4%] flex items-center justify-center rounded-full border-[1.2cqw] shadow-[0_1cqw_2cqw_rgba(0,0,0,0.7)]"
            title={`Sello: ${sello.label}`}
            style={{
              bottom: '23%',
              width: '24cqw',
              height: '24cqw',
              fontSize: '13cqw',
              borderColor: sello.color,
              background: `radial-gradient(circle at 35% 30%, ${sello.color}55, #140a04 70%)`,
              opacity: owned ? 1 : 0.5,
            }}
          >
            {sello.icono}
          </span>
        )
      })()}

      {owned ? (
        corner
      ) : (
        <>
          <span className="absolute right-[6%] top-[4%] text-[13px]">🔒</span>
          <span className="absolute inset-0 flex items-center justify-center font-west text-3xl text-zinc-300/80">?</span>
        </>
      )}

      {/* La cinta del nombre: siempre cabe (como mucho en dos líneas) */}
      <span className="absolute inset-x-0 bottom-0 block h-[34%] bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <span
        className="absolute inset-x-[3%] bottom-[3%] flex min-h-[19%] items-center justify-center rounded-[2.5cqw] px-[3%] py-[2.5%]"
        style={{
          background: owned ? 'linear-gradient(180deg, #2f1a0a 0%, #120902 100%)' : '#18171c',
          boxShadow: `inset 0 0 0 0.9cqw ${owned ? tinte : '#3f3f46'}, inset 0 2.2cqw 2cqw -1.5cqw rgba(255,255,255,0.2), 0 1cqw 2cqw rgba(0,0,0,0.6)`,
        }}
      >
        <span
          className="block text-center font-west leading-[1.02] text-amber-50 [text-shadow:0_2px_2px_rgba(0,0,0,0.9)]"
          style={{ fontSize: tamanoDelNombre(owned ? card.name : '???'), textWrap: 'balance' }}
        >
          {owned ? card.name : '???'}
        </span>
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-1">
      {owned ? (
        <div className="carta3d">
          <Marco rarity={rarityId}>
            <div className="carta3d-cuerpo relative h-full w-full" style={{ borderRadius: look.radius - look.pad }}>
              <Cielo rarity={rarityId} />
              <Magia rarity={rarityId} capa="detras" />
              {carriage}
              <Magia rarity={rarityId} capa="delante" />
              <span className="carta3d-brillo" />
              {/* El bisel por dentro del marco: una raya oscura y otra clara */}
              <span
                className="pointer-events-none absolute inset-0"
                style={{ borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.8), inset 0 0 0 3px rgba(255,255,255,0.2)' }}
              />
              <Adornos look={look} color={rarity.color} />
            </div>
          </Marco>
        </div>
      ) : (
        <div className="card-frame relative" style={{ '--frame-glow': 'transparent' } as CSSProperties}>
          <div
            className="relative aspect-[5/7] w-full overflow-hidden grayscale"
            style={{
              borderRadius: look.radius,
              padding: 2,
              background: 'linear-gradient(155deg, #55545a, #33323a 55%, #1d1c21)',
            }}
          >
            <div className="relative h-full w-full" style={{ background: `radial-gradient(circle at 50% 32%, #6b6b7044, #1b1108 78%)` }}>
              {carriage}
            </div>
          </div>
        </div>
      )}

      {shown && (
        <span
          onClick={onClick}
          className={`rounded-md border px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-wider ${
            tones[shown.tone]
          } ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
        >
          {shown.text}
        </span>
      )}
    </div>
  )
}
