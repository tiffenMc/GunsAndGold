/**
 * **El ritmo de la partida**, todo junto para poder afinarlo sin buscar numeros por el motor.
 *
 *  - Una partida dura **5 minutos como mucho**: al acabarse el tiempo gana el fuerte con mas vida.
 *  - Mientras tengas **el maximo de soldados vivos** en el campo no puedes sacar mas cartas de
 *    batalla; en cuanto cae uno tuyo, si. Ese maximo **sube cada minuto**: 4, 5, 6.
 *  - Cada baja da **racha**: tus soldados van mas rapido y disparan antes unos segundos.
 *  - Con el tiempo el fuerte recibe cada vez mas daño, para que los empates no se eternicen.
 */

/** Lo que dura una partida como mucho, en segundos. */
export const TIEMPO_MAXIMO_S = 300

/** Soldados vivos que puede tener cada bando a la vez al empezar, cada cuanto sube y el tope. */
export const VIVOS_AL_EMPEZAR = 4
export const VIVOS_SUBEN_CADA_S = 60
export const VIVOS_TOPE = 6

/** Cuantos soldados vivos puede tener cada bando a esta hora de la partida. */
export function maxVivosEn(time: number): number {
  return Math.min(VIVOS_TOPE, VIVOS_AL_EMPEZAR + Math.floor(Math.max(0, time) / VIVOS_SUBEN_CADA_S))
}

/** Pausa minima entre dos cartas del mismo bando (para no soltar dos en el mismo segundo). */
export const PAUSA_ENTRE_CARTAS_S = 0.8

/** Racha: cada baja suma un nivel (hasta RACHA_MAX) durante RACHA_S; cada nivel da este extra de velocidad y cadencia. */
export const RACHA_S = 5
export const RACHA_MAX = 3
export const RACHA_BONUS = 0.25

/** Desde cuando el fuerte empieza a recibir mas daño y cuanto sube como mucho. */
export const FURIA_DESDE_S = 45
export const FURIA_MAX = 4

export function furiaEn(time: number): number {
  const u = Math.min(1, Math.max(0, (time - FURIA_DESDE_S) / (TIEMPO_MAXIMO_S - FURIA_DESDE_S)))
  return 1 + (FURIA_MAX - 1) * u
}

// ── Disparos entre todos ─────────────────────────────────────────────────────

/** Balas que lleva cada muñeco antes de tener que recargar. */
export const BALAS = 6
/** Lo que tarda en recargar (se queda parado, a tiro). */
export const RECARGA_S = 1.9

// ── La vagoneta: rara y al azar ─────────────────────────────────────────────

export const VAGONETA_PRIMERA_MIN_S = 75
export const VAGONETA_PRIMERA_MAX_S = 130
export const VAGONETA_ENTRE_MIN_S = 80
export const VAGONETA_ENTRE_MAX_S = 140
/** Como mucho este numero de vagonetas por partida. */
export const VAGONETA_MAX = 2
/** Solo los muñecos que estan a esta distancia (o menos) se desvian a por ella. */
export const VAGONETA_ATRAE = 9
