import * as M from './mates'
import type { Battle, Unit } from './engine'
import { FIELD_L, FIELD_W, alive, hurtUnit } from './engine'

/**
 * **Lo que pasa por el clima.** No es constante: al empezar la partida se sortea si pasa algo y
 * cuántas veces (ninguna, una, dos o tres), y cuándo. Cuando toca, es algo **gordo** y les da a los
 * dos bandos por igual (no apunta a nadie):
 *
 *  - **tormenta**: caen dos o tres rayos en sitios al azar del campo. Primero el aviso en el suelo y,
 *    al momento, ¡zas!: quita escudos y tumba a los que pilla.
 *  - **helado**: entra una ventisca que cruza el campo y deja congelados a dos o tres al azar.
 *  - **noche**: sale una bandada de murciélagos que muerde a unos cuantos al azar y se va.
 *  - **día**: una rodadora que cruza el campo y golpea (quita vida) a los que pilla, un golpe de
 *    calor que marea, o un **tsunami** que baja por la izquierda, el centro o la derecha y arrasa
 *    con lo que haya en medio.
 *  - **lluvia**: un chaparrón que deja charcos de barro: el que pasa va lento y a veces resbala.
 *
 * Todo sale del azar de la partida, asi que con un amigo los dos ven lo mismo.
 */

/** Lo que dura cada cosa (en segundos). */
export const HIELO_S = 4
export const RAYO_AVISO_S = 1.3
export const CHARCO_S = 12
export const INSOLACION_S = 2.2
/** Lo que avisa el tsunami antes de llegar (el suelo tiembla y se ve venir el agua). */
export const TSUNAMI_AVISO_S = 1.8
const TSUNAMI_VEL = 13
/** Lo que tarda la ventisca en congelar desde que asoma. */
const VENTISCA_CONGELA_S = 1.5
const VENTISCA_S = 3.6

/** Los sucesos gordos (los que salen con cartel). */
export type SucesoGordo = 'tormenta' | 'ventisca' | 'murcielagos' | 'rodadora' | 'calor' | 'tsunami' | 'chaparron'

export type Suceso =
  | { k: 'rayo'; id: number; x: number; z: number; r: number; desde: number; cae: number; hasta: number; hecho: boolean }
  | { k: 'charco'; id: number; x: number; z: number; r: number; desde: number; hasta: number; vistos: number[] }
  | { k: 'rodadora'; id: number; x: number; z: number; r: number; desde: number; hasta: number; dx: number; vistos: number[] }
  | { k: 'hielo'; id: number; x: number; z: number; r: number; desde: number; hasta: number; unidad: number }
  | { k: 'sol'; id: number; x: number; z: number; r: number; desde: number; hasta: number; unidad: number }
  /** El viento cruza el campo de lado (`dx` dice hacia donde) y a `congela` deja tiesos a unos cuantos. */
  | { k: 'ventisca'; id: number; x: number; z: number; r: number; desde: number; congela: number; hasta: number; dx: number; hecho: boolean }
  /**
   * La ola baja por un carril (`x` es su centro y `r` medio ancho). Sale de `oz` a `sale` y avanza
   * a `dz` metros por segundo; `z` es por donde va la cresta.
   */
  | { k: 'tsunami'; id: number; x: number; z: number; r: number; desde: number; sale: number; hasta: number; oz: number; dz: number; vistos: number[] }
  /**
   * La bandada entra por `ox, oz`, va mordiendo a sus `objetivos` (uno en cada momento de `golpes`)
   * y se va. `x, z` es donde está ahora la bandada.
   */
  | {
      k: 'murcielagos'
      id: number
      x: number
      z: number
      r: number
      desde: number
      hasta: number
      ox: number
      oz: number
      objetivos: number[]
      golpes: number[]
      hechos: number
    }

// (Se calculan al usarlos: el motor importa este archivo y aun no tiene sus medidas al cargarlo.)
const ancho = () => FIELD_W / 2 - 1
const largo = () => FIELD_L / 2 - 4

/** Cuántos sucesos trae una partida: casi siempre uno o dos, a veces ninguno y a veces tres. */
const CUANTOS: [number, number][] = [
  [0, 0.17],
  [1, 0.36],
  [2, 0.31],
  [3, 0.16],
]
/** Entre qué segundos de la partida pueden caer (ni nada más empezar ni al final). */
const VENTANA: [number, number] = [28, 280]

function soldados(battle: Battle): Unit[] {
  return battle.units.filter((u) => alive(u) && !u.torre && !congelada(battle, u))
}

function cerca(a: { x: number; z: number }, b: { x: number; z: number }, r: number) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r
}

function otroId(battle: Battle) {
  battle.sucesoId = (battle.sucesoId ?? 0) + 1
  return battle.sucesoId
}

/** Unos cuantos al azar (sin repetir). */
function alAzar<T>(battle: Battle, lista: T[], cuantos: number): T[] {
  const copia = [...lista]
  const salida: T[] = []
  while (salida.length < cuantos && copia.length > 0) {
    salida.push(copia.splice(Math.floor(battle.rand() * copia.length), 1)[0]!)
  }
  return salida
}

/** Un sitio al azar del campo. */
function sitio(battle: Battle) {
  return { x: (battle.rand() * 2 - 1) * ancho(), z: (battle.rand() * 2 - 1) * largo() }
}

/** Si el clima lo tiene congelado. */
export function congelada(battle: Battle, unit: Unit): boolean {
  return battle.time < (unit.hab.hieloHasta ?? 0)
}

/**
 * El sorteo de la partida: cuántos sucesos y cuándo. Se reparten por la partida, cada uno en su
 * trozo, para que no caigan dos seguidos.
 */
export function sortearSucesos(battle: Battle): number[] {
  const tirada = battle.rand()
  let acumulado = 0
  let cuantos = 0
  for (const [n, peso] of CUANTOS) {
    acumulado += peso
    if (tirada < acumulado) {
      cuantos = n
      break
    }
  }
  const [desde, hasta] = VENTANA
  const trozo = (hasta - desde) / Math.max(1, cuantos)
  return Array.from({ length: cuantos }, (_, i) => desde + trozo * i + trozo * (0.1 + battle.rand() * 0.7))
}

/** Un paso del clima: si toca, pasa algo nuevo, y lo que ya esta en marcha sigue. */
export function pasoClima(battle: Battle, dt: number) {
  const t = battle.time
  if (!battle.sucesoPlan) battle.sucesoPlan = sortearSucesos(battle)
  const plan = battle.sucesoPlan
  if (plan.length > 0 && t >= plan[0]!) {
    // Si no hay a quien pillar (ventisca, murciélagos…), se espera un poco a que salga alguien.
    if (nuevoSuceso(battle)) plan.shift()
    else plan[0] = t + 6
  }
  if (battle.sucesos.length === 0) return
  for (const s of battle.sucesos) seguir(battle, s, dt)
  battle.sucesos = battle.sucesos.filter((s) => s.hasta > t)
}

function anunciar(battle: Battle, k: SucesoGordo, x = 0) {
  battle.events.push({ type: 'suceso', k, x })
}

/** Empieza un suceso segun el clima. Devuelve false si ahora no puede (nadie en el campo). */
function nuevoSuceso(battle: Battle): boolean {
  const t = battle.time
  const tropa = soldados(battle)
  switch (battle.clima) {
    case 'tormenta': {
      // Dos o tres rayos, cada uno donde caiga: no buscan a nadie.
      const rayos = battle.rand() < 0.5 ? 2 : 3
      for (let i = 0; i < rayos; i++) {
        const { x, z } = sitio(battle)
        const desde = t + i * 0.55
        battle.sucesos.push({
          k: 'rayo',
          id: otroId(battle),
          x,
          z,
          r: 2.1,
          desde,
          cae: desde + RAYO_AVISO_S,
          hasta: desde + RAYO_AVISO_S + 1.6,
          hecho: false,
        })
      }
      anunciar(battle, 'tormenta')
      return true
    }
    case 'helado': {
      if (tropa.length === 0) return false
      battle.sucesos.push({
        k: 'ventisca',
        id: otroId(battle),
        x: 0,
        z: 0,
        r: FIELD_W,
        desde: t,
        congela: t + VENTISCA_CONGELA_S,
        hasta: t + VENTISCA_S,
        dx: battle.rand() < 0.5 ? 1 : -1,
        hecho: false,
      })
      anunciar(battle, 'ventisca')
      return true
    }
    case 'noche': {
      if (tropa.length === 0) return false
      const cuantos = Math.min(tropa.length, 3 + Math.floor(battle.rand() * 2))
      const objetivos = alAzar(battle, tropa, cuantos)
      const deIzquierda = battle.rand() < 0.5
      const ox = (deIzquierda ? -1 : 1) * (FIELD_W / 2 + 6)
      const oz = (battle.rand() * 2 - 1) * largo() * 0.6
      const golpes = objetivos.map((_, i) => t + 1.3 + i * 0.95)
      battle.sucesos.push({
        k: 'murcielagos',
        id: otroId(battle),
        x: ox,
        z: oz,
        r: 1.2,
        desde: t,
        hasta: golpes[golpes.length - 1]! + 1.6,
        ox,
        oz,
        objetivos: objetivos.map((u) => u.id),
        golpes,
        hechos: 0,
      })
      anunciar(battle, 'murcielagos')
      return true
    }
    case 'lluvia': {
      // Un chaparrón: dos o tres charcos en sitios al azar.
      const charcos = battle.rand() < 0.5 ? 2 : 3
      for (let i = 0; i < charcos; i++) {
        const { x, z } = sitio(battle)
        battle.sucesos.push({
          k: 'charco',
          id: otroId(battle),
          x,
          z,
          r: 2 + battle.rand() * 0.8,
          desde: t + i * 0.4,
          hasta: t + i * 0.4 + CHARCO_S,
          vistos: [],
        })
      }
      anunciar(battle, 'chaparron')
      return true
    }
    case 'dia': {
      const tirada = battle.rand()
      if (tirada < 0.34) {
        // El tsunami: por un carril (izquierda, centro o derecha) y desde una punta del campo.
        const carril = Math.floor(battle.rand() * 3) - 1
        const tercio = FIELD_W / 3
        const baja = battle.rand() < 0.5
        const oz = (baja ? -1 : 1) * (FIELD_L / 2 + 2)
        const dz = (baja ? 1 : -1) * TSUNAMI_VEL
        const sale = t + TSUNAMI_AVISO_S
        battle.sucesos.push({
          k: 'tsunami',
          id: otroId(battle),
          x: carril * tercio,
          z: oz,
          r: tercio / 2 + 0.35,
          desde: t,
          sale,
          hasta: sale + (FIELD_L + 4) / TSUNAMI_VEL + 0.8,
          oz,
          dz,
          vistos: [],
        })
        anunciar(battle, 'tsunami', carril * tercio)
        return true
      }
      if (tirada < 0.78 || tropa.length === 0) {
        // La rodadora: cruza de lado a lado por cualquier sitio del campo.
        const z = (battle.rand() * 2 - 1) * largo()
        const deIzquierda = battle.rand() < 0.5
        const dx = (deIzquierda ? 1 : -1) * 6
        battle.sucesos.push({
          k: 'rodadora',
          id: otroId(battle),
          x: deIzquierda ? -FIELD_W / 2 - 3 : FIELD_W / 2 + 3,
          z,
          r: 1.15,
          desde: t,
          hasta: t + (FIELD_W + 6) / Math.abs(dx),
          dx,
          vistos: [],
        })
        anunciar(battle, 'rodadora')
        return true
      }
      // Golpe de calor: a dos al azar les da una insolación (se marean y les quita algo).
      for (const u of alAzar(battle, tropa, 2)) {
        u.hab.mareoHasta = Math.max(u.hab.mareoHasta, t + INSOLACION_S)
        hurtUnit(battle, u, 0.4, false)
        battle.sucesos.push({ k: 'sol', id: otroId(battle), x: u.x, z: u.z, r: 0.8, desde: t, hasta: t + INSOLACION_S, unidad: u.id })
      }
      anunciar(battle, 'calor')
      return true
    }
    default:
      return true
  }
}

/** Tirar a alguien al suelo un momento, empujado desde un punto. */
function tumbar(unit: Unit, desde: { x: number; z: number }, fuerza: number, aturde: number) {
  const dx = unit.x - desde.x
  const dz = unit.z - desde.z
  const d = M.hypot(dx, dz) || 1
  unit.knockback.x = (dx / d) * fuerza
  unit.knockback.z = (dz / d) * fuerza
  unit.hitStun = Math.max(unit.hitStun, aturde)
}

/** Deja a una tropa hecha un muñeco de hielo. */
function congelar(battle: Battle, u: Unit) {
  const t = battle.time
  u.hab.hieloHasta = t + HIELO_S
  u.duelWith = null
  u.fireIn = null
  u.hab.activa = null
  battle.sucesos.push({ k: 'hielo', id: otroId(battle), x: u.x, z: u.z, r: 0.8, desde: t, hasta: t + HIELO_S, unidad: u.id })
}

/** Donde está la bandada en cada momento: de la entrada a cada mordisco y luego fuera. */
function rumboBandada(battle: Battle, s: Extract<Suceso, { k: 'murcielagos' }>): { x: number; z: number } {
  const t = battle.time
  const donde = (id: number) => {
    const u = battle.units.find((x) => x.id === id)
    return u ? { x: u.x, z: u.z } : { x: s.x, z: s.z }
  }
  const puntos = [{ x: s.ox, z: s.oz }, ...s.objetivos.map(donde), { x: -s.ox, z: s.oz * 0.3 }]
  const tiempos = [s.desde, ...s.golpes, s.hasta]
  for (let i = 0; i < tiempos.length - 1; i++) {
    const a = tiempos[i]!
    const b = tiempos[i + 1]!
    if (t <= b) {
      const k = Math.max(0, Math.min(1, (t - a) / Math.max(0.01, b - a)))
      // Llega rápido y se queda un momento encima (el mordisco).
      const e = Math.min(1, k * 1.35)
      const suave = e * e * (3 - 2 * e)
      return { x: puntos[i]!.x + (puntos[i + 1]!.x - puntos[i]!.x) * suave, z: puntos[i]!.z + (puntos[i + 1]!.z - puntos[i]!.z) * suave }
    }
  }
  return puntos[puntos.length - 1]!
}

function seguir(battle: Battle, s: Suceso, dt: number) {
  const t = battle.time
  switch (s.k) {
    case 'hielo':
    case 'sol': {
      // Va pegado al soldado (por si le empujan).
      const u = battle.units.find((x) => x.id === s.unidad)
      if (!u || !alive(u)) {
        s.hasta = t
        if (u && s.k === 'hielo') u.hab.hieloHasta = 0
        return
      }
      s.x = u.x
      s.z = u.z
      return
    }
    case 'rayo': {
      if (s.hecho || t < s.cae) return
      s.hecho = true
      for (const u of battle.units) {
        if (!alive(u) || !cerca(u, s, s.r)) continue
        hurtUnit(battle, u, 1.6, false, s)
        if (alive(u) && !u.torre) tumbar(u, s, 4.5, 1.1)
      }
      return
    }
    case 'charco': {
      if (t < s.desde) return
      for (const u of battle.units) {
        if (!alive(u) || u.torre || !cerca(u, s, s.r)) continue
        u.slowUntil = Math.max(u.slowUntil, t + 0.25)
        // La primera vez que lo pisa, a veces resbala.
        if (!s.vistos.includes(u.id)) {
          s.vistos.push(u.id)
          if (battle.rand() < 0.35) tumbar(u, { x: u.x, z: u.z - 0.1 }, 1.5, 0.9)
        }
      }
      return
    }
    case 'rodadora': {
      s.x += s.dx * dt
      for (const u of battle.units) {
        if (!alive(u) || u.torre || s.vistos.includes(u.id) || !cerca(u, s, s.r + 0.45)) continue
        s.vistos.push(u.id)
        // Golpea de verdad: quita vida y lo lanza por delante.
        hurtUnit(battle, u, 1.2, false, s)
        if (alive(u)) {
          u.knockback.x = Math.sign(s.dx) * 6
          u.knockback.z = (u.z - s.z >= 0 ? 1 : -1) * 1.2
          u.hitStun = Math.max(u.hitStun, 1)
        }
      }
      return
    }
    case 'ventisca': {
      if (s.hecho || t < s.congela) return
      s.hecho = true
      // Dos o tres al azar, de cualquier bando.
      const tropa = soldados(battle)
      for (const u of alAzar(battle, tropa, battle.rand() < 0.5 ? 2 : 3)) congelar(battle, u)
      return
    }
    case 'tsunami': {
      if (t < s.sale) return
      // Lo barrido en este paso (con pasos largos la ola no se salta a nadie).
      const antes = s.z
      s.z = s.oz + s.dz * (t - s.sale)
      const lo = Math.min(antes, s.z) - 1.2
      const hi = Math.max(antes, s.z) + 1.2
      for (const u of battle.units) {
        if (!alive(u) || s.vistos.includes(u.id)) continue
        if (Math.abs(u.x - s.x) > s.r || u.z < lo || u.z > hi) continue
        s.vistos.push(u.id)
        hurtUnit(battle, u, 1.7, false, { x: u.x, z: u.z - Math.sign(s.dz) })
        if (alive(u) && !u.torre) {
          // Se lo lleva la ola: hacia donde va el agua y un poco hacia el borde del carril.
          u.knockback.x = (u.x >= s.x ? 1 : -1) * 1.5
          u.knockback.z = Math.sign(s.dz) * 8
          u.hitStun = Math.max(u.hitStun, 1.4)
          u.fallTime = 0
          u.fallDuration = 0.9
          u.fallStrength = 1
          u.fallDirection = { x: 0, z: Math.sign(s.dz) }
        }
      }
      return
    }
    case 'murcielagos': {
      const donde = rumboBandada(battle, s)
      s.x = donde.x
      s.z = donde.z
      while (s.hechos < s.golpes.length && t >= s.golpes[s.hechos]!) {
        const u = battle.units.find((x) => x.id === s.objetivos[s.hechos])
        s.hechos += 1
        if (!u || !alive(u)) continue
        hurtUnit(battle, u, 0.9, false, { x: u.x + 0.5, z: u.z })
        if (alive(u)) {
          u.hitStun = Math.max(u.hitStun, 0.8)
          u.hab.mareoHasta = Math.max(u.hab.mareoHasta, t + 0.8)
        }
      }
      return
    }
  }
}
