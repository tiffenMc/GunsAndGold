import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { Group, OrthographicCamera } from 'three'
import { BUILTIN_BATTLE } from '../cards/catalog'
import type { BattleCard, CardDef, ShotMode, WeaponCard } from '../cards/model'
import { SCENARIOS } from '../scenes/scenarios'
import { FRAMELOOP, capturePointer } from '../debugClock'
import { AimGuide } from './AimGuide'
import { FX_MAX_LIFE, FxLayer, TroopShots, WeaponBullets } from './Effects'
import type { Fx } from './Effects'
import { Field } from './Field'
import { FieldUnit } from './FieldUnit'
import { SmokeClouds, TunnelPortals, ZapField } from './Specials'
import { WEAPON_Y, WeaponRig, muzzleProfile } from './WeaponRig'
import {
  DEPLOY_BACK,
  FIRE_LINE,
  FORT_Z,
  clampDeploy,
  clampFireLine,
  createBattle,
  drainEvents,
  paceAt,
  spawnUnit,
  hacerTorre,
  step,
  testFire,
  useSpecial,
} from './engine'
import type { Battle, Pace, Vec } from './engine'
import { disparo, precargarBatalla, precargarDisparos, sfx } from './sfx'

/**
 * **Campo de pruebas** de la ficha de una carta: un trozo del campo de verdad, con zoom, donde se
 * ve lo que hace la carta.
 *  - Arma: la disparas tu con el mismo gesto que en partida (desliza y suelta), sin gastar usos,
 *    contra muñecos que vuelven a salir. Se ve el pasillo del alcance, el fogonazo, el golpe…
 *  - Arma especial (humo, rayo, tunel): toca el campo y se suelta ahi.
 *  - Vaquero: sale a pelear contra un rival y se repite en bucle.
 */

const ELEVATION = (40 * Math.PI) / 180

/** El trozo de campo que se encuadra: de `near` (abajo, tu lado) a `far` (arriba). */
interface View {
  near: number
  far: number
  width: number
}

function viewOf(card: CardDef): View {
  if (card.kind === 'arma') {
    if (card.special === 'tunel') return { near: DEPLOY_BACK + 2, far: -DEPLOY_BACK - 2, width: 15 }
    // Humo y rayo: se ve la mitad del rival entera, que es donde tienen sentido.
    if (card.special) return { near: 6, far: -(FORT_Z + 2.5), width: 14 }
    // Se encuadra desde detras del arma (que se vea entera) hasta un poco mas alla del alcance.
    return { near: FIRE_LINE + 4.2, far: FIRE_LINE - card.shot.range - 2, width: 9.5 }
  }
  return { near: VAQUERO_Z + 2.5, far: VAQUERO_Z - card.range - 6, width: 9 }
}

/** Donde sale tu vaquero en la prueba. */
const VAQUERO_Z = 12

function CameraRig({ view, cameraRef }: { view: View; cameraRef: MutableRefObject<OrthographicCamera | null> }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera
  const size = useThree((state) => state.size)
  useLayoutEffect(() => {
    cameraRef.current = camera
    const len = Math.abs(view.near - view.far)
    const needH = len * Math.sin(ELEVATION) + 2.4
    const zoom = Math.min(size.width / view.width, size.height / needH)
    const back = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION))
    const target = new Vector3(0, 0.6, (view.near + view.far) / 2)
    camera.position.copy(target).addScaledVector(back, 60)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    camera.zoom = zoom
    camera.near = 0.1
    camera.far = 200
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, view, cameraRef])
  return null
}

/** Sacude el mundo un momento con cada golpe. */
export function Shake({ shake, children }: { shake: MutableRefObject<number>; children: ReactNode }) {
  const group = useRef<Group>(null)
  useFrame((_, dt) => {
    shake.current = Math.max(0, shake.current - dt * 2.4)
    const g = group.current
    if (!g) return
    const k = shake.current * shake.current
    g.position.x = (Math.random() - 0.5) * k * 0.6
    g.position.z = (Math.random() - 0.5) * k * 0.6
  })
  return <group ref={group}>{children}</group>
}

export function Units({ battle, paceRef }: { battle: Battle; paceRef: MutableRefObject<Pace> }) {
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

export interface Popup {
  id: number
  x: number
  z: number
  text: string
  color: string
  born: number
}

/** Los muñecos de practica para un arma: dentro de su alcance, a distintas distancias. */
function dummySpots(weapon: WeaponCard): Vec[] {
  const r = weapon.shot.range
  // Las cargas explosivas se prueban contra un grupito (uno pegado a la boca y otros mas lejos).
  if (weapon.shot.mode === 'explosivo') {
    return [
      { x: -1.2, z: FIRE_LINE - Math.max(3.5, r * 0.28) },
      { x: 1.2, z: FIRE_LINE - Math.max(3.5, r * 0.28) - 0.8 },
      { x: 0, z: FIRE_LINE - r * 0.6 },
      { x: 2.4, z: FIRE_LINE - r * 0.8 },
    ]
  }
  return [
    { x: 0, z: FIRE_LINE - r * 0.45 },
    { x: -2.2, z: FIRE_LINE - r * 0.7 },
    { x: 2.2, z: FIRE_LINE - r * 0.7 },
    { x: 0, z: FIRE_LINE - r * 0.92 },
  ]
}

function makeTestBattle(card: CardDef, torre = false): Battle {
  const enemigo = BUILTIN_BATTLE[0]!
  const battle = createBattle({ decks: [[card], [enemigo]], practice: true })
  battle.cards.set(card.id, card)
  for (const bando of battle.cartas) bando.set(card.id, card)
  if (card.kind === 'arma') {
    // El arma en la mano y sin gastarse nunca.
    battle.hands[0].weapon.cardId = card.id
    battle.hands[0].weapon.uses = 9999
    if (!card.special) {
      dummySpots(card).forEach((at) => spawnUnit(battle, 1, enemigo, at, 'bien', true))
    } else {
      stageSpecial(battle)
    }
  } else if (torre) {
    stageTorre(battle, card)
  } else {
    stageDuel(battle, card)
  }
  return battle
}

/** Humo, rayo y tunel: tus tropas avanzan hacia el fuerte rival, y dos de ellos le salen al paso. */
function stageSpecial(battle: Battle) {
  const soldado = BUILTIN_BATTLE[0]!
  const mine = battle.units.filter((u) => u.side === 0 && u.state !== 'muerto').length
  const theirs = battle.units.filter((u) => u.side === 1 && u.state !== 'muerto').length
  for (let i = mine; i < 3; i++) spawnUnit(battle, 0, soldado, { x: (i - 1) * 2.2, z: 4 + i * 0.6 }, 'bien')
  for (let i = theirs; i < 2; i++) spawnUnit(battle, 1, soldado, { x: (i - 0.5) * 3.4, z: -12 - i }, 'bien')
}

/** El duelo del vaquero: el tuyo contra dos rivales que le salen al paso. */
function stageDuel(battle: Battle, card: BattleCard) {
  const enemigo = BUILTIN_BATTLE[0]!
  battle.units.length = 0
  battle.bullets.length = 0
  battle.shots.length = 0
  spawnUnit(battle, 0, card, { x: 0, z: VAQUERO_Z }, 'excelente')
  const dz = VAQUERO_Z - card.range - 4
  spawnUnit(battle, 1, enemigo, { x: -1.4, z: dz }, 'bien')
  spawnUnit(battle, 1, enemigo, { x: 1.4, z: dz - 1.2 }, 'bien')
}

/** La torre: tu carta plantada y tres rivales que vienen andando hacia ella. */
function stageTorre(battle: Battle, card: BattleCard) {
  const enemigo = BUILTIN_BATTLE[0]!
  battle.units.length = 0
  battle.bullets.length = 0
  battle.shots.length = 0
  const torre = spawnUnit(battle, 0, card, { x: 0, z: VAQUERO_Z }, 'excelente')
  hacerTorre(battle, torre)
  const dz = VAQUERO_Z - 14
  spawnUnit(battle, 1, enemigo, { x: -1.8, z: dz }, 'bien')
  spawnUnit(battle, 1, enemigo, { x: 0.4, z: dz - 1.5 }, 'bien')
  spawnUnit(battle, 1, enemigo, { x: 2, z: dz - 3 }, 'bien')
}

/** Avanza la prueba: repone muñecos, repite el duelo y reparte los avisos. */
function Driver({
  battle,
  card,
  torre,
  onEvents,
}: {
  battle: Battle
  card: CardDef
  torre: boolean
  onEvents: (events: ReturnType<typeof drainEvents>, clock: number) => void
}) {
  const deadSince = useRef(new Map<number, number>())
  const duelOver = useRef<number | null>(null)
  const lastStage = useRef(0)
  useFrame((state, dt) => {
    step(battle, dt)
    const now = state.clock.elapsedTime
    if (card.kind === 'arma' && !card.special) {
      // Cada muñeco vuelve a salir al rato de caer.
      const spots = dummySpots(card)
      spots.forEach((spot, i) => {
        const standing = battle.units.some(
          (u) => u.state !== 'muerto' && Math.hypot(u.spawn.x - spot.x, u.spawn.z - spot.z) < 0.01,
        )
        if (standing) {
          deadSince.current.delete(i)
          return
        }
        const since = deadSince.current.get(i)
        if (since === undefined) deadSince.current.set(i, now)
        else if (now - since > 1.6) {
          battle.units = battle.units.filter(
            (u) => !(u.state === 'muerto' && Math.hypot(u.spawn.x - spot.x, u.spawn.z - spot.z) < 0.01),
          )
          spawnUnit(battle, 1, BUILTIN_BATTLE[0]!, spot, 'bien', true)
          deadSince.current.delete(i)
        }
      })
    } else if (card.kind === 'batalla') {
      // Cuando se acaba el duelo (o se alarga mucho), se vuelve a montar.
      const mine = battle.units.some((u) => u.side === 0 && u.state !== 'muerto')
      const theirs = battle.units.some((u) => u.side === 1 && u.state !== 'muerto')
      const tooLong = torre
        ? battle.units.some((u) => u.side === 1 && u.state !== 'muerto' && u.z > VAQUERO_Z + 5)
        : battle.units.some((u) => u.side === 0 && u.z < VAQUERO_Z - card.range - 12)
      if ((!mine || !theirs || tooLong) && duelOver.current === null) duelOver.current = now
      if (duelOver.current !== null && now - duelOver.current > 2) {
        duelOver.current = null
        if (torre) stageTorre(battle, card)
        else stageDuel(battle, card)
      }
    } else if (card.special) {
      // Se repone el escenario cuando alguien cae: siempre hay tropas con las que probar.
      if (now - lastStage.current > 3) {
        lastStage.current = now
        battle.units = battle.units.filter((u) => u.state !== 'muerto' || battle.time - u.diedAt < 2)
        stageSpecial(battle)
      }
    }
    const events = drainEvents(battle)
    if (events.length > 0) onEvents(events, now)
  })
  return null
}

export function PopupLayer({ items }: { items: Popup[] }) {
  return (
    <>
      {items.map((popup) => (
        <Html key={popup.id} position={[popup.x, 2.6, popup.z]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div
            className="float-up whitespace-nowrap font-west text-[28px]"
            style={{ color: popup.color, textShadow: '0 2px 0 #1a0d04, 0 0 10px rgba(0,0,0,0.8)' }}
          >
            {popup.text}
          </div>
        </Html>
      ))}
    </>
  )
}

export function Galeria({ card, className = '', torre = false }: { card: CardDef; className?: string; torre?: boolean }) {
  const [battle, setBattle] = useState(() => makeTestBattle(card, torre))
  const view = useMemo(() => (torre && card.kind === 'batalla' ? { near: VAQUERO_Z + 4, far: VAQUERO_Z - 15, width: 11 } : viewOf(card)), [card, torre])
  const scenario = SCENARIOS[0]!
  const box = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<OrthographicCamera | null>(null)
  const paceRef = useRef<Pace>(paceAt(0))
  const nextId = useRef(1)
  const [fx, setFx] = useState<Fx[]>([])
  const [popups, setPopups] = useState<Popup[]>([])
  const [stats, setStats] = useState({ tiros: 0, impactos: 0, bajas: 0 })
  const [aiming, setAiming] = useState(false)
  /** Lo mismo, pero al momento (el estado llega tarde si se suelta enseguida). */
  const aimingNow = useRef(false)
  /** Cambia al reiniciar: los muñecos se vuelven a montar desde cero. */
  const [round, setRound] = useState(0)
  /** Humo, rayo y tunel salen de la lista del motor: hay que repintar cuando cambia. */
  const [, repintar] = useState(0)
  const shake = useRef(0)
  const aimX = useRef<number | null>(null)
  /** Donde apuntas (las cargas explosivas caen ahi). */
  const aimTarget = useRef({ visible: false, x: 0, z: 0 })
  const lastSpot = useRef<Vec | null>(null)
  const recoil = useRef(0)
  const burst = useRef(0)
  const muzzle = useRef<{ x: number; z: number } | null>(null)
  const weapon = card.kind === 'arma' ? card : null

  useEffect(() => {
    void precargarDisparos()
    void precargarBatalla()
  }, [])

  // Se borran solos los numeros que ya han subido.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now() / 1000
      setPopups((list) => (list.some((p) => now - p.born > 1.1) ? list.filter((p) => now - p.born <= 1.1) : list))
      if (card.kind === 'arma' && card.special) repintar((n) => n + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [card])

  const onEvents = (events: ReturnType<typeof drainEvents>, clock: number) => {
    const newFx: Fx[] = []
    const newPopups: Popup[] = []
    const now = performance.now() / 1000
    let tiros = 0
    let impactos = 0
    let bajas = 0
    for (const event of events) {
      switch (event.type) {
        case 'weaponFired': {
          tiros += 1
          const mode: ShotMode = weapon?.shot.mode ?? 'bala'
          const profile = muzzleProfile(mode)
          const mouth = muzzle.current ?? { x: event.x, z: event.z }
          const volley = mode === 'rafaga' ? Math.max(1, Math.min(6, weapon?.shot.pellets ?? 3)) : 1
          for (let i = 0; i < volley && profile.flash > 0; i++) {
            newFx.push({ id: nextId.current++, kind: 'muzzle', x: mouth.x, z: mouth.z, y: WEAPON_Y, r: profile.flash * 1.2, color: card.accent, born: clock + i * 0.1 })
          }
          for (let i = 0; i < profile.smoke; i++) {
            newFx.push({ id: nextId.current++, kind: 'smoke', x: mouth.x, z: mouth.z, y: WEAPON_Y, r: 1, color: '#d9d2c2', born: clock })
          }
          for (let i = 0; i < profile.shells; i++) {
            newFx.push({ id: nextId.current++, kind: 'shell', x: mouth.x, z: mouth.z, y: WEAPON_Y, r: 1, color: '#c9a227', born: clock + i * 0.07, side: i % 2 === 0 ? 1 : -1 })
          }
          shake.current = Math.max(shake.current, profile.shake * 1.2)
          recoil.current = Math.min(1.5, recoil.current + profile.kick)
          burst.current = Math.max(burst.current, (volley - 1) * 0.1 + (mode === 'rafaga' ? 0.3 : 0))
          disparo(event.weaponId, true)
          break
        }
        case 'troopShot':
          sfx.hit()
          break
        case 'unitHit':
          if (event.side === 1) impactos += 1
          newFx.push({ id: nextId.current++, kind: event.weapon ? 'hit' : 'spark', x: event.x, z: event.z, r: 1, color: '#ffd166', born: clock })
          newPopups.push({ id: nextId.current++, x: event.x, z: event.z, text: event.weapon ? `−${event.amount}` : '−🛡', color: event.weapon ? '#fde68a' : '#bae6fd', born: now })
          shake.current = Math.max(shake.current, event.weapon ? 0.4 : 0.15)
          if (event.weapon) sfx.hit()
          break
        case 'unitDeath':
          if (event.side === 1) bajas += 1
          newFx.push({ id: nextId.current++, kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born: clock })
          if (event.side === 1) newPopups.push({ id: nextId.current++, x: event.x, z: event.z, text: '💥', color: '#fde68a', born: now })
          shake.current = Math.max(shake.current, 0.45)
          sfx.kill()
          break
        case 'golpeTorre':
          // La torre defiende: onda en el blanco (blanca la del guardian, que ademas frena).
          newFx.push({ id: nextId.current++, kind: 'warp', x: event.x, z: event.z, r: event.guardian ? 1.6 : 1.1, color: event.guardian ? '#ffffff' : '#fde68a', born: clock })
          newFx.push({ id: nextId.current++, kind: 'hit', x: event.x, z: event.z, r: 1, color: event.guardian ? '#e2e8f0' : '#ffd166', born: clock })
          shake.current = Math.max(shake.current, event.guardian ? 0.3 : 0.15)
          break
        case 'blast':
          newFx.push({ id: nextId.current++, kind: 'blast', x: event.x, z: event.z, r: event.r, color: '', born: clock })
          shake.current = Math.max(shake.current, 0.9)
          sfx.blast()
          break
        case 'bulletEnd':
          newFx.push({ id: nextId.current++, kind: 'puff', x: event.x, z: event.z, r: 1, color: '', born: clock })
          break
        case 'spawn':
          newFx.push({ id: nextId.current++, kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born: clock })
          break
        case 'smoke':
          sfx.carta('humo')
          break
        case 'zap':
          for (const unit of battle.units) {
            if (unit.side !== event.side || unit.state === 'muerto') continue
            newFx.push({ id: nextId.current++, kind: 'spark', x: unit.x, z: unit.z, r: 1.4, color: '#fde047', born: clock })
          }
          shake.current = Math.max(shake.current, 0.8)
          sfx.carta('rayo')
          sfx.blast()
          break
        case 'tunnel':
          sfx.carta('tunel')
          for (const at of [event.entry, event.exit]) {
            newFx.push({ id: nextId.current++, kind: 'warp', x: at.x, z: at.z, r: 1, color: '#f472b6', born: clock })
          }
          break
        default:
          break
      }
    }
    if (newFx.length > 0) setFx((list) => [...list.filter((item) => clock - item.born < FX_MAX_LIFE), ...newFx].slice(-50))
    if (newPopups.length > 0) setPopups((list) => [...list, ...newPopups].slice(-12))
    if (tiros || impactos || bajas) {
      setStats((s) => ({ tiros: s.tiros + tiros, impactos: s.impactos + impactos, bajas: s.bajas + bajas }))
    }
  }

  // --- Puntero: el mismo gesto que en la partida ---

  const groundAt = (clientX: number, clientY: number): Vec | null => {
    const el = box.current
    const camera = cameraRef.current
    if (!el || !camera) return null
    const rect = el.getBoundingClientRect()
    const ndc = new Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new Raycaster()
    ray.setFromCamera(ndc, camera)
    const hit = new Vector3()
    return ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), hit) ? { x: hit.x, z: hit.z } : null
  }

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!weapon) return
    const spot = groundAt(event.clientX, event.clientY)
    if (!spot) return
    if (weapon.special) {
      // Las especiales: toca y se sueltan ahi (el arma no se gasta nunca).
      battle.hands[0].weapon.cardId = weapon.id
      battle.hands[0].weapon.uses = 9999
      const target = weapon.special === 'tunel' ? clampDeploy(0, spot.x, Math.max(spot.z, 4)) : spot
      lastSpot.current = spot
      useSpecial(battle, 0, target)
      return
    }
    capturePointer(event.currentTarget, event.pointerId)
    aimX.current = clampFireLine(0, spot.x).x
    lastSpot.current = spot
    aimTarget.current = { visible: true, x: spot.x, z: spot.z }
    aimingNow.current = true
    setAiming(true)
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!aimingNow.current) return
    const spot = groundAt(event.clientX, event.clientY)
    if (spot) {
      aimX.current = clampFireLine(0, spot.x).x
      lastSpot.current = spot
      aimTarget.current = { visible: true, x: spot.x, z: spot.z }
    }
  }
  const up = () => {
    if (!aimingNow.current || !weapon) return
    aimingNow.current = false
    setAiming(false)
    const at = aimX.current ?? 0
    aimTarget.current.visible = false
    // Las cargas explosivas caen donde sueltas; el resto sale recto desde donde pongas el arma.
    const spot = lastSpot.current
    if (weapon.shot.mode === 'explosivo' && spot) testFire(battle, 0, weapon, at, 0, spot)
    else testFire(battle, 0, weapon, at, 0)
    // El arma se queda donde ha disparado un momento y luego vuelve al centro.
    window.setTimeout(() => {
      if (!box.current) return
      aimX.current = null
    }, 600)
  }

  const reset = () => {
    setBattle(makeTestBattle(card, torre))
    setRound((value) => value + 1)
    setFx([])
    setPopups([])
    setStats({ tiros: 0, impactos: 0, bajas: 0 })
  }

  const hint = weapon
    ? weapon.special === 'tunel'
      ? 'Toca tu mitad del campo: se abren las dos bocas'
      : weapon.special === 'humo'
        ? 'Toca el campo rival: ahí cae la nube. Tus tropas dentro no se ven'
        : weapon.special === 'rayo'
          ? 'Toca el campo: cae la tormenta sobre el rival'
          : weapon.shot.mode === 'explosivo'
            ? 'Toca y suelta donde quieras que caiga: explota tras la mecha'
            : 'Toca, desliza para mover el arma y suelta para disparar'
    : torre
      ? 'Mira cómo defiende: los rivales vienen a por ella (dentro del círculo, les pega)'
      : 'Mira cómo pelea: el duelo se repite solo'

  return (
    <div
      ref={box}
      className={`no-select relative touch-none overflow-hidden rounded-2xl border-2 border-amber-700/60 bg-[#1a0f08] ${className}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <Canvas frameloop={FRAMELOOP} orthographic dpr={[1, 1.5]} camera={{ position: [0, 20, 30], zoom: 30 }}>
        <color attach="background" args={[scenario.sky]} />
        <fog attach="fog" args={[scenario.sky, scenario.fog[0], scenario.fog[1]]} />
        <CameraRig view={view} cameraRef={cameraRef} />
        <hemisphereLight args={[scenario.hemiSky, scenario.hemiGround, 0.9]} />
        <ambientLight intensity={0.4} color="#ffe9c8" />
        <directionalLight position={[8, 16, 10]} intensity={scenario.sunIntensity} color={scenario.sun} />
        <directionalLight position={[-10, 6, -8]} intensity={0.8} color="#ff9d5c" />
        <Driver battle={battle} card={card} torre={torre} onEvents={onEvents} />
        <Shake shake={shake}>
          <Field battle={battle} scenario={scenario} deploying={false} aiming={aiming} />
          <Units key={round} battle={battle} paceRef={paceRef} />
          {weapon && !weapon.special && (
            <>
              <WeaponRig
                model={weapon.model}
                uses={3}
                maxUses={3}
                accent={weapon.accent}
                aimX={aimX}
                recoil={recoil}
                burst={burst}
                muzzle={muzzle}
              />
              <AimGuide battle={battle} active={aiming} muzzle={muzzle} range={weapon.shot.range} shot={weapon.shot} accent={weapon.accent} target={aimTarget} />
            </>
          )}
          <TroopShots battle={battle} />
          <WeaponBullets battle={battle} />
          <SmokeClouds battle={battle} />
          <ZapField battle={battle} />
          <TunnelPortals battle={battle} />
          <FxLayer items={fx} />
          <PopupLayer items={popups} />
        </Shake>
      </Canvas>

      {/* Viñeta de cine: el centro manda */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.75)]" />

      {/* Cartel de arriba */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent px-3 pb-4 pt-2">
        <span className="font-west text-[15px] leading-none text-amber-100" style={{ textShadow: '0 2px 0 #1a0d04' }}>
          🎯 Campo de pruebas
        </span>
        {weapon && !weapon.special && (
          <span className="flex gap-2 font-mono text-[13px] text-amber-100/90">
            <span>🔫 {stats.tiros}</span>
            <span>💥 {stats.impactos}</span>
            <span>☠ {stats.bajas}</span>
          </span>
        )}
      </div>

      {/* Lo que hay que hacer y el reinicio */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-5">
        <span className="pointer-events-none text-[13px] font-bold uppercase leading-tight tracking-wider text-amber-100/90">
          {hint}
        </span>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={reset}
          className="shrink-0 rounded-lg border border-amber-300/50 bg-black/60 px-2.5 py-1 text-[13px] font-bold text-amber-100 active:scale-95"
        >
          ↺ Reiniciar
        </button>
      </div>
    </div>
  )
}
