import { Html, PerformanceMonitor } from '@react-three/drei'
import { Icono } from '../Icono'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Group, OrthographicCamera } from 'three'
import { BUILTIN_WEAPONS } from '../cards/catalog'
import { DRAW_S, WEAPON_SWAP_S, WEAPON_USES, qualityById, rarityInfo, rarityOf, usesOf } from '../cards/model'
import type { BattleCard, CardDef, ShotMode, WeaponCard } from '../cards/model'
import { patternById } from '../cards/patterns'
import { setVolume, useVolumes } from '../settings/volumes'
import { sonido, tocaSonido } from './samples'
import type { ScenarioDef } from '../scenes/scenarios'
import type { Bot } from './bot'
import { Simulacion, aplicarJugada } from './simulacion'
import type { Jugada, JugadaGrabada, Preparativos } from './simulacion'
import {
  DEPLOY_BACK,
  DEPLOY_FRONT,
  FIELD_L,
  FIELD_W,
  FIRE_LINE,
  SMOKE_R,
  clampDeploy,
  clampFireLine,
  puedeSacar,
  drainEvents,
  fortPos,
  rangoDeTorre,
  vivosDe,
  fireWeapon,
  weaponShotFromStroke,
  paceAt,
  slotCard,
  spawnUnit,
  step,
  tunnelExit,
  weaponCard,
} from './engine'
import type { Battle, BattleEvent, Pace, Side, Unit, Vec } from './engine'
import { FX_MAX_LIFE, FxLayer, GroundMark, RangoTorre, Ribbon, TroopShots, WeaponBullets, fortHitPoint } from './Effects'
import type { RangoData } from './Effects'
import type { Fx, RibbonData } from './Effects'
import { Field } from './Field'
import { FieldUnit } from './FieldUnit'
import { HandHud } from './HandHud'
import type { DragState, HandView } from './HandHud'
import { hudLayout, inside } from './layout'
import type { HudLayout } from './layout'
import { startMusic, stopMusic } from './music'
import { bala, disparo, precargarBatalla, precargarDisparos, rebote, ruleta as sonarRuleta, sfx, tic } from './sfx'
import { CLIMAS, ajusteDeDisparos, climaAlAzar, climaInfo } from './clima'
import type { Clima } from './clima'
import { ClimaFx } from './ClimaFx'
import { nombreDeRival, pullaDe } from './taunts'
import { precargarVoces } from './voices'
import { usePlayer } from '../game/players'
import type { ResumenDeBatalla } from '../game/incursiones'
import { SmokeClouds, TunnelPortals, ZapField } from './Specials'
import { HabilidadesLayer } from './EfectosHabilidad'
import { PantallaClima, SucesosClimaFx } from './SucesosClimaFx'
import type { AccionRemota, Sala } from '../red/sala'
import { aplicarFoto, espejo, tomarFoto } from '../red/foto'
import { todasLasCartasDelJuego } from '../cards/store'
import { WEAPON_Y, WeaponRig, muzzleProfile } from './WeaponRig'
import { TracePad } from './TracePad'
import { TIEMPO_MAXIMO_S, maxVivosEn } from './economia'
import { AimGuide } from './AimGuide'
import { FRAMELOOP, MANUAL, capturePointer } from '../debugClock'
import { Logo } from '../Logo'

/** Inclinacion de la camara: vista isometrica, como Project Zomboid. */
const ELEVATION = (35 * Math.PI) / 180

/** La carta premio de la vagoneta: la dinamita de siempre, como carta suelta. */
const BONUS_DYNAMITE: CardDef = BUILTIN_WEAPONS.find((weapon) => weapon.id === 'dinamita')!

function timeLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Camara: encuadra el campo en la franja libre entre el marcador y la mano
// ---------------------------------------------------------------------------

/** Donde queda la camara en reposo (encuadrando el campo entero): la camara viva se mueve a partir de aqui. */
interface CamBase {
  zoom: number
  x: number
  y: number
  z: number
}

function CameraRig({
  layout,
  cameraRef,
  baseRef,
}: {
  layout: HudLayout
  cameraRef: MutableRefObject<OrthographicCamera | null>
  baseRef: MutableRefObject<CamBase | null>
}) {
  const camera = useThree((state) => state.camera) as OrthographicCamera
  const size = useThree((state) => state.size)
  useLayoutEffect(() => {
    cameraRef.current = camera
    const band = layout.field.bottom - layout.field.top
    // La casa es pequeña: con menos alto de fuerte cabe mas campo y se ve todo con menos zoom.
    const fortTop = 3.2
    // Se deja ver un poco del escenario a cada lado del campo.
    const needW = FIELD_W + 6
    const needH = FIELD_L * Math.sin(ELEVATION) + fortTop * Math.cos(ELEVATION) + 1
    const zoom = Math.min(size.width / needW, band / needH)
    const up = new Vector3(0, Math.cos(ELEVATION), -Math.sin(ELEVATION))
    const back = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION))
    // El centro del campo va al centro de la franja libre (subido un poco por las torres).
    const bandCenter = (layout.field.top + layout.field.bottom) / 2
    const dy = bandCenter - size.height / 2 + (fortTop * Math.cos(ELEVATION) * zoom) / 2
    const target = up.clone().multiplyScalar(dy / zoom)
    camera.position.copy(target).addScaledVector(back, 60)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.zoom = zoom
    camera.near = 0.1
    camera.far = 200
    camera.updateProjectionMatrix()
    baseRef.current = { zoom, x: camera.position.x, y: camera.position.y, z: camera.position.z }
  }, [camera, size.width, size.height, layout, cameraRef, baseRef])
  return null
}

// ---------------------------------------------------------------------------
// Bucle: avanza la batalla y reparte los avisos a la escena y a la interfaz
// ---------------------------------------------------------------------------

interface Popup {
  id: number
  x: number
  z: number
  text: string
  color: string
  big: boolean
  born: number
}

interface Snapshot {
  time: number
  hp: [number, number]
  maxHp: number
  cart: { hp: number; maxHp: number; shielded: boolean } | null
  pace: Pace
  slots: { cardId: string | null; readyIn: number }[]
  weapon: { cardId: string | null; uses: number; readyIn: number }
  /** El arma del rival: tambien se ve en el campo. */
  foe: { cardId: string | null; uses: number }
  dynamite: number
  /** Lo que le queda al reroll para recargarse (0 = listo). */
  rerollIn: number
  /** Tus soldados vivos, el maximo que puedes tener ahora y tu racha (0 a 3). */
  vivos: number
  maxVivos: number
  racha: number
}

function snapshotOf(battle: Battle): Snapshot {
  const hand = battle.hands[0]
  return {
    time: battle.time,
    hp: [battle.forts[0].hp, battle.forts[1].hp],
    maxHp: battle.forts[0].maxHp,
    cart: battle.cart
      ? { hp: battle.cart.hp, maxHp: battle.cart.maxHp, shielded: battle.time < battle.cart.shieldUntil }
      : null,
    pace: paceAt(battle.time),
    slots: hand.slots.map((slot) => ({ cardId: slot.cardId, readyIn: Math.max(0, slot.readyAt - battle.time) })),
    weapon: {
      cardId: hand.weapon.cardId,
      uses: hand.weapon.uses,
      readyIn: Math.max(0, hand.weapon.readyAt - battle.time),
    },
    foe: { cardId: battle.hands[1].weapon.cardId, uses: battle.hands[1].weapon.uses },
    dynamite: battle.dynamiteAmmo[0],
    rerollIn: Math.max(0, battle.rerollAt - battle.time),
    vivos: vivosDe(battle, 0),
    maxVivos: maxVivosEn(battle.time),
    racha: battle.racha[0],
  }
}

/**
 * La huella de lo que se ve en la interfaz: si no cambia, no se re-pinta la pantalla. Asi la
 * pantalla entera (y todo lo que cuelga del Canvas) no se rehace diez veces por segundo para nada.
 */
function snapKey(s: Snapshot): string {
  const q = (n: number) => Math.ceil(n * 4)
  return [
    Math.floor(s.time),
    Math.ceil(s.hp[0]),
    Math.ceil(s.hp[1]),
    s.cart ? `${Math.ceil(s.cart.hp)}${s.cart.shielded ? 's' : ''}` : '-',
    s.pace.label,
    s.slots.map((slot) => `${slot.cardId}:${slot.cardId ? 0 : q(slot.readyIn)}`).join('|'),
    `${s.weapon.cardId}:${s.weapon.uses}:${s.weapon.cardId ? 0 : q(s.weapon.readyIn)}`,
    `${s.foe.cardId}:${s.foe.uses}`,
    s.dynamite,
    Math.ceil(s.rerollIn),
    `${s.vivos}/${s.maxVivos}/${s.racha}`,
  ].join(',')
}

/** Solo en modo prueba: deja a mano el renderizador y unos atajos para medir el rendimiento. */
function SondaGl({ battle, deck }: { battle: Battle; deck: CardDef[] }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    Object.assign(window, {
      __gl: gl,
      __scene: scene,
      // __poblar(n): n soldados por bando repartidos por el campo (para medir con campo lleno).
      __poblar: (n: number) => {
        const soldados = deck.filter((card): card is BattleCard => card.kind === 'batalla')
        for (const side of [0, 1] as Side[]) {
          for (let i = 0; i < n; i++) {
            const card = soldados[(i + side * 3) % soldados.length]!
            const z = (side === 0 ? 1 : -1) * (3 + (i % 8) * 2.2)
            spawnUnit(battle, side, card, { x: ((i * 7) % 11) - 5, z }, 'bien')
          }
        }
      },
    })
  }, [gl, scene, battle, deck])
  return null
}

/** Una camara lenta en marcha: desde cuando, cuanto dura y lo despacio que llega a ir (0.2 = cinco veces mas lento). */
interface Lenta {
  from: number
  dur: number
  depth: number
}

/**
 * La camara viva. Mientras se pelea, se acerca un poco y **sigue la accion** (el centro de donde estan
 * los soldados), con un pequeño vaiven para que no sea una foto fija. Cada entrada de una carta grande
 * y cada explosion le da un **golpe de zoom**. Si estas apuntando o soltando una carta vuelve al plano
 * entero para que veas todo tu campo, y al acabar la partida por el fuerte se lanza hacia el caido.
 */
function CamaraViva({
  cameraRef,
  baseRef,
  battle,
  activa,
  focus,
  punch,
}: {
  cameraRef: MutableRefObject<OrthographicCamera | null>
  baseRef: MutableRefObject<CamBase | null>
  battle: Battle
  activa: MutableRefObject<boolean>
  focus: MutableRefObject<{ side: Side; from: number } | null>
  punch: MutableRefObject<{ from: number; amp: number } | null>
}) {
  const estado = useRef({ zoom: 1, dx: 0, dz: 0 })
  useFrame((state, dt) => {
    const camara = cameraRef.current
    const base = baseRef.current
    if (!camara || !base) return
    const t = state.clock.elapsedTime
    let zoom = 1
    let dx = 0
    let dz = 0
    const f = focus.current
    if (f) {
      const u = Math.min(1, (t - f.from) / 2)
      const e = 1 - (1 - u) ** 3
      const fuerte = fortPos(f.side)
      zoom = 1 + 0.5 * e
      dx = fuerte.x * 0.5 * e
      dz = fuerte.z * 0.5 * e
    } else if (activa.current) {
      let sx = 0
      let sz = 0
      let n = 0
      for (const unit of battle.units) {
        if (unit.state === 'muerto' || unit.frozen) continue
        sx += unit.x
        sz += unit.z
        n++
      }
      if (n > 0) {
        zoom = 1.17
        dz = Math.min(2.5, Math.max(-7, (sz / n) * 0.6))
        dx = Math.min(1.5, Math.max(-1.5, (sx / n) * 0.35))
      }
      // Un vaiven suave: la camara respira.
      dx += Math.sin(t * 0.35) * 0.35
    }
    const suave = 1 - Math.exp(-dt * (f ? 2.5 : 2.2))
    const e = estado.current
    e.zoom += (zoom - e.zoom) * suave
    e.dx += (dx - e.dx) * suave
    e.dz += (dz - e.dz) * suave
    // El golpe de zoom no se suaviza: entra de golpe y se va.
    const p = punch.current
    const golpe = p ? Math.max(0, 1 - (t - p.from) / 0.6) : 0
    camara.zoom = base.zoom * (e.zoom + (p ? p.amp * golpe * golpe : 0))
    camara.position.set(base.x + e.dx, base.y, base.z + e.dz)
    camara.updateProjectionMatrix()
  })
  return null
}

function Driver({
  battle,
  sim,
  botQuieto,
  paused,
  paceRef,
  onTick,
  onEvents,
  slow,
}: {
  battle: Battle
  /** La partida a pasos fijos (con el bot y las jugadas apuntadas). */
  sim: Simulacion
  /** El tutorial calla al bot mientras explica. */
  botQuieto: boolean
  slow: MutableRefObject<Lenta | null>
  paused: boolean
  paceRef: MutableRefObject<Pace>
  onTick: () => void
  onEvents: (events: ReturnType<typeof drainEvents>, clock: number) => void
}) {
  const acc = useRef(0)
  useFrame((state, dt) => {
    // La camara lenta: cae enseguida a su minimo y vuelve poco a poco al ritmo normal.
    let escala = 1
    const lenta = slow.current
    if (lenta) {
      const u = (state.clock.elapsedTime - lenta.from) / lenta.dur
      if (u >= 1) slow.current = null
      else escala = lenta.depth + (1 - lenta.depth) * Math.max(0, u) ** 2
    }
    battle.timeScale = escala
    if (!paused) {
      sim.avanzar(dt * escala, !botQuieto)
    }
    paceRef.current = paceAt(battle.time)
    const events = drainEvents(battle)
    if (events.length > 0) onEvents(events, state.clock.elapsedTime)
    acc.current += dt
    if (acc.current > 0.1) {
      acc.current = 0
      onTick()
    }
  })
  return null
}

/** Lleva la lista de muñecos del campo: solo re-pinta cuando entra o sale alguno. */
function Units({ battle, paceRef }: { battle: Battle; paceRef: MutableRefObject<Pace> }) {
  const [ids, setIds] = useState<number[]>([])
  const key = useRef('')
  useFrame(() => {
    const next = battle.units.map((unit) => unit.id)
    const k = next.join(',')
    if (k !== key.current) {
      key.current = k
      setIds(next)
    }
  })
  return (
    <group>
      {ids.map((id) => {
        const unit = battle.units.find((u) => u.id === id)
        return unit ? <FieldUnit key={id} unit={unit} battle={battle} paceRef={paceRef} /> : null
      })}
    </group>
  )
}

function PopupLayer({ items }: { items: Popup[] }) {
  return (
    <>
      {items.map((popup) => (
        <Html key={popup.id} position={[popup.x, 2.7, popup.z]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div
            className={`float-up whitespace-nowrap font-west ${popup.big ? 'text-[26px]' : 'text-[17px]'}`}
            style={{ color: popup.color, textShadow: '0 2px 0 #1a0d04, 0 0 10px rgba(0,0,0,0.8)' }}
          >
            {popup.text}
          </div>
        </Html>
      ))}
    </>
  )
}

/** Un bocadillo de cómic con la pulla que suelta una carta al salir al campo. */
interface Globo {
  id: number
  x: number
  z: number
  texto: string
  /** 0 = mío, 1 = del rival (se pinta distinto, para saber quién habla). */
  side: Side
  born: number
}

/** La ruleta del principio: gira y se para en el clima con el que se juega la partida. */
const TIRA = 96
const TIRAS = 15
const RULETA_W = 210

function Ruleta({ girando, clima }: { girando: boolean; clima: Clima }) {
  // La tira repite los cinco climas en orden: el que toca cae en una casilla de las ultimas.
  const indice = Math.max(0, CLIMAS.findIndex((item) => item.id === clima))
  const ganador = 10 + indice
  const destino = -(TIRA * ganador - (RULETA_W - TIRA) / 2)
  return (
    <div className="relative overflow-hidden rounded-xl border-4 border-[#6b4423] bg-[#140c05]" style={{ width: RULETA_W }}>
      <div
        className="flex"
        style={{
          transform: `translateX(${girando ? destino : 0}px)`,
          transition: girando ? 'transform 2.35s cubic-bezier(0.09, 0.72, 0.06, 1)' : 'none',
        }}
      >
        {Array.from({ length: TIRAS }, (_, i) => {
          const info = CLIMAS[i % CLIMAS.length]!
          return (
            <span
              key={i}
              className="flex h-16 w-24 shrink-0 flex-col items-center justify-center gap-0.5 font-west text-[14px] leading-none"
              style={{ background: `${info.color}22`, color: info.color }}
            >
              <span className="text-2xl">{info.icon}</span>
              {info.label.toUpperCase()}
            </span>
          )
        })}
      </div>
      {/* La aguja del centro: donde se tiene que quedar */}
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-amber-300/90 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
      <span className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/85 to-transparent" />
      <span className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/85 to-transparent" />
    </div>
  )
}

function GloboLayer({ items }: { items: Globo[] }) {
  return (
    <>
      {items.map((globo) => (
        <Html key={globo.id} position={[globo.x, 3.3, globo.z]} center zIndexRange={[30, 20]} style={{ pointerEvents: 'none' }}>
          <div className={`globo-comic ${globo.side === 0 ? 'globo-comic--mio' : 'globo-comic--rival'}`}>
            <p className="globo-comic__texto">{globo.texto}</p>
            <span className="globo-comic__cola" />
          </div>
        </Html>
      ))}
    </>
  )
}

/** Sacude el mundo un momento (disparo, impacto, explosion) para que se sienta el golpe. */
function ShakeGroup({ shake, children }: { shake: MutableRefObject<number>; children: ReactNode }) {
  const group = useRef<Group>(null)
  useFrame((_, dt) => {
    shake.current = Math.max(0, shake.current - dt * 2.4)
    const g = group.current
    if (!g) return
    const k = shake.current * shake.current
    g.position.x = (Math.random() - 0.5) * k * 0.7
    g.position.z = (Math.random() - 0.5) * k * 0.7
  })
  return <group ref={group}>{children}</group>
}

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------

interface Pending {
  slot: number
  x: number
  z: number
  card: BattleCard
  /** Sale como torre (se dejo el dedo quieto sobre el campo antes de soltar). */
  torre: boolean
}

/** Lo que hay que dejar quieto el dedo, ya sobre el campo, para que la carta salga como torre. */
const TORRE_HOLD_MS = 700

/**
 * Monta la partida. Si viene `prep` (las partidas con premio), con su semilla y su clima: así el
 * servidor la puede repetir igual. Si no, con semilla y clima al azar.
 */
function makeBattle(
  mine: CardDef[],
  theirs: CardDef[],
  extras?: { alcanceArma?: number; vida?: number },
  prep?: Preparativos,
): { battle: Battle; bot: Bot; sim: Simulacion } {
  const sim = new Simulacion(prep ?? { mazos: [mine, theirs], extras, semilla: Math.floor(Math.random() * 2 ** 31), clima: climaAlAzar() })
  return { battle: sim.battle, bot: sim.bot, sim }
}

export interface BattleScreenProps {
  scenario: ScenarioDef
  /** Tu mazo y el del bot. */
  deck: CardDef[]
  botDeck: CardDef[]
  onExit: () => void
  /**
   * Al acabar la partida (para el perfil y para los retos de las incursiones). Trae también las
   * jugadas que has hecho, para que el servidor la repita y compruebe el resultado.
   */
  onFinish?: (won: boolean, seconds: number, resumen: ResumenDeBatalla, jugadas: JugadaGrabada[]) => void
  /**
   * La partida ya montada (semilla, mazos y clima): la de las partidas con premio, que vienen del
   * servidor. Si viene, manda sobre `deck`, `botDeck` y `extras`.
   */
  prep?: Preparativos
  /** "Buscar otra partida": si viene, la monta el que llama (y cambia de escenario). */
  onRematch?: () => void
  /** Lo que te llevas (monedas, carta, entreno…): sale dentro del cartel del final. */
  resultado?: ReactNode
  /** Lo que le dan tus caracteristicas al lado 0 (alcance del arma y vida del fuerte). */
  extras?: { alcanceArma?: number; vida?: number }
  /** El cartel de lo que se esta jugando: "ENTRENO · PUNTERIA", "INCURSION · EL GOLEM"… */
  etiqueta?: string
  /**
   * **Modo prueba** (para los clips de las armas): entra directo al campo, sin cartel de VS ni
   * ruleta, y el arma dispara sola en bucle. Si no se pasa, la partida es la de siempre.
   */
  prueba?: { arma: WeaponCard }
  /** **Modo tutorial**: sin cartel de VS ni ruleta, y el tutorial manda en el bot y en la pausa. */
  guia?: GuiaDeBatalla
  /**
   * **Partida con un amigo.** El `anfitrion` lleva la partida de verdad (sin bot: el otro bando es
   * su amigo) y le manda fotos; el `invitado` solo pinta las fotos y le manda lo que hace.
   */
  red?: { rol: 'anfitrion' | 'invitado'; sala: Sala }
}

/** Cada cuanto le manda el anfitrion la foto al invitado (ms). */
const FOTO_CADA_MS = 66

/** Lo del invitado en las coordenadas del anfitrion: todo dado la vuelta. */
const alReves = (v: { x: number; z: number }) => ({ x: -v.x, z: -v.z })

/** Lo que ve el tutorial de la partida en cada momento. */
export interface EstadoDeGuia {
  battle: Battle
  layout: HudLayout
  /** El cuadro del patron esta abierto. */
  dibujando: boolean
  arrastrando: 'batalla' | 'arma' | 'dinamita' | null
  /** El escenario ya esta cargado y se puede jugar. */
  listo: boolean
}

export interface GuiaDeBatalla {
  /** El bot no saca cartas ni dispara. */
  botQuieto: boolean
  /** La partida se congela (para leer tranquilo). */
  pausa: boolean
  onEventos: (events: BattleEvent[]) => void
  onEstado: (estado: EstadoDeGuia) => void
}

export function BattleScreen({ scenario, deck, botDeck, onExit, onFinish, onRematch, resultado, extras, etiqueta, prueba, guia, red, prep }: BattleScreenProps) {
  const container = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 800 })
  /** Los volúmenes del jugador (el modo prueba los calla y los devuelve como estaban). */
  const volumes = useVolumes()
  const [game, setGame] = useState(() => makeBattle(prep?.mazos[0] ?? deck, prep?.mazos[1] ?? botDeck, prep?.extras ?? extras, prep))
  const [ready, setReady] = useState(false)
  const finished = useRef(false)
  /** Las bajas de la partida, para los retos de las incursiones. */
  const bajas = useRef(0)
  const perdidas = useRef(0)
  const [round, setRound] = useState(0)
  const { battle, sim } = game
  /** Tu jugada: se hace y se apunta (para que el servidor pueda repetir la partida). */
  const jugar = (j: Jugada) => sim.jugar(j)
  const [snap, setSnap] = useState<Snapshot>(() => snapshotOf(battle))
  const snapSeen = useRef('')
  const onFieldReady = useCallback(() => setReady(true), [])
  const [pending, setPending] = useState<Pending | null>(null)
  const [dragKind, setDragKind] = useState<'batalla' | 'arma' | 'dinamita' | null>(null)
  /** Mientras apuntas el arma: el dedo esta de vuelta en tu raya y soltar CANCELA el disparo. */
  const [cancelando, setCancelando] = useState(false)
  const [fx, setFx] = useState<Fx[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [callout, setCallout] = useState<{ text: string; key: number } | null>(null)
  /** Los bocadillos de las cartas (pulla al salir al campo). */
  const [globos, setGlobos] = useState<Globo[]>([])
  /** El principio: cartel de "VS" → ruleta del clima → partida. En modo prueba se entra directo. */
  /** La resolucion de dibujo: se ajusta sola segun lo bien que vaya (ver PerformanceMonitor). */
  const [calidad, setCalidad] = useState(1.5)
  const [fase, setFase] = useState<'vs' | 'ruleta' | 'listo'>(prueba || guia || red ? 'listo' : 'vs')

  /**
   * El **modo prueba**: el arma elegida dispara sola, en bucle, contra un par de dianas que se van
   * reponiendo. Todo lo de aqui fuera solo ocurre si viene `prueba`, asi que la partida normal no se
   * entera de nada.
   */
  useEffect(() => {
    if (!prueba || fase !== 'listo') return
    const arma = prueba.arma
    const dianas: Unit[] = []
    const soldado = deck.find((carta) => carta.kind === 'batalla')

    // Solo se oye el arma: se calla el juego entero (música, voces y avisos) mientras dura el clip.
    const antesEfectos = volumes.efectos
    const antesMusica = volumes.musica
    setVolume('efectos', 0)
    setVolume('musica', 0)

    // El arma, en la mano del jugador (y sin gastarse).
    battle.hands[0].weapon.cardId = arma.id
    battle.hands[0].weapon.uses = 9999
    battle.cards.set(arma.id, arma)

    const ponerDianas = () => {
      if (!soldado) return
      if (dianas.some((diana) => diana.state !== 'muerto')) return
      dianas.length = 0
      // El enemigo se pone dentro del alcance del arma, para que se vea llegar el tiro y el golpe.
      const donde = Math.min(arma.shot.range * 0.7, 14)
      dianas.push(spawnUnit(battle, 1, soldado, { x: 0, z: FIRE_LINE - donde }, 'excelente'))
    }

    ponerDianas()
    // Un tiro, el golpe y se cierra: el clip dura lo justo.
    const tiro = window.setTimeout(() => {
      fireWeapon(battle, 0, 0, 0)
      // El disparo del arma, a mano y a su volumen de siempre (el resto del juego está en silencio).
      const muestra = sonido(`${import.meta.env.BASE_URL}sonidos/armas/${arma.id}.wav`)
      if (muestra) tocaSonido(muestra, { ganancia: 0.45 })
    }, 320)
    const fin = window.setTimeout(() => onExit(), 2900)

    return () => {
      window.clearTimeout(tiro)
      window.clearTimeout(fin)
      setVolume('efectos', antesEfectos)
      setVolume('musica', antesMusica)
    }
  }, [prueba, fase, battle, deck, onExit, volumes.efectos, volumes.musica])
  /** El clima que decide la ruleta: cambia la luz, los rangos y la vision. */
  const [clima, setClima] = useState<Clima>('dia')
  /** La ruleta ya esta girando (para arrancar la animacion). */
  const [giro, setGiro] = useState(false)
  const rival = useMemo(() => nombreDeRival(), [])
  const player = usePlayer()
  const [drawKeys, setDrawKeys] = useState<{ slots: number[]; weapon: number; bonus: number }>({
    slots: [1, 2, 3],
    weapon: 4,
    bonus: 5,
  })
  const paceRef = useRef<Pace>(paceAt(0))
  const cameraRef = useRef<OrthographicCamera | null>(null)
  const drag = useRef<DragState>({ active: false, kind: 'batalla', slot: 0, x: 0, y: 0, wx: 0, wz: 0, overField: false })
  /** El dedo quieto sobre el campo: desde cuando, donde, y si ya ha armado la torre. */
  const hold = useRef({ since: 0, x: 0, y: 0, torre: false })
  const [torreArmada, setTorreArmada] = useState(false)
  /** El circulo del rango de la torre mientras se coloca. */
  const rango = useRef<RangoData>({ visible: false, x: 0, z: 0, r: 1, k: 0 })
  // Mientras arrastras una carta de batalla, si el dedo se queda quieto sobre el campo, se va armando la torre.
  useEffect(() => {
    if (dragKind !== 'batalla') return
    const id = window.setInterval(() => {
      const d = drag.current
      if (!d.active || d.kind !== 'batalla' || !d.overField) {
        rango.current.visible = false
        return
      }
      const k = Math.min(1, (performance.now() - hold.current.since) / TORRE_HOLD_MS)
      // Los primeros instantes no se enseña nada: asi un arrastre normal no parpadea.
      rango.current.visible = k > 0.25 || hold.current.torre
      rango.current.k = hold.current.torre ? 1 : k
      if (k >= 1 && !hold.current.torre) {
        hold.current.torre = true
        setTorreArmada(true)
        sfx.ready()
        try {
          navigator.vibrate?.(35)
        } catch {
          // Sin vibracion: no pasa nada.
        }
      }
    }, 30)
    return () => {
      window.clearInterval(id)
      rango.current.visible = false
    }
  }, [dragKind])
  /** El ultimo toque sobre una torre tuya (para el doble toque que la suelta). */
  const lastTap = useRef<{ id: number; at: number } | null>(null)
  const nextId = useRef(1)
  /** Trazo del arma: puntos del suelo por donde has arrastrado. */
  const stroke = useRef<Vec[]>([])
  const shake = useRef(0)
  /** La camara lenta de ahora mismo y cuando se hizo la ultima (para no encadenarlas todas). */
  const slow = useRef<Lenta | null>(null)
  const lastSlow = useRef(-99)
  /** Hacia que fuerte tiene que acercarse la camara al final de la partida. */
  const finalFocus = useRef<{ side: Side; from: number } | null>(null)
  /** La base de la camara, el golpe de zoom pendiente y si ahora puede seguir la accion. */
  const camBase = useRef<CamBase | null>(null)
  const punch = useRef<{ from: number; amp: number } | null>(null)
  const camActiva = useRef(true)
  camActiva.current = dragKind === null && !pending
  /** El destello de pantalla de una entrada epica o divina. */
  const [destello, setDestello] = useState<{ color: string; key: number } | null>(null)
  const [finalListo, setFinalListo] = useState(false)
  /** Donde esta el arma por tu raya mientras arrastras (null = en reposo). */
  const aimX = useRef<number | null>(null)
  /** Retroceso pendiente y traqueteo de la rafaga. */
  const recoil = useRef(0)
  const burst = useRef(0)
  /** Boca del arma: donde sale el fogonazo (lo actualiza el propio arma). */
  const muzzle = useRef<{ x: number; z: number } | null>(null)
  /** El arma del rival: se ve en el campo pero no la manejas tu. */
  const foeAimX = useRef<number | null>(null)
  const foeRecoil = useRef(0)
  const foeBurst = useRef(0)
  const foeMuzzle = useRef<{ x: number; z: number } | null>(null)
  /** El trazo del tunel que estas colocando: de tu campo al suyo. */
  const tunnelLine = useRef<RibbonData>({
    points: [
      { x: 0, z: 0 },
      { x: 0, z: 0 },
    ],
    visible: false,
    color: '#f472b6',
    width: 0.3,
    dashed: true,
  })
  /** Las dos bocas del tunel mientras lo colocas. */
  const tunnelIn = useRef({ visible: false, x: 0, z: 0, r: 0.9, color: '#f472b6' })
  const tunnelOut = useRef({ visible: false, x: 0, z: 0, r: 0.9, color: '#f472b6' })
  /** Donde apuntas con una carga explosiva (cae justo ahi, hasta donde llegue). */
  const aimTarget = useRef({ visible: false, x: 0, z: 0 })
  const mark = useRef({ visible: false, x: 0, z: 0, r: 0.6, color: '#fbbf24' })
  const lastIds = useRef<{ slots: (string | null)[]; weapon: string | null; bonus: number }>({
    slots: [],
    weapon: null,
    bonus: 0,
  })

  // El quinto hueco solo aparece cuando te has ganado la carta premio.
  const hasBonus = snap.dynamite > 0
  const layout = useMemo(() => hudLayout(size.w, size.h, hasBonus), [size, hasBonus])
  // ------------------------------------------------------------- Partida con un amigo
  const redRef = useRef(red)
  redRef.current = red
  const invitado = red?.rol === 'invitado'
  const faseRef = useRef(fase)
  faseRef.current = fase
  const eventosParaAmigo = useRef<BattleEvent[]>([])
  const enviarAccion = (accion: AccionRemota) => red?.sala.enviar({ tipo: 'accion', accion })
  useEffect(() => {
    if (!red) return
    const { sala } = red
    // Si el amigo se va a media partida, se avisa.
    const quitaVigia = sala.alCambiar((estado) => {
      if (estado !== 'juntos') setCallout({ text: estado === 'cerrada' ? 'SE HA CORTADO LA CONEXIÓN' : 'TU AMIGO SE HA IDO', key: Date.now() })
    })
    if (red.rol === 'invitado') {
      // El invitado pinta lo que le llega.
      // Todas las cartas de las tres clases: el anfitrion puede jugar con otra clase.
      const cartas = new Map(todasLasCartasDelJuego().map((c) => [c.id, c]))
      const quita = sala.alRecibir((m) => {
        if (m.tipo === 'foto') aplicarFoto(battle, m.foto, (id) => cartas.get(id))
      })
      return () => {
        quita()
        quitaVigia()
      }
    }
    // El anfitrion hace lo que manda el invitado (que juega con el bando de arriba)…
    const quita = sala.alRecibir((m) => {
      if (m.tipo !== 'accion' || battle.over) return
      aplicarJugada(battle, 1, m.accion)
    })
    /*
     * **El reloj del anfitrion.** La partida con un amigo no puede depender de que la ventana se vea:
     * el navegador para las animaciones de las ventanas escondidas (y con ellas la partida, y al amigo
     * se le quedaba todo quieto y con "¡UN MOMENTO!"). Asi que el anfitrion avanza la partida con un
     * reloj aparte, en un hilo que el navegador no para, y desde ahi manda las fotos.
     */
    const codigo = 'setInterval(() => postMessage(0), 16)'
    const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }))
    const reloj = new Worker(url)
    let ultimo = performance.now()
    let ultimaFoto = 0
    reloj.onmessage = () => {
      const ahora = performance.now()
      let dt = Math.min(3, (ahora - ultimo) / 1000)
      ultimo = ahora
      if (!battle.over && faseRef.current === 'listo') {
        while (dt > 0) {
          const paso = Math.min(0.25, dt)
          step(battle, paso)
          dt -= paso
        }
      }
      // Con la ventana escondida no hay quien recoja los avisos: se los lleva el amigo.
      if (document.hidden) eventosParaAmigo.current.push(...drainEvents(battle))
      if (ahora - ultimaFoto >= FOTO_CADA_MS) {
        ultimaFoto = ahora
        const eventos = eventosParaAmigo.current
        eventosParaAmigo.current = []
        sala.enviar({ tipo: 'foto', foto: espejo(tomarFoto(battle, eventos)) })
      }
    }
    return () => {
      quita()
      quitaVigia()
      reloj.terminate()
      URL.revokeObjectURL(url)
    }
  }, [red, battle])

  /** El tutorial (si lo hay) se entera de todo por aqui, sin re-montar el bucle. */
  const guiaRef = useRef(guia)
  guiaRef.current = guia
  const estadoGuia = useRef<EstadoDeGuia | null>(null)
  estadoGuia.current = { battle, layout, dibujando: Boolean(pending), arrastrando: dragKind, listo: ready && fase === 'listo' }
  const conGuia = Boolean(guia)
  useEffect(() => {
    if (!conGuia) return
    const id = window.setInterval(() => {
      if (estadoGuia.current) guiaRef.current?.onEstado(estadoGuia.current)
    }, 120)
    return () => window.clearInterval(id)
  }, [conGuia])
  /** El clima que ha salido: manda en la luz, en los rangos y en lo que se ve del rival. */
  const info = climaInfo(clima)
  const esDia = clima === 'dia'
  if (MANUAL || import.meta.env.DEV) Object.assign(window, { __battle: battle, __layout: layout, __pending: pending })

  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    observer.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!callout) return
    const id = setTimeout(() => setCallout(null), 1700)
    return () => clearTimeout(id)
  }, [callout])

  // La cancion de la partida (de fondo, en bucle), las frases de las cartas y los tiros: todo listo.
  useEffect(() => {
    startMusic()
    void precargarVoces()
    void precargarDisparos()
    void precargarBatalla()
    return () => stopMusic()
  }, [])

  // Primero el cartel de "VS" y luego la ruleta del dia y la noche: hasta que se para, no se juega.
  useEffect(() => {
    if (fase === 'vs') {
      const id = setTimeout(() => {
        setClima(battle.clima)
        setFase('ruleta')
      }, 2600)
      return () => clearTimeout(id)
    }
    if (fase !== 'ruleta') return
    // Gira con sus tics; a los 2,4 s se para y enseña lo que ha tocado antes de empezar.
    const empujon = setTimeout(() => setGiro(true), 80)
    const tics = setInterval(() => tic(), 130)
    const para = setTimeout(() => {
      clearInterval(tics)
      // El clima se le mete a la partida: recorta rangos y, de noche, esconde al rival.
      battle.clima = clima
      sonarRuleta(clima === 'noche' || clima === 'tormenta')
    }, 2450)
    const empieza = setTimeout(() => {
      setFase('listo')
      setCallout({ text: `¡${climaInfo(clima).label.toUpperCase()}!`, key: nextId.current++ })
    }, 3050)
    return () => {
      clearTimeout(empujon)
      clearInterval(tics)
      clearTimeout(para)
      clearTimeout(empieza)
    }
  }, [fase, clima, battle])

  // El cartel del final espera: se ve primero como salta el fuerte (o como acaba el tiempo).
  const hayFinal = Boolean(battle.over)
  useEffect(() => {
    if (!hayFinal) {
      setFinalListo(false)
      return
    }
    const id = window.setTimeout(() => setFinalListo(true), battle.over?.by === 'fuerte' ? 3000 : 900)
    return () => window.clearTimeout(id)
  }, [hayFinal, battle])

  // Cada carta nueva en la mano entra con su propia llave (y su muñeco se tambalea al caer).
  const onTick = useCallback(() => {
    const next = snapshotOf(battle)
    const prev = lastIds.current
    let changed = false
    const slots = drawKeys.slots.slice()
    next.slots.forEach((slot, i) => {
      if (slot.cardId !== prev.slots[i]) {
        if (slot.cardId) slots[i] = nextId.current++
        changed = true
      }
    })
    let weaponKey = drawKeys.weapon
    if (next.weapon.cardId !== prev.weapon) {
      if (next.weapon.cardId) weaponKey = nextId.current++
      changed = true
    }
    let bonusKey = drawKeys.bonus
    // La carta premio entra cayendo la primera vez que te haces con dinamita.
    if (next.dynamite > 0 && prev.bonus === 0) {
      bonusKey = nextId.current++
      changed = true
    }
    lastIds.current = { slots: next.slots.map((s) => s.cardId), weapon: next.weapon.cardId, bonus: next.dynamite }
    if (changed) setDrawKeys({ slots, weapon: weaponKey, bonus: bonusKey })
    const key = snapKey(next)
    if (key !== snapSeen.current) {
      snapSeen.current = key
      setSnap(next)
    }
    const now = performance.now() / 1000
    // (Estos dos solo cambian si hay algo que quitar: no re-pintan por nada.)
    setPopups((list) => (list.some((p) => now - p.born > 1.2) ? list.filter((p) => now - p.born <= 1.2) : list))
    // Los bocadillos duran algo mas: da tiempo a leerlos antes de que se vayan.
    setGlobos((list) => (list.some((g) => now - g.born > 3.4) ? list.filter((g) => now - g.born <= 3.4) : list))
  }, [battle, drawKeys])

  const onEvents = useCallback(
    (events: ReturnType<typeof drainEvents>, clock: number) => {
      guiaRef.current?.onEventos(events)
      // El anfitrion guarda los avisos para mandarselos al invitado con la siguiente foto.
      if (redRef.current?.rol === 'anfitrion') eventosParaAmigo.current.push(...events)
      const newFx: Fx[] = []
      const newPopups: Popup[] = []
      const newGlobos: Globo[] = []
      const now = performance.now() / 1000
      for (const event of events) {
        switch (event.type) {
          case 'cartSpawn':
            // Aviso claro y unos segundos de escudo: no se la puede tocar todavia.
            newFx.push({ id: nextId.current++, kind: 'blast', x: event.x, z: event.z, r: 2.8, color: '#ffca55', born: clock })
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: 2.6, color: '#7dd3fc', born: clock })
            newPopups.push({
              id: nextId.current++,
              x: event.x,
              z: event.z,
              text: `¡ESCUDO ${Math.ceil(event.grace)} s!`,
              color: '#7dd3fc',
              big: true,
              born: now,
            })
            setCallout({ text: '¡VAGONETA A LA VISTA! ESPERA AL ESCUDO', key: nextId.current++ })
            shake.current = Math.max(shake.current, 0.65)
            sfx.blast()
            sfx.ready()
            break
          case 'cartBlocked':
            // Le han disparado con el escudo puesto: rebota.
            newFx.push({ id: nextId.current++, kind: 'spark', x: event.x, z: event.z, r: 1.3, color: '#7dd3fc', born: clock })
            rebote()
            break
          case 'cartHit':
            newFx.push({ id: nextId.current++, kind: 'hit', x: 0, z: 0, r: 1, color: '#ffca55', born: clock })
            newPopups.push({ id: nextId.current++, x: 0, z: 0, text: `−${event.damage}`, color: '#ffda79', big: true, born: now })
            break
          case 'cartClaimed':
            setCallout({ text: event.side === 0 ? '¡5 DINAMITAS!' : 'EL RIVAL TIENE 5 DINAMITAS', key: nextId.current++ })
            newFx.push({ id: nextId.current++, kind: 'blast', x: 0, z: 0, r: 3.2, color: '#ffca55', born: clock })
            shake.current = Math.max(shake.current, 0.9)
            sfx.blast()
            break
          case 'habilidad': {
            // Grita el nombre de su habilidad en un bocadillo (y el campo se sacude un poco).
            newGlobos.push({ id: nextId.current++, x: event.x, z: event.z, texto: event.nombre, side: event.side, born: performance.now() / 1000 })
            shake.current = Math.max(shake.current, 0.35)
            break
          }
          case 'spawn': {
            // Cada carta tiene su frase al entrar al campo y suelta una pulla en un bocadillo.
            const unit = battle.units.find((item) => item.id === event.unitId)
            if (unit) {
              sfx.carta(unit.card.id, event.quality, event.side === 0)
              // Solo las cartas grandes sueltan su pulla: asi el campo no se llena de bocadillos.
              const grande = rarityOf(unit.card) === 'epica' || rarityOf(unit.card) === 'divina'
              const pulla = grande ? pullaDe(unit.card.id) : null
              if (pulla) {
                newGlobos.push({
                  id: nextId.current++,
                  x: event.x,
                  z: event.z,
                  texto: pulla,
                  side: event.side,
                  born: performance.now() / 1000,
                })
              }
            }
            newFx.push({ id: nextId.current++, kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born: clock })
            {
              // Las cartas con rareza entran con efecto: pilar de luz, ondas, chispas, destello y golpe de camara.
              const rareza = unit ? rarityOf(unit.card) : 'normal'
              if (rareza !== 'normal') {
                const color = rarityInfo(rareza).color
                const grande = rareza === 'divina'
                const medio = rareza === 'epica'
                newFx.push({
                  id: nextId.current++,
                  kind: 'invocacion',
                  x: event.x,
                  z: event.z,
                  r: grande ? 2.2 : medio ? 1.5 : 0.8,
                  color,
                  born: clock,
                })
                sfx.invocar(rareza)
                if (grande || medio) {
                  shake.current = Math.max(shake.current, grande ? 1.1 : 0.7)
                  punch.current = { from: clock, amp: grande ? 0.22 : 0.12 }
                  setDestello({ color, key: nextId.current++ })
                }
              }
            }
            const quality = qualityById(event.quality)
            if (event.side === 0) {
              newPopups.push({
                id: nextId.current++,
                x: event.x,
                z: event.z,
                text: quality.label,
                color: quality.color,
                big: true,
                born: now,
              })
            }
            break
          }
          case 'weaponFired': {
            // El fogonazo, el humo y las vainas son del arma que ha disparado: cada una tiene el suyo.
            const fired = battle.cards.get(event.weaponId)
            const weapon = fired && fired.kind === 'arma' ? fired : null
            const mode: ShotMode = weapon?.shot.mode ?? 'bala'
            const profile = muzzleProfile(mode)
            // La boca de verdad del arma montada (el motor solo sabe donde cruza tu raya).
            const mine = event.side === 0 && muzzle.current
            const mouth = mine ? { x: muzzle.current!.x, z: muzzle.current!.z, y: WEAPON_Y } : { x: event.x, z: event.z, y: undefined }
            // La rafaga encadena un fogonazo por bala; las demas, uno solo.
            const volley = mode === 'rafaga' ? Math.max(1, Math.min(6, weapon?.shot.pellets ?? 3)) : 1
            for (let i = 0; i < volley; i++) {
              if (profile.flash <= 0) break
              newFx.push({
                id: nextId.current++,
                kind: 'muzzle',
                x: mouth.x,
                z: mouth.z,
                y: mouth.y,
                r: profile.flash,
                color: weapon?.accent ?? '#ffd166',
                born: clock + i * 0.1,
              })
            }
            for (let i = 0; i < profile.smoke; i++) {
              newFx.push({ id: nextId.current++, kind: 'smoke', x: mouth.x, z: mouth.z, y: mouth.y, r: 1, color: '#d9d2c2', born: clock })
            }
            for (let i = 0; i < profile.shells; i++) {
              newFx.push({
                id: nextId.current++,
                kind: 'shell',
                x: mouth.x,
                z: mouth.z,
                y: mouth.y,
                r: 1,
                color: '#c9a227',
                born: clock + i * 0.07,
                side: i % 2 === 0 ? 1 : -1,
              })
            }
            shake.current = Math.max(shake.current, profile.shake)
            // El culatazo y el traqueteo son del arma que ha disparado: la tuya o la del rival.
            const kick = Math.min(1.5, profile.kick)
            const tremble = (volley - 1) * 0.1 + (mode === 'rafaga' ? 0.3 : 0)
            if (event.side === 0) {
              recoil.current = Math.min(1.5, recoil.current + kick)
              burst.current = Math.max(burst.current, tremble)
            } else {
              foeRecoil.current = Math.min(1.5, foeRecoil.current + kick)
              foeBurst.current = Math.max(foeBurst.current, tremble)
            }
            // Cada arma tiene su disparo: revolver, escopeta, rifle, dinamita, bufalo, gatling…
            disparo(event.weaponId, event.side === 0)
            break
          }
          case 'troopShot':
            // Las tropas tambien disparan: suena la bala (con limite, que son muchas a la vez).
            bala(event.side === 0)
            break
          case 'unitHit':
            if (event.weapon) {
              // Impacto del arma: un anillo y una sacudida (sin numeros). Se ve claro que le has dado.
              newFx.push({ id: nextId.current++, kind: 'hit', x: event.x, z: event.z, r: 1, color: '#ffd166', born: clock })
              shake.current = Math.max(shake.current, 0.35)
              sfx.hit()
            } else if (event.amount >= 1) {
              // Un tiro normal entre soldados: solo una chispa, sin numeros (si no, el campo se llena de adornos).
              newFx.push({ id: nextId.current++, kind: 'spark', x: event.x, z: event.z, r: 0.7, color: '#ffffff', born: clock })
            }
            break
          case 'smoke':
            sfx.carta('humo')
            setCallout({ text: event.side === 0 ? '¡HUMO!' : '¡HUMO ENEMIGO!', key: nextId.current++ })
            break
          case 'zap': {
            sfx.carta('rayo')
            // La tormenta cae sobre el bando entero: chispas en cada tropa que se queda clavada.
            for (const unit of battle.units) {
              if (unit.side !== event.side || unit.state === 'muerto') continue
              newFx.push({ id: nextId.current++, kind: 'spark', x: unit.x, z: unit.z, r: 1.4, color: '#fde047', born: clock })
            }
            setCallout({ text: event.side === 0 ? '¡TE CAYÓ LA TORMENTA!' : '¡TORMENTA!', key: nextId.current++ })
            shake.current = Math.max(shake.current, 0.75)
            sfx.blast()
            break
          }
          case 'suceso': {
            // El clima hace de las suyas: cartel grande y la cámara tiembla.
            const lado = event.x < -0.5 ? 'POR LA IZQUIERDA' : event.x > 0.5 ? 'POR LA DERECHA' : 'POR EL CENTRO'
            const textos: Record<typeof event.k, string> = {
              tormenta: '¡TORMENTA ELÉCTRICA!',
              ventisca: '¡VENTISCA!',
              murcielagos: '¡MURCIÉLAGOS!',
              rodadora: '¡RODADORA!',
              calor: '¡GOLPE DE CALOR!',
              tsunami: `¡TSUNAMI ${lado}!`,
              chaparron: '¡CHAPARRÓN!',
            }
            setCallout({ text: textos[event.k], key: nextId.current++ })
            shake.current = Math.max(shake.current, event.k === 'tsunami' ? 0.9 : event.k === 'tormenta' ? 0.5 : 0.3)
            break
          }
          case 'tunnel':
            sfx.carta('tunel')
            setCallout({ text: event.side === 0 ? '¡TÚNEL ABIERTO!' : '¡TÚNEL ENEMIGO!', key: nextId.current++ })
            for (const at of [event.entry, event.exit]) {
              newFx.push({ id: nextId.current++, kind: 'warp', x: at.x, z: at.z, r: 1, color: '#f472b6', born: clock })
            }
            break
          case 'teleport':
            // Un anillo en cada punta: se ve de donde a donde ha ido.
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.from.x, z: event.from.z, r: 1, color: '#f472b6', born: clock })
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.to.x, z: event.to.z, r: 1, color: '#f472b6', born: clock })
            shake.current = Math.max(shake.current, 0.16)
            break
          case 'unitDeath':
            // Se cuentan las bajas: los retos de las incursiones las piden.
            if (event.side === 1) bajas.current += 1
            else perdidas.current += 1
            newFx.push({ id: nextId.current++, kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born: clock })
            shake.current = Math.max(shake.current, 0.4)
            sfx.kill()
            if (event.side === 1) {
              newPopups.push({ id: nextId.current++, x: event.x, z: event.z, text: '💥', color: '#fde68a', big: true, born: now })
            }
            break
          case 'fortHit': {
            const p = fortHitPoint(event.side)
            newFx.push({ id: nextId.current++, kind: 'fort', x: p.x, z: p.z, r: 1, color: '#ffb347', born: clock })
            sfx.fort()
            break
          }
          case 'marca':
            // Un indio ha marcado a su presa: un aro naranja bajo sus pies.
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: 0.8, color: '#fb923c', born: clock })
            break
          case 'golpeTorre':
            // La torre defiende: onda en el blanco (blanca la del guardian, que ademas frena).
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: event.guardian ? 1.6 : 1.1, color: event.guardian ? '#ffffff' : '#fde68a', born: clock })
            newFx.push({ id: nextId.current++, kind: 'hit', x: event.x, z: event.z, r: 1, color: event.guardian ? '#e2e8f0' : '#ffd166', born: clock })
            shake.current = Math.max(shake.current, event.guardian ? 0.3 : 0.15)
            break
          case 'torre':
            // Se planta (o se suelta) una torre: un aro gris de piedra o uno del bando al soltarse.
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: 1.6, color: event.torre ? '#cbd5e1' : event.side === 0 ? '#38bdf8' : '#ef4444', born: clock })
            if (event.torre) shake.current = Math.max(shake.current, 0.25)
            break
          case 'pulso':
            // Un medico cura (verde) o un sermon frena (rojo): una onda en el suelo.
            newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: event.r * 0.45, color: event.tipo === 'cura' ? '#4ade80' : '#f87171', born: clock })
            break
          case 'blast':
            newFx.push({ id: nextId.current++, kind: 'blast', x: event.x, z: event.z, r: event.r, color: '', born: clock })
            shake.current = Math.max(shake.current, 0.8)
            sfx.blast()
            break
          case 'bulletEnd':
            newFx.push({ id: nextId.current++, kind: 'puff', x: event.x, z: event.z, r: 1, color: '', born: clock })
            break
          case 'baja':
            // La racha sigue ayudando por dentro, pero ya no se anuncia en pantalla.
            break
          case 'roto': {
            // El soldado se rompe: onda de choque, astillas flotando y todo en camara lenta.
            const victima = battle.units.find((item) => item.id === event.unitId)
            const gran = Boolean(victima && rarityOf(victima.card) !== 'normal')
            const color = event.side === 0 ? '#38bdf8' : '#ef4444'
            newFx.push({ id: nextId.current++, kind: 'rotura', x: event.x, z: event.z, r: gran ? 1.5 : 1, color, born: clock })
            // La camara lenta se guarda para el final de la partida: aqui solo el golpe y las astillas.
            shake.current = Math.max(shake.current, gran ? 0.7 : 0.45)
            break
          }
          case 'pace':
            setCallout({
              text: event.pace.gait === 'correr' && event.pace.index === 3 ? '¡A correr!' : '¡Más rápido!',
              key: nextId.current++,
            })
            break
          case 'over':
            setPending(null)
            if (event.by === 'fuerte') {
              // El fuerte salta por los aires: explosiones encadenadas, astillas, camara lenta y zoom.
              const caido: Side = event.winner === 0 ? 1 : 0
              const punto = fortHitPoint(caido)
              for (let i = 0; i < 4; i++) {
                newFx.push({
                  id: nextId.current++,
                  kind: 'blast',
                  x: punto.x + (i % 2 ? 1.1 : -1.1) * (i > 1 ? 0.6 : 1),
                  z: punto.z + (caido === 0 ? -1 : 1) * i * 0.5,
                  r: 3 + i * 0.4,
                  color: '',
                  born: clock + i * 0.2,
                })
              }
              newFx.push({ id: nextId.current++, kind: 'rotura', x: punto.x, z: punto.z, r: 2.6, color: '#c9893c', born: clock })
              newFx.push({ id: nextId.current++, kind: 'rotura', x: punto.x, z: punto.z, r: 1.8, color: '#ffd27a', born: clock + 0.25 })
              newFx.push({ id: nextId.current++, kind: 'dust', x: punto.x, z: punto.z, r: 1, color: '', born: clock })
              shake.current = 1.6
              slow.current = { from: clock, dur: 2.6, depth: 0.14 }
              lastSlow.current = clock
              finalFocus.current = { side: caido, from: clock }
              setCallout({ text: event.winner === 0 ? '¡FUERTE TUMBADO!' : '¡TE TUMBARON EL FUERTE!', key: nextId.current++ })
              sfx.blast()
              window.setTimeout(() => sfx.blast(), 380)
            }
            if (!finished.current) {
              finished.current = true
              onFinish?.(event.winner === 0, battle.time, sim.resumen(), sim.jugadas)
            }
            break
          default:
            break
        }
      }
      if (newFx.length > 0) {
        setFx((list) => [...list.filter((item) => clock - item.born < FX_MAX_LIFE), ...newFx].slice(-60))
      }
      if (newPopups.length > 0) setPopups((list) => [...list, ...newPopups].slice(-12))
      // Como mucho tres bocadillos a la vez, para que no se tapen unos a otros.
      if (newGlobos.length > 0) setGlobos((list) => [...list, ...newGlobos].slice(-3))
    },
    [],
  )

  // --- Puntero: arrastrar cartas al campo ---

  const localPoint = (event: ReactPointerEvent) => {
    const rect = container.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const groundAt = (x: number, y: number): Vec | null => {
    const camera = cameraRef.current
    if (!camera) return null
    const ndc = new Vector2((x / size.w) * 2 - 1, -(y / size.h) * 2 + 1)
    const ray = new Raycaster()
    ray.setFromCamera(ndc, camera)
    const hit = new Vector3()
    return ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), hit) ? { x: hit.x, z: hit.z } : null
  }

  const clearPreview = () => {
    aimTarget.current.visible = false
    mark.current.visible = false
    tunnelLine.current.visible = false
    tunnelIn.current.visible = false
    tunnelOut.current.visible = false
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (battle.over || !ready) return
    const p = localPoint(event)
    // Con el cuadro de dibujo abierto, tocar fuera lo cancela y la carta vuelve a la mano.
    if (pending) {
      setPending(null)
      clearPreview()
      return
    }
    // Doble toque sobre una torre tuya: vuelve a ser soldado y avanza (solo una vez).
    if (p.y < layout.handTop - 6) {
      const suelo = groundAt(p.x, p.y)
      const torre = suelo
        ? battle.units.find(
            (u) =>
              u.side === 0 &&
              u.torre &&
              u.state !== 'muerto' &&
              // Vale tocarle los pies o el cuerpo (que en pantalla queda "mas arriba", hacia el rival).
              Math.min(Math.hypot(u.x - suelo.x, u.z - suelo.z), Math.hypot(u.x - suelo.x, u.z - 2 - suelo.z)) < 1.8,
          )
        : undefined
      if (torre) {
        const ahora = performance.now()
        if (lastTap.current && lastTap.current.id === torre.id && ahora - lastTap.current.at < 450) {
          if (invitado) enviarAccion({ a: 'soltarTorre', unitId: torre.id })
          else jugar({ a: 'soltarTorre', unitId: torre.id })
          lastTap.current = null
          setCallout({ text: '¡AL ATAQUE!', key: nextId.current++ })
        } else {
          lastTap.current = { id: torre.id, at: ahora }
        }
        return
      }
    }
    let kind: 'batalla' | 'arma' | 'dinamita' | null = null
    let slot = 0
    layout.slots.forEach((rect, i) => {
      if (inside(rect, p.x, p.y, 4) && battle.hands[0].slots[i]?.cardId) {
        kind = 'batalla'
        slot = i
      }
    })
    if (layout.bonus && inside(layout.bonus, p.x, p.y, 4) && battle.dynamiteAmmo[0] > 0) kind = 'dinamita'
    const aiming = weaponCard(battle, 0)
    if (!kind && aiming && battle.hands[0].weapon.uses > 0) {
      const spot = groundAt(p.x, p.y)
      if (aiming.special === 'tunel') {
        // El tunel se saca como una tropa: desde su carta, desde la mano o desde tu mitad.
        const onCard = inside(layout.weapon, p.x, p.y, 4)
        const onHand = p.y >= layout.handTop - 6
        const mine = Boolean(spot && spot.z >= DEPLOY_FRONT && spot.z <= DEPLOY_BACK && p.y < layout.handTop - 6)
        if (onCard || onHand || mine) kind = 'arma'
      } else {
        // El arma se saca desde donde quieras: su carta, cualquier hueco de los mandos de abajo o
        // tu propia mitad de la raya. Se desliza sola hasta la altura a la que arrastres.
        const onCard = inside(layout.weapon, p.x, p.y, 4)
        const onHand = p.y >= layout.handTop - 6
        const behindLine = Boolean(spot && spot.z >= FIRE_LINE && p.y < layout.handTop - 6)
        if (onCard || onHand || behindLine) kind = 'arma'
      }
    }
    if (!kind) return
    if ((kind as string | null) === 'batalla') {
      // Con el campo lleno (o sin esperar la pausa) la carta ni se levanta: se avisa y ya.
      const permiso = puedeSacar(battle, 0, slot)
      if (!permiso.ok) {
        setCallout({
          text: permiso.motivo === 'vivos' ? `CAMPO LLENO · MÁXIMO ${maxVivosEn(battle.time)} SOLDADOS` : '¡UN MOMENTO!',
          key: nextId.current++,
        })
        return
      }
    }
    capturePointer(event.currentTarget, event.pointerId)
    drag.current = { active: true, kind, slot, x: p.x, y: p.y, wx: 0, wz: 0, overField: false }
    hold.current = { since: performance.now(), x: p.x, y: p.y, torre: false }
    setTorreArmada(false)
    setDragKind(kind)
    if (kind === 'arma') {
      stroke.current = []
      clearPreview()
    }
    aimX.current = null
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d.active) return
    const p = localPoint(event)
    d.x = p.x
    d.y = p.y
    d.overField = p.y < layout.handTop - 6
    const spot = groundAt(p.x, p.y)
    if (d.kind === 'arma') {
      // Si el dedo vuelve a tu raya o a los mandos, el disparo se cancela: no se apunta ni se pinta nada.
      const cancela = !d.overField || Boolean(spot && spot.z >= FIRE_LINE)
      setCancelando(cancela)
      if (cancela) {
        aimTarget.current = { visible: false, x: 0, z: 0 }
        mark.current.visible = false
        tunnelIn.current.visible = false
        tunnelOut.current.visible = false
        tunnelLine.current.visible = false
        return
      }
      // Solo se guarda el trazo: no se pinta nada. Pero el arma de tu raya SI sigue la punteria.
      if (spot) {
        const last = stroke.current[stroke.current.length - 1]
        if (!last || Math.hypot(spot.x - last.x, spot.z - last.z) > 0.18) stroke.current.push(spot)
        // El arma se pone SIEMPRE en la vertical del dedo (nunca fuera del campo) y tira recto.
        aimX.current = clampFireLine(0, spot.x).x
        const armed = weaponCard(battle, 0)
        const special = armed?.special
        // Las cargas explosivas caen donde apuntas: se ve el punto antes de soltar.
        aimTarget.current = { visible: Boolean(armed?.shot.mode === 'explosivo' && !special && d.overField), x: spot.x, z: spot.z }
        if (special === 'humo' && d.overField) {
          // Se ve el tamano de la nube antes de soltarla.
          mark.current = { visible: true, x: spot.x, z: spot.z, r: SMOKE_R, color: '#94a3b8' }
        } else if (special === 'tunel') {
          // El tunel mide siempre lo mismo: se ve donde caen las dos bocas antes de soltarlo.
          const at = d.overField ? clampDeploy(0, spot.x, spot.z) : null
          const far = at ? tunnelExit(0, at) : null
          tunnelIn.current = { visible: Boolean(at), x: at?.x ?? 0, z: at?.z ?? 0, r: 0.9, color: '#f472b6' }
          tunnelOut.current = { visible: Boolean(far), x: far?.x ?? 0, z: far?.z ?? 0, r: 0.9, color: '#f472b6' }
          const line = tunnelLine.current
          const a = line.points[0]
          const b = line.points[1]
          line.visible = Boolean(at && far)
          if (at && far && a && b) {
            a.x = at.x
            a.z = at.z
            b.x = far.x
            b.z = far.z
          }
        }
      }
      return
    }
    if (d.kind === 'dinamita') {
      if (!spot) return
      d.wx = spot.x
      d.wz = spot.z
      // El arma se pone en la vertical de donde va a caer la carga.
      aimX.current = clampFireLine(0, spot.x).x
      if (d.overField) {
        // El unico rango que se ve: donde va a caer la carga.
        mark.current = { visible: true, x: spot.x, z: spot.z, r: 2.4, color: '#fb923c' }
      } else {
        mark.current.visible = false
      }
      return
    }
    if (!d.overField) {
      mark.current.visible = false
      return
    }
    if (!spot) return
    const at = clampDeploy(0, spot.x, spot.z)
    const card = slotCard(battle, 0, d.slot)
    // Si el dedo se mueve, se cancela la torre y vuelve a contar el tiempo quieto.
    if (Math.hypot(p.x - hold.current.x, p.y - hold.current.y) > 12) {
      hold.current = { since: performance.now(), x: p.x, y: p.y, torre: false }
      setTorreArmada(false)
    }
    rango.current.x = at.x
    rango.current.z = at.z
    rango.current.r = card ? rangoDeTorre(card) : 2
    // Solo la marca del suelo: nada de linea de ruta (tapa el campo y confunde).
    mark.current = { visible: true, x: at.x, z: at.z, r: 0.75, color: hold.current.torre ? '#ffffff' : card?.accent ?? '#fbbf24' }
  }

  const onPointerUp = () => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    setDragKind(null)
    setCancelando(false)
    aimX.current = null
    if (d.kind === 'arma') {
      const card = weaponCard(battle, 0)
      const path = stroke.current
      stroke.current = []
      // Soltar de vuelta en tu raya (o en los mandos) cancela: no se gasta el disparo.
      const suelta = d.overField ? groundAt(d.x, d.y) : null
      setCancelando(false)
      if (!suelta || suelta.z >= FIRE_LINE) {
        clearPreview()
        return
      }
      if (card?.special) {
        // Suelta donde quieras: el humo cae ahi, el rayo va a todo el bando y el tunel abre sus
        // dos bocas a partir del punto donde lo sueltes.
        const target = d.overField ? groundAt(d.x, d.y) : null
        if (target) {
          if (invitado) enviarAccion({ a: 'especial', destino: alReves(target) })
          else jugar({ a: 'especial', destino: { x: target.x, z: target.z } })
        }
      } else {
        if (card?.shot.mode === 'explosivo') {
          // Se lanza AL PUNTO donde sueltas (si cae mas lejos de su alcance, cae en el limite).
          const target = d.overField ? groundAt(d.x, d.y) : null
          if (target) {
            const posicion = clampFireLine(0, target.x).x
            if (invitado) enviarAccion({ a: 'disparo', posicion: -posicion, destino: alReves(target) })
            else jugar({ a: 'disparo', posicion, destino: { x: target.x, z: target.z } })
          }
        } else {
          const shot = weaponShotFromStroke(0, path)
          if (shot) {
            if (invitado) enviarAccion({ a: 'disparo', posicion: -shot.position })
            else jugar({ a: 'disparo', posicion: shot.position })
          }
        }
      }
      clearPreview()
      return
    }
    if (d.kind === 'dinamita') {
      if (d.overField) {
        const origin = clampFireLine(0, d.wx).x
        if (invitado) enviarAccion({ a: 'dinamita', origen: -origin, destino: alReves({ x: d.wx, z: d.wz }) })
        else jugar({ a: 'dinamita', origen: origin, destino: { x: d.wx, z: d.wz } })
      }
      clearPreview()
      return
    }
    const card = slotCard(battle, 0, d.slot)
    const ground = d.overField ? groundAt(d.x, d.y) : null
    if (card && ground && !battle.over) {
      const at = clampDeploy(0, ground.x, ground.z)
      setPending({ slot: d.slot, x: at.x, z: at.z, card, torre: hold.current.torre })
      setTorreArmada(false)
      mark.current.visible = true
      return
    }
    clearPreview()
  }

  const onTraced = (accuracy: number) => {
    if (!pending) return
    const sale = invitado
      ? (enviarAccion({ a: 'carta', slot: pending.slot, x: -pending.x, z: -pending.z, precision: accuracy, torre: pending.torre }), true)
      : jugar({ a: 'carta', slot: pending.slot, x: pending.x, z: pending.z, precision: accuracy, torre: pending.torre })
    if (!sale) setCallout({ text: 'NO HA PODIDO SALIR', key: nextId.current++ })
    setPending(null)
    clearPreview()
  }

  const restart = () => {
    if (onRematch) {
      onRematch()
      return
    }
    finished.current = false
    const next = makeBattle(deck, botDeck)
    setGame(next)
    setRound((value) => value + 1)
    setSnap(snapshotOf(next.battle))
    setPending(null)
    setFx([])
    setPopups([])
    lastIds.current = { slots: [], weapon: null, bonus: 0 }
    clearPreview()
    setCallout({ text: '¡A duelo!', key: nextId.current++ })
  }

  const handView: HandView = {
    slots: snap.slots.map((slot, i) => ({
      card: slot.cardId ? battle.cards.get(slot.cardId) ?? null : null,
      drawKey: drawKeys.slots[i] ?? 0,
      dimmed: snap.vivos >= snap.maxVivos,
    })),
    weapon: {
      card: snap.weapon.cardId ? battle.cards.get(snap.weapon.cardId) ?? null : null,
      drawKey: drawKeys.weapon,
      ready: snap.weapon.uses > 0,
    },
    bonus: hasBonus
      ? { card: BONUS_DYNAMITE, charges: snap.dynamite, drawKey: drawKeys.bonus }
      : null,
    holding: pending?.slot ?? null,
  }

  const hpPct = (side: Side) => Math.max(0, snap.hp[side] / snap.maxHp) * 100
  // El cuadro del patron va donde estaban las cartas: cabe en la franja de la mano.
  const padSize = Math.max(120, Math.min(230, size.w * 0.6, size.h - layout.handTop - 40))
  const over = battle.over
  // El arma montada en tu raya: la carta que llevas en la mano es la que dispara.
  const weaponView = snap.weapon.cardId ? battle.cards.get(snap.weapon.cardId) : null
  const weaponModel = weaponView && weaponView.kind === 'arma' ? weaponView.model : null
  const weaponAccent = weaponView?.accent ?? '#fbbf24'
  // El alcance que se enseña al apuntar es el de verdad: con el clima y tu precision ya aplicados.
  const weaponRange =
    weaponView && weaponView.kind === 'arma'
      ? weaponView.shot.range * ajusteDeDisparos(clima) * battle.alcanceArma
      : 0
  const weaponUses = weaponView && weaponView.kind === 'arma' ? usesOf(weaponView) : WEAPON_USES
  const special = weaponView && weaponView.kind === 'arma' ? weaponView.special : undefined
  // El arma del rival, para verla en su casa.
  const foeView = snap.foe.cardId ? battle.cards.get(snap.foe.cardId) : null
  const foeModel = foeView && foeView.kind === 'arma' ? foeView.model : null
  const foeAccent = foeView?.accent ?? '#ef4444'

  return (
    <div
      ref={container}
      className="no-select relative h-full w-full touch-none overflow-hidden bg-[#1a0f08]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        frameloop={FRAMELOOP}
        orthographic
        dpr={calidad}
        // En pantallas muy densas (los moviles) el suavizado de bordes cuesta mucho y casi no se nota.
        gl={{ antialias: typeof window === 'undefined' || window.devicePixelRatio < 2, powerPreference: 'high-performance' }}
        camera={{ position: [0, 20, 30], zoom: 30 }}
      >
        {/* Si el movil va justo, baja sola la resolucion; si vuelve a ir bien, la sube */}
        <PerformanceMonitor onDecline={() => setCalidad(1)} onIncline={() => setCalidad(1.5)} flipflops={3} />
        {/* El clima manda en la luz: de dia se ve el escenario como es; de noche, de lluvia o helado, no. */}
        <color attach="background" args={[esDia ? scenario.sky : info.cielo]} />
        <fog
          attach="fog"
          args={[
            esDia ? scenario.sky : info.cielo,
            esDia ? scenario.fog[0] : scenario.fog[0] * 0.9,
            esDia ? scenario.fog[1] : scenario.fog[1] * 0.95,
          ]}
        />
        <CameraRig layout={layout} cameraRef={cameraRef} baseRef={camBase} />
        {MANUAL && <SondaGl battle={battle} deck={deck} />}
        <hemisphereLight
          args={esDia ? [scenario.hemiSky, scenario.hemiGround, 0.9] : [info.cielo, '#2a3652', 1.05]}
        />
        <ambientLight intensity={esDia ? 0.35 : info.ambiente} color={esDia ? '#ffe9c8' : info.colorSol || '#9db8ff'} />
        <directionalLight
          position={[8, 16, 10]}
          intensity={esDia ? scenario.sunIntensity : scenario.sunIntensity * info.sol}
          color={esDia ? scenario.sun : info.colorSol || scenario.sun}
        />
        <directionalLight
          position={[-10, 6, -8]}
          intensity={esDia ? 0.7 : 0.55}
          color={esDia ? '#ff9d5c' : '#6f8ad8'}
        />
        {!esDia && <directionalLight position={[-6, 14, -12]} intensity={0.75} color="#dbe8ff" />}
        <ClimaFx info={info} />
        <CamaraViva cameraRef={cameraRef} baseRef={camBase} battle={battle} activa={camActiva} focus={finalFocus} punch={punch} />
        <Driver
          battle={battle}
          sim={sim}
          botQuieto={Boolean(guia?.botQuieto) || Boolean(red)}
          slow={slow}
          paused={Boolean(over) || !ready || fase !== 'listo' || Boolean(guia?.pausa) || Boolean(red)}
          paceRef={paceRef}
          onTick={onTick}
          onEvents={onEvents}
        />
        <ShakeGroup shake={shake}>
          <Field
            battle={battle}
            scenario={scenario}
            deploying={dragKind === 'batalla'}
            aiming={dragKind === 'arma'}
            onReady={onFieldReady}
          />
          <Units key={round} battle={battle} paceRef={paceRef} />
          <WeaponRig
            side={1}
            model={foeModel}
            uses={snap.foe.uses}
            maxUses={WEAPON_USES}
            accent={foeAccent}
            aimX={foeAimX}
            recoil={foeRecoil}
            burst={foeBurst}
            muzzle={foeMuzzle}
          />
          <WeaponRig
            model={weaponModel}
            uses={snap.weapon.uses}
            maxUses={weaponUses}
            accent={weaponAccent}
            aimX={aimX}
            recoil={recoil}
            burst={burst}
            muzzle={muzzle}
          />
          {/* La guia de punteria: pasillo, mirilla del alcance y dianas en los que vas a dar */}
          <AimGuide
            battle={battle}
            active={dragKind === 'arma' && !special}
            muzzle={muzzle}
            range={weaponRange}
            shot={weaponView && weaponView.kind === 'arma' ? weaponView.shot : null}
            accent={weaponAccent}
            target={aimTarget}
          />
          <TroopShots battle={battle} />
          <WeaponBullets battle={battle} />
          <GroundMark data={mark} />
          <RangoTorre data={rango} />
          {/* Las dos bocas del tunel mientras lo colocas. */}
          <GroundMark data={tunnelIn} />
          <GroundMark data={tunnelOut} />
          <Ribbon data={tunnelLine} order={6} />
          <SmokeClouds battle={battle} />
          <ZapField battle={battle} />
          <TunnelPortals battle={battle} />
          {/* Las habilidades de cada muñeco: zonas, proyectiles, rayos, conos de fuego… */}
          <HabilidadesLayer battle={battle} />
          <SucesosClimaFx battle={battle} />
          <FxLayer items={fx} />
          <PopupLayer items={popups} />
          <GloboLayer items={globos} />
        </ShakeGroup>
        <HandHud layout={layout} view={handView} drag={drag} />
      </Canvas>

      {/* ---------- Destello de las entradas epicas y divinas ---------- */}
      {destello && (
        <div
          key={destello.key}
          className="destello pointer-events-none absolute inset-0 z-[25]"
          style={{ background: `radial-gradient(circle at 50% 55%, ${destello.color}cc 0%, ${destello.color}55 32%, transparent 70%)` }}
        />
      )}

      {/* ---------- Avisos mientras apuntas ---------- */}
      {dragKind === 'arma' && (
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center" style={{ top: layout.field.top + 6 }}>
          <span
            className={`rounded-full px-3 py-1 text-[13px] font-bold uppercase tracking-wider ${
              cancelando ? 'bg-rose-900/90 text-rose-100' : 'bg-black/75 text-amber-100'
            }`}
          >
            {cancelando
              ? 'Soltar aquí cancela el disparo'
              : special === 'humo'
              ? 'Suéltala donde quieras (mejor en su base): tus tropas dentro no se ven'
              : special === 'rayo'
                ? 'Suelta: cae la tormenta y el bando rival se queda clavado 8 s'
                : special === 'tunel'
                  ? 'Suéltalo en tu campo: las dos bocas caen solas, una en cada lado'
                  : weaponView?.kind === 'arma' && weaponView.shot.mode === 'explosivo'
                    ? 'Suelta donde quieras que caiga: explota tras la mecha'
                    : 'Desliza el dedo por tu raya: dispara recto desde donde lo pongas'}
          </span>
        </div>
      )}
      {dragKind === 'batalla' && torreArmada && (
        <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: layout.field.top + 8 }}>
          <span className="resultado-pop rounded-2xl border-2 border-white bg-slate-800/95 px-4 py-2 text-center shadow-[0_0_24px_rgba(255,255,255,0.45)]">
            <span className="block font-west text-[22px] leading-none text-white"><Icono nombre="torre" /> TORRE</span>
            <span className="mt-0.5 block text-[12px] font-bold uppercase tracking-wide text-slate-200">Suelta para plantarla · mueve el dedo para cancelar</span>
          </span>
        </div>
      )}
      {dragKind === 'batalla' && !torreArmada && (
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center" style={{ top: layout.field.top + 6 }}>
          <span className="rounded-full bg-black/75 px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-amber-100">
            Suelta para atacar · deja el dedo quieto para hacerla torre
          </span>
        </div>
      )}
      {dragKind === 'dinamita' && (
        <div className="pointer-events-none absolute inset-x-0 z-20 flex justify-center" style={{ top: layout.field.top + 6 }}>
          <span className="rounded-full bg-black/75 px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-amber-100">
            Suelta donde quieres que caiga y explote
          </span>
        </div>
      )}
      {snap.dynamite > 0 && layout.bonus && (
        <div
          className="pointer-events-none absolute z-10 flex flex-col items-center"
          style={{ left: layout.bonus.x, top: layout.bonus.y - 18, width: layout.bonus.w }}
        >
          <span className="rounded-full border border-amber-300 bg-[#7a350e] px-2 py-[1px] text-[12px] font-bold leading-none text-amber-100 shadow-[0_0_12px_#fbbf24]">
            <Icono nombre="dinamita" /> ×{snap.dynamite}
          </span>
        </div>
      )}

      {/* ---------- Marcador de arriba: el fuerte rival y el reloj ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-14 items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onExit}
          className="pointer-events-auto rounded-lg border border-amber-300/40 bg-black/50 px-2 py-1 text-[13px] text-amber-100"
        >
          ✕
        </button>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-rose-100">
            <span>Fuerte rival</span>
            <span className="font-mono">{Math.ceil(snap.hp[1])}</span>
          </div>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full border border-black/60 bg-black/60">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-red-400 transition-[width] duration-200" style={{ width: `${hpPct(1)}%` }} />
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="font-west text-[20px] leading-none text-amber-50" style={{ textShadow: '0 2px 0 #1a0d04' }}>
            {timeLabel(TIEMPO_MAXIMO_S - snap.time)}
          </span>
          <span
            className={`mt-0.5 rounded-full px-1.5 text-[11px] font-bold uppercase tracking-wider ${
              snap.pace.gait === 'correr' ? 'bg-rose-500/80 text-white' : 'bg-amber-400/80 text-amber-950'
            }`}
          >
            {snap.pace.label}
          </span>
        </div>
      </div>

      {snap.cart && (
        <div
          className={`pointer-events-none absolute left-1/2 top-14 z-10 w-[min(280px,76vw)] -translate-x-1/2 rounded-lg border-2 bg-[#241406]/90 px-2 py-1 ${
            snap.cart.shielded ? 'border-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.6)]' : 'border-amber-300 shadow-[0_0_18px_rgba(255,191,61,0.55)]'
          }`}
        >
          <div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-wider text-amber-100">
            <span>VAGONETA · PREMIO: 5 DINAMITAS</span>
            <span className="font-mono">{snap.cart.shielded ? 'ESCUDO' : Math.ceil(snap.cart.hp)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded border border-black/70 bg-black/80">
            <div
              className={`h-full ${snap.cart.shielded ? 'bg-gradient-to-r from-sky-500 to-cyan-200' : 'bg-gradient-to-r from-amber-600 to-yellow-300'}`}
              style={{ width: `${snap.cart.shielded ? 100 : (snap.cart.hp / snap.cart.maxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ---------- Tu vida, encima de la mano ---------- */}
      <div className="pointer-events-none absolute inset-x-2.5" style={{ top: layout.handTop + 4 }}>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-wider text-sky-100">Tu fuerte</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-black/60 bg-black/60">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-600 to-cyan-300 transition-[width] duration-200" style={{ width: `${hpPct(0)}%` }} />
          </div>
          <span className="font-mono text-[12px] text-sky-100">{Math.ceil(snap.hp[0])}</span>
          {/* Tus soldados en el campo (el maximo sube cada minuto) y tu racha. */}
          <span
            className={`flex items-center gap-1 rounded-full border bg-black/60 px-2 py-[1px] text-[13px] font-bold leading-none ${
              snap.vivos >= snap.maxVivos
                ? 'border-red-300/80 text-red-200'
                : 'border-amber-300/70 text-amber-100'
            }`}
          >
            <Icono nombre="vaquero" /> {snap.vivos}/{snap.maxVivos}
          </span>
        </div>
      </div>

      {/* ---------- Reroll: debajo de la carta del arma ---------- */}
      <button
        type="button"
        title="Cambia el arma por otra al azar. Se recarga cada 30 s"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => (invitado ? enviarAccion({ a: 'reroll' }) : jugar({ a: 'reroll' }))}
        disabled={snap.rerollIn > 0}
        className={`absolute z-10 flex items-center justify-center gap-1 rounded-xl border-2 text-[14px] font-bold uppercase leading-none tracking-wider ${
          snap.rerollIn > 0
            ? 'border-black/60 bg-black/50 text-amber-200/50'
            : 'border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 shadow-[0_0_12px_rgba(251,191,36,0.6)] active:scale-95'
        }`}
        style={{ left: layout.reroll.x, top: layout.reroll.y, width: layout.reroll.w, height: layout.reroll.h }}
      >
        <Icono nombre="reroll" /> <span>{snap.rerollIn > 0 ? `${Math.ceil(snap.rerollIn)} s` : 'Reroll'}</span>
      </button>

      {/* ---------- Campo lleno: las cartas se ponen grises y se explica por que ---------- */}
      {snap.vivos >= snap.maxVivos && !over && (
        <>
          {layout.slots.map((rect, i) =>
            snap.slots[i]?.cardId ? (
              <div
                key={`lleno-${i}`}
                className="pointer-events-none absolute z-20 flex flex-col items-center justify-center rounded-xl border-2 border-slate-400/60 text-center"
                style={{
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  background: 'rgba(20,22,28,0.62)',
                  backdropFilter: 'grayscale(1) brightness(0.55)',
                  WebkitBackdropFilter: 'grayscale(1) brightness(0.55)',
                }}
              >
                <span className="text-3xl"><Icono nombre="candado" /></span>
                <span className="mt-1 px-1 text-[12px] font-black uppercase leading-tight tracking-wide text-slate-100">Campo lleno</span>
              </div>
            ) : null,
          )}
          <div className="pointer-events-none absolute inset-x-0 z-30 flex justify-center" style={{ top: layout.handTop - 26 }}>
            <span className="rounded-full border border-slate-300/50 bg-slate-900/90 px-3 py-1 text-[13px] font-bold uppercase tracking-wide text-slate-100">
              <Icono nombre="candado" /> {snap.vivos}/{snap.maxVivos} soldados · espera a que caiga uno para sacar otra carta
            </span>
          </div>
        </>
      )}

      {/* ---------- Fondo de la mano: huecos, cuentas atras y usos del arma ---------- */}
      {layout.slots.map((rect, i) => {
        const slot = snap.slots[i]
        if (!slot || slot.cardId) return null
        return (
          <div
            key={i}
            className="pointer-events-none absolute rounded-xl border-2 border-dashed border-amber-700/60"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          >
            <div className="flex h-full flex-col items-center justify-center">
              <span className="font-west text-[34px] leading-none text-amber-100/90">{Math.ceil(slot.readyIn)}</span>
              <div className="mt-2 h-1.5 w-3/4 overflow-hidden rounded-full bg-black/50">
                <div className="h-full bg-amber-400 transition-[width] duration-200 ease-linear" style={{ width: `${(1 - slot.readyIn / DRAW_S) * 100}%` }} />
              </div>
              <span className="mt-1 text-[11px] uppercase tracking-wider text-amber-200/60">Nueva carta</span>
            </div>
          </div>
        )
      })}
      {!snap.weapon.cardId && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-dashed border-sky-400/60"
          style={{ left: layout.weapon.x, top: layout.weapon.y, width: layout.weapon.w, height: layout.weapon.h }}
        >
          <div className="flex h-full flex-col items-center justify-center">
            <span className="font-west text-[34px] leading-none text-sky-100">{Math.ceil(snap.weapon.readyIn)}</span>
            <div className="mt-2 h-1.5 w-3/4 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full bg-sky-400 transition-[width] duration-200 ease-linear"
                style={{ width: `${(1 - snap.weapon.readyIn / WEAPON_SWAP_S) * 100}%` }}
              />
            </div>
            <span className="mt-1 text-[11px] uppercase tracking-wider text-sky-200/70">Cambiando arma</span>
          </div>
        </div>
      )}
      {snap.weapon.cardId && (
        <div
          className="pointer-events-none absolute flex gap-1"
          style={{ left: layout.weapon.x + layout.weapon.w / 2, top: layout.weapon.y - 12, transform: 'translateX(-50%)' }}
        >
          {Array.from({ length: weaponUses }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 ${
                i < snap.weapon.uses ? 'border-amber-100 bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'border-black/60 bg-black/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* ---------- Cuadro del patron ---------- */}
      {pending && (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center justify-center bg-[#1b1008]"
          style={{ top: layout.handTop }}
        >
          <TracePad
            points={patternById(pending.card.pattern).points}
            color={pending.card.accent}
            title={`${pending.torre ? '🏰 Torre' : '⚔️ Atacante'} · ${pending.card.name}`}
            size={padSize}
            onDone={onTraced}
          />
          <p className="mt-1 text-center text-[12px] text-amber-100/70" style={{ textShadow: '0 1px 2px #000' }}>
            Toca el campo para cancelar
          </p>
        </div>
      )}

      {/* ---------- El principio: primero el "VS", y luego la ruleta del día y la noche ---------- */}
      {fase !== 'listo' && ready && (
        <div className="fondo-oeste absolute inset-0 z-30 flex flex-col items-center justify-center px-4 text-center">
          {/* Un cartel de cristal oscuro: que se lea encima del sol del fondo */}
          <div className="cartel-cristal flex w-full max-w-[380px] flex-col items-center gap-5 px-4 py-5">
          <p className="font-west text-[15px] uppercase tracking-[0.3em] text-amber-200/80">
            {scenario.icon} {scenario.name}
          </p>
          {etiqueta && (
            <p className="-mt-3 rounded-full border border-amber-300/40 bg-amber-400/15 px-3 py-1 text-[12px] uppercase tracking-[0.2em] text-amber-100">
              {etiqueta}
            </p>
          )}
          {fase === 'vs' ? (
            <>
              <Logo ancho="min(230px, 58vw)" className="-my-3" rayos />
              <div className="flex w-full items-center justify-center gap-3">
                <div className="flex-1">
                  <p className="font-west text-[24px] leading-none text-rose-200">☠ {rival}</p>
                  <p className="mt-1 text-[12px] uppercase tracking-[0.25em] text-rose-200/60">Tu rival</p>
                </div>
                <span className="font-west text-[40px] leading-none text-amber-300" style={{ textShadow: '0 3px 0 #7a2d0c' }}>
                  VS
                </span>
                <div className="flex-1">
                  <p className="font-west text-[24px] leading-none text-sky-200"><Icono nombre="vaquero" /> {player.name}</p>
                  <p className="mt-1 text-[12px] uppercase tracking-[0.25em] text-sky-200/60">Tú</p>
                </div>
              </div>
              <p className="font-west text-[18px] text-amber-100">¡Que empiece el duelo!</p>
            </>
          ) : (
            <>
              <p className="font-west text-[26px] leading-none text-amber-100">¿Qué tiempo hará?</p>
              <Ruleta girando={giro} clima={clima} />
              <p className="max-w-[280px] text-[13px] leading-snug text-amber-200/70">
                {info.icon} <b className="text-amber-100">{info.label}</b> · {info.nota}
              </p>
            </>
          )}
          </div>
        </div>
      )}

      {/* ---------- Avisos grandes ---------- */}
      {!ready && (
        <div className="fondo-oeste absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <Logo ancho="min(280px, 70vw)" rayos />
          <div className="cartel-cristal mt-1 flex w-full max-w-[340px] flex-col items-center gap-1.5 px-4 py-3">
            <p className="font-west text-3xl text-amber-50">
              {scenario.icon} {scenario.name}
            </p>
            <p className="text-[14px] text-amber-100/85">{scenario.note}</p>
            <p className="mt-1 flex items-center gap-2 text-[14px] font-bold uppercase tracking-widest text-amber-300">
              <Icono nombre="arma" className="animate-spin text-xl" style={{ animationDuration: '1.6s' }} />
              {guia ? 'Preparando el escenario…' : 'Buscando rival…'}
            </p>
          </div>
        </div>
      )}

      {fase === 'listo' && <PantallaClima battle={battle} />}

      {callout && !over && (
        <div key={callout.key} className="pointer-events-none absolute inset-x-0 top-[34%] z-[16] flex justify-center px-4 text-center">
          <span
            className="assault-pop font-west text-[44px] leading-[0.95] text-amber-50"
            style={{ textShadow: '0 4px 0 #7a2d0c, 0 0 24px rgba(0,0,0,0.9)' }}
          >
            {callout.text}
          </span>
        </div>
      )}

      {over && finalListo && (
        // Un solo cartel al final: el resultado, lo que te llevas y a por otra.
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-5 backdrop-blur-[2px]">
          <div
            className="resultado-pop flex w-full max-w-[320px] flex-col items-center gap-3 rounded-2xl border-2 bg-[#1b1108]/95 p-5 text-center shadow-[0_0_40px_rgba(0,0,0,0.8)]"
            style={{ borderColor: over.winner === 0 ? '#fbbf24' : '#f87171' }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p
              className="font-west text-[48px] leading-none"
              style={{ color: over.winner === 0 ? '#fde68a' : '#fca5a5', textShadow: '0 4px 0 #1a0d04' }}
            >
              {over.winner === 0 ? '¡Victoria!' : 'Derrota'}
            </p>
            <p className="text-[14px] text-amber-100/80">
              {over.by === 'tiempo'
                ? over.winner === 0
                  ? 'Se acabó el tiempo: tu fuerte aguanta más vida'
                  : 'Se acabó el tiempo: su fuerte aguanta más vida'
                : over.winner === 0
                  ? 'Has tumbado el fuerte rival'
                  : 'Han tumbado tu fuerte'}{' '}
              en {timeLabel(snap.time)}
            </p>
            {resultado}
            <div className="flex w-full flex-col gap-2">
              {onRematch && (
                <button type="button" className="btn-gold w-full" onClick={restart}>
                  ⚔ Buscar otra partida
                </button>
              )}
              <button type="button" className="btn-ghost w-full" onClick={onExit}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
