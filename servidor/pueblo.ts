import { DurableObject } from 'cloudflare:workers'
import {
  abandonarEncargo,
  conJugadores,
  ejecutarAccion,
  empezarEncargo,
  fichaParaElServidor,
  getPlayer,
  prepararPartida,
  problemaDelEncargo,
  Repeticion,
  terminarEncargo,
} from './juego'
import {
  MAX_JUGADAS,
  antesEnElRanking,
  azar,
  idDeUsuario,
  iguales,
  limpiarFicha,
  limpiarJugadas,
  problemaDeClave,
  problemaDeUsuario,
  resumirClave,
  semillaAlAzar,
} from './logica'
import type { FichaGuardada } from './logica'

/**
 * **El pueblo en el servidor**: una sola base de datos (SQLite, dentro de un Durable Object) con las
 * cuentas, sus sesiones, los personajes de cada cuenta, las partidas en juego y las fichas de Los
 * Más Buscados. Para unos cientos de jugadores, uno solo va sobrado.
 *
 * **Aquí manda el servidor.** Los personajes solo cambian por las acciones del juego, que se hacen
 * aquí con las mismas reglas que en el móvil (comprar, abrir sobres, cobrar encargos…). Las
 * partidas con premio llevan un **billete**: al empezar, el servidor da la semilla; al acabar, el
 * móvil manda sus jugadas y el servidor **repite la partida** (a trozos, que el plan gratis solo
 * deja unos milisegundos cada vez) y da el premio según lo que salga de verdad.
 */

type Fila = Record<string, string | number | null>
type Jugador = Record<string, unknown> & { id: string }

/**
 * Los pasos de partida que se repiten en cada trozo. Medido: el trozo más pesado tarda unos 3 ms
 * (y el plan gratis corta a los 10 ms), así que va con margen.
 */
const PASOS_POR_TROZO = 120
/** Una comprobación que lleva más de esto sin acabar (se cortó algo): se da por fallida. */
const VERIFICACION_CADUCA_MS = 2 * 60 * 1000
/** Una partida empezada que no se acaba en este tiempo, se da por abandonada. */
const BILLETE_CADUCA_MS = 20 * 60 * 1000
/** Lo más que espera una acción a que acaben de comprobarse sus partidas. */
const ESPERA_MAXIMA_MS = 25_000

function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), { status: estado, headers: { 'content-type': 'application/json; charset=utf-8' } })
}

const fallo = (error: string, estado = 400) => json({ error }, estado)
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Pueblo extends DurableObject {
  private sql: SqlStorage
  /** Las partidas que se están repitiendo ahora mismo (por billete). */
  private repeticiones = new Map<string, Repeticion>()

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
      CREATE TABLE IF NOT EXISTS billetes (
        id TEXT PRIMARY KEY, cuenta TEXT NOT NULL, personaje TEXT NOT NULL, encargo TEXT NOT NULL, semilla INTEGER NOT NULL,
        jugador TEXT NOT NULL, creada INTEGER NOT NULL, estado TEXT NOT NULL, jugadas TEXT, reclamado TEXT, resultado TEXT, terminada INTEGER
      );
      CREATE INDEX IF NOT EXISTS billetes_por_estado ON billetes (estado, creada);
    `)
  }

  private filas(consulta: string, ...valores: (string | number | null)[]): Fila[] {
    return this.sql.exec(consulta, ...valores).toArray() as Fila[]
  }

  // -------------------------------------------------------------------------
  // Cuentas y sesiones
  // -------------------------------------------------------------------------

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

  /** El id de la cuenta tal y como lo usa el juego para atar sus personajes. */
  private cuentaDelJuego(cuenta: string): string {
    const fila = this.filas('SELECT nombre FROM cuentas WHERE id = ?', cuenta)[0]
    return `local:${fila ? String(fila.nombre) : cuenta}`
  }

  async fetch(peticion: Request): Promise<Response> {
    const url = new URL(peticion.url)
    const ruta = url.pathname.replace(/^\/api/, '')
    try {
      if (ruta === '/salud') return json({ ok: true })
      if (ruta === '/registro' && peticion.method === 'POST') return await this.registro(peticion)
      if (ruta === '/entrar' && peticion.method === 'POST') return await this.entrar(peticion)
      if (ruta === '/salir' && peticion.method === 'POST') return this.salir(peticion)
      if (ruta === '/partida' && peticion.method === 'GET') return await this.leerPartida(peticion)
      if (ruta === '/accion' && peticion.method === 'POST') return await this.accion(peticion)
      if (ruta === '/ranking' && peticion.method === 'GET') return this.ranking(url)
      if (ruta === '/partida' && peticion.method === 'PUT') return fallo('Ahora todo lo guarda el servidor: actualiza el juego', 410)
      return fallo('No existe', 404)
    } catch (e) {
      if (e instanceof SyntaxError) return fallo('Lo que has mandado no se entiende')
      console.error(e)
      return fallo('Algo ha fallado en el servidor', 500)
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

  // -------------------------------------------------------------------------
  // Los personajes de cada cuenta
  // -------------------------------------------------------------------------

  private personajes(cuenta: string): Jugador[] {
    const fila = this.filas('SELECT datos FROM partidas WHERE cuenta = ?', cuenta)[0]
    return fila ? (JSON.parse(String(fila.datos)) as Jugador[]) : []
  }

  /** Guarda los personajes de la cuenta y pone al día sus fichas de Los Más Buscados. */
  private guardar(cuenta: string, jugadores: unknown[]): void {
    const fichas = jugadores
      .map((p) => limpiarFicha(fichaParaElServidor(p as Parameters<typeof fichaParaElServidor>[0])))
      .filter((f): f is FichaGuardada => Boolean(f))
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        'INSERT INTO partidas (cuenta, datos, actualizada) VALUES (?, ?, ?) ON CONFLICT (cuenta) DO UPDATE SET datos = excluded.datos, actualizada = excluded.actualizada',
        cuenta,
        JSON.stringify(jugadores),
        Date.now(),
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
  }

  private async leerPartida(peticion: Request): Promise<Response> {
    const cuenta = this.cuentaDe(peticion)
    if (!cuenta) return fallo('Tienes que entrar otra vez', 401)
    await this.ponerseAlDia(cuenta)
    return json({ personajes: this.personajes(cuenta) })
  }

  // -------------------------------------------------------------------------
  // Las acciones
  // -------------------------------------------------------------------------

  private async accion(peticion: Request): Promise<Response> {
    const cuenta = this.cuentaDe(peticion)
    if (!cuenta) return fallo('Tienes que entrar otra vez', 401)
    const cuerpo = (await peticion.json()) as { personaje?: unknown; accion?: { tipo?: unknown } & Record<string, unknown> }
    const personaje = typeof cuerpo.personaje === 'string' ? cuerpo.personaje : null
    const accion = cuerpo.accion
    if (!accion || typeof accion.tipo !== 'string') return fallo('Falta la acción')
    if (accion.tipo === 'terminar') return this.terminar(cuenta, personaje, accion)

    // Lo que esté pendiente de esta cuenta (partidas por comprobar o abandonadas), primero.
    await this.ponerseAlDia(cuenta)
    const lista = this.personajes(cuenta)
    if (accion.tipo !== 'crear' && !lista.some((p) => p.id === personaje)) return fallo('Ese personaje no es de tu cuenta', 404)

    if (accion.tipo === 'empezar') return this.empezar(cuenta, personaje!, lista, accion)
    if (accion.tipo === 'abandonar') return this.abandonar(cuenta, personaje!, accion)

    const cuentaId = this.cuentaDelJuego(cuenta)
    const r = conJugadores(lista, personaje, () => ejecutarAccion(accion as Parameters<typeof ejecutarAccion>[0], cuentaId))
    if (!r.resultado.error) this.guardar(cuenta, r.jugadores)
    return json({ personajes: r.resultado.error ? lista : r.jugadores, resultado: r.resultado })
  }

  /** Empieza una partida con premio: el billete, con su semilla (y se paga lo que cueste entrar). */
  private empezar(cuenta: string, personaje: string, lista: Jugador[], accion: Record<string, unknown>): Response {
    const encargo = accion.encargo as Parameters<typeof empezarEncargo>[0]
    if (!encargo || typeof encargo !== 'object' || !['libre', 'entreno', 'incursion', 'rango'].includes(String(encargo.tipo))) return fallo('Esa partida no existe')
    // Una partida tuya que se quedó a medias cuenta como abandonada.
    this.abandonarAbiertas(cuenta, personaje)
    const antes = this.personajes(cuenta)
    const r = conJugadores(antes.length > 0 ? antes : lista, personaje, () => {
      const problema = problemaDelEncargo(getPlayer(), encargo)
      if (problema) return { problema }
      empezarEncargo(encargo)
      return { jugador: getPlayer() }
    })
    if ('problema' in r.resultado) return fallo(r.resultado.problema ?? 'No se puede jugar')
    const id = azar(12)
    const semilla = semillaAlAzar()
    this.guardar(cuenta, r.jugadores)
    this.sql.exec(
      'INSERT INTO billetes (id, cuenta, personaje, encargo, semilla, jugador, creada, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      cuenta,
      personaje,
      JSON.stringify({ tipo: encargo.tipo, stat: encargo.stat, incursionId: encargo.incursionId }),
      semilla,
      JSON.stringify(r.resultado.jugador),
      Date.now(),
      'abierta',
    )
    // El móvil monta la partida con la misma foto del personaje que usará el servidor al repetirla.
    return json({ personajes: r.jugadores, resultado: { partida: id, semilla, jugador: r.resultado.jugador } })
  }

  /** Acaba una partida: se apuntan sus jugadas y se pone a la cola para repetirla. */
  private async terminar(cuenta: string, personaje: string | null, accion: Record<string, unknown>): Promise<Response> {
    const id = typeof accion.partida === 'string' ? accion.partida : ''
    const billete = this.filas('SELECT personaje, estado FROM billetes WHERE id = ? AND cuenta = ?', id, cuenta)[0]
    if (!billete || String(billete.personaje) !== personaje) return fallo('Esa partida no es tuya', 404)
    if (billete.estado !== 'abierta') return json({ resultado: { ya: String(billete.estado) } })
    const jugadas = Array.isArray(accion.jugadas) ? accion.jugadas.slice(0, MAX_JUGADAS) : []
    this.sql.exec(
      "UPDATE billetes SET estado = 'verificando', jugadas = ?, reclamado = ?, terminada = ? WHERE id = ?",
      JSON.stringify(jugadas),
      JSON.stringify(accion.resumen ?? null),
      Date.now(),
      id,
    )
    await this.ctx.storage.setAlarm(Date.now())
    return json({ resultado: { ok: true } })
  }

  private abandonar(cuenta: string, personaje: string, accion: Record<string, unknown>): Response {
    const id = typeof accion.partida === 'string' ? accion.partida : ''
    const billete = this.filas("SELECT id FROM billetes WHERE id = ? AND cuenta = ? AND personaje = ? AND estado = 'abierta'", id, cuenta, personaje)[0]
    if (billete) this.abandonarBillete(id)
    return json({ personajes: this.personajes(cuenta), resultado: {} })
  }

  /** Se va de una partida: el mordisco de la de rango y la derrota, como en el móvil. */
  private abandonarBillete(id: string): void {
    const b = this.filas("SELECT cuenta, personaje, encargo, semilla FROM billetes WHERE id = ? AND estado = 'abierta'", id)[0]
    if (!b) return
    const cuenta = String(b.cuenta)
    const r = conJugadores(this.personajes(cuenta), String(b.personaje), () => abandonarEncargo(JSON.parse(String(b.encargo)), Number(b.semilla)))
    this.guardar(cuenta, r.jugadores)
    this.sql.exec("UPDATE billetes SET estado = 'abandonada' WHERE id = ?", id)
  }

  /** Las partidas que se quedaron a medias (del personaje, o caducadas de la cuenta): abandonadas. */
  private abandonarAbiertas(cuenta: string, personaje?: string): void {
    const viejas = this.filas("SELECT id, personaje, creada FROM billetes WHERE cuenta = ? AND estado = 'abierta'", cuenta)
    for (const b of viejas) {
      if (String(b.personaje) === personaje || Date.now() - Number(b.creada) > BILLETE_CADUCA_MS) this.abandonarBillete(String(b.id))
    }
  }

  /** Antes de nada: abandona lo caducado y espera a que se acaben de comprobar sus partidas. */
  private async ponerseAlDia(cuenta: string): Promise<void> {
    this.abandonarAbiertas(cuenta)
    // Una comprobación atascada (no debería pasar) no puede bloquear la cuenta: sin premio y adelante.
    this.sql.exec("UPDATE billetes SET estado = 'fallida' WHERE cuenta = ? AND estado = 'verificando' AND terminada < ?", cuenta, Date.now() - VERIFICACION_CADUCA_MS)
    const hasta = Date.now() + ESPERA_MAXIMA_MS
    while (this.filas("SELECT id FROM billetes WHERE cuenta = ? AND estado = 'verificando' LIMIT 1", cuenta).length > 0 && Date.now() < hasta) {
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now())
      await dormir(40)
    }
  }

  // -------------------------------------------------------------------------
  // Repetir las partidas, a trozos
  // -------------------------------------------------------------------------

  async alarm(): Promise<void> {
    const b = this.filas("SELECT id, cuenta, personaje, encargo, semilla, jugador, jugadas, reclamado, creada FROM billetes WHERE estado = 'verificando' ORDER BY creada LIMIT 1")[0]
    if (!b) return
    const id = String(b.id)
    let rep = this.repeticiones.get(id)
    try {
      if (!rep) {
        // Se monta con la foto exacta del personaje de cuando empezó (la misma que usó el móvil).
        const prep = prepararPartida(JSON.parse(String(b.jugador)), Number(b.semilla))
        rep = new Repeticion(prep, limpiarJugadas(JSON.parse(String(b.jugadas ?? '[]'))))
        this.repeticiones.set(id, rep)
      }
      rep.seguir(PASOS_POR_TROZO)
    } catch (e) {
      // Una partida que no hay forma de repetir no da premio (y no atasca la cola).
      console.error('No se pudo repetir la partida', id, e)
      this.repeticiones.delete(id)
      this.sql.exec("UPDATE billetes SET estado = 'fallida' WHERE id = ?", id)
      await this.ctx.storage.setAlarm(Date.now())
      return
    }
    if (!rep.acabada()) {
      await this.ctx.storage.setAlarm(Date.now())
      return
    }
    this.repeticiones.delete(id)
    const resumen = rep.sim.resumen()
    const cuenta = String(b.cuenta)
    const encargo = JSON.parse(String(b.encargo))
    const r = conJugadores(this.personajes(cuenta), String(b.personaje), () => terminarEncargo(encargo, Number(b.semilla), resumen, Number(b.creada)))
    this.guardar(cuenta, r.jugadores)
    const reclamado = JSON.parse(String(b.reclamado ?? 'null')) as { ganada?: boolean; bajas?: number; perdidas?: number } | null
    const coincide = Boolean(reclamado && reclamado.ganada === resumen.ganada && reclamado.bajas === resumen.bajas && reclamado.perdidas === resumen.perdidas)
    if (!coincide) console.warn('Partida que no cuadra', id, { reclamado, resumen })
    this.sql.exec("UPDATE billetes SET estado = 'verificada', resultado = ? WHERE id = ?", JSON.stringify({ resumen, coincide }), id)
    // Si hay más en la cola, a por la siguiente.
    if (this.filas("SELECT id FROM billetes WHERE estado = 'verificando' LIMIT 1").length > 0) await this.ctx.storage.setAlarm(Date.now())
  }

  // -------------------------------------------------------------------------
  // Los Más Buscados
  // -------------------------------------------------------------------------

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
