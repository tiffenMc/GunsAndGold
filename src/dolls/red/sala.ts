/**
 * **La conexion con el amigo.** Se entra en una sala con su codigo de 6 letras; el que la crea es el
 * `anfitrion` (su ordenador lleva la partida) y el que entra con el codigo es el `invitado`.
 * Lo que manda uno le llega al otro (ver `vite.sala.ts`, que hace de cartero).
 */
export type Rol = 'anfitrion' | 'invitado'

export type EstadoSala = 'conectando' | 'esperando' | 'juntos' | 'cerrada'

/** Lo que se dicen los dos. */
export type Mensaje =
  | { tipo: 'sistema'; evento: 'dentro'; rol: Rol; otro: boolean }
  | { tipo: 'sistema'; evento: 'entra' | 'sale'; rol: Rol }
  /** El invitado se presenta: su nombre y su baraja. */
  | { tipo: 'hola'; nombre: string; mazo: string[] }
  /** El anfitrion contesta y arranca: su nombre, su baraja y el escenario. */
  | { tipo: 'empieza'; nombre: string; mazo: string[]; escenario: string }
  /** Lo que hace el invitado en la partida (ya en las coordenadas del anfitrion). */
  | { tipo: 'accion'; accion: AccionRemota }
  /** Como va la partida (la manda el anfitrion, ya vista desde el lado del invitado). */
  | { tipo: 'foto'; foto: unknown }

export type AccionRemota =
  | { a: 'carta'; slot: number; x: number; z: number; precision: number; torre: boolean }
  | { a: 'disparo'; posicion: number; destino?: { x: number; z: number } }
  | { a: 'especial'; destino: { x: number; z: number } }
  | { a: 'dinamita'; origen: number; destino: { x: number; z: number } }
  | { a: 'soltarTorre'; unitId: number }
  | { a: 'reroll' }

export interface Sala {
  codigo: string
  rol: Rol
  estado: () => EstadoSala
  enviar: (mensaje: Mensaje) => void
  /** Se apunta a lo que llega. Devuelve como borrarse. */
  alRecibir: (fn: (mensaje: Mensaje) => void) => () => void
  alCambiar: (fn: (estado: EstadoSala) => void) => () => void
  cerrar: () => void
}

export function abrirSala(codigo: string, rol: Rol): Sala {
  const protocolo = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocolo}://${window.location.host}/sala?codigo=${encodeURIComponent(codigo)}&rol=${rol}`)
  let estado: EstadoSala = 'conectando'
  const oyentes = new Set<(m: Mensaje) => void>()
  const vigias = new Set<(e: EstadoSala) => void>()
  const cambiar = (nuevo: EstadoSala) => {
    if (estado === nuevo) return
    estado = nuevo
    for (const fn of vigias) fn(nuevo)
  }
  ws.onmessage = (evento) => {
    let mensaje: Mensaje
    try {
      mensaje = JSON.parse(String(evento.data)) as Mensaje
    } catch {
      return
    }
    if (mensaje.tipo === 'sistema') {
      if (mensaje.evento === 'dentro') cambiar(mensaje.otro ? 'juntos' : 'esperando')
      else if (mensaje.evento === 'entra') cambiar('juntos')
      else if (mensaje.evento === 'sale') cambiar('esperando')
    }
    for (const fn of oyentes) fn(mensaje)
  }
  ws.onclose = () => cambiar('cerrada')
  ws.onerror = () => cambiar('cerrada')
  return {
    codigo,
    rol,
    estado: () => estado,
    enviar: (mensaje) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(mensaje))
    },
    alRecibir: (fn) => {
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },
    alCambiar: (fn) => {
      vigias.add(fn)
      return () => vigias.delete(fn)
    },
    cerrar: () => {
      ws.close()
      cambiar('cerrada')
    },
  }
}
