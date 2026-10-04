import type { WeaponModel as WeaponModelId } from '../cards/model'
import { Mat } from '../dollParts'

/**
 * Armas del Oeste hechas con piezas. Miden 1 de largo, tumbadas a lo largo del eje X con el
 * canon hacia +X y centradas, para poder meterlas en la carta y que rueden por dentro.
 */

const STEEL = '#a7b3c4'
const DARK = '#5a606d'
const WOOD = '#9a5a2c'
const BRASS = '#e6bd3a'

function Revolver() {
  return (
    <group>
      <mesh position={[0.18, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.56, 10]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.08, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.14, 12]} />
        <Mat color={DARK} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.13, 0.1, 0]}>
        <boxGeometry args={[0.2, 0.07, 0.08]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.3, -0.08, 0]} rotation={[0, 0, 0.55]}>
        <boxGeometry args={[0.13, 0.3, 0.1]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[-0.12, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.05, 0.012, 6, 12, Math.PI]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Shotgun() {
  return (
    <group>
      {[-0.035, 0.035].map((z) => (
        <mesh key={z} position={[0.18, 0.04, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, 0.62, 10]} />
          <Mat color={STEEL} metal={0.35} rough={0.5} />
        </mesh>
      ))}
      <mesh position={[-0.12, 0.02, 0]}>
        <boxGeometry args={[0.18, 0.1, 0.1]} />
        <Mat color={DARK} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.34, -0.03, 0]} rotation={[0, 0, 0.18]}>
        <boxGeometry args={[0.3, 0.12, 0.09]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.08, -0.01, 0]}>
        <boxGeometry args={[0.2, 0.05, 0.09]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
    </group>
  )
}

function Rifle({ heavy = false }: { heavy?: boolean }) {
  const barrel = heavy ? 0.034 : 0.024
  return (
    <group>
      <mesh position={[0.22, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[barrel, barrel, 0.56, 10]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0.12, 0.0, 0]}>
        <boxGeometry args={[0.36, 0.05, 0.06]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[-0.12, 0.02, 0]}>
        <boxGeometry args={[0.14, 0.08, 0.07]} />
        <Mat color={heavy ? DARK : BRASS} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.35, -0.03, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.3, 0.1, 0.07]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      {heavy && (
        <mesh position={[0.02, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 0.24, 8]} />
          <Mat color={DARK} metal={0.35} rough={0.5} />
        </mesh>
      )}
      <mesh position={[-0.12, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.035, 0.01, 6, 12, Math.PI]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Dynamite() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {[
        [0, 0],
        [0.07, 0.03],
        [-0.07, 0.03],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0, z]}>
          <cylinderGeometry args={[0.055, 0.055, 0.62, 12]} />
          <Mat color="#b3261e" rough={0.75} />
        </mesh>
      ))}
      {[-0.16, 0.16].map((y) => (
        <mesh key={y} position={[0, y, 0.015]}>
          <cylinderGeometry args={[0.13, 0.13, 0.05, 12]} />
          <Mat color="#3a2a1a" rough={0.9} />
        </mesh>
      ))}
      <mesh position={[0, -0.38, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 5]} />
        <Mat color="#e8d9b0" />
      </mesh>
      <mesh position={[0, -0.46, 0]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshBasicMaterial color="#ffb347" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Gatling() {
  return (
    <group>
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[0.14, Math.cos(a) * 0.05, Math.sin(a) * 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.62, 6]} />
            <Mat color={STEEL} metal={0.35} rough={0.5} />
          </mesh>
        )
      })}
      {[0.02, 0.36].map((x) => (
        <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.04, 12]} />
          <Mat color={BRASS} metal={0.35} rough={0.5} />
        </mesh>
      ))}
      <mesh position={[-0.24, 0, 0]}>
        <boxGeometry args={[0.24, 0.16, 0.16]} />
        <Mat color={DARK} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[-0.28, 0.1, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 6]} />
        <Mat color={WOOD} />
      </mesh>
      <mesh position={[-0.12, 0.12, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.07]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Grenade() {
  return (
    <group rotation={[0, 0, 0.35]}>
      <mesh>
        <sphereGeometry args={[0.2, 14, 10]} />
        <Mat color="#4a5240" metal={0.5} rough={0.55} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.075, 0.095, 0.1, 10]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 8]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0.1, 0.18, 0]} rotation={[0, 0, -0.75]}>
        <boxGeometry args={[0.32, 0.05, 0.03]} />
        <Mat color="#c3ccd6" metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.05, 0.013, 6, 12]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

/** La tormenta: nube negra de la que cuelga el rayo. */
function Storm() {
  const puffs: [number, number, number, number][] = [
    [-0.17, 0.13, 0, 0.15],
    [0, 0.2, 0.03, 0.19],
    [0.17, 0.12, -0.02, 0.14],
    [-0.06, 0.08, -0.11, 0.12],
    [0.08, 0.09, 0.11, 0.12],
  ]
  return (
    <group>
      {puffs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 10, 8]} />
          <Mat color={i % 2 === 0 ? '#39414f' : '#4b5563'} rough={0.9} />
        </mesh>
      ))}
      <group position={[0.02, -0.04, 0]}>
        <mesh rotation={[0, 0, 0.55]}>
          <boxGeometry args={[0.055, 0.2, 0.055]} />
          <meshBasicMaterial color="#fde047" toneMapped={false} />
        </mesh>
        <mesh position={[-0.05, -0.19, 0]} rotation={[0, 0, -0.6]}>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshBasicMaterial color="#fde047" toneMapped={false} />
        </mesh>
        <mesh position={[0.01, -0.37, 0]} rotation={[0, 0, 0.5]}>
          <boxGeometry args={[0.045, 0.18, 0.045]} />
          <meshBasicMaterial color="#fde047" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** El pico minero: con esto se abre el tunel. */
function Pickaxe() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 0.9, 8]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, 0.18, 8]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0.44, 0.15, 0]} rotation={[0, 0, -0.22]}>
        <coneGeometry args={[0.05, 0.34, 6]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
      <mesh position={[0.44, -0.15, 0]} rotation={[Math.PI, 0, -0.22]}>
        <coneGeometry args={[0.05, 0.34, 6]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Bow() {
  return (
    <group>
      {/* El arco: media circunferencia de madera, la cuerda y la flecha apoyada */}
      <mesh position={[-0.12, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <torusGeometry args={[0.36, 0.022, 6, 18, Math.PI]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[-0.12, 0, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.72, 5]} />
        <Mat color="#e8d9b0" rough={0.9} />
      </mesh>
      <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.62, 6]} />
        <Mat color="#cbbf9f" rough={0.9} />
      </mesh>
      <mesh position={[0.52, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.12, 6]} />
        <Mat color={STEEL} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Axe() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.028, 0.028, 0.9, 8]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.36, 0.06, 0]}>
        <boxGeometry args={[0.1, 0.34, 0.07]} />
        <Mat color={STEEL} metal={0.4} rough={0.45} />
      </mesh>
      <mesh position={[0.4, 0.22, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.08, 0.2, 0.06]} />
        <Mat color={STEEL} metal={0.4} rough={0.45} />
      </mesh>
      <mesh position={[0.32, -0.12, 0]}>
        <boxGeometry args={[0.07, 0.09, 0.06]} />
        <Mat color={DARK} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Spear() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.52, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.055, 0.22, 6]} />
        <Mat color={STEEL} metal={0.4} rough={0.45} />
      </mesh>
      <mesh position={[0.38, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 8]} />
        <Mat color="#c0392b" rough={0.7} />
      </mesh>
    </group>
  )
}

function Hammer() {
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.4, 0, 0]}>
        <boxGeometry args={[0.2, 0.22, 0.34]} />
        <Mat color={DARK} metal={0.4} rough={0.5} />
      </mesh>
      <mesh position={[0.4, 0, 0]}>
        <boxGeometry args={[0.215, 0.05, 0.35]} />
        <Mat color={BRASS} metal={0.35} rough={0.5} />
      </mesh>
    </group>
  )
}

function Catapult() {
  return (
    <group>
      {/* Bastidor, ruedas, brazo con la cuchara y la roca lista para volar */}
      <mesh position={[0, -0.12, 0]}>
        <boxGeometry args={[0.62, 0.07, 0.34]} />
        <Mat color={WOOD} rough={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[-0.12, -0.1, side * 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 12]} />
          <Mat color={DARK} rough={0.8} />
        </mesh>
      ))}
      <mesh position={[0, -0.02, 0]} rotation={[0, 0, 0.9]}>
        <boxGeometry args={[0.7, 0.05, 0.06]} />
        <Mat color={WOOD} rough={0.85} />
      </mesh>
      <mesh position={[0.28, 0.28, 0]}>
        <boxGeometry args={[0.16, 0.05, 0.16]} />
        <Mat color={DARK} rough={0.8} />
      </mesh>
      <mesh position={[0.28, 0.35, 0]}>
        <dodecahedronGeometry args={[0.08, 0]} />
        <Mat color="#8a8378" rough={1} />
      </mesh>
      <mesh position={[-0.05, 0.1, 0]}>
        <boxGeometry args={[0.05, 0.4, 0.28]} />
        <Mat color={WOOD} rough={0.9} />
      </mesh>
    </group>
  )
}

function Cannon() {
  return (
    <group>
      {/* Cañon de hierro sobre su cureña con ruedas */}
      <mesh position={[0.12, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.13, 0.7, 12]} />
        <Mat color="#2b2e35" metal={0.5} rough={0.45} />
      </mesh>
      <mesh position={[0.46, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.1, 0.025, 6, 14]} />
        <Mat color={BRASS} metal={0.4} rough={0.5} />
      </mesh>
      <mesh position={[-0.2, 0.04, 0]}>
        <sphereGeometry args={[0.09, 10, 8]} />
        <Mat color="#2b2e35" metal={0.5} rough={0.45} />
      </mesh>
      <mesh position={[0.05, -0.1, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.26]} />
        <Mat color={WOOD} rough={0.9} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0.05, -0.1, side * 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
          <Mat color={WOOD} rough={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function WeaponModel({ model }: { model: WeaponModelId }) {
  switch (model) {
    case 'escopeta':
      return <Shotgun />
    case 'rifle':
      return <Rifle />
    case 'rifle-pesado':
      return <Rifle heavy />
    case 'dinamita':
      return <Dynamite />
    case 'gatling':
      return <Gatling />
    case 'granada':
      return <Grenade />
    case 'tormenta':
      return <Storm />
    case 'pico':
      return <Pickaxe />
    case 'arco':
      return <Bow />
    case 'hacha':
      return <Axe />
    case 'lanza':
      return <Spear />
    case 'martillo':
      return <Hammer />
    case 'catapulta':
      return <Catapult />
    case 'canon':
      return <Cannon />
    default:
      return <Revolver />
  }
}
