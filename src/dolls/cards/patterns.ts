/**
 * Los patrones que se dibujan para sacar una carta de batalla. Cada carta tiene el suyo y
 * siempre es el mismo, asi se aprende. Coordenadas de 0 a 1 dentro del cuadro, y hacia abajo.
 */

export interface Pt {
  x: number
  y: number
}

export interface PatternDef {
  id: string
  name: string
  level: 1 | 2 | 3 | 4
  points: Pt[]
}

function arc(cx: number, cy: number, r: number, from: number, to: number, steps: number): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
  })
}

const PI = Math.PI

export const PATTERNS: PatternDef[] = [
  // -- Faciles --
  { id: 'raya', name: 'Raya', level: 1, points: [{ x: 0.2, y: 0.78 }, { x: 0.8, y: 0.22 }] },
  { id: 'arco', name: 'Arco', level: 1, points: arc(0.5, 0.64, 0.32, PI, 2 * PI, 16) },
  {
    id: 'uve',
    name: 'Uve',
    level: 1,
    points: [{ x: 0.2, y: 0.24 }, { x: 0.5, y: 0.78 }, { x: 0.8, y: 0.24 }],
  },
  {
    id: 'ele',
    name: 'Escuadra',
    level: 1,
    points: [{ x: 0.3, y: 0.2 }, { x: 0.3, y: 0.78 }, { x: 0.76, y: 0.78 }],
  },
  // -- Normales --
  {
    id: 'zeta',
    name: 'Zeta',
    level: 2,
    points: [{ x: 0.22, y: 0.24 }, { x: 0.78, y: 0.24 }, { x: 0.22, y: 0.76 }, { x: 0.78, y: 0.76 }],
  },
  {
    id: 'herradura',
    name: 'Herradura',
    level: 2,
    points: [
      { x: 0.26, y: 0.2 },
      ...arc(0.5, 0.52, 0.24, PI, 0, 14),
      { x: 0.74, y: 0.2 },
    ],
  },
  {
    id: 'ese',
    name: 'Ese',
    level: 2,
    points: [...arc(0.5, 0.33, 0.18, -0.1, -PI * 1.5, 12), ...arc(0.5, 0.67, 0.18, -PI / 2, PI * 0.9, 12).slice(1)],
  },
  {
    id: 'triangulo',
    name: 'Triángulo',
    level: 2,
    points: [{ x: 0.5, y: 0.18 }, { x: 0.82, y: 0.78 }, { x: 0.18, y: 0.78 }, { x: 0.5, y: 0.18 }],
  },
  // -- Dificiles --
  { id: 'circulo', name: 'Círculo', level: 3, points: arc(0.5, 0.5, 0.32, -PI / 2, PI * 1.5, 28) },
  {
    id: 'eme',
    name: 'Eme',
    level: 3,
    points: [
      { x: 0.18, y: 0.8 },
      { x: 0.28, y: 0.2 },
      { x: 0.5, y: 0.62 },
      { x: 0.72, y: 0.2 },
      { x: 0.82, y: 0.8 },
    ],
  },
  {
    id: 'rayo',
    name: 'Rayo',
    level: 3,
    points: [
      { x: 0.64, y: 0.14 },
      { x: 0.32, y: 0.52 },
      { x: 0.62, y: 0.5 },
      { x: 0.36, y: 0.86 },
    ],
  },
  {
    id: 'lazo',
    name: 'Lazo',
    level: 3,
    points: [
      { x: 0.16, y: 0.8 },
      { x: 0.5, y: 0.62 },
      ...arc(0.62, 0.4, 0.2, PI * 0.6, PI * 2.6, 20),
      { x: 0.86, y: 0.72 },
    ],
  },
  {
    id: 'ola',
    name: 'Ola',
    level: 3,
    points: Array.from({ length: 31 }, (_, i) => {
      const t = i / 30
      return { x: 0.14 + t * 0.72, y: 0.5 - Math.sin(t * PI * 2.5) * 0.26 }
    }),
  },
  // -- Muy dificiles --
  {
    id: 'bucle',
    name: 'Bucle',
    level: 4,
    points: [
      { x: 0.14, y: 0.8 },
      { x: 0.4, y: 0.64 },
      ...arc(0.55, 0.46, 0.19, PI * 0.8, PI * 0.8 - PI * 2, 22).slice(1),
      { x: 0.7, y: 0.52 },
      { x: 0.88, y: 0.2 },
    ],
  },
  {
    id: 'estrella',
    name: 'Estrella',
    level: 4,
    points: [0, 2, 4, 1, 3, 0].map((k) => {
      const a = -PI / 2 + (k * 2 * PI) / 5
      return { x: 0.5 + Math.cos(a) * 0.34, y: 0.54 + Math.sin(a) * 0.34 }
    }),
  },
  {
    id: 'espiral',
    name: 'Espiral',
    level: 4,
    points: Array.from({ length: 40 }, (_, i) => {
      const t = i / 39
      const a = t * PI * 3.6
      const r = 0.06 + t * 0.3
      return { x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r }
    }),
  },
  {
    id: 'infinito',
    name: 'Infinito',
    level: 4,
    points: Array.from({ length: 41 }, (_, i) => {
      const t = (i / 40) * PI * 2
      const d = 1 + Math.sin(t) * Math.sin(t)
      return { x: 0.5 + (0.36 * Math.cos(t)) / d, y: 0.5 + (0.36 * Math.sin(t) * Math.cos(t)) / d }
    }),
  },
  {
    id: 'cascabel',
    name: 'Cascabel',
    level: 4,
    points: Array.from({ length: 37 }, (_, i) => {
      const t = i / 36
      return { x: 0.14 + t * 0.72, y: 0.5 + Math.sin(t * PI * 3) * (0.14 + t * 0.14) }
    }),
  },
]

export function patternById(id: string): PatternDef {
  return PATTERNS.find((pattern) => pattern.id === id) ?? PATTERNS[0]
}

export function patternsOfLevel(level: number): PatternDef[] {
  return PATTERNS.filter((pattern) => pattern.level === level)
}

// ---------------------------------------------------------------------------
// Precision del trazo
// ---------------------------------------------------------------------------

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function resample(points: Pt[], samples: number): Pt[] {
  if (points.length === 0) return []
  if (points.length === 1) return Array.from({ length: samples }, () => points[0])
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const segment = dist(points[i - 1], points[i])
    lengths.push(segment)
    total += segment
  }
  if (total === 0) return Array.from({ length: samples }, () => points[0])
  const step = total / (samples - 1)
  const out: Pt[] = [points[0]]
  let index = 0
  let start = 0
  for (let i = 1; i < samples; i++) {
    const target = step * i
    while (index < lengths.length - 1 && start + lengths[index] < target) {
      start += lengths[index]
      index++
    }
    const t = Math.min(1, Math.max(0, (target - start) / (lengths[index] || 1)))
    const a = points[index]
    const b = points[index + 1]
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
  }
  return out
}

export function pathLength(points: Pt[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i])
  return total
}

const SAMPLES = 48
/**
 * El trazo se mide por **pasillo**, pensado para el dedo en el movil: mientras estes a menos de
 * PASILLO del camino (en fracciones del cuadro) cuenta como perfecto, y la nota baja poco a poco
 * hasta 0 al llegar a FUERA. Un temblor no cuesta nada, pero irse por las ramas, si.
 */
export const PASILLO = 0.075
export const FUERA = 0.24

/** Nota de un punto segun lo lejos que esta del camino (1 dentro del pasillo, 0 fuera del todo). */
export function notaDeError(error: number): number {
  if (error <= PASILLO) return 1
  if (error >= FUERA) return 0
  return 1 - (error - PASILLO) / (FUERA - PASILLO)
}

/** Distancia de un punto al camino (a su segmento mas cercano). */
export function distanciaAlCamino(path: Pt[], p: Pt): number {
  let best = Infinity
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)))
  }
  return best
}

/** Precision de 0 a 1. Da igual el sentido en que lo dibujes. */
export function traceAccuracy(target: Pt[], drawn: Pt[]): number {
  if (target.length < 2 || drawn.length < 2) return 0
  // Un toque suelto no es un trazo.
  if (pathLength(drawn) < pathLength(target) * 0.4) return 0
  const a = resample(target, SAMPLES)
  const b = resample(drawn, SAMPLES)
  let forward = 0
  let backward = 0
  for (let i = 0; i < SAMPLES; i++) {
    forward += notaDeError(dist(a[i], b[i]))
    backward += notaDeError(dist(a[i], b[SAMPLES - 1 - i]))
  }
  return Math.max(forward, backward) / SAMPLES
}
