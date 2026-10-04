import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import type { Plugin } from 'vite'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

/**
 * **Las salas para jugar con un amigo**, sin subir nada a ningun servidor: el propio servidor de
 * desarrollo hace de cartero. Cada sala tiene un codigo de 6 letras y dos sitios (el que la crea,
 * `anfitrion`, y el que entra, `invitado`). Todo lo que manda uno le llega al otro, tal cual.
 *
 * Con `npm run amigos` el servidor se abre a internet con un tunel (ver `scripts/puente.mjs`), asi
 * que tu amigo puede entrar desde su casa.
 */
type Rol = 'anfitrion' | 'invitado'

interface Sala {
  anfitrion?: WebSocket
  invitado?: WebSocket
}

export function salaRelay(): Plugin {
  return {
    name: 'salas-de-amigos',
    configureServer(server) {
      const salas = new Map<string, Sala>()
      const wss = new WebSocketServer({ noServer: true })

      const avisar = (ws: WebSocket | undefined, mensaje: unknown) => {
        if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(mensaje))
      }

      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const url = new URL(req.url ?? '/', 'http://x')
        if (url.pathname !== '/sala') return
        const codigo = (url.searchParams.get('codigo') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
        const rol = url.searchParams.get('rol') as Rol | null
        if (codigo.length !== 6 || (rol !== 'anfitrion' && rol !== 'invitado')) {
          socket.destroy()
          return
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          const sala = salas.get(codigo) ?? {}
          salas.set(codigo, sala)
          const otroRol: Rol = rol === 'anfitrion' ? 'invitado' : 'anfitrion'
          // Si ya habia alguien en ese sitio (se recargo la pagina), se le cierra al de antes.
          sala[rol]?.close()
          sala[rol] = ws
          // Los dos se enteran de quien esta.
          avisar(ws, { tipo: 'sistema', evento: 'dentro', rol, otro: Boolean(sala[otroRol]) })
          avisar(sala[otroRol], { tipo: 'sistema', evento: 'entra', rol })

          ws.on('message', (datos) => {
            const otro = sala[otroRol]
            if (otro && otro.readyState === otro.OPEN) otro.send(datos.toString())
          })
          ws.on('close', () => {
            if (sala[rol] !== ws) return
            delete sala[rol]
            avisar(sala[otroRol], { tipo: 'sistema', evento: 'sale', rol })
            if (!sala.anfitrion && !sala.invitado) salas.delete(codigo)
          })
        })
      })
    },
  }
}
