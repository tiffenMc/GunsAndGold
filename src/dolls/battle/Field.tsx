import { useFrame } from '@react-three/fiber'
import { memo, useMemo, useRef } from 'react'
import { CanvasTexture, DoubleSide, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { BOX, Baked, CONE, CYL, P } from '../dollParts'
import type { ScenarioDef } from '../scenes/scenarios'
import { Scenery } from '../scenes/Scenery'
import { DEPLOY_BACK, DEPLOY_FRONT, FIELD_L, FIELD_W, FIRE_LINE, FORT_R, FORT_Z } from './engine'
import type { Battle, Side } from './engine'
import { Model } from '../scenes/models'

export const SIDE_COLOR: Record<Side, string> = { 0: '#38bdf8', 1: '#ef4444' }

/** Suelo neutro con granos y manchas: el color lo pone cada escenario. */
function groundTexture(): CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e4e4e4'
  ctx.fillRect(0, 0, size, size)
  // Granos y manchas de arena.
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const light = Math.random() < 0.5
    ctx.fillStyle = light ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.13)'
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2)
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 10 + Math.random() * 30
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r)
    grad.addColorStop(0, 'rgba(0,0,0,0.1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  // La repeticion del grano sigue la largura del campo, para no verlo estirado.
  tex.repeat.set(8, Math.round(14 * (FIELD_L / 26)))
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Valla de palos a los lados del campo (todo en una sola malla: no se mueve). */
function Fence({ x }: { x: number }) {
  const posts = Math.floor(FIELD_L / 1.6) + 1
  return (
    <group position={[x, 0, 0]}>
      <Baked standard bakeKey="valla">
        {Array.from({ length: posts }).map((_, i) => (
          <P key={i} g={BOX} color="#6b4423" s={[0.12, 0.7, 0.12]} p={[0, 0.35, -FIELD_L / 2 + i * 1.6]} />
        ))}
        {[0.25, 0.52].map((y) => (
          <P key={y} g={BOX} color="#7a5230" s={[0.06, 0.08, FIELD_L]} p={[0, y, 0]} />
        ))}
      </Baked>
    </group>
  )
}

/** Fuerte de troncos con torreta y bandera del color de su lado. */
function Fort({ side, battle }: { side: Side; battle: Battle }) {
  const group = useRef<Group>(null)
  const flag = useRef<Group>(null)
  const lastHits = useRef(0)
  const shake = useRef(0)
  const z = side === 0 ? FORT_Z : -FORT_Z
  const color = SIDE_COLOR[side]
  const logs = 14
  // La casa es pequeña: se encoge entera, y el circulo de troncos se separa para que su radio
  // siga siendo FORT_R (que es donde de verdad le dan los tiros).
  const scale = 0.7
  const ring = FORT_R / scale

  useFrame((state, dt) => {
    const fort = battle.forts[side]
    if (fort.hitCount !== lastHits.current) {
      lastHits.current = fort.hitCount
      shake.current = 0.35
    }
    shake.current = Math.max(0, shake.current - dt)
    if (group.current) {
      const k = shake.current * 0.35
      group.current.position.x = Math.sin(state.clock.elapsedTime * 60) * k
      const ruined = fort.hp <= 0
      group.current.rotation.z = ruined ? 0.12 : 0
      group.current.position.y = ruined ? -0.4 : 0
    }
    if (flag.current) flag.current.rotation.y = Math.sin(state.clock.elapsedTime * 3 + side) * 0.3
  })

  return (
    <group position={[0, 0, z]}>
      <group ref={group} scale={scale}>
        {/* Todo lo que no se mueve del fuerte, en una sola malla */}
        <Baked standard bakeKey={`fuerte|${side}`}>
          {/* Empalizada en circulo */}
          {Array.from({ length: logs }).map((_, i) => {
            const a = (i / logs) * Math.PI * 2
            const h = 1.5 + ((i * 37) % 5) * 0.08
            const px = Math.cos(a) * ring
            const pz = Math.sin(a) * ring
            return (
              <group key={i}>
                <P g={CYL} color={i % 2 === 0 ? '#7a4a26' : '#6b3f1f'} s={[0.21, h, 0.21]} p={[px, h / 2, pz]} />
                <P g={CONE} color="#5a3a20" s={[0.2, 0.25, 0.2]} p={[px, h + 0.1, pz]} />
              </group>
            )
          })}
          {/* Torreta central */}
          <P g={BOX} color="#8a5a2b" s={[1.5, 2.2, 1.5]} p={[0, 1.1, 0]} />
          <P g={BOX} color="#5a3a20" s={[1.9, 0.3, 1.9]} p={[0, 2.35, 0]} />
          <P g={CONE} color="#4a2c14" s={[1.45, 0.8, 1.45]} p={[0, 2.85, 0]} r={[0, Math.PI / 4, 0]} />
          {/* Franja del color del equipo */}
          <P g={BOX} color={color} s={[1.54, 0.22, 1.54]} p={[0, 1.7, 0]} />
          {/* Mastil */}
          <P g={CYL} color="#3a2a1a" s={[0.04, 1.6, 0.04]} p={[0, 3.6, 0]} />
        </Baked>
        {/* La bandera ondea: va suelta */}
        <group ref={flag} position={[0, 4.1, 0]}>
          <P g={BOX} color={color} s={[0.7, 0.42, 0.03]} p={[0.35, 0, 0]} />
        </group>
      </group>
    </group>
  )
}

/**
 * Vagoneta neutral de oro: ambas cuadrillas la atacan y su ultimo golpe da dinamita.
 * Los primeros segundos lleva un **escudo** (no se la puede tocar): se ve la cupula y el aro, y
 * late, para que quede claro que aun no vale dispararle.
 */
function MineCartView({ battle }: { battle: Battle }) {
  const cart = battle.cart
  const cupula = useRef<Mesh>(null)
  const aro = useRef<Mesh>(null)
  useFrame((state) => {
    const d = cupula.current
    const r = aro.current
    if (!d || !r) return
    const protegida = Boolean(battle.cart && battle.time < battle.cart.shieldUntil)
    d.visible = protegida
    r.visible = protegida
    if (!protegida) return
    const latido = 0.6 + Math.sin(state.clock.elapsedTime * 4.5) * 0.25
    ;(d.material as MeshBasicMaterial).opacity = latido * 0.3
    ;(r.material as MeshBasicMaterial).opacity = latido * 0.85
  })
  if (!cart) return null
  return (
    <group position={[cart.x, 0.08, cart.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.65, 1.9, 48]} />
        <meshBasicMaterial color="#ffca55" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
      </mesh>
      <Model m="Prop_Cart_01" x={0} z={0} s={1.5} r={90} />
      {/* Senal de oro que flota sobre la vagoneta: sin rotulos DOM dentro del lienzo. */}
      <mesh position={[0, 2.5, 0]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 1.6, 8]} />
        <meshBasicMaterial color="#ffb020" transparent opacity={0.6} toneMapped={false} />
      </mesh>

      {/* El escudo de los primeros segundos: cupula, aro en el suelo y sus reflejos. */}
      <mesh ref={cupula} position={[0, 1.15, 0]}>
        <sphereGeometry args={[2.15, 24, 16]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.25}
          side={DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={aro} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.05, 2.35, 48]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** La linea de fuego: una cuerda tensada delante de tu fuerte, de donde salen tus balas. */
function FireLine({ bright }: { bright: boolean }) {
  const posts = 8
  return (
    <group position={[0, 0, FIRE_LINE]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <planeGeometry args={[FIELD_W, bright ? 0.2 : 0.08]} />
        <meshBasicMaterial color={bright ? '#7dd3fc' : '#e8d9b0'} transparent opacity={bright ? 0.95 : 0.45} depthWrite={false} toneMapped={false} />
      </mesh>
      <Baked standard bakeKey="postes-de-la-raya">
        {Array.from({ length: posts }).map((_, i) => (
          <P key={i} g={CYL} color="#6b4423" s={[0.055, 0.24, 0.055]} p={[-FIELD_W / 2 + 0.3 + (i * (FIELD_W - 0.6)) / (posts - 1), 0.12, 0]} />
        ))}
      </Baked>
    </group>
  )
}

/**
 * Los campos del suelo (fuego, gas, cepos, circulos de balas): un disco que late mientras dura y se
 * apaga al acabarse. Hay un monton fijo de discos que se reutilizan, para no crear nada en plena batalla.
 */
const CAMPOS_MAX = 8
function CamposView({ battle }: { battle: Battle }) {
  const mallas = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (let i = 0; i < CAMPOS_MAX; i++) {
      const malla = mallas.current[i]
      if (!malla) continue
      const campo = battle.campos[i]
      if (!campo) {
        malla.visible = false
        continue
      }
      malla.visible = true
      malla.position.set(campo.x, 0.03, campo.z)
      const resta = Math.max(0, campo.until - battle.time)
      const pulso = 1 + Math.sin(t * 6 + i) * 0.04
      malla.scale.setScalar(campo.radio * pulso)
      const material = malla.material as MeshBasicMaterial
      material.color.set(campo.color)
      material.opacity = Math.min(0.42, resta * 0.25) * (0.75 + Math.sin(t * 9 + i * 2) * 0.25)
    }
  })
  return (
    <group>
      {Array.from({ length: CAMPOS_MAX }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            mallas.current[i] = el
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <circleGeometry args={[1, 28]} />
          <meshBasicMaterial color="#fb923c" transparent opacity={0} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export const Field = memo(function Field({
  battle,
  scenario,
  deploying,
  aiming = false,
  onReady,
}: {
  battle: Battle
  scenario: ScenarioDef
  deploying: boolean
  aiming?: boolean
  onReady?: () => void
}) {
  const ground = useMemo(() => groundTexture(), [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[90, 130]} />
        <meshStandardMaterial map={ground} color={scenario.outside} roughness={1} />
      </mesh>
      {/* El campo de juego, un poco mas claro */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FIELD_W, FIELD_L]} />
        <meshStandardMaterial map={ground} color={scenario.field} roughness={1} />
      </mesh>
      {/* Tu mitad se ilumina cuando llevas una carta de batalla */}
      {deploying && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, (DEPLOY_FRONT + DEPLOY_BACK) / 2]}>
          <planeGeometry args={[FIELD_W - 0.5, DEPLOY_BACK - DEPLOY_FRONT]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <FireLine bright={aiming} />
      <Fence x={-FIELD_W / 2 - 0.35} />
      <Fence x={FIELD_W / 2 + 0.35} />
      <Fort side={0} battle={battle} />
      <Fort side={1} battle={battle} />
      {!battle.practice && <MineCartView battle={battle} />}
      <CamposView battle={battle} />
      <Scenery scenario={scenario} onReady={onReady} />
    </group>
  )
})
