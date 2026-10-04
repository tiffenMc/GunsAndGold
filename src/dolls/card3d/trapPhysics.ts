/**
 * Fisica del muñeco atrapado en la carta. Es un solido en el plano de la carta (la vitrina es
 * estrecha), con bolas de choque a lo largo del cuerpo que rebotan en las cuatro paredes.
 *
 *  - De pie, "hace fuerza" para mantenerse derecho respecto a la gravedad de verdad.
 *  - Si inclinas mucho la carta o la sacudes, pierde el equilibrio y se cae: rueda, choca y
 *    resbala por las paredes.
 *  - Cuando se queda quieto un momento, se vuelve a poner de pie sobre la pared que haga de
 *    suelo (aunque sea una pared de lado).
 */

export interface Box {
  x0: number
  x1: number
  y0: number
  y1: number
}

export interface Probe {
  /** Posicion a lo largo del cuerpo respecto al centro (+ hacia la cabeza). */
  along: number
  r: number
}

export interface BodySpec {
  probes: Probe[]
  /** Distancia del centro a los pies (el origen del muñeco). */
  feet: number
  inertia: number
  /** Los muñecos se levantan; las armas no. */
  standable: boolean
}

export type TrapMode = 'pie' | 'suelto' | 'levanta'

export interface TrapState {
  x: number
  y: number
  /** Giro en el plano: 0 = de pie mirando arriba. */
  a: number
  vx: number
  vy: number
  w: number
  mode: TrapMode
  still: number
  /** Progreso al levantarse. */
  up: number
  upFrom: number
  upTo: number
  /** Cuanto se agita (para la pose de caida). */
  flail: number
  clock: number
}

const E = 0.18
const MU_FEET = 1.1
const MU_BODY = 0.45
const KP = 2.6
const KD = 0.42
const MAX_V = 5
const LOSE_ANGLE = 0.62
const LOSE_PUSH = 3.2
const UP_TIME = 0.55

export function upright(spec: BodySpec, box: Box): TrapState {
  return {
    x: (box.x0 + box.x1) / 2,
    y: box.y0 + spec.feet + 0.001,
    a: 0,
    vx: 0,
    vy: 0,
    w: 0,
    mode: spec.standable ? 'pie' : 'suelto',
    still: 0,
    up: 0,
    upFrom: 0,
    upTo: 0,
    flail: 0,
    clock: 0,
  }
}

/** Para las armas: tumbadas en el suelo de la vitrina. */
export function lying(spec: BodySpec, box: Box): TrapState {
  const floor = Math.max(...spec.probes.map((p) => p.r))
  return { ...upright(spec, box), a: Math.PI / 2, y: box.y0 + floor + 0.002, mode: 'suelto' }
}

function wrap(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

/** Angulo para estar de pie con esta gravedad (la cabeza al lado contrario). */
function targetAngle(gx: number, gy: number): number {
  return Math.atan2(gx, -gy)
}

function resolveContacts(s: TrapState, spec: BodySpec, box: Box, positional: boolean) {
  const ux = -Math.sin(s.a)
  const uy = Math.cos(s.a)
  const mu = s.mode === 'pie' ? MU_FEET : MU_BODY
  for (const probe of spec.probes) {
    const px = s.x + ux * probe.along
    const py = s.y + uy * probe.along
    const walls: [number, number, number][] = [
      [box.x0 - (px - probe.r), 1, 0],
      [px + probe.r - box.x1, -1, 0],
      [box.y0 - (py - probe.r), 0, 1],
      [py + probe.r - box.y1, 0, -1],
    ]
    for (const [pen, nx, ny] of walls) {
      if (pen <= 0) continue
      s.x += nx * pen
      s.y += ny * pen
      if (positional) continue
      const cx = px - nx * probe.r
      const cy = py - ny * probe.r
      const rx = cx - s.x
      const ry = cy - s.y
      let vpx = s.vx - s.w * ry
      let vpy = s.vy + s.w * rx
      const vn = vpx * nx + vpy * ny
      if (vn >= 0) continue
      const rn = rx * ny - ry * nx
      const jn = (-(1 + E) * vn) / (1 + (rn * rn) / spec.inertia)
      s.vx += nx * jn
      s.vy += ny * jn
      s.w += (rn * jn) / spec.inertia
      const tx = -ny
      const ty = nx
      vpx = s.vx - s.w * ry
      vpy = s.vy + s.w * rx
      const vt = vpx * tx + vpy * ty
      const rt = rx * ty - ry * tx
      let jt = -vt / (1 + (rt * rt) / spec.inertia)
      const limit = mu * jn
      jt = Math.max(-limit, Math.min(limit, jt))
      s.vx += tx * jt
      s.vy += ty * jt
      s.w += (rt * jt) / spec.inertia
    }
  }
}

/**
 * Avanza la fisica.
 * @param gx,gy gravedad + empujones, ya en el plano de la carta
 * @param grip  0-1: cuanto esta la carta tumbada (el muñeco roza el fondo y se frena)
 * @param push  fuerza del empujon de este instante (para perder el equilibrio)
 */
export function stepTrap(
  s: TrapState,
  spec: BodySpec,
  box: Box,
  gx: number,
  gy: number,
  grip: number,
  push: number,
  dt: number,
) {
  const steps = 4
  const h = Math.min(1 / 30, dt) / steps
  const gMag = Math.hypot(gx, gy)
  const target = targetAngle(gx, gy)
  for (let i = 0; i < steps; i++) {
    s.clock += h
    if (s.mode === 'levanta') {
      s.up = Math.min(1, s.up + h / UP_TIME)
      const k = s.up * s.up * (3 - 2 * s.up)
      s.a = s.upFrom + wrap(s.upTo - s.upFrom) * k
      s.vx = 0
      s.vy = 0
      s.w = 0
      // Se va empujando hacia el suelo mientras se levanta.
      s.x += (gx / Math.max(0.001, gMag)) * 0.6 * h
      s.y += (gy / Math.max(0.001, gMag)) * 0.6 * h
      resolveContacts(s, spec, box, true)
      if (s.up >= 1) {
        s.mode = 'pie'
        s.still = 0
      }
      continue
    }

    s.vx += gx * h
    s.vy += gy * h

    if (s.mode === 'pie') {
      const err = wrap(s.a - target)
      s.w += ((-KP * err - KD * s.w) / spec.inertia) * h
      if (Math.abs(err) > LOSE_ANGLE || push > LOSE_PUSH || gMag < 1) {
        s.mode = 'suelto'
        s.flail = 1
      }
    }

    if (grip > 0) {
      const f = Math.max(0, 1 - grip * 5 * h)
      s.vx *= f
      s.vy *= f
      s.w *= f
    }

    const speed = Math.hypot(s.vx, s.vy)
    if (speed > MAX_V) {
      s.vx *= MAX_V / speed
      s.vy *= MAX_V / speed
    }
    s.w = Math.max(-40, Math.min(40, s.w))

    s.x += s.vx * h
    s.y += s.vy * h
    s.a += s.w * h
    resolveContacts(s, spec, box, false)
    resolveContacts(s, spec, box, false)
  }

  s.a = wrap(s.a)
  s.flail = Math.max(0, s.flail - dt * 0.8)
  if (s.mode === 'suelto') {
    const calm = Math.hypot(s.vx, s.vy) < 0.1 && Math.abs(s.w) < 0.7
    s.still = calm ? s.still + dt : 0
    if (spec.standable && s.still > 0.9 && gMag > 2.5 && push < 1.5) {
      s.mode = 'levanta'
      s.up = 0
      s.upFrom = s.a
      s.upTo = target
    }
  }
}
