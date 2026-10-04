import { advance } from '@react-three/fiber'

/**
 * Modo de prueba: con `?manual` en la direccion, las escenas 3D no avanzan solas y se mueven
 * fotograma a fotograma desde la consola con `__advance(fotogramas)`. Sirve para revisar la
 * fisica y la batalla con la pestana en segundo plano.
 */
export const MANUAL =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('manual')

export const FRAMELOOP = MANUAL ? ('never' as const) : ('always' as const)

if (MANUAL) {
  let clock = 0
  ;(window as unknown as { __advance: (frames: number) => number }).__advance = (frames: number) => {
    for (let i = 0; i < frames; i++) {
      clock += 1 / 60
      advance(clock)
    }
    return clock
  }
}

/** Captura el puntero sin romper si el navegador no lo deja (eventos sinteticos, etc.). */
export function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    // Sin captura tambien funciona: solo se pierde el arrastre si sales de la zona.
  }
}
