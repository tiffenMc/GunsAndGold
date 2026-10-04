import type { BattleCard } from './model'

/**
 * El **tipo de tirador** de una carta: mucho daño y poco rango, poco y mucho, o las dos cosas.
 * Se sortea **la primera vez que consigues la carta** y ya no se cambia: es tuyo para siempre.
 * El berserker sale menos veces, que es el que más pega y más lejos llega — aunque el clima de la
 * partida puede hundirlo (una tormenta le quita mucho daño y rango).
 */

export type Arquetipo = 'medio' | 'selecto' | 'profesional' | 'berserker'

export interface ArquetipoInfo {
  id: Arquetipo
  /** Lo que se lee escrito en la carta. */
  label: string
  note: string
  /** Cuanto multiplica el daño y el alcance de la carta. */
  dano: number
  rango: number
  color: string
}

export const ARQUETIPOS: ArquetipoInfo[] = [
  { id: 'medio', label: 'Tirador medio', note: 'Ni mucho ni poco: cumple siempre', dano: 1, rango: 1, color: '#a8a29e' },
  { id: 'selecto', label: 'Tirador selecto', note: 'Poco daño y mucho rango', dano: 0.75, rango: 1.35, color: '#7dd3fc' },
  {
    id: 'profesional',
    label: 'Tirador profesional',
    note: 'Mucho daño y poco rango',
    dano: 1.35,
    rango: 0.75,
    color: '#fbbf24',
  },
  { id: 'berserker', label: 'Berserker', note: 'Mucho daño y mucho rango: el raro', dano: 1.3, rango: 1.3, color: '#f43f5e' },
]

export function arquetipoInfo(id: Arquetipo): ArquetipoInfo {
  return ARQUETIPOS.find((item) => item.id === id) ?? ARQUETIPOS[0]!
}

/** Al conseguir una carta por primera vez se le sortea el tipo. El berserker, uno de cada diez. */
export function arquetipoAlAzar(azar: () => number = Math.random): Arquetipo {
  const tirada = azar()
  if (tirada < 0.1) return 'berserker'
  if (tirada < 0.35) return 'profesional'
  if (tirada < 0.6) return 'selecto'
  return 'medio'
}

/** La carta con lo que le hace su tipo: el daño y el rango se multiplican. */
export function conArquetipo(card: BattleCard, arquetipo: Arquetipo | undefined): BattleCard {
  if (!arquetipo) return card
  const info = arquetipoInfo(arquetipo)
  return {
    ...card,
    arquetipo,
    damage: Math.max(10, Math.round(card.damage * info.dano)),
    range: Math.max(1.5, Math.round(card.range * info.rango * 10) / 10),
  }
}
