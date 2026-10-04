import { Canvas, useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'
import type { Group } from 'three'
import type { CardDef } from '../cards/model'
import { TrappedCard } from './TrappedCard'
import { FRAMELOOP, capturePointer } from '../debugClock'

interface Control {
  /** Giro que pide el dedo (volante) e inclinacion. */
  roll: number
  pitch: number
  yaw: number
  spin: boolean
  shake: number
  flip: number
}

function Rig({ card, control }: { card: CardDef; control: MutableRefObject<Control> }) {
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  useFrame((state, dt) => {
    const c = control.current
    const g = outer.current
    const r = inner.current
    if (!g || !r) return
    if (c.spin) c.yaw += dt * 0.7
    const t = state.clock.elapsedTime
    const sway = c.spin ? 0 : Math.sin(t * 0.6) * 0.25
    const k = Math.min(1, dt * 9)
    r.rotation.z += (c.roll + c.flip - r.rotation.z) * k
    r.rotation.x += (c.pitch - r.rotation.x) * k
    g.rotation.y += (c.yaw + sway - g.rotation.y) * k
    // Sacudida: la carta tiembla de lado a lado y el muñeco sale rebotando.
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt)
      g.position.x = Math.sin(t * 38) * 0.09 * (c.shake / 0.7)
      g.position.y = Math.cos(t * 31) * 0.05 * (c.shake / 0.7)
    } else {
      g.position.x *= 0.8
      g.position.y *= 0.8
    }
  })
  return (
    <group ref={outer}>
      <group ref={inner}>
        <TrappedCard card={card} />
      </group>
    </group>
  )
}

/**
 * Visor de una carta-vitrina. Arrastra encima para girarla como un volante (de lado) o
 * inclinarla (arriba y abajo): el muñeco de dentro se cae y rueda.
 */
export function CardViewer({
  card,
  className = '',
  limpio = false,
  sacudir = true,
}: {
  card: CardDef
  className?: string
  /** Solo la carta: sin el aviso de arrastrar ni los botones. Para cuando va dentro de una carta. */
  limpio?: boolean
  /** El boton de sacudir (solo tiene sentido si dentro hay un muñeco que pueda caerse). */
  sacudir?: boolean
}) {
  const control = useRef<Control>({ roll: 0, pitch: 0, yaw: 0, spin: false, shake: 0, flip: 0 })
  const drag = useRef<{ x: number; y: number; roll: number; pitch: number } | null>(null)
  const [spin, setSpin] = useState(false)

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    capturePointer(event.currentTarget, event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, roll: control.current.roll, pitch: control.current.pitch }
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const rect = event.currentTarget.getBoundingClientRect()
    control.current.roll = d.roll - ((event.clientX - d.x) / rect.width) * Math.PI * 1.6
    control.current.pitch = Math.max(-1.3, Math.min(1.3, d.pitch + ((event.clientY - d.y) / rect.height) * 2.4))
  }
  const up = () => {
    drag.current = null
  }

  const button =
    'rounded-lg border border-amber-300/40 bg-black/55 px-3 py-2 text-[11px] text-amber-100 active:scale-95'

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        className={`relative min-h-0 flex-1 ${limpio ? '' : 'touch-none'}`}
        onPointerDown={limpio ? undefined : down}
        onPointerMove={limpio ? undefined : move}
        onPointerUp={limpio ? undefined : up}
        onPointerCancel={limpio ? undefined : up}
      >
        <Canvas frameloop={FRAMELOOP} dpr={[1, 2]} camera={{ position: [0, 0, 2.7], fov: 32 }}>
          <ambientLight intensity={0.75} color="#ffe9c8" />
          <directionalLight position={[1.5, 2.5, 3]} intensity={2.4} color="#fff1d4" />
          <directionalLight position={[-2, -1, 1.5]} intensity={0.6} color="#ff9d5c" />
          <Rig card={card} control={control} />
        </Canvas>
        {!limpio && (
          <p className="pointer-events-none absolute inset-x-0 top-1.5 text-center text-[10px] text-amber-100/60">
            Arrastra para girar la carta
          </p>
        )}
      </div>
      {!limpio && (
      <div className="flex flex-wrap justify-center gap-1.5 px-1 pb-2 pt-1">
        <button
          type="button"
          className={button}
          onClick={() => {
            control.current.flip += Math.PI
          }}
        >
          Voltear
        </button>
        {sacudir && (
          <button
            type="button"
            className={button}
            onClick={() => {
              control.current.shake = 0.7
            }}
          >
            Sacudir
          </button>
        )}
        <button
          type="button"
          className={button}
          onClick={() => {
            const c = control.current
            c.roll = 0
            c.pitch = 0
            c.flip = Math.round(c.flip / (Math.PI * 2)) * Math.PI * 2
          }}
        >
          Enderezar
        </button>
        <button
          type="button"
          className={`${button} ${spin ? 'border-amber-300 bg-amber-400/25' : ''}`}
          onClick={() => {
            control.current.spin = !spin
            if (spin) control.current.yaw = Math.round(control.current.yaw / (Math.PI * 2)) * Math.PI * 2
            setSpin(!spin)
          }}
        >
          Girar sola
        </button>
      </div>
      )}
    </div>
  )
}
