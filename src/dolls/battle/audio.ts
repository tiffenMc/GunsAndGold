import { sfxVolume } from '../settings/volumes'

/**
 * Las piezas de sonido del juego: una sola mesa (AudioContext) para los efectos y las voces de
 * las cartas, y los ladrillos con los que se construyen (ruido y tonos). Todo se multiplica por
 * el volumen de los efectos que el jugador tenga puesto en los ajustes.
 */

let ctx: AudioContext | null = null

export function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** El volumen de los efectos, ya aplicado a una fuerza concreta. */
export function fuerza(gain: number): number {
  return gain * sfxVolume()
}

/** Silencio redondo: cuando el volumen esta a cero no se monta nada. */
export const MUDO = 0.001

/** Ruido que decae: el golpe seco de la polvora, una racha de aire, una pisada. */
export function ruido(
  ac: AudioContext,
  opciones: { fuerza: number; dura: number; hz: number; tipo?: BiquadFilterType; cuando?: number },
) {
  const frames = Math.max(1, Math.floor(ac.sampleRate * opciones.dura))
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = opciones.tipo ?? 'lowpass'
  filter.frequency.value = opciones.hz
  const g = ac.createGain()
  const t0 = ac.currentTime + (opciones.cuando ?? 0)
  g.gain.setValueAtTime(opciones.fuerza, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opciones.dura)
  src.connect(filter).connect(g).connect(ac.destination)
  src.start(t0)
}

/** Un tono que va de una frecuencia a otra. */
export function tono(
  ac: AudioContext,
  opciones: {
    de: number
    a?: number
    dura: number
    fuerza: number
    onda?: OscillatorType
    cuando?: number
  },
) {
  const osc = ac.createOscillator()
  osc.type = opciones.onda ?? 'sawtooth'
  const t0 = ac.currentTime + (opciones.cuando ?? 0)
  osc.frequency.setValueAtTime(opciones.de, t0)
  const fin = opciones.a ?? opciones.de
  if (fin !== opciones.de) osc.frequency.exponentialRampToValueAtTime(Math.max(1, fin), t0 + opciones.dura)
  const g = ac.createGain()
  g.gain.setValueAtTime(opciones.fuerza, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opciones.dura)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + opciones.dura + 0.02)
}
