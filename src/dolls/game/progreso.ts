/**
 * La **experiencia de carta** y el **rango** por monedas.
 *
 * Una carta sube del **1 al 10** con experiencia. Del 1 al 10 **solo cambia lo bonita que se ve**:
 * al 1 ya es tuya y se puede equipar. Cada nivel pide más que el anterior.
 *
 * - Un **sobre** da **un nivel entero** de golpe (mínimo): si no la tenías, te la deja al 1, y si la
 *   tenías, la sube un nivel.
 * - Una **incursión de carta** da entre un **1% y un 100%** de la barra del nivel que toque: puede
 *   hacerte falta repetirla varias veces para subir.
 *
 * Las **monedas** son el rango: solo se mueven en la **partida de rango**, y lo que ganas se lo
 * quitas al rival (30–100 por partida ganada).
 */

export const NIVEL_MAX = 10

/** Lo que pide cada nivel (1 → 10) para llenarse, en % de experiencia. */
export const XP_POR_NIVEL = [100, 130, 170, 220, 280, 350, 430, 520, 620, 730]

/** La experiencia que hace falta para *estar* en ese nivel (acumulada). */
export function xpHasta(nivel: number): number {
  let total = 0
  for (let i = 0; i < Math.min(nivel, NIVEL_MAX); i++) total += XP_POR_NIVEL[i]!
  return total
}

/** El nivel que te da esa experiencia (0 = todavía no es tuya). */
export function nivelDesdeXp(xp: number): number {
  let nivel = 0
  let acumulada = 0
  for (let i = 0; i < NIVEL_MAX; i++) {
    acumulada += XP_POR_NIVEL[i]!
    if (xp >= acumulada) nivel = i + 1
    else break
  }
  return nivel
}

export interface ProgresoDeCarta {
  /** El nivel que tiene (0 = no es tuya, 1 = ya se puede equipar). */
  nivel: number
  /** Lo que llevas del nivel que está subiendo, en %. */
  llevo: number
  /** Lo que pide ese nivel, en %. */
  pide: number
  /** La experiencia que falta para el siguiente nivel, en %. */
  falta: number
  /** El total de experiencia que llevas. */
  xp: number
}

export function progresoDeCarta(xp: number): ProgresoDeCarta {
  const nivel = nivelDesdeXp(xp)
  const suelo = xpHasta(nivel)
  const pide = pideElNivel(nivel)
  const llevo = Math.max(0, Math.min(pide, xp - suelo))
  return { nivel, llevo, pide, falta: Math.max(0, pide - llevo), xp }
}

/** Lo que pide el nivel que está subiendo (si ya está al máximo, ya no pide nada). */
function pideElNivel(nivel: number): number {
  if (nivel >= NIVEL_MAX) return 1
  return XP_POR_NIVEL[nivel]!
}

/** Lo que da un sobre: un nivel entero. */
export function xpDeSobre(xp: number): number {
  const { nivel, pide, llevo } = progresoDeCarta(xp)
  if (nivel >= NIVEL_MAX) return xp
  return xp + (pide - llevo)
}

/** Lo que da una incursión de carta: entre 1% y 100% de la barra del nivel. */
export function xpDeIncursion(azar: () => number = Math.random): number {
  return Math.max(1, Math.round(1 + azar() * 99))
}

/** Suma experiencia sin pasarse del tope. */
export function sumarXp(xp: number, cantidad: number): number {
  return Math.max(0, Math.min(xpHasta(NIVEL_MAX), Math.round((xp + cantidad) * 10) / 10))
}

/** Si con esa experiencia la carta ya es tuya (nivel 1 o más). */
export function esTuya(xp: number): boolean {
  return nivelDesdeXp(xp) >= 1
}

// ---------------------------------------------------------------------------
// Las monedas y el rango
// ---------------------------------------------------------------------------

export const MONEDAS_MIN = 30
export const MONEDAS_MAX = 100

/** Lo que te llevas de una partida de rango ganada (y lo que le quitas al rival). */
export function premioDeRango(azar: () => number = Math.random): number {
  return Math.round(MONEDAS_MIN + azar() * (MONEDAS_MAX - MONEDAS_MIN))
}

export interface RangoInfo {
  id: string
  label: string
  icon: string
  /** Monedas a partir de las cuales se tiene ese rango. */
  desde: number
  color: string
}

/** Los tramos de rango: solo son nombres para dar color. Lo que manda es el número de monedas. */
export const RANGOS: RangoInfo[] = [
  { id: 'novato', label: 'Novato', icon: '🥾', desde: 0, color: '#a8a29e' },
  { id: 'forajido', label: 'Forajido', icon: '🔫', desde: 300, color: '#38bdf8' },
  { id: 'pistolero', label: 'Pistolero', icon: '🎯', desde: 800, color: '#4ade80' },
  { id: 'sheriff', label: 'Sheriff', icon: '⭐', desde: 1500, color: '#fbbf24' },
  { id: 'marshal', label: 'Marshal', icon: '🏅', desde: 2500, color: '#c084fc' },
  { id: 'leyenda', label: 'Leyenda del Oeste', icon: '👑', desde: 4000, color: '#f43f5e' },
]

export function rangoDe(monedas: number): RangoInfo {
  let encontrado = RANGOS[0]!
  for (const rango of RANGOS) if (monedas >= rango.desde) encontrado = rango
  return encontrado
}

/** Lo que te falta para el rango siguiente (null si ya eres leyenda). */
export function paraElSiguienteRango(monedas: number): number | null {
  const siguiente = RANGOS.find((rango) => rango.desde > monedas)
  return siguiente ? siguiente.desde - monedas : null
}
