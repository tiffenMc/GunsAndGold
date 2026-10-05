/**
 * **Hablar con el servidor del juego** (el de Cloudflare, ver `servidor/`). Si no hay servidor (por
 * ejemplo con `npm run dev`), el juego sigue funcionando como antes: todo en este dispositivo.
 */

let comprobado: Promise<boolean> | null = null

/** Si hay servidor (se mira una vez y se recuerda). */
export function hayServidor(): Promise<boolean> {
  comprobado ??= fetch('/api/salud', { headers: { accept: 'application/json' } })
    .then(async (r) => r.ok && (r.headers.get('content-type') ?? '').includes('json') && Boolean(((await r.json()) as { ok?: boolean }).ok))
    .catch(() => false)
  return comprobado
}

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; error: string; estado: number }

/** Una llamada a la API: devuelve los datos o el error ya en cristiano. */
export async function api<T>(
  ruta: string,
  { metodo = 'GET', cuerpo, token, alSalir = false }: { metodo?: string; cuerpo?: unknown; token?: string; alSalir?: boolean } = {},
): Promise<Respuesta<T>> {
  try {
    const peticion: RequestInit = {
      method: metodo,
      headers: {
        accept: 'application/json',
        ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    }
    // Al cerrar la página, que lo último llegue igual.
    ;(peticion as { keepalive?: boolean }).keepalive = alSalir
    const r = await fetch(`/api${ruta}`, peticion)
    const datos = (await r.json().catch(() => ({}))) as T & { error?: string }
    if (!r.ok) return { ok: false, error: datos.error ?? 'El servidor no contesta bien', estado: r.status }
    return { ok: true, datos }
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor', estado: 0 }
  }
}
