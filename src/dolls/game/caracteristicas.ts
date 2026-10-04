/**
 * Las **seis características** del jugador. Se entrenan ganando incursiones de práctica (suben un
 * % al azar) y **bajan solas con el tiempo** — como en Project Zomboid — pero nunca por debajo del
 * 1%. Se gastan (y hacen falta) para entrar en las incursiones de carta.
 *
 * Cada una da un extra pequeño en la batalla, para que entrenarlas se note en el campo.
 */

export type Caracteristica = 'punteria' | 'precision' | 'vida' | 'cansancio' | 'reflejos' | 'temple'

export interface CaracteristicaInfo {
  id: Caracteristica
  label: string
  icon: string
  /** Lo que hace en la batalla. */
  note: string
  color: string
}

export const CARACTERISTICAS: CaracteristicaInfo[] = [
  {
    id: 'punteria',
    label: 'Puntería',
    icon: '🎯',
    note: 'Tus muñecos pegan más (hasta +25% de daño)',
    color: '#f87171',
  },
  {
    id: 'precision',
    label: 'Precisión',
    icon: '🔭',
    note: 'Tu arma llega más lejos (hasta +20% de alcance)',
    color: '#7dd3fc',
  },
  { id: 'vida', label: 'Vida', icon: '❤️', note: 'Tu fuerte aguanta más (hasta +25%)', color: '#fb7185' },
  { id: 'cansancio', label: 'Cansancio', icon: '🥵', note: 'Tus muñecos andan más rápido (hasta +20%)', color: '#fbbf24' },
  { id: 'reflejos', label: 'Reflejos', icon: '⚡', note: 'Tus muñecos disparan más rápido (hasta −20% de espera)', color: '#c084fc' },
  { id: 'temple', label: 'Temple', icon: '🛡️', note: 'Tus muñecos salen con más escudos (hasta +25%)', color: '#4ade80' },
]

export const CARACTERISTICAS_IDS: Caracteristica[] = CARACTERISTICAS.map((item) => item.id)

export function caracteristicaInfo(id: Caracteristica): CaracteristicaInfo {
  return CARACTERISTICAS.find((item) => item.id === id) ?? CARACTERISTICAS[0]!
}

/** De fábrica todos empiezan iguales, y bajitos: hay que entrenarlos. */
export const CARACTERISTICA_INICIAL = 25

export type Caracteristicas = Record<Caracteristica, number>

export function caracteristicasDeFabrica(): Caracteristicas {
  return { punteria: CARACTERISTICA_INICIAL, precision: CARACTERISTICA_INICIAL, vida: CARACTERISTICA_INICIAL, cansancio: CARACTERISTICA_INICIAL, reflejos: CARACTERISTICA_INICIAL, temple: CARACTERISTICA_INICIAL }
}

export function acotarCaracteristica(valor: unknown, porDefecto = CARACTERISTICA_INICIAL): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return porDefecto
  return Math.max(1, Math.min(100, Math.round(valor)))
}

/** Lo que baja cada característica por minuto de reloj (despacito, y nunca del 1%). */
export const DESGASTE_POR_MINUTO = 0.35

/** Aplica el desgaste desde la última vez. Devuelve las características y el nuevo sello de tiempo. */
export function aplicarDesgaste(
  stats: Caracteristicas,
  desde: number,
  ahora: number,
): { stats: Caracteristicas; desde: number } {
  const minutos = Math.max(0, (ahora - desde) / 60000)
  if (minutos < 1) return { stats, desde }
  const bajada = minutos * DESGASTE_POR_MINUTO
  const salida = {} as Caracteristicas
  for (const id of CARACTERISTICAS_IDS) salida[id] = Math.max(1, stats[id] - bajada)
  return { stats: salida, desde: ahora }
}

/** Lo que sube una incursión de práctica ganada: entre un 30% y un 100%, al azar. */
export function premioDeEntreno(azar: () => number = Math.random): number {
  return Math.round(30 + azar() * 70)
}

/** Redondea para enseñarlas. */
export function redondearCaracteristicas(stats: Caracteristicas): Caracteristicas {
  const salida = {} as Caracteristicas
  for (const id of CARACTERISTICAS_IDS) salida[id] = Math.max(1, Math.round(stats[id] * 10) / 10)
  return salida
}

/** El extra de batalla: de 0 a `tope`, según lo entrenada que esté (1-100). */
export function extraDe(stats: Caracteristicas, id: Caracteristica, tope: number): number {
  return (Math.max(0, Math.min(100, stats[id])) / 100) * tope
}
