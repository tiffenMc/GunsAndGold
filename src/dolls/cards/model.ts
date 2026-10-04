import type { AnimSet } from '../cardConfig'
import type { DollLook } from '../dollParams'
import type { Arquetipo } from './arquetipos'

/**
 * Las dos clases de carta del mazo:
 *  - BATALLA: un muñeco que sale al campo y anda hacia la torre rival para dispararle.
 *  - ARMA: solo defiende. Arrastras la carta y el camino del dedo es el camino de la bala.
 */
export type CardKind = 'batalla' | 'arma'

/** Las clases (facciones) del juego: cada personaje elige una y solo juega con sus cartas. */
export type ClaseId = 'vaqueros' | 'indios' | 'vikingos'

/** Lo que vale una carta que no dice de que clase es (las de siempre): vaqueros. */
export const CLASE_POR_DEFECTO: ClaseId = 'vaqueros'

export interface BattleCard {
  kind: 'batalla'
  id: string
  name: string
  /** Las del catalogo no se pueden borrar (si restablecer). */
  builtin: boolean
  /** Color del brillo de la carta. */
  accent: string
  look: DollLook
  anims: AnimSet
  /** Escudos con calidad EXCELENTE. Cada golpe quita uno; sin escudos se rompe. */
  shields: number
  /** Resistencia al empuje de los disparos (0 = ligera, 100 = pesada). */
  resistance: number
  /** Daño a la torre por disparo con calidad EXCELENTE. */
  damage: number
  /** Desde donde dispara: se para a esa distancia de la torre. */
  range: number
  /** Cada cuanto dispara, en milisegundos. */
  fireMs: number
  /** Velocidad al andar (1 = normal). */
  speed: number
  /** El patron que hay que dibujar para sacarla. */
  pattern: string
  /** Rareza: agrupa la carta en la coleccion. Si falta, se calcula por su fuerza. */
  rarity?: Rarity
  /**
   * El **tipo de tirador** que le toco a TU copia de la carta (se sortea la primera vez que la
   * consigues y ya no se cambia). Las del catalogo lo llevan vacio.
   */
  arquetipo?: Arquetipo
  /** Como pelea (ver `battle/estilos.ts`): minigun, rebote, area, cuerpo a cuerpo, medico… Si falta, dispara normal. */
  estilo?: string
  /** De que clase es la carta (por defecto, vaqueros). */
  clase?: ClaseId
}

/** Como lee cada arma el camino que dibujas. */
export type ShotMode = 'bala' | 'perdigones' | 'perforante' | 'explosivo' | 'rafaga'

export type WeaponModel =
  | 'revolver'
  | 'escopeta'
  | 'rifle'
  | 'dinamita'
  | 'rifle-pesado'
  | 'gatling'
  | 'arco'
  | 'hacha'
  | 'lanza'
  | 'martillo'
  | 'catapulta'
  | 'canon'
  /** Solo para las especiales: la granada de humo, la tormenta y el pico del tunel. */
  | 'granada'
  | 'tormenta'
  | 'pico'

export interface ShotSpec {
  mode: ShotMode
  /** Hasta donde llega la bala siguiendo tu trazo (en metros del campo). */
  range: number
  /** Escudos que quita cada impacto. */
  shieldsPerHit: number
  /** Perdigones del cono o balas de la rafaga. */
  pellets: number
  /** Apertura del cono de perdigones, en grados. */
  spread: number
  /** Radio de la explosion (explosivo). */
  radius: number
  /** Velocidad de la bala. */
  speed: number
  /**
   * Milisegundos de mecha de la carga explosiva (la dinamita y el cañon esperan donde caen). Con 0
   * explota al caer: la roca de la catapulta impacta al momento. Si falta, la mecha de siempre.
   */
  mecha?: number
}

/**
 * Armas especiales: no tiran balas, hacen su jugada y se gastan de una vez.
 *  - humo:  nube que esconde a TUS tropas del rival.
 *  - rayo:  la tormenta deja a todo el bando rival sin moverse ni disparar unos segundos.
 *  - tunel: dos bocas; tus tropas que pasan por una salen por la otra.
 */
export type SpecialKind = 'humo' | 'rayo' | 'tunel'

export interface WeaponCard {
  kind: 'arma'
  id: string
  name: string
  builtin: boolean
  accent: string
  model: WeaponModel
  shot: ShotSpec
  /** Solo para las armas especiales. */
  special?: SpecialKind
  /** Usos antes de cambiar de arma. Por defecto, los de siempre. */
  uses?: number
  /** Rareza: agrupa la carta en la coleccion. Si falta, se calcula por su fuerza. */
  rarity?: Rarity
  /** De que clase es el arma (por defecto, vaqueros). */
  clase?: ClaseId
}

export type CardDef = BattleCard | WeaponCard

/** La clase de una carta. */
export function claseDe(card: Pick<CardDef, 'clase'>): ClaseId {
  return card.clase ?? CLASE_POR_DEFECTO
}

export const SHOT_MODES: { id: ShotMode; label: string; note: string }[] = [
  { id: 'bala', label: 'Bala', note: 'Una bala por tu trazo; se para en la primera tropa' },
  { id: 'perdigones', label: 'Perdigones', note: 'Varios perdigones que se abren en cono' },
  { id: 'perforante', label: 'Perforante', note: 'Atraviesa: da a todas las tropas de la línea' },
  { id: 'explosivo', label: 'Explosivo', note: 'Vuela hasta el final de tu trazo y explota en área' },
  { id: 'rafaga', label: 'Ráfaga', note: 'Varias balas seguidas por el mismo camino' },
]

/** Lo que dura cada especial, en segundos. El motor saca de aqui sus tiempos. */
export const SPECIAL_SECONDS: Record<SpecialKind, number> = { humo: 10, rayo: 8, tunel: 10 }

export interface SpecialInfo {
  id: SpecialKind
  label: string
  note: string
  seconds: number
}

export const SPECIALS: SpecialInfo[] = [
  {
    id: 'humo',
    label: 'Humo',
    note: 'Nube que esconde a tus tropas del rival: sus soldados no las ven venir',
    seconds: SPECIAL_SECONDS.humo,
  },
  {
    id: 'rayo',
    label: 'Tormenta',
    note: 'La tormenta cae sobre el bando rival: 8 s clavados, sin moverse ni disparar y sin perder vida',
    seconds: SPECIAL_SECONDS.rayo,
  },
  {
    id: 'tunel',
    label: 'Túnel',
    note: 'Dos bocas de tamaño fijo, una en cada campo: tus tropas que pisan una salen por la otra. Se cierra a los 10 s',
    seconds: SPECIAL_SECONDS.tunel,
  },
]

/** La ficha de la especial de una carta, si lo es. */
export function specialOf(card: WeaponCard): SpecialInfo | undefined {
  return card.special ? SPECIALS.find((item) => item.id === card.special) : undefined
}

export const WEAPON_MODELS: { id: WeaponModel; label: string }[] = [
  { id: 'revolver', label: 'Revólver' },
  { id: 'escopeta', label: 'Escopeta' },
  { id: 'rifle', label: 'Rifle' },
  { id: 'dinamita', label: 'Dinamita' },
  { id: 'rifle-pesado', label: 'Rifle pesado' },
  { id: 'gatling', label: 'Ametralladora' },
  { id: 'arco', label: 'Arco' },
  { id: 'hacha', label: 'Hacha' },
  { id: 'lanza', label: 'Lanza' },
  { id: 'martillo', label: 'Martillo' },
  { id: 'catapulta', label: 'Catapulta' },
  { id: 'canon', label: 'Cañón' },
]

/** Usos de cada arma antes de cambiarla. */
export const WEAPON_USES = 2

/** Los usos que trae una carta: las especiales se gastan de una sola vez. */
export function usesOf(card: WeaponCard | null | undefined): number {
  return card?.uses ?? WEAPON_USES
}
/** Lo que tarda en llegar el arma nueva. */
export const WEAPON_SWAP_S = 3
/** Lo que tarda en aparecer otra carta de batalla al sacar una. */
export const DRAW_S = 2

/** La baraja: 10 muñecos de batalla y 4 armas. */
export const DECK_BATTLE = 10
export const DECK_WEAPONS = 4
/** Cada jugador puede tener hasta tres barajas, y una puesta. */
export const MAX_DECKS = 3
export const HAND_SIZE = 3

// ---------------------------------------------------------------------------
// Rareza: como se agrupan las cartas en la coleccion
// ---------------------------------------------------------------------------

export type Rarity = 'normal' | 'especial' | 'epica' | 'divina'

export interface RarityInfo {
  id: Rarity
  label: string
  note: string
  color: string
}

/** De mas comun a mas rara. El orden manda en la coleccion y al desbloquear. */
export const RARITIES: RarityInfo[] = [
  { id: 'normal', label: 'Normales', note: 'Los de siempre: cumplen y no fallan', color: '#a8a29e' },
  { id: 'especial', label: 'Especiales', note: 'Tienen algo raro: humo, rayos, tuneles…', color: '#38bdf8' },
  { id: 'epica', label: 'Épicas', note: 'Los tochos del Oeste', color: '#c084fc' },
  { id: 'divina', label: 'Divinas', note: 'Leyendas: caras de ver y de jugar', color: '#fbbf24' },
]

export const RARITY_ORDER: Rarity[] = RARITIES.map((item) => item.id)

/** La fuerza de una carta, de 1 a 6: es el numero que lleva en la chapa de la esquina. */
export function cardStrength(card: CardDef): number {
  if (card.kind === 'arma') {
    const shot = card.shot
    const weight = shot.shieldsPerHit + shot.range / 5 + shot.pellets / 4 + (shot.mode === 'explosivo' ? 1.5 : 0)
    return Math.max(1, Math.min(6, Math.round((weight - 4) * 1.6) + 1))
  }
  // El vaquero base (fuerza 1) marca 1 en la chapa: de ahi para arriba, y las divinas llegan al 6.
  return Math.max(1, Math.min(6, Math.round((cardPower(card) - 1) * 11) + 1))
}

/** Que quiere decir la chapa de la esquina, que es el numero que llevan todas las cartas. */
export const STRENGTH_NOTE =
  'La chapa de la esquina es la fuerza de la carta: de 1 (básica) a 6 (temible). Sube con escudos, daño, alcance y velocidad.'

/** Lo mismo, en corto, para las cabeceras de la coleccion y de la baraja. */
export const STRENGTH_LEGEND = 'La chapa de la esquina es su fuerza (1-6)'

export function rarityInfo(rarity: Rarity): RarityInfo {
  return RARITIES.find((item) => item.id === rarity) ?? RARITIES[0]!
}

/**
 * La rareza de una carta. Las del catalogo la traen puesta; las que se crean en el taller se
 * calculan por su fuerza, para que una carta nueva no salga como divina sin merecerlo.
 */
export function rarityOf(card: CardDef): Rarity {
  if (card.rarity) return card.rarity
  if (card.kind === 'arma') {
    if (card.special) return 'especial'
    const shot = card.shot
    const weight = shot.shieldsPerHit + shot.range / 5 + shot.pellets / 4 + (shot.mode === 'explosivo' ? 1.5 : 0)
    return weight >= 6.5 ? 'epica' : weight >= 5 ? 'especial' : 'normal'
  }
  const power = cardPower(card)
  if (power >= 1.3) return 'divina'
  if (power >= 1.12) return 'epica'
  if (power >= 0.95) return 'especial'
  return 'normal'
}

// ---------------------------------------------------------------------------
// Calidad del trazo: cuanto mejor dibujas, mas escudo y mas daño trae la carta
// ---------------------------------------------------------------------------

export type QualityId = 'mal' | 'medio' | 'bien' | 'perfecto' | 'excelente'

export interface Quality {
  id: QualityId
  label: string
  /** Precision minima (0-1) para llegar a esta calidad. */
  min: number
  /** Parte de los escudos y del daño con que sale. */
  mult: number
  color: string
}

/** De peor a mejor. Solo EXCELENTE saca la carta con todo. */
export const QUALITIES: Quality[] = [
  { id: 'mal', label: 'Mal', min: 0, mult: 0.35, color: '#f87171' },
  { id: 'medio', label: 'Medio', min: 0.45, mult: 0.55, color: '#fb923c' },
  { id: 'bien', label: 'Bien', min: 0.65, mult: 0.72, color: '#facc15' },
  { id: 'perfecto', label: 'Perfecto', min: 0.8, mult: 0.87, color: '#4ade80' },
  { id: 'excelente', label: '¡Excelente!', min: 0.9, mult: 1, color: '#7dd3fc' },
]

export function qualityOf(accuracy: number): Quality {
  let found = QUALITIES[0]
  for (const quality of QUALITIES) {
    if (accuracy >= quality.min) found = quality
  }
  return found
}

export function qualityById(id: QualityId): Quality {
  return QUALITIES.find((quality) => quality.id === id) ?? QUALITIES[0]
}

/** Escudos y daño con los que sale la carta segun lo bien que la hayas dibujado. */
export function scaledStats(card: BattleCard, quality: Quality): { shields: number; damage: number } {
  return {
    shields: Math.max(1, Math.round(card.shields * quality.mult)),
    damage: Math.max(5, Math.round((card.damage * quality.mult) / 5) * 5),
  }
}

// ---------------------------------------------------------------------------
// Equilibrio: una carta mas fuerte exige un patron mas dificil
// ---------------------------------------------------------------------------

export const STAT_LIMITS = {
  shields: { min: 1, max: 10 },
  resistance: { min: 0, max: 100 },
  damage: { min: 10, max: 400 },
  range: { min: 1.5, max: 9 },
  fireMs: { min: 500, max: 5000 },
  speed: { min: 0.5, max: 1.8 },
} as const

/**
 * Fuerza de una carta de batalla. El vaquero base da 1.
 * Suma daño por segundo, escudos, alcance y velocidad.
 */
export function cardPower(card: Pick<BattleCard, 'shields' | 'damage' | 'range' | 'fireMs' | 'speed'>): number {
  const dps = card.damage / (card.fireMs / 1000)
  return 0.36 * (dps / 50) + 0.34 * (card.shields / 3) + 0.15 * (card.range / 4.5) + 0.15 * card.speed
}

/** Dificultad del patron (1 a 4) que le toca a una carta por su fuerza. */
export function patternLevelFor(power: number): 1 | 2 | 3 | 4 {
  if (power < 0.9) return 1
  if (power < 1.12) return 2
  if (power < 1.38) return 3
  return 4
}

export const LEVEL_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Fácil',
  2: 'Normal',
  3: 'Difícil',
  4: 'Muy difícil',
}

export function shotSummary(shot: ShotSpec): string {
  switch (shot.mode) {
    case 'perdigones':
      return `${shot.pellets} perdigones en cono`
    case 'perforante':
      return 'Atraviesa la línea'
    case 'explosivo':
      return `Explota en área (${shot.radius.toFixed(1)} m)`
    case 'rafaga':
      return `Ráfaga de ${shot.pellets} balas`
    default:
      return shot.shieldsPerHit > 1 ? `Bala pesada` : 'Una bala certera'
  }
}
