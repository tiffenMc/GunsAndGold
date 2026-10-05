import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, Points } from 'three'
import type { DirectionalLight } from 'three'
import { FIELD_L, FIELD_W } from './engine'
import { trueno } from './sfx'
import type { ClimaInfo } from './clima'

/**
 * Lo que cae del cielo: **lluvia** (rayas que caen rápido), **nieve** (copos lentos que van de
 * lado) y los **rayos** de la tormenta, que iluminan el campo un instante con su trueno.
 */

const GOTAS = 420

interface Gota {
  x: number
  y: number
  z: number
  v: number
  lado: number
}

function nace(alto: number): Gota {
  return {
    x: (Math.random() * 2 - 1) * FIELD_W,
    y: alto + Math.random() * 6,
    z: (Math.random() * 2 - 1) * (FIELD_L / 2),
    v: 9 + Math.random() * 7,
    lado: (Math.random() * 2 - 1) * 1.6,
  }
}

function Cielo({ cae }: { cae: ClimaInfo }) {
  const points = useRef<Points>(null)
  const datos = useMemo(() => {
    const positions = new Float32Array(GOTAS * 3)
    const colors = new Float32Array(GOTAS * 3)
    const gotas = Array.from({ length: GOTAS }, () => {
      const gota = nace(14)
      gota.y = Math.random() * 16 - 1
      return gota
    })
    const lento = cae.cae === 'nieve'
    const color = new Color(lento ? '#e8f4ff' : '#9dc6ff')
    gotas.forEach((gota, i) => {
      positions[i * 3] = gota.x
      positions[i * 3 + 1] = gota.y
      positions[i * 3 + 2] = gota.z
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    })
    return { positions, colors, gotas, lento }
  }, [cae])

  useFrame((state, dt) => {
    const geometry = points.current?.geometry
    if (!geometry) return
    const paso = Math.min(1 / 30, Math.max(1 / 240, dt))
    const t = state.clock.elapsedTime
    const velocidad = datos.lento ? 0.28 : 1
    datos.gotas.forEach((gota, i) => {
      gota.y -= gota.v * velocidad * paso
      if (datos.lento) gota.x += Math.sin(t * 1.2 + i) * gota.lado * paso
      if (gota.y < 0.1) {
        Object.assign(gota, nace(16))
        gota.y = 15 + Math.random() * 4
      }
      datos.positions[i * 3] = gota.x + (datos.lento ? 0 : 0)
      datos.positions[i * 3 + 1] = gota.y
      datos.positions[i * 3 + 2] = gota.z
    })
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[datos.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[datos.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={datos.lento ? 4 : 2}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={datos.lento ? 0.85 : 0.6}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}

/**
 * El rayo de la tormenta: un fogonazo de luz y su trueno, cada pocos segundos. La luz está siempre
 * (apagada si no hay tormenta): si apareciera y desapareciera, la tarjeta gráfica tendría que
 * recompilar todos los materiales y la partida se pararía.
 */
function Rayos({ activos }: { activos: boolean }) {
  const luz = useRef<DirectionalLight>(null)
  const proximo = useRef(2 + Math.random() * 4)
  const apagado = useRef(0)

  useFrame((_, dt) => {
    const flash = luz.current
    if (!flash) return
    if (!activos) {
      flash.intensity = 0
      return
    }
    if (apagado.current > 0) {
      apagado.current -= dt
      flash.intensity = apagado.current > 0 ? 3.2 : 0
      return
    }
    proximo.current -= dt
    if (proximo.current > 0) return
    // De fondo, de vez en cuando: los rayos de verdad (los que hacen daño) son los sucesos del clima.
    proximo.current = 10 + Math.random() * 14
    apagado.current = 0.22
    flash.intensity = 3.2
    trueno()
  })

  return <directionalLight ref={luz} position={[-4, 20, -6]} intensity={0} color="#dbeafe" />
}

/** El tiempo de la partida: la lluvia o la nieve, y los rayos si es tormenta. */
export function ClimaFx({ info }: { info: ClimaInfo }) {
  return (
    <group>
      {info.cae !== 'nada' && <Cielo cae={info} />}
      <Rayos activos={Boolean(info.rayos)} />
    </group>
  )
}
