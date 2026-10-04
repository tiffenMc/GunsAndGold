import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Points } from 'three'
import { CARD_H, CARD_W, sparkTexture, twinkleTexture } from './cardArt'

/**
 * Las particulas de una carta-vitrina. Hay dos maneras de usarlas:
 *  - 'subir':   chispas que nacen por debajo, suben por delante de la carta y se apagan arriba.
 *  - 'brillar': estrellitas clavadas en su sitio, que se encienden y se apagan, como destellos.
 * Con `estrella` cambian la bolita de luz por un destello de cuatro puntas.
 */

interface Chispa {
  x: number
  y: number
  z: number
  /** Lo rapido que sube (0 en las que solo brillan). */
  sube: number
  /** Desfase del vaiven. */
  fase: number
  vida: number
  dura: number
  /** 0 = color base, 1 = casi blanco. */
  tinte: number
}

const MITAD_ANCHO = CARD_W / 2 + 0.03
const MITAD_ALTO = CARD_H / 2 + 0.03

function nacer(subir: boolean, inicial = false): Chispa {
  return {
    x: (Math.random() * 2 - 1) * MITAD_ANCHO,
    y: subir ? -MITAD_ALTO - Math.random() * 0.16 : (Math.random() * 2 - 1) * MITAD_ALTO,
    // Por delante de la cara de la carta, con algo de fondo para que no queden planas.
    z: CARD_H * 0.13 + Math.random() * 0.12,
    sube: subir ? 0.16 + Math.random() * 0.3 : 0,
    fase: Math.random() * Math.PI * 2,
    vida: inicial ? Math.random() : 0,
    dura: subir ? 1.2 + Math.random() * 1.3 : 0.6 + Math.random() * 1.5,
    tinte: Math.random(),
  }
}

export function Sparks({
  count,
  color,
  size = 9,
  modo = 'subir',
  estrella = false,
}: {
  count: number
  /** Color de las chispas: el de la rareza. */
  color: string
  /** Tamano en pixeles de la pantalla: se ve igual en la ficha y en la mano. */
  size?: number
  modo?: 'subir' | 'brillar'
  estrella?: boolean
}) {
  const points = useRef<Points>(null)
  const subir = modo === 'subir'
  const data = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const chispas = Array.from({ length: count }, () => nacer(subir, true))
    return { positions, colors, chispas }
  }, [count, subir])
  const luces = useMemo(() => {
    const base = new Color(color)
    return { base, claro: base.clone().lerp(new Color('#ffffff'), 0.65) }
  }, [color])

  useFrame((state, dt) => {
    const geometry = points.current?.geometry
    if (!geometry) return
    const paso = Math.min(1 / 30, Math.max(1 / 240, dt))
    const t = state.clock.elapsedTime
    data.chispas.forEach((chispa, i) => {
      chispa.vida += paso
      if (chispa.vida >= chispa.dura) Object.assign(chispa, nacer(subir))
      const avance = chispa.vida / chispa.dura
      // Las que suben se encienden al nacer; los destellos dan un fogonazo corto.
      const brillo = subir ? Math.sin(Math.PI * avance) ** 0.7 : Math.sin(Math.PI * avance) ** 4
      data.positions[i * 3] = chispa.x + (subir ? Math.sin(t * 1.7 + chispa.fase) * 0.025 : 0)
      data.positions[i * 3 + 1] = chispa.y + chispa.sube * chispa.vida
      data.positions[i * 3 + 2] = chispa.z
      const luz = luces.base.clone().lerp(luces.claro, chispa.tinte)
      data.colors[i * 3] = luz.r * brillo
      data.colors[i * 3 + 1] = luz.g * brillo
      data.colors[i * 3 + 2] = luz.b * brillo
    })
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  if (count <= 0) return null
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={estrella ? twinkleTexture() : sparkTexture()}
        size={size}
        sizeAttenuation={false}
        vertexColors
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}
