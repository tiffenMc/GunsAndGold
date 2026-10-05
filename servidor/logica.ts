/**
 * **Lo que decide el servidor**, sin nada de Cloudflare dentro (así se prueba con los tests de
 * siempre): cómo se escriben los usuarios, cómo se guardan las contraseñas, qué se acepta de lo que
 * manda el juego y en qué orden va el ranking.
 */

/** Lo más que se guarda de la partida de una cuenta (todos sus personajes), en letras. */
export const MAX_DATOS = 800_000
/** Cuántos personajes caben por cuenta (el juego deja tres; algo de margen). */
export const MAX_PERSONAJES = 6
/** Las vueltas del resumen de la contraseña (PBKDF2). Pocas para que no se coma la CPU gratis. */
export const VUELTAS = 5_000

/** Lo más de jugadas que se aceptan de una partida (en 5 minutos no da para más). */
export const MAX_JUGADAS = 6000

/** Una semilla al azar para una partida (un entero positivo de 31 bits). */
export function semillaAlAzar(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! >>> 1
}

/** El usuario tal y como se compara: sin espacios a los lados y en minúsculas. */
export function idDeUsuario(usuario: string): string {
  return usuario.trim().toLowerCase()
}

/** Lo que le pasa a un usuario (null si vale). */
export function problemaDeUsuario(usuario: string): string | null {
  const limpio = usuario.trim()
  if (limpio.length < 3) return 'El usuario tiene que tener al menos 3 letras'
  if (limpio.length > 20) return 'El usuario puede tener hasta 20 letras'
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(limpio)) return 'El usuario solo puede llevar letras, números, espacios y _ . -'
  if (limpio.includes('@')) return 'Sin arroba: eso es para el correo'
  // El admin solo existe en el ordenador de pruebas (lo tiene todo): en el servidor no.
  if (idDeUsuario(limpio) === 'admin') return 'Ese usuario está reservado: elige otro'
  return null
}

export function problemaDeClave(clave: string): string | null {
  if (clave.length < 4) return 'La contraseña tiene que tener al menos 4 letras'
  if (clave.length > 100) return 'Esa contraseña es demasiado larga'
  return null
}

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Unos bytes al azar, en hexadecimal (para las sales y las sesiones). */
export function azar(bytes = 16): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** El resumen de una contraseña con su sal. La contraseña nunca se guarda tal cual. */
export async function resumirClave(clave: string, sal: string, vueltas = VUELTAS): Promise<string> {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(sal), iterations: vueltas }, llave, 256)
  return hex(bits)
}

/** Compara dos textos sin dar pistas por lo que tarda. */
export function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferencia = 0
  for (let i = 0; i < a.length; i++) diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferencia === 0
}

// ---------------------------------------------------------------------------
// Las fichas del ranking
// ---------------------------------------------------------------------------

/** Lo que el servidor guarda de cada personaje para Los Más Buscados. */
export interface FichaGuardada {
  id: string
  nombre: string
  monedas: number
  partidas: number
  victorias: number
  mejorRacha: number
  /** El aspecto del muñeco (se guarda tal cual, en JSON, acotado de tamaño). */
  look: unknown
  animacion: unknown
}

const numero = (v: unknown, max = 10_000_000) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : 0)
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/** Lo que se acepta de una ficha que manda el juego (null si no vale o es el admin). */
export function limpiarFicha(bruta: unknown): FichaGuardada | null {
  if (!bruta || typeof bruta !== 'object') return null
  const f = bruta as Record<string, unknown>
  if (f.admin === true) return null
  const id = texto(f.id, 40)
  const nombre = texto(f.nombre, 24).trim()
  if (!id || !nombre) return null
  const partidas = numero(f.partidas)
  const look = f.look && typeof f.look === 'object' && JSON.stringify(f.look).length < 4000 ? f.look : null
  const animacion = f.animacion && typeof f.animacion === 'object' && JSON.stringify(f.animacion).length < 4000 ? f.animacion : null
  return {
    id,
    nombre,
    monedas: numero(f.monedas),
    partidas,
    victorias: Math.min(partidas, numero(f.victorias)),
    mejorRacha: Math.min(partidas, numero(f.mejorRacha)),
    look,
    animacion,
  }
}

/** El orden de Los Más Buscados: rango (monedas), luego victorias, luego menos partidas. */
export function antesEnElRanking(a: FichaGuardada, b: FichaGuardada): number {
  return b.monedas - a.monedas || b.victorias - a.victorias || a.partidas - b.partidas || a.nombre.localeCompare(b.nombre)
}

/** Lo que se acepta como partida de una cuenta: una lista de personajes que no pase de tamaño. */
export function problemaDePartida(personajes: unknown): string | null {
  if (!Array.isArray(personajes)) return 'Faltan los personajes'
  if (personajes.length > MAX_PERSONAJES) return 'Demasiados personajes'
  if (JSON.stringify(personajes).length > MAX_DATOS) return 'La partida es demasiado grande'
  return null
}

// ---------------------------------------------------------------------------
// Las jugadas de una partida
// ---------------------------------------------------------------------------

type Vec = { x: number; z: number }
type JugadaLimpia =
  | { a: 'carta'; slot: number; x: number; z: number; precision: number; torre: boolean }
  | { a: 'disparo'; posicion: number; destino?: Vec }
  | { a: 'especial'; destino: Vec }
  | { a: 'dinamita'; origen: number; destino: Vec }
  | { a: 'soltarTorre'; unitId: number }
  | { a: 'reroll' }

const finito = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null

function punto(v: unknown): Vec | null {
  if (!v || typeof v !== 'object') return null
  const p = v as Record<string, unknown>
  const x = finito(p.x, -100, 100)
  const z = finito(p.z, -100, 100)
  return x === null || z === null ? null : { x, z }
}

function jugada(v: unknown): JugadaLimpia | null {
  if (!v || typeof v !== 'object') return null
  const j = v as Record<string, unknown>
  switch (j.a) {
    case 'carta': {
      const slot = finito(j.slot, 0, 9)
      const x = finito(j.x, -100, 100)
      const z = finito(j.z, -100, 100)
      const precision = finito(j.precision, 0, 1)
      if (slot === null || !Number.isInteger(slot) || x === null || z === null || precision === null) return null
      return { a: 'carta', slot, x, z, precision, torre: j.torre === true }
    }
    case 'disparo': {
      const posicion = finito(j.posicion, -100, 100)
      if (posicion === null) return null
      const destino = j.destino === undefined ? undefined : punto(j.destino)
      if (destino === null) return null
      return destino ? { a: 'disparo', posicion, destino } : { a: 'disparo', posicion }
    }
    case 'especial': {
      const destino = punto(j.destino)
      return destino ? { a: 'especial', destino } : null
    }
    case 'dinamita': {
      const origen = finito(j.origen, -100, 100)
      const destino = punto(j.destino)
      return origen === null || !destino ? null : { a: 'dinamita', origen, destino }
    }
    case 'soltarTorre': {
      const unitId = finito(j.unitId, 0, 1e9)
      return unitId === null || !Number.isInteger(unitId) ? null : { a: 'soltarTorre', unitId }
    }
    case 'reroll':
      return { a: 'reroll' }
    default:
      return null
  }
}

/** Las jugadas que manda el móvil, solo las que tienen buena pinta y en orden. */
export function limpiarJugadas(brutas: unknown): { p: number; j: JugadaLimpia }[] {
  if (!Array.isArray(brutas)) return []
  const salida: { p: number; j: JugadaLimpia }[] = []
  for (const b of brutas.slice(0, MAX_JUGADAS)) {
    if (!b || typeof b !== 'object') continue
    const p = finito((b as { p?: unknown }).p, 0, 1e6)
    const j = jugada((b as { j?: unknown }).j)
    if (p !== null && Number.isInteger(p) && j) salida.push({ p, j })
  }
  return salida
}
