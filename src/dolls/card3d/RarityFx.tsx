import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { Rarity } from '../cards/model'
import { CARD_DEPTH, CARD_H, CARD_W, sunburstTexture, sweepTexture } from './cardArt'
import { Sparks } from './Sparks'

/**
 * Lo que echa cada rareza en la carta 3D. No es lo mismo con mas o menos chispas: cada rango tiene
 * su repertorio, de menos a mas.
 *  - normal:   nada. La carta es la carta, y se nota que es humilde.
 *  - especial: una franja de luz que la recorre de abajo arriba y unas chispas suaves de su color.
 *  - epica:    un aro de rombos girando por detras, cuatro rombos orbitando por delante y chispas.
 *  - divina:   sol de rayos girando, aro dorado al reves, rombos, franja que barre, chispas que
 *              suben y destellos de cuatro puntas parpadeando. La carta mas cara del juego.
 */
export interface Fx {
  /** Chispas que suben. */
  subiendo: number
  /** Destellos quietos que parpadean. */
  destellos: number
  /** Tamano de las particulas, en pixeles. */
  chispa: number
  /** Franja de luz que recorre la carta. */
  barrido: boolean
  /** Rayos girando detras. */
  rayos: boolean
  /** Aro de rombos girando detras. */
  aro: boolean
  /** Rombos orbitando por delante. */
  rombos: boolean
  /** Halo de color detras (0-1). */
  halo: number
  /** Cuanto brilla la madera de la vitrina. */
  emision: number
  /** Cuanto se tine la madera del color de la rareza. */
  tinte: number
}

export const RAREZA_FX: Record<Rarity, Fx> = {
  normal: {
    subiendo: 0,
    destellos: 0,
    chispa: 0,
    barrido: false,
    rayos: false,
    aro: false,
    rombos: false,
    halo: 0,
    emision: 0,
    tinte: 0,
  },
  especial: {
    subiendo: 6,
    destellos: 0,
    chispa: 7,
    barrido: true,
    rayos: false,
    aro: false,
    rombos: false,
    halo: 0.1,
    emision: 0.06,
    tinte: 0.4,
  },
  epica: {
    subiendo: 10,
    destellos: 0,
    chispa: 9,
    barrido: false,
    rayos: false,
    aro: true,
    rombos: true,
    halo: 0.22,
    emision: 0.12,
    tinte: 0.5,
  },
  divina: {
    subiendo: 16,
    destellos: 14,
    chispa: 12,
    barrido: true,
    rayos: true,
    aro: true,
    rombos: true,
    halo: 0.38,
    emision: 0.2,
    tinte: 0.62,
  },
}

const ROMBOS = [0, 1, 2, 3]

/** Aro de rombos girando por detras de la carta, como un circulo runico. */
function Aro({ color, cuantos, radio, tamano, giro }: { color: string; cuantos: number; radio: number; tamano: number; giro: number }) {
  const grupo = useRef<Group>(null)
  useFrame((state) => {
    if (grupo.current) grupo.current.rotation.z = state.clock.elapsedTime * giro
  })
  return (
    <group ref={grupo} position={[0, 0, -CARD_DEPTH / 2 - 0.02]} scale={[0.8, 1, 1]}>
      {Array.from({ length: cuantos }, (_, i) => {
        const angulo = (i * Math.PI * 2) / cuantos
        return (
          <mesh key={i} position={[Math.cos(angulo) * radio, Math.sin(angulo) * radio, 0]} rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[tamano, tamano]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.7}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function RarityFx({ rarity, color, dimmed }: { rarity: Rarity; color: string; dimmed: boolean }) {
  const fx = RAREZA_FX[rarity]
  const franja = useRef<Mesh>(null)
  const sol = useRef<Mesh>(null)
  const rombos = useRef<(Mesh | null)[]>([])

  useFrame((state) => {
    if (dimmed) return
    const t = state.clock.elapsedTime

    // La franja recorre la carta de abajo arriba y se apaga en los extremos.
    if (franja.current) {
      const ciclo = (t % 3.6) / 3.6
      const material = franja.current.material as MeshBasicMaterial
      material.opacity = Math.sin(Math.PI * ciclo) ** 1.5 * (rarity === 'divina' ? 0.6 : 0.34)
      franja.current.position.y = -CARD_H * 0.72 + ciclo * CARD_H * 1.44
    }

    // El sol de rayos va girando despacio y late.
    if (sol.current) {
      sol.current.rotation.z = t * 0.16
      const material = sol.current.material as MeshBasicMaterial
      material.opacity = 0.26 + Math.sin(t * 1.4) * 0.1
    }

    // Los rombos giran alrededor de la carta, cada uno con su brillo.
    rombos.current.forEach((mesh, i) => {
      if (!mesh) return
      const angulo = t * 0.85 + (i * Math.PI) / 2
      mesh.position.set(
        Math.cos(angulo) * (CARD_W / 2 + 0.06),
        Math.sin(angulo) * (CARD_H / 2 + 0.07),
        CARD_DEPTH / 2 + 0.02,
      )
      mesh.rotation.z = angulo * 1.6 + Math.PI / 4
      const material = mesh.material as MeshBasicMaterial
      material.opacity = 0.45 + Math.sin(t * 3 + i * 1.6) * 0.3
    })
  })

  if (dimmed || rarity === 'normal') return null

  return (
    <group>
      {/* Sol de rayos girando por detras */}
      {fx.rayos && (
        <mesh ref={sol} position={[0, 0, -CARD_DEPTH / 2 - 0.03]}>
          <planeGeometry args={[CARD_W * 2, CARD_H * 1.6]} />
          <meshBasicMaterial
            map={sunburstTexture()}
            color={color}
            transparent
            opacity={0.3}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Aro de rombos girando por detras, al reves que el sol */}
      {fx.aro && <Aro color={color} cuantos={rarity === 'divina' ? 16 : 12} radio={CARD_H / 2 + 0.06} tamano={rarity === 'divina' ? 0.05 : 0.045} giro={-0.3} />}

      {/* Franja de luz que barre la carta */}
      {fx.barrido && (
        <mesh ref={franja} position={[0, 0, CARD_DEPTH / 2 + 0.04]} rotation={[0, 0, rarity === 'divina' ? -0.42 : 0]}>
          <planeGeometry args={[CARD_W * 1.9, CARD_W * 0.62]} />
          <meshBasicMaterial
            map={sweepTexture()}
            color={color}
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Rombos orbitando por delante del marco */}
      {fx.rombos &&
        ROMBOS.map((i) => (
          <mesh
            key={i}
            ref={(el) => {
              rombos.current[i] = el
            }}
          >
            <planeGeometry args={[rarity === 'divina' ? 0.075 : 0.065, rarity === 'divina' ? 0.075 : 0.065]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.6}
              blending={AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}

      {/* Chispas que suben por delante */}
      <Sparks count={fx.subiendo} color={color} size={fx.chispa} />

      {/* Destellos de cuatro puntas que parpadean (divinas) */}
      <Sparks count={fx.destellos} color="#fff7d6" size={16} modo="brillar" estrella />
    </group>
  )
}
