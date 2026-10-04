import { BUILTIN_CARDS } from '../cards/catalog'
import type { CardDef, ClaseId } from '../cards/model'
import { claseDe, rarityOf } from '../cards/model'
import { CARACTERISTICAS_IDS } from './caracteristicas'
import type { Caracteristica, Caracteristicas } from './caracteristicas'

/**
 * **El Antiguo Oeste**: las incursiones de carta. Cada hora real salen **cinco**, las mismas para
 * todo el mundo, y duran esa hora (a la hora siguiente desaparecen y salen otras cinco).
 *
 * Cada incursión trae **su propia regla** para ganarla (tumbar seis tropas, ganar en menos de 90 s,
 * no bajar del 60% del fuerte, no perder ni una tropa), pide **una o dos características** para
 * intentarla — y si no las tienes, a las incursiones de práctica a entrenar — y si la ganas te
 * llevas un **% de esa carta**, de 1 a 100.
 */

export type RetoId = 'faena' | 'relampago' | 'muralla' | 'pulso'

export interface Reto {
  id: RetoId
  label: string
  nota: string
  /** El número que pide: tropas, segundos o % del fuerte. */
  meta: number
  icon: string
}

export const RETOS: Reto[] = [
  { id: 'faena', label: 'Faena grande', nota: 'Tumba 6 tropas rivales y gana', meta: 6, icon: '💀' },
  { id: 'relampago', label: 'Duelo relámpago', nota: 'Gana en menos de 90 segundos', meta: 90, icon: '⚡' },
  { id: 'muralla', label: 'Muralla', nota: 'Gana sin bajar del 60% de tu fuerte', meta: 60, icon: '🧱' },
  { id: 'pulso', label: 'Pulso firme', nota: 'Gana sin perder ni una tropa', meta: 0, icon: '🎯' },
]

export interface Coste {
  stat: Caracteristica
  cantidad: number
}

export interface Incursion {
  id: string
  cardId: string
  reto: Reto
  /** Lo que cuesta intentarla. */
  coste: Coste[]
  /** Cuando se renuevan (ms). */
  hasta: number
}

/** Lo que se cuenta al acabar una batalla para saber si la incursión está ganada. */
export interface ResumenDeBatalla {
  ganada: boolean
  segundos: number
  /** Tropas rivales tumbadas. */
  bajas: number
  /** Tropas tuyas perdidas. */
  perdidas: number
  /** Tu fuerte al acabar, en %. */
  fuerte: number
}

/** Si el reto de esa incursión está cumplido. */
export function retoCumplido(reto: Reto, resumen: ResumenDeBatalla): boolean {
  if (!resumen.ganada) return false
  switch (reto.id) {
    case 'faena':
      return resumen.bajas >= reto.meta
    case 'relampago':
      return resumen.segundos <= reto.meta
    case 'muralla':
      return resumen.fuerte >= reto.meta
    case 'pulso':
      return resumen.perdidas === 0
    default:
      return true
  }
}

/** Lo que te llevas al ganarla: un % de la carta, de 1 a 100. */
export function premioDeCarta(azar: () => number = Math.random): number {
  return Math.max(1, Math.round(1 + azar() * 99))
}

// ---------------------------------------------------------------------------
// Las cinco de cada hora
// ---------------------------------------------------------------------------

/** Un azar con semilla: las incursiones de una hora salen iguales para todo el mundo. */
function azarConSemilla(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cuanto más rara es la carta, menos sale. */
const PESO_RAREZA: Record<string, number> = { normal: 10, especial: 6, epica: 3, divina: 1 }

function elegirCarta(pool: CardDef[], azar: () => number): CardDef {
  const pesos = pool.map((card) => PESO_RAREZA[rarityOf(card)] ?? 4)
  const total = pesos.reduce((suma, peso) => suma + peso, 0)
  let tirada = azar() * total
  for (let i = 0; i < pool.length; i++) {
    tirada -= pesos[i]!
    if (tirada <= 0) return pool[i]!
  }
  return pool[pool.length - 1]!
}

/** Lo que cuesta intentarla: cuanto más rara, más pide (y más características toca). */
function costeDe(card: CardDef, azar: () => number): Coste[] {
  const raro = rarityOf(card)
  const cantidad = raro === 'divina' ? 12 : raro === 'epica' ? 9 : 6
  const primera = CARACTERISTICAS_IDS[Math.floor(azar() * CARACTERISTICAS_IDS.length)]!
  const coste: Coste[] = [{ stat: primera, cantidad }]
  if (raro === 'epica' || raro === 'divina') {
    const resto = CARACTERISTICAS_IDS.filter((id) => id !== primera)
    const segunda = resto[Math.floor(azar() * resto.length)]!
    coste.push({ stat: segunda, cantidad: Math.round(cantidad * 0.6) })
  }
  return coste
}

/** Los muñecos de una clase, en el orden del catálogo (el mismo en todos los dispositivos). */
function munecosDe(clase: ClaseId): CardDef[] {
  return BUILTIN_CARDS.filter((card) => card.kind === 'batalla' && claseDe(card) === clase)
}

/**
 * Las cinco incursiones de la hora en la que estamos. **Son las mismas para todo el mundo**: se
 * sortean siempre sobre el catálogo fijo del juego (nunca sobre las cartas que tenga cada uno, ni
 * las que haya tocado el admin en su ordenador), con la hora como semilla.
 *
 * Cada clase juega solo con sus cartas, así que el cartel es el mismo para todos (misma misión, mismo
 * puesto) y cada uno lo ve con **su versión de esa carta**: la del vaquero, la del indio o la del
 * vikingo (las tres clases tienen sus muñecos en el mismo orden, uno por uno).
 */
export function incursionesDeLaHora(ahora: number = Date.now(), clase: ClaseId | 'todas' = 'vaqueros'): Incursion[] {
  const hora = Math.floor(ahora / 3600000)
  const azar = azarConSemilla(hora * 2654435761)
  // El sorteo va sobre los vaqueros (el catálogo de base): asi sale igual en todas las clases.
  const base = munecosDe('vaqueros')
  const suyos = munecosDe(clase === 'todas' ? 'vaqueros' : clase)
  const usados = new Set<number>()
  const salida: Incursion[] = []
  for (let i = 0; i < 5; i++) {
    let puesto = base.indexOf(elegirCarta(base, azar))
    for (let intento = 0; intento < 10 && usados.has(puesto); intento++) puesto = base.indexOf(elegirCarta(base, azar))
    usados.add(puesto)
    const card = suyos[puesto] ?? base[puesto]!
    salida.push({
      id: `${hora}-${i}`,
      cardId: card.id,
      reto: RETOS[Math.floor(azar() * RETOS.length)]!,
      // El precio con su propio azar: segun la rareza tira mas o menos dados, y eso no puede
      // descolocar el sorteo de los carteles siguientes.
      coste: costeDe(card, azarConSemilla((hora * 2654435761 + (i + 1) * 40503) >>> 0)),
      hasta: (hora + 1) * 3600000,
    })
  }
  return salida
}

/** Lo que queda para que cambien las cinco. */
export function msParaCambiar(ahora: number = Date.now()): number {
  return 3600000 - (ahora % 3600000)
}

/** Cuando cambian. */
export function horaDeCambio(ahora: number = Date.now()): number {
  return (Math.floor(ahora / 3600000) + 1) * 3600000
}

// ---------------------------------------------------------------------------
// Pagar las incursiones
// ---------------------------------------------------------------------------

/** Si te llega para intentarla. */
export function puedePagar(stats: Caracteristicas, coste: Coste[]): boolean {
  return coste.every((parte) => stats[parte.stat] >= parte.cantidad)
}

/** Lo que te falta para intentarla, en texto. */
export function faltaPara(stats: Caracteristicas, coste: Coste[], nombre: (stat: Caracteristica) => string): string | null {
  const cortas = coste.filter((parte) => stats[parte.stat] < parte.cantidad)
  if (cortas.length === 0) return null
  return `Te falta ${cortas.map((parte) => `${nombre(parte.stat)} (${Math.floor(stats[parte.stat])}/${parte.cantidad})`).join(' y ')}`
}

/** Te cobra el intento (el desgaste de verdad: se te queda gastado). */
export function pagar(stats: Caracteristicas, coste: Coste[]): Caracteristicas {
  const salida = { ...stats }
  for (const parte of coste) salida[parte.stat] = Math.max(1, salida[parte.stat] - parte.cantidad)
  return salida
}
