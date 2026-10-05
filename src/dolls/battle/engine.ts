import * as M from './mates'
import { BUILTIN_WEAPONS } from '../cards/catalog'
import { DRAW_S, HAND_SIZE, SPECIAL_SECONDS, WEAPON_SWAP_S, qualityOf, scaledStats, usesOf } from '../cards/model'
import type { BattleCard, CardDef, QualityId, ShotMode, WeaponCard } from '../cards/model'
import { ajusteDeDisparos, conClima } from './clima'
import { danoEntre, efectoDeTorre, estiloConSello, modsDe, selloDelEstilo, torreSinDano } from './sellos'
import type { Atacante, Sello } from './sellos'
import type { Clima } from './clima'
import { congelada, pasoClima } from './sucesosClima'
import type { Suceso, SucesoGordo } from './sucesosClima'
import { estiloDe } from './estilos'
import type { Estilo } from './estilos'
import {
  BALAS,
  PAUSA_ENTRE_CARTAS_S,
  RACHA_BONUS,
  RACHA_MAX,
  RACHA_S,
  RECARGA_S,
  TIEMPO_MAXIMO_S,
  VAGONETA_ATRAE,
  VAGONETA_ENTRE_MAX_S,
  VAGONETA_ENTRE_MIN_S,
  VAGONETA_MAX,
  VAGONETA_PRIMERA_MAX_S,
  VAGONETA_PRIMERA_MIN_S,
  furiaEn,
  maxVivosEn,
} from './economia'

import { antesDeHerir, bloqueada, extraDeHabilidades, habilidadDe, intentarHabilidad, multiplicadorDeDano, nuevoHabEstado, pasoEfectos, pasoEstados, pasoHabilidad, rangoDeTorreDe } from './habilidades'
import type { Efecto, HabEstado, Habilidad } from './habilidades'
/**
 * Motor de la batalla. No sabe nada de dibujar: la escena lee este estado cada fotograma.
 *
 * El campo va de arriba abajo. Tu lado (0) es el de abajo (z positivo) y el rival (1) el de
 * arriba (z negativo). Cada lado tiene un fuerte. Las tropas salen de donde sueltas la carta
 * y andan hacia el fuerte rival; al tenerlo a tiro se paran y le disparan.
 *
 *  - Dos tropas de la MISMA carta y distinto lado se pelean: cada tiro quita un escudo.
 *  - Cartas distintas se ignoran.
 *  - A una tropa solo se la mata quitandole los escudos: con el arma o en su duelo.
 *  - El arma solo defiende: sus balas nunca dañan al fuerte (se rompen al llegar).
 */

export type Side = 0 | 1

export const FIELD_W = 14
export const FIELD_L = 52
/** La casa va pegada al margen del campo y es pequeña: los soldados no llegan ni de lejos. */
export const FORT_Z = 22.2
export const FORT_R = 1
export const FORT_HP = 2500
/** Hasta donde puedes soltar una carta: tu mitad, sin pisar las vias del centro. */
export const DEPLOY_FRONT = 1.4
export const DEPLOY_BACK = FORT_Z - 3
export const UNIT_R = 0.42
/**
 * Linea de fuego: la raya **detras de tu casa**, pegada al margen. Ahi vive el arma (la tuya y la
 * del rival) y de ahi sale el tiro, recto hacia el campo rival. La casa la tapa de los tiros.
 * El arma se desliza POR ELLA, solo de lado (como un portero de futbolin).
 */
export const FIRE_LINE = FORT_Z + FORT_R + 0.3
/**
 * Margen de los soldados: se plantan a esta distancia del centro de la casa rival y **desde aqui
 * ya le pegan**, asi que no se quedan pegados a ella.
 */
export const SIEGE_RANGE = 7
/** Metros por segundo al andar con velocidad 1. */
export const WALK_SPEED = 0.8
/** Margen para dar por llegada la tropa: la cuenta flotante deja restos minusculos. */
export const REACH_SLACK = 0.05
export const CART_HP = 3000
/** La vagoneta sale rara y al azar (ver `economia.ts`): estos son los extremos del primer aviso. */
export const CART_FIRST_S = VAGONETA_PRIMERA_MIN_S
export const CART_FIRST_MAX_S = VAGONETA_PRIMERA_MAX_S
export const DYNAMITE_AMMO = 5
/**
 * Lo que la carreta esta intocable desde que asoma: da tiempo a verla, oir el aviso y decidir si
 * vas a por ella. Mientras dura lleva escudo (los tiros rebotan) y su barra lo dice.
 */
export const CART_GRACE_S = 3.5
/** Lo que dura la nube de humo. */
export const SMOKE_S = SPECIAL_SECONDS.humo
/** Radio de la nube: tapa media cancha. */
export const SMOKE_R = 9
/** Lo que dura la tormenta (la del rayo), para todo un bando. */
export const ZAP_S = SPECIAL_SECONDS.rayo
/** Lo que aguanta abierto un tunel. */
export const TUNNEL_S = SPECIAL_SECONDS.tunel
/**
 * Lo que separa las dos bocas del tunel: justo el largo de las dos zonas de despliegue, asi que
 * cae donde caiga, una boca queda siempre en tu campo y la otra enfrente de la suya.
 */
export const TUNNEL_LEN = DEPLOY_FRONT + DEPLOY_BACK
/** A que distancia de una boca se traga a la tropa. */
export const TUNNEL_R = 0.9
/** Lo que tarda el reroll del arma en recargarse. */
export const REROLL_S = 30
/** Lo que tarda en estallar la carga desde que cae al suelo. */
export const DYNAMITE_FUSE_MS = 1400
/** Lo que tarda el brazo en subir antes de que salga el tiro. */
const WINDUP = 0.22
/** Velocidad del tiro de las tropas. */
const TROOP_SHOT_SPEED = 16
const DEAD_KEEP = 4.5

export interface Vec {
  x: number
  z: number
}

export function other(side: Side): Side {
  return side === 0 ? 1 : 0
}

export function fortPos(side: Side): Vec {
  return { x: 0, z: side === 0 ? FORT_Z : -FORT_Z }
}

function cartPos(): Vec {
  return { x: 0, z: 0 }
}

function cartInterval(battle: Battle): number {
  return VAGONETA_ENTRE_MIN_S + battle.rand() * (VAGONETA_ENTRE_MAX_S - VAGONETA_ENTRE_MIN_S)
}

function spawnCart(battle: Battle) {
  if (battle.practice || battle.cart) return
  const point = cartPos()
  battle.cart = { ...point, hp: CART_HP, maxHp: CART_HP, shieldUntil: battle.time + CART_GRACE_S }
  battle.cartsSeen += 1
  // Rara: como mucho dos por partida, y si ya han salido, no vuelve a salir.
  battle.nextCartAt = battle.cartsSeen >= VAGONETA_MAX ? Infinity : battle.time + cartInterval(battle)
  battle.events.push({ type: 'cartSpawn', x: point.x, z: point.z, hp: CART_HP, grace: CART_GRACE_S })
}

/** Si la carreta esta con el escudo puesto (los primeros segundos). */
export function cartShielded(battle: Battle): boolean {
  return Boolean(battle.cart && battle.time < battle.cart.shieldUntil)
}

function hitCart(battle: Battle, side: Side, damage: number) {
  const cart = battle.cart
  if (!cart) return
  // Con el escudo puesto no entra nada: el tiro rebota y se avisa (chispa y ruido).
  if (battle.time < cart.shieldUntil) {
    battle.events.push({ type: 'cartBlocked', x: cart.x, z: cart.z })
    return
  }
  cart.hp = Math.max(0, cart.hp - damage)
  battle.events.push({ type: 'cartHit', side, damage, hp: cart.hp, maxHp: cart.maxHp })
  if (cart.hp > 0) return
  battle.cart = null
  battle.dynamiteAmmo[side] += DYNAMITE_AMMO
  battle.events.push({ type: 'cartClaimed', side })
}

// ---------------------------------------------------------------------------
// Ritmo: cada 30 s todo va mas rapido; desde el 1:30 pasan de andar a correr
// ---------------------------------------------------------------------------

export interface Pace {
  index: number
  gait: 'andar' | 'correr'
  /** Multiplicador de la velocidad de las tropas. */
  mult: number
  /** Multiplicador de la animacion de piernas. */
  anim: number
  label: string
}

export const RUN_AT = 90

export function paceAt(time: number): Pace {
  const index = Math.max(0, Math.floor(time / 30))
  if (time < RUN_AT) {
    const mult = 1 + 0.2 * index
    return {
      index,
      gait: 'andar',
      mult,
      anim: mult,
      label: index === 0 ? 'Andando' : `Andan ×${mult.toFixed(1)}`,
    }
  }
  const extra = index - RUN_AT / 30
  const mult = 1.9 + 0.2 * extra
  return {
    index,
    gait: 'correr',
    mult,
    anim: mult / 1.9,
    label: extra === 0 ? '¡Corriendo!' : `Corren ×${(mult / 1.9).toFixed(1)}`,
  }
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export interface Unit {
  id: number
  side: Side
  card: BattleCard
  quality: QualityId
  x: number
  z: number
  /** Hacia donde mira, en radianes (0 = hacia +z). */
  heading: number
  shields: number
  maxShields: number
  damage: number
  state: 'andar' | 'fuego' | 'muerto' | 'aturdido'
  /** Si esta en duelo, con quien. */
  duelWith: number | null
  cooldown: number
  fireIn: number | null
  /** Sube en cada tiro: la escena lo usa para lanzar la animacion. */
  shotCount: number
  /** Sube en cada golpe recibido (arma o duelo). */
  hitCount: number
  /** Solo sube cuando recibe un disparo: anima la reaccion no letal. */
  weaponHitCount: number
  /** Tiempo sin moverse/disparar tras el golpe. */
  hitStun: number
  /** Impulso horizontal actual del impacto, en unidades/segundo. */
  knockback: Vec
  /** Tiempo de la animacion de caida y recuperacion. */
  fallTime: number
  fallDuration: number
  fallStrength: number
  /** Direccion mundial del empuje. */
  fallDirection: Vec
  bornAt: number
  diedAt: number
  /** Las de practica no se mueven ni disparan. */
  frozen: boolean
  /** Boca de tunel en la que esta metida (0 = ninguna): asi no rebota de una a otra. */
  inTunnel: number
  /** Balas que le quedan en el tambor (ver `BALAS`). */
  ammo: number
  /** Lo que le falta para acabar de recargar (0 = no esta recargando). */
  reloadLeft: number
  spawn: Vec
  /** Como pelea esta carta (rafagas, area, rebote, cuerpo a cuerpo, cura…), con su sello encima. */
  estilo: Estilo
  /** Su sello (tanque, asesino, distancia…): lo que manda en la pelea (ver `sellos.ts`). */
  sello: Sello
  /** Balas que caben en su tambor y lo que tarda en recargarlas. */
  maxAmmo: number
  recargaS: number
  /** Los disparos que le quedan de la rafaga en curso y cuando sale el siguiente. */
  rafaga: { left: number; in: number } | null
  /** Cuando disparo por ultima vez (el sigilo se rompe al disparar). */
  lastShotAt: number
  /** Hasta cuando va frenado (por cuchillos, cepos, sermones…). */
  slowUntil: number
  /** Impactos recibidos: el blindaje ignora uno de cada tantos. */
  impactos: number
  /** Cuando toca su siguiente pulso (medicos, sermones). */
  pulsoAt: number
  /** Se ha lanzado a explotar: no cuenta como baja del rival. */
  sacrificado: boolean
  /** Hasta cuando esta marcado por un indio (recibe mas de los indios). */
  marcaHasta: number
  /**
   * **Torre**: no se mueve y defiende fuerte (mas escudos y alcance, dispara antes). Los de cuerpo a
   * cuerpo son **guardianes**: golpean a todo lo que pasa a su lado, frenan y atraen a los rivales;
   * los de apoyo curan en un area mas grande. Con doble toque vuelve a ser soldado, y ya no hay vuelta.
   */
  torre: boolean
  /** Ya fue torre y se solto: no puede volver a serlo. */
  torreUsada: boolean
  /** Hasta cuando aguanta de torre (la barra de encima se va vaciando). */
  torreHasta: number
  /** Los escudos que tenia de soldado (al soltar la torre vuelve a ellos como mucho). */
  baseShields: number
  /** Su habilidad (la que salta al ver a un enemigo) y su estado: lista, en curso, y lo que le han hecho. */
  habilidad: Habilidad
  hab: HabEstado
}

/** Lo que gana una carta al hacerse torre. */
export const TORRE_ESCUDOS = 1.6
/** Lo que dura una torre: al acabarse se vuelve soldado y avanza (asi nadie se queda defendiendo toda la partida). */
export const TORRE_S = 25
export const TORRE_ALCANCE = 1.3
export const TORRE_CADENCIA = 1.25
/** El guardian (torre de cuerpo a cuerpo) golpea a esta distancia y atrae a los que pasan a esta otra. */
export const GUARDIAN_ALCANCE = 4.8
export const GUARDIAN_ATRAE = 5.5

/**
 * La zona que protege una carta plantada de torre. **Cada carta la suya**: la da su defensa (el
 * nido del francotirador llega lejisimos, el pisoton del maton solo a lo que tiene pegado).
 */
export function rangoDeTorre(card: BattleCard): number {
  return rangoDeTorreDe(estiloDe(card))
}

/** Hasta donde llega el ataque de una tropa (las torres, hasta su rango de defensa). */
export function alcanceDe(unit: Unit): number {
  if (!unit.torre) return unit.card.range
  return rangoDeTorre(unit.card) * modsDe(unit.sello, true).alcance
}

/** Doble toque sobre una torre: vuelve a ser soldado y avanza. Solo una vez. */
export function soltarTorre(battle: Battle, unitId: number): boolean {
  const unit = battle.units.find((u) => u.id === unitId)
  if (!unit || unit.state === 'muerto' || !unit.torre) return false
  unit.torre = false
  unit.torreUsada = true
  unit.shields = Math.min(unit.shields, unit.baseShields)
  unit.maxShields = unit.baseShields
  unit.state = 'andar'
  battle.events.push({ type: 'torre', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side, torre: false })
  return true
}

/** Un campo en el suelo (fuego, gas, cepos, circulo de balas) que da o frena a los rivales de dentro. */
export interface Campo {
  id: number
  side: Side
  /** El sello de quien lo dejó. */
  sello: Sello
  x: number
  z: number
  radio: number
  until: number
  next: number
  cadaS: number
  golpe: number
  ralentiza: number
  color: string
}

/** Nube de humo: esconde del rival a las tropas de su dueño que van por dentro. */
export interface Smoke {
  id: number
  side: Side
  x: number
  z: number
  radius: number
  until: number
}

/** Tunel: dos bocas. Las tropas de su dueño que pisan una salen por la otra. */
export interface Tunnel {
  id: number
  side: Side
  entry: Vec
  exit: Vec
  until: number
}

export interface TroopShot {
  id: number
  side: Side
  from: Vec
  to: Vec
  t: number
  dur: number
  target: { kind: 'fort'; side: Side } | { kind: 'unit'; id: number } | { kind: 'cart' }
  damage: number
  gun: string
  /** Escudos que quita al acertar y lo que trae su estilo (area, rebote, perforante…). */
  golpe: number
  estilo: Estilo
  /** Rebotes que le quedan y a quien ya ha dado (para no repetir). */
  rebotes: number
  dados: number[]
  /** Golpe cuerpo a cuerpo: llega al instante y no se dibuja ninguna bala. */
  melee: boolean
  /** Lo dispara un indio: deja marcado al rival (la presa marcada recibe mas de todos los indios). */
  marca: boolean
  /** El sello de quien dispara (el golpe se mide con los sellos). */
  sello: Sello
  /** Golpe de un guardian: frena al que lo recibe. */
  frena: boolean
  /** Lo ha soltado una torre (se marca el golpe para que se vea defender). */
  deTorre: boolean
}

interface Track {
  pts: Vec[]
  cum: number[]
  total: number
}

export interface Bullet {
  id: number
  side: Side
  mode: ShotMode
  weaponId: string
  track: Track
  dist: number
  maxDist: number
  speed: number
  delay: number
  /** Separacion lateral por metro (perdigones en cono). */
  lateral: number
  shieldsPerHit: number
  radius: number
  pierce: boolean
  volley: number
  hit: Set<number>
  alive: boolean
  x: number
  z: number
  dx: number
  dz: number
  accent: string
  /** Milisegundos de mecha: la carga espera donde cae antes de estallar. */
  fuseMs: number
  /** Lo que se ve volar: una bala, una flecha, una roca de catapulta, una bola de cañon… */
  proyectil: Proyectil
}

export type Proyectil = 'bala' | 'dinamita' | 'flecha' | 'lanza' | 'hacha' | 'martillo' | 'roca' | 'bola'

/** Que proyectil lanza cada modelo de arma. */
export function proyectilDe(model: string): Proyectil {
  switch (model) {
    case 'arco':
      return 'flecha'
    case 'lanza':
      return 'lanza'
    case 'hacha':
      return 'hacha'
    case 'martillo':
      return 'martillo'
    case 'catapulta':
      return 'roca'
    case 'canon':
      return 'bola'
    case 'dinamita':
      return 'dinamita'
    default:
      return 'bala'
  }
}

export interface Slot {
  cardId: string | null
  readyAt: number
}

export interface WeaponSlot {
  cardId: string | null
  uses: number
  readyAt: number
  lastId: string | null
}

export interface Hand {
  slots: Slot[]
  weapon: WeaponSlot
  battlePool: BattleCard[]
  weaponPool: WeaponCard[]
}

export interface Fort {
  side: Side
  hp: number
  maxHp: number
  hitCount: number
}

export interface MineCart {
  x: number
  z: number
  hp: number
  maxHp: number
  /** Hasta cuando lleva el escudo puesto (no se la puede tocar). */
  shieldUntil: number
}

export type BattleEvent =
  | { type: 'cartSpawn'; x: number; z: number; hp: number; grace: number }
  | { type: 'cartBlocked'; x: number; z: number }
  | { type: 'cartHit'; side: Side; damage: number; hp: number; maxHp: number }
  | { type: 'cartClaimed'; side: Side }
  /** Una tropa dispara (o pega): hacia dónde, cuánto quita y si es de cerca (para pintar el tajo). */
  | { type: 'troopShot'; side: Side; x: number; z: number; hacia?: Vec; golpe?: number; melee?: boolean; unitId?: number }
  | { type: 'spawn'; unitId: number; x: number; z: number; quality: QualityId; side: Side }
  | { type: 'unitHit'; unitId: number; x: number; z: number; side: Side; weapon: boolean; amount: number }
  | { type: 'unitDeath'; unitId: number; x: number; z: number; side: Side }
  | { type: 'fortHit'; side: Side; damage: number }
  | { type: 'blast'; x: number; z: number; r: number; side: Side }
  | { type: 'bulletEnd'; x: number; z: number; why: 'fuerte' | 'fuera' | 'alcance' }
  | { type: 'weaponFired'; side: Side; weaponId: string; x: number; z: number }
  | { type: 'smoke'; side: Side; x: number; z: number; radius: number }
  | { type: 'zap'; side: Side; until: number }
  | { type: 'tunnel'; side: Side; entry: Vec; exit: Vec }
  | { type: 'teleport'; side: Side; from: Vec; to: Vec }
  | { type: 'pace'; pace: Pace }
  /** Una tropa suelta su habilidad: la escena enseña su nombre en un bocadillo. */
  | { type: 'habilidad'; unitId: number; x: number; z: number; side: Side; nombre: string; color: string }
  /** Un bando tumba a un soldado y sube su racha (1 a 3). */
  | { type: 'baja'; side: Side; x: number; z: number; racha: number }
  /** Una torre golpea: la escena pinta la onda del golpe en el blanco. */
  | { type: 'golpeTorre'; x: number; z: number; side: Side; guardian: boolean }
  /** Una carta se hace torre (o vuelve a ser soldado). */
  | { type: 'torre'; unitId: number; x: number; z: number; side: Side; torre: boolean }
  /** Un indio marca a un rival: la escena dibuja un aro. */
  | { type: 'marca'; x: number; z: number }
  /** Un pulso de un medico (verde) o de un sermon (rojo): la escena pinta la onda. */
  | { type: 'pulso'; side: Side; x: number; z: number; r: number; tipo: 'cura' | 'grito' }
  | { type: 'reload'; unitId: number; x: number; z: number }
  /** Solo para la escena: el muñeco acaba de romperse en pedazos (despues de su caida). */
  | { type: 'roto'; unitId: number; x: number; z: number; side: Side }
  /** Empieza un suceso del clima (para el cartel). El tsunami lleva su carril en `x`. */
  | { type: 'suceso'; k: SucesoGordo; x: number }
  | { type: 'over'; winner: Side; by: 'fuerte' | 'tiempo' }

export interface Battle {
  time: number
  paceIndex: number
  units: Unit[]
  shots: TroopShot[]
  bullets: Bullet[]
  forts: [Fort, Fort]
  hands: [Hand, Hand]
  /** Todas las cartas de la partida por id (para pintarlas). Si un id está en los dos mazos, la tuya. */
  cards: Map<string, CardDef>
  /**
   * Las cartas de **cada bando** por id. Tu copia de una carta (con tu tipo de tirador y los extras
   * de tus características) no es la misma que la del bot aunque se llamen igual: cada bando juega
   * con la suya.
   */
  cartas: [Map<string, CardDef>, Map<string, CardDef>]
  events: BattleEvent[]
  over: { winner: Side; by: 'fuerte' | 'tiempo' } | null
  nextId: number
  volleyHits: Map<number, Map<number, number>>
  rand: () => number
  /** En practica los fuertes no pierden vida y no se roba. */
  practice: boolean
  /** El clima de la partida: recorta rangos (y cambia la luz). */
  clima: Clima
  /** Lo que le suma la precision del jugador al alcance de SU arma (1 = nada). */
  alcanceArma: number
  cart: MineCart | null
  nextCartAt: number
  dynamiteAmmo: Record<Side, number>
  /** Nubes de humo activas. */
  smokes: Smoke[]
  /** Túneles abiertos. */
  tunnels: Tunnel[]
  /** Hasta cuando cada bando esta sin moverse ni disparar (granada eléctrica). */
  stunUntil: [number, number]
  /** Cuando vuelve a estar listo el reroll del arma. */
  rerollAt: number
  /** Cuando saco cada bando su ultima carta (para la pausa entre cartas). */
  lastPlayAt: [number, number]
  /** Racha de cada bando (0 a 3) y hasta cuando dura. */
  racha: [number, number]
  rachaHasta: [number, number]
  /** Bajas de cada bando (a quienes ha tumbado). */
  kills: [number, number]
  /** Las tropas que ha perdido cada bando (todas, las mate quien las mate): para el resumen del final. */
  muertes: [number, number]
  /** Campos que hay ahora en el suelo (fuego, gas, cepos, circulos de balas). */
  campos: Campo[]
  /** Lo que tienen en el campo las habilidades (zonas, proyectiles, rayos…). */
  efectos: Efecto[]
  /** Lo que hace el clima (rayos, charcos, hielo, rodadoras…). */
  sucesos: Suceso[]
  /** Cuando toca cada suceso del clima de esta partida (de 0 a 3, sorteados al empezar). */
  sucesoPlan?: number[]
  sucesoId?: number
  /** Cuantas vagonetas han salido ya. */
  cartsSeen: number
  /** Solo para dibujar: 1 = normal, menos = camara lenta (lo pone la escena, el motor no lo usa). */
  timeScale: number
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeHand(deck: CardDef[]): Hand {
  const battlePool = deck.filter((card): card is BattleCard => card.kind === 'batalla')
  const weaponPool = deck.filter((card): card is WeaponCard => card.kind === 'arma')
  return {
    slots: Array.from({ length: HAND_SIZE }, () => ({ cardId: null, readyAt: 0 })),
    weapon: { cardId: null, uses: 0, readyAt: 0, lastId: null },
    battlePool,
    weaponPool,
  }
}

export interface BattleOptions {
  decks: [CardDef[], CardDef[]]
  seed?: number
  practice?: boolean
  /** El clima que ha salido en la ruleta. Por defecto, de dia. */
  clima?: Clima
  /** Los extras que le dan al jugador sus caracteristicas (lado 0). */
  extras?: { alcanceArma?: number; vida?: number }
}

export function createBattle(options: BattleOptions): Battle {
  const cartas: [Map<string, CardDef>, Map<string, CardDef>] = [new Map(), new Map()]
  options.decks.forEach((deck, side) => {
    for (const card of deck) cartas[side === 0 ? 0 : 1].set(card.id, card)
  })
  // Para pintar: las del bot y, encima, las tuyas (si se llaman igual, se ve la tuya).
  const cards = new Map<string, CardDef>([...cartas[1], ...cartas[0]])
  const rand = mulberry(options.seed ?? Math.floor(Math.random() * 1e9))
  const battle: Battle = {
    time: 0,
    paceIndex: 0,
    units: [],
    shots: [],
    bullets: [],
    forts: [
      // La salud de tu fuerte sale de tu caracteristica de Vida.
      {
        side: 0,
        hp: Math.round(FORT_HP * (1 + (options.extras?.vida ?? 0))),
        maxHp: Math.round(FORT_HP * (1 + (options.extras?.vida ?? 0))),
        hitCount: 0,
      },
      { side: 1, hp: FORT_HP, maxHp: FORT_HP, hitCount: 0 },
    ],
    hands: [makeHand(options.decks[0]), makeHand(options.decks[1])],
    cards,
    cartas,
    events: [],
    over: null,
    nextId: 1,
    volleyHits: new Map(),
    rand,
    practice: Boolean(options.practice),
    clima: options.clima ?? 'dia',
    alcanceArma: 1 + (options.extras?.alcanceArma ?? 0),
    cart: null,
    nextCartAt: CART_FIRST_S + rand() * (CART_FIRST_MAX_S - CART_FIRST_S),
    dynamiteAmmo: { 0: 0, 1: 0 },
    smokes: [],
    tunnels: [],
    stunUntil: [0, 0],
    rerollAt: 0,
    lastPlayAt: [-99, -99],
    racha: [0, 0],
    rachaHasta: [0, 0],
    kills: [0, 0],
    muertes: [0, 0],
    cartsSeen: 0,
    campos: [],
    efectos: [],
    sucesos: [],
    timeScale: 1,
  }
  for (const side of [0, 1] as Side[]) {
    const hand = battle.hands[side]
    const used: string[] = []
    for (const slot of hand.slots) {
      slot.cardId = drawBattle(battle, hand, used)
      if (slot.cardId) used.push(slot.cardId)
    }
    hand.weapon.cardId = drawWeapon(battle, hand)
    hand.weapon.uses = hand.weapon.cardId ? usesOf(cartaDelBando(battle, side, hand.weapon.cardId) as WeaponCard) : 0
  }
  return battle
}

function pick<T>(battle: Battle, list: T[]): T | null {
  if (list.length === 0) return null
  return list[Math.floor(battle.rand() * list.length)] ?? null
}

/** Roba una de batalla (se puede repetir; al empezar se evitan las que ya tienes). */
function drawBattle(battle: Battle, hand: Hand, avoid: string[] = []): string | null {
  const fresh = hand.battlePool.filter((card) => !avoid.includes(card.id))
  return pick(battle, fresh.length > 0 ? fresh : hand.battlePool)?.id ?? null
}

/** El arma nueva es distinta de la que se acaba de gastar, si hay otra. */
function drawWeapon(battle: Battle, hand: Hand): string | null {
  const others = hand.weaponPool.filter((card) => card.id !== hand.weapon.lastId)
  return pick(battle, others.length > 0 ? others : hand.weaponPool)?.id ?? null
}

// ---------------------------------------------------------------------------
// Consultas para la interfaz
// ---------------------------------------------------------------------------

/** La carta de un bando por su id: la suya (y si no la tiene, la que haya en la partida). */
export function cartaDelBando(battle: Battle, side: Side, id: string): CardDef | undefined {
  return battle.cartas[side].get(id) ?? battle.cards.get(id)
}

export function slotCard(battle: Battle, side: Side, index: number): BattleCard | null {
  const id = battle.hands[side].slots[index]?.cardId
  const card = id ? cartaDelBando(battle, side, id) : undefined
  return card && card.kind === 'batalla' ? card : null
}

export function weaponCard(battle: Battle, side: Side): WeaponCard | null {
  const id = battle.hands[side].weapon.cardId
  const card = id ? cartaDelBando(battle, side, id) : undefined
  return card && card.kind === 'arma' ? card : null
}

/** Coloca un punto dentro de la zona donde ese lado puede soltar tropas. */
export function clampDeploy(side: Side, x: number, z: number): Vec {
  const cx = Math.min(FIELD_W / 2 - 0.6, Math.max(-FIELD_W / 2 + 0.6, x))
  const depth = Math.min(DEPLOY_BACK, Math.max(DEPLOY_FRONT, side === 0 ? z : -z))
  return { x: cx, z: side === 0 ? depth : -depth }
}

/** La boca del arma sobre tu linea de fuego: solo se desliza de lado, nunca cruza la raya. */
export function clampFireLine(side: Side, x: number): Vec {
  const cx = Math.min(FIELD_W / 2 - 0.6, Math.max(-FIELD_W / 2 + 0.6, x))
  return { x: cx, z: side === 0 ? FIRE_LINE : -FIRE_LINE }
}

/** Hacia donde dispara un lado: angulo 0 = de frente al fuerte rival; crece hacia +x. */
export function aimDir(side: Side, angle: number): Vec {
  const fz = side === 0 ? -1 : 1
  return { x: M.sin(angle), z: M.cos(angle) * fz }
}

/** El angulo con el que un lado da a un punto desde su boca (lo usa el bot). */
export function angleTo(side: Side, from: Vec, to: Vec): number {
  const fz = side === 0 ? -1 : 1
  return M.atan2(to.x - from.x, (to.z - from.z) * fz)
}

/** Lo que hay que mover el dedo para que el gesto cuente como un disparo. */
const AIM_MIN = 0.9

/**
 * El disparo a partir del trazo. Sin rotacion: **el arma tira siempre recto**, asi que lo unico que
 * importa es donde la pones. La boca queda en tu linea de fuego **en la vertical del dedo** (el
 * arma solo se desliza de lado, nunca entra en el campo rival) y la bala sale de frente.
 *
 * Sigue haciendo falta cruzar tu raya (o sacar el arma ya pasada) y mover el dedo: disparar es un
 * gesto a proposito, y si no, no hay disparo ni se gasta el uso.
 */
export function weaponShotFromStroke(side: Side, stroke: Vec[]): { position: number } | null {
  const line = side === 0 ? FIRE_LINE : -FIRE_LINE
  const forward = side === 0 ? -1 : 1
  const first = stroke[0]
  const last = stroke[stroke.length - 1]
  if (!first || !last) return null
  if (M.hypot(last.x - first.x, last.z - first.z) < AIM_MIN) return null
  let crossed = forward < 0 ? first.z <= line : first.z >= line
  for (let i = 1; i < stroke.length && !crossed; i++) {
    const a = stroke[i - 1]!
    const b = stroke[i]!
    crossed = forward < 0 ? a.z > line && b.z <= line : a.z < line && b.z >= line
  }
  if (!crossed) return null
  return { position: last.x }
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

export function spawnUnit(
  battle: Battle,
  side: Side,
  card: BattleCard,
  at: Vec,
  quality: QualityId,
  frozen = false,
): Unit {
  // El clima de la partida recorta lo suyo (el tipo de tirador ya viene puesto en la carta).
  const conElClima = conClima(card, battle.clima, card.arquetipo)
  // El sello manda: cambia escudos, velocidad, cadencia, alcance y daño, y pone sus reglas al estilo.
  const sello = selloDelEstilo(estiloDe(card))
  const estilo = estiloConSello(estiloDe(card), sello)
  const mods = modsDe(sello, false)
  const enSuClima: BattleCard = {
    ...conElClima,
    speed: conElClima.speed * mods.velocidad,
    fireMs: Math.round(conElClima.fireMs * mods.cadencia),
    range: Math.round(conElClima.range * mods.alcance * 10) / 10,
  }
  const base = scaledStats(enSuClima, { ...qualityOfId(quality) })
  const stats = { ...base, shields: Math.max(1, Math.round(base.shields * mods.escudos)), damage: Math.round(base.damage * mods.fuerte) }
  const enemy = fortPos(other(side))
  const unit: Unit = {
    id: battle.nextId++,
    side,
    card: enSuClima,
    quality,
    x: at.x,
    z: at.z,
    heading: M.atan2(enemy.x - at.x, enemy.z - at.z),
    shields: stats.shields,
    maxShields: stats.shields,
    damage: stats.damage,
    state: 'andar',
    duelWith: null,
    cooldown: 0,
    fireIn: null,
    shotCount: 0,
    hitCount: 0,
    weaponHitCount: 0,
    hitStun: 0,
    knockback: { x: 0, z: 0 },
    fallTime: 0,
    fallDuration: 0,
    fallStrength: 0,
    fallDirection: { x: 0, z: 0 },
    bornAt: battle.time,
    diedAt: 0,
    frozen,
    inTunnel: 0,
    ammo: estilo.balas ?? BALAS,
    reloadLeft: 0,
    spawn: { ...at },
    estilo,
    sello,
    maxAmmo: estilo.balas ?? BALAS,
    // Los vaqueros recargan un cuarto antes: la polvora es lo suyo.
    recargaS: (estilo.recargaS ?? RECARGA_S) * (card.clase === undefined || card.clase === 'vaqueros' ? 0.75 : 1) * mods.recarga,
    rafaga: null,
    lastShotAt: -99,
    slowUntil: 0,
    impactos: 0,
    pulsoAt: battle.time + (estilo.pulso ? 2 : 0),
    sacrificado: false,
    marcaHasta: 0,
    torre: false,
    torreUsada: false,
    torreHasta: 0,
    baseShields: stats.shields,
    habilidad: habilidadDe(estilo),
    // Recien salida tarda un pelin en poder soltarla (que se vea primero entrar).
    hab: nuevoHabEstado(battle.time + 0.6),
  }
  battle.units.push(unit)
  battle.events.push({ type: 'spawn', unitId: unit.id, x: at.x, z: at.z, quality, side })
  return unit
}

function qualityOfId(id: QualityId) {
  const table: Record<QualityId, number> = { mal: 0, medio: 0.45, bien: 0.65, perfecto: 0.8, excelente: 0.9 }
  return qualityOf(table[id])
}

export type MotivoNo = 'pausa' | 'vivos' | 'hueco'

/** Cuantos soldados vivos tiene un bando ahora mismo. */
export function vivosDe(battle: Battle, side: Side): number {
  let n = 0
  for (const unit of battle.units) if (unit.side === side && alive(unit)) n++
  return n
}

/** Lo que multiplica la racha a la velocidad y la cadencia de un bando (1 = sin racha). */
export function rachaMult(battle: Battle, side: Side): number {
  return 1 + battle.racha[side] * RACHA_BONUS
}

/** Todo lo que hace falta para sacar la carta de un hueco: que haya sitio (el maximo de vivos de ahora) y la pausa. */
export function puedeSacar(
  battle: Battle,
  side: Side,
  slotIndex: number,
  x?: number,
  z?: number,
): { ok: true; at: Vec | null } | { ok: false; motivo: MotivoNo } {
  const card = slotCard(battle, side, slotIndex)
  if (!card || battle.over) return { ok: false, motivo: 'hueco' }
  if (!battle.practice && vivosDe(battle, side) >= maxVivosEn(battle.time)) return { ok: false, motivo: 'vivos' }
  if (!battle.practice && battle.time < battle.lastPlayAt[side] + PAUSA_ENTRE_CARTAS_S) return { ok: false, motivo: 'pausa' }
  if (x === undefined || z === undefined) return { ok: true, at: null }
  return { ok: true, at: clampDeploy(side, x, z) }
}

/**
 * Saca la carta de un hueco en el punto soltado, con la calidad del trazo. Solo si hay sitio (el
 * maximo de soldados vivos) y ha pasado la pausa. Si algo falla, la carta se queda en la mano.
 */
export function playCard(
  battle: Battle,
  side: Side,
  slotIndex: number,
  x: number,
  z: number,
  accuracy: number,
  torre = false,
): Unit | null {
  const check = puedeSacar(battle, side, slotIndex, x, z)
  if (!check.ok || !check.at) return null
  const slot = battle.hands[side].slots[slotIndex]!
  const card = slotCard(battle, side, slotIndex)!
  battle.lastPlayAt[side] = battle.time
  const unit = spawnUnit(battle, side, card, check.at, qualityOf(accuracy).id)
  if (torre) hacerTorre(battle, unit)
  slot.cardId = null
  slot.readyAt = battle.time + DRAW_S
  return unit
}

/** Convierte una tropa recien salida en torre: mas escudos y se queda donde esta. */
export function hacerTorre(battle: Battle, unit: Unit) {
  unit.torre = true
  unit.torreHasta = battle.time + TORRE_S
  unit.maxShields = Math.max(1, Math.round(unit.baseShields * TORRE_ESCUDOS * modsDe(unit.sello, true).escudos))
  unit.shields = unit.maxShields
  battle.events.push({ type: 'torre', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side, torre: true })
}

function buildTrack(points: Vec[]): Track {
  const pts: Vec[] = []
  for (const point of points) {
    const last = pts[pts.length - 1]
    if (!last || M.hypot(point.x - last.x, point.z - last.z) >= 0.12) pts.push({ ...point })
  }
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1]! + M.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z))
  }
  return { pts, cum, total: cum[cum.length - 1] ?? 0 }
}

/** Punto y direccion a una distancia del camino. Pasado el final, sigue recto. */
export function trackAt(track: Track, dist: number): { x: number; z: number; dx: number; dz: number } {
  const { pts, cum } = track
  if (pts.length < 2) return { x: pts[0]?.x ?? 0, z: pts[0]?.z ?? 0, dx: 0, dz: -1 }
  let index = 0
  while (index < pts.length - 2 && cum[index + 1]! < dist) index++
  const a = pts[index]!
  const b = pts[index + 1]!
  const len = Math.max(0.0001, cum[index + 1]! - cum[index]!)
  const dx = (b.x - a.x) / len
  const dz = (b.z - a.z) / len
  const along = dist - cum[index]!
  return { x: a.x + dx * along, z: a.z + dz * along, dx, dz }
}

/**
 * Dispara el arma del lado. El jugador solo elige **posicion**: la boca se desliza por su linea de
 * fuego (solo de lado) y la bala sale recta. El bot si puede apuntar con `angle`.
 */
export function fireWeapon(battle: Battle, side: Side, position: number, angle = 0, target?: Vec): boolean {
  if (battle.over) return false
  const hand = battle.hands[side]
  const card = weaponCard(battle, side)
  // Las especiales no tiran balas: se usan con `useSpecial`.
  if (!card || card.special || hand.weapon.uses <= 0) return false
  launchWeapon(battle, side, card, position, angle, target)
  spendWeapon(battle, side)
  return true
}

/** Gasta un uso del arma y, si se queda seca, la manda a cambiar. */
function spendWeapon(battle: Battle, side: Side): void {
  const hand = battle.hands[side]
  hand.weapon.uses -= 1
  if (hand.weapon.uses <= 0) {
    hand.weapon.lastId = hand.weapon.cardId
    hand.weapon.cardId = null
    hand.weapon.readyAt = battle.time + WEAPON_SWAP_S
  }
}

/**
 * Las armas especiales. No tiran balas: colocan su jugada y se gastan de una vez.
 *  - humo:  nube en `target` que esconde a tus tropas del rival mientras estan dentro.
 *  - rayo:  la tormenta deja al bando rival sin moverse ni disparar unos segundos.
 *  - tunel: boca en `target` (tu mitad) y la otra enfrente, a `TUNNEL_LEN`; tus tropas pasan.
 */
export function useSpecial(battle: Battle, side: Side, target: Vec): boolean {
  if (battle.over) return false
  const hand = battle.hands[side]
  const card = weaponCard(battle, side)
  if (!card?.special || hand.weapon.uses <= 0) return false

  if (card.special === 'humo') {
    const at = clampField(target)
    battle.smokes.push({
      id: battle.nextId++,
      side,
      x: at.x,
      z: at.z,
      radius: SMOKE_R,
      until: battle.time + SMOKE_S,
    })
    battle.events.push({ type: 'smoke', side, x: at.x, z: at.z, radius: SMOKE_R })
  } else if (card.special === 'rayo') {
    const foe = other(side)
    battle.stunUntil[foe] = Math.max(battle.stunUntil[foe], battle.time + ZAP_S)
    battle.events.push({ type: 'zap', side: foe, until: battle.stunUntil[foe] })
  } else {
    // El tunel es de tamano fijo: cae donde lo sueltas (en tu mitad) y la otra boca sale sola
    // enfrente, a la misma distancia de su fuerte.
    const entry = clampDeploy(side, target.x, target.z)
    const exit = tunnelExit(side, entry)
    battle.tunnels.push({ id: battle.nextId++, side, entry, exit, until: battle.time + TUNNEL_S })
    battle.events.push({ type: 'tunnel', side, entry, exit })
  }
  spendWeapon(battle, side)
  return true
}

/**
 * La boca de salida de un tunel: la misma jugada espejada en el campo rival. Como el tunel mide
 * justo lo que suman las dos zonas de despliegue, siempre cae dentro de la mitad contraria.
 */
export function tunnelExit(side: Side, entry: Vec): Vec {
  const depth = side === 0 ? entry.z : -entry.z
  const far = Math.max(DEPLOY_FRONT, Math.min(DEPLOY_BACK, TUNNEL_LEN - depth))
  return { x: entry.x, z: side === 0 ? -far : far }
}

/**
 * Cambia el arma por otra al azar. Se puede pedir cada `REROLL_S` segundos: si no ha recargado,
 * no hace nada. Tambien sirve para saltarse la espera de cuando te quedas sin arma.
 */
export function rerollWeapon(battle: Battle, side: Side): boolean {
  if (battle.over || battle.time < battle.rerollAt) return false
  battle.rerollAt = battle.time + REROLL_S
  const hand = battle.hands[side]
  hand.weapon.lastId = hand.weapon.cardId
  hand.weapon.cardId = drawWeapon(battle, hand)
  hand.weapon.uses = hand.weapon.cardId ? usesOf(cartaDelBando(battle, side, hand.weapon.cardId) as WeaponCard) : 0
  hand.weapon.readyAt = 0
  return true
}

function clampField(at: Vec): Vec {
  return {
    x: Math.min(FIELD_W / 2 - 0.5, Math.max(-FIELD_W / 2 + 0.5, at.x)),
    z: Math.min(FIELD_L / 2 - 0.5, Math.max(-FIELD_L / 2 + 0.5, at.z)),
  }
}

/**
 * Si el rival no ve a esa tropa: por el humo de su propio bando o por su sigilo. (El clima no
 * esconde a nadie: de noche o con tormenta se ven todos los muñecos, siempre.)
 */
export function hiddenBySmoke(battle: Battle, unit: Unit): boolean {
  if (unit.state === 'muerto') return false
  // El sigilo: invisible para el rival hasta unos segundos despues de disparar.
  if (unit.estilo.sigilo && battle.time - unit.lastShotAt > 2.2) return true
  for (const smoke of battle.smokes) {
    // Una torre es una empalizada clavada en el suelo: el humo no la esconde.
    if (unit.torre) break
    if (smoke.side !== unit.side || battle.time > smoke.until) continue
    if (M.hypot(unit.x - smoke.x, unit.z - smoke.z) <= smoke.radius) return true
  }
  return false
}

/**
 * Como se ve una tropa desde un bando:
 *  - `claro`:   normal, se ve entera.
 *  - `fantasma`: es tuya y va tapada por tu humo: se ve a medias.
 *  - `oculto`:  es del rival y no se ve (por su humo o su sigilo).
 */
export function smokeVisibility(battle: Battle, unit: Unit, viewer: Side): 'claro' | 'fantasma' | 'oculto' {
  if (!hiddenBySmoke(battle, unit)) return 'claro'
  return unit.side === viewer ? 'fantasma' : 'oculto'
}

/** Dispara una carga extra ganada en una vagoneta: una explosión de dinamita por uso. */
export function fireBonusDynamite(battle: Battle, side: Side, position: number, target: Vec): boolean {
  if (battle.over || battle.dynamiteAmmo[side] <= 0) return false
  const card = BUILTIN_WEAPONS.find((weapon) => weapon.id === 'dinamita')
  if (!card) return false
  const origin = clampFireLine(side, position)
  const landing = {
    x: Math.min(FIELD_W / 2 - 0.5, Math.max(-FIELD_W / 2 + 0.5, target.x)),
    z: Math.min(FIELD_L / 2 - 0.5, Math.max(-FIELD_L / 2 + 0.5, target.z)),
  }
  const distance = M.hypot(landing.x - origin.x, landing.z - origin.z)
  if (distance < 0.6) return false
  const direction = { x: (landing.x - origin.x) / distance, z: (landing.z - origin.z) / distance }
  const volley = battle.nextId++
  battle.volleyHits.set(volley, new Map())
  battle.bullets.push({
    id: battle.nextId++,
    side,
    mode: 'explosivo',
    weaponId: card.id,
    track: buildTrack([origin, landing]),
    dist: 0,
    maxDist: distance,
    speed: card.shot.speed,
    delay: 0,
    lateral: 0,
    shieldsPerHit: card.shot.shieldsPerHit,
    radius: card.shot.radius,
    pierce: false,
    volley,
    hit: new Set(),
    alive: true,
    x: origin.x,
    z: origin.z,
    dx: direction.x,
    dz: direction.z,
    accent: '#fb923c',
    fuseMs: DYNAMITE_FUSE_MS,
    proyectil: 'dinamita',
  })
  battle.dynamiteAmmo[side] -= 1
  battle.events.push({ type: 'weaponFired', side, weaponId: card.id, x: origin.x, z: origin.z })
  return true
}

/** Dispara un arma cualquiera sin gastar usos (para el campo de tiro del creador). */
export function testFire(battle: Battle, side: Side, card: WeaponCard, position: number, angle: number, target?: Vec): boolean {
  launchWeapon(battle, side, card, position, angle, target)
  return true
}

/** Lo mas cerca que puede caer una carga lanzada (si no, explotaria en tu propia mano). */
export const LOB_MIN = 1.5

/**
 * Donde cae de verdad una carga explosiva lanzada hacia `target`: justo ahi, salvo que quede mas
 * lejos que su alcance (entonces cae en el limite, en la misma direccion) o pegada a la boca.
 */
export function lobLanding(side: Side, position: number, range: number, target: Vec): Vec {
  const origin = clampFireLine(side, position)
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  const d = M.hypot(dx, dz)
  if (d < 0.001) return { x: origin.x, z: origin.z + (side === 0 ? -LOB_MIN : LOB_MIN) }
  const k = Math.min(range, Math.max(LOB_MIN, d)) / d
  return { x: origin.x + dx * k, z: origin.z + dz * k }
}

function launchWeapon(battle: Battle, side: Side, card: WeaponCard, position: number, angle: number, target?: Vec) {
  // El clima recorta el alcance de TUS disparos (noche y lluvia, sobre todo) y tu precision lo estira.
  const clima = ajusteDeDisparos(battle.clima) * (side === 0 ? battle.alcanceArma : 1)
  const shot = { ...card.shot, range: Math.max(3, Math.round(card.shot.range * clima * 10) / 10) }
  const origin = clampFireLine(side, position)
  const dir = aimDir(side, angle)
  // Las cargas explosivas con punto de caida se lanzan AHI (con su mecha); el resto, recto.
  const lob = shot.mode === 'explosivo' && target ? lobLanding(side, position, shot.range, target) : null
  // Ruta recta y algo mas larga que el alcance: la bala solo recorre su alcance.
  const far = shot.range + 3
  const track = lob
    ? buildTrack([origin, lob])
    : buildTrack([origin, { x: origin.x + dir.x * far, z: origin.z + dir.z * far }])
  const lobDist = lob ? M.hypot(lob.x - origin.x, lob.z - origin.z) : 0
  const lobDir = lob && lobDist > 0 ? { x: (lob.x - origin.x) / lobDist, z: (lob.z - origin.z) / lobDist } : dir
  const volley = battle.nextId++
  battle.volleyHits.set(volley, new Map())
  const count = shot.mode === 'perdigones' || shot.mode === 'rafaga' ? Math.max(1, shot.pellets) : 1
  for (let i = 0; i < count; i++) {
    let lateral = 0
    let delay = 0
    if (shot.mode === 'perdigones' && count > 1) {
      const spread = ((i / (count - 1) - 0.5) * shot.spread * Math.PI) / 180
      lateral = M.tan(spread)
    }
    if (shot.mode === 'rafaga') delay = i * 0.1
    battle.bullets.push({
      id: battle.nextId++,
      side,
      mode: shot.mode,
      weaponId: card.id,
      track,
      dist: 0,
      maxDist: lob ? lobDist : shot.range,
      speed: shot.speed,
      delay,
      lateral,
      shieldsPerHit: shot.shieldsPerHit,
      radius: shot.radius,
      pierce: shot.mode === 'perforante',
      volley,
      hit: new Set(),
      alive: true,
      x: origin.x,
      z: origin.z,
      dx: lobDir.x,
      dz: lobDir.z,
      accent: card.accent,
      fuseMs: lob ? (shot.mecha ?? DYNAMITE_FUSE_MS) : 0,
      proyectil: proyectilDe(card.model),
    })
  }
  battle.events.push({ type: 'weaponFired', side, weaponId: card.id, x: origin.x, z: origin.z })
}

// ---------------------------------------------------------------------------
// Paso de simulacion
// ---------------------------------------------------------------------------

export function alive(unit: Unit): boolean {
  return unit.state !== 'muerto'
}

/**
 * Quita escudos a un soldado. `source` es de donde viene el golpe; si trae su sello (un soldado, o
 * el origen de su tiro), el golpe se mide con los sellos: el tanque casi no recibe salvo de
 * asesinos y área, la distancia pega el doble al área… (ver `danoEntre`). Sin sello: el arma del
 * jugador si `weapon`, y si no, nadie en concreto (el clima).
 */
export function hurtUnit(battle: Battle, unit: Unit, amount: number, weapon: boolean, source?: Vec & { sello?: Sello }) {
  if (!alive(unit)) return
  const atacante: Atacante = source?.sello ?? (weapon ? 'arma' : null)
  amount *= danoEntre(atacante, unit.sello)
  // La cupula se come el golpe (y el que duerme se despierta).
  if (!antesDeHerir(battle, unit)) return
  // Con el cartel de "se busca" colgado, recibe el doble.
  amount *= multiplicadorDeDano(battle, unit)
  // El blindaje se come uno de cada tantos impactos.
  if (unit.estilo.blindaje) {
    unit.impactos += 1
    if (unit.impactos % unit.estilo.blindaje === 0) return
  }
  unit.shields = Math.max(0, unit.shields - amount)
  unit.hitCount += 1
  if (weapon) {
    unit.weaponHitCount += 1
    const resistance = Math.min(100, Math.max(0, unit.card.resistance))
    const force = M.pow((100 - resistance) / 100, 1.35)
    const dx = source ? unit.x - source.x : -M.sin(unit.heading)
    const dz = source ? unit.z - source.z : -M.cos(unit.heading)
    const length = M.hypot(dx, dz) || 1
    const hitScale = 1 + Math.max(0, amount - 1) * 0.15
    unit.knockback.x += (dx / length) * (2.4 * force * hitScale)
    unit.knockback.z += (dz / length) * (2.4 * force * hitScale)
    unit.hitStun = Math.max(unit.hitStun, 0.12 + force * 0.2)
    if (resistance <= 65 && force > 0.35 && unit.fallTime >= unit.fallDuration) {
      unit.fallTime = 0
      unit.fallDuration = 0.28 + force * 0.32
      unit.fallStrength = force
      unit.fallDirection = { x: dx / length, z: dz / length }
    }
  }
  battle.events.push({ type: 'unitHit', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side, weapon, amount })
  if (unit.shields <= 0) {
    unit.state = 'muerto'
    unit.diedAt = battle.time
    unit.duelWith = null
    unit.fireIn = null
    battle.muertes[unit.side] += 1
    battle.events.push({ type: 'unitDeath', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side })
    if (!unit.sacrificado) premioPorBaja(battle, unit)
    // Los barriles y los kamikazes explotan al caer: dan a los rivales que tengan cerca.
    if (unit.estilo.explota) {
      const radio = unit.estilo.explota
      battle.events.push({ type: 'blast', x: unit.x, z: unit.z, r: radio, side: unit.side })
      for (const foe of battle.units) {
        if (foe.side === unit.side || !alive(foe)) continue
        if (M.hypot(foe.x - unit.x, foe.z - unit.z) <= radio + UNIT_R * 0.5) {
          hurtUnit(battle, foe, 2, true, { x: unit.x, z: unit.z, sello: unit.sello })
        }
      }
    }
  }
}

/** El bando contrario cuenta la baja y sube su racha: sus soldados van mas rapido y disparan antes unos segundos. */
function premioPorBaja(battle: Battle, victima: Unit) {
  if (battle.practice) return
  const side = other(victima.side)
  battle.kills[side] += 1
  battle.racha[side] = Math.min(RACHA_MAX, battle.racha[side] + 1)
  battle.rachaHasta[side] = battle.time + RACHA_S
  battle.events.push({ type: 'baja', side, x: victima.x, z: victima.z, racha: battle.racha[side] })
}

function hurtFort(battle: Battle, side: Side, damage: number) {
  if (battle.practice || battle.over) return
  const fort = battle.forts[side]
  // Cuanto mas dura la partida, mas daño recibe el fuerte: asi los empates no se eternizan.
  fort.hp = Math.max(0, fort.hp - damage * furiaEn(battle.time))
  fort.hitCount += 1
  battle.events.push({ type: 'fortHit', side, damage })
  if (fort.hp <= 0) {
    battle.over = { winner: other(side), by: 'fuerte' }
    battle.events.push({ type: 'over', winner: other(side), by: 'fuerte' })
  }
}

/**
 * A quien le dispara un muñeco: **al que tenga a tiro, sea de la carta que sea** (el campo es un
 * campo de tiro entre todos). Cada tipo de tirador elige distinto:
 *  - el **selecto** va a por el mas flojo (el que menos escudos le quede);
 *  - el **profesional** va a por el que mas daño hace;
 *  - el **medio** y el **berserker**, al mas cercano.
 */
function findDuel(battle: Battle, unit: Unit): Unit | null {
  // Los medicos y los de apoyo no se pelean con soldados.
  if (unit.estilo.pacifico) return null
  // Las torres de tanque y de control no pegan (frenan, aturden… ver `pasoTorreSinDano`).
  if (unit.torre && torreSinDano(unit.sello)) return null
  // El de distancia marca a uno y no lo suelta mientras siga a tiro.
  if (unit.sello === 'distancia' && unit.duelWith !== null) {
    const marcado = battle.units.find((u) => u.id === unit.duelWith)
    if (marcado && alive(marcado) && !hiddenBySmoke(battle, marcado) && M.hypot(marcado.x - unit.x, marcado.z - unit.z) <= alcanceDe(unit) + UNIT_R) {
      return marcado
    }
  }
  let best: Unit | null = null
  let bestScore = Infinity
  for (const foe of battle.units) {
    if (foe.side === unit.side || !alive(foe)) continue
    // Con humo de por medio (o de sigilo) no se ven: no hay duelo.
    if (hiddenBySmoke(battle, foe)) continue
    const d = M.hypot(foe.x - unit.x, foe.z - unit.z)
    if (d > alcanceDe(unit) + UNIT_R) continue
    let score = d
    const objetivo = unit.estilo.objetivo
    if (objetivo === 'lejos') score = -d
    else if (objetivo === 'fuerte') score = -foe.shields * 10 + d * 0.1
    else if (objetivo === 'debil') score = foe.shields * 10 + d * 0.1
    // El asesino va primero a por los tanques.
    else if (objetivo === 'tanque') score = foe.sello === 'tanque' ? d - 2000 : d
    else if (unit.card.arquetipo === 'selecto') score = foe.shields * 10 + d * 0.1
    else if (unit.card.arquetipo === 'profesional') score = d - foe.damage * 0.03
    // Los cebos (y los tanques: les hacen focus) atraen los disparos de los que los tienen a tiro.
    // El de distancia no se deja: elige él su blanco.
    if (foe.estilo.provoca && d <= foe.estilo.provoca && unit.sello !== 'distancia') score -= 1000
    // El guardian (torre de cuerpo a cuerpo) se lleva la atencion de los que pasan a su lado.
    if (foe.torre && foe.estilo.cuerpo !== undefined && d <= GUARDIAN_ATRAE) score -= 900
    if (score < bestScore) {
      best = foe
      bestScore = score
    }
  }
  return best
}

/** Lo que suman los abanderados, cantineros y reinas aliados que tiene cerca esta tropa. */
function auraDe(battle: Battle, unit: Unit): { vel: number; cad: number } {
  let vel = 0
  let cad = 0
  for (const amigo of battle.units) {
    if (amigo === unit || amigo.side !== unit.side || !alive(amigo) || !amigo.estilo.aura) continue
    const aura = amigo.estilo.aura
    if (M.hypot(amigo.x - unit.x, amigo.z - unit.z) > aura.radio) continue
    vel += aura.vel ?? 0
    cad += aura.cadencia ?? 0
  }
  // Los estandartes, la ronda de whisky y la ceguera de los cuervos.
  const extra = extraDeHabilidades(battle, unit)
  return { vel: Math.min(0.9, vel + extra.vel), cad: Math.max(-0.5, Math.min(0.9, cad + extra.cad)) }
}

/** Escudos que quita cada tiro de esta tropa (la furia suma cuanto mas herida esta). */
function golpeDe(unit: Unit): number {
  const base = unit.estilo.golpe ?? 1
  const furia = unit.estilo.furia ?? 0
  const golpe = base + furia * (1 - unit.shields / Math.max(1, unit.maxShields))
  // El sello: el asesino quita muchísimo, el tanque y el control poco…
  return golpe * modsDe(unit.sello, unit.torre).golpe
}

/** Si un bando esta aturdido por el rayo, sus tropas ni andan ni disparan. */
export function isStunned(battle: Battle, side: Side): boolean {
  return battle.time < battle.stunUntil[side]
}

function stepUnit(battle: Battle, unit: Unit, dt: number, pace: Pace) {
  if (!alive(unit) || unit.frozen) return
  // Lo que le han dejado las habilidades de los demas (arder…).
  pasoEstados(battle, unit)
  if (!alive(unit)) return
  const inFall = unit.fallTime < unit.fallDuration
  if (inFall) {
    unit.fallTime = Math.min(unit.fallDuration, unit.fallTime + dt)
    const damp = M.exp(-dt * 3.5)
    unit.knockback.x *= damp
    unit.knockback.z *= damp
    unit.x += unit.knockback.x * dt
    unit.z += unit.knockback.z * dt
    unit.hitStun = Math.max(unit.hitStun, unit.fallDuration - unit.fallTime)
    return
  }
  if (unit.hitStun > 0) {
    unit.hitStun = Math.max(0, unit.hitStun - dt)
    const damp = M.exp(-dt * 8)
    unit.knockback.x *= damp
    unit.knockback.z *= damp
    unit.x += unit.knockback.x * dt
    unit.z += unit.knockback.z * dt
    return
  }
  unit.fallStrength = 0

  // Granada electrica: el bando entero se queda clavado donde este, sin disparar.
  if (isStunned(battle, unit.side)) {
    unit.state = 'aturdido'
    unit.duelWith = null
    unit.fireIn = null
    return
  }
  // Atrapada en una red, dormida o mareada: ni anda ni dispara (y pierde la habilidad en curso).
  if (bloqueada(battle, unit) || congelada(battle, unit)) {
    unit.state = 'aturdido'
    unit.duelWith = null
    unit.fireIn = null
    unit.rafaga = null
    unit.hab.activa = null
    return
  }
  if (unit.state === 'aturdido') unit.state = 'andar'

  // Las torres de tanque y de control no pegan (ni con habilidad): frenan, y aturden, congelan o
  // empujan a los que entran. Al acabarse su tiempo, se sueltan como cualquier torre.
  if (unit.torre && torreSinDano(unit.sello)) {
    if (battle.time >= unit.torreHasta) soltarTorre(battle, unit.id)
    else pasoTorreSinDano(battle, unit)
    return
  }
  // La habilidad en curso manda: mientras dura, ni anda ni dispara normal.
  if (unit.hab.activa && pasoHabilidad(battle, unit, dt)) return

  const enemyFort = fortPos(other(unit.side))
  const duel = findDuel(battle, unit)
  // **La habilidad salta al encontrarse con un enemigo** (las de apoyo, con uno cerca).
  if (intentarHabilidad(battle, unit, duel)) {
    pasoHabilidad(battle, unit, 0)
    return
  }
  const cartDist = battle.cart ? M.hypot(battle.cart.x - unit.x, battle.cart.z - unit.z) : Infinity
  // La vagoneta ya no para la partida: solo atrae a los que pasan cerca, y primero van los enemigos.
  const cartNear = Boolean(battle.cart) && cartDist <= VAGONETA_ATRAE
  const cartTarget = battle.cart && cartDist <= alcanceDe(unit) + UNIT_R ? battle.cart : null
  const fdx = enemyFort.x - unit.x
  const fdz = enemyFort.z - unit.z
  const fortDist = M.hypot(fdx, fdz)
  // La linea de los soldados: todos se plantan igual de lejos de la casa, tengan el alcance que
  // tengan, y desde ahi ya le disparan.
  const inRange = fortDist <= SIEGE_RANGE + REACH_SLACK

  // Se le acaba el tiempo de torre: vuelve a ser soldado y avanza.
  if (unit.torre && battle.time >= unit.torreHasta && !unit.hab.activa) {
    soltarTorre(battle, unit.id)
    return
  }
  // La torre no se mueve: si no tiene a quien pegar, se queda quieta esperando.
  if (unit.torre && !duel && !cartTarget && !inRange) {
    unit.state = 'fuego'
    unit.duelWith = null
    unit.fireIn = null
    unit.rafaga = null
    unit.ammo = Math.min(unit.maxAmmo, unit.ammo + (dt * unit.maxAmmo) / unit.recargaS)
    if (unit.estilo.pulso && battle.time >= unit.pulsoAt) soltarPulso(battle, unit)
    return
  }
  if (duel || cartTarget || inRange) {
    if (unit.state !== 'fuego') {
      unit.state = 'fuego'
      unit.cooldown = 0.35
    }
    unit.duelWith = duel ? duel.id : null
    const tx = duel ? duel.x : cartTarget?.x ?? enemyFort.x
    const tz = duel ? duel.z : cartTarget?.z ?? enemyFort.z
    unit.heading = M.atan2(tx - unit.x, tz - unit.z)
  } else {
    unit.state = 'andar'
    unit.duelWith = null
    unit.fireIn = null
    const aura = auraDe(battle, unit)
    const frenado = battle.time < unit.slowUntil ? 0.5 : 1
    const speed = WALK_SPEED * unit.card.speed * pace.mult * rachaMult(battle, unit.side) * (1 + aura.vel) * frenado
    let target: Vec = cartNear && battle.cart ? { x: battle.cart.x, z: battle.cart.z } : enemyFort
    let targetRadius = cartNear ? UNIT_R : SIEGE_RANGE
    // Los de cuerpo a cuerpo se lanzan a por el enemigo mas cercano que vean.
    if (unit.estilo.cuerpo) {
      let cercano: Unit | null = null
      let mejor = unit.estilo.cuerpo
      for (const foe of battle.units) {
        if (foe.side === unit.side || !alive(foe) || hiddenBySmoke(battle, foe)) continue
        // El asesino persigue antes a un tanque (como si estuviera más cerca).
        const d = M.hypot(foe.x - unit.x, foe.z - unit.z) - (unit.sello === 'asesino' && foe.sello === 'tanque' ? 5 : 0)
        if (d < mejor) {
          mejor = d
          cercano = foe
        }
      }
      if (cercano) {
        target = { x: cercano.x, z: cercano.z }
        targetRadius = 0.9
      }
    }
    // Hacia el fuerte, cada uno **por su carril**: avanza recto y se va arrimando al centro poco a
    // poco. (Si todos fueran derechos al centro del fuerte, acabarían en fila, uno encima de otro.)
    const alFuerte = target === enemyFort
    if (alFuerte) target = { x: unit.x * 0.92 + enemyFort.x * 0.08, z: enemyFort.z }
    const dx = target.x - unit.x
    const dz = target.z - unit.z
    const distance = M.hypot(dx, dz) || 1
    // Mientras anda va cargando el tambor.
    unit.ammo = Math.min(unit.maxAmmo, unit.ammo + (dt * unit.maxAmmo) / unit.recargaS)
    unit.reloadLeft = 0
    const falta = alFuerte ? fortDist - SIEGE_RANGE : distance - targetRadius
    const move = Math.min(speed * dt, Math.max(0, falta))
    unit.x += (dx / distance) * move
    unit.z += (dz / distance) * move
    unit.heading = M.atan2(dx, dz)
  }

  // Tunel: la tropa que pisa una boca sale por la otra. Solo cuenta al ENTRAR: si se queda parada
  // dentro (por ejemplo peleandose) no va rebotando de una punta a la otra.
  for (const tunnel of battle.tunnels) {
    if (tunnel.side !== unit.side || battle.time > tunnel.until) continue
    const atEntry = M.hypot(unit.x - tunnel.entry.x, unit.z - tunnel.entry.z) <= TUNNEL_R
    const atExit = M.hypot(unit.x - tunnel.exit.x, unit.z - tunnel.exit.z) <= TUNNEL_R
    if (!atEntry && !atExit) {
      if (unit.inTunnel === tunnel.id) unit.inTunnel = 0
      continue
    }
    if (unit.inTunnel === tunnel.id) continue
    unit.inTunnel = tunnel.id
    const to = atEntry ? tunnel.exit : tunnel.entry
    battle.events.push({
      type: 'teleport',
      side: unit.side,
      from: { x: unit.x, z: unit.z },
      to: { x: to.x, z: to.z },
    })
    unit.x = to.x
    unit.z = to.z
    unit.duelWith = null
    break
  }

  // Los medicos, predicadores y demas sueltan su pulso cada cierto tiempo.
  if (unit.estilo.pulso && battle.time >= unit.pulsoAt) soltarPulso(battle, unit)

  // Kamikaze: al tener un rival al alcance, se lanza a explotar.
  // (De torre no: la torre lanza su fardo de dinamita.)
  // (Espera a tener lista su mecha: si llega antes de nada, explota sin su habilidad.)
  if (unit.estilo.suicida && duel && !unit.torre && battle.time >= unit.bornAt + 0.65) {
    unit.sacrificado = true
    hurtUnit(battle, unit, unit.shields + 1, false)
    return
  }

  if (unit.state === 'fuego') {
    if (unit.reloadLeft > 0) {
      // Recargando: parado y a tiro, sin disparar.
      unit.reloadLeft -= dt
      if (unit.reloadLeft <= 0) {
        unit.reloadLeft = 0
        unit.ammo = unit.maxAmmo
        unit.cooldown = 0.2
      }
    } else if (unit.rafaga && unit.rafaga.left > 0) {
      // Una rafaga en curso: sale un disparo cada poco.
      unit.rafaga.in -= dt
      if (unit.rafaga.in <= 0) {
        unit.rafaga.left -= 1
        unit.rafaga.in = (unit.estilo.separacionMs ?? 120) / 1000
        unit.shotCount += 1
        launchTroopShot(battle, unit)
        if (unit.rafaga.left <= 0) unit.rafaga = null
      }
    } else if (unit.fireIn !== null) {
      unit.fireIn -= dt
      if (unit.fireIn <= 0) {
        unit.fireIn = null
        launchTroopShot(battle, unit)
        const disparos = unit.estilo.disparos ?? 1
        if (disparos > 1) unit.rafaga = { left: disparos - 1, in: (unit.estilo.separacionMs ?? 120) / 1000 }
      }
    } else {
      unit.cooldown -= dt
      if (unit.cooldown <= 0) {
        if (unit.ammo < 1) {
          unit.reloadLeft = unit.recargaS
          battle.events.push({ type: 'reload', unitId: unit.id, x: unit.x, z: unit.z })
          return
        }
        unit.ammo -= 1
        const aura = auraDe(battle, unit)
        // La espera cuenta desde que acaba la rafaga (mientras dispara no corre).
        unit.cooldown = unit.card.fireMs / 1000 / (rachaMult(battle, unit.side) * (1 + aura.cad) * (unit.torre ? TORRE_CADENCIA / modsDe(unit.sello, true).cadencia : 1))
        unit.shotCount += 1
        unit.fireIn = WINDUP
      }
    }
  }
}

/** El pulso de un medico (cura a los suyos) o de un predicador (frena a los rivales): solo si hay a quien afectar. */
/** Cada cuánto suelta su golpe fuerte la torre de un tanque o de un control. */
const PULSO_TORRE_S: Record<ReturnType<typeof efectoDeTorre>, number> = { ralentiza: 3, aturde: 4, congela: 6, empuja: 3.5 }

/**
 * **La torre que no pega** (tanques y controles): todo rival dentro de su zona va frenado, y cada
 * poco suelta su golpe fuerte: frenar del todo, aturdir, congelar o empujar hacia fuera.
 */
function pasoTorreSinDano(battle: Battle, unit: Unit) {
  unit.state = 'fuego'
  unit.duelWith = null
  unit.fireIn = null
  unit.rafaga = null
  const radio = alcanceDe(unit)
  const efecto = efectoDeTorre(unit.estilo)
  const toca = battle.time >= unit.pulsoAt
  let afecta = 0
  for (const foe of battle.units) {
    if (foe.side === unit.side || !alive(foe) || hiddenBySmoke(battle, foe)) continue
    if (M.hypot(foe.x - unit.x, foe.z - unit.z) > radio + UNIT_R) continue
    foe.slowUntil = Math.max(foe.slowUntil, battle.time + 0.3)
    afecta++
    if (!toca) continue
    if (efecto === 'ralentiza') foe.slowUntil = Math.max(foe.slowUntil, battle.time + 3)
    else if (efecto === 'aturde') foe.hitStun = Math.max(foe.hitStun, 0.9)
    else if (efecto === 'congela') {
      foe.hitStun = Math.max(foe.hitStun, 1.6)
      foe.slowUntil = Math.max(foe.slowUntil, battle.time + 3)
    } else {
      const dx = foe.x - unit.x
      const dz = foe.z - unit.z
      const l = M.hypot(dx, dz) || 1
      foe.knockback.x += (dx / l) * 5
      foe.knockback.z += (dz / l) * 5
      foe.hitStun = Math.max(foe.hitStun, 0.3)
    }
  }
  if (toca && afecta > 0) {
    unit.pulsoAt = battle.time + PULSO_TORRE_S[efecto]
    unit.shotCount += 1
    battle.events.push({ type: 'pulso', side: unit.side, x: unit.x, z: unit.z, r: radio, tipo: 'grito' })
  }
}

function soltarPulso(battle: Battle, unit: Unit) {
  const pulso = unit.estilo.pulso
  if (!pulso) return
  let afecta = 0
  // La cura a uno solo: al que más escudos le falten de los que tiene cerca (torres incluidas).
  if (pulso.individual && pulso.cura) {
    let herido: Unit | null = null
    let falta = 0
    for (const otro of battle.units) {
      if (otro.side !== unit.side || !alive(otro) || otro === unit) continue
      if (M.hypot(otro.x - unit.x, otro.z - unit.z) > pulso.radio * (unit.torre ? 1.5 : 1)) continue
      const tope = pulso.sobreEscudo ? otro.maxShields + 2 : otro.maxShields
      if (tope - otro.shields > falta) {
        falta = tope - otro.shields
        herido = otro
      }
    }
    if (!herido) {
      unit.pulsoAt = battle.time + 1
      return
    }
    herido.shields = Math.min(pulso.sobreEscudo ? herido.maxShields + 2 : herido.maxShields, herido.shields + pulso.cura)
    unit.pulsoAt = battle.time + pulso.cadaS
    battle.events.push({ type: 'pulso', side: unit.side, x: herido.x, z: herido.z, r: 1.4, tipo: 'cura' })
    return
  }
  for (const otro of battle.units) {
    if (!alive(otro) || otro === unit) continue
    if (M.hypot(otro.x - unit.x, otro.z - unit.z) > pulso.radio * (unit.torre ? 1.5 : 1)) continue
    if (otro.side === unit.side) {
      if (pulso.cura && (otro.shields < otro.maxShields || (pulso.sobreEscudo && otro.shields < otro.maxShields + 2))) {
        otro.shields = Math.min(pulso.sobreEscudo ? otro.maxShields + 2 : otro.maxShields, otro.shields + pulso.cura)
        afecta++
      }
    } else if ((pulso.ralentiza || pulso.aturde) && !hiddenBySmoke(battle, otro)) {
      if (pulso.ralentiza) otro.slowUntil = Math.max(otro.slowUntil, battle.time + pulso.ralentiza)
      if (pulso.aturde) otro.hitStun = Math.max(otro.hitStun, pulso.aturde)
      afecta++
    }
  }
  if (afecta === 0) {
    unit.pulsoAt = battle.time + 1
    return
  }
  unit.pulsoAt = battle.time + pulso.cadaS
  battle.events.push({ type: 'pulso', side: unit.side, x: unit.x, z: unit.z, r: pulso.radio * (unit.torre ? 1.5 : 1), tipo: pulso.cura ? 'cura' : 'grito' })
}

function launchTroopShot(battle: Battle, unit: Unit) {
  let duel = unit.duelWith !== null ? battle.units.find((u) => u.id === unit.duelWith) : undefined
  // La minigun y los de ráfaga que "reapuntan" cambian de blanco en cada disparo.
  if (unit.estilo.reapunta) {
    // Reparte los tiros: cada uno va a un rival cualquiera de los que alcanza.
    const alcance = battle.units.filter(
      (foe) =>
        foe.side !== unit.side &&
        alive(foe) &&
        !hiddenBySmoke(battle, foe) &&
        M.hypot(foe.x - unit.x, foe.z - unit.z) <= alcanceDe(unit) + UNIT_R,
    )
    if (alcance.length > 0) duel = alcance[Math.floor(battle.rand() * alcance.length)]
  }
  const foeSide = other(unit.side)
  const cart = battle.cart
  const to = duel && alive(duel) ? { x: duel.x, z: duel.z } : cart ? { x: cart.x, z: cart.z } : fortPos(foeSide)
  // Si el duelo acabo mientras apuntaba, el tiro va al objetivo que aun exista.
  if (!duel || !alive(duel)) {
    if (!cart) {
      const fort = fortPos(foeSide)
      if (M.hypot(fort.x - unit.x, fort.z - unit.z) > SIEGE_RANGE + REACH_SLACK) return
    }
  }
  const d = M.hypot(to.x - unit.x, to.z - unit.z)
  unit.lastShotAt = battle.time
  const shot: TroopShot = {
    id: battle.nextId++,
    side: unit.side,
    from: { x: unit.x, z: unit.z },
    to,
    t: 0,
    dur: unit.estilo.cuerpo !== undefined ? 0.04 : Math.max(0.08, d / TROOP_SHOT_SPEED),
    target: duel && alive(duel) ? { kind: 'unit', id: duel.id } : cart ? { kind: 'cart' } : { kind: 'fort', side: foeSide },
    damage: unit.damage,
    gun: unit.card.look.weapon,
    golpe: unit.estilo.azar ? 0.5 + battle.rand() * 2.5 : golpeDe(unit),
    estilo: unit.estilo,
    rebotes: unit.estilo.rebota ?? 0,
    dados: [],
    // El guardian golpea a distancia con su onda: no lleva bala, pero se pinta la onda en el blanco.
    melee: unit.estilo.cuerpo !== undefined,
    marca: unit.card.clase === 'indios',
    sello: unit.sello,
    frena: unit.torre && unit.estilo.cuerpo !== undefined,
    deTorre: unit.torre,
  }
  // La tropa dispara: la escena lo oye (ruido de bala, el tajo si es de cerca) y la animacion se
  // dispara por su cuenta.
  battle.events.push({ type: 'troopShot', side: unit.side, x: unit.x, z: unit.z, hacia: { x: to.x, z: to.z }, golpe: shot.golpe, melee: shot.melee, unitId: unit.id })
  battle.shots.push(shot)
}

/** Lo que ocupa cada soldado en el suelo (los grandes, más): así no se pisan unos a otros. */
function sitioDe(unit: Unit): number {
  return UNIT_R * 1.3 * (unit.estilo.tam ?? 1)
}

/**
 * Nadie se pone encima de nadie: los del mismo bando se apartan (sobre todo de lado, para no
 * frenarse) y con los rivales también se guarda la distancia (cuerpo a cuerpo se pegan, pero no
 * se meten uno dentro del otro). Las torres no se mueven: se aparta el otro.
 */
function separate(battle: Battle) {
  const list = battle.units.filter((unit) => alive(unit) && !unit.frozen)
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!
      const b = list[j]!
      const mismo = a.side === b.side
      const dx = b.x - a.x
      const dz = b.z - a.z
      const d = M.hypot(dx, dz)
      const min = (sitioDe(a) + sitioDe(b)) * (mismo ? 1 : 0.8)
      if (d >= min) continue
      const ma = a.torre ? 0 : 1
      const mb = b.torre ? 0 : 1
      if (ma + mb === 0) continue
      const push = min - d
      const nx = d > 0.001 ? dx / d : a.id < b.id ? 1 : -1
      const nz = d > 0.001 ? dz / d : 0
      // Los del mismo bando se apartan de lado (sin frenarse); los rivales, del todo.
      const kz = mismo ? 0.3 : 1
      const ka = (push * ma) / (ma + mb)
      const kb = (push * mb) / (ma + mb)
      a.x -= nx * ka
      a.z -= nz * ka * kz
      b.x += nx * kb
      b.z += nz * kb * kz
    }
  }
  for (const unit of list) {
    unit.x = Math.min(FIELD_W / 2 - 0.4, Math.max(-FIELD_W / 2 + 0.4, unit.x))
    unit.z = Math.min(FIELD_L / 2 - 0.4, Math.max(-FIELD_L / 2 + 0.4, unit.z))
  }
}

function stepBullet(battle: Battle, bullet: Bullet, dt: number) {
  if (!bullet.alive) return
  if (bullet.delay > 0) {
    bullet.delay -= dt
    if (bullet.delay > 0) return
  }
  const cap = bullet.mode === 'perdigones' ? 2 : bullet.mode === 'rafaga' ? 3 : 99
  const hits = battle.volleyHits.get(bullet.volley) ?? new Map<number, number>()
  const enemyFort = fortPos(other(bullet.side))
  let remaining = bullet.speed * dt
  // Pasos cortos: una bala rapida no se salta a nadie.
  while (remaining > 0 && bullet.alive) {
    const move = Math.min(0.25, remaining)
    remaining -= move
    bullet.dist = Math.min(bullet.maxDist, bullet.dist + move)
    const at = trackAt(bullet.track, bullet.dist)
    const nx = -at.dz
    const nz = at.dx
    bullet.x = at.x + nx * bullet.lateral * bullet.dist
    bullet.z = at.z + nz * bullet.lateral * bullet.dist
    bullet.dx = at.dx
    bullet.dz = at.dz

    if (Math.abs(bullet.x) > FIELD_W / 2 + 0.3 || Math.abs(bullet.z) > FIELD_L / 2 + 0.3) {
      bullet.alive = false
      battle.events.push({ type: 'bulletEnd', x: bullet.x, z: bullet.z, why: 'fuera' })
      break
    }

    if (bullet.mode !== 'explosivo') {
      if (M.hypot(bullet.x - enemyFort.x, bullet.z - enemyFort.z) < FORT_R) {
        bullet.alive = false
        battle.events.push({ type: 'bulletEnd', x: bullet.x, z: bullet.z, why: 'fuerte' })
        break
      }
      if (battle.cart && M.hypot(battle.cart.x - bullet.x, battle.cart.z - bullet.z) <= UNIT_R + 0.25) {
        hitCart(battle, bullet.side, bullet.shieldsPerHit * 80)
        if (!bullet.pierce) {
          bullet.alive = false
          break
        }
      }
      for (const unit of battle.units) {
        if (unit.side === bullet.side || !alive(unit) || bullet.hit.has(unit.id)) continue
        if (M.hypot(unit.x - bullet.x, unit.z - bullet.z) > UNIT_R + 0.2) continue
        const taken = hits.get(unit.id) ?? 0
        if (taken >= cap) continue
        hits.set(unit.id, taken + 1)
        bullet.hit.add(unit.id)
        hurtUnit(
          battle,
          unit,
          bullet.shieldsPerHit,
          true,
          { x: bullet.x - bullet.dx, z: bullet.z - bullet.dz },
        )
        if (!bullet.pierce) {
          bullet.alive = false
          break
        }
      }
      if (!bullet.alive) break
    }

    if (bullet.dist >= bullet.maxDist) {
      // La carga se queda donde ha caido mientras corre la mecha.
      if (bullet.mode === 'explosivo' && bullet.fuseMs > 0) {
        bullet.fuseMs -= dt * 1000
        if (bullet.fuseMs > 0) break
      }
      bullet.alive = false
      if (bullet.mode === 'explosivo') {
        battle.events.push({ type: 'blast', x: bullet.x, z: bullet.z, r: bullet.radius, side: bullet.side })
        if (battle.cart && M.hypot(battle.cart.x - bullet.x, battle.cart.z - bullet.z) <= bullet.radius) {
          hitCart(battle, bullet.side, bullet.shieldsPerHit * 180)
        }
        for (const unit of battle.units) {
          if (unit.side === bullet.side || !alive(unit)) continue
          if (M.hypot(unit.x - bullet.x, unit.z - bullet.z) <= bullet.radius + UNIT_R * 0.5) {
            hurtUnit(battle, unit, bullet.shieldsPerHit, true, { x: bullet.x, z: bullet.z })
          }
        }
      } else {
        battle.events.push({ type: 'bulletEnd', x: bullet.x, z: bullet.z, why: 'alcance' })
      }
    }
  }
  battle.volleyHits.set(bullet.volley, hits)
}

function stepShot(battle: Battle, shot: TroopShot, dt: number): boolean {
  shot.t += dt
  if (shot.t < shot.dur) return true
  if (shot.target.kind === 'fort') {
    hurtFort(battle, shot.target.side, shot.damage)
  } else if (shot.target.kind === 'cart') {
    hitCart(battle, shot.side, Math.max(25, shot.damage * 5))
  } else {
    const targetId = shot.target.id
    const unit = battle.units.find((u) => u.id === targetId)
    if (unit) impactarTiro(battle, shot, unit)
  }
  return false
}

/** Lo que hace un tiro al llegar a un soldado: el golpe, y lo que traiga su estilo (area, rebote, perforante, campo, empujon…). */
function impactarTiro(battle: Battle, shot: TroopShot, unit: Unit) {
  const estilo = shot.estilo
  const origen = { x: shot.from.x, z: shot.from.z, sello: shot.sello }
  // En el duelo no hay daño de fortaleza: cada tiro quita sus escudos (1 por defecto).
  // La presa marcada por un indio recibe un cuarto mas de todos los indios.
  const marcada = battle.time < unit.marcaHasta
  hurtUnit(battle, unit, shot.marca && marcada ? shot.golpe * 1.25 : shot.golpe, false, origen)
  if (shot.marca && alive(unit)) {
    if (!marcada) battle.events.push({ type: 'marca', x: unit.x, z: unit.z })
    unit.marcaHasta = battle.time + 4
  }
  shot.dados.push(unit.id)
  if (alive(unit)) {
    if (estilo.aturde) unit.hitStun = Math.max(unit.hitStun, estilo.aturde)
    if (estilo.ralentiza) unit.slowUntil = Math.max(unit.slowUntil, battle.time + estilo.ralentiza)
    if (shot.frena) unit.slowUntil = Math.max(unit.slowUntil, battle.time + 1.2)
    if (shot.deTorre) battle.events.push({ type: 'golpeTorre', x: unit.x, z: unit.z, side: shot.side, guardian: shot.frena })
    if (estilo.empuja) {
      const dx = unit.x - origen.x
      const dz = unit.z - origen.z
      const len = M.hypot(dx, dz) || 1
      // Positivo: lo empuja lejos; negativo: lo arrastra hacia quien disparo.
      unit.knockback.x += (dx / len) * estilo.empuja * 2.2
      unit.knockback.z += (dz / len) * estilo.empuja * 2.2
      unit.hitStun = Math.max(unit.hitStun, 0.18)
    }
  }
  // Area: los que estan cerca del blanco tambien se llevan el golpe (con el nivel de la explosion).
  if (estilo.area) {
    if (estilo.area >= 2) battle.events.push({ type: 'blast', x: unit.x, z: unit.z, r: estilo.area, side: shot.side })
    for (const foe of battle.units) {
      if (foe === unit || foe.side === shot.side || !alive(foe)) continue
      if (M.hypot(foe.x - unit.x, foe.z - unit.z) <= estilo.area + UNIT_R * 0.5) {
        hurtUnit(battle, foe, Math.max(0.5, shot.golpe * 0.6), true, { x: unit.x, z: unit.z, sello: shot.sello })
      }
    }
  }
  // Perforante: todos los de la linea del disparo, mas alla del blanco.
  if (estilo.perfora) {
    const dx = unit.x - origen.x
    const dz = unit.z - origen.z
    const largo = M.hypot(dx, dz) || 1
    const nx = dx / largo
    const nz = dz / largo
    for (const foe of battle.units) {
      if (foe === unit || foe.side === shot.side || !alive(foe)) continue
      const rx = foe.x - origen.x
      const rz = foe.z - origen.z
      const along = rx * nx + rz * nz
      const lateral = Math.abs(rx * nz - rz * nx)
      if (along > 0 && along < largo + 6 && lateral <= 0.75) hurtUnit(battle, foe, shot.golpe, false, origen)
    }
  }
  // Rebote: la bala salta a otro enemigo cercano.
  if (shot.rebotes > 0) {
    let siguiente: Unit | null = null
    let mejor = 4.5
    for (const foe of battle.units) {
      if (foe.side === shot.side || !alive(foe) || shot.dados.includes(foe.id) || hiddenBySmoke(battle, foe)) continue
      const d = M.hypot(foe.x - unit.x, foe.z - unit.z)
      if (d < mejor) {
        mejor = d
        siguiente = foe
      }
    }
    if (siguiente) {
      battle.shots.push({
        ...shot,
        id: battle.nextId++,
        from: { x: unit.x, z: unit.z },
        to: { x: siguiente.x, z: siguiente.z },
        t: 0,
        dur: Math.max(0.08, mejor / (TROOP_SHOT_SPEED * 1.4)),
        target: { kind: 'unit', id: siguiente.id },
        rebotes: shot.rebotes - 1,
        dados: [...shot.dados],
      })
    }
  }
  // Campo: deja fuego, gas, cepos o un circulo de balas en el suelo.
  const campo = estilo.campo
  if (campo) {
    const mios = battle.campos.filter((c) => c.side === shot.side)
    if (mios.length >= 4) battle.campos = battle.campos.filter((c) => c !== mios[0])
    battle.campos.push({
      id: battle.nextId++,
      side: shot.side,
      sello: shot.sello,
      x: unit.x,
      z: unit.z,
      radio: campo.radio,
      until: battle.time + campo.durS,
      next: battle.time + campo.cadaS,
      cadaS: campo.cadaS,
      golpe: campo.golpe,
      ralentiza: campo.ralentiza ?? 0,
      color: campo.color,
    })
  }
}

/** Los campos del suelo dan (o frenan) a los rivales de dentro, cada cierto tiempo. */
function stepCampos(battle: Battle) {
  if (battle.campos.length === 0) return
  battle.campos = battle.campos.filter((campo) => campo.until > battle.time)
  for (const campo of battle.campos) {
    if (battle.time < campo.next) continue
    campo.next += campo.cadaS
    for (const foe of battle.units) {
      if (foe.side === campo.side || !alive(foe)) continue
      if (M.hypot(foe.x - campo.x, foe.z - campo.z) > campo.radio) continue
      if (campo.ralentiza) foe.slowUntil = Math.max(foe.slowUntil, battle.time + campo.ralentiza)
      if (campo.golpe > 0) hurtUnit(battle, foe, campo.golpe, false, { x: campo.x, z: campo.z, sello: campo.sello })
    }
  }
}

function stepHands(battle: Battle) {
  if (battle.practice) return
  for (const side of [0, 1] as Side[]) {
    const hand = battle.hands[side]
    for (const slot of hand.slots) {
      if (!slot.cardId && battle.time >= slot.readyAt) {
        // Nunca dos iguales en la mano: se evitan las que ya estan en los otros huecos.
        const enMano = hand.slots.map((other) => other.cardId).filter((id): id is string => Boolean(id))
        slot.cardId = drawBattle(battle, hand, enMano)
      }
    }
    if (!hand.weapon.cardId && battle.time >= hand.weapon.readyAt) {
      hand.weapon.cardId = drawWeapon(battle, hand)
      hand.weapon.uses = hand.weapon.cardId ? usesOf(cartaDelBando(battle, side, hand.weapon.cardId) as WeaponCard) : 0
    }
  }
}

/** Avanza la batalla. Usa pasos fijos cortos para que todo vaya igual en cualquier maquina. */
export function step(battle: Battle, dt: number): void {
  if (battle.over) return
  let left = Math.min(0.25, Math.max(0, dt))
  while (left > 0 && !battle.over) {
    const h = Math.min(1 / 60, left)
    left -= h
    tick(battle, h)
  }
}

function tick(battle: Battle, dt: number) {
  battle.time += dt
  // Lo que se acaba, se va.
  if (battle.smokes.some((smoke) => smoke.until <= battle.time)) {
    battle.smokes = battle.smokes.filter((smoke) => smoke.until > battle.time)
  }
  if (battle.tunnels.some((tunnel) => tunnel.until <= battle.time)) {
    battle.tunnels = battle.tunnels.filter((tunnel) => tunnel.until > battle.time)
  }
  if (!battle.practice && !battle.cart && battle.time >= battle.nextCartAt) spawnCart(battle)
  if (!battle.practice) stepReloj(battle)
  stepCampos(battle)
  pasoEfectos(battle)
  pasoClima(battle, dt)
  const pace = paceAt(battle.time)
  if (pace.index !== battle.paceIndex) {
    battle.paceIndex = pace.index
    battle.events.push({ type: 'pace', pace })
  }
  for (const unit of battle.units) stepUnit(battle, unit, dt, pace)
  separate(battle)
  // Los tiros que rebotan se añaden mientras se recorre la lista: se guardan aparte y se unen despues.
  const enVuelo = battle.shots
  battle.shots = []
  const siguen = enVuelo.filter((shot) => stepShot(battle, shot, dt))
  battle.shots = [...siguen, ...battle.shots]
  for (const bullet of battle.bullets) stepBullet(battle, bullet, dt)
  battle.bullets = battle.bullets.filter((bullet) => bullet.alive)
  battle.units = battle.units.filter(
    (unit) => unit.state !== 'muerto' || battle.time - unit.diedAt < DEAD_KEEP,
  )
  if (battle.volleyHits.size > 64) {
    const live = new Set(battle.bullets.map((bullet) => bullet.volley))
    for (const key of battle.volleyHits.keys()) if (!live.has(key)) battle.volleyHits.delete(key)
  }
  stepHands(battle)
}

/** El reloj de la partida y la racha. Al acabarse el tiempo gana el fuerte con mas vida (si empatan, el de mas bajas). */
function stepReloj(battle: Battle) {
  for (const side of [0, 1] as Side[]) {
    if (battle.racha[side] > 0 && battle.time >= battle.rachaHasta[side]) battle.racha[side] = 0
  }
  if (battle.over || battle.time < TIEMPO_MAXIMO_S) return
  const vida = (side: Side) => battle.forts[side].hp / Math.max(1, battle.forts[side].maxHp)
  const winner: Side =
    Math.abs(vida(0) - vida(1)) > 0.001 ? (vida(0) > vida(1) ? 0 : 1) : battle.kills[0] >= battle.kills[1] ? 0 : 1
  battle.over = { winner, by: 'tiempo' }
  battle.events.push({ type: 'over', winner, by: 'tiempo' })
}

/** Saca los avisos pendientes para la escena. */
export function drainEvents(battle: Battle): BattleEvent[] {
  const events = battle.events
  battle.events = []
  return events
}
