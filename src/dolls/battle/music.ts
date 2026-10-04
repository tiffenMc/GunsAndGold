import { MANUAL } from '../debugClock'
import { musicVolume } from '../settings/volumes'

/**
 * La musica de la partida: la cancion que suena de fondo mientras dura el combate. Se lee de
 * `public/sonidos/partida.mp3`, va en bucle y entra bajita y subiendo sola, para que no de el
 * susto al empezar ni corte en seco al salir.
 *
 * El volumen se baja por una mesa de mezclas (Web Audio) y no con el volumen del propio audio:
 * asi se puede bajar de verdad en cualquier aparato (los iPhone se saltan el del elemento). Si la
 * mesa no arranca, se vuelve solo al volumen del audio, para no quedarse sin musica.
 *
 * El navegador solo deja sonar musica despues de un gesto del jugador (el toque que empieza la
 * partida); si lo bloquea, se queda esperando al primer toque o tecla y arranca sola.
 */

/** Lo que tarda en subir (o bajar) el volumen, en milisegundos. */
const FUNDIDO = 1400
/** Margen antes de parar del todo: asi un "otra partida" no corta la cancion. */
const ESPERA = 800
/** Lo que se espera a que arranque la mesa de mezclas antes de tirar por el volumen del audio. */
const PRUEBA_MESA = 2500
/** Lo que dura la prueba de la cancion al soltar la barra de los ajustes. */
const PRUEBA_MS = 2500

const RUTA = `${import.meta.env.BASE_URL}sonidos/partida.mp3`

let pista: HTMLAudioElement | null = null
let mesa: AudioContext | null = null
/** El mando del volumen. Si no hay mesa, se tira del volumen del propio audio. */
let mando: GainNode | null = null
/** Si la mesa no vale para este navegador, no se vuelve a intentar. */
let sinMesa = false
/** Cuantas pantallas estan pidiendo musica (la partida y poco mas). */
let usuarios = 0
/** Cada fundido nuevo invalida el anterior. */
let fundido = 0
let apagado: number | null = null
/** La prueba de los ajustes: el reloj que la apaga y cuantas pruebas hay pedidas. */
let prueba: number | null = null
let pruebas = 0

function elemento(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!pista) {
    pista = new Audio(RUTA)
    pista.loop = true
    pista.preload = 'auto'
    pista.volume = 0
  }
  return pista
}

/** Manda la cancion por la mesa de mezclas, para poder bajarla en cualquier aparato. */
function mezcladora(audio: HTMLAudioElement): GainNode | null {
  if (mando || sinMesa) return mando
  let ctx: AudioContext
  let ganancia: GainNode
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      sinMesa = true
      return null
    }
    ctx = new Ctor()
    ganancia = ctx.createGain()
    ganancia.gain.value = 0
    ctx.createMediaElementSource(audio).connect(ganancia).connect(ctx.destination)
  } catch {
    sinMesa = true
    return null
  }
  // A partir de aqui el audio sale por la mesa: el elemento se queda a tope y manda la ganancia.
  audio.volume = 1
  mesa = ctx
  mando = ganancia
  if (ctx.state === 'suspended') void ctx.resume()
  // Si el navegador no deja arrancar la mesa, se tira para atras y se usa el volumen del audio.
  window.setTimeout(() => {
    if (mesa !== ctx || ctx.state === 'running') return
    sinMesa = true
    mesa = null
    mando = null
    pista?.pause()
    pista = null
    arrancar()
  }, PRUEBA_MESA)
  return mando
}

function volumenActual(): number {
  if (mando) return mando.gain.value
  return pista?.volume ?? 0
}

function ponerVolumen(valor: number) {
  const v = Math.max(0, Math.min(1, valor))
  if (mando) mando.gain.value = v
  else if (pista) pista.volume = v
}

/** Sube o baja el volumen poco a poco, hasta `hasta`. */
function fundir(hasta: number, ms: number, fin?: () => void) {
  const id = ++fundido
  const desde = volumenActual()
  const t0 = performance.now()
  const paso = () => {
    if (id !== fundido) return
    const avance = Math.min(1, (performance.now() - t0) / ms)
    ponerVolumen(desde + (hasta - desde) * avance)
    if (avance < 1) requestAnimationFrame(paso)
    else fin?.()
  }
  requestAnimationFrame(paso)
}

/** Si el navegador la bloquea, se reintenta con el primer toque del jugador. */
function esperarGesto(audio: HTMLAudioElement) {
  const reintentar = () => {
    window.removeEventListener('pointerdown', reintentar)
    window.removeEventListener('keydown', reintentar)
    if (mesa?.state === 'suspended') void mesa.resume()
    void audio.play().catch(() => undefined)
  }
  window.addEventListener('pointerdown', reintentar)
  window.addEventListener('keydown', reintentar)
}

/** La mesa arranca con el primer gesto del jugador (si el navegador la dejo en pausa). */
function reanudarConGesto() {
  const reanudar = () => {
    window.removeEventListener('pointerdown', reanudar)
    window.removeEventListener('keydown', reanudar)
    if (mesa?.state === 'suspended') void mesa.resume()
  }
  window.addEventListener('pointerdown', reanudar)
  window.addEventListener('keydown', reanudar)
}

/** Pone la cancion a sonar (o la sigue, si ya estaba). */
function arrancar() {
  const audio = elemento()
  if (!audio) return
  mezcladora(audio)
  if (mesa?.state === 'suspended') {
    void mesa.resume()
    reanudarConGesto()
  }
  if (audio.paused) void audio.play().catch(() => esperarGesto(audio))
  fundir(musicVolume(), FUNDIDO)
  // Con ?manual en la direccion se mira desde la consola: __musica.paused, __volumen.gain.value…
  if (MANUAL) Object.assign(window, { __musica: audio, __volumen: mando, __mesa: mesa })
}

/** Empieza (o sigue) la musica de la partida. */
export function startMusic(): void {
  usuarios += 1
  if (apagado !== null) {
    clearTimeout(apagado)
    apagado = null
  }
  arrancar()
}

/**
 * Suena un trozo de la cancion con el volumen que acabas de poner en los ajustes, y se vuelve a
 * apagar solo. Si ya esta sonando (una partida), no la corta: solo se asegura del volumen.
 */
export function previewMusic(): void {
  pruebas += 1
  startMusic()
  if (prueba !== null) clearTimeout(prueba)
  prueba = window.setTimeout(() => {
    prueba = null
    // Se apagan todas las pruebas de golpe; la musica de una partida en marcha se queda.
    usuarios = Math.max(0, usuarios - pruebas)
    pruebas = 0
    if (usuarios === 0) apagar()
  }, PRUEBA_MS)
}

/** Baja el volumen hasta el silencio y para la pista. */
function apagar() {
  fundir(0, FUNDIDO, () => {
    if (usuarios > 0) return
    apagado = window.setTimeout(() => {
      apagado = null
      if (usuarios === 0) pista?.pause()
    }, ESPERA)
  })
}

/** La partida se ha acabado: se apaga sola. */
export function stopMusic(): void {
  usuarios = Math.max(0, usuarios - 1)
  if (usuarios > 0) return
  apagar()
}
