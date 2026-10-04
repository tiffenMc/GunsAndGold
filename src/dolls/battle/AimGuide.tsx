import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Shape } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { ShotSpec } from '../cards/model'
import { UNIT_R, lobLanding } from './engine'
import type { Battle, Side } from './engine'

/** Lo que mide de ancho el golpe de una bala (lo mismo que mira el motor al dar). */
const HIT_HALF = UNIT_R + 0.2
/** Cuantas dianas se pueden marcar a la vez. */
const MAX_TARGETS = 10
/** Las flechas que corren por el pasillo hacia delante. */
const CHEVRONS = 5
/** Las muescas de la mirilla: arriba, derecha, abajo, izquierda. */
const TICKS: [number, number, number][] = [
  [0, -0.95, 0],
  [0.95, 0, Math.PI / 2],
  [0, 0.95, 0],
  [-0.95, 0, Math.PI / 2],
]

/** Un cuadrilatero plano en el suelo que se rehace cada fotograma. */
function useQuad() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(12), 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Pone las cuatro esquinas del cuadrilatero (a la altura y). */
function setQuad(g: BufferGeometry, y: number, pts: [number, number][]) {
  const pos = g.getAttribute('position') as BufferAttribute
  pts.forEach(([x, z], i) => pos.setXYZ(i, x, y, z))
  pos.needsUpdate = true
  g.computeBoundingSphere()
}

/** Medio ancho del golpe a una distancia de la boca: los perdigones se abren en cono. */
function halfAt(shot: ShotSpec, dist: number): number {
  if (shot.mode === 'perdigones' && shot.pellets > 1) {
    return HIT_HALF + Math.tan((shot.spread * Math.PI) / 360) * dist
  }
  return HIT_HALF
}

/**
 * La guia de punteria: **lo que va a pasar antes de soltar**. Un pasillo de luz por donde va a ir
 * la bala (con su ancho de verdad, o el cono de los perdigones), flechas que corren hacia delante,
 * una mirilla grande donde se acaba el alcance (con el area de la explosion si la tiene) y una
 * diana roja encima de cada enemigo al que le vas a dar. Todo va lejos del dedo: se ve siempre.
 */
export function AimGuide({
  battle,
  side = 0,
  active,
  muzzle,
  range,
  shot,
  accent,
  target,
}: {
  battle: Battle
  side?: Side
  active: boolean
  /** La boca del arma (la mueve el propio arma cada fotograma). */
  muzzle: MutableRefObject<{ x: number; z: number } | null>
  range: number
  shot: ShotSpec | null
  accent: string
  /** Donde apuntas (el suelo bajo el dedo): las cargas explosivas caen ahi. */
  target?: MutableRefObject<{ x: number; z: number; visible: boolean }>
}) {
  const root = useRef<Group>(null)
  const fill = useQuad()
  const edgeL = useQuad()
  const edgeR = useQuad()
  const chevronRefs = useRef<(Mesh | null)[]>([])
  const end = useRef<Group>(null)
  const blast = useRef<Mesh>(null)
  const targetRefs = useRef<(Group | null)[]>([])
  const rangeRing = useRef<Mesh>(null)
  const fillMat = useRef<MeshBasicMaterial>(null)
  const forward = side === 0 ? -1 : 1

  useFrame((state) => {
    const g = root.current
    const from = muzzle.current
    if (!g) return
    g.visible = Boolean(active && from && shot && range > 0)
    if (!g.visible || !from || !shot) return
    const t = state.clock.elapsedTime
    const x0 = from.x
    const z0 = from.z
    // Una carga explosiva con punto de caida: el pasillo va de la boca a donde cae de verdad.
    const aim = target?.current
    const lob = shot.mode === 'explosivo' && aim && aim.visible ? lobLanding(side, x0, range, aim) : null
    const x1 = lob ? lob.x : x0
    const z1 = lob ? lob.z : z0 + forward * range
    const len = Math.hypot(x1 - x0, z1 - z0) || 1
    const ux = (x1 - x0) / len
    const uz = (z1 - z0) / len
    // El perpendicular (para dar ancho al pasillo).
    const px = -uz
    const pz = ux
    const h0 = lob ? 0.16 : halfAt(shot, 0)
    const h1 = lob ? 0.16 : halfAt(shot, range)

    // El pasillo y sus dos bordes brillantes.
    setQuad(fill, 0.05, [
      [x0 - px * h0, z0 - pz * h0],
      [x0 + px * h0, z0 + pz * h0],
      [x1 + px * h1, z1 + pz * h1],
      [x1 - px * h1, z1 - pz * h1],
    ])
    const e = 0.07
    setQuad(edgeL, 0.06, [
      [x0 - px * (h0 + e), z0 - pz * (h0 + e)],
      [x0 - px * (h0 - e), z0 - pz * (h0 - e)],
      [x1 - px * (h1 - e), z1 - pz * (h1 - e)],
      [x1 - px * (h1 + e), z1 - pz * (h1 + e)],
    ])
    setQuad(edgeR, 0.06, [
      [x0 + px * (h0 - e), z0 + pz * (h0 - e)],
      [x0 + px * (h0 + e), z0 + pz * (h0 + e)],
      [x1 + px * (h1 + e), z1 + pz * (h1 + e)],
      [x1 + px * (h1 - e), z1 + pz * (h1 - e)],
    ])
    if (fillMat.current) fillMat.current.opacity = 0.2 + Math.sin(t * 6) * 0.05

    // Hasta donde llegaria como mucho: un aro suave alrededor de la boca (solo en las cargas).
    const ring = rangeRing.current
    if (ring) {
      ring.visible = shot.mode === 'explosivo'
      ring.position.set(x0, 0.045, z0)
      ring.scale.set(range, range, 1)
    }

    // Las flechas corren de la boca hacia el final, y se apagan al llegar.
    chevronRefs.current.forEach((mesh, i) => {
      if (!mesh) return
      const k = (t * 0.55 + i / CHEVRONS) % 1
      mesh.position.set(x0 + ux * len * k, 0.07, z0 + uz * len * k)
      mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(-ux, -uz))
      const s = 0.55 + (lob ? 0.2 : halfAt(shot, range * k)) * 0.6
      mesh.scale.set(s, s, s)
      ;(mesh.material as MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.85
    })

    // La mirilla del final: gira despacio y late.
    const m = end.current
    if (m) {
      m.position.set(x1, 0.08, z1)
      m.rotation.y = t * 0.8
      const pulse = 1 + Math.sin(t * 7) * 0.08
      m.scale.set(pulse, 1, pulse)
    }
    const b = blast.current
    if (b) {
      b.visible = shot.mode === 'explosivo' && shot.radius > 0
      b.position.set(x1, 0.07, z1)
      b.scale.set(shot.radius, shot.radius, 1)
    }

    // Diana sobre cada enemigo que cae dentro del pasillo (o del area de la explosion).
    const hits = battle.units
      .filter((u) => {
        if (u.side === side || u.state === 'muerto') return false
        if (lob) return Math.hypot(u.x - x1, u.z - z1) <= shot.radius + UNIT_R * 0.5
        const dist = (u.z - z0) * forward
        if (dist < 0 || dist > range + UNIT_R) return false
        return Math.abs(u.x - x0) <= halfAt(shot, dist)
      })
      .sort((a, b2) => (a.z - z0) * forward - (b2.z - z0) * forward)
    const shown = shot.mode === 'bala' || shot.mode === 'rafaga' ? hits.slice(0, 1) : hits.slice(0, MAX_TARGETS)
    targetRefs.current.forEach((ring, i) => {
      if (!ring) return
      const unit = shown[i]
      ring.visible = Boolean(unit)
      if (!unit) return
      ring.position.set(unit.x, 0, unit.z)
      const pulse = 1 + Math.sin(t * 10 + i) * 0.12
      ring.scale.set(pulse, 1, pulse)
      ring.children[1]?.position.set(0, 2.3 + Math.sin(t * 8) * 0.15, 0)
    })
  })

  return (
    <group ref={root} visible={false}>
      <mesh geometry={fill} renderOrder={6}>
        <meshBasicMaterial ref={fillMat} color={accent} transparent opacity={0.22} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={edgeL} renderOrder={7}>
        <meshBasicMaterial color={accent} transparent opacity={0.95} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={edgeR} renderOrder={7}>
        <meshBasicMaterial color={accent} transparent opacity={0.95} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
      {Array.from({ length: CHEVRONS }).map((_, i) => (
        <mesh key={i} ref={(el) => (chevronRefs.current[i] = el)} renderOrder={8}>
          {/* Una flecha en V apuntando hacia delante (hacia -z en el suelo). */}
          <shapeGeometry args={[chevronShape]} />
          <meshBasicMaterial color="#fffbe6" transparent opacity={0.8} depthWrite={false} side={DoubleSide} toneMapped={false} />
        </mesh>
      ))}

      {/* La mirilla donde se acaba el alcance */}
      <group ref={end}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={8}>
          <ringGeometry args={[0.62, 0.8, 32]} />
          <meshBasicMaterial color={accent} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* Las cuatro muescas de la mirilla */}
        {TICKS.map(([x, z, rot], i) => (
          <mesh key={i} position={[x, 0, z]} rotation={[-Math.PI / 2, 0, rot]} renderOrder={8}>
            <planeGeometry args={[0.1, 0.5]} />
            <meshBasicMaterial color="#fffbe6" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Hasta donde llega la carga como mucho */}
      <mesh ref={rangeRing} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5} visible={false}>
        <ringGeometry args={[0.985, 1, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.35} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* El area de la explosion, si el arma revienta al final */}
      <mesh ref={blast} rotation={[-Math.PI / 2, 0, 0]} renderOrder={6} visible={false}>
        <ringGeometry args={[0.9, 1, 40]} />
        <meshBasicMaterial color="#fb923c" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Dianas sobre los enemigos a tiro */}
      {Array.from({ length: MAX_TARGETS }).map((_, i) => (
        <group key={i} ref={(el) => (targetRefs.current[i] = el)} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} renderOrder={9}>
            <ringGeometry args={[0.55, 0.78, 28]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* Flechita roja encima de la cabeza */}
          <mesh rotation={[Math.PI, 0, 0]} renderOrder={9}>
            <coneGeometry args={[0.22, 0.4, 4]} />
            <meshBasicMaterial color="#ef4444" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** La V de las flechas del pasillo, en el plano XY (luego se tumba al suelo). */
const chevronShape = (() => {
  const s = new Shape()
  s.moveTo(0, 0.35)
  s.lineTo(0.42, -0.05)
  s.lineTo(0.42, -0.22)
  s.lineTo(0, 0.16)
  s.lineTo(-0.42, -0.22)
  s.lineTo(-0.42, -0.05)
  s.closePath()
  return s
})()
