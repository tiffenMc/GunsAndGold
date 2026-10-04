import { estiloDe, personalidadAtacante, personalidadTorre } from '../battle/estilos'
import { habilidadDe } from '../battle/habilidades'
import { TORRE_CADENCIA, TORRE_ESCUDOS, rangoDeTorre } from '../battle/engine'
import { useEffect, useRef } from 'react'
import { drawPatternGlyph } from '../card3d/cardArt'
import { CardViewer } from '../card3d/CardViewer'
import { usePortrait } from '../card3d/portraits'
import { useCartas3d } from '../ajustes/cartas3d'
import {
  LEVEL_LABEL,
  QUALITIES,
  SHOT_MODES,
  STRENGTH_NOTE,
  cardPower,
  cardStrength,
  patternLevelFor,
  rarityInfo,
  rarityOf,
  scaledStats,
  specialOf,
} from '../cards/model'
import type { BattleCard, CardDef } from '../cards/model'
import { patternById } from '../cards/patterns'
import type { Pt } from '../cards/patterns'

export function PatternGlyph({ points, color = '#f5d69a', size = 40 }: { points: Pt[]; color?: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = ref.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const dpr = window.devicePixelRatio || 1
    el.width = size * dpr
    el.height = size * dpr
    ctx.clearRect(0, 0, el.width, el.height)
    drawPatternGlyph(ctx, points, el.width * 0.08, el.height * 0.08, el.width * 0.84, color)
  }, [points, color, size])
  return <canvas ref={ref} style={{ width: size, height: size }} className="block" />
}

/** Carta en pequeño para las listas: retrato, nombre bien grande y sus numeros en las esquinas. */
export function CardTile({
  card,
  selected = false,
  faded = false,
  locked = false,
  onClick,
}: {
  card: CardDef
  selected?: boolean
  faded?: boolean
  /** Sin desbloquear: gris, con candado y sin pistas de lo que hace. */
  locked?: boolean
  onClick?: () => void
}) {
  const portrait = usePortrait(card)
  /** Si el jugador ha elegido verlas en 3D (Ajustes). */
  const en3d = useCartas3d()
  const special = card.kind === 'arma' ? specialOf(card) : undefined
  const left = card.kind === 'batalla' ? `✹ ${card.damage}` : special ? '✦ 1' : `🛡−${card.shot.shieldsPerHit}`
  const right = card.kind === 'batalla' ? `🛡 ${card.shields}` : special ? `${special.seconds} s` : `${Math.round(card.shot.range)} m`

  if (locked) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Todavía no la tienes"
        className={`relative flex aspect-[5/7] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-zinc-600/70 bg-[#1a1a1d] ${
          selected ? 'ring-2 ring-zinc-400/70' : ''
        }`}
      >
        <span
          className="absolute inset-0 opacity-25"
          style={{ background: 'repeating-linear-gradient(45deg, #2c2c31 0 10px, #232327 10px 20px)' }}
        />
        <span className="relative text-2xl opacity-80">🔒</span>
        <span className="relative mt-1 font-west text-[11px] text-zinc-400">???</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-[5/7] w-full flex-col overflow-hidden rounded-xl border-2 text-left transition active:scale-95 ${
        selected ? 'scale-[1.03] shadow-[0_0_18px_rgba(251,191,36,0.6)]' : ''
      } ${faded ? 'opacity-45' : ''}`}
      style={{
        borderColor: selected ? '#fde68a' : rarityInfo(rarityOf(card)).color,
        background: `linear-gradient(180deg, ${rarityInfo(rarityOf(card)).color}99 0%, #3a1f0c 52%, #120902 100%), radial-gradient(circle at 50% 22%, rgba(255,214,150,0.3), transparent 55%), repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 2px, transparent 2px 7px)`,
      }}
    >
      <div className="flex items-start justify-between px-1 pt-1 text-[9px] font-bold leading-none">
        <span className="rounded bg-black/70 px-1 py-0.5 text-rose-200">{left}</span>
        <span className="rounded bg-black/70 px-1 py-0.5 text-sky-200">{right}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        {en3d ? (
          <span className="pointer-events-none absolute inset-0 block">
            <CardViewer card={card} limpio className="h-full w-full" />
          </span>
        ) : portrait ? (
          <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl opacity-40">
            {card.kind === 'batalla' ? '🤠' : '🔫'}
          </div>
        )}
        {card.kind === 'batalla' && (
          <div className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5">
            <PatternGlyph points={patternById(card.pattern).points} size={18} />
          </div>
        )}
      </div>
      <div className="bg-black/75 px-1 py-1 text-center">
        <p
          className="whitespace-nowrap font-west leading-none text-amber-50"
          style={{ fontSize: card.name.length <= 7 ? 11 : card.name.length <= 9 ? 9.5 : card.name.length <= 11 ? 8 : 7 }}
        >
          {card.name}
        </p>
        <p className="mt-0.5 text-[7px] uppercase tracking-wider" style={{ color: card.accent }}>
          {card.kind === 'batalla' ? 'Batalla' : special ? 'Especial' : 'Arma'}
        </p>
      </div>
    </button>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-b border-amber-900/30 py-1 text-[12px] last:border-b-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-amber-200/70">{label}</span>
        <span className="font-mono text-amber-50">{value}</span>
      </div>
      {note && <p className="text-[9px] leading-snug text-amber-200/55">{note}</p>}
    </div>
  )
}

/** La chapa de la esquina: el numero que llevan todas las cartas. */
function StrengthRow({ card }: { card: CardDef }) {
  const strength = cardStrength(card)
  return (
    <Row
      label="Fuerza"
      value={`${'★'.repeat(strength)}${'☆'.repeat(6 - strength)} ${strength}/6`}
      note="El resumen de la carta de un vistazo: 1 es un novato y 6 una leyenda"
    />
  )
}

/** Lo que sale segun lo bien que dibujes: de Mal a Excelente. */
export function QualityTable({ card }: { card: BattleCard }) {
  return (
    <div className="overflow-hidden rounded-lg border border-amber-900/40">
      {[...QUALITIES].reverse().map((quality) => {
        const stats = scaledStats(card, quality)
        return (
          <div key={quality.id} className="flex items-center gap-2 border-b border-amber-900/30 bg-black/25 px-2 py-0.5 text-[11px] last:border-b-0">
            <span className="flex-1 font-bold uppercase" style={{ color: quality.color }}>
              {quality.label.replace(/[¡!]/g, '')}
            </span>
            <span className="w-9 text-right text-sky-200">🛡{stats.shields}</span>
            <span className="w-12 text-right text-rose-200">✹{stats.damage}</span>
          </div>
        )
      })}
    </div>
  )
}

export function CardStats({
  card,
  torre = false,
  onTorre,
}: {
  card: CardDef
  /** Que cara se enseña: la de atacante o la de torre. */
  torre?: boolean
  onTorre?: (torre: boolean) => void
}) {
  if (card.kind === 'batalla') {
    const pattern = patternById(card.pattern)
    const level = patternLevelFor(cardPower(card))
    const cara = torre ? personalidadTorre(card) : personalidadAtacante(card)
    const estilo = estiloDe(card)
    const apoyo = Boolean(estilo.pulso || estilo.pacifico || estilo.aura)
    const guardian = estilo.cuerpo !== undefined
    // Los numeros de cada cara: la torre aguanta mas, llega mas lejos y pega antes.
    const escudos = torre ? Math.round(card.shields * TORRE_ESCUDOS) : card.shields
    const alcance = torre ? rangoDeTorre(card) : card.range
    const cadencia = (card.fireMs / 1000) / (torre ? TORRE_CADENCIA : 1)
    const datos: { icono: string; label: string; valor: string; antes?: string }[] = [
      { icono: '🛡', label: 'Escudos', valor: String(escudos), antes: torre ? String(card.shields) : undefined },
      {
        icono: '🎯',
        label: torre ? (apoyo ? 'Área de ayuda' : guardian ? 'Golpea hasta' : 'Alcance') : 'Alcance',
        valor: `${alcance.toFixed(1)} m`,
        antes: torre ? `${card.range.toFixed(1)} m` : undefined,
      },
      { icono: '⏱', label: 'Ataca cada', valor: `${cadencia.toFixed(1)} s`, antes: torre ? `${(card.fireMs / 1000).toFixed(1)} s` : undefined },
      { icono: torre ? '📍' : '🏃', label: 'Movimiento', valor: torre ? 'Fija' : 'Avanza' },
    ]
    return (
      <div className="space-y-2">
        {/* Interruptor: la carta tiene dos caras */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-amber-900/60 bg-black/40 p-1">
          {([false, true] as const).map((esTorre) => (
            <button
              key={String(esTorre)}
              type="button"
              onClick={() => onTorre?.(esTorre)}
              className={`rounded-lg py-1.5 text-[13px] font-black uppercase tracking-wide transition ${
                torre === esTorre
                  ? esTorre
                    ? 'bg-slate-200 text-slate-900'
                    : 'bg-amber-400 text-amber-950'
                  : 'text-amber-100/60'
              }`}
            >
              {esTorre ? '🏰 Torre' : '⚔️ Atacante'}
            </button>
          ))}
        </div>

        {/* Lo que hace, en grande */}
        <div className={`rounded-xl border-2 p-2.5 ${torre ? 'border-slate-300/60 bg-slate-500/15' : 'border-amber-300/60 bg-amber-500/10'}`}>
          <p className="font-west text-[20px] leading-none text-amber-50">{cara.titulo}</p>
          <p className="mt-1 text-[12px] leading-snug text-amber-100/85">{cara.nota}</p>
        </div>

        {/* Su habilidad: lo que hace al ver a un enemigo (y su versión de torre) */}
        {(() => {
          const base = habilidadDe(estilo)
          const hab = torre && base.torre ? base.torre : base
          return (
            <div className="rounded-xl border-2 p-2.5" style={{ borderColor: `${hab.color}aa`, background: `${hab.color}1f` }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: hab.color }}>
                {torre ? '🏰 Defensa' : '✦ Habilidad'} · cada {hab.cdS} s{torre && hab.rango ? ` · rango ${hab.rango} m` : ''}
              </p>
              <p className="mt-0.5 font-west text-[19px] leading-none text-amber-50">{hab.nombre}</p>
              <p className="mt-1 text-[12px] leading-snug text-amber-100/85">{hab.nota}</p>
            </div>
          )
        })()}

        {/* Los numeros de esa cara, en fichas */}
        <div className="grid grid-cols-2 gap-1.5">
          {datos.map((dato) => (
            <div key={dato.label} className="rounded-lg border border-amber-900/50 bg-black/30 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-amber-200/60">
                {dato.icono} {dato.label}
              </p>
              <p className="font-west text-[19px] leading-none text-amber-50">
                {dato.valor}
                {dato.antes && <span className="ml-1.5 align-middle font-sans text-[10px] text-amber-200/45 line-through">{dato.antes}</span>}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-amber-200/55">💥 Daño al fuerte: {card.damage} por disparo</p>

        <div className="flex items-center gap-2 rounded-lg bg-black/30 p-1.5">
          <PatternGlyph points={pattern.points} size={36} color={card.accent} />
          <div className="text-[11px] leading-tight">
            <p className="text-amber-50">Patrón: {pattern.name}</p>
            <p className="text-amber-200/70">Calidad del patrón: {LEVEL_LABEL[level]}</p>
          </div>
        </div>
        <QualityTable card={card} />
        <StrengthNote />
      </div>
    )
  }
  const special = specialOf(card)
  if (special) {
    return (
      <div>
        <p className="mb-1 text-[11px] text-amber-100/80">{special.note}</p>
        <StrengthRow card={card} />
        <Row label="Tipo" value={`Especial · ${special.label}`} />
        <Row label="Duración" value={`${special.seconds} s`} />
        <Row label="Usos" value="1, luego cambia (3 s)" />
        <StrengthNote />
      </div>
    )
  }
  const mode = SHOT_MODES.find((item) => item.id === card.shot.mode)
  return (
    <div>
      <p className="mb-1 text-[11px] text-amber-100/80">{mode?.note}</p>
      <StrengthRow card={card} />
      <Row label="Disparo" value={mode?.label ?? ''} />
      <Row label="Alcance" value={`${card.shot.range.toFixed(0)} m`} />
      <Row label="Escudos por impacto" value={String(card.shot.shieldsPerHit)} />
      {(card.shot.mode === 'perdigones' || card.shot.mode === 'rafaga') && (
        <Row label="Balas" value={String(card.shot.pellets)} />
      )}
      {card.shot.mode === 'explosivo' && <Row label="Radio" value={`${card.shot.radius.toFixed(1)} m`} />}
      <Row label="Usos" value="2, luego cambia (3 s)" />
      <StrengthNote />
    </div>
  )
}

/** Lo que quiere decir el numero de la chapa, que nadie sabe de donde sale. */
function StrengthNote() {
  return <p className="mt-1.5 text-[10px] leading-snug text-amber-200/60">{STRENGTH_NOTE}</p>
}
