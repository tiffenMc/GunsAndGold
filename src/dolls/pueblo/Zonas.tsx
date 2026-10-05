import { lazy, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Icono } from '../Icono'
import type { NombreDeIcono } from '../Icono'
import { DECK_BATTLE, DECK_WEAPONS, rarityInfo, rarityOf } from '../cards/model'
import type { CardDef } from '../cards/model'
import { gameCards, useGameCards } from '../cards/store'
import { espera } from '../campo/CampoScreen'
import { claseInfo } from '../game/clases'
import { Avatar } from '../game/Avatar'
import { hastaElCambio } from '../game/objetivos'
import { cartasDeLaBaraja, deckProblem, objetivosDeHoy, usePlayer } from '../game/players'
import { hacer } from '../game/hacer'
import { RANGOS, rangoDe } from '../game/progreso'
import { SalaDeAmigos } from '../red/SalaDeAmigos'
import type { PartidaConAmigo } from '../red/SalaDeAmigos'
import { nextScenario } from '../scenes/scenarios'
import { useEscalaPc } from '../escalaPc'
import { useNow } from '../../hooks/useNow'

const DeckScreen = lazy(() => import('../deck/DeckScreen').then((m) => ({ default: m.DeckScreen })))
const CollectionScreen = lazy(() => import('../collection/CollectionScreen').then((m) => ({ default: m.CollectionScreen })))

/**
 * **Lo que hay dentro de cada sitio.** Al entrar en una casa se abre su panel encima del pueblo
 * (que se queda quieto detrás). Cada uno con su aire: el tablón es de corcho y madera, el bar tiene
 * su barra y sus botellas, el saloon sus puertas batientes…
 */

/** El marco de un sitio por dentro: cabecera con su nombre y el boton de salir a la calle. */
export function PanelDeSitio({
  titulo,
  lema,
  icono,
  color,
  onSalir,
  fondo,
  cabecera,
  children,
  ancho = 760,
}: {
  titulo: string
  lema: string
  icono: NombreDeIcono
  color: string
  onSalir: () => void
  /** El fondo del sitio (un degradado o un patron). */
  fondo: string
  /** Lo que va debajo del titulo (pestañas, por ejemplo). */
  cabecera?: ReactNode
  children: ReactNode
  ancho?: number
}) {
  const escala = useEscalaPc()
  return (
    <div className="absolute inset-0 z-30 flex flex-col" style={{ background: fondo }}>
      <div className="flex h-full flex-col" style={escala > 1 ? { zoom: escala } : undefined}>
        <header className="relative z-10 shrink-0 border-b-4 border-[#120a04] bg-gradient-to-b from-[#4a2c14] to-[#2c190b] px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))] shadow-[0_6px_18px_rgba(0,0,0,0.55)]">
          <div className="mx-auto flex items-center gap-3" style={{ maxWidth: ancho }}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border-2 bg-black/40 text-[26px]" style={{ borderColor: color, color }}>
              <Icono nombre={icono} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-west text-[22px] leading-none text-amber-50" style={{ textShadow: '0 2px 0 #000' }}>
                {titulo}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-amber-100/70">{lema}</p>
            </div>
            <button
              type="button"
              onClick={onSalir}
              data-tuto="salir-sitio"
              className="flex shrink-0 items-center gap-1 rounded-xl border-2 border-amber-300/50 bg-black/45 px-3 py-2 text-[13px] font-bold uppercase tracking-wider text-amber-100 active:scale-95"
            >
              <Icono nombre="salir" /> Salir
            </button>
          </div>
          {cabecera && (
            <div className="mx-auto mt-2" style={{ maxWidth: ancho }}>
              {cabecera}
            </div>
          )}
        </header>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#5a3a1e]/15 px-1 py-1 text-center">
      <p className="font-west text-xl leading-none text-[#3b2410]">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-[#6b4a2a]">{label}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// El tablón de anuncios: SE BUSCA (tu ficha) y los encargos de hoy
// ---------------------------------------------------------------------------

export function TablonPanel({
  onSalir,
  onPersonajes,
  onSobres,
  prize,
  onPrizeSeen,
}: {
  onSalir: () => void
  onPersonajes: () => void
  onSobres: () => void
  prize: CardDef | null
  onPrizeSeen: () => void
}) {
  const player = usePlayer()
  const cards = useGameCards()
  const avatar = cards.find((card) => card.id === player.avatar)
  const rate = player.played > 0 ? Math.round((player.won / player.played) * 100) : 0
  const [cobro, setCobro] = useState<string | null>(null)
  const ahora = useNow(1000)
  const encargos = objetivosDeHoy(player)
  const rango = rangoDe(player.monedas)
  const siguiente = RANGOS.find((escalon) => escalon.desde > player.monedas) ?? null
  const falta = siguiente ? siguiente.desde - player.monedas : 0
  const trecho = siguiente ? Math.min(100, (player.monedas / siguiente.desde) * 100) : 100

  return (
    <PanelDeSitio
      titulo="Tablón de anuncios"
      lema="Se busca: tu ficha, tu rango y los encargos de hoy"
      icono="se_busca"
      color="#fbbf24"
      onSalir={onSalir}
      fondo="radial-gradient(ellipse at 50% 0%, #6b4423 0%, #3b2410 60%, #1f1208 100%)"
    >
      <div className="h-full overflow-y-auto px-3 pb-6 pt-3">
        <div className="tablon mx-auto max-w-[760px] p-3 lg:grid lg:max-w-[1000px] lg:grid-cols-2 lg:gap-4">
          {/* El cartel de SE BUSCA, que eres tú */}
          <div data-tuto="ficha" className="cartel-busca sobre-entra relative px-3 pb-3 pt-5" style={{ rotate: '-0.8deg' }}>
            <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />
            <p className="text-center font-west text-[34px] leading-none tracking-[0.12em] text-[#2a1a10]">SE BUSCA</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar card={avatar} size={86} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-west text-[24px] leading-none text-[#2a1a10]">
                  {player.name}
                  {player.admin && (
                    <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-black tracking-widest text-white">ADMIN</span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-[#5b3a1c]">
                  {player.clase === 'todas' ? '🌟 Todas las clases' : `${claseInfo(player.clase).icon} ${claseInfo(player.clase).singular}`}
                </p>
                <span className="sello mt-1.5" style={{ background: `${rango.color}44`, borderColor: rango.color, color: '#2a1a10' }}>
                  {rango.icon} {rango.label}
                </span>
                <p className="mt-1 text-[12px] text-[#5b3a1c]">
                  {player.unlocked.length}/{cards.length} cartas · {player.decks.length} baraja{player.decks.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {/* La recompensa: tus monedas, que son tu rango */}
            <div data-tuto="bolsa" className="mt-2.5 rounded-xl border-2 border-[#2a1a10] bg-[#2a1a10] px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-200/60">Recompensa</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl text-amber-300">
                  <Icono nombre="monedas" />
                </span>
                <span className="font-west text-[30px] leading-none text-amber-200">{player.monedas}</span>
                <span className="text-[13px] text-amber-200/60">monedas</span>
              </div>
              {siguiente ? (
                <>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full border border-amber-200/30 bg-black/50">
                    <div className="h-full rounded-full" style={{ width: `${trecho}%`, background: rango.color }} />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-amber-100/90">
                    Te faltan <b className="text-amber-200">{falta}</b> monedas para llegar a <b className="text-amber-200">{siguiente.desde}</b>: el
                    siguiente rango.
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-[13px] leading-snug text-amber-100/90">
                  <Icono nombre="ganar" /> Ya estás en lo más alto del Oeste.
                </p>
              )}
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <Stat label="Ganadas" value={String(player.won)} />
              <Stat label="Perdidas" value={String(Math.max(0, player.played - player.won))} />
              <Stat label="% Victoria" value={`${rate}%`} />
              <Stat label="Racha" value={String(player.bestStreak)} />
            </div>
            <button
              type="button"
              onClick={onPersonajes}
              className="mt-2 w-full rounded-xl border-2 border-[#2a1a10]/60 bg-white/40 px-2.5 py-2 text-[12px] font-bold uppercase tracking-wider text-[#2a1a10]"
            >
              <Icono nombre="personaje" /> mis personajes · en la oficina del sheriff
            </button>
          </div>

          <div className="mt-3 space-y-3 lg:mt-0">
            {prize && (
              <button
                type="button"
                onClick={onPrizeSeen}
                className="w-full rounded-xl border-2 border-emerald-300 bg-emerald-500/20 px-3 py-2 text-left text-emerald-50"
              >
                <span className="block text-[13px] uppercase tracking-wider text-emerald-200/80">Carta desbloqueada</span>
                <span className="font-west text-lg leading-none">
                  {prize.name} · {rarityInfo(rarityOf(prize)).label}
                </span>
                <span className="mt-0.5 block text-[12px] text-emerald-100/70">Toca para quitar el aviso</span>
              </button>
            )}

            {/* Los encargos, como notas clavadas */}
            <div data-tuto="encargos" className="papel p-3" style={{ rotate: '0.6deg' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-west text-[18px] leading-none text-[#2a1a10]">Encargos de hoy</p>
                  <p className="mt-1 text-[12px] font-bold text-[#7a4a1c]">
                    <Icono nombre="reloj" /> Cambian a las 00:00 de España · quedan <b>{espera(hastaElCambio(ahora))}</b>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSobres}
                  className={`sello shrink-0 ${
                    player.sobres.length > 0 ? 'border-emerald-700 bg-emerald-500/70 text-[#2a1a10]' : 'border-[#2a1a10]/70 bg-[#2a1a10] text-amber-200'
                  }`}
                  title="Abrir los sobres que te quedan sin abrir"
                >
                  <Icono nombre="sobre" />{' '}
                  {player.sobres.length > 0 ? `Abrir ${player.sobres.length} sobre${player.sobres.length === 1 ? '' : 's'}` : 'Sin sobres que abrir'}
                </button>
              </div>

              {cobro && <p className="mt-2 rounded-lg bg-emerald-900/20 px-2 py-1 text-center text-[13px] font-bold text-[#2a1a10]">{cobro}</p>}
              <div className="mt-2 space-y-1.5">
                {encargos.map(({ objetivo, estado }, n) => {
                  const listo = estado.hechos >= objetivo.meta
                  return (
                    <div
                      key={objetivo.id}
                      className="relative rounded-lg border border-[#2a1a10]/25 bg-white/35 p-1.5 shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                      style={{ rotate: `${(n % 2 ? -1 : 1) * 0.5}deg` }}
                    >
                      <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-rose-700 shadow" />
                      <div className="flex items-center gap-2">
                        <span className="text-xl text-[#7a4a1c]">
                          <Icono nombre={objetivo.id.startsWith('racha') ? 'racha' : objetivo.que === 'ganar' ? 'ganar' : 'jugar'} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#2a1a10]">{objetivo.label}</p>
                          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full border border-[#2a1a10]/50 bg-white/40">
                            <span className="block h-full rounded-full bg-[#7a4a1c]" style={{ width: `${Math.min(100, (estado.hechos / objetivo.meta) * 100)}%` }} />
                          </span>
                        </div>
                        <span className="shrink-0 rounded-lg border border-[#2a1a10]/40 bg-[#2a1a10] px-1.5 py-1 text-[12px] font-bold text-amber-200">
                          {objetivo.premio.tipo === 'sobre' ? (
                            <>
                              <Icono nombre="sobre" /> 1 sobre
                            </>
                          ) : (
                            <>
                              <Icono nombre="monedas" /> {objetivo.premio.cantidad}
                            </>
                          )}
                        </span>
                      </div>
                      {estado.reclamado ? (
                        <p className="mt-1 text-center text-[12px] font-bold uppercase tracking-wider text-emerald-800">
                          <Icono nombre="hecho" /> recompensa reclamada
                        </p>
                      ) : listo ? (
                        <button
                          type="button"
                          onClick={() => {
                            void hacer({ tipo: 'cobrar', objetivo: objetivo.id }).then(({ premio, error }) => {
                              if (!premio) return setCobro(error ?? null)
                              setCobro(premio.tipo === 'sobre' ? '¡Sobre conseguido! Ya lo tienes para abrirlo 📦' : `¡${premio.cantidad} monedas a la bolsa! 💰`)
                            })
                          }}
                          className="boton mt-1 w-full py-1.5 text-[13px]"
                        >
                          <Icono nombre="regalo" /> Reclamar recompensa
                        </button>
                      ) : (
                        <p className="mt-1 text-center text-[12px] text-[#5b3a1c]">
                          {estado.hechos}/{objetivo.meta} · sigue jugando
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelDeSitio>
  )
}

// ---------------------------------------------------------------------------
// El bar: tus cartas y tus barajas
// ---------------------------------------------------------------------------

export type PestanaBar = 'cartas' | 'baraja'

export function BarPanel({ pestana, onPestana, onSalir }: { pestana: PestanaBar; onPestana: (p: PestanaBar) => void; onSalir: () => void }) {
  const player = usePlayer()
  const cards = useGameCards()
  const active = player.decks[player.activeDeck]
  const problem = active ? deckProblem(active, player.unlocked, cards) : 'No tienes baraja'
  return (
    <PanelDeSitio
      titulo="El Bar"
      lema="Pide una ronda: aquí repasas tus cartas y montas tus barajas"
      icono="cartas"
      color="#f59e0b"
      onSalir={onSalir}
      ancho={1180}
      fondo="linear-gradient(180deg, #2a1608 0%, #1a0d05 100%)"
      cabecera={
        <>
          {/* La estantería de botellas, de adorno */}
          <div className="pointer-events-none mb-1.5 flex h-6 items-end justify-center gap-1 overflow-hidden opacity-80" aria-hidden>
            {['#7c2d12', '#166534', '#a16207', '#1e3a8a', '#7c2d12', '#a16207', '#166534', '#4c1d95', '#a16207', '#7c2d12', '#166534'].map((c, i) => (
              <span key={i} className="block w-3 rounded-t-full" style={{ height: 14 + ((i * 7) % 10), background: `linear-gradient(90deg, ${c}, ${c}cc 60%, #ffffff55)` }} />
            ))}
          </div>
          <div className="flex gap-1.5 rounded-xl bg-black/40 p-1">
            {(
              [
                ['cartas', 'cartas', 'Mis cartas', `${player.unlocked.length}/${cards.length}`],
                ['baraja', 'baraja', 'Baraja', problem ? '¡a medias!' : `${DECK_BATTLE}+${DECK_WEAPONS} lista`],
              ] as const
            ).map(([id, icono, label, nota]) => (
              <button
                key={id}
                type="button"
                data-tuto={`bar-${id}`}
                onClick={() => onPestana(id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2 text-[14px] font-bold uppercase tracking-wider transition ${
                  pestana === id ? 'bg-amber-400 text-amber-950 shadow-[0_0_14px_rgba(251,191,36,0.5)]' : 'text-amber-100/70'
                }`}
              >
                <Icono nombre={icono} className="text-xl" /> {label}
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] normal-case ${pestana === id ? 'bg-amber-950/20' : problem && id === 'baraja' ? 'bg-rose-600 text-white' : 'bg-black/40'}`}>
                  {nota}
                </span>
              </button>
            ))}
          </div>
        </>
      }
    >
      <div className="mx-auto h-full w-full max-w-[1180px]">{pestana === 'cartas' ? <CollectionScreen /> : <DeckScreen />}</div>
    </PanelDeSitio>
  )
}

// ---------------------------------------------------------------------------
// El saloon: partida rápida y con amigos
// ---------------------------------------------------------------------------

export function SaloonPanel({
  onSalir,
  onRapida,
  onBaraja,
  onAmigo,
}: {
  onSalir: () => void
  onRapida: () => void
  /** La baraja está a medias: al bar a acabarla. */
  onBaraja: () => void
  onAmigo: (partida: PartidaConAmigo) => void
}) {
  const player = usePlayer()
  const cards = useGameCards()
  const active = player.decks[player.activeDeck]
  const problem = active ? deckProblem(active, player.unlocked, cards) : 'No tienes baraja'
  const [amigos, setAmigos] = useState<'cerrado' | 'crear' | 'unirse'>('cerrado')
  /** Lo que se le manda al amigo: tu baraja (o, si esta a medias, todas las cartas). */
  const mazoParaAmigo = useMemo(() => {
    const suyas = active && !problem ? cartasDeLaBaraja(player, active, cards) : []
    return (suyas.length > 0 ? suyas : gameCards()).map((carta) => carta.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.activeDeck, player.id, problem])

  return (
    <PanelDeSitio
      titulo="El Saloon"
      lema="Aquí se viene a jugar: rápida o con tus amigos"
      icono="partida"
      color="#ef4444"
      onSalir={onSalir}
      fondo="repeating-linear-gradient(90deg, #3b1d0e 0 46px, #33180b 46px 92px)"
    >
      <div className="h-full overflow-y-auto px-3 pb-6 pt-4">
        <div className="mx-auto max-w-[620px]">
          {/* Las puertas batientes del saloon */}
          <div className="pointer-events-none mx-auto -mb-2 flex w-[180px] justify-center gap-1" aria-hidden>
            {[-1, 1].map((lado) => (
              <span
                key={lado}
                className="block h-14 w-[86px] rounded-b-lg border-2 border-[#120a04]"
                style={{
                  background: 'repeating-linear-gradient(90deg, #8a5a2b 0 10px, #6b4423 10px 14px)',
                  transform: `perspective(200px) rotateY(${lado * 18}deg)`,
                  transformOrigin: lado < 0 ? 'left' : 'right',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            data-tuto="rapida"
            onClick={() => (problem ? onBaraja() : onRapida())}
            className="relative mt-4 flex w-full items-center gap-4 rounded-2xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-700 px-4 py-5 text-left shadow-[0_0_26px_rgba(224,180,99,0.45)] transition active:scale-[0.98]"
          >
            <span className="text-5xl text-amber-950">
              <Icono nombre="partida" />
            </span>
            <span>
              <span className="block font-west text-[28px] leading-none text-amber-950">Partida rápida</span>
              <span className="mt-1 block text-[14px] text-amber-950/80">
                Contra un rival al azar, por jugar: <b>no da ni quita monedas</b>
              </span>
              <span className="mt-0.5 block text-[13px] text-amber-950/70">
                {problem ? `Tu baraja está a medias · ${problem} · toca para ir al bar` : `${active?.name} · ${DECK_BATTLE} muñecos + ${DECK_WEAPONS} armas`}
              </span>
            </span>
          </button>

          <div data-tuto="otros-modos" className="mt-3 space-y-2">
            <button type="button" onClick={() => setAmigos('crear')} className="papel flex w-full items-center gap-3 p-3 text-left active:scale-[0.98]">
              <span className="text-4xl text-[#7a4a1c]">
                <Icono nombre="amigos" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-west text-[19px] leading-none">Partida con amigos</span>
                <span className="text-[13px] leading-snug text-[#5b3a1c]">
                  Creas la partida y te da un <b>código</b>; tu amigo lo mete y jugáis. No da ni quita monedas: es por jugar.
                </span>
              </span>
              <span className="text-2xl text-[#2a1a10]/60">›</span>
            </button>
            <button type="button" onClick={() => setAmigos('unirse')} className="papel flex w-full items-center gap-3 p-3 text-left active:scale-[0.98]">
              <span className="text-4xl text-[#7a4a1c]">
                <Icono nombre="codigo" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-west text-[19px] leading-none">Entrar con un código</span>
                <span className="text-[13px] leading-snug text-[#5b3a1c]">Si un amigo te pasa su código, lo metes aquí y juegas contra él. Tampoco da ni quita nada.</span>
              </span>
              <span className="text-2xl text-[#2a1a10]/60">›</span>
            </button>
          </div>

          <p className="pt-4 text-center text-[12px] uppercase tracking-[0.3em] text-amber-100/40">★ Se ruega no disparar al pianista ★</p>
        </div>
      </div>

      {amigos !== 'cerrado' && (
        <SalaDeAmigos
          key={amigos}
          modo={amigos}
          nombre={player.name}
          mazo={mazoParaAmigo}
          escenario={nextScenario(player.lastScenario).id}
          onCerrar={() => setAmigos('cerrado')}
          onEmpezar={onAmigo}
        />
      )}
    </PanelDeSitio>
  )
}

// ---------------------------------------------------------------------------
// El fuerte: la partida de rango
// ---------------------------------------------------------------------------

export function RangoPanel({ onSalir, onJugar, onBaraja }: { onSalir: () => void; onJugar: () => void; onBaraja: () => void }) {
  const player = usePlayer()
  const cards = useGameCards()
  const active = player.decks[player.activeDeck]
  const problem = active ? deckProblem(active, player.unlocked, cards) : 'No tienes baraja'
  const rango = rangoDe(player.monedas)
  const siguiente = RANGOS.find((escalon) => escalon.desde > player.monedas) ?? null
  return (
    <PanelDeSitio
      titulo="El Fuerte"
      lema="Partida de rango: lo que ganas se lo quitas al rival"
      icono="monedas"
      color="#e879f9"
      onSalir={onSalir}
      fondo="linear-gradient(180deg, #3a1f3f 0%, #24121f 55%, #160b08 100%)"
    >
      <div className="h-full overflow-y-auto px-3 pb-6 pt-4">
        <div className="mx-auto max-w-[560px] space-y-3">
          <div className="tablon p-4 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-200/60">Tu rango</p>
            <p className="mt-1 font-west text-[36px] leading-none" style={{ color: rango.color, textShadow: '0 3px 0 #000' }}>
              {rango.icon} {rango.label}
            </p>
            <p className="mt-2 font-west text-[26px] leading-none text-amber-200">
              <Icono nombre="monedas" /> {player.monedas}
            </p>
            <p className="mt-1 text-[13px] text-amber-100/75">
              {siguiente ? `Siguiente rango a las ${siguiente.desde} monedas` : 'Estás en lo más alto del Oeste'}
            </p>
            {/* La escalera de rangos */}
            <div className="mt-3 flex items-end justify-center gap-1">
              {RANGOS.map((r) => {
                const tuyo = r.label === rango.label
                return (
                  <span
                    key={r.label}
                    title={`${r.label} · desde ${r.desde}`}
                    className={`grid w-9 place-items-center rounded-t-md border-2 text-[16px] ${tuyo ? 'border-amber-200' : 'border-black/40 opacity-60'}`}
                    style={{ height: 22 + RANGOS.indexOf(r) * 9, background: `${r.color}${tuyo ? 'cc' : '55'}` }}
                  >
                    {r.icon}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="papel p-3 text-[14px] leading-snug text-[#2a1a10]">
            <p>
              <b>Ganas:</b> te llevas entre 30 y 100 monedas del rival (y puede tocarte una carta nueva).
            </p>
            <p className="mt-1">
              <b>Pierdes:</b> te las quita él. Salirte a mitad cuenta como derrota y también cuesta monedas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => (problem ? onBaraja() : onJugar())}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-fuchsia-200/80 bg-gradient-to-b from-fuchsia-500 to-fuchsia-800 px-4 py-4 font-west text-[26px] leading-none text-white shadow-[0_0_26px_rgba(232,121,249,0.45)] active:scale-[0.98]"
          >
            <Icono nombre="partida" /> {problem ? 'Acaba tu baraja en el bar' : '¡Al duelo!'}
          </button>
        </div>
      </div>
    </PanelDeSitio>
  )
}

/** El viaje en diligencia de un sitio al otro: una cortina con el carro que pasa. */
export function Viaje({ hacia }: { hacia: 'pueblo' | 'desierto' }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#1a0f06]">
      <span className="text-6xl" style={{ animation: 'viaje-traqueteo 0.35s ease-in-out infinite alternate' }}>
        🐎
      </span>
      <p className="font-west text-[26px] text-amber-100" style={{ textShadow: '0 3px 0 #7a2d0c' }}>
        {hacia === 'desierto' ? 'Rumbo al desierto…' : 'De vuelta al pueblo…'}
      </p>
      <p className="text-[13px] uppercase tracking-[0.3em] text-amber-100/50">en diligencia</p>
    </div>
  )
}
