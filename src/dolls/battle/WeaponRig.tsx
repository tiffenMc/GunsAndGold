import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Group } from 'three'
import { WeaponModel } from '../card3d/WeaponModel'
import type { ShotMode, WeaponModel as WeaponModelId } from '../cards/model'
import { Mat } from '../dollParts'
import { FIRE_LINE } from './engine'
import type { Side } from './engine'
import type { RibbonData } from './Effects'

/**
 * Como se porta cada arma al disparar: el fogonazo, el humo, las vainas, la sacudida y el
 * culatazo. Es lo que hace que la escopeta no se sienta como el revolver sin modelar nada nuevo.
 */
export function muzzleProfile(mode: ShotMode): { flash: number; smoke: number; shells: number; shake: number; kick: number } {
  switch (mode) {
    case 'perdigones':
      return { flash: 1.2, smoke: 2, shells: 2, shake: 0.95, kick: 1.1 }
    case 'perforante':
      return { flash: 0.65, smoke: 1, shells: 0, shake: 0.5, kick: 0.8 }
    case 'rafaga':
      return { flash: 0.5, smoke: 0, shells: 2, shake: 0.35, kick: 0.3 }
    case 'explosivo':
      // La carga se lanza: ni fogonazo ni vaina, solo el humo del brazo.
      return { flash: 0, smoke: 1, shells: 0, shake: 0.4, kick: 0.5 }
    default:
      return { flash: 0.8, smoke: 1, shells: 1, shake: 0.55, kick: 0.75 }
  }
}

/**
 * El arma tira **siempre recto**: su cañon (el +X del modelo) mira al fuerte rival, o sea a -z.
 * Al no girar nunca, se puede montar de perfil y se lee como lo que es.
 */
export const GUN_YAW = Math.PI / 2

/**
 * El arma va en un tripode delante de tu raya: baja y adelantada a proposito, porque si se queda
 * justo encima el tejado del fuerte la tapa.
 *
 * El arma descansa **algo atravesada y con el cañon alto**: apuntando de frente a esta camara solo
 * se le ve el culo, y de esta guisa se le distingue la silueta entera (cañon, tambor, culata), que
 * es lo que la gente reconoce del modelo. Sigue tirando recto.
 */
const RIG_Y = 0.85
const GUN_SCALE = 3.6
/** Lo atravesada que descansa respecto a la linea de tiro. */
const YAW_OFF = 0.6
const ELEV = 0.2
/** Del eje del arma a la punta del cañon. */
const TIP = 1.5
/**
 * Cuanto asoma la boca por delante del eje. El fogonazo sale en **el carril del disparo** (la misma
 * vertical que la bala y que el hilo del alcance), no en la punta torcida del cañon: asi se ve de
 * donde sale el tiro de verdad.
 */
const TIP_FWD = TIP * Math.cos(YAW_OFF) * Math.cos(ELEV)
const TIP_UP = RIG_Y + TIP * Math.sin(ELEV)
/**
 * Donde se planta el arma: **detras de la casa**, pegada al margen, con la boca justo encima de la
 * raya (que es donde nacen las balas). Desde ahi la casa la tapa de los tiros y no le da nadie.
 */
const RIG_Z = FIRE_LINE + TIP_FWD

/** Altura de la boca: de aqui salen el fogonazo y las vainas. */
export const WEAPON_Y = TIP_UP

/** Las tres patas del tripode. */
const LEGS: [number, number][] = [
  [-0.42, 0.34],
  [0.42, 0.34],
  [0, -0.58],
]

/**
 * El arma de verdad, montada en su nido delante de tu raya: la carta que llevas en la mano es la
 * que dispara. Se desliza por la raya siguiendo el dedo (nunca entra en el campo rival), acusa el
 * retroceso y lleva la municion a la vista. No gira: siempre tira recto.
 */
export function WeaponRig({
  side = 0,
  model,
  uses,
  maxUses,
  accent,
  aimX,
  recoil,
  burst,
  muzzle,
  reach,
  reachRange,
  showReach,
}: {
  /** 0 = la tuya (abajo), 1 = la del rival (arriba, espejada). */
  side?: Side
  model: WeaponModelId | null
  uses: number
  maxUses: number
  accent: string
  /** Donde esta el arma por la raya (null = en reposo, en el centro). */
  aimX: MutableRefObject<number | null>
  /** Retroceso pendiente: se gasta solo. */
  recoil: MutableRefObject<number>
  /** Segundos de traqueteo (rafaga de la gatling). */
  burst: MutableRefObject<number>
  /** Donde esta la boca del arma en cada fotograma: ahi va el fogonazo. */
  muzzle: MutableRefObject<{ x: number; z: number } | null>
  /** Hilo fino en el suelo: hasta donde llega el arma. Solo mientras apuntas. */
  reach?: MutableRefObject<RibbonData>
  reachRange?: number
  showReach?: boolean
}) {
  const root = useRef<Group>(null)
  const kick = useRef<Group>(null)
  const endMark = useRef<Group>(null)
  const at = useRef(0)
  const enter = useRef(1)
  const last = useRef<WeaponModelId | null>(null)
  /** +1 el tuyo (abajo), -1 el del rival (arriba): todo va espejado. */
  const flip = side === 0 ? 1 : -1

  useFrame((state, dt) => {
    const g = root.current
    const k = kick.current
    if (!g || !k) return
    g.visible = model !== null
    if (model === null) {
      // Sin arma no hay ni alcance ni punta que marcar.
      if (reach) reach.current.visible = false
      if (endMark.current) endMark.current.visible = false
      return
    }

    // Cada arma nueva cae hasta su sitio.
    if (last.current !== model) {
      last.current = model
      enter.current = 0
    }
    enter.current = Math.min(1, enter.current + dt / 0.4)
    const ease = 1 - (1 - enter.current) ** 3

    // Corre por la raya detras del dedo.
    const target = aimX.current ?? 0
    at.current += (target - at.current) * Math.min(1, dt * 14)
    g.position.set(at.current, 0, flip * RIG_Z)

    muzzle.current = { x: at.current, z: flip * (RIG_Z - TIP_FWD) }

    // El alcance: un hilo discontinuo en el suelo, recto, solo mientras apuntas.
    const showLine = Boolean(showReach && aimX.current !== null)
    if (reach) {
      const d = reach.current
      d.visible = showLine
      d.color = accent
      const a = d.points[0]
      const b = d.points[1]
      if (a && b && showLine) {
        a.x = at.current
        a.z = flip * (RIG_Z - TIP_FWD)
        b.x = at.current
        b.z = flip * (RIG_Z - TIP_FWD - (reachRange ?? 0))
      }
    }
    const end = endMark.current
    if (end) {
      end.visible = showLine
      if (showLine) end.position.set(0, 0.06, flip * (TIP_FWD + (reachRange ?? 0)))
    }

    // Retroceso: se echa para atras y levanta la boca. La rafaga ademas tirita.
    recoil.current = Math.max(0, recoil.current - dt * 4.2)
    burst.current = Math.max(0, burst.current - dt)
    const r = recoil.current
    k.position.z = r * 0.5 * flip
    k.position.y = (1 - ease) * 1.1 + (burst.current > 0 ? Math.sin(state.clock.elapsedTime * 90) * 0.02 : 0)
    k.rotation.x = r * 0.4 * flip
  })

  return (
    <group ref={root}>
      {/* El aro del color de la carta, plano en el suelo: marca cual es la tuya sin rarezas. */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.85, 1.05, 28]} />
        <meshBasicMaterial color={accent} transparent opacity={0.35} toneMapped={false} depthWrite={false} />
      </mesh>

      {/* El tripode: tres patas y la horquilla donde va montada. */}
      {LEGS.map(([lx, lz], i) => (
        <mesh
          key={i}
          position={[lx / 2, RIG_Y / 2, lz / 2]}
          rotation={[Math.atan2(lz, RIG_Y), 0, -Math.atan2(lx, RIG_Y)]}
        >
          <cylinderGeometry args={[0.05, 0.065, Math.hypot(lx, lz, RIG_Y), 6]} />
          <Mat color="#4a3520" rough={0.9} />
        </mesh>
      ))}
      <mesh position={[0, RIG_Y - 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.42, 8]} />
        <Mat color="#39414f" metal={0.8} rough={0.35} />
      </mesh>

      {/* El modelo ya existe: es el mismo que ves dentro de la carta, grande y de perfil. */}
      <group ref={kick} position={[0, RIG_Y, 0]}>
        <group rotation={[0, flip * (GUN_YAW + YAW_OFF), 0]}>
          <group rotation={[0, 0, ELEV]}>
            <group scale={GUN_SCALE}>
              <WeaponModel model={model ?? 'revolver'} />
            </group>
          </group>
        </group>
      </group>

      {/* La municion que le queda, a la vista. */}
      <group position={[0, WEAPON_Y + 0.45, 0]}>
        {Array.from({ length: maxUses }).map((_, i) => (
          <mesh key={i} position={[(i - (maxUses - 1) / 2) * 0.34, 0, 0]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color={i < uses ? accent : '#2b2118'} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Donde acaba el alcance. */}
      <group ref={endMark} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.34, 22]} />
          <meshBasicMaterial color={accent} transparent opacity={0.6} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
