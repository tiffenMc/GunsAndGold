import { DurableObject } from 'cloudflare:workers'

/**
 * **La sala para jugar con un amigo**, en el servidor (lo mismo que hace `vite.sala.ts` en el
 * ordenador): cada código de 6 letras es una sala con dos sitios, el `anfitrion` (que lleva la
 * partida) y el `invitado`. Todo lo que manda uno le llega al otro, tal cual.
 *
 * Usa los WebSockets que "duermen": mientras nadie manda nada, la sala no gasta.
 */
type Rol = 'anfitrion' | 'invitado'

const otro = (rol: Rol): Rol => (rol === 'anfitrion' ? 'invitado' : 'anfitrion')

export class Sala extends DurableObject {
  private avisar(rol: Rol, mensaje: unknown) {
    for (const ws of this.ctx.getWebSockets(rol)) {
      try {
        ws.send(JSON.stringify(mensaje))
      } catch {
        // Ya se había ido.
      }
    }
  }

  async fetch(peticion: Request): Promise<Response> {
    const rol = new URL(peticion.url).searchParams.get('rol')
    if (peticion.headers.get('upgrade') !== 'websocket' || (rol !== 'anfitrion' && rol !== 'invitado')) {
      return new Response('Aquí se entra con un WebSocket', { status: 426 })
    }
    // Si ya había alguien en ese sitio (se recargó la página), se le cierra al de antes.
    for (const viejo of this.ctx.getWebSockets(rol)) viejo.close(1000, 'Otra conexión ocupa tu sitio')
    const [cliente, servidor] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(servidor, [rol])
    const hayOtro = this.ctx.getWebSockets(otro(rol)).length > 0
    servidor.send(JSON.stringify({ tipo: 'sistema', evento: 'dentro', rol, otro: hayOtro }))
    this.avisar(otro(rol), { tipo: 'sistema', evento: 'entra', rol })
    return new Response(null, { status: 101, webSocket: cliente })
  }

  async webSocketMessage(ws: WebSocket, mensaje: string | ArrayBuffer): Promise<void> {
    const rol = this.ctx.getTags(ws)[0] as Rol | undefined
    if (!rol) return
    for (const destino of this.ctx.getWebSockets(otro(rol))) {
      try {
        destino.send(mensaje)
      } catch {
        // Se fue a medias.
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const rol = this.ctx.getTags(ws)[0] as Rol | undefined
    if (!rol) return
    // Solo avisa si no queda otra conexión suya (la que la sustituyó).
    if (this.ctx.getWebSockets(rol).every((w) => w === ws)) this.avisar(otro(rol), { tipo: 'sistema', evento: 'sale', rol })
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }
}
