import { useState } from 'react'
import { DECK_BATTLE, DECK_WEAPONS, MAX_DECKS } from '../cards/model'
import type { CardDef } from '../cards/model'
import { SELLOS, SELLOS_EN_ORDEN, selloDe } from '../battle/sellos'
import { SelloChapa } from './Sello'
import { useGameCards } from '../cards/store'
import { CardSheet } from './CardSheet'
import { GameCard } from './GameCard'
import {
  arquetipoDe,
  deckProblem,
  nivelDeCarta,
  repairDeck,
  usePlayer,
} from '../game/players'
import type { Deck } from '../game/players'
import { hacer } from '../game/hacer'

type Clase = 'batalla' | 'arma'

const NOMBRE: Record<Clase, { uno: string; varios: string; tope: number }> = {
  batalla: { uno: 'muñeco', varios: 'Muñecos', tope: DECK_BATTLE },
  arma: { uno: 'arma', varios: 'Armas', tope: DECK_WEAPONS },
}

/**
 * Tus barajas, **tocando**: nada de arrastrar ni de huecos escondidos.
 *
 *  - A un lado (o en la pestaña "Mi baraja", en el movil) esta tu baraja entera, con sus huecos a
 *    la vista: lo que llevas y lo que te falta.
 *  - Al otro (pestaña "Colección") estan todas tus cartas, grandes. Cada una tiene su boton:
 *    "＋ Añadir" o "✓ En la baraja" (para sacarla). Si ya estas completo, te pregunta cual sacas.
 *  - Tocar la carta abre su ficha (3D, estadisticas y probarla).
 */
export function DeckScreen() {
  const player = usePlayer()
  const cards = useGameCards()
  const [tab, setTab] = useState(() => player.activeDeck)
  /** En el movil solo cabe una cosa a la vez: tu baraja o tu colección. */
  const [panel, setPanel] = useState<'baraja' | 'coleccion'>('baraja')
  const [clase, setClase] = useState<Clase>('batalla')
  const [notice, setNotice] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  /** La carta que quiere entrar con la baraja llena: se elige cual sale. */
  const [reemplazo, setReemplazo] = useState<CardDef | null>(null)
  const deck: Deck | undefined = player.decks[tab]
  if (!deck) return null

  const find = (id: string) => cards.find((card) => card.id === id)
  const unlocked = cards.filter((card) => player.unlocked.includes(card.id))
  const pool = unlocked.filter((card) => card.kind === clase)
  const inDeck = new Set([...deck.battle, ...deck.weapons])
  const active = tab === player.activeDeck
  const problem = deckProblem(deck, player.unlocked)
  const openCard = open ? find(open) : undefined
  const listOf = (c: Clase) => (c === 'batalla' ? deck.battle : deck.weapons)

  const change = (next: Deck) => {
    // Se cambia ya (por adelantado) y el servidor lo confirma.
    void hacer({ tipo: 'guardarBaraja', indice: tab, baraja: next })
    setNotice(null)
  }
  const withList = (c: Clase, list: string[]): Deck => (c === 'batalla' ? { ...deck, battle: list } : { ...deck, weapons: list })

  /** Mete la carta; si no cabe, pregunta cual sale. Devuelve si ha quedado dentro. */
  const add = (card: CardDef): boolean => {
    const c = card.kind
    const list = listOf(c)
    if (list.includes(card.id)) return true
    if (list.length >= NOMBRE[c].tope) {
      setReemplazo(card)
      return false
    }
    change(withList(c, [...list, card.id]))
    return true
  }
  const remove = (card: CardDef) => change(withList(card.kind, listOf(card.kind).filter((id) => id !== card.id)))
  const toggle = (card: CardDef) => (inDeck.has(card.id) ? remove(card) : add(card))

  const swap = (sale: string) => {
    if (!reemplazo) return
    const c = reemplazo.kind
    change(withList(c, listOf(c).map((id) => (id === sale ? reemplazo.id : id))))
    setReemplazo(null)
    setOpen(null)
  }

  const contador = (c: Clase) => {
    const n = listOf(c).length
    const lleno = n === NOMBRE[c].tope
    return (
      <span
        className={`rounded-full px-2.5 py-1 text-[14px] font-bold ${lleno ? 'bg-emerald-500/25 text-emerald-100' : 'bg-amber-400/20 text-amber-100'}`}
      >
        {NOMBRE[c].varios} {n}/{NOMBRE[c].tope}
      </span>
    )
  }

  /** Un hueco de la baraja: la carta, o un hueco vacio que lleva a la colección. */
  const hueco = (c: Clase, index: number) => {
    const card = find(listOf(c)[index] ?? '')
    if (!card) {
      return (
        <button
          key={`${c}:${index}`}
          type="button"
          onClick={() => {
            setClase(c)
            setPanel('coleccion')
          }}
          className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-amber-600/60 bg-black/25 text-amber-200/60 transition active:scale-95"
        >
          <span className="text-3xl leading-none">＋</span>
          <span className="px-1 text-center text-[13px] font-bold uppercase leading-tight tracking-wider">
            Añadir {NOMBRE[c].uno}
          </span>
        </button>
      )
    }
    return (
      <GameCard
        key={`${c}:${index}`}
        card={card}
        owned
        arquetipo={arquetipoDe(player, card.id)}
        nivel={nivelDeCarta(player, card.id)}
        pill={null}
        onClick={() => setOpen(card.id)}
      />
    )
  }

  const segmento = (id: 'baraja' | 'coleccion', texto: string) => (
    <button
      type="button"
      onClick={() => setPanel(id)}
      className={`flex-1 rounded-lg border-2 px-2 py-2 text-[15px] font-bold uppercase tracking-wider ${
        panel === id ? 'border-amber-300 bg-amber-400 text-amber-950' : 'border-amber-900/60 bg-black/40 text-amber-100/80'
      }`}
    >
      {texto}
    </button>
  )

  return (
    <div className="flex h-full flex-col bg-[#150c05]/80">
      {/* Barra de arriba: que baraja es, cuanto lleva y lo que se puede hacer con ella */}
      <header className="space-y-2 border-b border-amber-900/50 bg-[#1b1108] px-3 pb-2 pt-3">
        <div className="flex items-center gap-1.5">
          <p className="mr-1 font-west text-xl leading-none text-amber-100">Mis barajas</p>
          {player.decks.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setTab(index)
                setNotice(null)
              }}
              className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-1.5 text-[14px] md:max-w-[160px] ${
                index === tab ? 'border-amber-300 bg-amber-300/20 text-amber-50' : 'border-amber-900/50 bg-black/30 text-amber-200/70'
              }`}
            >
              {index === player.activeDeck ? '★ ' : ''}
              {item.name}
            </button>
          ))}
          {player.decks.length < MAX_DECKS && (
            <button
              type="button"
              onClick={() => {
                const nueva = player.decks.length
                void hacer({ tipo: 'nuevaBaraja' }).then(({ error }) => setNotice(error ?? null))
                setTab(nueva)
              }}
              className="rounded-lg border border-emerald-300/50 bg-emerald-500/15 px-3 py-1.5 text-[15px] text-emerald-50"
              title="Nueva baraja"
            >
              +
            </button>
          )}
          {player.decks.length > 1 && (
            <button
              type="button"
              onClick={() => {
                void hacer({ tipo: 'borrarBaraja', indice: tab })
                setTab(0)
              }}
              className="rounded-lg border border-rose-400/50 bg-rose-500/15 px-3 py-1.5 text-[15px] text-rose-50"
              title="Borrar esta baraja"
            >
              🗑
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {contador('batalla')}
          {contador('arma')}
          {active && <span className="rounded-full bg-amber-400/25 px-2.5 py-1 text-[14px] font-bold text-amber-100">★ En uso</span>}
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => change(repairDeck(deck, player.unlocked, cards))} className="btn-ghost text-[14px]">
              Completar sola
            </button>
            <button
              type="button"
              onClick={() => void hacer({ tipo: 'barajaPuesta', indice: tab }).then(({ error }) => setNotice(error ?? null))}
              disabled={active || Boolean(problem)}
              className="btn-gold text-[14px] disabled:opacity-40"
            >
              {active ? 'En uso' : 'Usar esta'}
            </button>
          </div>
        </div>

        {(notice ?? problem) && <p className="rounded-lg bg-rose-900/50 px-2 py-1 text-[14px] text-rose-100">{notice ?? problem}</p>}

        {/* Solo en el movil: o tu baraja o tu colección */}
        <div className="flex gap-2 md:hidden">
          {segmento('baraja', `Mi baraja (${deck.battle.length + deck.weapons.length}/${DECK_BATTLE + DECK_WEAPONS})`)}
          {segmento('coleccion', `Colección (${unlocked.length})`)}
        </div>
      </header>

      <div className="min-h-0 flex-1 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ── Tu baraja ── */}
        <section className={`${panel === 'baraja' ? 'block' : 'hidden'} h-full overflow-y-auto px-3 pb-6 pt-3 md:block md:border-r md:border-amber-900/40`}>
          <p className="mb-1.5 text-[14px] font-bold uppercase tracking-wider text-amber-200/70">
            Muñecos de batalla · {deck.battle.length}/{DECK_BATTLE}
          </p>
          {/* Tu equipo por sellos: cuántos tanques, asesinos, curas… (así se piensa la estrategia) */}
          <ResumenDeSellos cartas={deck.battle.map(find).filter((c): c is CardDef => Boolean(c))} />
          <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">
            {Array.from({ length: DECK_BATTLE }).map((_, index) => hueco('batalla', index))}
          </div>
          <p className="mb-1.5 mt-5 text-[14px] font-bold uppercase tracking-wider text-amber-200/70">
            Armas · {deck.weapons.length}/{DECK_WEAPONS}
          </p>
          <div className="grid grid-cols-3 gap-2.5 md:grid-cols-4">
            {Array.from({ length: DECK_WEAPONS }).map((_, index) => hueco('arma', index))}
          </div>
          <p className="mt-4 text-center text-[13px] text-amber-200/50">Toca una carta para verla, probarla o sacarla de la baraja.</p>
        </section>

        {/* ── Tu colección ── */}
        <section className={`${panel === 'coleccion' ? 'block' : 'hidden'} h-full overflow-y-auto px-3 pb-6 pt-3 md:block`}>
          <div className="mb-3 flex items-center gap-1.5">
            {(['batalla', 'arma'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setClase(id)}
                className={`rounded-lg border-2 px-3 py-1.5 text-[15px] font-bold ${
                  clase === id ? 'border-amber-300 bg-amber-300/20 text-amber-50' : 'border-amber-900/50 bg-black/30 text-amber-200/70'
                }`}
              >
                {NOMBRE[id].varios}
              </button>
            ))}
            <span className="ml-auto text-[14px] text-amber-200/60">{pool.length} desbloqueadas</span>
          </div>
          <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pool.map((card) => {
              const dentro = inDeck.has(card.id)
              return (
                <div key={card.id} className="flex flex-col gap-1">
                  <div className={dentro ? 'opacity-60' : ''}>
                    <GameCard
                      card={card}
                      owned
                      arquetipo={arquetipoDe(player, card.id)}
                      nivel={nivelDeCarta(player, card.id)}
                      pill={null}
                      onClick={() => setOpen(card.id)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(card)}
                    className={`rounded-lg border-2 px-1 py-1.5 text-[14px] font-bold uppercase tracking-wider transition active:scale-95 ${
                      dentro
                        ? 'border-emerald-300/60 bg-emerald-600/80 text-emerald-50'
                        : 'border-amber-200/70 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950'
                    }`}
                  >
                    {dentro ? '✓ En la baraja' : '＋ Añadir'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Baraja llena: ¿cual sacas? */}
      {reemplazo && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/80 md:items-center md:p-6" onClick={() => setReemplazo(null)}>
          <div
            className="max-h-[88%] w-full max-w-[640px] overflow-y-auto rounded-t-3xl border-2 border-amber-300/50 bg-[#1b1108] p-3 md:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-west text-xl leading-none text-amber-100">Tienes {NOMBRE[reemplazo.kind].tope} {NOMBRE[reemplazo.kind].varios.toLowerCase()}</p>
            <p className="mt-1 text-[14px] text-amber-200/70">
              ¿Cuál sacas para meter a <b className="text-amber-50">{reemplazo.name}</b>? Toca la que se va.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {listOf(reemplazo.kind).map((id) => {
                const card = find(id)
                return card ? (
                  <GameCard
                    key={id}
                    card={card}
                    owned
                    arquetipo={arquetipoDe(player, card.id)}
                    pill={null}
                    onClick={() => swap(id)}
                  />
                ) : null
              })}
            </div>
            <button type="button" onClick={() => setReemplazo(null)} className="btn-ghost mt-3 w-full text-[15px]">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {openCard && (
        <CardSheet
          card={openCard}
          arquetipo={arquetipoDe(player, openCard.id)}
          nivel={nivelDeCarta(player, openCard.id)}
          onClose={() => setOpen(null)}
        >
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (inDeck.has(openCard.id)) {
                  remove(openCard)
                  setOpen(null)
                } else if (add(openCard)) {
                  setOpen(null)
                }
              }}
              className={inDeck.has(openCard.id) ? 'btn-ghost flex-1 border-rose-400/50 text-[15px] text-rose-100' : 'btn-gold flex-1 text-[15px]'}
            >
              {inDeck.has(openCard.id) ? 'Sacar de la baraja' : '➕ Añadir a la baraja'}
            </button>
            <button type="button" onClick={() => setOpen(null)} className="btn-ghost text-[15px]">
              Cerrar
            </button>
          </div>
        </CardSheet>
      )}
    </div>
  )
}

/** Cuántas cartas de cada sello llevas, y un aviso si al equipo le falta algo importante. */
function ResumenDeSellos({ cartas }: { cartas: CardDef[] }) {
  const cuenta = new Map(SELLOS_EN_ORDEN.map((s) => [s, 0]))
  for (const c of cartas) if (c.kind === 'batalla') cuenta.set(selloDe(c), (cuenta.get(selloDe(c)) ?? 0) + 1)
  const faltan: string[] = []
  if (cartas.length > 0) {
    if (!cuenta.get('tanque')) faltan.push('sin tanques, nadie aguanta delante')
    if (!cuenta.get('asesino') && !cuenta.get('area')) faltan.push('sin asesinos ni área, los tanques rivales no caen')
    if (!cuenta.get('apoyo')) faltan.push('sin apoyo, nadie cura')
  }
  return (
    <div className="mb-2.5 rounded-xl border border-amber-900/50 bg-black/30 p-2">
      <div className="flex flex-wrap gap-1">
        {SELLOS_EN_ORDEN.map((s) => (
          <span key={s} className="inline-flex items-center gap-1" title={SELLOS[s].nota}>
            <SelloChapa sello={s} tam="mini" apagada={!cuenta.get(s)} />
            <b className="text-[12px] text-amber-50">×{cuenta.get(s)}</b>
          </span>
        ))}
      </div>
      {faltan.length > 0 && <p className="mt-1.5 text-[11.5px] leading-snug text-amber-200/75">Ojo: {faltan.join(' · ')}.</p>}
    </div>
  )
}
