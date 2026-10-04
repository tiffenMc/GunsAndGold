import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { DoubleSide, Quaternion, Vector3 } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { SIDE_COLOR } from './Field'
import { isStunned } from './engine'
import type { Battle, Side, Smoke, Unit, Vec } from './engine'

/**
 * Las tres armas especiales, dibujadas:
 *  - humo:  nube de bolas suaves que deja ver el campo a traves, pero esconde a las tropas.
 *  - rayo:  la tormenta: nube negra y relampago encima de cada tropa aturdida.
 *  - tunel: dos bocas con un remolino girando.
 */

// ---------------------------------------------------------------------------
// Humo
// ---------------------------------------------------------------------------

const PUFFS = 26
const SMOKE_LIFE = 10

function SmokeCloud({ battle, smoke }: { battle: Battle; smoke: Smoke }) {
  const group = useRef<Group>(null)
  const puffs = useMemo(
    () =>
      Array.from({ length: PUFFS }, (_, i) => {
        const a = (i * 2.399) % (Math.PI * 2)
        const r = Math.sqrt(((i * 41) % 100) / 100) * smoke.radius
        return {
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          y: 0.5 + (((i * 53) % 100) / 100) * 1.7,
          s: 2.1 + (((i * 71) % 100) / 100) * 2,
          bob: 0.4 + (((i * 17) % 100) / 100) * 0.9,
        }
      }),
    [smoke.radius],
  )

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    // Entra y sale suave.
    const k = Math.min(1, Math.max(0, (battle.time - (smoke.until - SMOKE_LIFE)) / 1.2)) *
      Math.min(1, Math.max(0, (smoke.until - battle.time) / 1.2))
    g.visible = k > 0.02
    if (!g.visible) return
    g.rotation.y = t * 0.06
    g.children.forEach((child, i) => {
      const puff = puffs[i]
      if (!puff) return
      // Cada bola vaga a su aire: el humo se mueve, no es una pecera.
      child.position.x = puff.x + Math.sin(t * 0.32 + i * 1.9) * 0.5
      child.position.z = puff.z + Math.cos(t * 0.27 + i * 1.3) * 0.5
      child.position.y = puff.y + Math.sin(t * puff.bob + i) * 0.32
      child.scale.setScalar(puff.s * (0.7 + k * 0.3))
      const material = (child as Mesh).material as MeshBasicMaterial
      material.opacity = 0.15 * k
    })
  })

  return (
    <group ref={group} position={[smoke.x, 0, smoke.z]}>
      {puffs.map((puff, i) => (
        <mesh key={i} position={[puff.x, puff.y, puff.z]}>
          <sphereGeometry args={[1, 7, 5]} />
          <meshBasicMaterial color="#e3e7ea" transparent opacity={0.15} depthWrite={false} />
        </mesh>
      ))}
      {/* Hasta donde llega la nube: asi sabes que zona queda tapada. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[smoke.radius - 0.16, smoke.radius, 44]} />
        <meshBasicMaterial color="#cfd8e3" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function SmokeClouds({ battle }: { battle: Battle }) {
  return (
    <group>
      {battle.smokes.map((smoke) => (
        <SmokeCloud key={smoke.id} battle={battle} smoke={smoke} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Tormenta (el rayo)
// ---------------------------------------------------------------------------

/** Tramos del relampago y altura de la nube de la que cuelga. */
const BOLT_SEGS = 8
const BOLT_TOP = 7.4
const BOLT_SPREAD = 1

/**
 * La tormenta cae encima de la tropa: nube negra arriba, el relampago dentado hasta el suelo y
 * un aro de chispas donde toca. El rayo se rehace a saltos para que parpadee de verdad.
 */
function ZapBolt({ unit }: { unit: Unit }) {
  const group = useRef<Group>(null)
  const halo = useRef<Group>(null)
  const core = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  const next = useRef(0)
  // Puntos del rayo y lo que hace falta para orientar cada tramo de una caja.
  const path = useMemo(() => Array.from({ length: BOLT_SEGS + 1 }, () => new Vector3()), [])
  const up = useMemo(() => new Vector3(0, 1, 0), [])
  const dir = useMemo(() => new Vector3(), [])
  const mid = useMemo(() => new Vector3(), [])
  const quat = useMemo(() => new Quaternion(), [])

  useFrame((state, dt) => {
    const g = group.current
    const bright = core.current
    const soft = halo.current
    if (!g || !bright || !soft) return
    g.position.set(unit.x, 0, unit.z)
    const t = state.clock.elapsedTime
    next.current -= dt
    if (next.current <= 0) {
      // Rayo nuevo: baja del cielo zigzagueando y se cierra en la tropa.
      next.current = 0.06 + Math.random() * 0.06
      path[0]!.set(0, BOLT_TOP, 0)
      for (let i = 1; i <= BOLT_SEGS; i++) {
        const k = i / BOLT_SEGS
        path[i]!.set(
          (Math.random() - 0.5) * BOLT_SPREAD * 2 * (1 - k * 0.7),
          BOLT_TOP * (1 - k),
          (Math.random() - 0.5) * BOLT_SPREAD * 2 * (1 - k * 0.7),
        )
      }
      // El halo y el nucleo llevan los mismos tramos: se colocan igual.
      const place = (limb: Group) => {
        limb.children.forEach((child, i) => {
          const a = path[i]!
          const b = path[i + 1]
          if (!b) return
          mid.copy(a).add(b).multiplyScalar(0.5)
          dir.copy(b).sub(a)
          const len = dir.length() || 0.0001
          dir.multiplyScalar(1 / len)
          quat.setFromUnitVectors(up, dir)
          child.position.copy(mid)
          child.quaternion.copy(quat)
          child.scale.set(1, len, 1)
        })
      }
      place(soft)
      place(bright)
    }
    // Destello: se enciende y se apaga como un relampago.
    const flicker = Math.sin(t * 31 + unit.id * 1.7)
    g.visible = flicker > -0.45
    bright.visible = flicker > -0.15
    if (ring.current) {
      ring.current.scale.setScalar(1 + Math.sin(t * 8 + unit.id) * 0.14)
      ;(ring.current.material as MeshBasicMaterial).opacity = 0.32 + 0.24 * Math.max(0, flicker)
    }
  })

  return (
    <group ref={group} visible={false}>
      {/* El halo: el mismo rayo, mas gordo y transparente. */}
      <group ref={halo}>
        {Array.from({ length: BOLT_SEGS }).map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.24, 1, 0.24]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.18} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={core}>
        {Array.from({ length: BOLT_SEGS }).map((_, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.08, 1, 0.08]} />
            <meshBasicMaterial color="#fff7bf" toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* La nube de la que cuelga el rayo. */}
      {[
        [-0.5, 0.44, 0.1],
        [0.35, 0.52, -0.16],
        [0.05, 0.42, 0.46],
      ].map(([x, size, z], i) => (
        <mesh key={i} position={[x!, BOLT_TOP + 0.2, z!]}>
          <sphereGeometry args={[size!, 8, 6]} />
          <meshBasicMaterial color="#39414f" transparent opacity={0.85} depthWrite={false} />
        </mesh>
      ))}
      {/* Chispas donde toca el suelo. */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.6, 1, 26]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.45} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** La tormenta cae sobre todas las tropas del bando que se quedo clavado. */
export function ZapField({ battle }: { battle: Battle }) {
  const sides: Side[] = []
  for (const side of [0, 1] as Side[]) if (isStunned(battle, side)) sides.push(side)
  if (sides.length === 0) return null
  return (
    <group>
      {battle.units
        .filter((unit) => sides.includes(unit.side) && unit.state !== 'muerto')
        .map((unit) => (
          <ZapBolt key={unit.id} unit={unit} />
        ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Tunel
// ---------------------------------------------------------------------------

function Portal({ battle, until, at, color }: { battle: Battle; until: number; at: Vec; color: string }) {
  const root = useRef<Group>(null)
  const swirl = useRef<Group>(null)
  useFrame((state) => {
    const g = swirl.current
    const r = root.current
    if (!g || !r) return
    // El tunel se apaga en su ultimo segundo: se ve que se esta cerrando.
    const k = Math.min(1, Math.max(0, (until - battle.time) / 1.2))
    r.visible = k > 0.02
    r.scale.setScalar(0.45 + 0.55 * k)
    const t = state.clock.elapsedTime
    g.rotation.z = t * 1.1
    g.scale.setScalar(1 + Math.sin(t * 3) * 0.07)
  })
  return (
    <group ref={root} position={[at.x, 0.06, at.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 1.06, 26]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
      </mesh>
      <group ref={swirl} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <mesh>
          <ringGeometry args={[0.4, 0.66, 7]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.44, 0.78, 0.9, 12, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.14}
          side={DoubleSide}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function TunnelPortals({ battle }: { battle: Battle }) {
  return (
    <group>
      {battle.tunnels.map((tunnel) => (
        <group key={tunnel.id}>
          <Portal battle={battle} until={tunnel.until} at={tunnel.entry} color={SIDE_COLOR[tunnel.side]} />
          <Portal battle={battle} until={tunnel.until} at={tunnel.exit} color={SIDE_COLOR[tunnel.side]} />
        </group>
      ))}
    </group>
  )
}
