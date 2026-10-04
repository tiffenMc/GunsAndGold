import { DurableObject } from 'cloudflare:workers'
import {
  antesEnElRanking,
  azar,
  idDeUsuario,
  iguales,
  limpiarFicha,
  problemaDeClave,
  problemaDePartida,
  problemaDeUsuario,
  resumirClave,
} from './logica'
import type { FichaGuardada } from './logica'

/**
 * **El pueblo en el servidor**: una sola base de datos (SQLite, dentro de un Durable Object) con las
 * cuentas, sus sesiones, la partida de cada cuenta (sus personajes) y las fichas de Los Más
 * Buscados. Para unos cientos de jugadores, uno solo va sobrado.
 */

type Fila = Record<string, string | number | null>

function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), { status: estado, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

const fallo = (error: string, estado = 400) => json({ error }, estado)

export class Pueblo extends DurableObject {
  private sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS cuentas (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, sal TEXT NOT NULL, hash TEXT NOT NULL, creada INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sesiones (token TEXT PRIMARY KEY, cuenta TEXT NOT NULL, creada INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS partidas (cuenta TEXT PRIMARY KEY, datos TEXT NOT NULL, actualizada INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS fichas (
        cuenta TEXT NOT NULL, id TEXT NOT NULL, nombre TEXT NOT NULL, monedas INTEGER NOT NULL, partidas INTEGER NOT NULL,
        victorias INTEGER NOT NULL, racha INTEGER NOT NULL, look TEXT, animacion TEXT, PRIMARY KEY (cuenta, id)
      );
      CREATE INDEX IF NOT EXISTS fichas_por_rango ON fichas (monedas DESC);
    `)
  }

  private filas(consulta: string, ...valores: (string | number | null)[]): Fila[] {
    return this.sql.exec(consulta, ...valores).toArray() as Fila[]
  }

  /** La cuenta de una sesión (por la cabecera `Authorization: Bearer …`), o null. */
  private cuentaDe(peticion: Request): string | null {
    const token = (peticion.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return null
    const fila = this.filas('SELECT cuenta FROM sesiones WHERE token = ?', token)[0]
    return fila ? String(fila.cuenta) : null
  }

  private nuevaSesion(cuenta: string): string {
    const token = azar(24)
    this.sql.exec('INSERT INTO sesiones (token, cuenta, creada) VALUES (?, ?, ?)', token, cuenta, Date.now())
    return token
  }

  async fetch(peticion: Request): Promise<Response> {
    const url = new URL(peticion.url)
    const ruta = url.pathname.replace(/^\/api/, '')
    try {
      if (ruta === '/salud') return json({ ok: true })
      if (ruta === '/registro' && peticion.method === 'POST') return await this.registro(peticion)
      if (ruta === '/entrar' && peticion.method === 'POST') return await this.entrar(peticion)
      if (ruta === '/salir' && peticion.method === 'POST') return this.salir(peticion)
      if (ruta === '/partida' && peticion.method === 'GET') return this.leerPartida(peticion)
      if (ruta === '/partida' && peticion.method === 'PUT') return await this.guardarPartida(peticion)
      if (ruta === '/ranking' && peticion.method === 'GET') return this.ranking(url)
      return fallo('No existe', 404)
    } catch (e) {
      return fallo(e instanceof SyntaxError ? 'Lo que has mandado no se entiende' : 'Algo ha fallado en el servidor', e instanceof SyntaxError ? 400 : 500)
    }
  }

  private async credenciales(peticion: Request): Promise<{ usuario: string; clave: string }> {
    const cuerpo = (await peticion.json()) as { usuario?: unknown; clave?: unknown }
    return { usuario: typeof cuerpo.usuario === 'string' ? cuerpo.usuario : '', clave: typeof cuerpo.clave === 'string' ? cuerpo.clave : '' }
  }

  private async registro(peticion: Request): Promise<Response> {
    const { usuario, clave } = await this.credenciales(peticion)
    const problema = problemaDeUsuario(usuario) ?? problemaDeClave(clave)
    if (problema) return fallo(problema)
    const id = idDeUsuario(usuario)
    if (this.filas('SELECT id FROM cuentas WHERE id = ?', id).length > 0) return fallo('Ese usuario ya lo tiene otro jugador: elige otro (o entra si es tuyo)', 409)
    const sal = azar()
    const hash = await resumirClave(clave, sal)
    const nombre = usuario.trim()
    this.sql.exec('INSERT INTO cuentas (id, nombre, sal, hash, creada) VALUES (?, ?, ?, ?, ?)', id, nombre, sal, hash, Date.now())
    return json({ usuario: nombre, token: this.nuevaSesion(id) })
  }

  private async entrar(peticion: Request): Promise<Response> {
    const { usuario, clave } = await this.credenciales(peticion)
    const fila = this.filas('SELECT id, nombre, sal, hash FROM cuentas WHERE id = ?', idDeUsuario(usuario))[0]
    if (!fila) return fallo('Ese usuario no existe: créalo con "No tengo cuenta"', 404)
    const hash = await resumirClave(clave, String(fila.sal))
    if (!iguales(hash, String(fila.hash))) return fallo('Esa contraseña no es la suya', 401)
    return json({ usuario: String(fila.nombre), token: this.nuevaSesion(String(fila.id)) })
  }

  private salir(peticion: Request): Response {
    const token = (peticion.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (token) this.sql.exec('DELETE FROM sesiones WHERE token = ?', token)
    return json({ ok: true })
  }

  private leerPartida(peticion: Request): Response {
    const cuenta = this.cuentaDe(peticion)
    if (!cuenta) return fallo('Tienes que entrar otra vez', 401)
    const fila = this.filas('SELECT datos, actualizada FROM partidas WHERE cuenta = ?', cuenta)[0]
    return json({ personajes: fila ? JSON.parse(String(fila.datos)) : [], actualizada: fila ? Number(fila.actualizada) : 0 })
  }

  /** Guarda los personajes de la cuenta y pone al día sus fichas del ranking. */
  private async guardarPartida(peticion: Request): Promise<Response> {
    const cuenta = this.cuentaDe(peticion)
    if (!cuenta) return fallo('Tienes que entrar otra vez', 401)
    const cuerpo = (await peticion.json()) as { personajes?: unknown; fichas?: unknown }
    const problema = problemaDePartida(cuerpo.personajes)
    if (problema) return fallo(problema)
    const fichas = (Array.isArray(cuerpo.fichas) ? cuerpo.fichas : []).map(limpiarFicha).filter((f): f is FichaGuardada => Boolean(f)).slice(0, 6)
    const ahora = Date.now()
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        'INSERT INTO partidas (cuenta, datos, actualizada) VALUES (?, ?, ?) ON CONFLICT (cuenta) DO UPDATE SET datos = excluded.datos, actualizada = excluded.actualizada',
        cuenta,
        JSON.stringify(cuerpo.personajes),
        ahora,
      )
      this.sql.exec('DELETE FROM fichas WHERE cuenta = ?', cuenta)
      for (const f of fichas) {
        this.sql.exec(
          'INSERT INTO fichas (cuenta, id, nombre, monedas, partidas, victorias, racha, look, animacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          cuenta,
          f.id,
          f.nombre,
          f.monedas,
          f.partidas,
          f.victorias,
          f.mejorRacha,
          f.look ? JSON.stringify(f.look) : null,
          f.animacion ? JSON.stringify(f.animacion) : null,
        )
      }
    })
    return json({ ok: true, actualizada: ahora })
  }

  /** Los mejores de todo el pueblo (solo quien ya ha jugado alguna partida). */
  private ranking(url: URL): Response {
    const cuantos = Math.min(50, Math.max(1, Number(url.searchParams.get('n')) || 20))
    const fichas: FichaGuardada[] = this.filas(
      'SELECT id, nombre, monedas, partidas, victorias, racha, look, animacion FROM fichas WHERE partidas > 0 ORDER BY monedas DESC, victorias DESC, partidas ASC LIMIT ?',
      cuantos,
    ).map((f) => ({
      id: String(f.id),
      nombre: String(f.nombre),
      monedas: Number(f.monedas),
      partidas: Number(f.partidas),
      victorias: Number(f.victorias),
      mejorRacha: Number(f.racha),
      look: f.look ? JSON.parse(String(f.look)) : null,
      animacion: f.animacion ? JSON.parse(String(f.animacion)) : null,
    }))
    fichas.sort(antesEnElRanking)
    return json({ fichas })
  }
}
