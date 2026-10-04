import { useSyncExternalStore } from 'react'
import { api, hayServidor } from '../../lib/servidor'
import { conectarCuenta, desconectar } from './sincronizar'

/**
 * Las **cuentas de usuario y contraseña**, sin correo y sin confirmar nada.
 *
 * - **Con servidor** (el juego publicado): la cuenta vive en el servidor, así que entras con ella
 *   desde cualquier móvil y tus personajes te siguen. Aquí solo se guarda la sesión (`token`).
 * - **Sin servidor** (`npm run dev`): la cuenta vive en este dispositivo, como siempre. La
 *   contraseña se guarda resumida (un hash tonto: es un juego que corre en tu casa).
 *
 * Una cuenta de antes de este dispositivo se sube sola al servidor la primera vez que se entra con
 * ella (mismo usuario y contraseña), con sus personajes.
 */

interface CuentaLocal {
  usuario: string
  /** El resumen de la contraseña (solo en las cuentas sin servidor). */
  clave: string
  creada: number
  /** La sesión del servidor (si la cuenta vive allí). */
  token?: string
}

interface Guardado {
  cuentas: Record<string, CuentaLocal>
  actual: string | null
}

const KEY = 'oeste-cuentas-v1'

/** Un resumen sencillo y suficiente para esto: no guardamos la contraseña tal cual. */
function resumen(clave: string): string {
  let h = 5381
  const texto = `duelo::${clave}`
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return `v1-${(h >>> 0).toString(36)}`
}

function normalizar(usuario: string): string {
  return usuario.trim().toLowerCase()
}

function leer(): Guardado {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { cuentas: {}, actual: null }
    const parsed = JSON.parse(raw) as Partial<Guardado>
    return {
      cuentas: parsed.cuentas && typeof parsed.cuentas === 'object' ? parsed.cuentas : {},
      actual: typeof parsed.actual === 'string' ? parsed.actual : null,
    }
  } catch {
    return { cuentas: {}, actual: null }
  }
}

let estado: Guardado = leer()
const oyentes = new Set<() => void>()

function persistir() {
  try {
    localStorage.setItem(KEY, JSON.stringify(estado))
  } catch {
    // Si no cabe, se queda en memoria.
  }
  for (const oyente of oyentes) oyente()
}

/** La cuenta con la que estás dentro ahora mismo (o null). */
export function cuentaActual(): CuentaLocal | null {
  if (!estado.actual) return null
  return estado.cuentas[estado.actual] ?? null
}

/** Alta rápida: usuario y contraseña. Devuelve el error en texto, o null si ha ido bien. */
export function crearCuentaLocal(usuario: string, clave: string): string | null {
  const id = normalizar(usuario)
  if (id.length < 3) return 'El usuario tiene que tener al menos 3 letras'
  if (clave.length < 4) return 'La contraseña tiene que tener al menos 4 letras'
  if (estado.cuentas[id]) return 'Ese usuario ya existe aquí: entra con su contraseña'
  estado = {
    cuentas: { ...estado.cuentas, [id]: { usuario: usuario.trim(), clave: resumen(clave), creada: Date.now() } },
    actual: id,
  }
  persistir()
  return null
}

/** Entrar con una cuenta de este dispositivo. */
export function entrarLocal(usuario: string, clave: string): string | null {
  const id = normalizar(usuario)
  const cuenta = estado.cuentas[id]
  if (!cuenta) return 'Ese usuario no está en este dispositivo: créalo'
  if (cuenta.clave !== resumen(clave)) return 'Esa contraseña no es la suya'
  estado = { ...estado, actual: id }
  persistir()
  return null
}

/** Salir (y, si la cuenta vive en el servidor, cerrar allí la sesión). */
export function cerrarSesionLocal(): void {
  const cuenta = cuentaActual()
  desconectar()
  if (cuenta?.token) void api('/salir', { metodo: 'POST', token: cuenta.token, alSalir: true })
  estado = { actual: null, cuentas: cuenta?.token ? quitarToken(estado.cuentas, cuenta) : estado.cuentas }
  persistir()
}

function quitarToken(cuentas: Record<string, CuentaLocal>, cuenta: CuentaLocal): Record<string, CuentaLocal> {
  const id = normalizar(cuenta.usuario)
  const { token: _token, ...sinToken } = cuenta
  return { ...cuentas, [id]: sinToken }
}

/** Ya dentro en el servidor: trae (o sube) la partida y se queda la sesión. */
async function quedarseDentro(usuario: string, token: string): Promise<string | null> {
  const fallo = await conectarCuenta(`local:${usuario}`, token)
  if (fallo) return fallo
  const id = normalizar(usuario)
  const antes = estado.cuentas[id]
  estado = { cuentas: { ...estado.cuentas, [id]: { usuario, clave: antes?.clave ?? '', creada: antes?.creada ?? Date.now(), token } }, actual: id }
  persistir()
  return null
}

/** Crear cuenta: en el servidor si lo hay; si no, en este dispositivo. */
export async function crearCuenta(usuario: string, clave: string): Promise<string | null> {
  if (!(await hayServidor())) return crearCuentaLocal(usuario, clave)
  const r = await api<{ usuario: string; token: string }>('/registro', { metodo: 'POST', cuerpo: { usuario, clave } })
  if (!r.ok) return r.error
  return quedarseDentro(r.datos.usuario, r.datos.token)
}

/** Entrar: en el servidor si lo hay; si no, con la cuenta de este dispositivo. */
export async function entrar(usuario: string, clave: string): Promise<string | null> {
  if (!(await hayServidor())) return entrarLocal(usuario, clave)
  const r = await api<{ usuario: string; token: string }>('/entrar', { metodo: 'POST', cuerpo: { usuario, clave } })
  if (r.ok) return quedarseDentro(r.datos.usuario, r.datos.token)
  // ¿Es una cuenta de antes, de este dispositivo? Se sube al servidor tal cual (con sus personajes).
  const vieja = estado.cuentas[normalizar(usuario)]
  if (r.estado === 404 && vieja && !vieja.token && vieja.clave === resumen(clave)) {
    const alta = await api<{ usuario: string; token: string }>('/registro', { metodo: 'POST', cuerpo: { usuario: vieja.usuario, clave } })
    if (!alta.ok) return alta.error
    return quedarseDentro(alta.datos.usuario, alta.datos.token)
  }
  return r.error
}

/** Las cuentas que hay en este dispositivo (para enseñarlas o borrarlas). */
export function cuentasLocales(): CuentaLocal[] {
  return Object.values(estado.cuentas).sort((a, b) => b.creada - a.creada)
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

/** La cuenta actual, para pintarla. */
export function useCuentaLocal(): CuentaLocal | null {
  return useSyncExternalStore(suscribir, cuentaActual, cuentaActual)
}
