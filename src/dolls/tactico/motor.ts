import { claseDe } from '../cards/model'
import type { BattleCard } from '../cards/model'
import { estiloDe } from '../battle/estilos'
import type { Estilo } from '../battle/estilos'

/**
 * **La batalla por turnos** (modo Pruebas): un tablero de casillas, a lo Warhammer. Cada jugador
 * mueve y pega por turnos, con tres acciones que reparte entre sus soldados. Aqui no hay nada
 * que dibujar: el motor solo sabe de casillas, vida, alcance y reglas; la pantalla lo lee.
 *
 *  - Despliegue: los dos colocan sus 4 soldados en sus dos filas de salida.
 *  - Un turno: 3 acciones (mover, atacar o usar la habilidad del estilo). Cada soldado, un
 *    movimiento y un ataque como mucho por turno. En vez de soldado, una accion puede sacar un
 *    refuerzo de la reserva (siempre con 4 vivos como mucho).
 *  - Cobertura (la mitad de daño), flanqueo (dos amigos pegados al blanco: +50 %), rocas que tapan la
 *    vista y los estilos de cada carta (area, rebote, perforante, empujon, cura…).
 *  - Gana quien tumba el fuerte rival, o quien tiene mas al acabar las 7 rondas.
 */

export const COLS = 7
export const FILAS = 9
export const PA_POR_TURNO = 3
export const RONDAS = 7
export const MAX_VIVOS = 4
export const FUERTE_HP = 11
/** Lo que se multiplica el daño contra un fuerte: sin esto no habria quien lo tumbara en siete rondas. */
export const DANO_AL_FUERTE = 1.6

export type Bando = 0 | 1
export type Terreno = 'llano' | 'roca' | 'cobertura'

export interface Mini {
  id: number
  bando: Bando
  card: BattleCard
  estilo: Estilo
  x: number
  y: number
  hp: number
  maxHp: number
  /** Casillas que anda por turno y a cuantas casillas llega su ataque (1 = cuerpo a cuerpo). */
  mov: number
  alcance: number
  movido: boolean
  actuado: boolean
  /** Va frenado (anda 2 menos) o aturdido (no ataca) en su proximo turno. */
  frenado: boolean
  sinAtacar: boolean
  /** Escondido (sigilo): solo se le puede atacar si hay alguien a 2 casillas o menos. */
  escondido: boolean
  /** Hasta que ronda esta marcado por un indio. */
  marcaHasta: number
  golpes: number
  vivo: boolean
}

export interface Fuerte {
  bando: Bando
  x: number
  y: number
  hp: number
  maxHp: number
}

/** Fuego, gas o cepos en el suelo: dañan o frenan a los del bando contrario que acaban el turno dentro. */
export interface Campo {
  x: number
  y: number
  radio: number
  bando: Bando
  rondas: number
  dano: number
  frena: boolean
}

export type Evento =
  | { t: 'mover'; id: number; ruta: { x: number; y: number }[] }
  | { t: 'ataque'; de: number; x: number; y: number; dano: number; tipo: 'golpe' | 'flecha' | 'explosion' | 'cura' }
  | { t: 'dano'; x: number; y: number; fuerte: boolean; muere: boolean }
  | { t: 'muerte'; id: number; x: number; y: number }
  | { t: 'despliegue'; id: number }
  | { t: 'empuje'; id: number; x: number; y: number }
  | { t: 'turno'; bando: Bando; ronda: number }
  | { t: 'fin' }

export interface Resultado {
  ganador: Bando
  por: 'fuerte' | 'aniquilacion' | 'puntos'
}

export interface Tactico {
  ronda: number
  turno: Bando
  pa: number
  fase: 'despliegue' | 'juego' | 'fin'
  terreno: Terreno[][]
  minis: Mini[]
  /** Las cartas que cada bando aun no ha sacado. */
  mano: [BattleCard[], BattleCard[]]
  fuertes: [Fuerte, Fuerte]
  campos: Campo[]
  eventos: Evento[]
  resultado: Resultado | null
  rand: () => number
  sigId: number
}

// ---------------------------------------------------------------------------
// Utiles
// ---------------------------------------------------------------------------

function mulberry(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const otro = (bando: Bando): Bando => (bando === 0 ? 1 : 0)

/** Distancia en casillas: las diagonales cuentan como una. */
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by))
}

/** Las filas de salida de cada bando (tu abajo, el rival arriba). */
export function zonaDe(bando: Bando): number[] {
  return bando === 0 ? [FILAS - 2, FILAS - 1] : [0, 1]
}

export function posFuerte(bando: Bando): { x: number; y: number } {
  return { x: Math.floor(COLS / 2), y: bando === 0 ? FILAS - 1 : 0 }
}

/** Cuantas casillas anda una carta por turno: los rapidos mas, los tanques menos. */
export function movDe(card: BattleCard): number {
  return Math.max(2, Math.min(5, Math.round(1 + card.speed * 2)))
}

/** A cuantas casillas llega su ataque: cuerpo a cuerpo, 1; el resto, segun su alcance (los vaqueros, uno mas). */
export function alcanceDe(card: BattleCard): number {
  const estilo = estiloDe(card)
  if (estilo.cuerpo !== undefined) return 1
  const base = Math.max(2, Math.min(6, Math.round(card.range / 1.5)))
  return claseDe(card) === 'vaqueros' ? base + 1 : base
}

export function minisDe(t: Tactico, bando: Bando): Mini[] {
  return t.minis.filter((m) => m.vivo && m.bando === bando)
}

export function vivos(t: Tactico, bando: Bando): number {
  return minisDe(t, bando).length
}

export function miniEn(t: Tactico, x: number, y: number): Mini | undefined {
  return t.minis.find((m) => m.vivo && m.x === x && m.y === y)
}

export function fuerteEn(t: Tactico, x: number, y: number): Fuerte | undefined {
  return t.fuertes.find((f) => f.x === x && f.y === y)
}

function dentro(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < FILAS
}

/** ¿Se puede pisar esa casilla? (ni roca, ni fuerte, ni otro soldado). */
function libre(t: Tactico, x: number, y: number): boolean {
  return dentro(x, y) && t.terreno[y]![x] !== 'roca' && !miniEn(t, x, y) && !fuerteEn(t, x, y)
}

/** Las casillas que hay entre dos puntos (sin contar las puntas), por el metodo de la recta. */
function entre(ax: number, ay: number, bx: number, by: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
  for (let i = 1; i < n; i++) {
    out.push({ x: Math.round(ax + ((bx - ax) * i) / n), y: Math.round(ay + ((by - ay) * i) / n) })
  }
  return out
}

/** ¿Hay vista libre entre dos casillas? Las rocas la tapan. */
export function lineaLibre(t: Tactico, ax: number, ay: number, bx: number, by: number): boolean {
  return entre(ax, ay, bx, by).every((c) => t.terreno[c.y]![c.x] !== 'roca')
}

// ---------------------------------------------------------------------------
// Crear la partida
// ---------------------------------------------------------------------------

/** Un tablero con rocas y coberturas repartidas igual para los dos lados. */
function hacerTerreno(rand: () => number): Terreno[][] {
  const terreno: Terreno[][] = Array.from({ length: FILAS }, () => Array.from({ length: COLS }, () => 'llano' as Terreno))
  const poner = (x: number, y: number, tipo: Terreno) => {
    if (terreno[y]![x] !== 'llano') return false
    terreno[y]![x] = tipo
    terreno[FILAS - 1 - y]![COLS - 1 - x] = tipo
    return true
  }
  // Rocas: solo en la parte de en medio, y no mas de dos por fila para no tapar el paso.
  let rocas = 0
  for (let intento = 0; intento < 40 && rocas < 3; intento++) {
    const x = 1 + Math.floor(rand() * (COLS - 2))
    const y = 3 + Math.floor(rand() * 2)
    if (terreno[y]!.filter((c) => c === 'roca').length >= 1) continue
    if (poner(x, y, 'roca')) rocas++
  }
  // Coberturas: matojos, barricadas y barriles por todo el campo menos las filas de salida.
  let coberturas = 0
  for (let intento = 0; intento < 80 && coberturas < 7; intento++) {
    const x = Math.floor(rand() * COLS)
    const y = 2 + Math.floor(rand() * (FILAS - 4))
    if (poner(x, y, 'cobertura')) coberturas++
  }
  return terreno
}

export function crearTactico(mazoA: BattleCard[], mazoB: BattleCard[], semilla = Math.floor(Math.random() * 1e9)): Tactico {
  const rand = mulberry(semilla)
  const baraja = (mazo: BattleCard[]) => {
    const copia = [...mazo]
    for (let i = copia.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[copia[i], copia[j]] = [copia[j]!, copia[i]!]
    }
    return copia.slice(0, 8)
  }
  const f0 = posFuerte(0)
  const f1 = posFuerte(1)
  return {
    ronda: 0,
    turno: 0,
    pa: 0,
    fase: 'despliegue',
    terreno: hacerTerreno(rand),
    minis: [],
    mano: [baraja(mazoA), baraja(mazoB)],
    fuertes: [
      { bando: 0, ...f0, hp: FUERTE_HP, maxHp: FUERTE_HP },
      { bando: 1, ...f1, hp: FUERTE_HP, maxHp: FUERTE_HP },
    ],
    campos: [],
    eventos: [],
    resultado: null,
    rand,
    sigId: 1,
  }
}

function nuevaMini(t: Tactico, bando: Bando, card: BattleCard, x: number, y: number): Mini {
  const estilo = estiloDe(card)
  return {
    id: t.sigId++,
    bando,
    card,
    estilo,
    x,
    y,
    hp: card.shields,
    maxHp: card.shields,
    mov: movDe(card),
    alcance: alcanceDe(card),
    movido: false,
    actuado: false,
    frenado: false,
    sinAtacar: false,
    escondido: Boolean(estilo.sigilo),
    marcaHasta: 0,
    golpes: 0,
    vivo: true,
  }
}

/** Las casillas de salida libres de un bando. */
export function casillasDeSalida(t: Tactico, bando: Bando): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (const y of zonaDe(bando)) for (let x = 0; x < COLS; x++) if (libre(t, x, y) ) out.push({ x, y })
  return out
}

/**
 * Pone una carta de la reserva en el tablero. En el despliegue es gratis (hasta 4); durante la
 * partida cuesta una accion y solo en tu turno, con menos de 4 vivos.
 */
export function desplegar(t: Tactico, bando: Bando, cardId: string, x: number, y: number): Mini | null {
  if (t.resultado) return null
  const indice = t.mano[bando].findIndex((c) => c.id === cardId)
  if (indice < 0) return null
  if (vivos(t, bando) >= MAX_VIVOS) return null
  if (!zonaDe(bando).includes(y) || !libre(t, x, y)) return null
  if (t.fase === 'juego') {
    if (t.turno !== bando || t.pa < 1) return null
    t.pa -= 1
  } else if (t.fase !== 'despliegue') return null
  const [card] = t.mano[bando].splice(indice, 1)
  const mini = nuevaMini(t, bando, card!, x, y)
  // Un refuerzo llega con el turno gastado.
  if (t.fase === 'juego') {
    mini.movido = true
    mini.actuado = true
  }
  t.minis.push(mini)
  t.eventos.push({ t: 'despliegue', id: mini.id })
  return mini
}

/** Cuando los dos han colocado a sus soldados, empieza la partida: primero tu. */
export function empezarPartida(t: Tactico): void {
  t.fase = 'juego'
  t.ronda = 1
  empezarTurno(t, 0)
}

// ---------------------------------------------------------------------------
// Moverse
// ---------------------------------------------------------------------------

function bonoAura(t: Tactico, m: Mini): { vel: number; cad: number } {
  let vel = 0
  let cad = 0
  for (const a of minisDe(t, m.bando)) {
    if (a === m || !a.estilo.aura) continue
    if (dist(a.x, a.y, m.x, m.y) > 2) continue
    if (a.estilo.aura.vel) vel = 1
    if (a.estilo.aura.cadencia) cad = 0.25
  }
  return { vel, cad }
}

export function movEfectivo(t: Tactico, m: Mini): number {
  return Math.max(1, m.mov - (m.frenado ? 2 : 0) + bonoAura(t, m).vel)
}

/** Las casillas a las que llega andando: cada paso (diagonal incluido) cuesta uno. */
export function alcanzables(t: Tactico, m: Mini): Map<string, { x: number; y: number; pasos: number; de: string | null }> {
  const mapa = new Map<string, { x: number; y: number; pasos: number; de: string | null }>()
  const llave = (x: number, y: number) => `${x},${y}`
  mapa.set(llave(m.x, m.y), { x: m.x, y: m.y, pasos: 0, de: null })
  const cola: { x: number; y: number; pasos: number }[] = [{ x: m.x, y: m.y, pasos: 0 }]
  const tope = movEfectivo(t, m)
  while (cola.length > 0) {
    const actual = cola.shift()!
    if (actual.pasos >= tope) continue
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        const nx = actual.x + dx
        const ny = actual.y + dy
        if (mapa.has(llave(nx, ny)) || !libre(t, nx, ny)) continue
        mapa.set(llave(nx, ny), { x: nx, y: ny, pasos: actual.pasos + 1, de: llave(actual.x, actual.y) })
        cola.push({ x: nx, y: ny, pasos: actual.pasos + 1 })
      }
    }
  }
  mapa.delete(llave(m.x, m.y))
  return mapa
}

export function puedeMover(t: Tactico, m: Mini): boolean {
  return !t.resultado && t.fase === 'juego' && t.turno === m.bando && t.pa >= 1 && m.vivo && !m.movido
}

export function mover(t: Tactico, m: Mini, x: number, y: number): boolean {
  if (!puedeMover(t, m)) return false
  const mapa = alcanzables(t, m)
  const meta = mapa.get(`${x},${y}`)
  if (!meta) return false
  const ruta: { x: number; y: number }[] = []
  let llave: string | null = `${x},${y}`
  while (llave) {
    const paso = mapa.get(llave)
    if (!paso) break
    ruta.unshift({ x: paso.x, y: paso.y })
    llave = paso.de
  }
  t.pa -= 1
  m.movido = true
  m.x = x
  m.y = y
  // El sigilo se vuelve a esconder al moverse sin atacar.
  if (m.estilo.sigilo && !m.actuado) m.escondido = true
  t.eventos.push({ t: 'mover', id: m.id, ruta: [{ x: ruta[0]?.x ?? x, y: ruta[0]?.y ?? y }, ...ruta].slice(0) })
  return true
}

// ---------------------------------------------------------------------------
// Atacar
// ---------------------------------------------------------------------------

export interface Objetivo {
  tipo: 'mini' | 'fuerte'
  x: number
  y: number
  id?: number
  bando: Bando
  /** El daño que haria ahora mismo (para que el bot y la pantalla lo vean). */
  dano: number
}

/** El golpe base de un soldado, con furia y apoyos (sin cobertura ni flanqueo). */
function golpeBase(t: Tactico, m: Mini, azar: boolean): number {
  const e = m.estilo
  let golpe = e.golpe ?? 1
  if (e.azar) golpe = azar ? 0.5 + t.rand() * 2.5 : 1.5
  if (e.furia) golpe += e.furia * (1 - m.hp / m.maxHp)
  const disparos = Math.min(e.disparos ?? 1, 40)
  let total = Math.max(0.5, Math.min(5, golpe * disparos))
  total *= 1 + bonoAura(t, m).cad
  return Math.round(total * 100) / 100
}

function danoContra(t: Tactico, m: Mini, objetivo: Mini, azar = false): number {
  let d = golpeBase(t, m, azar)
  // Cobertura: de lejos, la mitad.
  if (t.terreno[objetivo.y]![objetivo.x] === 'cobertura' && dist(m.x, m.y, objetivo.x, objetivo.y) > 1) d *= 0.5
  // Flanqueo: dos amigos pegados al blanco.
  const pegados = minisDe(t, m.bando).filter((a) => dist(a.x, a.y, objetivo.x, objetivo.y) <= 1).length
  if (pegados >= 2) d *= 1.5
  // La presa marcada por un indio recibe un cuarto mas de todos los indios.
  if (claseDe(m.card) === 'indios' && objetivo.marcaHasta >= t.ronda) d *= 1.25
  return Math.round(d * 100) / 100
}

/** ¿Puede ver este soldado al objetivo? (alcance, rocas y sigilo) */
function veAlcance(t: Tactico, m: Mini, x: number, y: number): boolean {
  const d = dist(m.x, m.y, x, y)
  return d >= 1 && d <= m.alcance && lineaLibre(t, m.x, m.y, x, y)
}

export function objetivos(t: Tactico, m: Mini): Objetivo[] {
  const lista: Objetivo[] = []
  if (!m.vivo || m.estilo.pacifico) return lista
  const rival = otro(m.bando)
  for (const e of minisDe(t, rival)) {
    if (!veAlcance(t, m, e.x, e.y)) continue
    // Un soldado escondido solo se ve desde muy cerca.
    if (e.escondido && dist(m.x, m.y, e.x, e.y) > 2) continue
    lista.push({ tipo: 'mini', x: e.x, y: e.y, id: e.id, bando: rival, dano: danoContra(t, m, e) })
  }
  const f = t.fuertes[rival]
  if (f.hp > 0 && veAlcance(t, m, f.x, f.y)) {
    lista.push({ tipo: 'fuerte', x: f.x, y: f.y, bando: rival, dano: Math.round(golpeBase(t, m, false) * DANO_AL_FUERTE * 100) / 100 })
  }
  // Los cebos atraen todos los golpes de los que los tienen a tiro.
  const cebos = lista.filter((o) => {
    if (o.tipo !== 'mini') return false
    const e = t.minis.find((x) => x.id === o.id)
    return Boolean(e?.estilo.provoca && dist(m.x, m.y, e.x, e.y) <= Math.max(2, Math.round(e.estilo.provoca / 1.6)))
  })
  return cebos.length > 0 ? cebos : lista
}

export function puedeAtacar(t: Tactico, m: Mini): boolean {
  return !t.resultado && t.fase === 'juego' && t.turno === m.bando && t.pa >= 1 && m.vivo && !m.actuado && !m.sinAtacar && !m.estilo.pacifico
}

function terminarSiHaceFalta(t: Tactico): void {
  if (t.resultado) return
  for (const bando of [0, 1] as Bando[]) {
    if (t.fuertes[bando].hp <= 0) return ganar(t, otro(bando), 'fuerte')
  }
  for (const bando of [0, 1] as Bando[]) {
    if (t.fase === 'juego' && vivos(t, bando) === 0 && t.mano[bando].length === 0) return ganar(t, otro(bando), 'aniquilacion')
  }
}

function ganar(t: Tactico, ganador: Bando, por: Resultado['por']): void {
  t.resultado = { ganador, por }
  t.fase = 'fin'
  t.eventos.push({ t: 'fin' })
}

function matar(t: Tactico, m: Mini): void {
  if (!m.vivo) return
  m.vivo = false
  t.eventos.push({ t: 'muerte', id: m.id, x: m.x, y: m.y })
  // Los barriles y kamikazes reventan al caer.
  if (m.estilo.explota) {
    const radio = Math.max(1, Math.round(m.estilo.explota / 1.6))
    t.eventos.push({ t: 'ataque', de: m.id, x: m.x, y: m.y, dano: 2, tipo: 'explosion' })
    for (const e of minisDe(t, otro(m.bando))) if (dist(e.x, e.y, m.x, m.y) <= radio) daniar(t, e, 2, m.bando)
  }
}

/** Resta vida a un soldado (con el blindaje que lo salva de algun golpe). */
function daniar(t: Tactico, e: Mini, cantidad: number, _origen: Bando): void {
  if (!e.vivo || cantidad <= 0) return
  e.golpes += 1
  if (e.estilo.blindaje && e.golpes % e.estilo.blindaje === 0) return
  e.hp = Math.max(0, e.hp - cantidad)
  const muere = e.hp <= 0
  t.eventos.push({ t: 'dano', x: e.x, y: e.y, fuerte: false, muere })
  if (muere) matar(t, e)
}

function danarFuerte(t: Tactico, bando: Bando, cantidad: number): void {
  const f = t.fuertes[bando]
  f.hp = Math.max(0, f.hp - cantidad)
  t.eventos.push({ t: 'dano', x: f.x, y: f.y, fuerte: true, muere: f.hp <= 0 })
}

function empujar(t: Tactico, atacante: Mini, e: Mini, casillas: number): void {
  const sx = Math.sign(e.x - atacante.x) * Math.sign(casillas)
  const sy = Math.sign(e.y - atacante.y) * Math.sign(casillas)
  for (let i = 0; i < Math.abs(casillas); i++) {
    const nx = e.x + sx
    const ny = e.y + sy
    if (!libre(t, nx, ny) || (nx === atacante.x && ny === atacante.y)) break
    e.x = nx
    e.y = ny
  }
  t.eventos.push({ t: 'empuje', id: e.id, x: e.x, y: e.y })
}

export function atacar(t: Tactico, m: Mini, objetivo: Objetivo): boolean {
  if (!puedeAtacar(t, m)) return false
  const valido = objetivos(t, m).some((o) => o.tipo === objetivo.tipo && o.x === objetivo.x && o.y === objetivo.y)
  if (!valido) return false
  t.pa -= 1
  m.actuado = true
  m.escondido = false
  const e = m.estilo
  const tipo: 'golpe' | 'flecha' | 'explosion' = e.area || e.suicida ? 'explosion' : e.cuerpo !== undefined ? 'golpe' : 'flecha'

  if (objetivo.tipo === 'fuerte') {
    const dano = Math.round(golpeBase(t, m, true) * DANO_AL_FUERTE * 100) / 100
    t.eventos.push({ t: 'ataque', de: m.id, x: objetivo.x, y: objetivo.y, dano, tipo })
    danarFuerte(t, objetivo.bando, dano)
    if (e.suicida) matar(t, m)
    terminarSiHaceFalta(t)
    return true
  }

  const blanco = t.minis.find((x) => x.id === objetivo.id)
  if (!blanco || !blanco.vivo) return false
  const dano = danoContra(t, m, blanco, true)
  t.eventos.push({ t: 'ataque', de: m.id, x: blanco.x, y: blanco.y, dano, tipo })
  const golpeados = new Set<number>([blanco.id])
  daniar(t, blanco, dano, m.bando)

  // La minigun reparte su rafaga entre varios rivales a tiro.
  if (e.reapunta) {
    const cerca = objetivos(t, m).filter((o) => o.tipo === 'mini' && o.id !== undefined && !golpeados.has(o.id))
    for (const o of cerca.slice(0, 2)) {
      const x = t.minis.find((a) => a.id === o.id)
      if (x) {
        golpeados.add(x.id)
        daniar(t, x, dano * 0.6, m.bando)
      }
    }
  }
  // Area: lo que hay cerca del blanco se lleva parte.
  if (e.area) {
    const radio = Math.max(1, Math.round(e.area / 1.6))
    for (const x of minisDe(t, otro(m.bando))) {
      if (golpeados.has(x.id) || dist(x.x, x.y, blanco.x, blanco.y) > radio) continue
      golpeados.add(x.id)
      daniar(t, x, dano * 0.6, m.bando)
    }
  }
  // Perforante: sigue por la misma linea, dos casillas mas alla.
  if (e.perfora) {
    const dx = Math.sign(blanco.x - m.x)
    const dy = Math.sign(blanco.y - m.y)
    for (let i = 1; i <= 2; i++) {
      const x = miniEn(t, blanco.x + dx * i, blanco.y + dy * i)
      if (x && x.bando !== m.bando && !golpeados.has(x.id)) {
        golpeados.add(x.id)
        daniar(t, x, dano * 0.8, m.bando)
      }
    }
  }
  // Rebote: salta al siguiente enemigo cercano.
  if (e.rebota) {
    let desde = blanco
    for (let i = 0; i < e.rebota; i++) {
      const sig = minisDe(t, otro(m.bando))
        .filter((x) => !golpeados.has(x.id) && dist(x.x, x.y, desde.x, desde.y) <= 2)
        .sort((a, b) => dist(a.x, a.y, desde.x, desde.y) - dist(b.x, b.y, desde.x, desde.y))[0]
      if (!sig) break
      golpeados.add(sig.id)
      daniar(t, sig, dano * 0.7, m.bando)
      desde = sig
    }
  }
  // Efectos sobre los que han recibido: frenar, aturdir, marcar, empujar.
  for (const id of golpeados) {
    const x = t.minis.find((a) => a.id === id)
    if (!x || !x.vivo) continue
    if (e.ralentiza) x.frenado = true
    if (e.aturde) x.sinAtacar = true
    if (claseDe(m.card) === 'indios') x.marcaHasta = t.ronda + 1
  }
  if (e.empuja && blanco.vivo) empujar(t, m, blanco, Math.max(-2, Math.min(2, Math.round(e.empuja / 1.4))))
  // Campo: fuego, gas o cepos en el suelo.
  if (e.campo) {
    t.campos.push({
      x: blanco.x,
      y: blanco.y,
      radio: Math.max(1, Math.round(e.campo.radio / 1.6)),
      bando: m.bando,
      rondas: 2,
      dano: e.campo.golpe * 2,
      frena: Boolean(e.campo.ralentiza),
    })
  }
  if (e.suicida) matar(t, m)
  terminarSiHaceFalta(t)
  return true
}

// ---------------------------------------------------------------------------
// Habilidad (curar, sermones…)
// ---------------------------------------------------------------------------

export function tieneHabilidad(m: Mini): boolean {
  return Boolean(m.estilo.pulso)
}

export function puedeHabilidad(t: Tactico, m: Mini): boolean {
  return tieneHabilidad(m) && !t.resultado && t.fase === 'juego' && t.turno === m.bando && t.pa >= 1 && m.vivo && !m.actuado
}

export function habilidad(t: Tactico, m: Mini): boolean {
  if (!puedeHabilidad(t, m)) return false
  const p = m.estilo.pulso!
  t.pa -= 1
  m.actuado = true
  t.eventos.push({ t: 'ataque', de: m.id, x: m.x, y: m.y, dano: 0, tipo: 'cura' })
  for (const a of minisDe(t, m.bando)) {
    if (a === m || dist(a.x, a.y, m.x, m.y) > 3 || !p.cura) continue
    const tope = p.sobreEscudo ? a.maxHp + 2 : a.maxHp
    a.hp = Math.min(tope, a.hp + p.cura * 2)
  }
  for (const e of minisDe(t, otro(m.bando))) {
    if (dist(e.x, e.y, m.x, m.y) > 3) continue
    if (p.ralentiza) e.frenado = true
    if (p.aturde) e.sinAtacar = true
  }
  return true
}

// ---------------------------------------------------------------------------
// Turnos
// ---------------------------------------------------------------------------

function empezarTurno(t: Tactico, bando: Bando): void {
  t.turno = bando
  // Quien abre la partida sale con una accion menos: si no, tendria demasiada ventaja.
  t.pa = t.ronda === 1 && bando === 0 ? PA_POR_TURNO - 1 : PA_POR_TURNO
  for (const m of minisDe(t, bando)) {
    m.movido = false
    m.actuado = false
  }
  // El fuego y el gas queman a los que empiezan su turno encima.
  for (const c of t.campos) {
    if (c.bando === bando) continue
    for (const m of minisDe(t, bando)) {
      if (dist(m.x, m.y, c.x, c.y) > c.radio) continue
      if (c.dano > 0) daniar(t, m, c.dano, c.bando)
      if (c.frena) m.frenado = true
    }
  }
  t.eventos.push({ t: 'turno', bando, ronda: t.ronda })
  terminarSiHaceFalta(t)
}

export function terminarTurno(t: Tactico): void {
  if (t.fase !== 'juego') return
  const quien = t.turno
  // Lo que le hicieron para su turno ya lo ha sufrido: se acaba.
  for (const m of minisDe(t, quien)) {
    m.frenado = false
    m.sinAtacar = false
  }
  if (quien === 1) {
    // Cierra la ronda: el fuego se gasta un poco.
    t.campos = t.campos.map((c) => ({ ...c, rondas: c.rondas - 1 })).filter((c) => c.rondas > 0)
    if (t.ronda >= RONDAS) return alFinalDeLasRondas(t)
    t.ronda += 1
  }
  empezarTurno(t, otro(quien))
}

/** Se acabaron las rondas: gana el que tenga mas fuerte, y si no, mas soldados con mas vida. */
function alFinalDeLasRondas(t: Tactico): void {
  const vidaFuerte = (b: Bando) => t.fuertes[b].hp / t.fuertes[b].maxHp
  const vidaEjercito = (b: Bando) => minisDe(t, b).reduce((s, m) => s + m.hp, 0)
  const a = vidaFuerte(0)
  const b = vidaFuerte(1)
  if (Math.abs(a - b) > 0.001) return ganar(t, a > b ? 0 : 1, 'puntos')
  ganar(t, vidaEjercito(0) >= vidaEjercito(1) ? 0 : 1, 'puntos')
}

// ---------------------------------------------------------------------------
// El bot: una accion cada vez, para que la pantalla pueda ir enseñandolas
// ---------------------------------------------------------------------------

function mejorSalida(t: Tactico, bando: Bando): { x: number; y: number } | null {
  const libres = casillasDeSalida(t, bando)
  if (libres.length === 0) return null
  // Prefiere la fila de delante y el centro.
  const delante = bando === 0 ? Math.min(...zonaDe(0)) : Math.max(...zonaDe(1))
  return [...libres].sort((p, q) => Math.abs(p.y - delante) * 3 + Math.abs(p.x - 3) - (Math.abs(q.y - delante) * 3 + Math.abs(q.x - 3)))[0]!
}

/** Despliegue de un bot: pone sus soldados repartidos por la fila de delante. */
export function desplegarBot(t: Tactico, bando: Bando): void {
  while (vivos(t, bando) < MAX_VIVOS && t.mano[bando].length > 0) {
    const card = t.mano[bando][0]!
    const libres = casillasDeSalida(t, bando)
    if (libres.length === 0) break
    const delante = bando === 0 ? Math.min(...zonaDe(0)) : Math.max(...zonaDe(1))
    // Los de cuerpo a cuerpo, delante; los tiradores, detras.
    const quiereDelante = estiloDe(card).cuerpo !== undefined
    const eleccion = [...libres].sort((p, q) => {
      const costoP = Math.abs(p.y - delante) * (quiereDelante ? 3 : -3) + Math.abs(p.x - 3) * 0.2 + t.rand()
      const costoQ = Math.abs(q.y - delante) * (quiereDelante ? 3 : -3) + Math.abs(q.x - 3) * 0.2 + t.rand()
      return costoP - costoQ
    })[0]!
    desplegar(t, bando, card.id, eleccion.x, eleccion.y)
  }
}

interface Opcion {
  puntos: number
  hacer: () => void
}

function puntuarAtaque(t: Tactico, m: Mini, o: Objetivo): number {
  if (o.tipo === 'fuerte') {
    const f = t.fuertes[o.bando]
    return 6 + o.dano * 2 + (f.hp - o.dano <= 0 ? 100 : 0)
  }
  const e = t.minis.find((x) => x.id === o.id)!
  let puntos = o.dano * 2.2
  if (e.hp - o.dano <= 0) puntos += 7 + e.maxHp
  // Prefiere a los que mas pegan y a los que curan.
  if (e.estilo.pulso) puntos += 2
  puntos += e.hp < e.maxHp ? 1 : 0
  void m
  return puntos
}

/** La mejor jugada que le queda a un bot en este turno, o null si ya no hay nada que merezca la pena. */
function pensarBot(t: Tactico, bando: Bando): Opcion | null {
  let mejor: Opcion | null = null
  const probar = (op: Opcion) => {
    if (!mejor || op.puntos > mejor.puntos) mejor = op
  }
  const rival = otro(bando)
  const enemigos = minisDe(t, rival)
  const fuerteRival = t.fuertes[rival]

  // Refuerzo: si hay hueco y reserva, sale uno.
  if (t.pa >= 1 && vivos(t, bando) < MAX_VIVOS && t.mano[bando].length > 0) {
    const sal = mejorSalida(t, bando)
    if (sal) {
      const card = t.mano[bando][0]!
      probar({ puntos: 4 + (MAX_VIVOS - vivos(t, bando)) * 2, hacer: () => void desplegar(t, bando, card.id, sal.x, sal.y) })
    }
  }

  for (const m of minisDe(t, bando)) {
    // Atacar.
    if (puedeAtacar(t, m)) {
      for (const o of objetivos(t, m)) probar({ puntos: 20 + puntuarAtaque(t, m, o), hacer: () => void atacar(t, m, o) })
    }
    // Habilidad: curar si hay heridos cerca.
    if (puedeHabilidad(t, m)) {
      const p = m.estilo.pulso!
      let valor = 0
      if (p.cura) for (const a of minisDe(t, bando)) if (a !== m && dist(a.x, a.y, m.x, m.y) <= 3) valor += Math.max(0, a.maxHp - a.hp)
      if (p.ralentiza || p.aturde) valor += enemigos.filter((e) => dist(e.x, e.y, m.x, m.y) <= 3).length * 2
      if (valor >= 2) probar({ puntos: 14 + valor, hacer: () => void habilidad(t, m) })
    }
    // Moverse.
    if (puedeMover(t, m)) {
      const sitios = alcanzables(t, m)
      let mejorSitio: { x: number; y: number; puntos: number } | null = null
      const actual = { x: m.x, y: m.y }
      const puntosDe = (x: number, y: number) => {
        // Hacia el enemigo mas cercano (o su fuerte).
        const metas = [...enemigos.map((e) => ({ x: e.x, y: e.y })), { x: fuerteRival.x, y: fuerteRival.y }]
        const d = Math.min(...metas.map((p) => dist(x, y, p.x, p.y)))
        let puntos = 8 - Math.abs(d - (m.alcance > 1 ? Math.max(1, m.alcance - 1) : 1)) * 1.2
        if (t.terreno[y]![x] === 'cobertura') puntos += 2
        // Si desde ahi ya puede pegar, mejor.
        const ve = metas.some((p) => {
          const dd = dist(x, y, p.x, p.y)
          return dd >= 1 && dd <= m.alcance && lineaLibre(t, x, y, p.x, p.y)
        })
        if (ve) puntos += 6
        // Los tiradores huyen de estar pegados a un rival.
        if (m.alcance > 1 && enemigos.some((e) => dist(x, y, e.x, e.y) <= 1)) puntos -= 3
        return puntos
      }
      const aqui = puntosDe(actual.x, actual.y)
      for (const s of sitios.values()) {
        const puntos = puntosDe(s.x, s.y)
        if (!mejorSitio || puntos > mejorSitio.puntos) mejorSitio = { x: s.x, y: s.y, puntos }
      }
      if (mejorSitio && mejorSitio.puntos > aqui + 0.5) {
        const sitio = mejorSitio
        probar({ puntos: 5 + (sitio.puntos - aqui), hacer: () => void mover(t, m, sitio.x, sitio.y) })
      }
    }
  }
  return mejor
}

/** Hace UNA accion del bot en su turno. Devuelve `false` cuando ya no hace nada mas (y entonces acaba el turno). */
export function pasoBot(t: Tactico): boolean {
  if (t.fase !== 'juego' || t.resultado) return false
  const bando = t.turno
  if (t.pa <= 0) {
    terminarTurno(t)
    return false
  }
  const opcion = pensarBot(t, bando)
  if (!opcion) {
    terminarTurno(t)
    return false
  }
  opcion.hacer()
  return !t.resultado
}

/** Juega el turno entero de un bot (para las simulaciones y los tests). */
export function turnoBotCompleto(t: Tactico): void {
  const bando = t.turno
  for (let i = 0; i < 12 && t.fase === 'juego' && t.turno === bando; i++) {
    if (!pasoBot(t)) break
  }
  if (t.fase === 'juego' && t.turno === bando) terminarTurno(t)
}
