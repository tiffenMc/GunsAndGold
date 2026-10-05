import { api } from '../../lib/servidor'
import { conexionActual, ponerAlDia } from '../auth/sincronizar'
import { ejecutarAccion } from './acciones'
import type { Accion, Hecho } from './acciones'
import { getPlayer } from './players'

/**
 * **Hacer algo con tu personaje** (comprar, abrir un sobre, cobrar un encargo, tocar una baraja…).
 *
 * Con cuenta en el servidor, se le pide al servidor: él lo hace con las mismas reglas y contesta
 * cómo te queda todo. Sin servidor (`npm run dev`), se hace aquí mismo.
 *
 * Lo que no da nada (tocar una baraja, ponerse una animación) va **por adelantado**: se hace ya aquí,
 * para que la pantalla no espere, y el servidor lo confirma después.
 */

const ADELANTADAS = new Set<Accion['tipo']>(['guardarBaraja', 'barajaPuesta', 'nuevaBaraja', 'borrarBaraja', 'ponerAnimacion', 'borrarAnimacion', 'perfil'])

/** Para no pisar lo último con una respuesta vieja (las adelantadas pueden ir varias seguidas). */
let ultima = 0

export async function hacer(accion: Accion, cuentaId?: string): Promise<Hecho> {
  const c = conexionActual()
  if (!c) return ejecutarAccion(accion, cuentaId)
  const adelantada = ADELANTADAS.has(accion.tipo)
  if (adelantada) ejecutarAccion(accion, c.cuentaId)
  const numero = ++ultima
  const personaje = accion.tipo === 'crear' ? null : getPlayer().id
  const r = await api<{ personajes: unknown[]; resultado: Hecho }>('/accion', { metodo: 'POST', token: c.token, cuerpo: { personaje, accion } })
  if (!r.ok) return { error: r.error }
  // Si mientras tanto se ha hecho otra cosa por adelantado, ya llegará su respuesta.
  if (!adelantada || numero === ultima) ponerAlDia(r.datos.personajes)
  return r.datos.resultado
}

/** Para las partidas: lo mismo, pero con lo que contesta cada una (billete, semilla…). */
export async function pedirAlServidor<T>(accion: Record<string, unknown> & { tipo: string }): Promise<{ ok: true; datos: T } | { ok: false; error: string }> {
  const c = conexionActual()
  if (!c) return { ok: false, error: 'Sin servidor' }
  const r = await api<{ personajes?: unknown[]; resultado: T }>('/accion', { metodo: 'POST', token: c.token, cuerpo: { personaje: getPlayer().id, accion } })
  if (!r.ok) return { ok: false, error: r.error }
  if (r.datos.personajes) ponerAlDia(r.datos.personajes)
  return { ok: true, datos: r.datos.resultado }
}
