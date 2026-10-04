/**
 * Que jugador es de que cuenta: cada cuenta (la del dispositivo o la de la nube) tiene **su propio
 * jugador**, con sus cartas, sus sobres y sus monedas. Al entrar con otra cuenta, se entra con su
 * partida, no con la del vecino.
 */

const KEY = 'oeste-cuenta-jugador-v1'

function leer(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {}
  } catch {
    return {}
  }
}

/** Con qué jugador va esa cuenta (o null si es la primera vez que entra). */
export function jugadorDeCuenta(cuentaId: string): string | null {
  return leer()[cuentaId] ?? null
}

/** Ata la cuenta a un jugador. */
export function atarJugador(cuentaId: string, jugadorId: string): void {
  const mapa = leer()
  mapa[cuentaId] = jugadorId
  try {
    localStorage.setItem(KEY, JSON.stringify(mapa))
  } catch {
    // Si no se puede guardar, se ata solo en memoria: se volverá a preguntar la próxima vez.
  }
}
