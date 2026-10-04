/**
 * **El servidor del juego en Cloudflare.** La web (lo de `dist/`) la sirve Cloudflare solo; aquí
 * llegan únicamente:
 *
 * - `/api/…`: cuentas, partidas guardadas y Los Más Buscados (el Durable Object `Pueblo`).
 * - `/sala?codigo=…&rol=…`: las salas para jugar con un amigo (un Durable Object `Sala` por código).
 */
export { Pueblo } from './pueblo'
export { Sala } from './sala'

interface Env {
  ASSETS: Fetcher
  PUEBLO: DurableObjectNamespace
  SALA: DurableObjectNamespace
}

export default {
  async fetch(peticion: Request, env: Env): Promise<Response> {
    const url = new URL(peticion.url)
    if (url.pathname.startsWith('/api/')) {
      // Un solo pueblo para todos.
      return env.PUEBLO.get(env.PUEBLO.idFromName('pueblo')).fetch(peticion)
    }
    if (url.pathname === '/sala') {
      const codigo = (url.searchParams.get('codigo') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      if (codigo.length !== 6) return new Response('Código de sala no válido', { status: 400 })
      return env.SALA.get(env.SALA.idFromName(codigo)).fetch(peticion)
    }
    return env.ASSETS.fetch(peticion)
  },
} satisfies ExportedHandler<Env>
