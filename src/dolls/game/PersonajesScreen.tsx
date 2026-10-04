import { useState } from 'react'
import { todasLasCartasDelJuego } from '../cards/store'
import type { ClaseId } from '../cards/model'
import { MAX_PERSONAJES, claseDisponible, claseInfo, cartasDeClase } from './clases'
import { EleccionDeClase } from './EleccionDeClase'
import { createPlayer, deletePlayer, levelOf, switchPlayer, unlockAll, updatePlayer, usePlayers } from './players'
import type { Player } from './players'
import { BorrarPersonaje } from './BorrarPersonaje'

/**
 * La pantalla de **personajes**: cada cuenta tiene hasta tres, y cada uno es una partida nueva en
 * todo (su clase, sus cartas, sus sobres, su nivel). Al crear uno se elige alias y **clase**: solo
 * jugara con las cartas de esa clase. Si la cuenta aun no tiene ninguno, se abre directamente la
 * creacion.
 */
export function PersonajesScreen({
  cuentaId,
  nombreCuenta,
  onElegido,
  onSalir,
  inicio,
}: {
  cuentaId: string
  nombreCuenta: string
  /** Se llama al elegir (o crear) un personaje; `nuevo` si acaba de nacer (hay que abrirle los sobres). */
  onElegido: (nuevo: boolean) => void
  onSalir: () => void
  /** Con que se abre: la lista de personajes o directamente la creacion de uno nuevo. */
  inicio?: 'lista' | 'crear'
}) {
  const todos = usePlayers()
  const mios = todos.filter((player) => player.cuentaId === cuentaId)
  const [modo, setModo] = useState<'lista' | 'crear'>(mios.length === 0 ? 'crear' : (inicio ?? 'lista'))
  const [aviso, setAviso] = useState<string | null>(null)
  const [aBorrar, setABorrar] = useState<Player | null>(null)
  const cartas = todasLasCartasDelJuego()

  const jugar = (player: Player) => {
    switchPlayer(player.id)
    onElegido(false)
  }

  const crear = (clase: ClaseId | null, nombre: string) => {
    const limpio = nombre.trim()
    if (limpio.length < 1) return setAviso('Ponle nombre a tu personaje')
    if (!clase) return setAviso('Elige una clase')
    if (!claseDisponible(cartas, clase)) return setAviso('Esa clase aún no está lista')
    if (mios.length >= MAX_PERSONAJES) return setAviso(`Solo puedes tener ${MAX_PERSONAJES} personajes`)
    const retrato = cartasDeClase(cartas, clase).find((card) => card.kind === 'batalla')?.id ?? ''
    const nuevo = createPlayer(limpio, retrato, clase, cuentaId)
    // La cuenta "admin" lo tiene todo desde el principio, de cualquier clase.
    if (nombreCuenta.trim().toLowerCase() === 'admin') {
      unlockAll()
      updatePlayer({ admin: true, clase: 'todas', sobres: [] })
    }
    switchPlayer(nuevo.id)
    onElegido(true)
  }

  const borrar = (player: Player) => {
    const problema = deletePlayer(player.id)
    setABorrar(null)
    if (problema) setAviso(problema)
    else {
      // Al borrar, el motor deja puesto otro jugador: se vuelve a la lista de esta cuenta.
      setModo(mios.length <= 1 ? 'crear' : 'lista')
    }
  }

  // Crear un personaje: la escena de elegir bando, a pantalla completa.
  if (modo === 'crear') {
    return (
      <div className="relative h-full">
        <EleccionDeClase
          cartas={cartas}
          aviso={aviso}
          onCrear={(clase, nombre) => crear(clase, nombre)}
          onVolver={
            mios.length > 0
              ? () => {
                  setModo('lista')
                  setAviso(null)
                }
              : onSalir
          }
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col bg-[#150d07]">
      <header className="flex items-center gap-2 border-b border-amber-900/50 bg-[#1b1108] px-3 py-2">
        <div className="flex-1">
          <p className="font-west text-xl leading-none text-amber-100">Tus personajes</p>
          <p className="text-[13px] text-amber-200/60">
            Cuenta: {nombreCuenta} · {mios.length}/{MAX_PERSONAJES} personajes
          </p>
        </div>
        <button type="button" onClick={onSalir} className="rounded-lg border border-amber-300/40 px-2.5 py-1.5 text-[13px] text-amber-100">
          Salir
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="space-y-2.5">
            {mios.map((player) => {
              const info = claseInfo(player.clase)
              const nivel = levelOf(player).level
              return (
                <div key={player.id} className="panel-wood flex items-center gap-3 p-3" style={{ borderColor: info.color }}>
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl"
                    style={{ borderColor: info.color, background: `${info.color}22` }}
                  >
                    {info.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-west text-2xl leading-none text-amber-50">{player.name}</p>
                    <p className="mt-1 text-[13px]" style={{ color: info.color }}>
                      {player.clase === 'todas' ? 'Todas las clases' : info.singular} · nivel {nivel}
                    </p>
                    <p className="text-[12px] text-amber-200/60">
                      {player.unlocked.length} cartas · {player.won}/{player.played} ganadas
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button type="button" onClick={() => jugar(player)} className="btn-gold px-4 text-[15px]">
                      Jugar
                    </button>
                    <button
                      type="button"
                      onClick={() => setABorrar(player)}
                      className="rounded-lg border border-rose-400/30 px-2 py-1 text-[12px] text-rose-200/80"
                    >
                      🗑 Borrar
                    </button>
                  </div>
                </div>
              )
            })}
            {mios.length < MAX_PERSONAJES && (
              <button
                type="button"
                onClick={() => {
                  setModo('crear')
                  setAviso(null)
                }}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300/40 py-5 font-west text-xl text-amber-100/90 active:scale-[0.99]"
              >
                + Nuevo personaje
              </button>
            )}
            <p className="pt-1 text-center text-[13px] leading-snug text-amber-200/50">
              Cada personaje es una partida nueva: su clase, sus cartas, sus sobres y su nivel.
            </p>
          </div>
        {aBorrar && <BorrarPersonaje personaje={aBorrar} onCancelar={() => setABorrar(null)} onBorrar={() => borrar(aBorrar)} />}
        {aviso && <p className="mt-2 rounded-lg bg-rose-500/20 px-2 py-1.5 text-[14px] text-rose-100">{aviso}</p>}
      </div>
    </div>
  )
}
