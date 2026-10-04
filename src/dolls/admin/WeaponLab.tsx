import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Vector3 } from 'three'
import type { OrthographicCamera } from 'three'
import { FxLayer, WeaponBullets } from '../battle/Effects'
import type { Fx } from '../battle/Effects'
import { SIDE_COLOR } from '../battle/Field'
import { FieldUnit } from '../battle/FieldUnit'
import { SmokeClouds, TunnelPortals, ZapField } from '../battle/Specials'
import {
  FIELD_L,
  FIELD_W,
  FIRE_LINE,
  FORT_Z,
  createBattle,
  drainEvents,
  paceAt,
  spawnUnit,
  step,
  testFire,
  useSpecial,
} from '../battle/engine'
import type { Battle, Pace, Side } from '../battle/engine'
import { BUILTIN_BATTLE, BUILTIN_CARDS, BUILTIN_WEAPONS } from '../cards/catalog'
import { shotSummary, specialOf } from '../cards/model'
import type { BattleCard } from '../cards/model'
import { FRAMELOOP } from '../debugClock'
import { SafeCanvas } from '../SafeCanvas'

/**
 * El laboratorio de armas del ADMIN: se lanza cualquier arma y se ve el campo desde los dos
 * lados a la vez, el tuyo y el del rival. Es la forma de comprobar lo que hace cada especial
 * (sobre todo el humo, que no se ve igual desde cada bando) sin jugarse una partida entera.
 */

const ELEVATION = (35 * Math.PI) / 180

/** Tu formacion: plantada donde cae el humo, para ver como se tapa. */
const MINE = { z: 8, xs: [-4.5, -1.5, 1.5, 4.5] }
/** La suya, enfrente y apretada: asi la dinamita y los perdigones les dan a varios. */
const FOE = { z: -8, xs: [-2.4, -1.2, 0, 1.2, 2.4] }
/** Un andarin por bando (cartas distintas: se ignoran al cruzarse) para ver el tunel. */
const WALKERS: { side: Side; x: number; z: number; card: number }[] = [
  { side: 0, x: 0, z: 12, card: 11 },
  { side: 1, x: 0, z: -12, card: 12 },
]
/** Alcance de laboratorio: el justo para que cualquier arma llegue a los muñecos de enfrente. */
const LAB_RANGE = FIRE_LINE - FOE.z + 0.5

interface Post {
  side: Side
  x: number
  z: number
  card: BattleCard
  frozen: boolean
}

function makeLabBattle(): { battle: Battle; posts: Post[] } {
  const battle = createBattle({ decks: [BUILTIN_CARDS, BUILTIN_CARDS], practice: true, seed: 9 })
  const posts: Post[] = []
  MINE.xs.forEach((x, i) => posts.push({ side: 0, x, z: MINE.z, card: BUILTIN_BATTLE[i]!, frozen: true }))
  FOE.xs.forEach((x, i) => posts.push({ side: 1, x, z: FOE.z, card: BUILTIN_BATTLE[i + 6]!, frozen: true }))
  for (const walker of WALKERS) {
    posts.push({ side: walker.side, x: walker.x, z: walker.z, card: BUILTIN_BATTLE[walker.card]!, frozen: false })
  }
  for (const post of posts) spawnUnit(battle, post.side, post.card, { x: post.x, z: post.z }, 'excelente', post.frozen)
  return { battle, posts }
}

/** Avanza la simulacion y reparte los avisos: el unico bucle de los dos lienzos. */
function LabLoop({
  battle,
  posts,
  onFx,
  onUnits,
  onPulse,
}: {
  battle: Battle
  posts: Post[]
  onFx: (fx: Fx[]) => void
  onUnits: (ids: number[]) => void
  /** Sin esto la escena no se entera de lo que cambia (humo, tuneles, rayos). */
  onPulse: () => void
}) {
  const key = useRef('')
  const nextId = useRef(1)
  const down = useRef(new Map<number, number>())
  const acc = useRef(0)
  useFrame((state, dt) => {
    step(battle, dt)
    const now = state.clock.elapsedTime
    acc.current += dt
    if (acc.current > 0.1) {
      acc.current = 0
      onPulse()
    }
    // Los muñecos de prueba vuelven a su sitio: el laboratorio siempre esta lleno.
    posts.forEach((post, index) => {
      const alive = battle.units.some(
        (unit) =>
          unit.state !== 'muerto' &&
          unit.side === post.side &&
          Math.hypot(unit.spawn.x - post.x, unit.spawn.z - post.z) < 0.01,
      )
      if (alive) {
        down.current.delete(index)
        return
      }
      const since = down.current.get(index)
      if (since === undefined) down.current.set(index, now)
      else if (now - since > 1.8) {
        spawnUnit(battle, post.side, post.card, { x: post.x, z: post.z }, 'excelente', post.frozen)
        down.current.delete(index)
      }
    })
    const fx: Fx[] = []
    for (const event of drainEvents(battle)) {
      const born = state.clock.elapsedTime
      if (event.type === 'blast') fx.push({ id: nextId.current++, kind: 'blast', x: event.x, z: event.z, r: event.r, color: '', born })
      else if (event.type === 'unitHit') fx.push({ id: nextId.current++, kind: 'spark', x: event.x, z: event.z, r: 1, color: event.weapon ? '#ffd166' : '#ffffff', born })
      else if (event.type === 'unitDeath') fx.push({ id: nextId.current++, kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born })
      else if (event.type === 'bulletEnd') fx.push({ id: nextId.current++, kind: 'puff', x: event.x, z: event.z, r: 1, color: '', born })
      else if (event.type === 'teleport') {
        fx.push({ id: nextId.current++, kind: 'warp', x: event.from.x, z: event.from.z, r: 1, color: '#f472b6', born })
        fx.push({ id: nextId.current++, kind: 'warp', x: event.to.x, z: event.to.z, r: 1, color: '#f472b6', born })
      } else if (event.type === 'tunnel') {
        for (const at of [event.entry, event.exit]) {
          fx.push({ id: nextId.current++, kind: 'warp', x: at.x, z: at.z, r: 1, color: '#f472b6', born })
        }
      } else if (event.type === 'zap') {
        for (const unit of battle.units) {
          if (unit.side !== event.side || unit.state === 'muerto') continue
          fx.push({ id: nextId.current++, kind: 'spark', x: unit.x, z: unit.z, r: 1.4, color: '#fde047', born })
        }
      }
    }
    if (fx.length > 0) onFx(fx)
    const ids = battle.units.map((unit) => unit.id).join(',')
    if (ids !== key.current) {
      key.current = ids
      onUnits(battle.units.map((unit) => unit.id))
    }
  })
  return null
}

/** Camara de un bando: cada uno mira el campo desde detras de su fuerte. */
function LabCamera({ side }: { side: Side }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera
  const size = useThree((state) => state.size)
  useLayoutEffect(() => {
    const back = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION) * (side === 0 ? 1 : -1))
    const target = new Vector3(0, 1.4, 0)
    camera.position.copy(target).addScaledVector(back, 60)
    camera.up.set(0, 1, 0)
    camera.lookAt(target)
    const needW = FIELD_W + 7
    const needH = FIELD_L * Math.sin(ELEVATION) + 8
    camera.zoom = Math.min(size.width / needW, size.height / needH)
    camera.near = 0.1
    camera.far = 200
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height, side])
  return null
}

/** Suelo sencillo: la raya del centro, tu linea de fuego y los dos fuertes para orientarse. */
function LabGround() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[FIELD_W + 8, FIELD_L + 6]} />
        <meshLambertMaterial color="#c79257" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FIELD_W, FIELD_L]} />
        <meshLambertMaterial color="#e6b377" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[FIELD_W, 0.2]} />
        <meshBasicMaterial color="#8a6134" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, FIRE_LINE]}>
        <planeGeometry args={[FIELD_W, 0.16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.75} />
      </mesh>
      {([0, 1] as Side[]).map((side) => (
        <group key={side} position={[0, 0, side === 0 ? FORT_Z : -FORT_Z]}>
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[3, 2, 2]} />
            <meshLambertMaterial color="#6b4423" />
          </mesh>
          <mesh position={[0, 2.3, 0]}>
            <boxGeometry args={[3.4, 0.6, 2.4]} />
            <meshLambertMaterial color={SIDE_COLOR[side]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Una de las dos vistas: la tuya o la del rival, sobre la misma batalla. */
function LabView({
  battle,
  ids,
  paceRef,
  fx,
  side,
  driver,
}: {
  battle: Battle
  ids: number[]
  paceRef: MutableRefObject<Pace>
  fx: Fx[]
  side: Side
  /** La simulacion corre una sola vez: solo la vista de la izquierda la lleva. */
  driver?: {
    posts: Post[]
    onFx: (fx: Fx[]) => void
    onUnits: (ids: number[]) => void
    onPulse: () => void
  }
}) {
  return (
    <div className="relative h-[42vh] min-h-[260px] overflow-hidden rounded-2xl border border-amber-900/50">
      <SafeCanvas note="La vista 3D no está disponible en este dispositivo.">
        <Canvas frameloop={FRAMELOOP} orthographic dpr={[1, 1.6]} camera={{ position: [0, 20, 30], zoom: 30 }}>
          <color attach="background" args={['#d9a066']} />
          <LabCamera side={side} />
          <hemisphereLight args={['#ffe3b8', '#6b3f1f', 0.9]} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[8, 16, 10]} intensity={2.2} color="#fff1d4" />
          <LabGround />
          {driver && (
            <LabLoop
              battle={battle}
              posts={driver.posts}
              onFx={driver.onFx}
              onUnits={driver.onUnits}
              onPulse={driver.onPulse}
            />
          )}
          {ids.map((id) => {
            const unit = battle.units.find((item) => item.id === id)
            return unit ? (
              <FieldUnit key={id} unit={unit} battle={battle} paceRef={paceRef} viewer={side} />
            ) : null
          })}
          <WeaponBullets battle={battle} />
          <SmokeClouds battle={battle} />
          <ZapField battle={battle} />
          <TunnelPortals battle={battle} />
          <FxLayer items={fx} />
        </Canvas>
      </SafeCanvas>
      <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-100">
        {side === 0 ? '👁 Lo que ves tú' : '🙈 Lo que ve el rival'}
      </span>
    </div>
  )
}

export function WeaponLab() {
  const [weaponId, setWeaponId] = useState(BUILTIN_WEAPONS[0]!.id)
  const [round, setRound] = useState(0)
  const weapon = BUILTIN_WEAPONS.find((item) => item.id === weaponId) ?? BUILTIN_WEAPONS[0]!
  // Cada arma estrena campo: asi se ve su efecto desde cero.
  const { battle, posts } = useMemo(() => makeLabBattle(), [weapon.id, round])
  const [ids, setIds] = useState<number[]>(() => battle.units.map((unit) => unit.id))
  const [fx, setFx] = useState<Fx[]>([])
  const [, setPulse] = useState(0)
  const paceRef = useRef<Pace>(paceAt(0))

  useEffect(() => {
    setIds(battle.units.map((unit) => unit.id))
    setFx([])
  }, [battle])

  const launch = () => {
    // El arma del laboratorio no se gasta nunca: se puede lanzar tantas veces como quieras.
    const slot = battle.hands[0].weapon
    slot.cardId = weapon.id
    slot.uses = 99
    if (weapon.special === 'humo') useSpecial(battle, 0, { x: 0, z: MINE.z })
    else if (weapon.special === 'rayo') useSpecial(battle, 0, { x: 0, z: 0 })
    else if (weapon.special === 'tunel') {
      // Se suelta en tu mitad y la otra boca sale sola enfrente, a la distancia de siempre.
      useSpecial(battle, 0, { x: 0, z: MINE.z + 1 })
    } else {
      // Las de siempre tiran desde tu raya: se les alarga el alcance para que lleguen a los
      // muñecos de prueba, que estan lejos a proposito.
      testFire(battle, 0, { ...weapon, shot: { ...weapon.shot, range: LAB_RANGE } }, 0, 0)
    }
    slot.uses = 99
  }

  const info = specialOf(weapon)

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 px-3 pt-3 pb-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">Laboratorio de armas</p>
        <p className="mt-1 text-[12px] leading-snug text-amber-100/80">
          Lanza cualquier arma y mira el mismo momento desde los dos lados: lo que ves tú y lo que ve
          el rival. Es la única forma de ver lo que hace el humo, que no se ve igual desde cada bando.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BUILTIN_WEAPONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setWeaponId(item.id)}
            className={`rounded-lg border px-3 py-2 text-[12px] ${
              item.id === weapon.id
                ? 'border-amber-300 bg-amber-300/20 text-amber-50'
                : 'border-amber-900/50 bg-black/30 text-amber-200/80'
            }`}
          >
            {item.special ? '★ ' : ''}
            {item.name}
          </button>
        ))}
      </div>

      <div className="panel-wood flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-west text-lg leading-none text-amber-50">
            {info ? '★ ' : ''}
            {weapon.name}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-amber-100/80">
            {info ? info.note : `${shotSummary(weapon.shot)} · dispara recto desde tu raya`}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={launch} className="btn-gold text-[12px]">
            Lanzar
          </button>
          <button type="button" onClick={() => setRound((value) => value + 1)} className="btn-ghost text-[12px]">
            Reiniciar
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <LabView
          battle={battle}
          ids={ids}
          paceRef={paceRef}
          fx={fx}
          side={0}
          driver={{
            posts,
            onFx: (items) => setFx((list) => [...list.slice(-40), ...items]),
            onUnits: setIds,
            onPulse: () => setPulse((value) => value + 1),
          }}
        />
        <LabView battle={battle} ids={ids} paceRef={paceRef} fx={fx} side={1} />
      </div>

      <p className="text-[11px] leading-snug text-amber-200/60">
        Los muñecos de prueba están plantados al alcance de cualquier arma y vuelven a su sitio si
        caen. Los tuyos están dentro de donde cae el humo: fíjate en que en tu vista se ven a medias
        y en la del rival desaparecen. La tormenta clava al bando rival 8 s y el túnel se traga al
        andarín tuyo y lo saca por la otra boca.
      </p>
    </div>
  )
}
