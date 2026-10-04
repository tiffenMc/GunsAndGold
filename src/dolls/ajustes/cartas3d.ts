import { useSyncExternalStore } from 'react'

/**
 * Cómo se ven las cartas. Solo hay **dos formas**, y se elige aquí:
 *
 *  - **normal** (por defecto): la carta de siempre, con su retrato y su marco de color.
 *  - **en 3D**: la misma carta, con su modelo 3D.
 *
 * Lo que se elija se queda guardado en este dispositivo, así que siempre se ve igual hasta que lo
 * cambies tú.
 */

const KEY = 'oeste-cartas-3d-v1'

function leer(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let activo = leer()
const oyentes = new Set<() => void>()

/** Si las cartas se ven en 3D. */
export function cartasEn3d(): boolean {
  return activo
}

/** Cambia cómo se ven las cartas (y lo guarda). */
export function activarCartas3d(valor: boolean): void {
  activo = valor
  try {
    localStorage.setItem(KEY, valor ? '1' : '0')
  } catch {
    // Sin sitio para guardar: se queda en memoria.
  }
  for (const oyente of oyentes) oyente()
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

/** Para pintar según lo que haya elegido. */
export function useCartas3d(): boolean {
  return useSyncExternalStore(suscribir, cartasEn3d, cartasEn3d)
}
