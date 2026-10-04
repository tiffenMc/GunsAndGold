import { audio } from './audio'

/**
 * Los sonidos grabados del juego: las frases de las cartas y los disparos de las armas. Se piden
 * una vez al empezar la partida, se decodifican y se quedan guardados, para que a la hora de
 * sonar no haya espera. Si alguno no esta (o el navegador no lo lee), se apunta como `null` y
 * quien lo pida tira de su version sintetizada.
 */

const cargando = new Map<string, Promise<AudioBuffer | null>>()
const listos = new Map<string, AudioBuffer | null>()

/** Pide (o reutiliza) un sonido. Devuelve `null` si no se pudo leer. */
export function cargarSonido(ruta: string): Promise<AudioBuffer | null> {
  const enMarcha = cargando.get(ruta)
  if (enMarcha) return enMarcha
  const promesa = (async () => {
    const ac = audio()
    if (!ac) return null
    try {
      const respuesta = await fetch(ruta)
      if (!respuesta.ok) throw new Error(`${respuesta.status}`)
      const buffer = await ac.decodeAudioData(await respuesta.arrayBuffer())
      listos.set(ruta, buffer)
      return buffer
    } catch {
      listos.set(ruta, null)
      return null
    }
  })()
  cargando.set(ruta, promesa)
  return promesa
}

/** Deja listas varias rutas de golpe. */
export function precargarSonidos(rutas: string[]): Promise<unknown> {
  return Promise.all(rutas.map((ruta) => cargarSonido(ruta)))
}

/** El sonido ya cargado, si lo esta. */
export function sonido(ruta: string): AudioBuffer | null {
  return listos.get(ruta) ?? null
}

/** Suena un sonido, por la mesa de mezclas (asi lo manda la barra de los efectos). */
export function tocaSonido(buffer: AudioBuffer, opciones: { ganancia: number; tono?: number }): void {
  if (opciones.ganancia <= 0.001) return
  const ac = audio()
  if (!ac) return
  const src = ac.createBufferSource()
  src.buffer = buffer
  src.playbackRate.value = opciones.tono ?? 1
  const g = ac.createGain()
  g.gain.value = opciones.ganancia
  src.connect(g).connect(ac.destination)
  src.start()
}
