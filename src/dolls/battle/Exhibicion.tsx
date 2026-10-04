import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three'
import { BUILTIN_BATTLE } from '../cards/catalog'
import { claseDe, rarityInfo, rarityOf } from '../cards/model'
import type { BattleCard } from '../cards/model'
import { SCENARIOS } from '../scenes/scenarios'
import { Scenery } from '../scenes/Scenery'
import { FRAMELOOP } from '../debugClock'
import { FX_MAX_LIFE, FxLayer, TroopShots, WeaponBullets } from './Effects'
import type { Fx } from './Effects'
import { Field } from './Field'
import { PopupLayer, Shake, Units } from './Galeria'
import type { Popup } from './Galeria'
import { createBattle, drainEvents, hacerTorre, paceAt, rangoDeTorre, spawnUnit, step } from './engine'
import type { Pace, Unit } from './engine'
import { precargarBatalla, sfx } from './sfx'

/**
 * **La exhibición de una carta**: lo que se ve en "Verlo pelear" y "Como torre". No es un trozo de
 * campo visto desde arriba: es una escena de cine para que entren ganas de tener la carta.
 *
 *  - La cámara va detrás de tu muñeco, a su altura, y entra con un plano de presentación.
 *  - Le salen **oleadas** cada vez más gordas (2, 3 y 4 rivales). Si las aguanta todas: ¡IMPARABLE!
 *  - Cada baja va a **cámara lenta** con un golpe de zoom y su letrero (¡BAJA!, ¡DOBLE!, ¡TRIPLE!).
 *  - Arriba, su nombre del color de su rareza, la oleada, las bajas y los escudos que ha quitado;
 *    abajo, la vida que le queda. A sus pies, un aura de su rareza.
 */

const SALIDA_Z = 12
const OLEADAS = [2, 3, 4]

/** Los normales de su misma clase (contra los de su bando se ve más natural). */
function normalesDe(card: BattleCard): BattleCard[] {
  const clase = claseDe(card)
  const suyos = BUILTIN_BATTLE.filter((c) => claseDe(c) === clase && rarityOf(c) === 'normal' && c.id !== card.id)
  return suyos.length > 0 ? suyos : [BUILTIN_BATTLE[0]!]
}

/**
 * Los rivales de la exhibición son **bandidos de feria**: un escudo, disparan despacio y de cerca
 * (contra una torre, siempre dentro de su círculo). La exhibición es para ver lo que hace tu carta,
 * no para medirla: eso es la partida.
 */
function rivalesDe(card: BattleCard, torre: boolean): BattleCard[] {
  const alcance = rangoDeTorre(card)
  return normalesDe(card).map((c) => ({
    ...c,
    shields: 1,
    fireMs: Math.round(c.fireMs * 3),
    range: Math.max(1.5, torre ? Math.min(c.range * 0.75, alcance - 0.8) : c.range * 0.75),
  }))
}

/** Lo que dura como mucho una oleada: si se atasca, los que quedan huyen. */
const OLEADA_MAX_S = 18

interface Marcador {
  oleada: number
  bajas: number
  quitados: number
  escudos: number
  maxEscudos: number
}

/** El color de la rareza (las normales, bronce: el gris no luce). */
function colorDe(card: BattleCard): string {
  const r = rarityOf(card)
  return r === 'normal' ? '#e0a85c' : rarityInfo(r).color
}

export function Exhibicion({ card, torre = false, className = '' }: { card: BattleCard; torre?: boolean; className?: string }) {
  const color = colorDe(card)
  const rareza = rarityInfo(rarityOf(card))
  const rivales = useMemo(() => rivalesDe(card, torre), [card, torre])
  const escolta = useMemo(() => normalesDe(card), [card])
  const [ronda, setRonda] = useState(0)
  const battle = useMemo(
    () => createBattle({ decks: [[card], [rivales[0]!]], practice: true }),
    // Una partida nueva en cada ronda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card, rivales, ronda],
  )
  const heroe = useRef<Unit | null>(null)
  const paceRef = useRef<Pace>(paceAt(0))
  const nextId = useRef(1)
  const shake = useRef(0)
  /** La cámara lenta: 1 = normal. */
  const lenta = useRef(1)
  /** El golpe de zoom (0 a 1): se apaga solo. */
  const zoom = useRef(0)
  const [fx, setFx] = useState<Fx[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [marcador, setMarcador] = useState<Marcador>({ oleada: 1, bajas: 0, quitados: 0, escudos: 0, maxEscudos: 0 })
  /** El letrero grande del centro (¡BAJA!, OLEADA 2, ¡IMPARABLE!…). */
  const [letrero, setLetrero] = useState<{ texto: string; color: string; n: number } | null>(null)
  const ultimasBajas = useRef<number[]>([])
  const estado = useRef({ oleada: 0, entre: 0.9, fin: 0, bajas: 0, quitados: 0, enOleada: 0, quitadoOleada: 0, reforzado: false })

  useEffect(() => {
    void precargarBatalla()
  }, [])

  const cartel = (texto: string, tinte = color) => setLetrero((antes) => ({ texto, color: tinte, n: (antes?.n ?? 0) + 1 }))

  // Se monta el héroe al empezar (y en cada reinicio).
  useEffect(() => {
    battle.units.length = 0
    const h = spawnUnit(battle, 0, card, { x: 0, z: SALIDA_Z }, 'excelente')
    if (torre) hacerTorre(battle, h)
    heroe.current = h
    estado.current = { oleada: 0, entre: 1.3, fin: 0, bajas: 0, quitados: 0, enOleada: 0, quitadoOleada: 0, reforzado: false }
    ultimasBajas.current = []
    setMarcador({ oleada: 1, bajas: 0, quitados: 0, escudos: h.shields, maxEscudos: h.maxShields })
    setFx([])
    setPopups([])
    cartel(torre ? `🏰 ${card.name} defiende` : `⚔️ ${card.name}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle])

  /** Saca la oleada `n` (0, 1, 2): delante del héroe, a la distancia de su alcance. */
  const sacarOleada = (n: number) => {
    const h = heroe.current
    if (!h) return
    // El atacante vuelve a su sitio para cada oleada (con su polvo); la torre no se mueve.
    if (!torre) {
      h.x = 0
      h.z = SALIDA_Z
    }
    // Se recupera entre oleadas.
    if (n > 0 && h.shields < h.maxShields) {
      h.shields = h.maxShields
      setPopups((lista) => [...lista, { id: nextId.current++, x: h.x, z: h.z, text: '+🛡', color: '#86efac', born: performance.now() / 1000 }])
    }
    estado.current.enOleada = 0
    estado.current.quitadoOleada = 0
    const cuantos = OLEADAS[n]!
    const lejos = torre ? rangoDeTorre(card) + 4 : card.range + 4.5
    for (let i = 0; i < cuantos; i++) {
      const rival = rivales[(n * 3 + i) % rivales.length]!
      const x = (i - (cuantos - 1) / 2) * 2.1
      spawnUnit(battle, 1, rival, { x, z: SALIDA_Z - lejos - (i % 2) * 1.4 - n * 0.6 }, 'mal')
    }
    cartel(`OLEADA ${n + 1}`, '#fde68a')
  }

  const onEventos = (eventos: ReturnType<typeof drainEvents>, reloj: number) => {
    const nuevosFx: Fx[] = []
    const nuevos: Popup[] = []
    const ahora = performance.now() / 1000
    for (const e of eventos) {
      if (e.type === 'troopShot') sfx.hit()
      if (e.type === 'unitHit') {
        nuevosFx.push({ id: nextId.current++, kind: 'spark', x: e.x, z: e.z, r: 1, color: e.side === 1 ? color : '#ffffff', born: reloj })
        if (e.side === 1) {
          estado.current.quitados += e.amount
          estado.current.quitadoOleada += e.amount
          nuevos.push({ id: nextId.current++, x: e.x, z: e.z, text: `−${Math.round(e.amount * 10) / 10}`, color: '#fde68a', born: ahora })
        }
        shake.current = Math.max(shake.current, 0.18)
      }
      if (e.type === 'golpeTorre') {
        nuevosFx.push({ id: nextId.current++, kind: 'warp', x: e.x, z: e.z, r: 1.2, color, born: reloj })
      }
      if (e.type === 'unitDeath') {
        nuevosFx.push({ id: nextId.current++, kind: 'dust', x: e.x, z: e.z, r: 1.2, color: '', born: reloj })
        shake.current = Math.max(shake.current, 0.6)
        sfx.kill()
        if (e.side === 1) {
          estado.current.bajas += 1
          // Cámara lenta y golpe de zoom.
          lenta.current = 0.22
          zoom.current = 1
          const t = performance.now()
          ultimasBajas.current = [...ultimasBajas.current.filter((b) => t - b < 2200), t]
          const seguidas = ultimasBajas.current.length
          cartel(seguidas >= 3 ? '¡TRIPLE BAJA!' : seguidas === 2 ? '¡DOBLE BAJA!' : '¡BAJA!', seguidas >= 2 ? '#fb923c' : color)
          nuevos.push({ id: nextId.current++, x: e.x, z: e.z, text: '💥', color: '#fde68a', born: ahora })
        }
      }
      // El héroe aguanta: a un escudo, los golpes rebotan (sale el escudo, no una explosión).
      if (e.type === 'blast' && e.side === 0 && e.r === 0.9 && heroe.current && Math.hypot(e.x - heroe.current.x, e.z - heroe.current.z) < 0.5) {
        nuevosFx.push({ id: nextId.current++, kind: 'warp', x: e.x, z: e.z, r: 1, color: '#e0f2fe', born: reloj })
        nuevos.push({ id: nextId.current++, x: e.x, z: e.z, text: '🛡', color: '#bae6fd', born: ahora })
        continue
      }
      if (e.type === 'blast') {
        nuevosFx.push({ id: nextId.current++, kind: 'blast', x: e.x, z: e.z, r: e.r, color: '', born: reloj })
        shake.current = Math.max(shake.current, 0.9)
        sfx.blast()
      }
    }
    if (nuevosFx.length > 0) setFx((lista) => [...lista.filter((f) => reloj - f.born < FX_MAX_LIFE), ...nuevosFx].slice(-50))
    if (nuevos.length > 0) setPopups((lista) => [...lista.filter((p) => ahora - p.born < 1.1), ...nuevos].slice(-12))
  }

  /** Cada fotograma: la partida (con su cámara lenta), las oleadas y el marcador. */
  const latido = (dt: number, reloj: number) => {
    lenta.current = Math.min(1, lenta.current + dt * 1.6)
    zoom.current = Math.max(0, zoom.current - dt * 1.8)
    const escala = lenta.current
    battle.timeScale = escala
    // El héroe aguanta: con un escudo le queda una burbuja que se come los golpes (malherido, pero en pie).
    const yo = heroe.current
    if (yo && yo.state !== 'muerto') {
      yo.hab.burbuja = yo.shields <= 1 ? 99 : 0
      yo.hab.burbujaHasta = battle.time + 1
    }
    step(battle, dt * escala)
    const eventos = drainEvents(battle)
    if (eventos.length > 0) onEventos(eventos, reloj)

    const h = heroe.current
    const s = estado.current
    if (!h) return
    const vivo = h.state !== 'muerto'
    const quedan = battle.units.some((u) => u.side === 1 && u.state !== 'muerto')
    if (s.fin > 0) {
      s.fin -= dt
      if (s.fin <= 0) setRonda((r) => r + 1)
    } else if (!vivo) {
      s.fin = 2.4
      cartel(card.estilo?.includes('kamikaze') ? '¡BOOOM!' : `Cae en la oleada ${s.oleada}`, card.estilo?.includes('kamikaze') ? '#fb923c' : '#fca5a5')
    } else if (quedan && s.enOleada > OLEADA_MAX_S) {
      // Se atasca: los que quedan salen huyendo.
      battle.units = battle.units.filter((u) => u.side !== 1 || u.state === 'muerto')
      cartel('¡Huyen!', '#fde68a')
    } else if (!quedan) {
      if (s.oleada >= OLEADAS.length && s.entre <= 0) {
        s.fin = 2.8
        cartel(torre ? '¡INEXPUGNABLE!' : '¡IMPARABLE!', '#fde047')
        sfx.invocar('divina')
      } else {
        s.entre -= dt
        if (s.entre <= 0 && s.oleada < OLEADAS.length) {
          sacarOleada(s.oleada)
          s.oleada += 1
          s.entre = 1.1
        }
      }
    }
    if (s.oleada > 0 && quedan) s.enOleada += dt
    // Los de apoyo (curar, proteger…) no atacan: si en 6 s no ha quitado nada, le llegan dos
    // compañeros para que se vea lo que hace con ellos.
    if (!torre && vivo && quedan && !s.reforzado && s.quitadoOleada === 0 && s.enOleada > 6) {
      s.reforzado = true
      spawnUnit(battle, 0, escolta[0]!, { x: -2.2, z: h.z + 1 }, 'bien')
      spawnUnit(battle, 0, escolta[1] ?? escolta[0]!, { x: 2.2, z: h.z + 1 }, 'bien')
      cartel('¡Refuerzos!', '#86efac')
    }
    // La torre se vuelve soldado a los 25 s: en la exhibición aguanta mientras haya oleadas.
    if (torre && vivo && h.torre) h.torreHasta = battle.time + 30
  }

  // El marcador, unas pocas veces por segundo (no hace falta más).
  useEffect(() => {
    const id = window.setInterval(() => {
      const h = heroe.current
      const s = estado.current
      setMarcador({ oleada: Math.max(1, s.oleada), bajas: s.bajas, quitados: Math.round(s.quitados * 10) / 10, escudos: h ? Math.max(0, h.shields) : 0, maxEscudos: h?.maxShields ?? 0 })
    }, 150)
    return () => window.clearInterval(id)
  }, [])

  const scenario = SCENARIOS[0]!
  return (
    <div className={`no-select relative overflow-hidden rounded-2xl border-2 bg-[#120a05] ${className}`} style={{ borderColor: `${color}aa` }}>
      <Canvas frameloop={FRAMELOOP} dpr={[1, 1.6]} camera={{ fov: 42, position: [0, 4, SALIDA_Z + 6] }}>
        <color attach="background" args={[scenario.sky]} />
        <fog attach="fog" args={[scenario.sky, 22, 70]} />
        <hemisphereLight args={[scenario.hemiSky, scenario.hemiGround, 0.95]} />
        <directionalLight position={[6, 14, 12]} intensity={scenario.sunIntensity * 1.1} color={scenario.sun} />
        {/* Luz de contra, del color de su rareza: lo recorta del fondo */}
        <directionalLight position={[-4, 5, -10]} intensity={1.6} color={color} />
        <Latido latido={latido} />
        <CamaraDeCine heroe={heroe} zoom={zoom} torre={torre} />
        <Shake shake={shake}>
          <Field battle={battle} scenario={scenario} deploying={false} aiming={false} />
          <Scenery scenario={scenario} />
          <Aura heroe={heroe} color={color} grande={rarityOf(card) === 'divina' || rarityOf(card) === 'epica'} />
          <Units key={ronda} battle={battle} paceRef={paceRef} />
          <TroopShots battle={battle} />
          <WeaponBullets battle={battle} />
          <FxLayer items={fx} />
          <PopupLayer items={popups} />
        </Shake>
      </Canvas>

      {/* Viñeta de cine y franjas */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_70px_rgba(0,0,0,0.8)]" />

      {/* Arriba: quién es, la oleada y lo que lleva */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-2">
        <div className="min-w-0">
          <p className="truncate font-west text-[18px] leading-none" style={{ color, textShadow: `0 2px 0 #000, 0 0 12px ${color}88` }}>
            {card.name}
          </p>
          <p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100/70">
            {rareza.label} · oleada {marcador.oleada}/{OLEADAS.length}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <span className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-center">
            <span className="block font-west text-[18px] leading-none text-amber-100">☠ {marcador.bajas}</span>
            <span className="block text-[9px] font-black uppercase tracking-wider text-amber-100/60">bajas</span>
          </span>
          <span className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-center">
            <span className="block font-west text-[18px] leading-none text-amber-100">💥 {marcador.quitados}</span>
            <span className="block text-[9px] font-black uppercase tracking-wider text-amber-100/60">escudos quitados</span>
          </span>
        </div>
      </div>

      {/* El letrero grande */}
      {letrero && (
        <div key={letrero.n} className="pointer-events-none absolute inset-x-0 top-[34%] flex justify-center px-3 text-center">
          <span
            className="assault-pop font-west text-[34px] uppercase leading-none"
            style={{ color: letrero.color, textShadow: '0 3px 0 #1a0d04, 0 0 18px rgba(0,0,0,0.9)' }}
          >
            {letrero.texto}
          </span>
        </div>
      )}

      {/* Abajo: su vida y reiniciar */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/70">
            {torre ? '🏰 Escudos de la torre' : '🛡 Escudos'} · {Math.ceil(marcador.escudos)}/{marcador.maxEscudos}
          </p>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full border border-white/20 bg-black/60">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${marcador.maxEscudos > 0 ? (marcador.escudos / marcador.maxEscudos) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${color}, #fff6d5)`,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRonda((r) => r + 1)}
          className="shrink-0 rounded-lg border border-amber-300/50 bg-black/60 px-2.5 py-1 text-[13px] font-bold text-amber-100 active:scale-95"
        >
          ↺ Otra vez
        </button>
      </div>
    </div>
  )
}

/** Llama al latido de la exhibición en cada fotograma. */
function Latido({ latido }: { latido: (dt: number, reloj: number) => void }) {
  useFrame((state, raw) => latido(Math.min(0.05, raw), state.clock.elapsedTime))
  return null
}

/**
 * La cámara de cine: entra con un primer plano del héroe y se echa atrás hasta verlo de espaldas
 * con los rivales delante. Se mece un poco, y en cada baja da un golpe de zoom.
 */
function CamaraDeCine({ heroe, zoom, torre }: { heroe: MutableRefObject<Unit | null>; zoom: MutableRefObject<number>; torre: boolean }) {
  const { camera } = useThree()
  const t = useRef(0)
  const mira = useRef(new Vector3(0, 1.5, SALIDA_Z))
  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    t.current += dt
    const h = heroe.current
    const hx = h ? h.x : 0
    const hz = h ? h.z : SALIDA_Z
    // La entrada: de cerca (de frente) a su sitio (detrás), en 1,6 s.
    const k = Math.min(1, t.current / 1.6)
    const e = k * k * (3 - 2 * k)
    const lejos = torre ? 11 : 8.5
    const alto = torre ? 7.5 : 5.2
    const vaiven = Math.sin(t.current * 0.35) * 1.6
    const cerca = new Vector3(hx + 2.2, 3.4, hz - 8.5)
    const sitio = new Vector3(hx * 0.6 + vaiven, alto, hz + lejos)
    camera.position.lerpVectors(cerca, sitio, e)
    const objetivo = new Vector3(hx * 0.7, 1.6, hz - (torre ? 4.5 : 3.5) * e)
    mira.current.lerp(objetivo, Math.min(1, dt * 6))
    camera.lookAt(mira.current)
    const cam = camera as PerspectiveCamera
    cam.fov = 42 - zoom.current * 9
    cam.updateProjectionMatrix()
  })
  return null
}

/** El aura a los pies del héroe: un disco de su color que late y un anillo que se abre. */
function Aura({ heroe, color, grande }: { heroe: MutableRefObject<Unit | null>; color: string; grande: boolean }) {
  const g = useRef<Group>(null)
  const anillo = useRef<Mesh>(null)
  useFrame((state) => {
    const h = heroe.current
    if (!g.current) return
    g.current.visible = Boolean(h && h.state !== 'muerto')
    if (!h) return
    g.current.position.set(h.x, 0.03, h.z)
    const t = state.clock.elapsedTime
    g.current.scale.setScalar(1 + Math.sin(t * 3) * 0.06)
    if (anillo.current) {
      const f = (t * 0.8) % 1
      anillo.current.scale.setScalar(0.8 + f * (grande ? 2.2 : 1.6))
      ;(anillo.current.material as MeshBasicMaterial).opacity = (1 - f) * 0.7
    }
  })
  return (
    <group ref={g}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[grande ? 2.2 : 1.7, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={anillo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.3, 1.45, 48]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
