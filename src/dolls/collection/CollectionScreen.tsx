import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Rarity } from '../cards/model'
import { RARITIES, STRENGTH_LEGEND, rarityOf } from '../cards/model'
import { useGameCards } from '../cards/store'
import { CardSheet } from '../deck/CardSheet'
import { SelloChapa } from '../deck/Sello'
import { SELLOS, SELLOS_EN_ORDEN, selloDe } from '../battle/sellos'
import type { Sello } from '../battle/sellos'
import { GameCard } from '../deck/GameCard'
import { Avatar } from '../game/Avatar'
import { arquetipoDe, levelOf, nivelDeCarta, usePlayer } from '../game/players'

/**
 * La coleccion, estilo juego de cartas: barra del jugador arriba, el cartel de "Coleccion de
 * cartas", las pestanas por rareza y la rejilla. Las que tienes con su marco de color, su fuerza
 * y su nombre; las que no, en silueta con candado. Al tocar una se abre su ficha (con la carta 3D).
 */
export function CollectionScreen() {
  const player = usePlayer()
  const cards = useGameCards()
  const [filter, setFilter] = useState<Rarity | 'todas'>('todas')
  /** Y por sello: ver todos los tanques, todos los asesinos… */
  const [sello, setSello] = useState<Sello | 'todos'>('todos')
  const [open, setOpen] = useState<string | null>(null)
  const mine = cards.filter((card) => player.unlocked.includes(card.id))
  const shown = (filter === 'todas' ? cards : cards.filter((card) => rarityOf(card) === filter)).filter(
    (card) => sello === 'todos' || (card.kind === 'batalla' && selloDe(card) === sello),
  )
  const current = open ? cards.find((card) => card.id === open) : undefined
  const owned = Boolean(current && player.unlocked.includes(current.id))

  return (
    <div className="relative h-full overflow-hidden bg-[#150c05]/70">
      <Sky />

      <div className="relative flex h-full flex-col">
        <div className="px-3 pt-3">
          <PlayerBar />
        </div>

        {/* Cartel de la coleccion */}
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border-2 border-[#6b4423] bg-gradient-to-b from-[#5c3a1c] to-[#3a2211] px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.5)]">
          <span className="text-3xl">🤠</span>
          <div className="min-w-0 flex-1">
            <p className="font-west text-xl leading-none tracking-wide text-amber-50">Colección de cartas</p>
            <p className="mt-0.5 text-[13px] text-amber-200/70">
              Tienes {mine.length} de {cards.length} cartas · {STRENGTH_LEGEND}
            </p>
          </div>
          <span className="hidden rounded-lg border border-amber-900/60 bg-black/30 px-2 py-1 text-[12px] text-amber-200/70 sm:block">
            Por rareza ▾
          </span>
        </div>

        {/* Pestanas por rareza */}
        <div className="mt-2 flex flex-wrap gap-1.5 px-3 pb-1">
          <Tab active={filter === 'todas'} color="#f5d69a" onClick={() => setFilter('todas')}>
            📜 Todas
          </Tab>
          {RARITIES.map((rarity) => (
            <Tab key={rarity.id} active={filter === rarity.id} color={rarity.color} onClick={() => setFilter(rarity.id)}>
              ◆ {rarity.label}
            </Tab>
          ))}
        </div>

        {/* Y por sello */}
        <div className="flex gap-1 overflow-x-auto px-3 pb-1">
          <button type="button" onClick={() => setSello('todos')} className={`shrink-0 rounded-full border-2 px-2 py-0.5 text-[11px] font-black uppercase ${sello === 'todos' ? 'border-amber-200 bg-amber-200 text-amber-950' : 'border-amber-200/40 text-amber-100/70'}`}>
            Todos
          </button>
          {SELLOS_EN_ORDEN.map((s) => (
            <button key={s} type="button" onClick={() => setSello(sello === s ? 'todos' : s)} className={`shrink-0 rounded-full ${sello === s ? 'ring-2 ring-amber-200' : ''}`} title={SELLOS[s].nota}>
              <SelloChapa sello={s} tam="mini" apagada={sello !== 'todos' && sello !== s} />
            </button>
          ))}
        </div>
        {sello !== 'todos' && <p className="px-3 text-[12px] leading-snug text-amber-100/75">{SELLOS[sello].nota} · Fuerte: {SELLOS[sello].fuerte.toLowerCase()} · Débil: {SELLOS[sello].debil.toLowerCase()}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
          {shown.length === 0 ? (
            <p className="rounded-xl border border-dashed border-amber-900/60 p-4 text-center text-[14px] text-amber-200/60">
              No hay cartas así.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
              {shown.map((card) => (
                <GameCard
                  key={card.id}
                  card={card}
                  owned={player.unlocked.includes(card.id)}
                  arquetipo={arquetipoDe(player, card.id)}
                  nivel={nivelDeCarta(player, card.id)}
                  pill={player.unlocked.includes(card.id) ? null : undefined}
                  selected={card.id === open}
                  onClick={() => setOpen(card.id)}
                />
              ))}
            </div>
          )}
          <p className="mt-4 text-center text-[12px] uppercase tracking-[0.3em] text-amber-200/40">
            ★ Tu baraja, tu estilo ★
          </p>
        </div>
      </div>

      {current && (
        <CardSheet
          card={current}
          locked={!owned}
          arquetipo={arquetipoDe(player, current.id)}
          nivel={nivelDeCarta(player, current.id)}
          onClose={() => setOpen(null)}
        >
          <button type="button" onClick={() => setOpen(null)} className="btn-gold mt-3 w-full text-[14px]">
            Cerrar
          </button>
        </CardSheet>
      )}
    </div>
  )
}

/** Tu nivel, tu progreso y tus numeros, como en la barra de arriba de los juegos de cartas. */
function PlayerBar() {
  const player = usePlayer()
  const cards = useGameCards()
  const { level, into, need } = levelOf(player)
  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-[#6b4423] bg-[#241609]/95 px-2 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.5)]">
      <span className="relative">
        <Avatar card={cards.find((card) => card.id === player.avatar)} size={40} />
        <span className="absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#3a2211] bg-amber-400 font-west text-[13px] leading-none text-amber-950">
          {level}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-west text-sm leading-none text-amber-50">
          {player.name}
          {player.admin && <span className="rounded bg-rose-600 px-1 text-[10px] font-black tracking-widest text-white">ADMIN</span>}
        </p>
        <div className="mt-1 h-2 overflow-hidden rounded-full border border-black/60 bg-black/60">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-300" style={{ width: `${(into / need) * 100}%` }} />
        </div>
        <p className="mt-0.5 text-[11px] text-amber-200/60">
          Nivel {level} · {into}/{need} victorias
        </p>
      </div>
      <span className="flex items-center gap-1 rounded-lg border border-amber-300/50 bg-amber-400/15 px-2 py-1 text-[13px] text-amber-100">
        🃏 {player.unlocked.length}/{cards.length}
      </span>
      <span className="flex items-center gap-1 rounded-lg border border-fuchsia-300/40 bg-fuchsia-400/15 px-2 py-1 text-[13px] text-fuchsia-100">
        🏆 {player.won}
      </span>
    </div>
  )
}

function Tab({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-lg border-2 px-2.5 py-1.5 text-[13px] font-bold uppercase tracking-wider transition ${
        active ? 'text-amber-950' : 'text-amber-100/80'
      }`}
      style={{
        borderColor: active ? color : `${color}55`,
        background: active ? color : `${color}18`,
      }}
    >
      {children}
    </button>
  )
}

/** El cielo del Oeste: atardecer con mesas, para que la pantalla no sea un fondo plano. */
function Sky() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a1a35" />
          <stop offset="0.45" stopColor="#7d3524" />
          <stop offset="1" stopColor="#d97b3f" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#cielo)" />
      <circle cx="74" cy="26" r="9" fill="#ffd08a" opacity="0.85" />
      <circle cx="74" cy="26" r="14" fill="#ffb867" opacity="0.18" />
      <path d="M0 100 L0 66 L10 54 L24 54 L32 66 L46 66 L55 56 L70 56 L78 66 L100 66 L100 100 Z" fill="#3a1f16" opacity="0.92" />
      <path d="M0 100 L0 78 L16 70 L34 78 L52 72 L72 80 L100 74 L100 100 Z" fill="#241309" opacity="0.95" />
    </svg>
  )
}
