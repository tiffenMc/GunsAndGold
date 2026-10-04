import { api } from '../../lib/servidor'
import { alCambiarJugadores, exportarPersonajes, importarPersonajes } from '../game/players'
import { fichaParaElServidor, refrescarRanking } from '../game/ranking'

/**
 * **Tu partida en el servidor.** Al entrar con tu cuenta se trae lo que hay guardado (lo último que
 * jugaste, en este móvil o en otro); mientras juegas, cada cambio se manda al servidor a los pocos
 * segundos, y también al cerrar la página.
 *
 * Si se juega sin conexión, lo que no se haya podido mandar se queda apuntado y se manda la próxima
 * vez, antes de traer nada (así no se pierde).
 */

/** Cuánto se espera desde el último cambio para mandarlo (así se juntan varios en uno). */
const ESPERA_MS = 2500
const SIN_SUBIR = 'oeste-sin-subir-v1'

interface Conexion {
  cuentaId: string
  token: string
}

let conexion: Conexion | null = null
let reloj: number | undefined
let callado = false
let quitarOyente: (() => void) | null = null

function apuntarSinSubir(cuentaId: string | null) {
  try {
    if (cuentaId) localStorage.setItem(SIN_SUBIR, cuentaId)
    else localStorage.removeItem(SIN_SUBIR)
  } catch {
    // Sin almacenamiento: se intentará igual.
  }
}

function quedoSinSubir(cuentaId: string): boolean {
  try {
    return localStorage.getItem(SIN_SUBIR) === cuentaId
  } catch {
    return false
  }
}

/** Manda ya los personajes de la cuenta al servidor. */
export async function subirAhora(alSalir = false): Promise<string | null> {
  window.clearTimeout(reloj)
  reloj = undefined
  const c = conexion
  if (!c) return null
  const personajes = exportarPersonajes(c.cuentaId)
  const r = await api('/partida', {
    metodo: 'PUT',
    token: c.token,
    alSalir,
    cuerpo: { personajes, fichas: personajes.map(fichaParaElServidor) },
  })
  if (!r.ok) return r.error
  apuntarSinSubir(null)
  void refrescarRanking()
  return null
}

function programar() {
  if (!conexion || callado) return
  apuntarSinSubir(conexion.cuentaId)
  window.clearTimeout(reloj)
  reloj = window.setTimeout(() => void subirAhora(), ESPERA_MS)
}

const alOcultar = () => {
  if (document.visibilityState === 'hidden' && reloj !== undefined) void subirAhora(true)
}

/**
 * Se conecta la cuenta: trae su partida del servidor (o sube la de este dispositivo si el servidor
 * aún no tiene nada, o si quedó algo sin subir) y desde ahí guarda sola cada cambio.
 */
export async function conectarCuenta(cuentaId: string, token: string): Promise<string | null> {
  desconectar()
  conexion = { cuentaId, token }
  const locales = exportarPersonajes(cuentaId)
  if (locales.length > 0 && quedoSinSubir(cuentaId)) {
    // Lo último está aquí (se jugó sin conexión): manda esto primero.
    const fallo = await subirAhora()
    if (fallo) return fallo
  } else {
    const r = await api<{ personajes: unknown[] }>('/partida', { token })
    if (!r.ok && r.estado !== 0) {
      conexion = null
      return r.error
    }
    // Sin conexión (r.ok falso): se juega con lo de aquí y lo que cambie se manda cuando vuelva.
    if (r.ok && r.datos.personajes.length > 0) {
      callado = true
      importarPersonajes(cuentaId, r.datos.personajes)
      callado = false
    } else if (r.ok && locales.length > 0) {
      // El servidor está vacío y aquí hay personajes de esta cuenta: se suben (de antes del servidor).
      const fallo = await subirAhora()
      if (fallo) return fallo
    }
  }
  quitarOyente = alCambiarJugadores(programar)
  document.addEventListener('visibilitychange', alOcultar)
  return null
}

/** Si ya está conectada esa sesión (para no traer la partida dos veces). */
export function estaConectada(token: string): boolean {
  return conexion?.token === token
}

/** Deja de guardar (al cerrar sesión). Si quedaba algo por mandar, se manda antes. */
export function desconectar(): void {
  if (conexion && reloj !== undefined) void subirAhora(true)
  quitarOyente?.()
  quitarOyente = null
  document.removeEventListener('visibilitychange', alOcultar)
  conexion = null
}
