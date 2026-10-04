/**
 * Prepara los sonidos grabados del juego a partir de los packs CC0 de `desacargas/`:
 *
 *   - Las FRASES que sueltan las cartas al entrar al campo (pack Voiceover de Kenney)
 *     → `public/sonidos/cartas/<carta>.wav`
 *   - Los DISPAROS de cada arma (packs de bangs y de Warfork)
 *     → `public/sonidos/armas/<arma>.wav`
 *
 * Se dejan en WAV a proposito: suena en cualquier navegador (los .ogg de los packs no los lee
 * Safari). Ademas se recorta el silencio de las puntas, se empareja el volumen, se acotan los
 * disparos largos (la metralleta) con un desvanecido y se pasa todo a mono.
 *
 *   npm install --no-save audio-decode
 *   node scripts/sonidos.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const descargas = join(raiz, 'desacargas')
const salida = join(raiz, 'public', 'sonidos')

/** Que linea del pack le toca a cada carta, y con que voz. */
const FRASES = {
  vaquero: ['Male', 'war_go_go_go'],
  sheriff: ['Male', 'hold'],
  forajido: ['Male', 'hurry_up'],
  pistolera: ['Female', 'go'],
  minero: ['Male', 'war_fire_in_the_hole'],
  cazador: ['Male', 'war_sniper'],
  tahur: ['Male', 'you_win'],
  predicador: ['Male', 'congratulations'],
  bandolero: ['Male', 'war_cover_me'],
  rastreador: ['Male', 'war_look_out'],
  herrero: ['Male', 'ready'],
  diligenciero: ['Male', 'war_watch_my_back'],
  enterrador: ['Male', 'game_over'],
  ranger: ['Male', 'final_round'],
  humo: ['Male', 'war_get_down'],
  rayo: ['Male', 'war_medic'],
  tunel: ['Male', 'go'],
}

/** Sonidos de la batalla: la bala de las tropas y el rebote en el escudo de la carreta. */
const BATALLA = {
  bala: ['cc0-disparos/shot_02.ogg', 0.4],
  rebote: ['cc0-disparos/war_ric1.ogg', 0.3],
}

/** El disparo de cada arma: [fichero en desacargas, segundos como mucho]. */
const DISPAROS = {
  revolver: ['cc0-disparos/shot_01.ogg', 0.45],
  escopeta: ['cc0-disparos/war_riotgun.ogg', 0.55],
  rifle: ['cc0-disparos/shot_03.ogg', 0.5],
  dinamita: ['cc0-disparos/war_grenlaunch.ogg', 0.5],
  bufalo: ['cc0-disparos/cannon_02.ogg', 0.8],
  gatling: ['cc0-disparos/war_machinegun.ogg', 0.5],
}

/** Mezcla los canales en uno. */
function aMono(canales) {
  if (canales.length === 1) return canales[0]
  const largo = canales[0].length
  const mono = new Float32Array(largo)
  for (let i = 0; i < largo; i++) {
    let suma = 0
    for (const canal of canales) suma += canal[i] ?? 0
    mono[i] = suma / canales.length
  }
  return mono
}

/** Quita el silencio de las puntas y deja un pelo de aire. */
function recortar(mono, sampleRate) {
  const umbral = 0.02
  const aire = Math.round(sampleRate * 0.01)
  let desde = 0
  let hasta = mono.length - 1
  while (desde < mono.length && Math.abs(mono[desde]) < umbral) desde++
  while (hasta > desde && Math.abs(mono[hasta]) < umbral) hasta--
  desde = Math.max(0, desde - aire)
  hasta = Math.min(mono.length - 1, hasta + aire)
  return mono.slice(desde, hasta + 1)
}

/** Deja el pico al mismo nivel en todos los sonidos. */
function emparejar(mono, pico = 0.9) {
  let maximo = 0
  for (const muestra of mono) maximo = Math.max(maximo, Math.abs(muestra))
  if (maximo < 0.0001) return mono
  const ganancia = pico / maximo
  const salida = new Float32Array(mono.length)
  for (let i = 0; i < mono.length; i++) salida[i] = mono[i] * ganancia
  return salida
}

/** Corta a `segundos` como mucho, con un desvanecido al final para que no chasquee. */
function acotar(mono, sampleRate, segundos) {
  const largo = Math.min(mono.length, Math.round(sampleRate * segundos))
  if (largo === mono.length) return mono
  const salida = mono.slice(0, largo)
  const fundido = Math.round(sampleRate * 0.06)
  for (let i = 0; i < fundido; i++) {
    const j = largo - fundido + i
    if (j >= 0) salida[j] *= 1 - i / fundido
  }
  return salida
}

/** Un WAV PCM de 16 bits, mono. */
function aWav(mono, sampleRate) {
  const datos = Buffer.alloc(mono.length * 2)
  for (let i = 0; i < mono.length; i++) {
    const muestra = Math.max(-1, Math.min(1, mono[i]))
    datos.writeInt16LE(Math.round(muestra * 32767), i * 2)
  }
  const cabecera = Buffer.alloc(44)
  cabecera.write('RIFF', 0)
  cabecera.writeUInt32LE(36 + datos.length, 4)
  cabecera.write('WAVE', 8)
  cabecera.write('fmt ', 12)
  cabecera.writeUInt32LE(16, 16)
  cabecera.writeUInt16LE(1, 20)
  cabecera.writeUInt16LE(1, 22)
  cabecera.writeUInt32LE(sampleRate, 24)
  cabecera.writeUInt32LE(sampleRate * 2, 28)
  cabecera.writeUInt16LE(2, 32)
  cabecera.writeUInt16LE(16, 34)
  cabecera.write('data', 36)
  cabecera.writeUInt32LE(datos.length, 40)
  return Buffer.concat([cabecera, datos])
}

const { default: decode } = await import('audio-decode')

/** Coge un fichero de los packs, lo limpia y deja el WAV en su sitio. */
async function cocinar(origen, destino, maximo) {
  const audio = await decode(await readFile(origen))
  let mono = emparejar(recortar(aMono(audio.channelData), audio.sampleRate))
  if (maximo) mono = acotar(mono, audio.sampleRate, maximo)
  await writeFile(destino, aWav(mono, audio.sampleRate))
  return (mono.length / audio.sampleRate).toFixed(2)
}

await mkdir(join(salida, 'cartas'), { recursive: true })
await mkdir(join(salida, 'armas'), { recursive: true })
await mkdir(join(salida, 'batalla'), { recursive: true })

console.log('Frases de las cartas:')
for (const [carta, [voz, linea]] of Object.entries(FRASES)) {
  const segundos = await cocinar(
    join(descargas, 'kenney_voiceoverpack', voz, `${linea}.ogg`),
    join(salida, 'cartas', `${carta}.wav`),
  )
  console.log(`  ${carta.padEnd(14)} ${`${voz}/${linea}`.padEnd(28)} ${segundos}s`)
}

console.log('\nDisparos de las armas:')
for (const [arma, [fichero, maximo]] of Object.entries(DISPAROS)) {
  const segundos = await cocinar(join(descargas, fichero), join(salida, 'armas', `${arma}.wav`), maximo)
  console.log(`  ${arma.padEnd(14)} ${fichero.padEnd(28)} ${segundos}s`)
}

console.log('\nSonidos de la batalla:')
for (const [nombre, [fichero, maximo]] of Object.entries(BATALLA)) {
  const segundos = await cocinar(join(descargas, fichero), join(salida, 'batalla', `${nombre}.wav`), maximo)
  console.log(`  ${nombre.padEnd(14)} ${fichero.padEnd(28)} ${segundos}s`)
}

console.log(`\nlisto: ${Object.keys(FRASES).length} frases, ${Object.keys(DISPAROS).length} disparos y ${Object.keys(BATALLA).length} sonidos de batalla`)
