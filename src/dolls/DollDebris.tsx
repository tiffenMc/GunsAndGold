import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { Vector3 } from 'three'
import type { Group } from 'three'
import type { BurstStyle, Pose, Triple } from './animations'
import {
  BootPart,
  HandPart,
  HeadPart,
  LowerArmPart,
  PelvisPart,
  ShinPart,
  ThighPart,
  TorsoPart,
  UpperArmPart,
} from './dollParts'
import { proportions } from './dollParams'
import type { DollLook, Proportions } from './dollParams'

const DEG = Math.PI / 180

/** Cuanto se frena el tiempo (de 0 a 1) a los `t` segundos de romperse en camara lenta. */
function curvaLenta(t: number): number {
  if (t < 0.18) return 0.1
  if (t < 0.6) return 0.1 + ((t - 0.18) / 0.42) * 0.22
  if (t < 1.4) return 0.32
  if (t < 2.4) return 0.32 + (t - 1.4) * 0.68
  return 1
}

interface Chunk {
  /** Se llama como el hueso, para poder heredar la pose del momento de romperse. */
  id: string
  at: [number, number, number]
  /** Radio del cacho, para saber donde toca el suelo. */
  size: number
  upper: boolean
  part: ReactNode
}

function buildChunks(pr: Proportions, look: DollLook, lite?: boolean): Chunk[] {
  const { hipY, hipX, torsoH, headUp, shoulderX, shoulderY, upperArm, foreArm, thigh, shin, limbR } = pr
  const shY = hipY + shoulderY
  const soft = limbR * 1.1
  const props = { pr, look, lite }
  const chunks: Chunk[] = [
    { id: 'hips', at: [0, hipY, 0], size: soft, upper: true, part: <PelvisPart {...props} /> },
    { id: 'torso', at: [0, hipY, 0], size: pr.torsoD, upper: true, part: <TorsoPart {...props} /> },
    { id: 'head', at: [0, hipY + torsoH + headUp, 0], size: pr.headR * 0.9, upper: true, part: <HeadPart {...props} /> },
  ]
  for (const side of [-1, 1] as const) {
    const n = side < 0 ? 'L' : 'R'
    const x = side * shoulderX
    chunks.push(
      { id: `shoulder${n}`, at: [x, shY, 0], size: soft, upper: true, part: <UpperArmPart {...props} /> },
      { id: `elbow${n}`, at: [x, shY - upperArm, 0], size: soft, upper: true, part: <LowerArmPart {...props} /> },
      {
        id: `hand${n}`,
        at: [x, shY - upperArm - foreArm, 0],
        size: pr.handR,
        upper: true,
        part: <HandPart {...props} right={n === 'R'} />,
      },
      { id: `hip${n}`, at: [side * hipX, hipY, 0], size: soft, upper: false, part: <ThighPart {...props} /> },
      { id: `knee${n}`, at: [side * hipX, hipY - thigh, 0], size: soft, upper: false, part: <ShinPart {...props} /> },
      { id: `foot${n}`, at: [side * hipX, hipY - thigh - shin, 0], size: pr.bootH, upper: false, part: <BootPart {...props} /> },
    )
  }
  return chunks
}

function initialVelocity(style: BurstStyle, chunk: Chunk, rnd: number): Vector3 {
  const radial = new Vector3(chunk.at[0], 0, chunk.at[2])
  if (radial.lengthSq() < 0.0001) radial.set(rnd - 0.5, 0, rnd - 0.5)
  radial.normalize()

  switch (style) {
    case 'estallido':
      return new Vector3(radial.x * (1.1 + rnd * 0.9), 1.5 + rnd * 1.1, radial.z * (1.1 + rnd * 0.9))
    case 'derrumbe':
      return new Vector3((rnd - 0.5) * 0.7, 0.15 + rnd * 0.4, (rnd - 0.5) * 0.7)
    case 'arriba':
      return new Vector3((rnd - 0.5) * 0.9, 3.1 + rnd * 1.3, (rnd - 0.5) * 0.9)
    case 'mitades':
      return chunk.upper
        ? new Vector3(radial.x * 1.5, 2.1 + rnd * 1, radial.z * 1.5)
        : new Vector3((rnd - 0.5) * 0.6, 0.1 + rnd * 0.15, (rnd - 0.5) * 0.6)
    default:
      // Desarme: se van cayendo por su propio peso, casi sin empujon.
      return new Vector3((rnd - 0.5) * 0.6, 0.15 + rnd * 0.3, (rnd - 0.5) * 0.6)
  }
}

function initialSpin(style: BurstStyle, rnd: number): Vector3 {
  const amp = style === 'derrumbe' || style === 'desarme' ? 3 : 11
  return new Vector3((rnd - 0.5) * amp, (rnd - 0.5) * amp, (rnd - 0.5) * amp)
}

/**
 * El muñeco roto en pedazos. Son SUS piezas de verdad: se desmontan por las articulaciones
 * y cada una sale volando por su cuenta, como un juguete de piezas que se desarma.
 */
export function DollDebris({
  look,
  style,
  pose,
  onSettled,
  lite,
  camaraLenta = false,
  escala,
}: {
  look: DollLook
  style: BurstStyle
  /** La pose que tenia el muñeco justo al romperse: las piezas arrancan desde ahi. */
  pose?: Pose
  onSettled?: () => void
  lite?: boolean
  /**
   * Romperse en **camara lenta**: casi congelado al instante del golpe, luego muy despacio y por
   * ultimo vuelve a su ritmo. Las piezas salen con mas fuerza para que el vuelo luzca.
   */
  camaraLenta?: boolean
  /** La camara lenta de toda la batalla (el motor la deja en `timeScale`). */
  escala?: { timeScale: number }
}) {
  const pr = useMemo(() => proportions(look), [look])
  const chunks = useMemo(() => buildChunks(pr, look, lite), [pr, look, lite])
  const refs = useRef<(Group | null)[]>([])
  const started = useRef(false)
  const elapsed = useRef(0)
  const notified = useRef(false)
  const state = useRef<{
    pos: Vector3[]
    vel: Vector3[]
    spin: Vector3[]
    rot: Vector3[]
    wait: number[]
  } | null>(null)

  const move: Triple = pose?.move ?? [0, 0, 0]
  const turn = pose?.turn ?? 0

  useFrame((_, raw) => {
    const real = Math.min(0.033, raw)
    const dt = real * (camaraLenta ? curvaLenta(elapsed.current) : 1) * (escala?.timeScale ?? 1)
    if (!started.current) {
      started.current = true
      state.current = {
        pos: chunks.map((chunk) => new Vector3(...chunk.at)),
        vel: [],
        spin: [],
        rot: [],
        wait: [],
      }
      const s = state.current
      chunks.forEach((chunk, index) => {
        const rnd = Math.random()
        const bone = pose?.bones?.[chunk.id]
        s.rot.push(new Vector3(-(bone?.[0] ?? 0) * DEG, (bone?.[1] ?? 0) * DEG, (bone?.[2] ?? 0) * DEG))
        const fuerza = camaraLenta ? 1.35 : 1
        s.vel.push(initialVelocity(style, chunk, rnd).multiplyScalar(fuerza))
        s.spin.push(initialSpin(style, rnd).multiplyScalar(fuerza))
        s.wait.push(style === 'desarme' ? index * 0.07 : 0)
      })
    }

    const s = state.current
    if (!s) return
    elapsed.current += real
    if (!notified.current && onSettled && elapsed.current > 2.8) {
      notified.current = true
      onSettled()
    }

    const bounce = style === 'derrumbe' || style === 'desarme' ? 0.1 : 0.32
    for (let index = 0; index < chunks.length; index++) {
      const group = refs.current[index]
      const chunk = chunks[index]
      if (!group || !chunk) continue
      if (s.wait[index]! > 0) {
        s.wait[index] = s.wait[index]! - dt
      } else {
        s.vel[index]!.y -= 15 * dt
        s.pos[index]!.addScaledVector(s.vel[index]!, dt)
        s.rot[index]!.x += s.spin[index]!.x * dt
        s.rot[index]!.y += s.spin[index]!.y * dt
        s.rot[index]!.z += s.spin[index]!.z * dt
        if (s.pos[index]!.y < chunk.size) {
          s.pos[index]!.y = chunk.size
          s.vel[index]!.y = Math.abs(s.vel[index]!.y) * bounce
          s.vel[index]!.x *= 0.6
          s.vel[index]!.z *= 0.6
          s.spin[index]!.multiplyScalar(0.45)
        }
      }
      group.position.copy(s.pos[index]!)
      group.rotation.set(s.rot[index]!.x, s.rot[index]!.y, s.rot[index]!.z)
    }
  })

  return (
    <group position={[move[0], move[1], move[2]]} rotation={[0, turn * DEG, 0]}>
      {chunks.map((chunk, index) => (
        <group
          key={chunk.id}
          ref={(element) => {
            refs.current[index] = element
          }}
        >
          {chunk.part}
        </group>
      ))}
    </group>
  )
}
