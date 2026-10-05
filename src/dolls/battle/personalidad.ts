import type { Estilo } from './estilos'
import { papelDelEstilo } from './papeles'
import type { Papel } from './papeles'

/**
 * **Cómo se mueve y cómo pega cada muñeco.** Sin carteles: lo que hace que se note qué carta has
 * sacado es su forma de andar y de atacar. La bailarina va girando y dando saltitos y se lanza
 * girando; el tanque anda despacio a pisotones; La Muerte flota y su cañonazo marca antes en el
 * suelo dónde va a caer; el francotirador apunta con una línea que se va encendiendo; el kamikaze
 * tiembla como una mecha; el de cuerpo a cuerpo va inclinado y embiste al pegar…
 *
 * Es solo dibujo: el motor (lo que cuenta de verdad) no se entera.
 */
export interface Personalidad {
  /** Al andar: balanceo de lado (rad), saltitos (m), inclinarse hacia delante (rad). */
  balanceo: number
  salto: number
  inclina: number
  /** Gira sobre sí mismo al andar (rad/s): la bailarina. */
  giro: number
  /** Pisotones: se aplasta en cada paso (0-0,25). */
  pisoton: number
  /** Va flotando a esta altura (m), subiendo y bajando. */
  flota: number
  /** Agachado (escala de alto): el sigiloso. */
  agacha: number
  /** Tiembla siempre (m) y al disparar (m). */
  temblor: number
  temblorAlDisparar: number
  /** Lo rápido que da los pasos (1 = normal). */
  ritmo: number
  /** Al atacar: se echa para atrás con el tiro (m), embiste hacia delante (m), o gira entero. */
  retroceso: number
  embestida: number
  giroAlAtacar: boolean
  /** Avisa antes de disparar: una línea hasta el blanco o la zona donde va a caer. */
  apunta?: 'linea' | 'zona'
}

const BASE: Personalidad = {
  balanceo: 0.07,
  salto: 0,
  inclina: 0,
  giro: 0,
  pisoton: 0,
  flota: 0,
  agacha: 1,
  temblor: 0,
  temblorAlDisparar: 0,
  ritmo: 1,
  retroceso: 0.12,
  embestida: 0,
  giroAlAtacar: false,
}

const POR_PAPEL: Record<Papel, Partial<Personalidad>> = {
  tirador: {},
  rafaga: { temblorAlDisparar: 0.035, retroceso: 0.08 },
  pesado: { apunta: 'linea', retroceso: 0.35, balanceo: 0.04 },
  area: { apunta: 'zona', retroceso: 0.3 },
  rebote: { balanceo: 0.12, salto: 0.05 },
  perfora: { apunta: 'linea', retroceso: 0.28 },
  cuerpo: { inclina: 0.25, ritmo: 1.35, embestida: 0.8, retroceso: 0 },
  tanque: { pisoton: 0.13, balanceo: 0.16, ritmo: 0.6, retroceso: 0.05 },
  cura: { flota: 0.25, balanceo: 0.04 },
  apoyo: { balanceo: 0.11, salto: 0.07 },
  trampa: { balanceo: 0.1, retroceso: 0.2 },
  bomba: { temblor: 0.03, inclina: 0.3, ritmo: 1.6, retroceso: 0.25 },
  sigilo: { agacha: 0.8, inclina: 0.22, balanceo: 0.03 },
  control: { balanceo: 0.06, retroceso: 0.18 },
}

/** Los que tienen su manera propia (por estilo base: el vaquero, el vikingo y el indio, igual). */
const POR_ESTILO: Record<string, Partial<Personalidad>> = {
  bailarina: { giro: 9, salto: 0.28, inclina: 0, ritmo: 1.5, giroAlAtacar: true, embestida: 1.2, balanceo: 0.02 },
  corredor: { inclina: 0.38, ritmo: 1.75, salto: 0.1, balanceo: 0.03 },
  canon: { flota: 0.4, balanceo: 0.03, ritmo: 0.5, retroceso: 0.75, apunta: 'zona' },
  minigun: { pisoton: 0.08, ritmo: 0.7, temblorAlDisparar: 0.07, retroceso: 0.04 },
  coloso: { pisoton: 0.22, ritmo: 0.55, balanceo: 0.18, embestida: 1 },
  furia: { inclina: 0.32, temblor: 0.015, embestida: 1.1 },
  matón: { pisoton: 0.1, inclina: 0.18, ritmo: 0.85 },
  kamikaze: { temblor: 0.05, inclina: 0.4, ritmo: 1.9, salto: 0.06 },
  estocada: { inclina: 0.3, embestida: 1.6, ritmo: 1.4 },
  perdigones: { retroceso: 0.45 },
  escopetazo: { retroceso: 0.55 },
  dinamitero: { salto: 0.06, retroceso: 0.3 },
  medico: { flota: 0.2 },
  sanadora: { flota: 0.32 },
  santo: { flota: 0.3, apunta: 'linea' },
  reina: { balanceo: 0.05, salto: 0, ritmo: 0.8 },
  poker: { balanceo: 0.14 },
  francotirador: { apunta: 'linea', agacha: 0.92 },
  legendario: { apunta: 'linea', flota: 0.15 },
  cuervo: { flota: 0.18, balanceo: 0.12 },
  fusileria: { temblorAlDisparar: 0.05 },
  lazo: { balanceo: 0.12, retroceso: 0.3 },
  emboscada: { agacha: 0.78, inclina: 0.28 },
}

const hechas = new Map<string, Personalidad>()

export function personalidadDe(estilo: Estilo): Personalidad {
  const hecha = hechas.get(estilo.id)
  if (hecha) return hecha
  const base = estilo.id.replace(/^[vi]:/, '')
  const p: Personalidad = { ...BASE, ...POR_PAPEL[papelDelEstilo(estilo)], ...(POR_ESTILO[base] ?? {}) }
  // Los vikingos (todo de cerca) no apuntan desde lejos: embisten.
  if (estilo.id.startsWith('v:') && estilo.cuerpo !== undefined && !POR_ESTILO[base]?.apunta) {
    delete p.apunta
    p.embestida = Math.max(p.embestida, 0.7)
    p.inclina = Math.max(p.inclina, 0.15)
  }
  hechas.set(estilo.id, p)
  return p
}
