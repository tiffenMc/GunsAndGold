import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Group, Mesh } from 'three'
import { BONE_NAMES, POSE_CARTA, blendPose, samplePose } from './animations'
import type { Motion, Pose, Triple } from './animations'
import {
  OutlineCtx,
  BootPart,
  HeadPart,
  HandPart,
  LowerArmPart,
  Mat,
  NeckPart,
  PelvisPart,
  ShinPart,
  ThighPart,
  TorsoPart,
  UpperArmPart,
} from './dollParts'
import { proportions } from './dollParams'
import type { DollLook } from './dollParams'

const DEG = Math.PI / 180
/** Cuanto tarda el paso de una animacion a otra. */
const FADE = 0.2

/** Pose quieta de carta: la usan los retratos, que no se mueven. */
export const POSE_MOTION: Motion = {
  id: 'pose-carta',
  kind: 'quieto',
  name: 'Pose',
  hint: '',
  loop: true,
  length: 1,
  keys: [
    { t: 0, pose: POSE_CARTA },
    { t: 1, pose: POSE_CARTA },
  ],
}

/** Pose que se mezcla encima del movimiento (la usa la fisica de la carta al caerse). */
export interface PoseMix {
  pose: Pose
  weight: number
}

export interface DollBodyProps {
  look: DollLook
  motion: Motion
  playing: boolean
  speed?: number
  /** Avisa cuando un movimiento de una sola vez ha terminado. */
  onDone?: () => void
  /** Escala extra, para encuadrar. */
  scale?: number
  /** Si trae pose, se mezcla encima del movimiento con su peso. */
  mixRef?: MutableRefObject<PoseMix | null>
  /** Se llama cada vez que suelta un tiro (en el instante del fogonazo). */
  onFire?: () => void
  /** En la batalla: pocas mallas y pocos poligonos. Las cartas y fichas van con todo detalle. */
  lite?: boolean
  /** La camara lenta de la batalla: si viene, las animaciones la siguen. */
  escala?: { timeScale: number }
}

/** Muñeco articulado al estilo DER DAED: cada pieza gira en su articulacion. */
export function DollBody({
  look,
  motion,
  playing,
  speed = 1,
  onDone,
  scale = 1,
  mixRef,
  onFire,
  lite = false,
  escala,
}: DollBodyProps) {
  const pr = useMemo(() => proportions(look), [look])
  const refs = useRef<Record<string, Group | null>>({})
  const flash = useRef<Mesh>(null)
  const flashL = useRef<Mesh>(null)
  const wasFiring = useRef(false)
  const eyes = useRef<Group>(null)
  const blink = useRef(2 + Math.random() * 3)
  const time = useRef(0)
  const done = useRef(false)
  // El movimiento aplicado en el fotograma anterior: al cambiar se reinicia el reloj y se
  // guarda la pose que habia para entrar mezclando. Va aqui y no en un efecto, porque si no
  // el primer fotograma ve el tiempo viejo y da el movimiento por terminado al instante.
  const current = useRef<Motion | null>(null)
  const frozen = useRef<Pose | null>(null)
  const fade = useRef(1)
  const last = useRef<Pose | null>(null)

  const setBone = (name: string) => (element: Group | null) => {
    refs.current[name] = element
  }

  const apply = useCallback((pose: Pose) => {
    const root = refs.current.root
    const move: Triple = pose.move ?? [0, 0, 0]
    if (root) {
      root.position.set(move[0], move[1], move[2])
      root.rotation.y = (pose.turn ?? 0) * DEG
    }
    const bones = pose.bones ?? {}
    for (const name of BONE_NAMES) {
      const group = refs.current[name]
      if (!group) continue
      const triple: Triple = bones[name] ?? [0, 0, 0]
      // La x va en negativo: asi "adelante" es hacia delante en todos los huesos.
      group.rotation.set(-triple[0] * DEG, triple[1] * DEG, triple[2] * DEG)
    }
  }, [])

  useEffect(() => {
    done.current = false
  }, [motion])

  // Deja la pose puesta ya, antes del primer fotograma: los retratos no dependen del bucle.
  useLayoutEffect(() => {
    apply(samplePose(motion, time.current))
  }, [apply, motion, look])

  useFrame((_, delta) => {
    if (current.current !== motion) {
      frozen.current = last.current
      current.current = motion
      time.current = 0
      done.current = false
      fade.current = 0
    }
    if (playing) time.current += delta * speed * (escala?.timeScale ?? 1)
    if (!motion.loop && !done.current && time.current >= motion.length) {
      done.current = true
      if (onDone) onDone()
    }

    const live = samplePose(motion, time.current)
    let pose = live
    if (frozen.current && fade.current < 1) {
      fade.current = Math.min(1, fade.current + delta / FADE)
      const eased = fade.current * fade.current * (3 - 2 * fade.current)
      pose = blendPose(frozen.current, live, eased)
      if (fade.current >= 1) frozen.current = null
    }
    const mix = mixRef?.current
    if (mix && mix.weight > 0.001) pose = blendPose(pose, mix.pose, Math.min(1, mix.weight))
    apply(pose)
    last.current = pose

    const marks = motion.firesAt ?? []
    const length = motion.length
    const t = motion.loop ? ((time.current % length) + length) % length : time.current
    const firing = marks.some((mark) => t >= mark && t <= mark + 0.09)
    if (firing && !wasFiring.current && onFire) onFire()
    wasFiring.current = firing
    for (const mesh of [flash.current, flashL.current]) {
      if (!mesh) continue
      mesh.visible = firing
      mesh.scale.setScalar(firing ? pr.handR * (0.8 + Math.random() * 0.6) : 0.001)
    }

    // Parpadeo, como en DER DAED.
    if (eyes.current) {
      if (playing) blink.current -= delta
      if (blink.current < 0) {
        eyes.current.scale.y = 0.1
        if (blink.current < -0.12) blink.current = 2 + Math.random() * 4
      } else eyes.current.scale.y = 1
    }
  })

  const { hipY, hipX, torsoH, headUp, shoulderX, shoulderY, upperArm, foreArm, thigh, shin } = pr
  const part = { pr, look, lite }

  return (
    <OutlineCtx.Provider value={lite ? look.team ?? null : null}>
    <group ref={setBone('root')} scale={scale}>
      <group ref={setBone('hips')} position={[0, hipY, 0]}>
        <PelvisPart {...part} />

        <group ref={setBone('torso')}>
          <TorsoPart {...part} />

          <group ref={setBone('neck')} position={[0, torsoH, 0]}>
            <NeckPart {...part} />
            <group ref={setBone('head')} position={[0, headUp, 0]}>
              <HeadPart {...part} eyesRef={eyes} />
            </group>
          </group>

          {([-1, 1] as const).map((side) => {
            const name = side < 0 ? 'L' : 'R'
            return (
              <group key={name} ref={setBone(`shoulder${name}`)} position={[side * shoulderX, shoulderY, 0]}>
                <UpperArmPart {...part} />
                <group ref={setBone(`elbow${name}`)} position={[0, -upperArm, 0]}>
                  <LowerArmPart {...part} />
                  <group ref={setBone(`hand${name}`)} position={[0, -foreArm, 0]}>
                    <HandPart {...part} right={name === 'R'} flashRef={name === 'R' ? flash : flashL} />
                  </group>
                </group>
              </group>
            )
          })}
        </group>

        {([-1, 1] as const).map((side) => {
          const name = side < 0 ? 'L' : 'R'
          return (
            <group key={name} ref={setBone(`hip${name}`)} position={[side * hipX, 0, 0]}>
              <ThighPart {...part} />
              <group ref={setBone(`knee${name}`)} position={[0, -thigh, 0]}>
                <ShinPart {...part} />
                <group ref={setBone(`foot${name}`)} position={[0, -shin, 0]}>
                  <BootPart {...part} />
                </group>
              </group>
            </group>
          )
        })}
      </group>
    </group>
    </OutlineCtx.Provider>
  )
}

/** Escudos flotantes grandes y brillantes: cada esfera equivale a un impacto restante. */
export function ShieldPips({
  count,
  height,
  color = '#7dd3fc',
}: {
  count: number
  height: number
  color?: string
}) {
  const shown = Math.min(10, Math.max(0, count))
  const rows = Math.ceil(shown / 5)
  return (
    <group position={[0, height + 0.72, 0]}>
      {Array.from({ length: shown }).map((_, index) => {
        const row = Math.floor(index / 5)
        const rowCount = Math.min(5, shown - row * 5)
        const column = index % 5
        return (
          <group
            key={index}
            position={[(column - (rowCount - 1) / 2) * 0.43, (rows - 1 - row) * 0.4, 0]}
          >
            <mesh>
              <sphereGeometry args={[0.205, 16, 16]} />
              <meshBasicMaterial color="#06111d" transparent opacity={0.95} depthWrite={false} />
            </mesh>
            <mesh scale={0.84}>
              <sphereGeometry args={[0.205, 16, 16]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh position={[-0.055, 0.085, 0.13]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

/** Aro del suelo: hasta donde llega su disparo. */
export function RangeRing({ radius, color = '#38bdf8' }: { radius: number; color?: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[Math.max(0.25, radius - 0.08), radius, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={2} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </>
  )
}

export { Mat }
