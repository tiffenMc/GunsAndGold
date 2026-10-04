import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Mesh, Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Group, Material, Points } from 'three'
import { FIELD_W } from '../battle/engine'
import { Mat } from '../dollParts'
import { Model } from './models'
import { DECOR_STRETCH, stretchPlacementX } from './scenarios'
import type { ScenarioDef } from './scenarios'

// ---------------------------------------------------------------------------
// La raya del centro, distinta en cada escenario
// ---------------------------------------------------------------------------

function Strip({ color, width, opacity = 1, y = 0.012 }: { color: string; width: number; opacity?: number; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[FIELD_W + 10, width]} />
      <meshStandardMaterial color={color} roughness={1} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  )
}

function Divider({ scenario }: { scenario: ScenarioDef }) {
  switch (scenario.divider) {
    case 'vias':
      return (
        <group>
          <Strip color="#8b6a44" width={2.4} />
          {[-19.5, -13, -6.5, 0, 6.5, 13].map((x) => (
            <Model key={x} m="Env_Train_Track_Straight_01" x={x} z={0} r={90} />
          ))}
        </group>
      )
    case 'rieles-mina':
      return (
        <group>
          <Strip color="#6d5a45" width={2} />
          {[-9, -6, -3, 0, 3, 6, 9].map((x) => (
            <Model key={x} m="Env_Mine_Track_Straight_01" x={x} z={0} r={90} />
          ))}
        </group>
      )
    case 'hielo':
      return (
        <group>
          <Strip color="#ffffff" width={2.3} y={0.01} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[FIELD_W + 10, 1.5]} />
            <meshStandardMaterial color="#9fd0ea" roughness={0.15} metalness={0.2} />
          </mesh>
          {[-4, -1.5, 2, 4.5].map((x, i) => (
            <mesh key={x} position={[x, 0.05, (i % 2 ? 0.3 : -0.35)]} rotation={[-Math.PI / 2, 0, i]}>
              <circleGeometry args={[0.28 + (i % 3) * 0.08, 6]} />
              <meshStandardMaterial color="#e8f6ff" roughness={0.3} />
            </mesh>
          ))}
        </group>
      )
    case 'calle':
      return (
        <group>
          <Strip color="#8d6a45" width={2.2} />
          {[-0.5, 0.5].map((z) => (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
              <planeGeometry args={[FIELD_W + 10, 0.16]} />
              <meshStandardMaterial color="#6b4d30" roughness={1} />
            </mesh>
          ))}
          {/* Tablones para cruzar la calle */}
          {Array.from({ length: 5 }).map((_, i) => (
            <mesh key={i} position={[-4 + i * 2, 0.05, 0]}>
              <boxGeometry args={[0.9, 0.06, 2.4]} />
              <Mat color={i % 2 ? '#8a5a2b' : '#7a4a26'} />
            </mesh>
          ))}
        </group>
      )
    default:
      // Arroyo seco: una zanja de tierra mas oscura con piedras.
      return (
        <group>
          <Strip color="#b88450" width={2} />
          <Strip color="#a2733f" width={1.1} y={0.016} />
          {[-4.2, -2.4, -0.6, 1.3, 3.1, 4.6].map((x, i) => (
            <mesh key={x} position={[x, 0.08, i % 2 ? 0.35 : -0.3]} rotation={[0.3, x, 0.2]} scale={[1, 0.6, 0.8]}>
              <dodecahedronGeometry args={[0.16 + (i % 3) * 0.05, 0]} />
              <Mat color="#8a6a4a" />
            </mesh>
          ))}
        </group>
      )
  }
}

// ---------------------------------------------------------------------------
// Efectos que dan vida
// ---------------------------------------------------------------------------

/** El tren cruza por el fondo de vez en cuando. */
function PassingTrain() {
  const group = useRef<Group>(null)
  const clock = useRef(4)
  useFrame((_, dt) => {
    clock.current += Math.min(0.05, dt)
    const cycle = 24
    const t = clock.current % cycle
    if (group.current) {
      const moving = t < 14
      group.current.visible = moving
      group.current.position.x = 48 - (t / 14) * 110
    }
  })
  const s = 0.8
  const cars: [string, number][] = [
    ['Veh_Train_01', 12.5],
    ['Veh_Train_Coal_01', 7.6],
    ['Veh_Train_Carriage_01', 17.3],
    ['Veh_Train_Freight_01', 13.9],
  ]
  let at = 0
  return (
    <group ref={group} position={[48, 0.25, -16.5 * DECOR_STRETCH]}>
      {cars.map(([name, length], i) => {
        const x = at + (length * s) / 2
        at += length * s + 0.4
        // Los vagones miden a lo largo de Z: se giran para ir de lado. La locomotora, delante.
        return <Model key={i} m={name} x={x} z={0} r={-90} s={s} />
      })}
    </group>
  )
}

/** Plantas rodadoras que cruzan por el fondo. */
function Tumbleweeds() {
  const refs = useRef<(Group | null)[]>([])
  const state = useRef([
    { t: 0, wait: 2, z: -14.2 * DECOR_STRETCH, dir: 1 },
    { t: 0, wait: 8, z: 13.6 * DECOR_STRETCH, dir: -1 },
  ])
  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    state.current.forEach((s, i) => {
      const g = refs.current[i]
      if (!g) return
      if (s.wait > 0) {
        s.wait -= dt
        g.visible = false
        return
      }
      s.t += dt
      const x = -12 * s.dir + s.t * 3.2 * s.dir
      g.visible = true
      g.position.set(x, 0.3 + Math.abs(Math.sin(s.t * 5)) * 0.35, s.z + Math.sin(s.t * 1.3) * 0.4)
      g.rotation.z = -s.t * 6 * s.dir
      if (Math.abs(x) > 13) {
        s.t = 0
        s.wait = 6 + Math.random() * 8
      }
    })
  })
  return (
    <>
      {[0, 1].map((i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
        >
          <Model m="Prop_Tumbleweed_01" x={0} z={0} s={1.3} y={-0.3} />
        </group>
      ))}
    </>
  )
}

/** Particulas: copos de nieve que caen o polvo que flota. */
function Particles({ kind }: { kind: 'nieve' | 'polvo' }) {
  const points = useRef<Points>(null)
  const count = kind === 'nieve' ? 900 : 260
  const { geometry, speeds } = useMemo(() => {
    const g = new BufferGeometry()
    const pos = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20
      pos[i * 3 + 1] = Math.random() * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 36 * DECOR_STRETCH - 2
      speeds[i] = 0.5 + Math.random()
    }
    g.setAttribute('position', new BufferAttribute(pos, 3))
    return { geometry: g, speeds }
  }, [count])
  useEffect(() => () => geometry.dispose(), [geometry])
  useFrame((state, raw) => {
    const dt = Math.min(0.05, raw)
    const attr = geometry.getAttribute('position') as BufferAttribute
    const arr = attr.array as Float32Array
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      const sp = speeds[i]!
      if (kind === 'nieve') {
        arr[i * 3 + 1] -= dt * 1.2 * sp
        arr[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.3
        if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 10
      } else {
        arr[i * 3] += dt * 0.25 * sp
        arr[i * 3 + 1] += Math.sin(t * 0.5 + i) * dt * 0.05
        if (arr[i * 3] > 10) arr[i * 3] = -10
      }
    }
    attr.needsUpdate = true
  })
  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={kind === 'nieve' ? '#ffffff' : '#e8d2a8'}
        size={kind === 'nieve' ? 0.11 : 0.07}
        transparent
        opacity={kind === 'nieve' ? 0.9 : 0.45}
        depthWrite={false}
      />
    </points>
  )
}

// ---------------------------------------------------------------------------
// Escenario completo (sin el suelo, que lo pinta el campo)
// ---------------------------------------------------------------------------

/**
 * El decorado no se mueve: en cuanto carga, sus cientos de piezas se **funden por material** (el
 * pack usa dos atlas, asi que quedan un par de mallas). Es lo que mas aliviaba al movil.
 */
export function fundirDecorado(root: Group) {
  root.updateWorldMatrix(true, true)
  const inversa = new Matrix4().copy(root.matrixWorld).invert()
  const porMaterial = new Map<Material, { geos: BufferGeometry[]; originales: Mesh[] }>()
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.visible || Array.isArray(mesh.material) || !mesh.geometry) return
    const grupo = porMaterial.get(mesh.material) ?? { geos: [], originales: [] }
    const geometria = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    // Solo lo que se comparte entre todas las piezas: sitio, normal y textura.
    for (const nombre of Object.keys(geometria.attributes)) {
      if (nombre !== 'position' && nombre !== 'normal' && nombre !== 'uv') geometria.deleteAttribute(nombre)
    }
    geometria.applyMatrix4(new Matrix4().multiplyMatrices(inversa, mesh.matrixWorld))
    grupo.geos.push(geometria)
    grupo.originales.push(mesh)
    porMaterial.set(mesh.material, grupo)
  })
  for (const [material, grupo] of porMaterial) {
    if (grupo.geos.length < 2) continue
    const fundida = mergeGeometries(grupo.geos, false)
    for (const g of grupo.geos) g.dispose()
    if (!fundida) continue
    for (const original of grupo.originales) original.visible = false
    const malla = new Mesh(fundida, material)
    malla.frustumCulled = false
    root.add(malla)
  }
}

function Props({ scenario, onReady }: { scenario: ScenarioDef; onReady?: () => void }) {
  const decorado = useRef<Group>(null)
  useEffect(() => {
    // Los modelos ya han cargado (esto va dentro del Suspense): se funde el decorado de una vez.
    if (decorado.current) fundirDecorado(decorado.current)
    onReady?.()
    // Solo al terminar de cargar este escenario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id])
  return (
    <>
      <group ref={decorado}>
        {scenario.props.map((p, i) => (
          <Model
            key={`${p.m}-${i}`}
            {...p}
            x={stretchPlacementX(p.x)}
            z={p.z * DECOR_STRETCH}
            snow={scenario.snow}
          />
        ))}
      </group>
      <Divider scenario={scenario} />
      {scenario.fx === 'tren' && <PassingTrain />}
      {scenario.fx === 'rodadores' && <Tumbleweeds />}
    </>
  )
}

export function Scenery({ scenario, onReady }: { scenario: ScenarioDef; onReady?: () => void }) {
  return (
    <>
      <Suspense fallback={null}>
        <Props scenario={scenario} onReady={onReady} />
      </Suspense>
      {scenario.fx === 'nieve' && <Particles kind="nieve" />}
      {scenario.fx === 'polvo' && <Particles kind="polvo" />}
    </>
  )
}
