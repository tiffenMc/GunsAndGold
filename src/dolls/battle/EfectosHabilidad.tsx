import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { Battle } from './engine'
import { posicionDe } from './habilidades'
import type { Efecto } from './habilidades'

/**
 * **Lo que se ve de las habilidades**: zonas en el suelo (lluvia de balas, fuego, gas, cura,
 * estandarte, sueño, imán, manos, red, portal), proyectiles (red, dinamita, granadas, frascos,
 * barriles, rocas, cuervos, cuchillos, flechas, bumeranes, toros, bayonetas), láseres, rayos,
 * lazos, conos de fuego y ondas, columnas de luz y la ruleta del tahúr.
 *
 * Lee `battle.efectos` cada fotograma: el motor los mueve y aquí solo se pintan.
 */
export function HabilidadesLayer({ battle }: { battle: Battle }) {
  const [lista, setLista] = useState<Efecto[]>([])
  const firma = useRef('')
  // En desarrollo, la escena a mano para revisar los efectos desde la consola.
  const escena = useThree((state) => state.scene)
  if (import.meta.env.DEV) Object.assign(window, { __escena3d: escena })
  useFrame(() => {
    const ahora = battle.efectos
    const f = ahora.length === 0 ? '' : `${ahora.length}:${ahora[0]!.id}:${ahora[ahora.length - 1]!.id}`
    if (f !== firma.current) {
      firma.current = f
      setLista([...ahora])
    }
  })
  return (
    <>
      {lista.map((e) => (
        <EfectoItem key={e.id} e={e} battle={battle} />
      ))}
    </>
  )
}

function EfectoItem({ e, battle }: { e: Efecto; battle: Battle }) {
  switch (e.k) {
    case 'zona':
      return <Zona e={e} battle={battle} />
    case 'proy':
      return <Proyectil e={e} battle={battle} />
    case 'linea':
      return <Linea e={e} battle={battle} />
    case 'cono':
      return <Cono e={e} battle={battle} />
    case 'pilar':
      return <Pilar e={e} battle={battle} />
    case 'onda':
      return <Onda e={e} battle={battle} />
    case 'ruleta':
      return <RuletaTahur e={e} battle={battle} />
  }
}

const brillo = { transparent: true, depthWrite: false, toneMapped: false } as const

/** Cuanto lleva (0-1) y cuanto le queda para irse (se desvanece al final). */
function vida(battle: Battle, desde: number, hasta: number) {
  const k = Math.min(1, Math.max(0, (battle.time - desde) / Math.max(0.01, hasta - desde)))
  const fuera = Math.min(1, (hasta - battle.time) / 0.3)
  const dentro = Math.min(1, (battle.time - desde) / 0.15)
  return { k, alfa: Math.max(0, Math.min(fuera, dentro)) }
}

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------

/** Unos puntos repartidos por el circulo (siempre los mismos para cada zona). */
function puntos(n: number, r: number, semilla: number) {
  const lista: { x: number; z: number; f: number }[] = []
  let s = semilla * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2
    const d = Math.sqrt(rnd()) * r * 0.9
    lista.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, f: rnd() })
  }
  return lista
}

function Zona({ e, battle }: { e: Extract<Efecto, { k: 'zona' }>; battle: Battle }) {
  const grupo = useRef<Group>(null)
  const disco = useRef<MeshBasicMaterial>(null)
  const aro = useRef<Mesh>(null)
  const aroMat = useRef<MeshBasicMaterial>(null)
  const extras = useRef<Group>(null)
  const pts = useMemo(() => puntos(e.estilo === 'balas' ? 22 : e.estilo === 'manos' ? 8 : 10, e.r, e.id), [e.estilo, e.r, e.id])

  useFrame(() => {
    const g = grupo.current
    if (!g) return
    g.position.set(e.x, 0, e.z)
    const { k, alfa } = vida(battle, e.desde, e.hasta)
    const t = battle.time
    if (disco.current) disco.current.opacity = (e.estilo === 'aviso' ? 0.2 + k * 0.45 : 0.32) * alfa
    if (aroMat.current) aroMat.current.opacity = 0.95 * alfa
    if (aro.current) {
      // El aviso late cada vez mas rapido; el iman y el portal giran.
      const late = e.estilo === 'aviso' ? 1 + Math.sin(t * (10 + k * 30)) * 0.05 : 1 + Math.sin(t * 4) * 0.03
      aro.current.scale.setScalar(late)
      aro.current.rotation.z = e.estilo === 'iman' || e.estilo === 'portal' ? t * 3 : 0
    }
    const x = extras.current
    if (!x) return
    x.children.forEach((hijo, i) => {
      const p = pts[i % pts.length]!
      const fase = (t * 1.6 + p.f) % 1
      switch (e.estilo) {
        case 'balas': {
          // Las balas caen del cielo una tras otra y, al llegar, salta una chispa en el suelo.
          const f2 = (t * 2.2 + p.f) % 1
          const bala = hijo.children[0]!
          const chispa = hijo.children[1]!
          hijo.position.set(p.x, 0, p.z)
          bala.position.y = 7 * (1 - f2)
          bala.visible = alfa > 0.05 && f2 < 0.92
          chispa.visible = alfa > 0.05 && f2 > 0.85
          chispa.scale.setScalar(0.5 + (f2 - 0.85) * 8)
          break
        }
        case 'fuego': {
          hijo.position.set(p.x, 0.4, p.z)
          hijo.scale.set(1, 0.7 + Math.sin(t * 14 + i) * 0.35, 1)
          break
        }
        case 'gas':
        case 'sueno': {
          hijo.position.set(p.x * (0.8 + 0.2 * Math.sin(t + i)), 0.6 + fase * 1.8, p.z)
          hijo.scale.setScalar(0.6 + fase * 0.8)
          ;((hijo as Mesh).material as MeshBasicMaterial).opacity = (1 - fase) * 0.5 * alfa
          break
        }
        case 'cura':
        case 'ronda': {
          hijo.position.set(p.x, fase * 3, p.z)
          ;((hijo as Mesh).material as MeshBasicMaterial).opacity = (1 - fase) * alfa
          break
        }
        case 'manos': {
          // Salen del suelo, agarran y se hunden.
          const sube = Math.min(1, (t - e.desde) * 3) * Math.min(1, (e.hasta - t) * 2)
          hijo.position.set(p.x, -0.6 + sube * 0.9 + Math.sin(t * 6 + i) * 0.05, p.z)
          hijo.rotation.z = Math.sin(t * 5 + i) * 0.3
          break
        }
        case 'iman': {
          const a = -t * 4 + i * ((Math.PI * 2) / pts.length)
          const d = e.r * (1 - fase)
          hijo.position.set(Math.cos(a) * d, 0.3, Math.sin(a) * d)
          break
        }
        default:
          break
      }
    })
  })

  const color = e.estilo === 'aviso' ? '#ef4444' : e.color
  return (
    <group ref={grupo}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <circleGeometry args={[e.r, 40]} />
        <meshBasicMaterial ref={disco} color={color} {...brillo} opacity={0.2} />
      </mesh>
      <mesh ref={aro} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[e.r - 0.26, e.r, 56, 1, 0, e.estilo === 'iman' || e.estilo === 'portal' ? Math.PI * 1.6 : Math.PI * 2]} />
        <meshBasicMaterial ref={aroMat} color={color} {...brillo} side={DoubleSide} />
      </mesh>
      <group ref={extras}>
        {e.estilo === 'balas' &&
          pts.map((_, i) => (
            <group key={i}>
              <mesh>
                <boxGeometry args={[0.13, 1.1, 0.13]} />
                <meshBasicMaterial color="#fff3c4" toneMapped={false} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
                <circleGeometry args={[0.35, 10]} />
                <meshBasicMaterial color="#fde047" {...brillo} opacity={0.9} blending={AdditiveBlending} />
              </mesh>
            </group>
          ))}
        {e.estilo === 'fuego' &&
          pts.map((_, i) => (
            <mesh key={i}>
              <coneGeometry args={[0.3, 0.9, 6]} />
              <meshBasicMaterial color={i % 2 ? '#f97316' : '#fde047'} {...brillo} opacity={0.85} blending={AdditiveBlending} />
            </mesh>
          ))}
        {(e.estilo === 'gas' || e.estilo === 'sueno') &&
          pts.map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.55, 10, 8]} />
              <meshBasicMaterial color={e.color} {...brillo} opacity={0.4} />
            </mesh>
          ))}
        {(e.estilo === 'cura' || e.estilo === 'ronda') &&
          pts.map((_, i) => (
            <group key={i}>
              <mesh>
                <boxGeometry args={[0.32, 0.1, 0.1]} />
                <meshBasicMaterial color={e.color} {...brillo} />
              </mesh>
            </group>
          ))}
        {e.estilo === 'manos' &&
          pts.map((_, i) => (
            <group key={i}>
              <mesh position={[0, 0.25, 0]}>
                <boxGeometry args={[0.22, 0.6, 0.18]} />
                <meshStandardMaterial color="#6b8f71" roughness={0.9} />
              </mesh>
              {[-0.08, 0, 0.08].map((dx) => (
                <mesh key={dx} position={[dx, 0.62, 0]}>
                  <boxGeometry args={[0.05, 0.22, 0.05]} />
                  <meshStandardMaterial color="#7fa585" roughness={0.9} />
                </mesh>
              ))}
            </group>
          ))}
        {e.estilo === 'iman' &&
          pts.map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.12, 6, 6]} />
              <meshBasicMaterial color={e.color} toneMapped={false} />
            </mesh>
          ))}
      </group>
      {/* Lo que va en el centro: el estandarte, el barril, la red, el portal */}
      {(e.estilo === 'estandarte' || e.estilo === 'ronda') && <Estandarte color={e.color} barril={e.estilo === 'ronda'} />}
      {e.estilo === 'red' && <RedEnElSuelo r={e.r} />}
      {e.estilo === 'portal' && <Portal color={e.color} />}
      {e.estilo === 'sueno' && <Zetas color={e.color} />}
    </group>
  )
}

function Estandarte({ color, barril }: { color: string; barril: boolean }) {
  const tela = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (tela.current) tela.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.25
  })
  if (barril) {
    return (
      <group>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 1.1, 14]} />
          <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
        </mesh>
        {[0.2, 0.9].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <torusGeometry args={[0.46, 0.04, 6, 18]} />
            <meshStandardMaterial color="#3f3f46" metalness={0.6} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3.2, 6]} />
        <meshStandardMaterial color="#5e3a1a" />
      </mesh>
      <mesh ref={tela} position={[0.55, 2.8, 0]}>
        <boxGeometry args={[1.1, 0.7, 0.04]} />
        <meshBasicMaterial color={color} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

function RedEnElSuelo({ r }: { r: number }) {
  return (
    <mesh position={[0, 0.2, 0]} scale={[1, 0.35, 1]}>
      <sphereGeometry args={[r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial color="#e7e5e4" wireframe toneMapped={false} />
    </mesh>
  )
}

function Portal({ color }: { color: string }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.rotation.y = clock.elapsedTime * 4
  })
  return (
    <group ref={g} position={[0, 1.4, 0]}>
      <mesh>
        <torusGeometry args={[1.3, 0.12, 8, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.1, 0.08, 8, 32]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Las zetas del sueño, flotando. */
function Zetas({ color }: { color: string }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    const gr = g.current
    if (!gr) return
    gr.children.forEach((z, i) => {
      const f = (clock.elapsedTime * 0.6 + i / 3) % 1
      z.position.set(Math.sin(f * 6 + i) * 0.5, 1.2 + f * 2.2, 0)
      z.scale.setScalar(0.4 + f * 0.6)
    })
  })
  return (
    <group ref={g}>
      {[0, 1, 2].map((i) => (
        <group key={i}>
          <Zeta color={color} />
        </group>
      ))}
    </group>
  )
}

/** Una Z hecha con tres palitos. */
export function Zeta({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.09, 0.09]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.68, 0.09, 0.09]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.5, 0.09, 0.09]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Proyectiles
// ---------------------------------------------------------------------------

function Proyectil({ e, battle }: { e: Extract<Efecto, { k: 'proy' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const giro = useRef<Group>(null)
  useFrame((_, dt) => {
    const gr = g.current
    if (!gr) return
    const visible = battle.time >= e.desde
    gr.visible = visible
    if (!visible) return
    const p = posicionDe(battle, e)
    gr.position.set(p.x, p.y, p.z)
    // Mira hacia donde va.
    const dx = e.to.x - e.from.x
    const dz = e.to.z - e.from.z
    gr.rotation.y = Math.atan2(dx, dz) + (e.vuelta !== undefined && p.k > 0.5 ? Math.PI : 0)
    const s = giro.current
    if (!s) return
    switch (e.modelo) {
      case 'bumeran':
        s.rotation.y += dt * 22
        break
      case 'barril':
      case 'roca':
        s.rotation.x += dt * 10
        break
      case 'dinamita':
      case 'granada':
      case 'frasco':
      case 'cuchillo':
        s.rotation.x += dt * 14
        break
      case 'cuervo':
        // Aletea.
        s.children.forEach((ala, i) => {
          if (i > 0) ala.rotation.z = Math.sin(battle.time * 28) * 0.8 * (i === 1 ? 1 : -1)
        })
        break
      case 'toro':
        s.position.y = Math.abs(Math.sin(battle.time * 14)) * 0.25
        break
      default:
        break
    }
  })
  const escala = e.grande ?? 1
  return (
    <group ref={g}>
      <group ref={giro} scale={escala}>
        <ModeloProyectil modelo={e.modelo} color={e.color} />
      </group>
    </group>
  )
}

function ModeloProyectil({ modelo, color }: { modelo: Extract<Efecto, { k: 'proy' }>['modelo']; color: string }) {
  switch (modelo) {
    case 'bala':
      return (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.08, 0.4, 3, 6]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )
    case 'flecha':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.9, 5]} />
            <meshStandardMaterial color="#8a5a2b" />
          </mesh>
          <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.2, 5]} />
            <meshStandardMaterial color="#d4d4d8" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.4]}>
            <boxGeometry args={[0.2, 0.02, 0.18]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </group>
      )
    case 'cuchillo':
      return (
        <group>
          <mesh position={[0, 0, 0.12]}>
            <boxGeometry args={[0.06, 0.16, 0.42]} />
            <meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0, -0.16]}>
            <boxGeometry args={[0.08, 0.1, 0.18]} />
            <meshStandardMaterial color="#5e3a1a" />
          </mesh>
        </group>
      )
    case 'bayoneta':
      return (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.14, 1.1, 4]} />
            <meshStandardMaterial color="#f1f5f9" metalness={0.8} roughness={0.2} emissive={color} emissiveIntensity={0.3} />
          </mesh>
        </group>
      )
    case 'red':
      return (
        <mesh scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.8, 10, 8]} />
          <meshBasicMaterial color="#f5f5f4" wireframe toneMapped={false} />
        </mesh>
      )
    case 'dinamita':
      return (
        <group>
          {[-0.12, 0, 0.12].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.5, 8]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
          ))}
          <mesh position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.09, 6, 6]} />
            <meshBasicMaterial color="#fde047" toneMapped={false} />
          </mesh>
        </group>
      )
    case 'granada':
      return (
        <mesh>
          <sphereGeometry args={[0.2, 10, 8]} />
          <meshStandardMaterial color="#3f6212" roughness={0.6} />
        </mesh>
      )
    case 'frasco':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.22, 10, 8]} />
            <meshStandardMaterial color={color} transparent opacity={0.8} emissive={color} emissiveIntensity={0.5} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 0.16, 6]} />
            <meshStandardMaterial color="#a8a29e" />
          </mesh>
        </group>
      )
    case 'barril':
      return (
        <group rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 0.9, 12]} />
            <meshStandardMaterial color="#8a5a2b" roughness={0.8} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.43, 0.04, 6, 16]} />
            <meshStandardMaterial color="#27272a" />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshBasicMaterial color="#fde047" toneMapped={false} />
          </mesh>
        </group>
      )
    case 'roca':
      return (
        <mesh>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#78716c" roughness={1} />
        </mesh>
      )
    case 'cuervo':
      return (
        <group>
          <mesh>
            <boxGeometry args={[0.18, 0.18, 0.5]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
          <mesh position={[0.3, 0, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.25]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[-0.3, 0, 0]}>
            <boxGeometry args={[0.5, 0.03, 0.25]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0, 0.3]}>
            <coneGeometry args={[0.05, 0.14, 4]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
        </group>
      )
    case 'bumeran':
      return (
        <group>
          <mesh position={[0.2, 0, 0]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.55, 0.06, 0.14]} />
            <meshStandardMaterial color="#a16207" emissive={color} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[-0.2, 0, 0]} rotation={[0, -0.5, 0]}>
            <boxGeometry args={[0.55, 0.06, 0.14]} />
            <meshStandardMaterial color="#a16207" emissive={color} emissiveIntensity={0.4} />
          </mesh>
        </group>
      )
    case 'toro':
      return (
        <group>
          <mesh position={[0, 0.7, 0]}>
            <boxGeometry args={[0.9, 0.8, 1.6]} />
            <meshBasicMaterial color={color} {...brillo} opacity={0.65} />
          </mesh>
          <mesh position={[0, 0.9, 0.95]}>
            <boxGeometry args={[0.6, 0.55, 0.5]} />
            <meshBasicMaterial color={color} {...brillo} opacity={0.75} />
          </mesh>
          {[-1, 1].map((l) => (
            <mesh key={l} position={[l * 0.42, 1.2, 1.05]} rotation={[0, 0, l * 0.9]}>
              <coneGeometry args={[0.07, 0.5, 5]} />
              <meshBasicMaterial color="#fef3c7" toneMapped={false} />
            </mesh>
          ))}
        </group>
      )
  }
}

// ---------------------------------------------------------------------------
// Lineas, conos, pilares, ondas
// ---------------------------------------------------------------------------

function Linea({ e, battle }: { e: Extract<Efecto, { k: 'linea' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const zig = useRef<Group>(null)
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    // Las que van de una tropa a otra (láser, lazo) siguen a las dos.
    const a = e.deA !== undefined ? battle.units.find((u) => u.id === e.deA) : undefined
    const b = e.aB !== undefined ? battle.units.find((u) => u.id === e.aB) : undefined
    const from = a ? { x: a.x, z: a.z } : e.from
    const to = b ? { x: b.x, z: b.z } : e.to
    const dx = to.x - from.x
    const dz = to.z - from.z
    const largo = Math.hypot(dx, dz) || 0.01
    gr.position.set((from.x + to.x) / 2, e.estilo === 'cuerda' ? 1.1 : 1.2, (from.z + to.z) / 2)
    gr.rotation.y = Math.atan2(dx, dz)
    gr.scale.set(1, 1, largo)
    const { alfa } = vida(battle, e.desde, e.hasta)
    if (mat.current) mat.current.opacity = (e.estilo === 'laser' ? 0.55 + Math.sin(battle.time * 30) * 0.3 : 1) * alfa
    // El rayo tiembla.
    if (zig.current) {
      zig.current.children.forEach((seg, i) => {
        seg.position.x = Math.sin(battle.time * 60 + i * 2.3) * 0.25
      })
    }
  })
  const grosor = e.estilo === 'laser' ? 0.05 : e.estilo === 'cuerda' ? 0.07 : e.estilo === 'estela' ? 0.14 : 0.1
  return (
    <group ref={g}>
      {e.estilo === 'rayo' ? (
        <group ref={zig}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, 0, -0.4 + i * 0.2]}>
              <boxGeometry args={[0.12, 0.12, 0.22]} />
              <meshBasicMaterial color={i % 2 ? '#ffffff' : e.color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ) : (
        <mesh>
          <boxGeometry args={[grosor, grosor, 1]} />
          <meshBasicMaterial ref={mat} color={e.color} {...brillo} blending={e.estilo === 'cuerda' ? undefined : AdditiveBlending} />
        </mesh>
      )}
    </group>
  )
}

function Cono({ e, battle }: { e: Extract<Efecto, { k: 'cono' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const llamas = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    const gr = g.current
    if (!gr) return
    const u = battle.units.find((x) => x.id === e.unitId)
    if (u) gr.position.set(u.x, 0, u.z)
    gr.rotation.y = e.ang
    const { k, alfa } = vida(battle, e.desde, e.hasta)
    if (mat.current) mat.current.opacity = (e.estilo === 'onda' ? 0.6 * (1 - k) : 0.5) * alfa
    if (e.estilo === 'onda') gr.scale.setScalar(0.3 + k * 0.7)
    // Las llamas salen a chorro: bolitas que avanzan y crecen.
    if (llamas.current) {
      llamas.current.children.forEach((b, i) => {
        const f = (battle.time * 2.6 + i / 16) % 1
        const lado = Math.sin(i * 7.3) * e.abre * f
        b.position.set(Math.sin(lado) * f * e.alcance, 0.7 + f * 0.6, Math.cos(lado) * f * e.alcance)
        b.scale.setScalar(0.35 + f * 1.3)
        ;((b as Mesh).material as MeshBasicMaterial).opacity = Math.min(1, (1 - f) * 1.4) * alfa
      })
    }
  })
  const color2 = e.estilo === 'acido' ? '#d9f99d' : '#fde047'
  return (
    <group ref={g}>
      {/* El abanico en el suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <circleGeometry args={[e.alcance, 24, -Math.PI / 2 - e.abre, e.abre * 2]} />
        <meshBasicMaterial ref={mat} color={e.color} {...brillo} side={DoubleSide} />
      </mesh>
      {e.estilo !== 'onda' && (
        <group ref={llamas}>
          {Array.from({ length: 16 }).map((_, i) => (
            <mesh key={i}>
              <icosahedronGeometry args={[0.4, 0]} />
              <meshBasicMaterial color={i % 3 === 0 ? color2 : i % 3 === 1 ? e.color : '#dc2626'} {...brillo} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  )
}

function Pilar({ e, battle }: { e: Extract<Efecto, { k: 'pilar' }>; battle: Battle }) {
  const m = useRef<Mesh>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    const { k, alfa } = vida(battle, e.desde, e.hasta)
    if (m.current) m.current.scale.set(1 - k * 0.5, 1, 1 - k * 0.5)
    if (mat.current) mat.current.opacity = 0.55 * alfa
  })
  return (
    <mesh ref={m} position={[e.x, 5, e.z]}>
      <cylinderGeometry args={[e.ancho, e.ancho * 1.2, 10, 20, 1, true]} />
      <meshBasicMaterial ref={mat} color={e.color} {...brillo} side={DoubleSide} blending={AdditiveBlending} />
    </mesh>
  )
}

function Onda({ e, battle }: { e: Extract<Efecto, { k: 'onda' }>; battle: Battle }) {
  const m = useRef<Mesh>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  useFrame(() => {
    const k = Math.min(1, Math.max(0, (battle.time - e.desde) / Math.max(0.01, e.hasta - e.desde)))
    if (m.current) m.current.scale.setScalar(0.15 + k * 0.85)
    if (mat.current) mat.current.opacity = (1 - k) * 0.9
  })
  return (
    <mesh ref={m} position={[e.x, 0.12, e.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[e.r * 0.82, e.r, 48]} />
      <meshBasicMaterial ref={mat} color={e.color} {...brillo} side={DoubleSide} blending={AdditiveBlending} />
    </mesh>
  )
}

/** La ruleta del tahúr: gira encima de su cabeza y se para en lo que le toca. */
const PREMIOS = ['#fde047', '#f87171', '#4ade80', '#a78bfa']

function RuletaTahur({ e, battle }: { e: Extract<Efecto, { k: 'ruleta' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const rueda = useRef<Group>(null)
  useFrame(() => {
    const u = battle.units.find((x) => x.id === e.unitId)
    if (g.current && u) g.current.position.set(u.x, 4.2, u.z)
    const k = Math.min(1, (battle.time - e.desde) / 1.2)
    // Frena poco a poco hasta quedarse en su premio.
    const final = -(e.premio / 4) * Math.PI * 2 + Math.PI * 2 * 6
    if (rueda.current) rueda.current.rotation.z = final * (1 - (1 - k) ** 3)
    if (g.current) g.current.visible = battle.time <= e.hasta
  })
  return (
    <group ref={g}>
      <group ref={rueda}>
        {PREMIOS.map((c, i) => (
          <mesh key={i}>
            <circleGeometry args={[0.9, 12, (i / 4) * Math.PI * 2 + Math.PI / 4, Math.PI / 2]} />
            <meshBasicMaterial color={c} toneMapped={false} side={DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 1, 0.01]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.16, 0.3, 3]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}
