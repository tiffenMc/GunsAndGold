import { useSyncExternalStore } from 'react'

/**
 * Los volumenes del juego, los que el jugador deja en los ajustes: los efectos de sonido y la
 * musica de fondo. Van de 0 (mudo) a 1 (a tope) y se guardan en este dispositivo.
 *
 * De fabrica los efectos van a tope y la musica muy bajita: la cancion acompaña la partida, no
 * la manda.
 */

export interface Volumes {
  efectos: number
  musica: number
}

export const VOLUMEN_FABRICA: Volumes = { efectos: 1, musica: 0.12 }

const KEY = 'oeste-volumen-v1'

function acotar(valor: unknown, porDefecto: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return porDefecto
  return Math.max(0, Math.min(1, valor))
}

function leer(): Volumes {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...VOLUMEN_FABRICA }
    const parsed = JSON.parse(raw) as Partial<Volumes>
    return {
      efectos: acotar(parsed.efectos, VOLUMEN_FABRICA.efectos),
      musica: acotar(parsed.musica, VOLUMEN_FABRICA.musica),
    }
  } catch {
    return { ...VOLUMEN_FABRICA }
  }
}

let state: Volumes = leer()
const listeners = new Set<() => void>()

/** El volumen de los efectos de sonido (0-1). */
export function sfxVolume(): number {
  return state.efectos
}

/** El volumen de la musica de fondo (0-1). */
export function musicVolume(): number {
  return state.musica
}

export function getVolumes(): Volumes {
  return state
}

/** Cambia un volumen y lo deja guardado. */
export function setVolume(cual: keyof Volumes, valor: number): void {
  state = { ...state, [cual]: acotar(valor, state[cual]) }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Si no cabe, se queda en memoria.
  }
  for (const listener of listeners) listener()
}

export function useVolumes(): Volumes {
  return useSyncExternalStore(subscribe, getVolumes, getVolumes)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
