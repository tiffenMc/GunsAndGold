import { useSyncExternalStore } from 'react'
import { arquetipoAlAzar, conArquetipo } from '../cards/arquetipos'
import type { Arquetipo } from '../cards/arquetipos'
import { gameCards, setClaseActiva, todasLasCartasDelJuego } from '../cards/store'
import { DECK_BATTLE, DECK_WEAPONS, MAX_DECKS, RARITY_ORDER, rarityOf } from '../cards/model'
import type { CardDef, ClaseId } from '../cards/model'
import { cartasDeClase } from './clases'
import { CARACTERISTICAS_IDS, acotarCaracteristica, aplicarDesgaste, caracteristicasDeFabrica, extraDe } from './caracteristicas'
import type { Caracteristica, Caracteristicas } from './caracteristicas'
import { ordenDeRevelado, sobreAlAzar, sobresDeInicio } from './sobres'
import { xpDeSobre } from './progreso'
import { apuntarPartida, diaDeHoy, estadoDeHoy, objetivosDelDia } from './objetivos'
import type { EstadoObjetivo, Objetivo, PremioObjetivo } from './objetivos'
import { cloneLook, isLook } from '../dollParams'
import type { DollLook } from '../dollParams'
import { MAX_ANIMACIONES, PRECIO_ANIMACION, articulo, articulosDePago, loQueFalta } from './tienda'
import type { Moneda } from './tienda'
import { problemaDelDibujo, repartir } from './animacionDibujada'
import type { AnimacionDibujada, Punto } from './animacionDibujada'

/**
 * Los jugadores de este dispositivo: cada uno con sus cartas desbloqueadas, sus barajas (hasta
 * tres) y su baraja puesta. Todo se guarda en el navegador.
 *
 * Un jugador nuevo arranca con las cartas normales y especiales desbloqueadas (hasta 15 muñecos
 * y 7 armas); las epicas y divinas se van ganando. El jugador ADMIN las tiene todas, para poder
 * ver la coleccion entera.
 */

export interface Deck {
  name: string
  /** 10 muñecos de batalla. */
  battle: string[]
  /** 4 armas. */
  weapons: string[]
}

export interface Player {
  id: string
  /** La cuenta a la que pertenece este personaje (una cuenta tiene hasta 3). */
  cuentaId?: string
  /** La clase del personaje: solo juega con cartas de esa clase ('todas' = el admin). */
  clase: ClaseId | 'todas'
  name: string
  /** Carta de batalla cuyo muñeco sale en el cartel de "Se busca". */
  avatar: string
  /** El admin lo tiene todo desbloqueado desde el principio. */
  admin: boolean
  unlocked: string[]
  decks: Deck[]
  activeDeck: number
  played: number
  won: number
  streak: number
  bestStreak: number
  lastScenario: string | null
  /** Los sobres sin abrir: cada uno con las cartas que le han tocado dentro. */
  sobres: string[][]
  /** Lo que llevas de cada carta, en %: al 1 ya es tuya, al 100 esta al maximo. */
  progreso: Record<string, number>
  /** El tipo de tirador de cada carta, sorteado la primera vez que la conseguiste. */
  arquetipos: Record<string, Arquetipo>
  /** Las seis caracteristicas del personaje (1-100): se entrenan y se gastan. */
  caracteristicas: Caracteristicas
  /** Cuando se miraron por ultima vez, para el desgaste. */
  caracteristicasEn: number
  /** Las monedas: son el rango. Solo se mueven en la partida de rango. */
  monedas: number
  /** Lo que llevas de los objetivos del dia: `[id, progreso, reclamado]`. */
  objetivos: { id: string; hechos: number; reclamado: boolean; dia: string }[]
  /** Lingotes de oro: salen jugando partidas de rango y se gastan en la Sastrería. */
  lingotes: number
  /** Diamantes: salen muy de vez en cuando al azar; para lo más especial de la Sastrería. */
  diamantes: number
  /**
   * **Tu pinta**: cómo se ve tu vaquero por el pueblo y en Los Más Buscados. Si no hay, se ve como
   * el muñeco de tu retrato.
   */
  pinta?: DollLook
  /** Lo que has comprado en la Sastrería (ids de artículo, `sombrero:chistera`…). */
  armario: string[]
  /** Tus animaciones dibujadas. */
  animaciones: AnimacionDibujada[]
  /** La animación dibujada que lleva puesta tu vaquero (si no, dispara a lo normal). */
  animacion: string | null
}

interface Saved {
  players: Player[]
  current: string
}

/** Lo que trae desbloqueado un jugador nuevo: hasta 15 muñecos y 7 armas. */
export const DEFAULT_UNLOCK: Record<'batalla' | 'arma', number> = { batalla: 15, arma: 7 }

/** El nivel del jugador sale de las partidas ganadas: cada 3 victorias, un nivel. */
export const WINS_PER_LEVEL = 3

export function levelOf(player: Player): { level: number; into: number; need: number } {
  return {
    level: 1 + Math.floor(player.won / WINS_PER_LEVEL),
    into: player.won % WINS_PER_LEVEL,
    need: WINS_PER_LEVEL,
  }
}

const KEY = 'oeste-jugadores-v1'
/** El perfil viejo (un solo jugador): se aprovecha para el primer invitado. */
const LEGACY_KEY = 'oeste-perfil-v1'

const ADMIN_ID = 'admin'

function newId(): string {
  return `j-${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`
}

function statLess(): Pick<Player, 'played' | 'won' | 'streak' | 'bestStreak' | 'lastScenario'> {
  return { played: 0, won: 0, streak: 0, bestStreak: 0, lastScenario: null }
}

/** Lo que trae de serie cualquier jugador: las seis caracteristicas, 100 monedas y los bolsillos. */
function deSerie(): Pick<
  Player,
  'progreso' | 'arquetipos' | 'caracteristicas' | 'caracteristicasEn' | 'monedas' | 'objetivos' | 'lingotes' | 'diamantes' | 'armario' | 'animaciones' | 'animacion'
> {
  return {
    progreso: {},
    arquetipos: {},
    caracteristicas: caracteristicasDeFabrica(),
    caracteristicasEn: Date.now(),
    monedas: 100,
    objetivos: [],
    lingotes: 0,
    diamantes: 0,
    armario: [],
    animaciones: [],
    animacion: null,
  }
}

/** Una cantidad de monedas guardada (entera, de cero para arriba). */
function cantidad(valor: unknown): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.max(0, Math.round(valor)) : 0
}

/** A cada carta que ya tienes se le sortea su tipo de tirador (a las viejas, la primera vez). */
function tiposDe(ids: string[], antes: Record<string, Arquetipo> = {}): Record<string, Arquetipo> {
  const salida: Record<string, Arquetipo> = { ...antes }
  for (const id of ids) if (!salida[id]) salida[id] = arquetipoAlAzar()
  return salida
}

// ---------------------------------------------------------------------------
// Cartas: quien tiene que, y que baraja se puede armar
// ---------------------------------------------------------------------------

/** Las cartas que arranca teniendo un jugador nuevo: de normales a epicas, nunca las divinas. */
export function defaultUnlocked(cards: CardDef[] = gameCards()): string[] {
  const out: string[] = []
  for (const kind of ['batalla', 'arma'] as const) {
    const pool = cards
      .filter((card) => card.kind === kind && rarityOf(card) !== 'divina')
      .sort((a, b) => RARITY_ORDER.indexOf(rarityOf(a)) - RARITY_ORDER.indexOf(rarityOf(b)))
    for (const card of pool.slice(0, DEFAULT_UNLOCK[kind])) out.push(card.id)
  }
  return out
}

/** Rellena los huecos de una baraja con las cartas desbloqueadas que no esten ya dentro. */
export function repairDeck(deck: Deck, unlocked: string[], cards: CardDef[] = gameCards()): Deck {
  const used = new Set<string>()
  const take = (ids: string[], kind: 'batalla' | 'arma', count: number) => {
    const kept = ids.filter(
      (id, index) =>
        unlocked.includes(id) &&
        ids.indexOf(id) === index &&
        cards.find((card) => card.id === id)?.kind === kind &&
        !used.has(id),
    )
    for (const id of kept) used.add(id)
    for (const card of pickPool(cards, unlocked, kind, used)) {
      if (kept.length >= count) break
      kept.push(card.id)
      used.add(card.id)
    }
    return kept.slice(0, count)
  }
  return {
    name: deck.name,
    battle: take(deck.battle ?? [], 'batalla', DECK_BATTLE),
    weapons: take(deck.weapons ?? [], 'arma', DECK_WEAPONS),
  }
}

/** Las mejores desbloqueadas que queden libres, para completar una baraja. */
function pickPool(cards: CardDef[], unlocked: string[], kind: 'batalla' | 'arma', used: Set<string>): CardDef[] {
  return cards
    .filter((card) => card.kind === kind && unlocked.includes(card.id) && !used.has(card.id))
    .sort((a, b) => RARITY_ORDER.indexOf(rarityOf(b)) - RARITY_ORDER.indexOf(rarityOf(a)))
}

/** Lo que le falta a una baraja para poder jugarse. */
export function deckProblem(deck: Deck, unlocked?: string[], cards: CardDef[] = gameCards()): string | null {
  const ids = [...deck.battle, ...deck.weapons]
  if (deck.battle.length !== DECK_BATTLE) return `Faltan muñecos: ${deck.battle.length}/${DECK_BATTLE}`
  if (deck.weapons.length !== DECK_WEAPONS) return `Faltan armas: ${deck.weapons.length}/${DECK_WEAPONS}`
  if (deck.battle.some((id, index) => deck.battle.indexOf(id) !== index)) return 'Hay un muñeco repetido'
  if (deck.weapons.some((id, index) => deck.weapons.indexOf(id) !== index)) return 'Hay un arma repetida'
  const found = ids.map((id) => cards.find((card) => card.id === id))
  if (found.some((card) => !card)) return 'Hay una carta que ya no está en el juego'
  if (unlocked && ids.some((id) => !unlocked.includes(id))) return 'Tienes cartas bloqueadas en la baraja'
  return null
}

/** Las cartas de una baraja, listas para jugar. */
export function deckCards(deck: Deck, cards: CardDef[] = gameCards()): CardDef[] {
  return [...deck.battle, ...deck.weapons]
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is CardDef => Boolean(card))
}

function makeDeck(unlocked: string[], name: string, cards: CardDef[] = gameCards()): Deck {
  return repairDeck({ name, battle: [], weapons: [] }, unlocked, cards)
}

// ---------------------------------------------------------------------------
// Estado en memoria + aviso a quien escuche
// ---------------------------------------------------------------------------

let state: Saved = readState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Si no cabe, se queda en memoria.
  }
  for (const listener of listeners) listener()
}

function clean(player: Player, cards: CardDef[]): Player {
  // El admin lo tiene todo (tambien lo que se añada al catalogo despues).
  const unlocked = player.admin
    ? cards.map((card) => card.id)
    : player.unlocked.filter((id) => cards.some((card) => card.id === id))
  const decks = (player.decks.length > 0 ? player.decks : [makeDeck(unlocked, 'Baraja 1', cards)]).slice(0, MAX_DECKS)
  // Lo que ya tenias cuenta al menos con su 1%.
  const progreso: Record<string, number> = { ...(player.progreso ?? {}) }
  for (const id of unlocked) if (!((progreso[id] ?? 0) >= 1)) progreso[id] = 1
  // Y a cada carta tuya se le sortea (o se le respeta) su tipo de tirador.
  const arquetipos = tiposDe(unlocked, player.arquetipos)
  // Las caracteristicas, con lo que hayan bajado desde la ultima vez.
  const caracteristicas = caracteristicasDeFabrica()
  for (const id of CARACTERISTICAS_IDS) {
    caracteristicas[id] = acotarCaracteristica(player.caracteristicas?.[id])
  }
  const desgaste = aplicarDesgaste(caracteristicas, player.caracteristicasEn ?? Date.now(), Date.now())
  return {
    ...player,
    clase: player.clase ?? (player.admin ? 'todas' : 'vaqueros'),
    unlocked,
    decks: decks.map((deck) => repairDeck(deck, unlocked, cards)),
    activeDeck: Math.min(player.activeDeck ?? 0, decks.length - 1),
    progreso,
    arquetipos,
    caracteristicas: desgaste.stats,
    caracteristicasEn: desgaste.desde,
    monedas: typeof player.monedas === 'number' ? Math.max(0, Math.round(player.monedas)) : 100,
    objetivos: Array.isArray(player.objetivos) ? player.objetivos : [],
    sobres: Array.isArray(player.sobres) ? player.sobres.filter((sobre) => Array.isArray(sobre)) : [],
    lingotes: cantidad(player.lingotes),
    diamantes: cantidad(player.diamantes),
    pinta: isLook(player.pinta) ? cloneLook(player.pinta) : undefined,
    armario: Array.isArray(player.armario) ? player.armario.filter((id) => typeof id === 'string' && Boolean(articulo(id))) : [],
    animaciones: animacionesValidas(player.animaciones),
    animacion: typeof player.animacion === 'string' && animacionesValidas(player.animaciones).some((a) => a.id === player.animacion) ? player.animacion : null,
  }
}

function animacionesValidas(lista: unknown): AnimacionDibujada[] {
  if (!Array.isArray(lista)) return []
  return lista
    .filter((a): a is AnimacionDibujada => Boolean(a && typeof a === 'object' && typeof a.id === 'string' && Array.isArray(a.puntos)))
    .map((a) => ({ id: a.id, nombre: String(a.nombre ?? 'Dibujo'), puntos: repartir(a.puntos) }))
    .slice(0, MAX_ANIMACIONES)
}

function readState(): Saved {
  const cards = todasLasCartasDelJuego()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Saved>
      if (Array.isArray(parsed.players) && parsed.players.length > 0) {
        const players = parsed.players.map((player) => clean(player as Player, cards))
        const current = players.some((player) => player.id === parsed.current) ? String(parsed.current) : players[0]!.id
        setClaseActiva(players.find((player) => player.id === current)?.clase ?? 'vaqueros')
        return { players, current }
      }
    }
  } catch {
    // Datos rotos: se empieza de cero.
  }
  const sembrado = seed(cards)
  setClaseActiva(sembrado.players.find((player) => player.id === sembrado.current)?.clase ?? 'vaqueros')
  return sembrado
}

/** La primera vez: el jugador ADMIN con todo, y un invitado con lo de siempre. */
function seed(cards: CardDef[]): Saved {
  const all = cards.map((card) => card.id)
  const admin: Player = {
    id: ADMIN_ID,
    clase: 'todas',
    name: 'Admin',
    avatar: 'vaquero',
    admin: true,
    unlocked: all,
    sobres: [],
    decks: [makeDeck(all, 'Baraja 1', cards)],
    activeDeck: 0,
    ...deSerie(),
    ...statLess(),
    // El admin tiene todas: a cada una se le sortea su tipo de tirador.
    arquetipos: tiposDe(all),
    progreso: Object.fromEntries(all.map((id) => [id, 100])),
  }
  const legacy = oldProfile()
  const unlocked = defaultUnlocked(cartasDeClase(cards, 'vaqueros'))
  const guest: Player = {
    id: newId(),
    clase: 'vaqueros',
    name: legacy?.name || 'Forastero',
    avatar: legacy?.avatar ?? 'vaquero',
    admin: false,
    unlocked,
    // Un jugador de los de antes ya tiene sus cartas: sobres, los que le den a partir de ahora.
    sobres: [],
    decks: [makeDeck(unlocked, 'Baraja 1', cartasDeClase(cards, 'vaqueros'))],
    activeDeck: 0,
    ...deSerie(),
    ...statLess(),
    arquetipos: tiposDe(unlocked),
    ...(legacy
      ? {
          played: legacy.played ?? 0,
          won: legacy.won ?? 0,
          streak: legacy.streak ?? 0,
          bestStreak: legacy.bestStreak ?? 0,
          lastScenario: legacy.lastScenario ?? null,
        }
      : {}),
  }
  return { players: [admin, guest], current: ADMIN_ID }
}

function oldProfile(): Partial<Player> | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Player> & { created?: boolean }
    return parsed.created ? parsed : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export function getPlayer(): Player {
  return state.players.find((player) => player.id === state.current) ?? state.players[0]!
}

export function players(): Player[] {
  return state.players
}

function patch(player: Player) {
  state = { ...state, players: state.players.map((item) => (item.id === player.id ? player : item)) }
  persist()
}

export function updatePlayer(changes: Partial<Player>): void {
  patch({ ...getPlayer(), ...changes })
}

export function switchPlayer(id: string): void {
  if (!state.players.some((player) => player.id === id)) return
  state = { ...state, current: id }
  setClaseActiva(state.players.find((player) => player.id === id)?.clase ?? 'vaqueros')
  persist()
}

/** Alta de personaje: nombre, retrato, clase y la cuenta a la que pertenece. Empieza con cinco sobres de su clase. */
export function createPlayer(name: string, avatar: string, clase: ClaseId = 'vaqueros', cuentaId?: string): Player {
  setClaseActiva(clase)
  const cards = cartasDeClase(todasLasCartasDelJuego(), clase)
  // Un jugador nuevo empieza con las manos vacias y **cinco sobres** que abrir: de ahi sale todo,
  // y entre los cinco vienen garantizados una de cada rareza, 10 muñecos y 4 armas.
  const unlocked: string[] = []
  const player: Player = {
    id: newId(),
    ...(cuentaId ? { cuentaId } : {}),
    clase,
    name: name.trim() || 'Personaje',
    avatar,
    admin: false,
    unlocked,
    sobres: sobresDeInicio(cards),
    decks: [makeDeck(unlocked, 'Baraja 1', cards)],
    activeDeck: 0,
    ...deSerie(),
    ...statLess(),
    arquetipos: tiposDe(unlocked),
  }
  state = { players: [...state.players, player], current: player.id }
  persist()
  return player
}

export function deletePlayer(id: string): string | null {
  if (state.players.length <= 1) return 'Tiene que quedar al menos un jugador'
  if (state.players.find((player) => player.id === id)?.admin) return 'El jugador ADMIN no se borra'
  const rest = state.players.filter((player) => player.id !== id)
  state = { players: rest, current: rest[0]!.id }
  setClaseActiva(rest[0]!.clase)
  persist()
  return null
}

/** Los personajes de una cuenta (hasta tres). */
export function personajesDe(cuentaId: string): Player[] {
  return state.players.filter((player) => player.cuentaId === cuentaId)
}

/** Une un personaje de antes (sin cuenta) a la cuenta que lo usaba. */
export function atarPersonaje(id: string, cuentaId: string): void {
  const player = state.players.find((item) => item.id === id)
  if (!player || player.cuentaId) return
  patch({ ...player, cuentaId })
}

export function recordResult(won: boolean): void {
  const player = getPlayer()
  const streak = won ? player.streak + 1 : 0
  // Cada partida queda apuntada en los encargos del día.
  const objetivos = apuntarPartida(player.objetivos, diaDeHoy(), won, streak)
  patch({
    ...player,
    objetivos,
    played: player.played + 1,
    won: player.won + (won ? 1 : 0),
    streak,
    bestStreak: Math.max(player.bestStreak, streak),
  })
}

/** Guarda una baraja (tal cual, aunque este a medias: se avisa en la pantalla). */
export function saveDeckAt(index: number, deck: Deck): void {
  const player = getPlayer()
  const decks = player.decks.map((item, i) => (i === index ? deck : item))
  patch({ ...player, decks })
}

export function setActiveDeck(index: number): string | null {
  const player = getPlayer()
  const deck = player.decks[index]
  if (!deck) return 'Esa baraja no existe'
  const problem = deckProblem(deck, player.unlocked)
  if (problem) return problem
  patch({ ...player, activeDeck: index })
  return null
}

export function addDeck(): string | null {
  const player = getPlayer()
  if (player.decks.length >= MAX_DECKS) return `Solo puedes tener ${MAX_DECKS} barajas`
  patch({
    ...player,
    decks: [...player.decks, makeDeck(player.unlocked, `Baraja ${player.decks.length + 1}`)],
  })
  return null
}

export function deleteDeck(index: number): void {
  const player = getPlayer()
  if (player.decks.length <= 1) return
  const decks = player.decks.filter((_, i) => i !== index)
  patch({ ...player, decks, activeDeck: Math.min(player.activeDeck, decks.length - 1) })
}

/** Al ganar una partida se desbloquea una carta de las que faltan (y se le sortea el tipo). */
export function unlockRandom(): CardDef | null {
  const player = getPlayer()
  const locked = gameCards().filter((card) => !player.unlocked.includes(card.id))
  if (locked.length === 0) return null
  const card = locked[Math.floor(Math.random() * locked.length)]!
  patch({
    ...player,
    unlocked: [...player.unlocked, card.id],
    progreso: { ...player.progreso, [card.id]: Math.max(1, player.progreso[card.id] ?? 0) },
    arquetipos: { ...player.arquetipos, [card.id]: player.arquetipos[card.id] ?? arquetipoAlAzar() },
  })
  return card
}

/** El admin puede regalarse lo que quiera desde el menu de jugador. */
export function unlockAll(): void {
  const player = getPlayer()
  const all = gameCards().map((card) => card.id)
  patch({
    ...player,
    unlocked: all,
    arquetipos: tiposDe(all, player.arquetipos),
    progreso: Object.fromEntries(all.map((id) => [id, Math.max(1, player.progreso[id] ?? 0)])),
  })
}

// ---------------------------------------------------------------------------
// Los tipos de tirador, lo que llevas de cada carta y las caracteristicas
// ---------------------------------------------------------------------------

/** El tipo de tirador de una carta (el tuyo). */
export function arquetipoDe(player: Player, cardId: string): Arquetipo | undefined {
  return player.arquetipos[cardId]
}

/** Las cartas de una baraja, ya con su tipo de tirador y los extras de tus caracteristicas. */
export function cartasDeLaBaraja(player: Player, deck: Deck, cards: CardDef[] = gameCards()): CardDef[] {
  const extras = extrasDeBatalla(player)
  return deckCards(deck, cards).map((card) => {
    if (card.kind !== 'batalla') return card
    const suya = conArquetipo(card, player.arquetipos[card.id])
    return {
      ...suya,
      damage: Math.max(10, Math.round(suya.damage * (1 + extras.dano))),
      speed: Math.round(suya.speed * (1 + extras.velocidad) * 100) / 100,
      fireMs: Math.max(500, Math.round(suya.fireMs * (1 - extras.cadencia))),
      shields: Math.max(1, Math.round(suya.shields * (1 + extras.escudos))),
    }
  })
}

/** Los sobres que te quedan sin abrir. */
export function sobresPendientes(player: Player): number {
  return player.sobres.length
}

/**
 * Abre el siguiente sobre: las siete cartas que trae se vuelven tuyas y cada una sube **un nivel
 * entero** (eso es lo que da un sobre). Devuelve las cartas, ya en el orden en que se enseñan:
 * las más tochas al final.
 */
export function abrirSobre(cards: CardDef[] = gameCards()): CardDef[] {
  const player = getPlayer()
  const sobre = player.sobres[0]
  if (!sobre) return []

  const unlocked = [...player.unlocked]
  const progreso = { ...player.progreso }
  for (const id of sobre) {
    if (!unlocked.includes(id)) unlocked.push(id)
    // Un sobre da un nivel entero: si no la tenías, la deja al 1.
    progreso[id] = xpDeSobre(progreso[id] ?? 0)
  }
  const arquetipos = tiposDe(unlocked, player.arquetipos)
  const decks = player.decks.map((deck) => repairDeck(deck, unlocked, cards))
  patch({ ...player, unlocked, progreso, arquetipos, decks, sobres: player.sobres.slice(1) })

  // Se enseñan de una en una y siempre las más tochas al final.
  const saltan = sobre
    .map((id) => cards.find((card) => card.id === id))
    .filter((card): card is CardDef => Boolean(card))
  return ordenDeRevelado(
    saltan.map((card) => card.id),
    cards,
  )
    .map((id) => saltan.find((card) => card.id === id))
    .filter((card): card is CardDef => Boolean(card))
}

/** Te dan un sobre (de los de después): cartas al azar, sin garantías. */
export function recibirSobre(cards: CardDef[] = gameCards()): void {
  const player = getPlayer()
  patch({ ...player, sobres: [...player.sobres, sobreAlAzar(cards)] })
}

/** Lo que llevas de una carta, en experiencia (0 = no es tuya). */
export function progresoDe(player: Player, cardId: string): number {
  return player.progreso[cardId] ?? 0
}

/** Las monedas que tienes: son tu rango. */
export function monedasDe(player: Player): number {
  return player.monedas
}

/**
 * Mueve las monedas de una partida de rango: lo que ganas se lo quitas al rival (y al reves).
 * El que pierde no baja de cero.
 */
export function moverMonedas(cantidad: number): number {
  const player = getPlayer()
  const monedas = Math.max(0, player.monedas + cantidad)
  patch({ ...player, monedas })
  return monedas
}

/** Apunta la partida en los encargos del día (se llaman al terminar cada partida). */
export function apuntarEnObjetivos(gano: boolean, racha: number): void {
  const player = getPlayer()
  const dia = diaDeHoy()
  patch({ ...player, objetivos: apuntarPartida(player.objetivos, dia, gano, racha) })
}

/** Los encargos de hoy con lo que llevas. */
export function objetivosDeHoy(player: Player = getPlayer()): { objetivo: Objetivo; estado: EstadoObjetivo }[] {
  const dia = diaDeHoy()
  return estadoDeHoy(player.objetivos, dia).map((estado) => ({
    objetivo: objetivosDelDia(dia).find((def) => def.id === estado.id)!,
    estado,
  }))
}

/** Cobra un encargo: paga en sobre o en monedas. Devuelve el premio, o null si no toca. */
export function cobrarObjetivo(id: string): PremioObjetivo | null {
  const player = getPlayer()
  const dia = diaDeHoy()
  const estado = estadoDeHoy(player.objetivos, dia).map((item) => {
    if (item.id !== id) return item
    const objetivo = objetivosDelDia(dia).find((def) => def.id === id)
    if (!objetivo || item.reclamado || item.hechos < objetivo.meta) return item
    return { ...item, reclamado: true }
  })
  const suyo = estado.find((item) => item.id === id)
  const objetivo = objetivosDelDia(dia).find((def) => def.id === id)
  if (!suyo || !objetivo || !suyo.reclamado) return null

  patch({ ...player, objetivos: estado })
  if (objetivo.premio.tipo === 'sobre') recibirSobre()
  else moverMonedas(objetivo.premio.cantidad)
  return objetivo.premio
}

/** El nivel de una carta (1-10): solo cambia lo bonita que se ve, no pega mas. */
export function nivelDeCarta(player: Player, cardId: string): number {
  const llevo = progresoDe(player, cardId)
  if (llevo < 1) return 0
  return Math.max(1, Math.min(10, 1 + Math.floor((llevo - 1) / 11)))
}

/**
 * Te llevas un trozo de carta (%). Si es la **primera vez** que la consigues, se le sortea el tipo
 * de tirador y ya es tuya para siempre.
 */
export function ganarTrozoDeCarta(
  cardId: string,
  porcentaje: number,
): { nueva: boolean; arquetipo?: Arquetipo; llevo: number } {
  const player = getPlayer()
  const llevo = Math.max(0, Math.min(100, Math.round(((player.progreso[cardId] ?? 0) + porcentaje) * 10) / 10))
  const eraNueva = !player.unlocked.includes(cardId)
  const arquetipos = { ...player.arquetipos }
  let arquetipo: Arquetipo | undefined
  if (eraNueva && llevo >= 1) {
    arquetipo = arquetipos[cardId] ?? arquetipoAlAzar()
    arquetipos[cardId] = arquetipo
  }
  patch({
    ...player,
    progreso: { ...player.progreso, [cardId]: llevo },
    arquetipos,
    unlocked: eraNueva && llevo >= 1 ? [...player.unlocked, cardId] : player.unlocked,
  })
  return { nueva: eraNueva && llevo >= 1, arquetipo, llevo }
}

/** El desgaste: las caracteristicas bajan solas con el tiempo (y nunca del 1%). */
export function refrescarCaracteristicas(): void {
  const player = getPlayer()
  const { stats, desde } = aplicarDesgaste(player.caracteristicas, player.caracteristicasEn, Date.now())
  if (stats === player.caracteristicas) return
  patch({ ...player, caracteristicas: stats, caracteristicasEn: desde })
}

/** Ganas una incursion de practica: sube esa caracteristica lo que te haya tocado. */
export function entrenarCaracteristica(stat: Caracteristica, cantidad: number): number {
  const player = getPlayer()
  const antes = player.caracteristicas[stat]
  const ahora = Math.min(100, Math.round((antes + cantidad) * 10) / 10)
  patch({ ...player, caracteristicas: { ...player.caracteristicas, [stat]: ahora } })
  return Math.round((ahora - antes) * 10) / 10
}

/** Lo que te cuesta intentar una incursion. */
export function gastarCaracteristicas(coste: { stat: Caracteristica; cantidad: number }[]): void {
  const player = getPlayer()
  const stats = { ...player.caracteristicas }
  for (const parte of coste) {
    stats[parte.stat] = Math.max(1, Math.round((stats[parte.stat] - parte.cantidad) * 10) / 10)
  }
  patch({ ...player, caracteristicas: stats })
}

/** Los extras que dan tus caracteristicas en la batalla (0 a los topes de cada una). */
export function extrasDeBatalla(player: Player): {
  dano: number
  alcance: number
  vida: number
  velocidad: number
  cadencia: number
  escudos: number
} {
  return {
    dano: extraDe(player.caracteristicas, 'punteria', 0.25),
    alcance: extraDe(player.caracteristicas, 'precision', 0.2),
    vida: extraDe(player.caracteristicas, 'vida', 0.25),
    velocidad: extraDe(player.caracteristicas, 'cansancio', 0.2),
    cadencia: extraDe(player.caracteristicas, 'reflejos', 0.2),
    escudos: extraDe(player.caracteristicas, 'temple', 0.25),
  }
}

/** Lo que llevas de una incursion de practica: no hace falta, pero se enseña. */
export function proximoNivelDeCarta(player: Player, cardId: string): number {
  const nivel = nivelDeCarta(player, cardId)
  if (nivel === 0) return 1 - progresoDe(player, cardId)
  if (nivel >= 10) return 0
  return nivel * 11 + 1 - progresoDe(player, cardId)
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePlayer(): Player {
  return useSyncExternalStore(subscribe, getPlayer, getPlayer)
}

export function usePlayers(): Player[] {
  return useSyncExternalStore(subscribe, players, players)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---------------------------------------------------------------------------
// Lingotes, diamantes y la Sastrería
// ---------------------------------------------------------------------------

/** Suma lo que te has llevado de una partida (lingotes y, si hay suerte, un diamante). */
export function ganarBotin(botin: { lingotes: number; diamantes: number }): void {
  const player = getPlayer()
  patch({ ...player, lingotes: player.lingotes + cantidad(botin.lingotes), diamantes: player.diamantes + cantidad(botin.diamantes) })
}

/** El muñeco de tu retrato (con el que empezaste): de ahí sale tu pinta si aún no te has cambiado. */
function lookDelRetrato(player: Player): DollLook {
  const carta = todasLasCartasDelJuego().find((card) => card.id === player.avatar && card.kind === 'batalla')
  return cloneLook(carta && carta.kind === 'batalla' ? carta.look : undefined)
}

/** Cómo se ve tu vaquero ahora mismo. */
export function pintaDe(player: Player): DollLook {
  return player.pinta ? cloneLook(player.pinta) : lookDelRetrato(player)
}

/** Si ya tienes un artículo (lo compraste, es gratis, venía con tu retrato, o eres el admin). */
export function loTienes(player: Player, id: string): boolean {
  const cosa = articulo(id)
  if (!cosa) return false
  if (!cosa.precio || player.admin) return true
  return player.armario.includes(id) || articulosDePago(lookDelRetrato(player)).includes(id)
}

function pagar(player: Player, moneda: Moneda, precio: number): Player | null {
  if (player.admin) return player
  if (player[moneda] < precio) return null
  return { ...player, [moneda]: player[moneda] - precio }
}

/** Compra un artículo de la Sastrería. Devuelve null si ha ido bien, o lo que ha fallado. */
export function comprar(id: string): string | null {
  const player = getPlayer()
  const cosa = articulo(id)
  if (!cosa) return 'Eso no está a la venta'
  if (loTienes(player, id)) return 'Ya lo tienes'
  const precio = cosa.precio!
  const pagado = pagar(player, precio.moneda, precio.cantidad)
  if (!pagado) return precio.moneda === 'lingotes' ? 'No te llegan los lingotes' : 'No te llegan los diamantes'
  patch({ ...pagado, armario: [...pagado.armario, id] })
  return null
}

/** Te pones una pinta. Solo vale si tienes todo lo que lleva. */
export function ponerPinta(look: DollLook): string | null {
  const player = getPlayer()
  const falta = loQueFalta(look, []).filter((id) => !loTienes(player, id))
  if (falta.length > 0) return `Te falta comprar: ${falta.map((id) => articulo(id)?.nombre ?? id).join(', ')}`
  patch({ ...player, pinta: cloneLook(look) })
  return null
}

/** Guarda un dibujo como animación nueva (y se la pone). Cuesta diamantes. */
export function guardarAnimacion(nombre: string, puntos: Punto[]): string | null {
  const player = getPlayer()
  const problema = problemaDelDibujo(puntos)
  if (problema) return problema
  if (player.animaciones.length >= MAX_ANIMACIONES) return `Caben ${MAX_ANIMACIONES} animaciones: borra alguna`
  const pagado = pagar(player, PRECIO_ANIMACION.moneda, PRECIO_ANIMACION.cantidad)
  if (!pagado) return 'No te llegan los diamantes'
  const nueva: AnimacionDibujada = { id: newId(), nombre: nombre.trim().slice(0, 24) || 'Mi floritura', puntos: repartir(puntos) }
  patch({ ...pagado, animaciones: [...pagado.animaciones, nueva], animacion: nueva.id })
  return null
}

/** Elige la animación dibujada que lleva tu vaquero (null = la de siempre). */
export function ponerAnimacion(id: string | null): void {
  const player = getPlayer()
  if (id !== null && !player.animaciones.some((a) => a.id === id)) return
  patch({ ...player, animacion: id })
}

export function borrarAnimacion(id: string): void {
  const player = getPlayer()
  patch({ ...player, animaciones: player.animaciones.filter((a) => a.id !== id), animacion: player.animacion === id ? null : player.animacion })
}

/** La animación dibujada que lleva puesta un jugador, si lleva. */
export function animacionDe(player: Player): AnimacionDibujada | null {
  return player.animaciones.find((a) => a.id === player.animacion) ?? null
}
