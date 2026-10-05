import type { Estilo } from './estilos'
import type { SonidoDeTropa } from './sfx'
import { papelDelEstilo } from './papeles'
import { selloDelEstilo } from './sellos'
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
  /** Cómo suena su ataque. */
  sonido: SonidoDeTropa
  /** Su animación de ataque (la del vaquero: los vikingos e indios ya traen la suya). */
  ataque: string
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
  sonido: 'revolver',
  ataque: 'disparar-1',
}

const POR_PAPEL: Record<Papel, Partial<Personalidad>> = {
  tirador: { sonido: 'revolver', ataque: 'disparar-1' },
  rafaga: { temblorAlDisparar: 0.035, retroceso: 0.08, sonido: 'revolver', ataque: 'disparar-4' },
  pesado: { apunta: 'linea', retroceso: 0.35, balanceo: 0.04, sonido: 'rifle', ataque: 'disparar-5' },
  area: { apunta: 'zona', retroceso: 0.3, sonido: 'escopeta', ataque: 'disparar-2' },
  rebote: { balanceo: 0.12, salto: 0.05, sonido: 'revolver', ataque: 'disparar-3' },
  perfora: { apunta: 'linea', retroceso: 0.28, sonido: 'rifle', ataque: 'disparar-5' },
  cuerpo: { inclina: 0.25, ritmo: 1.35, embestida: 0.8, retroceso: 0, sonido: 'golpe', ataque: 'golpe-1' },
  tanque: { pisoton: 0.13, balanceo: 0.16, ritmo: 0.6, retroceso: 0.05, sonido: 'bufalo', ataque: 'disparar-2' },
  cura: { flota: 0.25, balanceo: 0.04, sonido: 'revolver', ataque: 'disparar-2' },
  apoyo: { balanceo: 0.11, salto: 0.07, sonido: 'revolver', ataque: 'disparar-1' },
  trampa: { balanceo: 0.1, retroceso: 0.2, sonido: 'escopeta', ataque: 'disparar-3' },
  bomba: { temblor: 0.03, inclina: 0.3, ritmo: 1.6, retroceso: 0.25, sonido: 'dinamita', ataque: 'disparar-2' },
  sigilo: { agacha: 0.8, inclina: 0.22, balanceo: 0.03, sonido: 'revolver', ataque: 'disparar-3' },
  control: { balanceo: 0.06, retroceso: 0.18, sonido: 'revolver', ataque: 'disparar-1' },
}

/** Los que tienen su manera propia (por estilo base: el vaquero, el vikingo y el indio, igual). */
const POR_ESTILO: Record<string, Partial<Personalidad>> = {
  bailarina: { sonido: 'golpe', ataque: 'golpe-3', giro: 9, salto: 0.28, inclina: 0, ritmo: 1.5, giroAlAtacar: true, embestida: 1.2, balanceo: 0.02 },
  corredor: { inclina: 0.38, ritmo: 1.75, salto: 0.1, balanceo: 0.03 },
  canon: { sonido: 'bufalo', ataque: 'disparar-2', flota: 0.4, balanceo: 0.03, ritmo: 0.5, retroceso: 0.75, apunta: 'zona' },
  minigun: { sonido: 'gatling', ataque: 'disparar-2', pisoton: 0.08, ritmo: 0.7, temblorAlDisparar: 0.07, retroceso: 0.04 },
  coloso: { ataque: 'golpe-2', pisoton: 0.22, ritmo: 0.55, balanceo: 0.18, embestida: 1 },
  furia: { inclina: 0.32, temblor: 0.015, embestida: 1.1 },
  matón: { ataque: 'golpe-4', pisoton: 0.1, inclina: 0.18, ritmo: 0.85 },
  kamikaze: { sonido: 'golpe', ataque: 'golpe-4', temblor: 0.05, inclina: 0.4, ritmo: 1.9, salto: 0.06 },
  estocada: { ataque: 'golpe-5', inclina: 0.3, embestida: 1.6, ritmo: 1.4 },
  perdigones: { retroceso: 0.45 },
  escopetazo: { retroceso: 0.55 },
  dinamitero: { sonido: 'dinamita', salto: 0.06, retroceso: 0.3 },
  medico: { flota: 0.2 },
  sanadora: { flota: 0.32 },
  santo: { flota: 0.3, apunta: 'linea' },
  reina: { balanceo: 0.05, salto: 0, ritmo: 0.8 },
  poker: { balanceo: 0.14, ataque: 'disparar-2' },
  francotirador: { apunta: 'linea', agacha: 0.92, sonido: 'rifle', ataque: 'disparar-5' },
  legendario: { apunta: 'linea', flota: 0.15 },
  cuervo: { flota: 0.18, balanceo: 0.12 },
  fusileria: { sonido: 'gatling', temblorAlDisparar: 0.05 },
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
  // El aviso antes de pegar va con el sello: el de distancia apunta a su blanco con la línea, el de
  // área marca la zona donde va a caer. Los demás no avisan.
  const sello = selloDelEstilo(estilo)
  p.apunta = sello === 'distancia' ? 'linea' : sello === 'area' && !estilo.campo && !estilo.rebota && !estilo.reapunta ? 'zona' : undefined
  if (sello === 'distancia' && p.sonido === 'revolver') p.sonido = 'rifle'
  hechas.set(estilo.id, p)
  return p
}
