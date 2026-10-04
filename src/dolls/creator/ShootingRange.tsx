import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { OrthographicCamera } from 'three'
import { BUILTIN_BATTLE } from '../cards/catalog'
import type { WeaponCard } from '../cards/model'
import { FxLayer, Ribbon, WeaponBullets, GroundMark } from '../battle/Effects'
import type { Fx, RibbonData } from '../battle/Effects'
import { Field } from '../battle/Field'
import { SCENARIOS } from '../scenes/scenarios'
import { FieldUnit } from '../battle/FieldUnit'
import { aimDir, angleTo, clampFireLine, createBattle, drainEvents, paceAt, spawnUnit, step, testFire } from '../battle/engine'
import type { Battle, Pace, Vec } from '../battle/engine'
import { FRAMELOOP, capturePointer } from '../debugClock'

const ELEVATION = (35 * Math.PI) / 180
const DUMMIES: Vec[] = [
  { x: -3, z: -2 },
  { x: 0, z: -3.2 },
  { x: 3, z: -2 },
  { x: -1.5, z: 0.8 },
  { x: 1.6, z: 1.2 },
]

function Rig({ cameraRef }: { cameraRef: MutableRefObject<OrthographicCamera | null> }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera
  const size = useThree((state) => state.size)
  useLayoutEffect(() => {
    cameraRef.current = camera
    const zoom = Math.min(size.width / 12, size.height / 12)
    const back = new Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION))
    const target = new Vector3(0, 0, 1.5)
    camera.position.copy(target).addScaledVector(back, 60)
    camera.lookAt(target)
    camera.zoom = zoom
    camera.updateProjectionMatrix()
  }, [camera, size, cameraRef])
  return null
}

function Loop({
  battle,
  onFx,
  setIds,
}: {
  battle: Battle
  onFx: (fx: Fx[]) => void
  setIds: (ids: number[]) => void
}) {
  const key = useRef('')
  const dead = useRef(new Map<number, number>())
  useFrame((state, dt) => {
    step(battle, dt)
    // Los muñecos de practica vuelven a salir al rato de romperse.
    DUMMIES.forEach((spot, index) => {
      const alive = battle.units.some((u) => u.state !== 'muerto' && Math.hypot(u.spawn.x - spot.x, u.spawn.z - spot.z) < 0.01)
      if (alive) {
        dead.current.delete(index)
        return
      }
      const since = dead.current.get(index)
      if (since === undefined) dead.current.set(index, state.clock.elapsedTime)
      else if (state.clock.elapsedTime - since > 2.2) {
        spawnUnit(battle, 1, BUILTIN_BATTLE[index % BUILTIN_BATTLE.length]!, spot, 'bien', true)
        dead.current.delete(index)
      }
    })
    const events = drainEvents(battle)
    const fx: Fx[] = []
    for (const event of events) {
      const born = state.clock.elapsedTime
      if (event.type === 'blast') fx.push({ id: Math.random(), kind: 'blast', x: event.x, z: event.z, r: event.r, color: '', born })
      if (event.type === 'unitHit') fx.push({ id: Math.random(), kind: 'spark', x: event.x, z: event.z, r: 1, color: '#fde68a', born })
      if (event.type === 'bulletEnd') fx.push({ id: Math.random(), kind: 'puff', x: event.x, z: event.z, r: 1, color: '', born })
      if (event.type === 'unitDeath') fx.push({ id: Math.random(), kind: 'dust', x: event.x, z: event.z, r: 1, color: '', born })
    }
    if (fx.length > 0) onFx(fx)
    const next = battle.units.map((u) => u.id)
    const k = next.join(',')
    if (k !== key.current) {
      key.current = k
      setIds(next)
    }
  })
  return null
}

/** Campo de tiro: la boca sale sobre tu linea de fuego y apuntas arrastrando. */
export function ShootingRange({ weapon }: { weapon: WeaponCard }) {
  const battle = useMemo(() => {
    const b = createBattle({ decks: [[weapon], BUILTIN_BATTLE], practice: true })
    DUMMIES.forEach((spot, index) => spawnUnit(b, 1, BUILTIN_BATTLE[index]!, spot, 'bien', true))
    return b
  }, [weapon])
  const [ids, setIds] = useState<number[]>([])
  const [fx, setFx] = useState<Fx[]>([])
  const paceRef = useRef<Pace>(paceAt(0))
  const cameraRef = useRef<OrthographicCamera | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const origin = useRef<Vec | null>(null)
  const aimAngle = useRef(0)
  const drawing = useRef(false)
  const line = useRef<RibbonData>({ points: [], visible: false, color: weapon.accent, width: 0.16, dashed: true })
  const mark = useRef({ visible: false, x: 0, z: 0, r: 0.7, color: weapon.accent })

  const ground = (clientX: number, clientY: number): Vec | null => {
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

  const refresh = () => {
    const from = origin.current
    if (!from) {
      line.current = { ...line.current, visible: false }
      mark.current = { ...mark.current, visible: false }
      return
    }
    const dir = aimDir(0, aimAngle.current)
    const reach = weapon.shot.range
    line.current = {
      ...line.current,
      points: [from, { x: from.x + dir.x * reach, z: from.z + dir.z * reach }],
      visible: true,
      color: weapon.accent,
    }
    mark.current = { ...mark.current, visible: true, x: from.x, z: from.z, r: 0.7, color: weapon.accent }
  }

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    capturePointer(event.currentTarget, event.pointerId)
    drawing.current = true
    const p = ground(event.clientX, event.clientY)
    origin.current = p ? clampFireLine(0, p.x) : null
    aimAngle.current = 0
    refresh()
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing.current) return
    const p = ground(event.clientX, event.clientY)
    const from = origin.current
    if (!p || !from) return
    aimAngle.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, angleTo(0, from, p)))
    refresh()
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    const from = origin.current
    if (from) testFire(battle, 0, weapon, from.x, aimAngle.current)
    origin.current = null
    aimAngle.current = 0
    refresh()
  }

  return (
    <div ref={box} className="relative h-[34vh] min-h-[210px] touch-none overflow-hidden rounded-2xl border border-sky-900/60 lg:h-[46vh] lg:min-h-[320px]" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Canvas frameloop={FRAMELOOP} orthographic dpr={[1, 2]} camera={{ position: [0, 20, 30], zoom: 30 }}>
        <color attach="background" args={['#d9a066']} />
        <Rig cameraRef={cameraRef} />
        <hemisphereLight args={['#ffe3b8', '#6b3f1f', 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[8, 16, 10]} intensity={2.2} color="#fff1d4" />
        <Loop battle={battle} onFx={(items) => setFx((list) => [...list.slice(-30), ...items])} setIds={setIds} />
        <Field battle={battle} scenario={SCENARIOS[0]!} deploying={false} />
        {ids.map((id) => {
          const unit = battle.units.find((u) => u.id === id)
          return unit ? <FieldUnit key={id} unit={unit} battle={battle} paceRef={paceRef} /> : null
        })}
        <WeaponBullets battle={battle} />
        <Ribbon data={line} />
        <GroundMark data={mark} />
        <FxLayer items={fx} />
      </Canvas>
      <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-[11px] text-amber-950/80">
        Arrastra para deslizar el arma por tu línea y apuntar hacia donde sueltes
      </p>
    </div>
  )
}
