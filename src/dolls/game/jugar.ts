import type { JugadaGrabada, Preparativos, Resumen } from '../battle/simulacion'
import { conexionActual } from '../auth/sincronizar'
import { pedirAlServidor } from './hacer'
import { abandonarEncargo, empezarEncargo, mordiscoPorAbandonar, prepararPartida, problemaDelEncargo, terminarEncargo } from './partidas'
import type { Botin, Encargo } from './partidas'
import { getPlayer } from './players'
import type { Player } from './players'

/**
 * **Jugar una partida con premio, del lado del móvil.**
 *
 * 1. Al empezar se pide el **billete** al servidor (con su semilla). Es lo único que se espera, y
 *    va mientras sale el cartel de "VS".
 * 2. La partida se juega **aquí**, sin esperar a nadie: cero retraso.
 * 3. Al acabar, el premio se ve al momento (se calcula aquí con la semilla, igual que lo hará el
 *    servidor) y se mandan las jugadas para que el servidor repita la partida y lo confirme.
 *
 * Sin servidor (`npm run dev`), todo se queda aquí.
 */
export interface Billete {
  /** El billete del servidor (null si se juega sin servidor). */
  partida: string | null
  semilla: number
  prep: Preparativos
}

export async function empezarPartida(encargo: Encargo): Promise<Billete | { error: string }> {
  if (conexionActual()) {
    const r = await pedirAlServidor<{ partida: string; semilla: number; jugador: Player }>({ tipo: 'empezar', encargo })
    if (!r.ok) return { error: r.error }
    // La partida se monta con la foto exacta del personaje que guarda el servidor: así sale igual.
    return { partida: r.datos.partida, semilla: r.datos.semilla, prep: prepararPartida(r.datos.jugador, r.datos.semilla) }
  }
  const problema = problemaDelEncargo(getPlayer(), encargo)
  if (problema) return { error: problema }
  empezarEncargo(encargo)
  const semilla = Math.floor(Math.random() * 2 ** 31)
  return { partida: null, semilla, prep: prepararPartida(getPlayer(), semilla) }
}

/** Se acaba: el premio al momento y, con servidor, las jugadas para que lo confirme. */
export function terminarPartida(billete: Billete, encargo: Encargo, resumen: Resumen, jugadas: JugadaGrabada[]): Botin {
  const botin = terminarEncargo(encargo, billete.semilla, resumen)
  if (billete.partida) void pedirAlServidor({ tipo: 'terminar', partida: billete.partida, jugadas, resumen })
  return botin
}

/** Lo que costaría irse ahora (para avisar antes). */
export function costeDeIrse(billete: Billete | null, encargo: Encargo): { mordida: number; porcentaje: number } {
  return billete ? mordiscoPorAbandonar(encargo, billete.semilla, getPlayer().monedas) : { mordida: 0, porcentaje: 0 }
}

/** Irse a media partida (cuenta como derrota; en la de rango, con su mordisco). */
export function abandonarPartida(billete: Billete | null, encargo: Encargo): void {
  if (!billete) return
  abandonarEncargo(encargo, billete.semilla)
  if (billete.partida) void pedirAlServidor({ tipo: 'abandonar', partida: billete.partida })
}
