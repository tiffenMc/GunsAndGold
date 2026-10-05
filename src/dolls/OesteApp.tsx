import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icono } from './Icono'
import type { ReactNode } from 'react'
import { arquetipoInfo } from './cards/arquetipos'
import type { BattleCard, CardDef } from './cards/model'
import { gameCards, todasLasCartasDelJuego, useGameCards } from './cards/store'
import { useAuth } from '../hooks/useAuth'
import { PuertaScreen } from './auth/PuertaScreen'
import { cerrarSesionLocal, useCuentaLocal } from './auth/cuentasLocales'
import { conectarCuenta, estaConectada } from './auth/sincronizar'
import { jugadorDeCuenta } from './auth/cuentaJugador'
import { PersonajesScreen } from './game/PersonajesScreen'
import { atarPersonaje, objetivosDeHoy, personajesDe, pintaDe, players, sobresPendientes, switchPlayer } from './game/players'
import { EN_LA_TARIMA, useRanking } from './game/ranking'
import { rangoDe } from './game/progreso'
import { abandonarPartida, costeDeIrse, empezarPartida, terminarPartida } from './game/jugar'
import type { Billete } from './game/jugar'
import type { Botin, Encargo, Premio } from './game/partidas'
import { Entrenar, Incursiones, espera } from './campo/CampoScreen'
import { useNow } from '../hooks/useNow'
import { SobreScreen } from './sobres/SobreScreen'
import type { Mision } from './campo/CampoScreen'
import { PortraitBaker } from './card3d/portraits'
import { Avatar } from './game/Avatar'
import { CARACTERISTICAS, caracteristicaInfo } from './game/caracteristicas'
import { horaDeCambio, incursionesDeLaHora, puedePagar } from './game/incursiones'
import { cartasDeLaBaraja, deckProblem, getPlayer, updatePlayer, usePlayer } from './game/players'

import { SCENARIOS, nextScenario } from './scenes/scenarios'
import { SettingsModal } from './settings/SettingsModal'
import { SafeCanvas } from './SafeCanvas'
import { useEscalaPc } from './escalaPc'
import { Tutorial, marcarTutorialPendiente, tutorialPendiente } from './tutorial/Tutorial'
import type { PantallaDelTour } from './tutorial/TourDeMenus'
import type { PartidaConAmigo } from './red/SalaDeAmigos'
import { Logo } from './Logo'
import { MundoScreen } from './pueblo/MundoScreen'
import type { InfoDeSitio } from './pueblo/MundoScreen'
import { MUNDOS, guardarPosicion, sitioDe } from './pueblo/lugares'
import type { Lugar, Zona } from './pueblo/lugares'
import { BarPanel, PanelDeSitio, RangoPanel, SaloonPanel, TablonPanel, Viaje } from './pueblo/Zonas'
import type { PestanaBar } from './pueblo/Zonas'
import { BuscadosPanel } from './pueblo/BuscadosPanel'
import { SastreriaPanel } from './pueblo/SastreriaPanel'

const BattleScreen = lazy(() => import('./battle/BattleScreen').then((m) => ({ default: m.BattleScreen })))
const PlayerScreen = lazy(() => import('./game/PlayerScreen').then((m) => ({ default: m.PlayerScreen })))

/** Fuera de la batalla se está en el mundo: el pueblo o el desierto (con o sin un sitio abierto). */
type Screen = 'mundo' | 'batalla'

/** `?ir=` (de antes, cuando habia pestañas) lleva al sitio que hace lo mismo. */
function destinoInicial(): { lugar: Lugar; zona: Zona | null; pestana: PestanaBar } {
  const ir = new URLSearchParams(window.location.search).get('ir')
  switch (ir) {
    case 'coleccion':
      return { lugar: 'pueblo', zona: 'bar', pestana: 'cartas' }
    case 'mazo':
      return { lugar: 'pueblo', zona: 'bar', pestana: 'baraja' }
    case 'campo':
    case 'desierto':
      return { lugar: 'desierto', zona: null, pestana: 'cartas' }
    case 'jugador':
      return { lugar: 'pueblo', zona: 'sheriff', pestana: 'cartas' }
    default:
      return { lugar: 'pueblo', zona: null, pestana: 'cartas' }
  }
}

/** Columna vertical tipo movil, tambien en PC. */
/**
 * El marco de la app. Los menus aprovechan la pantalla (hasta 1180 px, que en un ordenador es lo
 * que cuesta que las cartas se vean bien) y la batalla, que es vertical, se queda con forma de
 * movil pero lo mas grande que quepa en alto.
 */
export function Column({ children, batalla = false }: { children: ReactNode; batalla?: boolean }) {
  return (
    <div
      // En los menús, el atardecer del Oeste ocupa la pantalla entera (en PC también a los lados).
      className={`relative h-[100dvh] w-full ${batalla ? 'bg-[#0c0804]' : 'fondo-oeste'}`}
      // Fuera del marco de la batalla no se deja un negro vacio: un atardecer del Oeste oscuro.
      style={batalla ? { background: 'radial-gradient(ellipse at 50% 100%, #5a2a14 0%, #2a140a 45%, #0c0804 100%)' } : undefined}
    >
      <div
        className={`relative z-[1] mx-auto h-full w-full overflow-hidden ${batalla ? 'bg-[#150c05] shadow-[0_0_70px_rgba(0,0,0,0.85)]' : ''}`}
        style={{ maxWidth: batalla ? 'min(100vw, calc(100dvh * 9 / 16))' : 1180 }}
      >
        {children}
      </div>
    </div>
  )
}

export function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 font-west text-xl text-amber-100/80">
      <Logo ancho="min(260px, 64vw)" rayos />
      <span className="animate-pulse" style={{ textShadow: '0 2px 6px #000' }}>Ensillando…</span>
    </div>
  )
}

/**
 * La barra de arriba del mundo: tu careto, tu rango, tus monedas, los sobres por abrir y los
 * ajustes. Lo justo: el resto está en los sitios del pueblo.
 */
function BarraDeArriba({ lugar, onSobres, onAjustes, onFicha }: { lugar: Lugar; onSobres: () => void; onAjustes: () => void; onFicha: () => void }) {
  const player = usePlayer()
  const cards = useGameCards()
  const avatar = cards.find((card) => card.id === player.avatar)
  const rango = rangoDe(player.monedas)
  const escala = useEscalaPc()
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 px-2 pt-[max(8px,env(safe-area-inset-top))]"
      style={escala > 1 ? { zoom: escala } : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onFicha}
          data-tuto="hud-ficha"
          className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border-2 border-[#6b4423] bg-[#1a0f06]/85 py-1 pl-1 pr-3 backdrop-blur-[2px] active:scale-95"
        >
          <Avatar card={avatar} size={40} />
          <span className="min-w-0 text-left">
            <span className="block truncate font-west text-[15px] leading-none text-amber-50">{player.name}</span>
            <span className="mt-0.5 block truncate text-[11px] font-bold leading-none" style={{ color: rango.color }}>
              {rango.icon} {rango.label}
            </span>
          </span>
        </button>
        <span className="pointer-events-none mt-1 hidden rounded-full bg-black/45 px-3 py-1 font-west text-[14px] text-amber-100/90 sm:block">
          {lugar === 'pueblo' ? '🤠 El pueblo' : '🏜️ El desierto'}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-[#6b4423] bg-[#1a0f06]/85 px-2.5 py-1 font-west text-[16px] text-amber-200">
            <span title="Monedas (tu rango)">
              <Icono nombre="monedas" /> {player.monedas}
            </span>
            <span className="text-yellow-300" title="Lingotes de oro">
              <Icono nombre="lingotes" /> {player.lingotes}
            </span>
            <span className="text-cyan-300" title="Diamantes">
              <Icono nombre="diamantes" /> {player.diamantes}
            </span>
          </span>
          {player.sobres.length > 0 && (
            <button
              type="button"
              onClick={onSobres}
              className="tuto-latido pointer-events-auto relative grid h-10 w-10 place-items-center rounded-full border-2 border-emerald-400 bg-emerald-700/90 text-[20px] text-white"
              title="Abrir sobres"
            >
              <Icono nombre="sobre" />
              <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-black">
                {player.sobres.length}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onAjustes}
            data-tuto="nav-ajustes"
            title="Ajustes"
            className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border-2 border-[#6b4423] bg-[#1a0f06]/85 text-[22px] text-amber-100"
          >
            <Icono nombre="ajustes" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * El mundo (pueblo o desierto) con todo lo que lleva: los carteles de cada sitio con lo que hay
 * ahora, el tablón con tu nombre, los carteles del cañón y la gente de la calle.
 */
function Mundo({
  lugar,
  pausado,
  onEntrar,
  children,
}: {
  lugar: Lugar
  pausado: boolean
  onEntrar: (zona: Zona) => void
  children: ReactNode
}) {
  const player = usePlayer()
  const cards = useGameCards()
  // Cada medio minuto basta para los carteles (cuánto falta para las incursiones, etc.).
  const ahora = useNow(30_000)
  const munecos = useMemo(() => cards.filter((card): card is BattleCard => card.kind === 'batalla'), [cards])
  const retrato = munecos.find((card) => card.id === player.avatar) ?? munecos[0]
  // Tu vaquero va por la calle con tu pinta (la de la Sastrería).
  const pinta = useMemo(() => pintaDe(player), [player])
  const tuyo = useMemo(() => (retrato ? { ...retrato, look: pinta } : undefined), [retrato, pinta])
  // La gente de la calle: unos cuantos muñecos del juego, siempre los mismos.
  const vecinos = useMemo(
    () => munecos.filter((card) => card.id !== retrato?.id).filter((_, i) => i % 5 === 2).slice(0, 7),
    [munecos, retrato?.id],
  )
  // Los cinco mejores para la tarima de la plaza (de todos los jugadores, si hay servidor).
  const { fichas: lista } = useRanking(players())
  const buscados = useMemo(() => lista.slice(0, EN_LA_TARIMA), [lista])
  const active = player.decks[player.activeDeck]
  const problema = active ? deckProblem(active, player.unlocked, cards) : 'No tienes baraja'
  const encargos = objetivosDeHoy(player)
  const porCobrar = encargos.filter(({ objetivo, estado }) => estado.hechos >= objetivo.meta && !estado.reclamado).length
  const incursiones = incursionesDeLaHora(ahora, player.clase)
  const pagables = incursiones.filter((inc) => puedePagar(player.caracteristicas, inc.coste)).length
  const media = Math.round(CARACTERISTICAS.reduce((suma, item) => suma + player.caracteristicas[item.id], 0) / CARACTERISTICAS.length)
  const rango = rangoDe(player.monedas)

  const info: Partial<Record<Zona, InfoDeSitio>> = {
    tablon: { texto: porCobrar > 0 ? `¡${porCobrar} encargo${porCobrar === 1 ? '' : 's'} para cobrar!` : 'Tu ficha y los encargos', aviso: porCobrar },
    bar: { texto: problema ? '¡Tu baraja está a medias!' : `${player.unlocked.length}/${cards.length} cartas`, aviso: problema ? 1 : 0 },
    ranking: { texto: buscados[0] ? `Nº1: ${buscados[0].nombre} · ${buscados[0].monedas} monedas` : '¡Se busca al primero!' },
    sastreria: { texto: `${player.lingotes} lingotes · ${player.diamantes} diamantes` },
    saloon: { texto: 'Partida rápida · con amigos' },
    sheriff: { texto: 'Tu perfil y personajes' },
    diligencia: { texto: lugar === 'pueblo' ? 'Incursiones · rango · entrenar' : 'Vuelta al pueblo' },
    incursiones: { texto: `Puedes entrar en ${pagables} de ${incursiones.length} · cambian en ${espera(horaDeCambio(ahora) - ahora)}`, aviso: pagables },
    entrenar: { texto: `Media de tus características: ${media}%` },
    rango: { texto: `${rango.icon} ${rango.label} · ${player.monedas} monedas` },
  }
  const nombres = incursiones.map((inc) => cards.find((card) => card.id === inc.cardId)?.name ?? '???')

  if (!tuyo) return <Loading />
  return (
    <MundoScreen
      key={lugar}
      lugar={lugar}
      card={tuyo}
      vecinos={vecinos}
      pausado={pausado}
      info={info}
      tablon={{
        nombre: player.name,
        recompensa: `${player.monedas} MONEDAS`,
        encargos: encargos.map(({ objetivo, estado }) => ({
          texto: `${Math.min(estado.hechos, objetivo.meta)}/${objetivo.meta}`,
          hecho: estado.hechos >= objetivo.meta && !estado.reclamado,
        })),
      }}
      carteles={nombres}
      buscados={buscados}
      onEntrar={onEntrar}
    >
      {children}
    </MundoScreen>
  )
}

/** Lo que te llevas de la partida (o lo que te ha faltado): va dentro del cartel del final. */
function PremioDetalle({ premio }: { premio: Premio }) {
  const cards = useGameCards()
  const card =
    premio.tipo === 'carta'
      ? premio.card
      : premio.tipo === 'incursion'
        ? cards.find((item) => item.id === premio.cardId)
        : undefined
  const tipo = premio.tipo === 'carta' ? premio.arquetipo : premio.tipo === 'incursion' ? premio.arquetipo : undefined
  const info = tipo ? arquetipoInfo(tipo) : undefined

  const titulo =
    premio.tipo === 'carta'
      ? '¡Carta nueva!'
      : premio.tipo === 'entreno'
        ? '¡Entreno hecho!'
        : premio.tipo === 'entreno-fallo'
          ? 'Te han tumbado'
          : premio.tipo === 'incursion'
            ? premio.nueva
              ? '¡CARTA CONSEGUIDA!'
              : '¡Trozo de carta!'
            : 'Reto no cumplido'
  const color =
    premio.tipo === 'entreno-fallo' || premio.tipo === 'incursion-fallo'
      ? '#fca5a5'
      : premio.tipo === 'incursion' || premio.tipo === 'carta'
        ? '#fde68a'
        : '#86efac'

  return (
    <div className="w-full space-y-2 rounded-xl border border-amber-300/30 bg-black/45 p-3 text-center">
      <div className="space-y-2">
        <p className="font-west text-[22px] leading-none" style={{ color, textShadow: '0 3px 0 #1a0d04' }}>
          {titulo}
        </p>

        {premio.tipo === 'carta' && card && (
          <p className="text-[15px] text-amber-100">
            <b className="font-west">{card.name}</b> ya es tuya
            {info && (
              <>
                {' '}
                y ha salido <b style={{ color: info.color }}>{info.label}</b> · {info.note}
              </>
            )}
            .
          </p>
        )}

        {premio.tipo === 'entreno' && (
          <p className="text-[15px] text-amber-100">
            {caracteristicaInfo(premio.stat).icon} <b>{caracteristicaInfo(premio.stat).label}</b> sube{' '}
            <b className="text-emerald-200">+{Math.round(premio.subido)}%</b>
          </p>
        )}

        {premio.tipo === 'entreno-fallo' && (
          <p className="text-[15px] text-amber-100">
            Has caído entrenando {caracteristicaInfo(premio.stat).label.toLowerCase()}. Prueba otra vez: no cuesta nada.
          </p>
        )}

        {premio.tipo === 'incursion' && card && (
          <p className="text-[15px] text-amber-100">
            Te llevas <b className="text-emerald-200">+{premio.porcentaje}%</b> de{' '}
            <b className="font-west">{card.name}</b>.
            {premio.nueva ? ' ¡Ya puedes equiparla!' : ` Llevas el ${Math.round(premio.llevo)}%.`}
            {premio.nueva && info && (
              <>
                {' '}
                Su tipo: <b style={{ color: info.color }}>{info.label}</b> · {info.note}.
              </>
            )}
          </p>
        )}

        {premio.tipo === 'incursion-fallo' && (
          <p className="text-[15px] text-amber-100">
            Pedía <b>{premio.incursion.reto.nota.toLowerCase()}</b> y no salió: tumbaste {premio.resumen.bajas} tropas,
            perdiste {premio.resumen.perdidas} y acabaste con el fuerte al {Math.round(premio.resumen.fuerte)}%.
          </p>
        )}

      </div>
    </div>
  )
}

/**
 * **La partida con un amigo.** Tu baraja contra la suya, en el escenario que puso el que creo la
 * sala. El que la creo la lleva en su ordenador; el otro la ve y juega desde el suyo. Es por jugar:
 * ni da ni quita nada.
 */
function PartidaAmigo({ amigo, onSalir }: { amigo: PartidaConAmigo; onSalir: () => void }) {
  const player = usePlayer()
  const cards = useGameCards()
  const active = player.decks[player.activeDeck]
  // Las cartas de las tres clases: tu amigo puede jugar con otra clase que tú.
  const porId = new Map(todasLasCartasDelJuego().map((carta) => [carta.id, carta]))
  // Tu baraja, la misma que le mandaste (con los tipos de tirador de tus cartas, si las tienes).
  const tuyas = new Map((active ? cartasDeLaBaraja(player, active, cards) : []).map((carta) => [carta.id, carta]))
  const deck = amigo.miMazo.map((id) => tuyas.get(id) ?? porId.get(id)).filter((carta): carta is CardDef => Boolean(carta))
  const suyo = amigo.rival.mazo.map((id) => porId.get(id)).filter((carta): carta is CardDef => Boolean(carta))
  const escenario = SCENARIOS.find((item) => item.id === amigo.escenario) ?? SCENARIOS[0]!
  const red = useMemo(() => ({ rol: amigo.rol, sala: amigo.sala }), [amigo])
  const salir = () => {
    amigo.sala.cerrar()
    onSalir()
  }
  return (
    <SafeCanvas
      note=""
      fallback={
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="font-west text-xl text-amber-100">Este dispositivo no puede dibujar la batalla</p>
          <button type="button" onClick={salir} className="btn-gold">
            Volver al pueblo
          </button>
        </div>
      }
    >
      <BattleScreen
        scenario={escenario}
        deck={deck.length > 0 ? deck : gameCards()}
        botDeck={suyo.length > 0 ? suyo : gameCards()}
        etiqueta={`Contra ${amigo.rival.nombre}`}
        red={red}
        onExit={salir}
        resultado={<p className="text-[13px] text-amber-100/80">Partida con {amigo.rival.nombre}: es por jugar, no da ni quita nada.</p>}
      />
    </SafeCanvas>
  )
}

/** Lo que se juega, en lo justo para el servidor (la incursión, por su id). */
export function encargoDe(mision: Mision): Encargo {
  return { tipo: mision.tipo, stat: mision.stat, incursionId: mision.incursion?.id }
}

/**
 * La partida contra el bot con tu baraja puesta, en un escenario distinto al de la ultima vez.
 * Sirve para todo: partida libre, de rango, entreno de una caracteristica e incursion de carta.
 *
 * Al empezar se pide el billete (con la semilla) al servidor; la partida se juega aquí, sin
 * esperas, y al acabar el premio sale al momento y el servidor lo confirma (ver `game/jugar.ts`).
 */
function Partida({
  mision,
  onLeave,
  onBillete,
}: {
  mision: Mision
  onLeave: (terminada: boolean) => void
  /** El billete de la partida que se está jugando (para saber lo que cuesta irse). */
  onBillete: (billete: Billete | null) => void
}) {
  const player = usePlayer()
  const cards = useGameCards()
  const encargo = useMemo(() => encargoDe(mision), [mision])
  const incursion = mision.tipo === 'incursion' ? mision.incursion : undefined
  const cartaDeLaIncursion = incursion ? cards.find((card) => card.id === incursion.cardId) : undefined
  const etiqueta =
    mision.tipo === 'entreno' && mision.stat
      ? `Entreno · ${caracteristicaInfo(mision.stat).label}`
      : incursion
        ? `Incursión · ${cartaDeLaIncursion?.name ?? ''} · ${incursion.reto.label}`
        : undefined
  /** Lo que se ha llevado (o perdido) al acabar: sale en el cartel del final, no en otra ventana. */
  const [botin, setBotin] = useState<Botin | null>(null)
  /** Ya ha acabado: salir es gratis. Mientras se juega, salir siempre penaliza. */
  const [terminada, setTerminada] = useState(false)
  /** El billete de la partida (con su semilla y la partida montada), o el error si no se pudo. */
  const [billete, setBillete] = useState<Billete | { error: string } | null>(null)
  const [match, setMatch] = useState(() => {
    // ?escenario=mina fuerza el primero (para probar); luego siguen al azar.
    const forced = SCENARIOS.find((item) => item.id === new URLSearchParams(window.location.search).get('escenario'))
    // (Sin tocar el perfil aqui dentro: eso se apunta en el efecto de abajo, no mientras se pinta.)
    return { key: 1, scenario: forced ?? nextScenario(player.lastScenario) }
  })
  // Cada partida nueva (y cada revancha) pide su billete.
  useEffect(() => {
    let viva = true
    setBillete(null)
    onBillete(null)
    void empezarPartida(encargo).then((b) => {
      if (!viva) return
      setBillete(b)
      onBillete('error' in b ? null : b)
    })
    updatePlayer({ lastScenario: match.scenario.id })
    return () => {
      viva = false
    }
    // Solo al salir una partida nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.key])
  const otra = () => {
    setBotin(null)
    setTerminada(false)
    setMatch((current) => ({ key: current.key + 1, scenario: nextScenario(current.scenario.id) }))
  }

  if (!billete) return <Loading />
  if ('error' in billete) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-west text-xl text-amber-100">No se ha podido empezar la partida</p>
        <p className="text-[14px] text-amber-100/80">{billete.error}</p>
        <button type="button" onClick={() => onLeave(true)} className="btn-gold">
          Volver
        </button>
      </div>
    )
  }
  const { monedas, tesoro, premio } = botin ?? { monedas: null, tesoro: null, premio: null }
  return (
    <SafeCanvas
      note=""
      fallback={
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="font-west text-xl text-amber-100">Este dispositivo no puede dibujar la batalla</p>
          <button type="button" onClick={() => onLeave(true)} className="btn-gold">
            Volver al pueblo
          </button>
        </div>
      }
    >
      <BattleScreen
        key={match.key}
        scenario={match.scenario}
        prep={billete.prep}
        deck={billete.prep.mazos[0]}
        botDeck={billete.prep.mazos[1]}
        etiqueta={etiqueta}
        onExit={() => onLeave(terminada)}
        onFinish={(_won, _segundos, resumen, jugadas) => {
          setTerminada(true)
          // El premio, al momento (el servidor lo confirma repitiendo la partida).
          setBotin(terminarPartida(billete, encargo, resumen, jugadas))
        }}
        resultado={
          premio || monedas !== null ? (
            <>
              {monedas !== null && (
                <p className="font-west text-[30px] leading-none" style={{ color: monedas >= 0 ? '#86efac' : '#fca5a5' }}>
                  {monedas >= 0 ? '+' : '−'}
                  {Math.abs(monedas)} <Icono nombre="monedas" />
                </p>
              )}
              {tesoro && (
                <p className="flex items-center justify-center gap-3 font-west text-[22px] leading-none">
                  <span className="text-amber-300">
                    +{tesoro.lingotes} <Icono nombre="lingotes" />
                  </span>
                  {tesoro.diamantes > 0 && (
                    <span className="sobre-entra text-cyan-300" style={{ textShadow: '0 0 12px #22d3ee' }}>
                      ¡+{tesoro.diamantes} <Icono nombre="diamantes" />!
                    </span>
                  )}
                </p>
              )}
              {premio && <PremioDetalle premio={premio} />}
            </>
          ) : null
        }
        // Al acabar se busca otra al momento (las incursiones se pagan al entrar: esas no).
        onRematch={mision.tipo === 'incursion' ? undefined : otra}
      />
    </SafeCanvas>
  )
}

export function OesteApp() {
  const auth = useAuth()
  /** La cuenta rápida de este dispositivo (usuario y contraseña), si se ha entrado con ella. */
  const cuenta = useCuentaLocal()
  const inicial = useMemo(() => destinoInicial(), [])
  const [screen, setScreen] = useState<Screen>('mundo')
  /** Donde anda tu vaquero (el pueblo o el desierto) y el sitio en el que ha entrado, si alguno. */
  const [lugar, setLugar] = useState<Lugar>(inicial.lugar)
  const [zona, setZona] = useState<Zona | null>(inicial.zona)
  const [pestanaBar, setPestanaBar] = useState<PestanaBar>(inicial.pestana)
  /** La cortina del viaje en diligencia. */
  const [viaje, setViaje] = useState<Lugar | null>(null)
  const [prize, setPrize] = useState<CardDef | null>(null)
  const [ajustes, setAjustes] = useState(false)
  /** El aviso de abandonar una partida de rango (con lo que te cuesta). */
  const [abandono, setAbandono] = useState<{ mordida: number; porcentaje: number } | null>(null)
  /** Solo en desarrollo: entrar sin cuenta para poder probar el juego. */
  const [invitado, setInvitado] = useState(false)
  /** El sobre que se está abriendo. */
  const [sobres, setSobres] = useState(false)
  /** El tutorial: sale solo al crear un personaje (y desde Ajustes, cuando se quiera). */
  const [tutorial, setTutorial] = useState(false)
  /** La partida con un amigo (cuando ya estais los dos en la sala). */
  const [amigo, setAmigo] = useState<PartidaConAmigo | null>(null)
  const cards = useGameCards()

  /** Ir a un sitio de golpe (el tutorial, o al acabar una partida). */
  const abrir = useCallback((donde: Lugar, sitio: Zona | null, pestana?: PestanaBar) => {
    setScreen('mundo')
    setLugar(donde)
    setZona(sitio)
    if (pestana) setPestanaBar(pestana)
  }, [])
  /** El tutorial va enseñando los sitios: los abre él. */
  const irDelTutorial = useCallback(
    (pantalla: PantallaDelTour) => {
      const destinos: Record<PantallaDelTour, [Lugar, Zona | null, PestanaBar?]> = {
        pueblo: ['pueblo', null],
        tablon: ['pueblo', 'tablon'],
        saloon: ['pueblo', 'saloon'],
        cartas: ['pueblo', 'bar', 'cartas'],
        baraja: ['pueblo', 'bar', 'baraja'],
        desierto: ['desierto', null],
        incursiones: ['desierto', 'incursiones'],
        entrenar: ['desierto', 'entrenar'],
        rango: ['desierto', 'rango'],
      }
      const [donde, sitio, pestana] = destinos[pantalla]
      abrir(donde, sitio, pestana)
    },
    [abrir],
  )
  const acabarTutorial = () => {
    setTutorial(false)
    marcarTutorialPendiente(getPlayer().id, false)
    abrir('pueblo', null)
    // Al acabar (o al omitirlo), los sobres de inicio que queden por abrir.
    if (sobresPendientes(getPlayer()) > 0) setSobres(true)
  }

  /** Has llegado a la puerta de un sitio: se entra (o se sube a la diligencia). */
  const entrar = (sitio: Zona) => {
    if (sitio !== 'diligencia') {
      setZona(sitio)
      return
    }
    const otro: Lugar = lugar === 'pueblo' ? 'desierto' : 'pueblo'
    // Se baja de la diligencia en la parada del otro lado.
    const parada = sitioDe(MUNDOS[otro], 'diligencia')
    if (parada) guardarPosicion(otro, parada.puerta)
    setViaje(otro)
    window.setTimeout(() => {
      setLugar(otro)
      setZona(null)
      setViaje(null)
    }, 1300)
  }
  const salirALaCalle = () => setZona(null)

  /**
   * Si la cuenta vive en el servidor, al abrir el juego se trae su partida (lo último que se jugó,
   * en este móvil o en otro) antes de elegir personaje.
   */
  const [conectada, setConectada] = useState(() => !cuenta?.token || estaConectada(cuenta.token))
  /** Si no se ha podido hablar con el servidor al abrir (sin conexión): se ofrece reintentar. */
  const [sinConexion, setSinConexion] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    setSinConexion(null)
    if (!cuenta?.token || estaConectada(cuenta.token)) {
      setConectada(true)
      return
    }
    setConectada(false)
    let vivo = true
    void conectarCuenta(`local:${cuenta.usuario}`, cuenta.token).then((fallo) => {
      if (!vivo) return
      if (!fallo) return setConectada(true)
      // La sesión ya no vale (p. ej. se cerró en otro sitio): a la puerta, a entrar otra vez.
      if (/entrar otra vez/.test(fallo)) {
        cerrarSesionLocal()
        setConectada(true)
      } else setSinConexion(fallo)
    })
    return () => {
      vivo = false
    }
  }, [cuenta?.token, cuenta?.usuario, intento])

  /** La cuenta con la que se ha entrado (del dispositivo o de la nube), si hay. */
  const cuentaId = cuenta ? `local:${cuenta.usuario}` : auth.user ? `nube:${auth.user.id}` : null
  const nombreCuenta =
    cuenta?.usuario ??
    (auth.user?.user_metadata?.name as string | undefined) ??
    auth.user?.email?.split('@')[0] ??
    'Forastero'
  /** Si ya se ha elegido personaje en esta sesion (si no, se enseña la pantalla de personajes). */
  const [personajeListo, setPersonajeListo] = useState(false)
  /** Si se esta gestionando los personajes desde el menu (lista o creacion), por encima del juego. */
  const [gestion, setGestion] = useState<'lista' | 'crear' | null>(null)

  /**
   * Cerrar sesión: fuera la cuenta del dispositivo, la de la nube y el invitado de pruebas, y se
   * cierra todo lo que hubiera abierto. Se vuelve a la puerta.
   */
  const cerrarSesion = () => {
    cerrarSesionLocal()
    setInvitado(false)
    setAjustes(false)
    setTutorial(false)
    setSobres(false)
    setGestion(null)
    setPersonajeListo(false)
    setZona(null)
    setScreen('mundo')
    void auth.signOut()
  }

  /**
   * **Cada cuenta tiene hasta tres personajes**, y cada uno es una partida nueva en todo. Al entrar:
   * el jugador de antes (de cuando una cuenta solo tenia uno) pasa a ser su primer personaje; si hay
   * un unico personaje se entra con el directamente, y si no se enseña la pantalla de personajes
   * (elegir uno o crear el primero).
   */
  useEffect(() => {
    setPersonajeListo(false)
    if (!cuentaId) return
    const atado = jugadorDeCuenta(cuentaId)
    if (atado) atarPersonaje(atado, cuentaId)
    const suyos = personajesDe(cuentaId)
    if (suyos.length === 1) {
      switchPlayer(suyos[0]!.id)
      setPersonajeListo(true)
      // Si se cerró el juego a medio tutorial, vuelve a salir.
      if (tutorialPendiente(suyos[0]!.id)) setTutorial(true)
    }
  }, [cuentaId])
  /** Lo que se está jugando ahora mismo (partida libre, entreno o incursión). */
  const [mision, setMision] = useState<Mision>({ tipo: 'libre' })
  /** Al salir de la batalla se vuelve a donde se fue a jugar. */
  const salirDeLaPartida = () => {
    if (mision.tipo === 'libre') abrir('pueblo', null)
    else if (mision.tipo === 'rango') abrir('desierto', null)
    else if (mision.tipo === 'entreno') abrir('desierto', 'entrenar')
    else abrir('desierto', 'incursiones')
    setMision({ tipo: 'libre' })
  }
  /** El billete de la partida que se está jugando (con su semilla: lo que cuesta irse sale de ahí). */
  const billete = useRef<Billete | null>(null)
  const jugar = (siguiente: Mision) => {
    // Las incursiones se pagan al entrar (al pedir el billete): eso es el desgaste del intento.
    setMision(siguiente)
    setZona(null)
    setScreen('batalla')
  }
  /** La baraja está a medias: al bar, a la pestaña de la baraja. */
  const alBarAAcabarla = () => abrir('pueblo', 'bar', 'baraja')

  return (
    <>
      <SafeCanvas note="">
        <PortraitBaker />
      </SafeCanvas>
      <Column batalla={screen === 'batalla'}>
        {/* La puerta: sin cuenta no se juega. */}
        {sinConexion ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <Logo ancho="min(220px, 60vw)" />
            <p className="font-west text-xl text-amber-100">No hay conexión con el pueblo</p>
            <p className="text-[14px] text-amber-100/80">{sinConexion}. Tus cosas están a salvo en el servidor.</p>
            <button type="button" className="btn-gold" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
            <button type="button" className="text-[13px] text-amber-100/70 underline" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        ) : !auth.ready || !conectada ? (
          <Loading />
        ) : !auth.user && !cuenta && !invitado ? (
          // Con usuario (cuenta del dispositivo), con la nube o con el invitado de desarrollo.
          <PuertaScreen onInvitado={import.meta.env.DEV ? () => setInvitado(true) : undefined} />
        ) : cuentaId && (!personajeListo || gestion) ? (
          // Con cuenta: primero se elige personaje (o se crea el primero, con su clase).
          <PersonajesScreen
            cuentaId={cuentaId}
            nombreCuenta={nombreCuenta}
            inicio={gestion ?? undefined}
            onElegido={(nuevo) => {
              setPersonajeListo(true)
              setGestion(null)
              abrir('pueblo', null)
              // Personaje nuevo: primero el tutorial; los sobres de inicio se abren al acabarlo.
              if (nuevo) {
                marcarTutorialPendiente(getPlayer().id, true)
                setTutorial(true)
              } else if (tutorialPendiente(getPlayer().id)) setTutorial(true)
            }}
            onSalir={() => {
              if (gestion) {
                // Venia del menu: se vuelve al juego sin cambiar nada.
                setGestion(null)
                return
              }
              cerrarSesion()
            }}
          />
        ) : (
        <Suspense fallback={<Loading />}>
          <div className="relative h-full">
            {screen === 'mundo' && (
              <SafeCanvas
                fallback={
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="font-west text-xl text-amber-100">Este dispositivo no puede dibujar el pueblo en 3D</p>
                    <div className="grid w-full max-w-[320px] gap-2">
                      {(
                        [
                          ['pueblo', 'tablon', 'Tablón de anuncios'],
                          ['pueblo', 'bar', 'El Bar (cartas y baraja)'],
                          ['pueblo', 'saloon', 'El Saloon (jugar)'],
                          ['desierto', 'incursiones', 'Incursiones'],
                          ['desierto', 'entrenar', 'Entrenar'],
                          ['desierto', 'rango', 'Partida de rango'],
                        ] as const
                      ).map(([donde, sitio, label]) => (
                        <button key={sitio} type="button" className="boton py-2 text-[14px]" onClick={() => abrir(donde, sitio)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                <Mundo lugar={lugar} pausado={zona !== null || viaje !== null || ajustes} onEntrar={entrar}>
                  <BarraDeArriba lugar={lugar} onSobres={() => setSobres(true)} onAjustes={() => setAjustes(true)} onFicha={() => abrir('pueblo', 'tablon')} />
                </Mundo>
              </SafeCanvas>
            )}

            {/* Los sitios por dentro */}
            {screen === 'mundo' && zona === 'tablon' && (
              <TablonPanel
                onSalir={salirALaCalle}
                onPersonajes={() => setZona('sheriff')}
                onSobres={() => setSobres(true)}
                prize={prize}
                onPrizeSeen={() => setPrize(null)}
              />
            )}
            {screen === 'mundo' && zona === 'ranking' && <BuscadosPanel onSalir={salirALaCalle} onJugar={() => abrir('desierto', 'rango')} />}
            {screen === 'mundo' && zona === 'sastreria' && <SastreriaPanel onSalir={salirALaCalle} />}
            {screen === 'mundo' && zona === 'bar' && <BarPanel pestana={pestanaBar} onPestana={setPestanaBar} onSalir={salirALaCalle} />}
            {screen === 'mundo' && zona === 'saloon' && (
              <SaloonPanel
                onSalir={salirALaCalle}
                onBaraja={alBarAAcabarla}
                onRapida={() => jugar({ tipo: 'libre' })}
                onAmigo={(partida) => {
                  setAmigo(partida)
                  setZona(null)
                  setScreen('batalla')
                }}
              />
            )}
            {screen === 'mundo' && zona === 'sheriff' && (
              <PanelDeSitio
                titulo="Oficina del Sheriff"
                lema="Tu perfil, tu cuenta y tus personajes"
                icono="personaje"
                color="#60a5fa"
                onSalir={salirALaCalle}
                fondo="linear-gradient(180deg, #24303f 0%, #1a140c 100%)"
              >
                <div className="mx-auto h-full w-full max-w-[760px]">
                  <PlayerScreen cuenta={cuentaId ? { id: cuentaId, nombre: nombreCuenta } : undefined} onPersonajes={cuentaId ? setGestion : undefined} />
                </div>
              </PanelDeSitio>
            )}
            {screen === 'mundo' && zona === 'incursiones' && (
              <PanelDelDesierto>
                <IncursionesConReloj cards={cards} onAtras={salirALaCalle} onJugar={jugar} />
              </PanelDelDesierto>
            )}
            {screen === 'mundo' && zona === 'entrenar' && (
              <PanelDelDesierto>
                <Entrenar onAtras={salirALaCalle} onJugar={jugar} />
              </PanelDelDesierto>
            )}
            {screen === 'mundo' && zona === 'rango' && (
              <RangoPanel onSalir={salirALaCalle} onJugar={() => jugar({ tipo: 'rango' })} onBaraja={alBarAAcabarla} />
            )}
            {viaje && <Viaje hacia={viaje} />}

            {screen === 'batalla' && amigo && (
              <PartidaAmigo
                amigo={amigo}
                onSalir={() => {
                  setAmigo(null)
                  abrir('pueblo', null)
                }}
              />
            )}
            {screen === 'batalla' && !amigo && (
              <Partida
                mision={mision}
                onBillete={(b) => {
                  billete.current = b
                }}
                onLeave={(terminada) => {
                  if (!terminada && billete.current) {
                    // A media partida, salir siempre cuesta: se avisa con el modal y ya decide él.
                    setAbandono(costeDeIrse(billete.current, encargoDe(mision)))
                    return
                  }
                  salirDeLaPartida()
                }}
              />
            )}
          </div>
          {ajustes && (
            <SettingsModal
              onClose={() => setAjustes(false)}
              onSalir={cerrarSesion}
              onTutorial={() => setTutorial(true)}
            />
          )}

          {tutorial && <Tutorial irA={irDelTutorial} donde={{ lugar, zona }} onTerminar={acabarTutorial} />}

          {/* El aviso de abandonar la partida de rango, en el juego y no con el del navegador */}
          {abandono && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 p-5">
              <div className="papel w-full max-w-[330px] p-4 text-center">
                <p className="font-west text-[24px] leading-none text-[#2a1a10]">¿Te vas de la partida?</p>
                {mision.tipo === 'rango' ? (
                  <>
                    <p className="mt-2 text-[14px] leading-snug text-[#5b3a1c]">
                      Estás en una <b>partida de rango</b>. Si te sales ahora cuenta como derrota y te quitan monedas:
                    </p>
                    <p className="mt-2 font-west text-[32px] leading-none text-rose-700">−{abandono.mordida} <Icono nombre="monedas" /></p>
                    <p className="mt-1 text-[13px] text-[#5b3a1c]">
                      Es un {abandono.porcentaje}% de tu bolsa ({getPlayer().monedas} monedas).
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[14px] leading-snug text-[#5b3a1c]">
                    {mision.tipo === 'incursion'
                      ? 'Si te sales ahora pierdes el intento y lo que pagaste para entrar.'
                      : mision.tipo === 'entreno'
                        ? 'Si te sales ahora pierdes el entreno: no sube nada.'
                        : 'Si te sales ahora cuenta como derrota en tu historial.'}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setAbandono(null)} className="boton flex-1 text-[14px]">
                    Me quedo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      abandonarPartida(billete.current, encargoDe(mision))
                      billete.current = null
                      setAbandono(null)
                      salirDeLaPartida()
                    }}
                    className="boton boton-rojo flex-1 text-[14px]"
                  >
                    {abandono.mordida > 0 ? 'Salir y pagar' : 'Salir'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {sobres && !tutorial && screen !== 'batalla' && <SobreScreen onCerrar={() => setSobres(false)} />}
        </Suspense>
        )}
      </Column>
    </>
  )
}

/**
 * Las incursiones con su reloj (la cuenta atrás va por segundos). El reloj va aquí dentro y no en la
 * app: si no, cada segundo se volvería a pintar el juego entero, batalla incluida.
 */
function IncursionesConReloj(props: Omit<Parameters<typeof Incursiones>[0], 'ahora'>) {
  const ahora = useNow(1000)
  return <Incursiones {...props} ahora={ahora} />
}

/** Los paneles del desierto (incursiones y entrenar) por encima del mundo, a pantalla completa. */
function PanelDelDesierto({ children }: { children: ReactNode }) {
  const escala = useEscalaPc()
  return (
    <div className="absolute inset-0 z-30">
      <div className="mx-auto h-full max-w-[760px] lg:max-w-[1100px]" style={escala > 1 ? { zoom: escala } : undefined}>
        {children}
      </div>
    </div>
  )
}
