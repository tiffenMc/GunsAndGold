import type { Arquetipo } from '../cards/arquetipos'

/**
 * El clima de la partida, que lo echa la ruleta del principio. Cada uno cambia la luz y **recorta
 * los rangos**, y a cada uno le toca un blanco distinto:
 *
 *  - **día**: todo normal.
 *  - **noche**: apenas se ve el campo rival (esconde sus tropas como hace el humo) y **tus disparos**
 *    pierden alcance.
 *  - **lluvioso**: **tus disparos** pierden bastante alcance, y los tiradores selectos algo de rango.
 *  - **tormenta**: los **berserker** pierden mucho daño y bastante rango.
 *  - **helado**: los **medios** pierden rango.
 *
 * Y todos, además, recortan un pelín el rango de todo: así ningún clima se va de rositas.
 */

export type Clima = 'dia' | 'noche' | 'lluvia' | 'tormenta' | 'helado'

export interface ClimaInfo {
  id: Clima
  label: string
  icon: string
  nota: string
  color: string
  /** El cielo y la niebla (el dia usa los del escenario). */
  cielo: string
  /** Luz de ambiente y del sol (el dia usa los del escenario). */
  ambiente: number
  sol: number
  colorSol: string
  /** Que cae del cielo. */
  cae: 'nada' | 'lluvia' | 'nieve'
  /** Si caen rayos de vez en cuando. */
  rayos: boolean
}

export const CLIMAS: ClimaInfo[] = [
  {
    id: 'dia',
    label: 'Día',
    icon: '☀️',
    nota: 'A pleno sol: todo normal',
    color: '#fbbf24',
    cielo: '',
    ambiente: 1,
    sol: 1,
    colorSol: '',
    cae: 'nada',
    rayos: false,
  },
  {
    id: 'noche',
    label: 'Noche',
    icon: '🌙',
    nota: 'Se ve poco del campo rival: tus soldados ven más al avanzar. Tus disparos llegan menos',
    color: '#7dd3fc',
    cielo: '#22345f',
    ambiente: 0.62,
    sol: 0.7,
    colorSol: '#8fa8e8',
    cae: 'nada',
    rayos: false,
  },
  {
    id: 'lluvia',
    label: 'Lluvioso',
    icon: '🌧️',
    nota: 'Llueve: se ve menos (tus soldados ven más al avanzar), tus disparos pierden alcance y los selectos, rango',
    color: '#60a5fa',
    cielo: '#52657a',
    ambiente: 0.75,
    sol: 0.85,
    colorSol: '#9fb6c9',
    cae: 'lluvia',
    rayos: false,
  },
  {
    id: 'tormenta',
    label: 'Tormenta',
    icon: '⛈️',
    nota: 'Rayos y truenos: los berserker pierden daño y rango',
    color: '#a78bfa',
    cielo: '#3a4866',
    ambiente: 0.66,
    sol: 0.75,
    colorSol: '#8fa8e8',
    cae: 'lluvia',
    rayos: true,
  },
  {
    id: 'helado',
    label: 'Helado',
    icon: '❄️',
    nota: 'Cae nieve: los tiradores medios pierden rango',
    color: '#bae6fd',
    cielo: '#52627f',
    ambiente: 0.8,
    sol: 0.85,
    colorSol: '#dbeafe',
    cae: 'nieve',
    rayos: false,
  },
]

export function climaInfo(id: Clima): ClimaInfo {
  return CLIMAS.find((item) => item.id === id) ?? CLIMAS[0]!
}

interface Efecto {
  dano: number
  rango: number
}

/** Lo que le hace cada clima a una carta, y a tus disparos (el arma). */
export const EFECTOS: Record<Clima, { general: Efecto; disparos: number; tipos: Partial<Record<Arquetipo, Efecto>> }> = {
  dia: { general: { dano: 1, rango: 1 }, disparos: 1, tipos: {} },
  noche: { general: { dano: 1, rango: 0.95 }, disparos: 0.8, tipos: {} },
  lluvia: { general: { dano: 1, rango: 0.93 }, disparos: 0.65, tipos: { selecto: { dano: 1, rango: 0.8 } } },
  tormenta: { general: { dano: 1, rango: 0.92 }, disparos: 0.85, tipos: { berserker: { dano: 0.65, rango: 0.75 } } },
  helado: { general: { dano: 1, rango: 0.92 }, disparos: 0.9, tipos: { medio: { dano: 1, rango: 0.7 } } },
}

/** Lo que el clima le hace a una carta por su tipo. */
export function ajusteDeCarta(clima: Clima, arquetipo?: Arquetipo): Efecto {
  const tabla = EFECTOS[clima] ?? EFECTOS.dia
  const suyo = arquetipo ? tabla.tipos[arquetipo] : undefined
  return {
    dano: tabla.general.dano * (suyo?.dano ?? 1),
    rango: tabla.general.rango * (suyo?.rango ?? 1),
  }
}

/** Lo que el clima le hace a tus disparos (el arma). */
export function ajusteDeDisparos(clima: Clima): number {
  return (EFECTOS[clima] ?? EFECTOS.dia).disparos
}

/** La carta ya con el clima aplicado (el tipo se aplica antes, al montar la baraja). */
export function conClima<T extends { damage: number; range: number }>(card: T, clima: Clima, arquetipo?: Arquetipo): T {
  const ajuste = ajusteDeCarta(clima, arquetipo)
  if (ajuste.dano === 1 && ajuste.rango === 1) return card
  return {
    ...card,
    damage: Math.max(10, Math.round(card.damage * ajuste.dano)),
    range: Math.max(1.5, Math.round(card.range * ajuste.rango * 10) / 10),
  }
}

/** Al salir la ruleta: dia casi siempre, y de vez en cuando los otros. */
export function climaAlAzar(azar: () => number = Math.random): Clima {
  const tirada = azar()
  if (tirada < 0.35) return 'dia'
  if (tirada < 0.6) return 'noche'
  if (tirada < 0.8) return 'lluvia'
  if (tirada < 0.9) return 'tormenta'
  return 'helado'
}

/**
 * Lo lejos que se ve el campo rival cuando hay poca visibilidad (noche y lluvia). Desde tu fuerte se
 * ve `fuerte` metros con claridad (y 8 mas a medias). Cada soldado tuyo **va ganando vista segun se
 * aleja de donde salio**: empieza viendo `base` metros y suma `gana` por cada metro andado, hasta `tope`.
 * Asi, conforme avanzas, el campo se va abriendo y nunca te quedas a ciegas.
 */
export interface Vista {
  fuerte: number
  base: number
  gana: number
  tope: number
}

export const VISTAS: Partial<Record<Clima, Vista>> = {
  noche: { fuerte: 9, base: 3.5, gana: 0.55, tope: 16 },
  lluvia: { fuerte: 13, base: 5, gana: 0.5, tope: 18 },
  tormenta: { fuerte: 12, base: 4.5, gana: 0.5, tope: 17 },
}

/** Lo que se ve el campo del rival: `claro`, `fantasma` (a medias) u `oculto`. */
export function visionDeClima(
  clima: Clima,
  /** Lo lejos que esta de tu fuerte. */
  distanciaFuerte: number,
  /** Tus soldados vivos: lo lejos que esta del objetivo y lo que han andado desde que salieron. */
  soldados: { distancia: number; andado: number }[],
): 'claro' | 'fantasma' | 'oculto' {
  const vista = VISTAS[clima]
  if (!vista) return 'claro'
  // 0 = oculto, 1 = a medias, 2 = claro
  let nivel = 0
  const prueba = (alcance: number, distancia: number, margen: number) => {
    if (distancia <= alcance) nivel = 2
    else if (distancia <= alcance + margen) nivel = Math.max(nivel, 1)
  }
  prueba(vista.fuerte, distanciaFuerte, 8)
  for (const soldado of soldados) {
    prueba(Math.min(vista.tope, vista.base + vista.gana * soldado.andado), soldado.distancia, 4)
    if (nivel === 2) break
  }
  return nivel === 2 ? 'claro' : nivel === 1 ? 'fantasma' : 'oculto'
}
