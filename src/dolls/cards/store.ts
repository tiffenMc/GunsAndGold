import { useSyncExternalStore } from 'react'
import { ANIM_KINDS } from '../cardConfig'
import type { AnimSet } from '../cardConfig'
import { motionById } from '../animations'
import { cloneLook, isLook } from '../dollParams'
import { BUILTIN_CARDS } from './catalog'
import { DECK_BATTLE, DECK_WEAPONS, RARITY_ORDER, STAT_LIMITS, claseDe } from './model'
import type { BattleCard, CardDef, ClaseId, WeaponCard } from './model'
import { PATTERNS } from './patterns'

/**
 * Guardado de las cartas y del mazo en este dispositivo.
 *
 * Hay dos mundos:
 *  - ADMIN: donde se crean y retocan las cartas. Las del catalogo se pueden retocar y
 *    restablecer; las creadas se pueden borrar.
 *  - JUEGO: las cartas que has ACEPTADO en el admin. Al aceptar se envia una copia de la carta
 *    tal y como esta; si luego la retocas en el admin, el juego no cambia hasta que la vuelves a
 *    aceptar. El mazo del jugador sale de estas cartas.
 */

const KEY = 'oeste-cartas-v1'
/** El taller viejo guardaba aqui al vaquero: se aprovecha la primera vez. */
const LEGACY_KEY = 'magia-cartas-config'

interface Saved {
  custom: CardDef[]
  overrides: Record<string, CardDef>
  /** Las cartas enviadas al juego. Sin nada guardado, estan todas las del catalogo. */
  game: Record<string, CardDef> | null
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function readRaw(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>
      return {
        custom: Array.isArray(parsed.custom) ? parsed.custom : [],
        overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
        game: parsed.game && typeof parsed.game === 'object' ? parsed.game : null,
      }
    }
  } catch {
    // Datos rotos: se empieza de cero.
  }
  return { custom: [], overrides: legacyOverrides(), game: null }
}

/** Si ya tenias tu vaquero ajustado en el taller viejo, se conserva. */
function legacyOverrides(): Record<string, CardDef> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return {}
    const old = (JSON.parse(raw) as Record<string, Partial<BattleCard> & { look?: BattleCard['look'] }>)
      .vaquero
    const base = BUILTIN_CARDS.find((card) => card.id === 'vaquero')
    if (!old || !base || base.kind !== 'batalla') return {}
    return {
      vaquero: normalize({
        ...base,
        look: base.look,
        anims: { ...base.anims, ...old.anims },
        shields: old.shields ?? base.shields,
        damage: old.damage ?? base.damage,
        range: old.range ?? base.range,
        fireMs: old.fireMs ?? base.fireMs,
      }),
    }
  } catch {
    return {}
  }
}

function normalizeAnims(anims: Partial<AnimSet> | undefined, fallback: AnimSet): AnimSet {
  const out = { ...fallback }
  for (const kind of ANIM_KINDS) {
    const wanted = anims?.[kind]
    if (wanted && motionById(wanted).kind === kind) out[kind] = wanted
  }
  return out
}

const DEFAULT_ANIMS: AnimSet = {
  andar: 'andar-1',
  correr: 'correr-1',
  disparar: 'disparar-1',
  impacto: 'impacto-1',
  morir: 'morir-1',
}

/** Rellena y acota lo que venga guardado, por si es de una version vieja. */
export function normalize(card: CardDef): CardDef {
  if (card.kind === 'arma') {
    const shot = card.shot ?? ({} as WeaponCard['shot'])
    return {
      kind: 'arma',
      id: String(card.id),
      name: String(card.name || 'Arma'),
      builtin: Boolean(card.builtin),
      accent: card.accent || '#fbbf24',
      model: card.model || 'revolver',
      shot: {
        mode: shot.mode || 'bala',
        range: clamp(shot.range ?? 10, 3, 24),
        shieldsPerHit: Math.round(clamp(shot.shieldsPerHit ?? 1, 1, 5)),
        pellets: Math.round(clamp(shot.pellets ?? 1, 1, 9)),
        spread: clamp(shot.spread ?? 0, 0, 80),
        radius: clamp(shot.radius ?? 0, 0, 5),
        speed: clamp(shot.speed ?? 24, 6, 45),
        ...(typeof shot.mecha === 'number' ? { mecha: clamp(shot.mecha, 0, 3000) } : {}),
      },
      // Las especiales son de un solo uso y no disparan: hay que conservarlo tal cual.
      ...(card.special ? { special: card.special } : {}),
      ...(card.clase ? { clase: card.clase } : {}),
      ...(card.uses ? { uses: Math.round(clamp(card.uses, 1, 9)) } : {}),
      ...(card.rarity && RARITY_ORDER.includes(card.rarity) ? { rarity: card.rarity } : {}),
    }
  }
  const limits = STAT_LIMITS
  return {
    kind: 'batalla',
    id: String(card.id),
    name: String(card.name || 'Muñeco'),
    builtin: Boolean(card.builtin),
    accent: card.accent || '#38bdf8',
    // Las cartas del taller viejo traian otro formato de muñeco: se quedan con el de por defecto.
    look: isLook(card.look) ? cloneLook(card.look) : cloneLook(),
    anims: normalizeAnims(card.anims, DEFAULT_ANIMS),
    shields: Math.round(clamp(card.shields, limits.shields.min, limits.shields.max)),
    resistance: Math.round(clamp(card.resistance ?? 50, limits.resistance.min, limits.resistance.max)),
    damage: Math.round(clamp(card.damage, limits.damage.min, limits.damage.max)),
    range: clamp(card.range, limits.range.min, limits.range.max),
    fireMs: Math.round(clamp(card.fireMs, limits.fireMs.min, limits.fireMs.max)),
    speed: clamp(card.speed ?? 1, limits.speed.min, limits.speed.max),
    pattern: PATTERNS.some((pattern) => pattern.id === card.pattern) ? card.pattern : PATTERNS[0].id,
    ...(card.estilo ? { estilo: String(card.estilo) } : {}),
    ...(card.clase ? { clase: card.clase } : {}),
    ...(card.rarity && RARITY_ORDER.includes(card.rarity) ? { rarity: card.rarity } : {}),
  }
}

// ---------------------------------------------------------------------------
// Estado en memoria + aviso a quien escuche
// ---------------------------------------------------------------------------

let saved: Saved = readRaw()
let cache: CardDef[] | null = null
let gameCache: CardDef[] | null = null
const listeners = new Set<() => void>()

function persist() {
  cache = null
  gameCache = null
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    // Si no cabe, se queda en memoria.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function allCards(): CardDef[] {
  if (cache) return cache
  const builtins = BUILTIN_CARDS.map((card) => {
    const override = saved.overrides[card.id]
    if (!override || override.kind !== card.kind) return card
    // Si el retoque guardado es del muñeco viejo, se conserva lo demas con el muñeco nuevo.
    const fixed =
      override.kind === 'batalla' && card.kind === 'batalla' && !isLook(override.look)
        ? { ...override, look: card.look }
        : override
    return normalize({ ...fixed, id: card.id, builtin: true })
  })
  const custom = saved.custom.map((card) => normalize({ ...card, builtin: false }))
  cache = [...builtins, ...custom]
  return cache
}

export function cardById(id: string): CardDef | undefined {
  return allCards().find((card) => card.id === id)
}

export function saveCard(card: CardDef): void {
  const clean = normalize(card)
  if (BUILTIN_CARDS.some((base) => base.id === clean.id)) {
    saved = { ...saved, overrides: { ...saved.overrides, [clean.id]: { ...clean, builtin: true } } }
  } else {
    const exists = saved.custom.some((item) => item.id === clean.id)
    saved = {
      ...saved,
      custom: exists
        ? saved.custom.map((item) => (item.id === clean.id ? { ...clean, builtin: false } : item))
        : [...saved.custom, { ...clean, builtin: false }],
    }
  }
  persist()
}

/**
 * Borra una carta tuya (y la quita del juego). Si estaba en el mazo, su hueco lo ocupa otra.
 * Devuelve el motivo si no se puede.
 */
export function deleteCard(id: string): string | null {
  if (BUILTIN_CARDS.some((card) => card.id === id)) return 'Las cartas del catalogo no se borran'
  if (todasLasCartasDelJuego().some((card) => card.id === id)) {
    const problem = unpublishCard(id)
    if (problem) return problem
  }
  saved = { ...saved, custom: saved.custom.filter((card) => card.id !== id) }
  persist()
  return null
}

/** Vuelve a dejar una carta del catalogo como venia. */
export function resetCard(id: string): void {
  const { [id]: _removed, ...rest } = saved.overrides
  saved = { ...saved, overrides: rest }
  persist()
}

export function isModified(id: string): boolean {
  return Boolean(saved.overrides[id])
}

export function newCardId(kind: 'batalla' | 'arma'): string {
  return `${kind}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`
}

// ---------------------------------------------------------------------------
// Cartas del juego: las que has aceptado en el admin
// ---------------------------------------------------------------------------

/** Todas las cartas del juego, de todas las clases (el juego de verdad filtra por la clase del personaje). */
export function todasLasCartasDelJuego(): CardDef[] {
  if (gameCache) return gameCache
  const source = saved.game ? Object.values(saved.game) : BUILTIN_CARDS
  gameCache = source.map((card) => normalize(card))
  return gameCache
}

/** La clase con la que se juega ahora ('todas' = el admin, que lo ve todo). */
let claseActiva: ClaseId | 'todas' = 'vaqueros'
const porClase = new Map<string, { base: CardDef[]; lista: CardDef[] }>()

export function getClaseActiva(): ClaseId | 'todas' {
  return claseActiva
}

/** Cambia la clase con la que se juega: lo que ve el juego pasa a ser solo de esa clase. */
export function setClaseActiva(clase: ClaseId | 'todas'): void {
  if (clase === claseActiva) return
  claseActiva = clase
  for (const listener of listeners) listener()
}

/** Las cartas con las que se juega: las de la clase del personaje (o todas, si es el admin). */
export function gameCards(): CardDef[] {
  const todas = todasLasCartasDelJuego()
  if (claseActiva === 'todas') return todas
  const llave = claseActiva
  const hecha = porClase.get(llave)
  if (hecha && hecha.base === todas) return hecha.lista
  const lista = todas.filter((card) => claseDe(card) === claseActiva)
  porClase.set(llave, { base: todas, lista })
  return lista
}

/** Acepta la carta: se envia al juego tal y como esta ahora. */
export function publishCard(card: CardDef): void {
  const game: Record<string, CardDef> = {}
  for (const item of todasLasCartasDelJuego()) game[item.id] = item
  game[card.id] = normalize(card)
  saved = { ...saved, game }
  persist()
}

/** La quita del juego, si con eso sigue habiendo cartas para armar una baraja. */
export function unpublishCard(id: string): string | null {
  const rest = todasLasCartasDelJuego().filter((card) => card.id !== id)
  const battles = rest.filter((card) => card.kind === 'batalla').length
  if (battles < DECK_BATTLE) return `El juego necesita al menos ${DECK_BATTLE} muñecos de batalla`
  if (rest.length - battles < DECK_WEAPONS) return `El juego necesita al menos ${DECK_WEAPONS} armas`
  const game: Record<string, CardDef> = {}
  for (const item of rest) game[item.id] = item
  saved = { ...saved, game }
  persist()
  return null
}

export type PublishState = 'fuera' | 'igual' | 'cambios'

/** Si la carta del admin esta en el juego, y si es la misma version. */
export function publishState(card: CardDef): PublishState {
  const inGame = todasLasCartasDelJuego().find((item) => item.id === card.id)
  if (!inGame) return 'fuera'
  return JSON.stringify(normalize(card)) === JSON.stringify(inGame) ? 'igual' : 'cambios'
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCards(): CardDef[] {
  return useSyncExternalStore(subscribe, allCards, allCards)
}

export function useGameCards(): CardDef[] {
  return useSyncExternalStore(subscribe, gameCards, gameCards)
}
