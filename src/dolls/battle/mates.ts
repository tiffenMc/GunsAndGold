/**
 * **Las matemáticas de la partida, iguales en todos los aparatos.**
 *
 * Sumar, restar, multiplicar, dividir y la raíz cuadrada dan exactamente lo mismo en cualquier
 * navegador (lo manda el estándar). Pero `Math.sin`, `Math.cos`, `Math.atan2`, `Math.exp`,
 * `Math.pow` o `Math.hypot` no: cada navegador las calcula a su manera y en el último decimal
 * pueden no coincidir (un iPhone y un Android, por ejemplo). En una partida de cinco minutos ese
 * decimal acaba cambiando quién gana.
 *
 * Como el servidor **repite cada partida** para comprobar que nadie ha hecho trampas, la partida
 * tiene que salir idéntica en el móvil y en el servidor. Por eso la simulación usa estas versiones,
 * hechas solo con las operaciones de arriba. Su error es de una billonésima: no se nota.
 */

const PI = 3.141592653589793
const MEDIO_PI = 1.5707963267948966
// pi/2 partido en dos trozos para restarlo sin perder decimales (Cody y Waite).
const MEDIO_PI_A = 1.5707963267341256
const MEDIO_PI_B = 6.077100506506192e-11
const LN2_A = 0.6931471803691238
const LN2_B = 1.9082149292705877e-10
const LN2 = 0.6931471805599453

/** El seno, para |r| <= pi/4 (serie de Taylor hasta r^17). */
function senoCorto(r: number): number {
  const r2 = r * r
  let t = r
  let suma = r
  for (let n = 1; n <= 8; n++) {
    t = (-t * r2) / ((2 * n) * (2 * n + 1))
    suma += t
  }
  return suma
}

/** El coseno, para |r| <= pi/4 (serie de Taylor hasta r^16). */
function cosenoCorto(r: number): number {
  const r2 = r * r
  let t = 1
  let suma = 1
  for (let n = 1; n <= 8; n++) {
    t = (-t * r2) / ((2 * n - 1) * (2 * n))
    suma += t
  }
  return suma
}

/** Lleva el ángulo a [-pi/4, pi/4] y dice en qué cuarto de vuelta estaba. */
function reducir(x: number): [number, number] {
  const k = Math.round(x / MEDIO_PI)
  const r = x - k * MEDIO_PI_A - k * MEDIO_PI_B
  return [r, ((k % 4) + 4) % 4]
}

export function sin(x: number): number {
  if (!Number.isFinite(x)) return NaN
  const [r, q] = reducir(x)
  return q === 0 ? senoCorto(r) : q === 1 ? cosenoCorto(r) : q === 2 ? -senoCorto(r) : -cosenoCorto(r)
}

export function cos(x: number): number {
  if (!Number.isFinite(x)) return NaN
  const [r, q] = reducir(x)
  return q === 0 ? cosenoCorto(r) : q === 1 ? -senoCorto(r) : q === 2 ? -cosenoCorto(r) : senoCorto(r)
}

export function tan(x: number): number {
  return sin(x) / cos(x)
}

/** atan(u) para |u| <= tan(pi/12): la serie converge deprisa. */
function atanCorto(u: number): number {
  const u2 = u * u
  let t = u
  let suma = u
  for (let n = 1; n <= 14; n++) {
    t = -t * u2
    suma += t / (2 * n + 1)
  }
  return suma
}

const TAN_PI_12 = 0.2679491924311227
const RAIZ_3 = 1.7320508075688772

/** atan(t) para 0 <= t <= 1. */
function atanHastaUno(t: number): number {
  // Si pasa de tan(pi/12): atan(t) = pi/6 + atan((t*raiz3 - 1) / (t + raiz3)).
  if (t > TAN_PI_12) return PI / 6 + atanCorto((t * RAIZ_3 - 1) / (t + RAIZ_3))
  return atanCorto(t)
}

export function atan(x: number): number {
  if (Number.isNaN(x)) return NaN
  const a = Math.abs(x)
  const r = a <= 1 ? atanHastaUno(a) : MEDIO_PI - atanHastaUno(1 / a)
  return x < 0 ? -r : r
}

export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN
  if (x === 0 && y === 0) return 0
  const ay = Math.abs(y)
  const ax = Math.abs(x)
  // El ángulo en el primer cuadrante, siempre con un cociente entre 0 y 1.
  let a = ay <= ax ? atanHastaUno(ay / ax) : MEDIO_PI - atanHastaUno(ax / ay)
  if (x < 0) a = PI - a
  return y < 0 ? -a : a
}

/** 2 elevado a un entero, exacto (multiplicando por dos). */
function dosA(k: number): number {
  let v = 1
  if (k >= 0) for (let i = 0; i < k; i++) v *= 2
  else for (let i = 0; i < -k; i++) v /= 2
  return v
}

export function exp(x: number): number {
  if (Number.isNaN(x)) return NaN
  if (x > 709) return Infinity
  if (x < -745) return 0
  const k = Math.round(x / LN2)
  const r = x - k * LN2_A - k * LN2_B
  // e^r con |r| <= 0.35: Taylor hasta r^16.
  let t = 1
  let suma = 1
  for (let n = 1; n <= 16; n++) {
    t = (t * r) / n
    suma += t
  }
  return suma * dosA(k)
}

export function log(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN
  if (x === 0) return -Infinity
  if (!Number.isFinite(x)) return Infinity
  // x = m * 2^e con m en [raiz(1/2), raiz(2)).
  let m = x
  let e = 0
  while (m >= 1.4142135623730951) {
    m /= 2
    e++
  }
  while (m < 0.7071067811865476) {
    m *= 2
    e--
  }
  // log(m) = 2 * atanh(s), con s = (m-1)/(m+1) en [-0.172, 0.172].
  const s = (m - 1) / (m + 1)
  const s2 = s * s
  let t = s
  let suma = s
  for (let n = 1; n <= 12; n++) {
    t *= s2
    suma += t / (2 * n + 1)
  }
  return 2 * suma + e * LN2
}

export function pow(base: number, exponente: number): number {
  if (exponente === 0) return 1
  if (base === 0) return exponente > 0 ? 0 : Infinity
  if (base < 0) {
    // Solo con exponentes enteros (los otros no tienen sentido aquí).
    if (!Number.isInteger(exponente)) return NaN
    const v = exp(exponente * log(-base))
    return exponente % 2 === 0 ? v : -v
  }
  return exp(exponente * log(base))
}

/** La distancia: raíz de la suma de cuadrados (la raíz cuadrada sí es igual en todas partes). */
export function hypot(...lados: number[]): number {
  let suma = 0
  for (const l of lados) suma += l * l
  return Math.sqrt(suma)
}
