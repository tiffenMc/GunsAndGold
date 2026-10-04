import type { DollLook } from '../dollParams'
import type { AnimacionDibujada } from './animacionDibujada'
import { animacionDe, pintaDe } from './players'
import type { Player } from './players'
import { rangoDe } from './progreso'
import type { RangoInfo } from './progreso'

/**
 * **Los Más Buscados**: el ranking del pueblo. Manda el rango (las monedas de las partidas de
 * rango); si hay empate, el que más ha ganado, y luego el que menos partidas ha necesitado.
 *
 * Por ahora se hace con los personajes que hay **en este dispositivo**. Cuando las cuentas vivan en
 * el servidor, la lista vendrá de allí (con todos los jugadores), y esto seguirá sirviendo igual:
 * solo cambia de dónde salen las fichas.
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
