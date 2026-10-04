import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useReducer, useRef, useState } from 'react'
import type { PerspectiveCamera } from 'three'
import type { CardDef } from '../cards/model'
import { DollBody, POSE_MOTION } from '../DollBody'
import { proportions } from '../dollParams'
import { WeaponModel } from './WeaponModel'
import { FRAMELOOP } from '../debugClock'

/**
 * Retratos de las cartas para las listas (mazo y creador): se hace una foto del muñeco o del
 * arma con un lienzo escondido, una sola vez por aspecto, y se guarda como imagen.
 */

interface Job {
  key: string
  card: CardDef
}

const cache = new Map<string, string>()
const queue: Job[] = []
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

export function portraitKey(card: CardDef): string {
  return card.kind === 'batalla' ? `b:${JSON.stringify(card.look)}` : `a:${card.model}`
}

export function usePortrait(card: CardDef): string | null {
  const key = portraitKey(card)
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    listeners.add(force)
    if (!cache.has(key) && !queue.some((job) => job.key === key)) {
      // Lo ultimo que se pide es lo que se esta viendo ahora: va el primero de la cola.
      queue.unshift({ key, card })
      notify()
    }
    return () => {
      listeners.delete(force)
    }
    // La carta cambia de objeto en cada retoque; la llave es lo que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return cache.get(key) ?? null
}

function Snap({ job, onDone }: { job: Job; onDone: (url: string) => void }) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as PerspectiveCamera
  const frames = useRef(0)
  const card = job.card
  const height = card.kind === 'batalla' ? proportions(card.look).H : 1

  useEffect(() => {
    frames.current = 0
    if (card.kind === 'batalla') {
      const h = height
      // Encuadre a medida: de la cabeza a las rodillas, pero lo bastante lejos para que quepa el
      // sombrero (o la barriga) entero, que si no el gordo se queda en una mancha roja.
      const look = card.look
      const pr = proportions(look)
      const r = pr.headR * look.hatSize
      const hatHalf =
        look.hat === 'sombrero' ? r * 2.6 : look.hat === 'vaquero' ? r * 1.8 : look.hat === 'ninguno' ? 0 : r * 1.25
      const halfW = Math.max(hatHalf * 0.85, pr.bellyR * 1.25, pr.shoulderX + pr.limbR * 3, pr.headR * look.headWidth * 1.45)
      const tanHalf = Math.tan((28 * Math.PI) / 360)
      const dist = Math.max((0.43 * h) / tanHalf, (halfW * 1.08) / (tanHalf * (220 / 308)))
      const look_y = h * (dist > (0.43 * h) / tanHalf * 1.05 ? 0.6 : 0.56)
      camera.position.set(dist * 0.24, look_y + dist * 0.1, dist * 0.96)
      camera.lookAt(0, look_y, 0)
    } else {
      // El arma mide 1 de largo y la foto es mas alta que ancha: se pone en diagonal y se aleja lo
      // justo para que entre entera (antes se salia por los lados y no se distinguia).
      camera.position.set(0, 0.1, 2.3)
      camera.lookAt(0, 0, 0)
    }
    camera.updateProjectionMatrix()
  }, [job, camera, card.kind, height])

  useFrame(() => {
    frames.current += 1
    if (frames.current === 4) onDone(gl.domElement.toDataURL('image/png'))
  })

  return card.kind === 'batalla' ? (
    <DollBody
      look={card.look}
      motion={POSE_MOTION}
      playing={false}
    />
  ) : (
    <group rotation={[0.3, -0.5, 0.5]}>
      <WeaponModel model={card.model} />
    </group>
  )
}

/** Monta esto una vez: va haciendo las fotos que se vayan pidiendo. */
export function PortraitBaker() {
  const [job, setJob] = useState<Job | null>(null)
  useEffect(() => {
    const check = () => setJob((current) => current ?? queue[0] ?? null)
    listeners.add(check)
    check()
    return () => {
      listeners.delete(check)
    }
  }, [])

  if (!job) return null
  return (
    <div style={{ position: 'fixed', left: -4000, top: 0, width: 220, height: 308, pointerEvents: 'none' }} aria-hidden>
      <Canvas
        frameloop={FRAMELOOP}
        dpr={1.5}
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        camera={{ fov: 28, position: [0, 1, 4] }}
      >
        <ambientLight intensity={1.15} color="#fff1dc" />
        <directionalLight position={[2, 3, 3]} intensity={3.2} color="#fff6e6" />
        <directionalLight position={[-2, 1, -1]} intensity={0.7} color="#ff9d5c" />
        <Snap
          key={job.key}
          job={job}
          onDone={(url) => {
            cache.set(job.key, url)
            const index = queue.findIndex((item) => item.key === job.key)
            if (index >= 0) queue.splice(index, 1)
            setJob(queue[0] ?? null)
            notify()
          }}
        />
      </Canvas>
    </div>
  )
}
