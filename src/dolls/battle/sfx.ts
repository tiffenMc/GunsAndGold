import { MUDO, audio, fuerza, ruido, tono } from './audio'
import { precargarSonidos, sonido, tocaSonido } from './samples'
import { vozDeCarta } from './voices'
import type { QualityId } from '../cards/model'

/**
 * Sonidos sintetizados, sin ficheros: el disparo, el impacto y el estruendo se oyen al momento.
 * El navegador deja crearlos a partir del primer gesto del jugador (el propio disparo).
 * Todo sale con el volumen que el jugador tenga puesto en los ajustes.
 */

/** Ruido que decae: el golpe seco de la polvora. */
function burst(gain: number, duration: number, freq: number, type: BiquadFilterType = 'lowpass') {
  const ac = audio()
  const f = fuerza(gain)
  if (!ac || f <= MUDO) return
  try {
    ruido(ac, { fuerza: f, dura: duration, hz: freq, tipo: type })
  } catch {
    // Sin audio disponible: el juego sigue igual.
  }
}

/** Un tono corto que cae de frecuencia (el cuerpo del disparo). */
function tone(from: number, to: number, duration: number, gain: number, type: OscillatorType = 'sawtooth') {
  const ac = audio()
  const f = fuerza(gain)
  if (!ac || f <= MUDO) return
  try {
    tono(ac, { de: from, a: to, dura: duration, fuerza: f, onda: type })
  } catch {
    // Sin audio disponible: el juego sigue igual.
  }
}

/** Un tono con retraso: para encadenar notas (la ruleta, los avisos). */
function toneIn(from: number, to: number, duration: number, gain: number, delay: number, type: OscillatorType = 'square') {
  const ac = audio()
  const f = fuerza(gain)
  if (!ac || f <= MUDO) return
  try {
    tono(ac, { de: from, a: to, dura: duration, fuerza: f, onda: type, cuando: delay })
  } catch {
    // Sin audio disponible: el juego sigue igual.
  }
}

export const sfx = {
  /** El arma dispara. */
  shot() {
    burst(0.22, 0.16, 1800)
    tone(160, 60, 0.14, 0.12)
  },
  /** Un escudo menos. */
  hit() {
    burst(0.12, 0.07, 3200, 'highpass')
  },
  /** La tropa se rompe en piezas. */
  kill() {
    burst(0.16, 0.3, 900)
    tone(110, 40, 0.28, 0.08, 'triangle')
  },
  /** La dinamita revienta. */
  blast() {
    burst(0.26, 0.5, 500)
    tone(90, 30, 0.4, 0.13, 'triangle')
  },
  /** Golpe al fuerte. */
  fort() {
    tone(80, 42, 0.2, 0.18, 'sine')
  },
  /**
   * Entra una carta grande: un golpe grave de tambor y, encima, un acorde que sube. La epica suena
   * a trueno morado; la divina, a coro: acorde mayor que brilla y un barrido de aire.
   */
  invocar(rareza: 'especial' | 'epica' | 'divina') {
    if (rareza === 'especial') {
      toneIn(520, 880, 0.2, 0.05, 0, 'triangle')
      return
    }
    burst(rareza === 'divina' ? 0.3 : 0.24, 0.7, 380)
    tone(rareza === 'divina' ? 70 : 85, 28, 0.6, 0.16, 'sine')
    const notas = rareza === 'divina' ? [392, 494, 587, 784, 988] : [294, 370, 440]
    notas.forEach((hz, i) => toneIn(hz, hz * 1.01, rareza === 'divina' ? 0.9 : 0.55, rareza === 'divina' ? 0.05 : 0.06, 0.08 + i * 0.09, 'triangle'))
    if (rareza === 'divina') burst(0.1, 1.1, 5200, 'highpass')
  },
  /** Entra un arma nueva en la mano. */
  ready() {
    tone(420, 720, 0.12, 0.06, 'square')
  },
  /**
   * Una carta sale al campo: cada muñeco (y cada especial) suelta su frase. Con el trazo mal hecha
   * sale mas apagada y con el excelente, entera. Va muy bajita a proposito.
   */
  carta(cardId: string, calidad: QualityId = 'excelente', tuyo = true) {
    vozDeCarta(cardId, { calidad, volumen: tuyo ? 1 : 0.45 })
  },
}

/* ---------------------------------------------------------------------------
   Los disparos de las armas (public/sonidos/armas/): cada una tiene el suyo
   --------------------------------------------------------------------------- */

/** Las armas con disparo grabado en `public/sonidos/armas/`. Las demas tiran del sintetizado. */
export const ARMAS = ['revolver', 'escopeta', 'rifle', 'dinamita', 'bufalo', 'gatling']

/**
 * Lo que suena un disparo. Mas bajo que las frases (que son un detalle) pero sin pasarse: los
 * tiros son el sonido de la partida y se tienen que oir claros.
 */
const VOLUMEN_DISPARO = 0.45

function rutaDisparo(weaponId: string): string {
  return `${import.meta.env.BASE_URL}sonidos/armas/${weaponId}.wav`
}

/** Deja listos los disparos de las armas. Se llama al empezar la partida. */
export function precargarDisparos(): Promise<unknown> {
  return precargarSonidos(ARMAS.map(rutaDisparo))
}

/** Un arma dispara: el suyo si lo tiene, y si no el de siempre. */
export function disparo(weaponId: string, tuyo = true): void {
  const sample = sonido(rutaDisparo(weaponId))
  if (!sample) {
    sfx.shot()
    return
  }
  tocaSonido(sample, { ganancia: fuerza(VOLUMEN_DISPARO * (tuyo ? 1 : 0.45)) })
}

/* ---------------------------------------------------------------------------
   Los tiros de las tropas (public/sonidos/batalla/): la bala y su rebote
   --------------------------------------------------------------------------- */

/** Los sonidos sueltos de la batalla. */
export const BATALLA = ['bala', 'rebote']

/** Lo que suena la bala de una tropa. Flojo: son muchas por segundo y no pueden tapar nada. */
const VOLUMEN_BALA = 0.28
/** Dos balas mas seguidas que esto se comen: asi no se solapan cuando disparan cinco a la vez. */
const BALA_MIN_MS = 90

function rutaBatalla(nombre: string): string {
  return `${import.meta.env.BASE_URL}sonidos/batalla/${nombre}.wav`
}

/** Deja listos los sonidos de batalla. Se llama al empezar la partida. */
export function precargarBatalla(): Promise<unknown> {
  return precargarSonidos(BATALLA.map(rutaBatalla))
}

let ultimaBala = 0

/** Una tropa dispara: el ruido de la bala, con el tono variado para que no suenen clonadas. */
export function bala(tuyo = true): void {
  const ahora = performance.now()
  if (ahora - ultimaBala < BALA_MIN_MS) return
  ultimaBala = ahora
  const sample = sonido(rutaBatalla('bala'))
  if (!sample) {
    burst(VOLUMEN_BALA * (tuyo ? 1 : 0.5), 0.09, 2400, 'highpass')
    return
  }
  tocaSonido(sample, {
    ganancia: fuerza(VOLUMEN_BALA * (tuyo ? 1 : 0.5)),
    tono: 0.92 + Math.random() * 0.16,
  })
}

/** La bala rebota en algo duro (el escudo de la carreta, por ejemplo). */
export function rebote(): void {
  const sample = sonido(rutaBatalla('rebote'))
  if (!sample) return
  tocaSonido(sample, { ganancia: fuerza(0.32), tono: 0.95 + Math.random() * 0.1 })
}

/* ---------------------------------------------------------------------------
   La ruleta del dia y la noche del principio de la partida
   --------------------------------------------------------------------------- */

/** El tic de la ruleta girando. */
export function tic(): void {
  toneIn(1700, 1100, 0.05, 0.04, 0)
}

/** El trueno de la tormenta: un retumbo largo que rueda. */
export function trueno(): void {
  burst(0.26, 1.2, 240)
  tone(70, 32, 1.1, 0.14, 'triangle')
}

/** La ventisca: un soplido largo y agudo que silba. */
export function viento(): void {
  burst(0.16, 2.6, 2600, 'bandpass')
  burst(0.1, 2.2, 700)
  toneIn(900, 620, 1.6, 0.025, 0.2, 'sine')
}

/** El tsunami: primero el retumbo que se acerca y luego el rompiente. */
export function ola(rompe: boolean): void {
  if (!rompe) {
    tone(55, 38, 1.6, 0.16, 'sine')
    burst(0.12, 1.6, 300)
    return
  }
  burst(0.3, 2.4, 900)
  burst(0.14, 1.8, 4200, 'highpass')
  tone(70, 30, 1.2, 0.14, 'triangle')
}

/** Los murciélagos: chillidos agudos y rápidos. */
export function chillidos(): void {
  for (let i = 0; i < 7; i++) {
    const hz = 2600 + Math.random() * 1600
    toneIn(hz, hz * 1.25, 0.05, 0.03, i * 0.07 + Math.random() * 0.04, 'square')
  }
  burst(0.05, 0.6, 3800, 'highpass')
}

/** Un mordisco. */
export function mordisco(): void {
  burst(0.12, 0.08, 1600, 'bandpass')
  toneIn(1800, 900, 0.06, 0.03, 0, 'sawtooth')
}

/** El golpe seco de la rodadora o de la ola contra alguien. */
export function porrazo(): void {
  burst(0.18, 0.18, 700)
  tone(120, 50, 0.16, 0.1, 'triangle')
}

/** Se para la ruleta: si toca dia, tintineo alegre; si toca noche, un acorde grave. */
export function ruleta(salioNoche: boolean): void {
  if (salioNoche) {
    toneIn(240, 170, 0.6, 0.11, 0, 'triangle')
    toneIn(160, 110, 0.85, 0.09, 0.05, 'sine')
    burst(0.09, 0.5, 520)
    return
  }
  toneIn(700, 950, 0.13, 0.1, 0)
  toneIn(950, 1300, 0.26, 0.1, 0.14)
}
