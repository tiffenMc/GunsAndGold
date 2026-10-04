import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { motionById } from '../animations'
import type { Motion } from '../animations'
import { DollBody } from '../DollBody'
import type { DollLook } from '../dollParams'

const QUIETO = motionById('quieto')

/**
 * **Tu vaquero en grande**, en su escenario de madera: para probarte la ropa en la Sastrería o ver
 * de cerca a los de Los Más Buscados. Si le pasas un movimiento, lo hace en bucle.
 */
export function VistaDeMuneco({
  look,
  motion,
  claveMotion,
  fondo = 'radial-gradient(ellipse at 50% 30%, #6b3f1d 0%, #2a170a 70%)',
}: {
  look: DollLook
  motion?: Motion | null
  /** Cambia cuando hay que empezar el movimiento desde el principio. */
  claveMotion?: string | number
  fondo?: string
}) {
  const elegido = motion ?? QUIETO
  // El muñeco se monta de nuevo si cambia el movimiento: así empieza desde el principio.
  const clave = useMemo(() => `${elegido.id}-${claveMotion ?? ''}`, [elegido.id, claveMotion])
  return (
    <div className="relative h-full w-full" style={{ background: fondo }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 32, position: [0, 2.1, 7.4] }} onCreated={({ camera }) => camera.lookAt(0, 1.55, 0)}>
        <hemisphereLight args={['#ffe9c7', '#5a3a1c', 1.15]} />
        <directionalLight position={[3, 6, 5]} intensity={1.6} color="#ffd9a8" />
        <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#a5c8ff" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[1.5, 40]} />
          <meshLambertMaterial color="#8a5a2b" />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[1.42, 1.5, 40]} />
          <meshLambertMaterial color="#3b2410" />
        </mesh>
        <group key={clave}>
          <DollBody look={look} motion={elegido} playing scale={1.75} />
        </group>
      </Canvas>
    </div>
  )
}
