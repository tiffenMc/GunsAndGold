import { useEffect, useSyncExternalStore } from 'react'
import { cloneLook, isLook } from '../dollParams'
import type { DollLook } from '../dollParams'
import { api, hayServidor } from '../../lib/servidor'
import { repartir } from './animacionDibujada'
import type { AnimacionDibujada } from './animacionDibujada'
import { animacionDe, pintaDe } from './players'
import type { Player } from './players'
import { rangoDe } from './progreso'
import type { RangoInfo } from './progreso'

/**
 * **Los Más Buscados**: el ranking del pueblo. Manda el rango (las monedas de las partidas de
 * rango); si hay empate, el que más ha ganado, y luego el que menos partidas ha necesitado.
 *
 * Si hay servidor, la lista es la de **todos los jugadores** (la guarda el servidor). Si no (jugando
 * en el ordenador con `npm run dev`), se hace con los personajes que hay en este dispositivo.
 */

export interface FichaDeBuscado {
  id: string
  nombre: string
  /** Cómo va vestido: su muñeco sale así en la tarima. */
  look: DollLook
  /** Su animación dibujada, si lleva (la hace en la tarima). */
  animacion: AnimacionDibujada | null
  monedas: number
  rango: RangoInfo
  partidas: number
  victorias: number
  mejorRacha: number
  /** El puesto en la lista (1 = el más buscado). */
  puesto: number
}

/** Los cinco que salen en la tarima. */
export const EN_LA_TARIMA = 5

function antes(a: Player, b: Player): number {
  return b.monedas - a.monedas || b.won - a.won || a.played - b.played || a.name.localeCompare(b.name)
}

/**
 * La lista entera, de mejor a peor. El ADMIN no cuenta (lo tiene todo: no sería justo), ni quien
 * no ha jugado aún ninguna partida.
 */
export function ranking(jugadores: readonly Player[]): FichaDeBuscado[] {
  return jugadores
    .filter((player) => !player.admin && player.played > 0)
    .slice()
    .sort(antes)
    .map((player, i) => ({
      id: player.id,
      nombre: player.name,
      look: pintaDe(player),
      animacion: animacionDe(player),
      monedas: player.monedas,
      rango: rangoDe(player.monedas),
      partidas: player.played,
      victorias: player.won,
      mejorRacha: player.bestStreak,
      puesto: i + 1,
    }))
}

/** Los cinco de la tarima (puede haber menos: los huecos quedan libres). */
export function losMasBuscados(jugadores: readonly Player[]): FichaDeBuscado[] {
  return ranking(jugadores).slice(0, EN_LA_TARIMA)
}

/** El porcentaje de victorias. */
export function porcentajeDeVictorias(ficha: Pick<FichaDeBuscado, 'partidas' | 'victorias'>): number {
  return ficha.partidas > 0 ? Math.round((ficha.victorias / ficha.partidas) * 100) : 0
}

// ---------------------------------------------------------------------------
// El ranking de todos, el del servidor
// ---------------------------------------------------------------------------

/** Lo que se le manda al servidor de cada personaje para el ranking. */
export function fichaParaElServidor(player: Player) {
  return {
    id: player.id,
    nombre: player.name,
    admin: player.admin,
    monedas: player.monedas,
    partidas: player.played,
    victorias: player.won,
    mejorRacha: player.bestStreak,
    look: pintaDe(player),
    animacion: animacionDe(player),
  }
}

interface FilaDelServidor {
  id: string
  nombre: string
  monedas: number
  partidas: number
  victorias: number
  mejorRacha: number
  look: unknown
  animacion: unknown
}

/** Una ficha que viene del servidor, ya lista para pintar (lo raro se arregla). */
export function fichaDelServidor(fila: FilaDelServidor, i: number): FichaDeBuscado {
  const a = fila.animacion as Partial<AnimacionDibujada> | null
  const animacion =
    a && typeof a.id === 'string' && Array.isArray(a.puntos) ? { id: a.id, nombre: String(a.nombre ?? 'Floritura'), puntos: repartir(a.puntos) } : null
  const monedas = Math.max(0, Number(fila.monedas) || 0)
  return {
    id: String(fila.id),
    nombre: String(fila.nombre),
    look: cloneLook(isLook(fila.look) ? fila.look : undefined),
    animacion,
    monedas,
    rango: rangoDe(monedas),
    partidas: Number(fila.partidas) || 0,
    victorias: Number(fila.victorias) || 0,
    mejorRacha: Number(fila.mejorRacha) || 0,
    puesto: i + 1,
  }
}

/** Lo último que ha dicho el servidor (null mientras no ha contestado, o si no hay servidor). */
let delServidor: FichaDeBuscado[] | null = null
const oyentes = new Set<() => void>()
let pidiendo = false

/** Pide otra vez el ranking al servidor (al guardar una partida, al entrar en Los Más Buscados…). */
export async function refrescarRanking(): Promise<void> {
  if (pidiendo || !(await hayServidor())) return
  pidiendo = true
  const r = await api<{ fichas: FilaDelServidor[] }>('/ranking?n=20')
  pidiendo = false
  if (!r.ok) return
  delServidor = r.datos.fichas.map(fichaDelServidor)
  for (const fn of oyentes) fn()
}

const suscribir = (fn: () => void) => {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

/**
 * **El ranking que se enseña**: el de todos si hay servidor (se refresca cada minuto), y si no, el
 * de los personajes de este dispositivo. `deTodos` dice cuál es.
 */
export function useRanking(jugadores: readonly Player[]): { fichas: FichaDeBuscado[]; deTodos: boolean } {
  const servidor = useSyncExternalStore(suscribir, () => delServidor, () => delServidor)
  useEffect(() => {
    void refrescarRanking()
    const reloj = window.setInterval(() => void refrescarRanking(), 60_000)
    return () => window.clearInterval(reloj)
  }, [])
  return servidor ? { fichas: servidor, deTodos: true } : { fichas: ranking(jugadores), deTodos: false }
}
