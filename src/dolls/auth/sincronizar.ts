import { api } from '../../lib/servidor'
import { importarPersonajes } from '../game/players'
import { refrescarRanking } from '../game/ranking'

/**
 * **Tu cuenta en el servidor.** Lo que tienes lo guarda y lo decide el servidor: al entrar se trae
 * tal cual (en este móvil o en otro, da igual), y cada cosa que haces fuera de la partida (comprar,
 * abrir un sobre…) se le pide a él, que contesta cómo te queda todo (ver `game/hacer.ts`).
 */

export interface Conexion {
  /** La cuenta como la usa el juego para atar sus personajes (`local:usuario`). */
  cuentaId: string
  token: string
}

let conexion: Conexion | null = null

/** La cuenta conectada al servidor ahora mismo (null si se juega sin servidor). */
export function conexionActual(): Conexion | null {
  return conexion
}

/** Si ya está conectada esa sesión (para no traer la partida dos veces). */
export function estaConectada(token: string): boolean {
  return conexion?.token === token
}

/** Se conecta la cuenta y se trae lo que tiene en el servidor. */
export async function conectarCuenta(cuentaId: string, token: string): Promise<string | null> {
  const r = await api<{ personajes: unknown[] }>('/partida', { token })
  if (!r.ok) return r.error
  conexion = { cuentaId, token }
  importarPersonajes(cuentaId, r.datos.personajes)
  void refrescarRanking()
  return null
}

/** Se pone al día con lo que diga el servidor (tras una acción, o al volver de una partida). */
export function ponerAlDia(personajes: unknown[]): void {
  if (!conexion) return
  importarPersonajes(conexion.cuentaId, personajes)
  void refrescarRanking()
}

/** Deja la cuenta (al cerrar sesión). */
export function desconectar(): void {
  conexion = null
}
