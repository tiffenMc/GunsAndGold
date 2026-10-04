import { useState } from 'react'
import type { BattleCard } from '../cards/model'
import { useGameCards } from '../cards/store'
import { Avatar } from './Avatar'
import {
  createPlayer,
  defaultUnlocked,
  deletePlayer,
  levelOf,
  switchPlayer,
  unlockAll,
  updatePlayer,
  usePlayer,
  usePlayers,
} from './players'
import type { Player } from './players'
import { CLASES, MAX_PERSONAJES, claseInfo } from './clases'
import { BorrarPersonaje } from './BorrarPersonaje'

/**
 * El menu de jugador: quien esta jugando, cambiar de jugador, dar de alta a otro y retocar el
 * nombre y el retrato. Cada jugador guarda sus cartas desbloqueadas y sus barajas.
 */
export function PlayerScreen({
  cuenta,
  onPersonajes,
}: {
  /** Con cuenta: se enseña la pantalla de la cuenta y sus personajes. */
  cuenta?: { id: string; nombre: string }
  onPersonajes?: (modo: 'lista' | 'crear') => void
} = {}) {
  const player = usePlayer()
  const players = usePlayers()
  const cards = useGameCards()
  const [editing, setEditing] = useState<'nuevo' | 'actual' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const cardOf = (id: string) => cards.find((card) => card.id === id)

  if (cuenta && onPersonajes) return <PantallaCuenta cuenta={cuenta} onPersonajes={onPersonajes} />

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-amber-900/50 bg-[#1b1108] px-3 py-2">
        <div className="flex-1">
          <p className="font-west text-xl leading-none text-amber-100">Jugador</p>
          <p className="text-[13px] text-amber-200/60">
            {players.length} {players.length === 1 ? 'jugador' : 'jugadores'} en este dispositivo
          </p>
        </div>
        <button type="button" onClick={() => setEditing('nuevo')} className="btn-gold text-[14px]">
          + Nuevo
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="panel-wood space-y-3 p-3">
          <div className="flex items-center gap-3">
            <Avatar card={cardOf(player.avatar)} size={84} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-west text-2xl leading-none text-amber-50">
                {player.name}
                {player.admin && (
                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[12px] font-black tracking-widest text-white">ADMIN</span>
                )}
              </p>
              <p className="mt-1 text-[13px] text-amber-200/70">
                {claseInfo(player.clase).icon} {player.clase === 'todas' ? 'Todas las clases' : claseInfo(player.clase).singular} ·{' '}
                {player.unlocked.length} cartas · {player.decks.length} {player.decks.length === 1 ? 'baraja' : 'barajas'} ·{' '}
                {player.won}/{player.played} partidas ganadas
              </p>
              <button
                type="button"
                onClick={() => setEditing('actual')}
                className="mt-2 rounded-md border border-[#5a3a1e]/50 bg-[#5a3a1e]/10 px-3 py-1.5 text-[13px] text-amber-100 active:scale-95"
              >
                ✎ Cambiar nombre o retrato
              </button>
            </div>
          </div>
          {player.admin && (
            <button
              type="button"
              onClick={() => {
                unlockAll()
                setNotice('Todas las cartas desbloqueadas')
              }}
              className="w-full rounded-lg border border-amber-300/60 bg-amber-400/15 px-3 py-2 text-[14px] text-amber-50"
            >
              🔓 Desbloquear todas las cartas (admin)
            </button>
          )}
          {notice && <p className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[14px] text-emerald-100">{notice}</p>}
        </div>

        {(
          <>
        <p className="mb-1.5 mt-4 text-[13px] uppercase tracking-[0.2em] text-amber-200/60">Cambiar de jugador</p>
        <div className="space-y-1.5">
          {players.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-xl border-2 px-2 py-2 ${
                item.id === player.id ? 'border-amber-300/70 bg-amber-400/10' : 'border-amber-900/50 bg-black/30'
              }`}
            >
              <Avatar card={cardOf(item.avatar)} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-[15px] text-amber-50">
                  {item.name}
                  {item.admin && <span className="rounded bg-rose-600 px-1 text-[11px] font-black tracking-wider text-white">ADMIN</span>}
                </p>
                <p className="text-[12px] text-amber-200/60">
                  {item.unlocked.length} cartas · {item.won}/{item.played} ganadas
                </p>
              </div>
              {item.id === player.id ? (
                <span className="rounded-full bg-emerald-500/25 px-2 py-1 text-[12px] font-bold text-emerald-100">✓ Jugando</span>
              ) : (
                <button
                  type="button"
                  onClick={() => switchPlayer(item.id)}
                  className="rounded-lg border border-amber-300/50 bg-black/40 px-3 py-1.5 text-[13px] text-amber-100 active:scale-95"
                >
                  Entrar
                </button>
              )}
              {item.id !== player.id && !item.admin && (
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`¿Borrar a «${item.name}»? Se van sus barajas y sus cartas.`)) return
                    setNotice(deletePlayer(item.id))
                  }}
                  className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1.5 text-[13px] text-rose-100"
                  title="Borrar jugador"
                >
                  🗑
                </button>
              )}
            </div>
          ))}
        </div>

          </>
        )}

        <p className="mt-3 text-[13px] leading-snug text-amber-200/50">
          Un jugador nuevo arranca con las cartas normales y especiales: le llegan para armar su baraja. Las
          épicas y las divinas se van ganando partida a partida.
        </p>
      </div>

      {editing && (
        <PlayerEditor
          player={editing === 'actual' ? player : null}
          onClose={() => setEditing(null)}
          onDone={(name) => setNotice(name)}
        />
      )}
    </div>
  )
}

/** Alta y retoque de jugador: nombre y retrato de entre los muñecos desbloqueados. */
function PlayerEditor({
  player,
  onClose,
  onDone,
}: {
  /** Si viene, se esta retocando ese jugador; si no, se crea uno nuevo. */
  player: Player | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const cards = useGameCards()
  const allowed = player ? player.unlocked : defaultUnlocked(cards)
  const battles = cards.filter((card): card is BattleCard => card.kind === 'batalla' && allowed.includes(card.id))
  const [name, setName] = useState(player?.name ?? '')
  const [avatar, setAvatar] = useState(player?.avatar ?? battles[0]?.id ?? 'vaquero')
  const save = () => {
    if (player) {
      updatePlayer({ name: name.trim() || player.name, avatar })
      onDone('Perfil guardado')
    } else {
      const created = createPlayer(name, avatar)
      onDone(`¡${created.name} está dentro!`)
    }
    onClose()
  }
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="panel w-full max-w-sm space-y-3 p-5">
        <div className="text-center">
          <p className="font-west text-2xl text-amber-50">{player ? 'Tu perfil' : 'Nuevo jugador'}</p>
          <p className="mt-1 text-sm text-amber-100/70">Elige alias y el muñeco de tu cartel.</p>
        </div>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tu alias"
          maxLength={16}
          className="w-full rounded-xl border border-amber-300/25 bg-black/40 px-3 py-2 font-west text-lg text-amber-50 outline-none placeholder:text-amber-100/40 focus:border-amber-300/70"
        />
        <div className="grid max-h-[40vh] grid-cols-4 gap-1.5 overflow-y-auto pr-1">
          {battles.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setAvatar(card.id)}
              className={`rounded-lg p-0.5 ${avatar === card.id ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-black/30'}`}
              title={card.name}
            >
              <Avatar card={card} size={64} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button type="button" onClick={save} className="btn-primary flex-1">
            {player ? 'Guardar' : 'Crear jugador'}
          </button>
        </div>
      </div>
    </div>
  )
}


/**
 * La pantalla de **tu cuenta**: que cuenta es, cuantos personajes tienes (y cuantos te caben), a
 * cual estas jugando, y las tres clases explicadas. Todo lo que hace falta para no perderse.
 */
function PantallaCuenta({
  cuenta,
  onPersonajes,
}: {
  cuenta: { id: string; nombre: string }
  onPersonajes: (modo: 'lista' | 'crear') => void
}) {
  const actual = usePlayer()
  const todos = usePlayers()
  const cards = useGameCards()
  const mios = todos.filter((player) => player.cuentaId === cuenta.id)
  const [editing, setEditing] = useState(false)
  const [aBorrar, setABorrar] = useState<Player | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const libres = Math.max(0, MAX_PERSONAJES - mios.length)
  const clase = claseInfo(actual.clase)
  const cardOf = (id: string) => cards.find((card) => card.id === id)

  return (
    <div className="relative flex h-full flex-col">
      <header className="border-b border-amber-900/50 bg-[#1b1108] px-3 py-2">
        <p className="font-west text-xl leading-none text-amber-100">Mi cuenta</p>
        <p className="mt-0.5 text-[13px] text-amber-200/60">Aquí ves tus personajes y creas los que te falten</p>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {/* Que es esto */}
        <div className="panel-wood space-y-1.5 p-3">
          <p className="flex items-center gap-2 text-[13px] uppercase tracking-[0.18em] text-amber-200/60">
            🔑 Cuenta
          </p>
          <p className="font-west text-2xl leading-none text-amber-50">{cuenta.nombre}</p>
          <p className="text-[14px] leading-snug text-amber-100/85">
            Con esta cuenta puedes tener <b>hasta {MAX_PERSONAJES} personajes</b>. Cada personaje es una{' '}
            <b>partida nueva en todo</b>: eliges una clase y empiezas de cero con las cartas de esa clase.
          </p>
          <p className="rounded-lg bg-black/30 px-2 py-1.5 text-[14px] text-amber-100">
            Tienes <b>{mios.length}</b> de {MAX_PERSONAJES} personajes
            {libres > 0 ? (
              <>
                {' '}
                · te {libres === 1 ? 'queda' : 'quedan'} <b>{libres}</b> {libres === 1 ? 'hueco libre' : 'huecos libres'}
              </>
            ) : (
              ' · ya no te caben más'
            )}
          </p>
        </div>

        {/* Los tres huecos de personaje */}
        <div>
          <p className="mb-1.5 text-[13px] uppercase tracking-[0.2em] text-amber-200/60">Tus personajes</p>
          <div className="space-y-2">
            {Array.from({ length: MAX_PERSONAJES }).map((_, i) => {
              const personaje = mios[i]
              if (!personaje) {
                return (
                  <button
                    key={`libre-${i}`}
                    type="button"
                    onClick={() => onPersonajes('crear')}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-amber-300/45 bg-black/20 p-3 text-left active:scale-[0.99]"
                  >
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300/40 text-3xl text-amber-200/70">
                      ＋
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-west text-xl leading-none text-amber-100">Crear personaje</span>
                      <span className="mt-0.5 block text-[13px] text-amber-200/70">
                        Hueco {i + 1} libre · elige nombre y clase (Vaquero, Indio o Vikingo)
                      </span>
                    </span>
                  </button>
                )
              }
              const info = claseInfo(personaje.clase)
              const jugando = personaje.id === actual.id
              return (
                <div
                  key={personaje.id}
                  className="flex items-center gap-3 rounded-2xl border-2 p-3"
                  style={{ borderColor: jugando ? info.color : 'rgba(120,80,40,0.6)', background: jugando ? `${info.color}1f` : 'rgba(0,0,0,0.3)' }}
                >
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl"
                    style={{ borderColor: info.color, background: `${info.color}22` }}
                  >
                    {info.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-west text-xl leading-none text-amber-50">{personaje.name}</span>
                    <span className="mt-0.5 block text-[13px]" style={{ color: info.color }}>
                      {personaje.clase === 'todas' ? 'Todas las clases' : info.singular} · nivel {levelOf(personaje).level}
                    </span>
                    <span className="block text-[12px] text-amber-200/60">
                      {personaje.unlocked.length} cartas · {personaje.won}/{personaje.played} ganadas
                    </span>
                  </span>
                  <span className="flex flex-col items-stretch gap-1">
                    {jugando ? (
                      <span className="rounded-full bg-emerald-500/25 px-2.5 py-1.5 text-center text-[13px] font-bold text-emerald-100">
                        ✓ Jugando
                      </span>
                    ) : (
                      <button type="button" onClick={() => switchPlayer(personaje.id)} className="btn-gold px-3 text-[14px]">
                        Jugar con él
                      </button>
                    )}
                    {!jugando && (
                      <button
                        type="button"
                        onClick={() => setABorrar(personaje)}
                        className="rounded-lg border border-rose-400/30 px-2 py-1 text-[12px] text-rose-200/80"
                      >
                        🗑 Borrar
                      </button>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
          {aviso && <p className="mt-2 rounded-lg bg-rose-500/20 px-2 py-1.5 text-[14px] text-rose-100">{aviso}</p>}
        </div>

        {/* El personaje con el que juegas ahora */}
        <div className="panel-wood space-y-2 p-3">
          <p className="text-[13px] uppercase tracking-[0.18em] text-amber-200/60">Jugando ahora</p>
          <div className="flex items-center gap-3">
            <Avatar card={cardOf(actual.avatar)} size={64} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-west text-2xl leading-none text-amber-50">{actual.name}</p>
              <p className="mt-0.5 text-[14px]" style={{ color: clase.color }}>
                {clase.icon} {actual.clase === 'todas' ? 'Todas las clases' : clase.singular}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-[#5a3a1e]/50 bg-[#5a3a1e]/10 px-2.5 py-1.5 text-[13px] text-amber-100 active:scale-95"
            >
              ✎ Cambiar nombre o retrato
            </button>
          </div>
          {actual.clase !== 'todas' && (
            <p className="rounded-lg bg-black/30 px-2 py-1.5 text-[14px] leading-snug text-amber-100">
              <b style={{ color: clase.color }}>Tu clase:</b> {clase.pasiva}
            </p>
          )}
          {actual.admin && (
            <button
              type="button"
              onClick={() => unlockAll()}
              className="w-full rounded-lg border border-amber-300/60 bg-amber-400/15 px-3 py-2 text-[14px] text-amber-50"
            >
              🔓 Desbloquear todas las cartas (admin)
            </button>
          )}
        </div>

        {/* Las clases, explicadas */}
        <div>
          <p className="mb-1.5 text-[13px] uppercase tracking-[0.2em] text-amber-200/60">Las 3 clases</p>
          <div className="space-y-2">
            {CLASES.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-900/50 bg-black/25 p-2.5">
                <p className="flex items-center gap-2 font-west text-lg leading-none" style={{ color: item.color }}>
                  <span className="text-2xl">{item.icon}</span> {item.label}
                  <span className="text-[13px] font-sans font-bold text-amber-100/80">· {item.lema}</span>
                </p>
                <p className="mt-1 text-[13px] leading-snug text-amber-200/75">{item.descripcion}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-amber-100/90">
                  <b style={{ color: item.color }}>Pasiva:</b> {item.pasiva}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-amber-200/55">{item.armas}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editing && <PlayerEditor player={actual} onClose={() => setEditing(false)} onDone={() => undefined} />}
      {aBorrar && (
        <BorrarPersonaje
          personaje={aBorrar}
          onCancelar={() => setABorrar(null)}
          onBorrar={() => {
            setAviso(deletePlayer(aBorrar.id))
            setABorrar(null)
          }}
        />
      )}
    </div>
  )
}
