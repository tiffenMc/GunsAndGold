import { REST } from '../animations'
import type { Key, Motion, Triple } from '../animations'

/**
 * **Las animaciones dibujadas**: dibujas un trazo con el dedo y ese trazo es el camino que hace la
 * mano del arma de tu vaquero antes de soltar el tiro (una floritura, un molinillo, un latigazo…).
 *
 * El dibujo se ve **de frente**, como si tuvieras el muñeco delante: arriba del lienzo es el brazo
 * por encima de la cabeza, abajo es el brazo colgando; a la derecha el brazo abierto y a la izquierda
 * cruzado por delante del pecho. El tiro sale al final del trazo.
 */

/** Un punto del dibujo, de 0 a 1: `x` de izquierda a derecha y `y` de abajo arriba. */
export type Punto = [number, number]

export interface AnimacionDibujada {
  id: string
  nombre: string
  puntos: Punto[]
}

/** Cuántos puntos se guardan de cada dibujo (se reparten a lo largo del trazo). */
export const PUNTOS_POR_DIBUJO = 16
/** Lo mínimo que tiene que medir un trazo para valer (en el lienzo de 0 a 1). */
export const LARGO_MINIMO = 0.25

const acotar = (v: number) => Math.min(1, Math.max(0, v))

/** Lo que mide un trazo. */
export function largoDe(puntos: readonly Punto[]): number {
  let largo = 0
  for (let i = 1; i < puntos.length; i++) largo += Math.hypot(puntos[i]![0] - puntos[i - 1]![0], puntos[i]![1] - puntos[i - 1]![1])
  return largo
}

/**
 * Deja un trazo con `n` puntos repartidos a la misma distancia (el dedo va a trompicones: así el
 * brazo se mueve a ritmo). Todo queda dentro del lienzo.
 */
export function repartir(puntos: readonly Punto[], n = PUNTOS_POR_DIBUJO): Punto[] {
  const limpios = puntos.map(([x, y]): Punto => [acotar(x), acotar(y)])
  if (limpios.length === 0) return []
  if (limpios.length === 1) return Array.from({ length: n }, () => [...limpios[0]!] as Punto)
  const total = largoDe(limpios)
  if (total === 0) return Array.from({ length: n }, () => [...limpios[0]!] as Punto)
  const salida: Punto[] = [limpios[0]!]
  let tramo = 0
  let recorrido = 0
  for (let k = 1; k < n - 1; k++) {
    const meta = (total * k) / (n - 1)
    while (tramo < limpios.length - 2) {
      const largo = Math.hypot(limpios[tramo + 1]![0] - limpios[tramo]![0], limpios[tramo + 1]![1] - limpios[tramo]![1])
      if (recorrido + largo >= meta) break
      recorrido += largo
      tramo++
    }
    const a = limpios[tramo]!
    const b = limpios[tramo + 1]!
    const largo = Math.hypot(b[0] - a[0], b[1] - a[1])
    const f = largo > 0 ? Math.min(1, (meta - recorrido) / largo) : 0
    salida.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  salida.push(limpios[limpios.length - 1]!)
  return salida.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000])
}

/** ¿Vale este dibujo? (null si vale; si no, lo que le pasa). */
export function problemaDelDibujo(puntos: readonly Punto[]): string | null {
  if (puntos.length < 2 || largoDe(puntos) < LARGO_MINIMO) return 'Dibuja un trazo más largo'
  return null
}

/**
 * La pose del brazo del arma en un punto del dibujo. Va en grados, como las demás animaciones:
 * hombro `[adelante, giro, lado]` y codo `[doblado, 0, 0]`.
 */
export function brazoEn([x, y]: Punto): { hombro: Triple; codo: Triple; tronco: Triple } {
  // Abajo del todo, el brazo cuelga; arriba del todo, por encima de la cabeza.
  const adelante = -10 + y * 170
  // El muñeco te mira con la mano del arma a tu derecha: a la derecha del lienzo, el brazo abierto
  // hacia fuera; a la izquierda, cruzado por delante del pecho.
  const lado = 100 * x - 15
  // Con el brazo bajo se dobla más el codo (si no, parece de palo).
  const codo = 8 + (1 - y) * 30
  // El cuerpo acompaña un poco el gesto.
  const tronco: Triple = [0, (x - 0.5) * 24, 0]
  return { hombro: [adelante, 0, lado], codo: [codo, 0, 0], tronco }
}

/** Lo que dura cada parte: llevar la mano al principio del dibujo, recorrerlo y volver. */
const SUBIR = 0.18
const TRAZAR = 0.95
const VOLVER = 0.4
/** En bucle (escaparates), un respiro quieto antes de repetir. */
const RESPIRO = 0.7

/**
 * El dibujo convertido en un **movimiento de disparo** para el muñeco: sube la mano al principio
 * del trazo, lo recorre, suelta el tiro al final y vuelve a su sitio.
 */
export function movimientoDeDibujo(animacion: AnimacionDibujada, enBucle = false): Motion {
  const puntos = animacion.puntos.length >= 2 ? animacion.puntos : ([[0.3, 0.5], [0.3, 0.55]] as Punto[])
  const keys: Key[] = [{ t: 0, pose: { bones: {} } }]
  puntos.forEach((punto, i) => {
    const { hombro, codo, tronco } = brazoEn(punto)
    const t = SUBIR + (TRAZAR * i) / Math.max(1, puntos.length - 1)
    keys.push({ t, pose: { bones: { shoulderR: hombro, elbowR: codo, handR: [0, 0, -6], torso: tronco } } })
  })
  const tiro = SUBIR + TRAZAR
  const fin = tiro + VOLVER
  keys.push({ t: fin, pose: { bones: {} } })
  const largo = enBucle ? fin + RESPIRO : fin
  if (enBucle) keys.push({ t: largo, pose: { bones: {} } })
  return {
    id: `dibujo-${animacion.id}${enBucle ? '-bucle' : ''}`,
    kind: 'disparar',
    name: animacion.nombre,
    hint: 'Animación dibujada',
    loop: enBucle,
    length: largo,
    firesAt: [tiro],
    base: REST,
    keys,
  }
}
