import { MANUAL } from '../debugClock'
import type { QualityId } from '../cards/model'
import { BUILTIN_CARDS } from '../cards/catalog'
import { MUDO, audio, fuerza, ruido } from './audio'
import { precargarSonidos, sonido, tocaSonido } from './samples'

/**
 * La frase que suelta cada carta al entrar en la partida: una linea grabada de verdad, del pack
 * Voiceover de Kenney (CC0), en `public/sonidos/cartas/<carta>.wav`.
 *
 * Suenan **muy bajitas** a proposito (VOLUMEN_VOZ): son un detalle de color, no un foco — se tienen
 * que oir sin molestar. Bajo cada frase hay una **receta sintetizada** propia (la placa del Sheriff,
 * la armónica del Bandolero, el yunque del Herrero…) que entra si falta el fichero o el navegador no
 * lo lee, para que ninguna carta se quede muda.
 */

/** Una nota: puede deslizarse, vibrar y colarse por un filtro. */
interface Nota {
  de: number
  a?: number
  /** Cuando empieza, en segundos desde el principio de la voz. */
  en?: number
  dura: number
  fuerza: number
  onda?: OscillatorType
  /** Vibracion: [ciclos por segundo, cuanto mueve la frecuencia]. */
  vibrado?: [number, number]
  /** Filtro: [tipo, frecuencia, Q]. */
  filtro?: [BiquadFilterType, number, number?]
}

/** Un golpe de aire: polvo al caer, un latigazo, cascos, un roce de ropa. */
interface Roce {
  en?: number
  dura: number
  fuerza: number
  hz: number
  tipo?: BiquadFilterType
}

interface Receta {
  notas?: Nota[]
  roces?: Roce[]
}

/** Con el trazo mal la frase sale apagada; con el excelente, entera. */
const CALIDAD: Record<QualityId, number> = {
  mal: 0.7,
  medio: 0.8,
  bien: 0.88,
  perfecto: 0.94,
  excelente: 1,
}

/**
 * Lo que suena una frase. Es a proposito casi un susurro: tiene que notarse que la carta dice algo,
 * pero quedarse muy de fondo. Si un dia no se oye, este es el numero que se toca.
 */
const VOLUMEN_VOZ = 0.15

export const VOCES: Record<string, Receta> = {
  // ── Con frase grabada (esto es solo el apaño si falta el WAV) ─────────────
  /** El vaquero: el grito de carga. */
  vaquero: {
    roces: [{ fuerza: 0.06, dura: 0.05, hz: 2600, tipo: 'highpass' }],
    notas: [
      { de: 300, a: 720, dura: 0.16, fuerza: 0.16, filtro: ['lowpass', 1900] },
      { de: 780, a: 280, en: 0.17, dura: 0.36, fuerza: 0.15, vibrado: [7, 26], filtro: ['lowpass', 1700] },
    ],
  },
  /** La pistolera: silbido de piropo, que sube y vuelve a bajar. */
  pistolera: {
    notas: [
      { de: 900, a: 1500, dura: 0.13, fuerza: 0.1, onda: 'sine', vibrado: [12, 30] },
      { de: 1500, a: 1000, en: 0.14, dura: 0.2, fuerza: 0.09, onda: 'sine', vibrado: [10, 26] },
    ],
  },
  /** El minero: el pico contra la piedra y el polvo. */
  minero: {
    roces: [
      { fuerza: 0.12, en: 0.02, dura: 0.22, hz: 900 },
      { fuerza: 0.04, en: 0.1, dura: 0.3, hz: 1400 },
    ],
    notas: [
      { de: 950, dura: 0.13, fuerza: 0.09, onda: 'square' },
      { de: 1520, en: 0.005, dura: 0.09, fuerza: 0.06, onda: 'square' },
    ],
  },
  /** El cazador: el cerrojo del rifle. */
  cazador: {
    roces: [
      { fuerza: 0.09, dura: 0.04, hz: 4200, tipo: 'highpass' },
      { fuerza: 0.08, en: 0.09, dura: 0.05, hz: 3000, tipo: 'highpass' },
    ],
    notas: [{ de: 1400, a: 700, en: 0.16, dura: 0.18, fuerza: 0.06, onda: 'sine', vibrado: [9, 18] }],
  },
  /** El enterrador: campana de difuntos y una risa que baja desde la tumba. */
  enterrador: {
    notas: [
      { de: 180, dura: 1.2, fuerza: 0.12, onda: 'sine' },
      { de: 268, en: 0.005, dura: 0.9, fuerza: 0.07, onda: 'sine' },
      { de: 360, en: 0.01, dura: 0.6, fuerza: 0.05, onda: 'sine' },
      { de: 300, a: 240, en: 0.5, dura: 0.1, fuerza: 0.1, filtro: ['bandpass', 700, 4] },
      { de: 280, a: 220, en: 0.62, dura: 0.1, fuerza: 0.09, filtro: ['bandpass', 680, 4] },
      { de: 250, a: 190, en: 0.74, dura: 0.11, fuerza: 0.08, filtro: ['bandpass', 660, 4] },
      { de: 210, a: 150, en: 0.86, dura: 0.16, fuerza: 0.07, filtro: ['bandpass', 620, 4] },
    ],
  },
  /** La tormenta: el trueno y el chispazo que cae del cielo. */
  rayo: {
    roces: [
      { fuerza: 0.2, dura: 0.08, hz: 6000, tipo: 'highpass' },
      { fuerza: 0.26, en: 0.03, dura: 0.8, hz: 300 },
    ],
    notas: [
      { de: 90, a: 40, en: 0.02, dura: 0.7, fuerza: 0.18, onda: 'triangle' },
      { de: 1800, a: 300, dura: 0.12, fuerza: 0.08, onda: 'sawtooth' },
    ],
  },

  // ── Sin frase: cada una, su sonido ───────────────────────────────────────
  /** El sheriff: le tine la placa y suenan las espuelas al plantarse. */
  sheriff: {
    notas: [
      { de: 2150, dura: 0.16, fuerza: 0.06, onda: 'sine' },
      { de: 2850, en: 0.012, dura: 0.12, fuerza: 0.04, onda: 'sine' },
      { de: 3600, en: 0.16, dura: 0.04, fuerza: 0.035, onda: 'square' },
      { de: 4200, en: 0.2, dura: 0.04, fuerza: 0.03, onda: 'square' },
      { de: 3900, en: 0.25, dura: 0.04, fuerza: 0.025, onda: 'square' },
      { de: 4400, en: 0.29, dura: 0.04, fuerza: 0.02, onda: 'square' },
      { de: 105, a: 80, en: 0.02, dura: 0.14, fuerza: 0.1, filtro: ['lowpass', 500] },
    ],
  },
  /** El forajido: risa ronca por el filtro y un silbidito de despedida. */
  forajido: {
    roces: [{ fuerza: 0.05, en: 0.04, dura: 0.2, hz: 3000, tipo: 'highpass' }],
    notas: [
      { de: 240, a: 175, dura: 0.08, fuerza: 0.13, filtro: ['bandpass', 780, 5] },
      { de: 225, a: 165, en: 0.11, dura: 0.08, fuerza: 0.12, filtro: ['bandpass', 760, 5] },
      { de: 205, a: 150, en: 0.22, dura: 0.09, fuerza: 0.11, filtro: ['bandpass', 740, 5] },
      { de: 700, a: 500, en: 0.36, dura: 0.22, fuerza: 0.05, onda: 'sine', vibrado: [11, 20] },
    ],
  },
  /** El tahúr: baraja las cartas y tintinean las fichas. */
  tahur: {
    roces: [
      { fuerza: 0.11, dura: 0.24, hz: 5400, tipo: 'highpass' },
      { fuerza: 0.05, en: 0.26, dura: 0.1, hz: 2800, tipo: 'highpass' },
    ],
    notas: [
      { de: 2600, en: 0.3, dura: 0.1, fuerza: 0.045, onda: 'sine' },
      { de: 3300, en: 0.37, dura: 0.09, fuerza: 0.035, onda: 'sine' },
      { de: 3900, en: 0.44, dura: 0.08, fuerza: 0.025, onda: 'sine' },
    ],
  },
  /** El predicador: la campana y el órgano de la iglesia. */
  predicador: {
    notas: [
      { de: 520, dura: 1, fuerza: 0.09, onda: 'sine' },
      { de: 780, en: 0.005, dura: 0.8, fuerza: 0.055, onda: 'sine' },
      { de: 1040, en: 0.012, dura: 0.55, fuerza: 0.035, onda: 'sine' },
      { de: 110, en: 0.1, dura: 0.85, fuerza: 0.075, onda: 'sine', vibrado: [5, 2.5] },
      { de: 131, en: 0.1, dura: 0.85, fuerza: 0.06, onda: 'sine', vibrado: [5, 2.5] },
      { de: 165, en: 0.1, dura: 0.85, fuerza: 0.055, onda: 'sine', vibrado: [5, 2.5] },
    ],
  },
  /** El bandolero: una armónica quejumbrosa y dos rasgueos de guitarra. */
  bandolero: {
    notas: [
      { de: 440, a: 392, dura: 0.5, fuerza: 0.1, onda: 'square', vibrado: [6, 26], filtro: ['bandpass', 850, 3] },
      { de: 523, a: 466, en: 0.24, dura: 0.42, fuerza: 0.08, onda: 'square', vibrado: [6, 24], filtro: ['bandpass', 900, 3] },
      { de: 659, en: 0.62, dura: 0.16, fuerza: 0.09, onda: 'sawtooth', filtro: ['lowpass', 2400] },
      { de: 880, en: 0.74, dura: 0.26, fuerza: 0.09, onda: 'sawtooth', vibrado: [13, 8], filtro: ['lowpass', 2600] },
    ],
  },
  /** El rastreador: pisadas quedas y el grito de un águila. */
  rastreador: {
    roces: [
      { fuerza: 0.06, dura: 0.2, hz: 3600, tipo: 'highpass' },
      { fuerza: 0.08, en: 0.22, dura: 0.07, hz: 480 },
      { fuerza: 0.06, en: 0.36, dura: 0.07, hz: 460 },
    ],
    notas: [
      { de: 2400, a: 1700, en: 0.5, dura: 0.22, fuerza: 0.05, onda: 'sawtooth', vibrado: [18, 60], filtro: ['highpass', 1200] },
      { de: 2200, a: 1500, en: 0.78, dura: 0.2, fuerza: 0.04, onda: 'sawtooth', vibrado: [16, 55], filtro: ['highpass', 1200] },
    ],
  },
  /** El herrero: el yunque y el hierro templándose en el agua. */
  herrero: {
    notas: [
      { de: 700, dura: 0.75, fuerza: 0.08, onda: 'square' },
      { de: 1050, en: 0.004, dura: 0.55, fuerza: 0.055, onda: 'square' },
      { de: 1500, en: 0.008, dura: 0.38, fuerza: 0.035, onda: 'square' },
      { de: 2600, en: 0.02, dura: 0.3, fuerza: 0.02, onda: 'sine' },
    ],
    roces: [{ fuerza: 0.09, en: 0.06, dura: 0.45, hz: 4200, tipo: 'highpass' }],
  },
  /** El ranger: fanfarria de silbido y el resoplo del caballo. */
  ranger: {
    notas: [
      { de: 700, dura: 0.12, fuerza: 0.09, onda: 'sine' },
      { de: 900, en: 0.13, dura: 0.12, fuerza: 0.09, onda: 'sine' },
      { de: 1250, a: 1180, en: 0.27, dura: 0.42, fuerza: 0.1, onda: 'sine', vibrado: [9, 26] },
    ],
    roces: [{ fuerza: 0.1, en: 0.72, dura: 0.3, hz: 700, tipo: 'bandpass' }],
  },
  /** El cochero: el latigazo, los cascos y un relincho corto. */
  diligenciero: {
    roces: [
      { fuerza: 0.22, dura: 0.05, hz: 5200, tipo: 'highpass' },
      { fuerza: 0.1, en: 0.16, dura: 0.07, hz: 420 },
      { fuerza: 0.09, en: 0.3, dura: 0.07, hz: 400 },
      { fuerza: 0.08, en: 0.43, dura: 0.07, hz: 430 },
      { fuerza: 0.07, en: 0.56, dura: 0.07, hz: 410 },
    ],
    notas: [{ de: 1500, a: 1200, en: 0.08, dura: 0.2, fuerza: 0.05, onda: 'sine', vibrado: [10, 30] }],
  },
  /** La granada de humo: el psss de la nube que se abre. */
  humo: {
    roces: [
      { fuerza: 0.16, dura: 0.6, hz: 1400 },
      { fuerza: 0.09, en: 0.04, dura: 0.7, hz: 4200, tipo: 'highpass' },
      { fuerza: 0.1, en: 0.12, dura: 0.5, hz: 700 },
    ],
    notas: [{ de: 260, a: 80, dura: 0.5, fuerza: 0.06, filtro: ['lowpass', 900] }],
  },
  /** El túnel: el golpe de pala y el derrumbe que se traga la tierra. */
  tunel: {
    roces: [
      { fuerza: 0.12, dura: 0.09, hz: 1600 },
      { fuerza: 0.1, en: 0.1, dura: 0.7, hz: 260 },
    ],
    notas: [
      { de: 900, en: 0.005, dura: 0.12, fuerza: 0.06, onda: 'square' },
      { de: 380, a: 90, en: 0.1, dura: 0.5, fuerza: 0.1, filtro: ['lowpass', 800] },
    ],
  },
}

function tocaNota(ac: AudioContext, nota: Nota, escala: number) {
  const t0 = ac.currentTime + (nota.en ?? 0)
  const pico = nota.fuerza * escala
  if (pico <= MUDO) return
  const osc = ac.createOscillator()
  osc.type = nota.onda ?? 'sawtooth'
  osc.frequency.setValueAtTime(nota.de, t0)
  const fin = nota.a ?? nota.de
  if (fin !== nota.de) osc.frequency.exponentialRampToValueAtTime(Math.max(1, fin), t0 + nota.dura)
  if (nota.vibrado) {
    const lfo = ac.createOscillator()
    lfo.frequency.value = nota.vibrado[0]
    const cuanto = ac.createGain()
    cuanto.gain.value = nota.vibrado[1]
    lfo.connect(cuanto).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + nota.dura + 0.03)
  }
  let salida: AudioNode = osc
  if (nota.filtro) {
    const filtro = ac.createBiquadFilter()
    filtro.type = nota.filtro[0]
    filtro.frequency.value = nota.filtro[1]
    if (nota.filtro[2]) filtro.Q.value = nota.filtro[2]
    salida.connect(filtro)
    salida = filtro
  }
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(pico, t0 + Math.min(0.04, nota.dura * 0.4))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + nota.dura)
  salida.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + nota.dura + 0.03)
}

/* ---------------------------------------------------------------------------
   Las frases grabadas (public/sonidos/cartas/): se precargan al empezar la partida
   --------------------------------------------------------------------------- */

/** Un pelin de tono por carta, para que no suenen todas con la misma persona. */
const TONO: Record<string, number> = {
  enterrador: 0.88,
  sheriff: 0.96,
  minero: 1.02,
  pistolera: 1.05,
}

/** La ruta de la frase de una carta. */
export function rutaFrase(cardId: string): string {
  return `${import.meta.env.BASE_URL}sonidos/cartas/${cardId}.wav`
}

/** Deja listas todas las frases. Se llama al empezar la partida. */
export function precargarVoces(): Promise<unknown> {
  return precargarSonidos(Object.keys(VOCES).map(rutaFrase))
}

/**
 * Suena lo que le toca a una carta: su frase, y si no la tiene, su receta sintetizada.
 * `volumen` la apaga o la deja a pleno (el rival se oye mas bajo) y `calidad` la apaga un poco si
 * el trazo salio mal.
 */
export function vozDeCarta(cardId: string, opciones: { volumen?: number; calidad?: QualityId } = {}): void {
  const receta = VOCES[cardId]
  if (!receta) return
  const escala = VOLUMEN_VOZ * fuerza(opciones.volumen ?? 1) * CALIDAD[opciones.calidad ?? 'excelente']
  if (escala <= MUDO) return
  // Con ?manual en la direccion, desde la consola se ve la ultima que sono: __voz
  if (MANUAL) Object.assign(window, { __voz: cardId })
  const ac = audio()
  if (!ac) return
  try {
    const frase = sonido(rutaFrase(cardId))
    if (frase) {
      tocaSonido(frase, { ganancia: escala, tono: TONO[cardId] ?? 1 })
      return
    }
    for (const nota of receta.notas ?? []) tocaNota(ac, nota, escala)
    for (const roce of receta.roces ?? []) {
      ruido(ac, {
        fuerza: roce.fuerza * escala,
        dura: roce.dura,
        hz: roce.hz,
        tipo: roce.tipo,
        cuando: roce.en,
      })
    }
  } catch {
    // Sin audio disponible: el juego sigue igual.
  }
}

// Con ?manual en la direccion se pueden probar todos los sonidos desde la consola: __decirVoz('vaquero')
if (MANUAL) Object.assign(window, { __decirVoz: vozDeCarta })

/* ---------------------------------------------------------------------------
   El catalogo nuevo: cada carta trae su receta de apano para que ninguna se
   quede muda. Las que ya tienen la suya (las de arriba) no se tocan.
   --------------------------------------------------------------------------- */

const RECETAS_DE_APANO: Receta[] = [
  {
    notas: [{ de: 430, a: 300, dura: 0.2, fuerza: 0.12, filtro: ['bandpass', 800, 3] }],
    roces: [{ fuerza: 0.05, dura: 0.12, hz: 3000, tipo: 'highpass' }],
  },
  {
    notas: [
      { de: 265, a: 185, dura: 0.18, fuerza: 0.13, filtro: ['bandpass', 700, 4] },
      { de: 305, a: 240, en: 0.14, dura: 0.16, fuerza: 0.1, filtro: ['bandpass', 720, 4] },
    ],
  },
  {
    notas: [{ de: 880, a: 1450, dura: 0.14, fuerza: 0.08, onda: 'sine', vibrado: [10, 24] }],
  },
  {
    roces: [
      { fuerza: 0.14, dura: 0.1, hz: 1800 },
      { fuerza: 0.07, en: 0.12, dura: 0.4, hz: 4200, tipo: 'highpass' },
    ],
  },
]

let apano = 0
for (const carta of BUILTIN_CARDS) {
  if (VOCES[carta.id]) continue
  const base = RECETAS_DE_APANO[apano % RECETAS_DE_APANO.length]!
  // Cada carta con su tono y su aire: no hay dos que suenen exactamente igual.
  const tono = 0.8 + ((apano * 0.0091) % 0.5)
  const estira = 0.9 + ((apano * 0.0037) % 0.25)
  const notas = (base.notas ?? []).map((nota) => {
    const copia: Nota = { ...nota, de: nota.de * tono, dura: nota.dura * estira }
    if (nota.a) copia.a = nota.a * tono
    if (nota.en) copia.en = nota.en * estira
    return copia
  })
  const roces = (base.roces ?? []).map((roce) => {
    const copia: Roce = { ...roce, hz: roce.hz * tono, dura: roce.dura * estira }
    if (roce.en) copia.en = roce.en * estira
    return copia
  })
  // Solo lo que traia la receta: si no hay notas, no se pone una lista vacia.
  VOCES[carta.id] = {
    ...(notas.length > 0 ? { notas } : {}),
    ...(roces.length > 0 ? { roces } : {}),
  }
  apano += 1
}