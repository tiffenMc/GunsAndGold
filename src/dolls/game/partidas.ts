import { arquetipoAlAzar, conArquetipo } from '../cards/arquetipos'
import type { Arquetipo } from '../cards/arquetipos'
import { BUILTIN_CARDS } from '../cards/catalog'
import type { CardDef } from '../cards/model'
import { normalize } from '../cards/store'
import { climaAlAzar } from '../battle/clima'
import type { Preparativos, Resumen } from '../battle/simulacion'
import { cartasDeClase } from './clases'
import { premioDeEntreno } from './caracteristicas'
import type { Caracteristica } from './caracteristicas'
import { incursionesDeLaHora, premioDeCarta, retoCumplido } from './incursiones'
import type { Incursion } from './incursiones'
import {
  cartasDeLaBaraja,
  entrenarCaracteristica,
  extrasDeBatalla,
  ganarBotin,
  ganarTrozoDeCarta,
  gastarCaracteristicas,
  getPlayer,
  moverMonedas,
  recordResult,
  unlockRandom,
} from './players'
import type { Player } from './players'
import { botinDeRango, premioDeRango } from './progreso'

/**
 * **Las partidas con premio**, iguales en tu móvil y en el servidor.
 *
 * Una partida se monta con una **semilla** que da el servidor: de ella salen el azar de la partida,
 * el clima, los tipos de tirador del bot y, al acabar, el premio (las monedas, si cae diamante,
 * qué carta sale…). Tu móvil y el servidor hacen las mismas cuentas con la misma semilla, así que
 * ves tu premio al momento, y el servidor lo confirma cuando ha repetido la partida.
 */

export type TipoDePartida = 'libre' | 'entreno' | 'incursion' | 'rango'

/** Lo que se juega: lo justo para que el servidor lo pueda comprobar (la incursión, por su id). */
export interface Encargo {
  tipo: TipoDePartida
  stat?: Caracteristica
  incursionId?: string
}

/** El mismo azar que la partida (mulberry32), con una "sal" para que cada cosa tire por su lado. */
export function azarDeSemilla(semilla: number, sal = 0): () => number {
  let a = (semilla ^ Math.imul(sal + 1, 0x9e3779b1)) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SAL_BOT = 1
const SAL_CLIMA = 2
const SAL_PREMIO = 3
const SAL_ABANDONO = 4

let canonicas: CardDef[] | null = null
/** El catálogo de verdad (el del juego, sin los cambios que alguien haya hecho en su admin). */
export function cartasCanonicas(): CardDef[] {
  canonicas ??= BUILTIN_CARDS.map((card) => normalize(card))
  return canonicas
}

/** Las cartas con las que juega un personaje (las de su clase). */
export function cartasDe(player: Player): CardDef[] {
  return player.clase === 'todas' ? cartasCanonicas() : cartasDeClase(cartasCanonicas(), player.clase)
}

/** La incursión de un id (`hora-puesto`), si es de esta hora o de la anterior (por si se empezó justo al cambiar). */
export function incursionPorId(id: string, clase: Player['clase'], ahora = Date.now()): Incursion | null {
  const hora = Number(id.split('-')[0])
  const horaDeAhora = Math.floor(ahora / 3600000)
  if (!Number.isInteger(hora) || hora > horaDeAhora || hora < horaDeAhora - 1) return null
  return incursionesDeLaHora(hora * 3600000, clase).find((inc) => inc.id === id) ?? null
}

/** Lo que falta para poder jugar un encargo (null si se puede). */
export function problemaDelEncargo(player: Player, encargo: Encargo, ahora = Date.now()): string | null {
  if (encargo.tipo === 'entreno' && !encargo.stat) return 'Falta qué característica entrenar'
  if (encargo.tipo === 'incursion') {
    const inc = encargo.incursionId ? incursionPorId(encargo.incursionId, player.clase, ahora) : null
    if (!inc) return 'Esa incursión ya no está'
    if (inc.coste.some((c) => player.caracteristicas[c.stat] < c.cantidad)) return 'No te llega para pagar la incursión'
  }
  return null
}

/** Monta la partida de un encargo con su semilla: tu baraja, la del bot, tus extras y el clima. */
export function prepararPartida(player: Player, semilla: number): Preparativos {
  const cards = cartasDe(player)
  const puesta = player.decks[player.activeDeck]
  // Solo cuentan las cartas que de verdad son tuyas (por si alguien cuela otras en su baraja).
  const tuya = (id: string) => player.unlocked.includes(id)
  const deck = puesta ? { ...puesta, battle: puesta.battle.filter(tuya), weapons: puesta.weapons.filter(tuya) } : null
  const mia = deck ? cartasDeLaBaraja(player, deck, cards) : []
  const extras = extrasDeBatalla(player)
  const azarBot = azarDeSemilla(semilla, SAL_BOT)
  // El bot lleva todas las cartas de tu clase, cada una con su tipo de tirador sorteado.
  const delBot = cards.map((card) => (card.kind === 'batalla' ? conArquetipo(card, arquetipoAlAzar(azarBot)) : card))
  return {
    mazos: [mia.length > 0 ? mia : cards, delBot],
    // A la partida solo le tocan dos: el alcance del arma (precisión) y la vida del fuerte. El resto
    // (daño, velocidad, cadencia, escudos) ya va dentro de tus cartas.
    extras: { alcanceArma: extras.alcance, vida: extras.vida },
    semilla,
    clima: climaAlAzar(azarDeSemilla(semilla, SAL_CLIMA)),
  }
}

/** Al empezar: las incursiones se pagan al entrar (ese es el desgaste del intento). */
export function empezarEncargo(encargo: Encargo): void {
  if (encargo.tipo !== 'incursion' || !encargo.incursionId) return
  const inc = incursionPorId(encargo.incursionId, getPlayer().clase)
  if (inc) gastarCaracteristicas(inc.coste)
}

/** Lo que te llevas de una partida (sale en el cartel del final). */
export type Premio =
  | { tipo: 'carta'; card: CardDef; arquetipo?: Arquetipo }
  | { tipo: 'entreno'; stat: Caracteristica; subido: number }
  | { tipo: 'entreno-fallo'; stat: Caracteristica }
  | { tipo: 'incursion'; cardId: string; porcentaje: number; llevo: number; nueva: boolean; arquetipo?: Arquetipo }
  | { tipo: 'incursion-fallo'; incursion: Incursion; resumen: Resumen }

export interface Botin {
  premio: Premio | null
  /** Las monedas que se ganan o se pierden (solo en la de rango). */
  monedas: number | null
  /** Lingotes y diamantes (solo en la de rango). */
  tesoro: { lingotes: number; diamantes: number } | null
}

/**
 * **Se acaba la partida**: se apunta y se da el premio, con el azar de la semilla. Se hace igual en
 * tu móvil (con tu resultado) y en el servidor (con el de su repetición).
 */
export function terminarEncargo(encargo: Encargo, semilla: number, resumen: Resumen, ahora = Date.now()): Botin {
  const azar = azarDeSemilla(semilla, SAL_PREMIO)
  const won = resumen.ganada
  const botin: Botin = { premio: null, monedas: null, tesoro: null }
  if (encargo.tipo === 'rango') {
    recordResult(won)
    const premio = premioDeRango(azar)
    botin.monedas = won ? premio : -premio
    moverMonedas(botin.monedas)
    // Y siempre caen lingotes (más si ganas); a veces, un diamante.
    botin.tesoro = botinDeRango(won, azar)
    ganarBotin(botin.tesoro)
    if (won) {
      const card = unlockRandom(azar)
      if (card) botin.premio = { tipo: 'carta', card, arquetipo: getPlayer().arquetipos[card.id] }
    }
    return botin
  }
  if (encargo.tipo === 'libre') {
    recordResult(won)
    if (won) {
      const card = unlockRandom(azar)
      if (card) botin.premio = { tipo: 'carta', card, arquetipo: getPlayer().arquetipos[card.id] }
    }
    return botin
  }
  if (encargo.tipo === 'entreno' && encargo.stat) {
    if (!won) botin.premio = { tipo: 'entreno-fallo', stat: encargo.stat }
    else botin.premio = { tipo: 'entreno', stat: encargo.stat, subido: entrenarCaracteristica(encargo.stat, premioDeEntreno(azar)) }
    return botin
  }
  if (encargo.tipo === 'incursion' && encargo.incursionId) {
    const incursion = incursionPorId(encargo.incursionId, getPlayer().clase, ahora)
    if (!incursion) return botin
    if (!retoCumplido(incursion.reto, resumen)) {
      botin.premio = { tipo: 'incursion-fallo', incursion, resumen }
      return botin
    }
    const porcentaje = premioDeCarta(azar)
    const trozo = ganarTrozoDeCarta(incursion.cardId, porcentaje, azar)
    botin.premio = { tipo: 'incursion', cardId: incursion.cardId, porcentaje, llevo: trozo.llevo, nueva: trozo.nueva, arquetipo: trozo.arquetipo }
  }
  return botin
}

/** Lo que cuesta irse a media partida de rango (un mordisco de la bolsa, con el azar de la semilla). */
export function mordiscoPorAbandonar(encargo: Encargo, semilla: number, monedas: number): { mordida: number; porcentaje: number } {
  if (encargo.tipo !== 'rango') return { mordida: 0, porcentaje: 0 }
  const porcentaje = 5 + azarDeSemilla(semilla, SAL_ABANDONO)() * 15
  return { mordida: Math.max(1, Math.round((monedas * porcentaje) / 100)), porcentaje: Math.round(porcentaje) }
}

/** Irse a media partida: en la de rango se paga el mordisco; en rango y libre cuenta como derrota. */
export function abandonarEncargo(encargo: Encargo, semilla: number): void {
  const { mordida } = mordiscoPorAbandonar(encargo, semilla, getPlayer().monedas)
  if (mordida > 0) moverMonedas(-mordida)
  if (encargo.tipo === 'rango' || encargo.tipo === 'libre') recordResult(false)
}
