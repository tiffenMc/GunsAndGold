import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Shape, ShapeGeometry, Vector2 } from 'three'
import type { Group, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial } from 'three'
import { Model } from '../scenes/models'
import type { Battle } from './engine'
import { FIELD_L, FIELD_W } from './engine'
import { chillidos, mordisco, ola, porrazo, trueno, viento } from './sfx'
import type { Suceso } from './sucesosClima'

/**
 * **Lo que se ve del clima**: los rayos con su aviso (tormenta), la ventisca y los muñecos de hielo
 * (helado), la bandada de murciélagos (noche), la rodadora, el golpe de calor y el tsunami (día) y
 * los charcos de barro (lluvia). Lee `battle.sucesos` cada fotograma: el motor los mueve y aquí
 * solo se pintan.
 */
export function SucesosClimaFx({ battle }: { battle: Battle }) {
  const [lista, setLista] = useState<Suceso[]>([])
  const firma = useRef('')
  useFrame(() => {
    const ahora = battle.sucesos ?? []
    const f = ahora.map((s) => s.id).join(',')
    if (f !== firma.current) {
      firma.current = f
      setLista([...ahora])
    }
  })
  return (
    <>
      {lista.map((s) => {
        switch (s.k) {
          case 'hielo':
            return <MunecoDeHielo key={s.id} s={s} battle={battle} />
          case 'rayo':
            return <Rayo key={s.id} s={s} battle={battle} />
          case 'charco':
            return <Charco key={s.id} s={s} battle={battle} />
          case 'rodadora':
            return <Rodadora key={s.id} s={s} battle={battle} />
          case 'sol':
            return <Insolacion key={s.id} s={s} battle={battle} />
          case 'ventisca':
            return <Ventisca key={s.id} s={s} battle={battle} />
          case 'tsunami':
            return <Tsunami key={s.id} s={s} battle={battle} />
          case 'murcielagos':
            return <Murcielagos key={s.id} s={s} battle={battle} />
        }
      })}
    </>
  )
}

const brillo = { transparent: true, depthWrite: false, toneMapped: false } as const

/** El suceso tal y como está ahora (con un amigo, la foto lo cambia por otro objeto). */
function actual<T extends Suceso>(battle: Battle, s: T): T {
  return ((battle.sucesos ?? []).find((x) => x.id === s.id) as T | undefined) ?? s
}

function vida(battle: Battle, desde: number, hasta: number, entra = 0.2, sale = 0.35) {
  const k = Math.min(1, Math.max(0, (battle.time - desde) / Math.max(0.01, hasta - desde)))
  const fuera = Math.min(1, (hasta - battle.time) / sale)
  const dentro = Math.min(1, (battle.time - desde) / entra)
  return { k, alfa: Math.max(0, Math.min(fuera, dentro)) }
}

/** Un azar fijo por suceso (para que el rayo no cambie de forma cada fotograma). */
function azarDe(semilla: number) {
  let a = (semilla * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Helado: la ventisca y el muñeco de hielo
// ---------------------------------------------------------------------------

/** Un bloque de hielo que encierra al soldado; tiembla y se agrieta antes de romperse. */
function MunecoDeHielo({ s, battle }: { s: Extract<Suceso, { k: 'hielo' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const mat = useRef<MeshStandardMaterial>(null)
  const texto = useRef<Group>(null)
  const onda = useRef<Mesh>(null)
  useFrame(() => {
    if (!g.current || !mat.current) return
    const ya = actual(battle, s)
    const { k, alfa } = vida(battle, ya.desde, ya.hasta)
    // Entra de golpe (crece) y al final tiembla antes de romperse.
    const crece = Math.min(1, (battle.time - ya.desde) / 0.18)
    const tiembla = k > 0.75 ? Math.sin(battle.time * 70) * 0.06 * (k - 0.75) * 4 : 0
    g.current.position.set(ya.x + tiembla, 0, ya.z)
    g.current.scale.setScalar(0.4 + crece * 0.6)
    mat.current.opacity = 0.78 * alfa
    if (texto.current) texto.current.position.y = 3.8 + k * 0.3
    if (onda.current) {
      const f = Math.min(1, (battle.time - ya.desde) / 0.5)
      onda.current.scale.setScalar(0.5 + f * 2.2)
      ;(onda.current.material as MeshBasicMaterial).opacity = (1 - f) * 0.8
    }
  })
  return (
    <group ref={g}>
      <mesh position={[0, 1.7, 0]}>
        <boxGeometry args={[2, 3.4, 2]} />
        <meshStandardMaterial ref={mat} color="#bfe9ff" emissive="#5fb6ff" emissiveIntensity={0.7} roughness={0.1} metalness={0.2} transparent depthWrite={false} />
      </mesh>
      {/* Los cristales de alrededor */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.3) * 1.15, 0.3, Math.sin(i * 1.3) * 1.15]} rotation={[0.3 * i, i, 0.4]}>
          <coneGeometry args={[0.24, 0.9, 5]} />
          <meshStandardMaterial color="#e0f6ff" emissive="#7cc8ff" emissiveIntensity={0.5} transparent opacity={0.85} />
        </mesh>
      ))}
      {/* La escarcha que salta al congelarse */}
      <mesh ref={onda} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[0.7, 1, 6]} />
        <meshBasicMaterial color="#e0f6ff" {...brillo} blending={AdditiveBlending} />
      </mesh>
      <group ref={texto}>
        <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap font-west text-[15px] text-sky-100 [text-shadow:0_0_6px_#0284c7,0_2px_0_#0c4a6e]">¡Congelado!</span>
        </Html>
      </group>
    </group>
  )
}

const RAFAGAS = 240
const COPOS = 420

/**
 * La ventisca: rachas de viento blancas que cruzan todo el campo de lado, nieve que va casi en
 * horizontal y una niebla blanca. A mitad, deja a unos cuantos congelados (eso lo hace el motor).
 */
function Ventisca({ s, battle }: { s: Extract<Suceso, { k: 'ventisca' }>; battle: Battle }) {
  const lineas = useRef<LineSegments>(null)
  const copos = useRef<Points>(null)
  const niebla = useRef<MeshBasicMaterial>(null)
  const datos = useMemo(() => {
    const azar = azarDe(s.id + 7)
    const ancho = FIELD_W * 2.4
    const rafagas = Array.from({ length: RAFAGAS }, () => ({
      x: (azar() - 0.5) * ancho,
      y: 0.2 + azar() * 6,
      z: (azar() - 0.5) * (FIELD_L + 8),
      v: 20 + azar() * 16,
      l: 1 + azar() * 2.4,
    }))
    const nieve = Array.from({ length: COPOS }, () => ({
      x: (azar() - 0.5) * ancho,
      y: azar() * 7,
      z: (azar() - 0.5) * (FIELD_L + 8),
      v: 9 + azar() * 8,
      f: azar() * 6,
    }))
    const geoL = new BufferGeometry()
    geoL.setAttribute('position', new BufferAttribute(new Float32Array(RAFAGAS * 6), 3))
    const geoP = new BufferGeometry()
    geoP.setAttribute('position', new BufferAttribute(new Float32Array(COPOS * 3), 3))
    return { rafagas, nieve, geoL, geoP, ancho }
  }, [s.id])
  useEffect(
    () => () => {
      datos.geoL.dispose()
      datos.geoP.dispose()
    },
    [datos],
  )
  const sonado = useRef(false)
  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    const ya = actual(battle, s)
    const { alfa } = vida(battle, ya.desde, ya.hasta, 0.5, 0.9)
    if (!sonado.current) {
      sonado.current = true
      viento()
    }
    const dir = Math.sign(ya.dx) || 1
    const medio = datos.ancho / 2
    const pl = datos.geoL.getAttribute('position') as BufferAttribute
    const al = pl.array as Float32Array
    datos.rafagas.forEach((r, i) => {
      r.x += r.v * dir * dt
      if (r.x * dir > medio) r.x = -medio * dir
      al[i * 6] = r.x
      al[i * 6 + 1] = r.y
      al[i * 6 + 2] = r.z
      al[i * 6 + 3] = r.x - r.l * dir
      al[i * 6 + 4] = r.y + 0.05
      al[i * 6 + 5] = r.z
    })
    pl.needsUpdate = true
    const pp = datos.geoP.getAttribute('position') as BufferAttribute
    const ap = pp.array as Float32Array
    const t = battle.time
    datos.nieve.forEach((c, i) => {
      c.x += c.v * dir * dt
      c.y -= dt * 1.4
      if (c.x * dir > medio) c.x = -medio * dir
      if (c.y < 0) c.y = 7
      ap[i * 3] = c.x
      ap[i * 3 + 1] = c.y + Math.sin(t * 5 + c.f) * 0.25
      ap[i * 3 + 2] = c.z
    })
    pp.needsUpdate = true
    if (lineas.current) (lineas.current.material as MeshBasicMaterial).opacity = 0.55 * alfa
    if (copos.current) (copos.current.material as PointsMaterial).opacity = 0.95 * alfa
    if (niebla.current) niebla.current.opacity = 0.32 * alfa
  })
  return (
    <group>
      <lineSegments ref={lineas} geometry={datos.geoL} frustumCulled={false}>
        <lineBasicMaterial color="#f0f9ff" {...brillo} opacity={0} />
      </lineSegments>
      <points ref={copos} geometry={datos.geoP} frustumCulled={false}>
        <pointsMaterial color="#ffffff" size={5} sizeAttenuation={false} {...brillo} opacity={0} />
      </points>
      {/* La niebla blanca, a ras de suelo y algo por encima */}
      {[0.6, 2.2].map((y) => (
        <mesh key={y} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
          <planeGeometry args={[FIELD_W * 3, FIELD_L + 20]} />
          <meshBasicMaterial ref={y === 0.6 ? niebla : undefined} color="#e6f4ff" {...brillo} opacity={y === 0.6 ? 0 : 0.08} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Tormenta: los rayos
// ---------------------------------------------------------------------------

/** Un zigzag de tramos del cielo al suelo, con alguna rama. */
function trazoDeRayo(semilla: number) {
  const azar = azarDe(semilla)
  const tramos: [number, number, number, number, number, number, number][] = []
  let x = (azar() - 0.5) * 1.2
  let z = (azar() - 0.5) * 1.2
  let y = 16
  const grosor = 0.24
  while (y > 0) {
    const ny = Math.max(0, y - (1.6 + azar() * 1.6))
    const nx = ny === 0 ? 0 : x + (azar() - 0.5) * 1.6
    const nz = ny === 0 ? 0 : z + (azar() - 0.5) * 1.6
    tramos.push([x, y, z, nx, ny, nz, grosor])
    // Una rama que sale y se apaga.
    if (azar() < 0.45 && ny > 3) {
      const bx = nx + (azar() - 0.5) * 3.4
      const bz = nz + (azar() - 0.5) * 3.4
      tramos.push([nx, ny, nz, bx, ny - 1.4 - azar() * 1.6, bz, grosor * 0.5])
    }
    x = nx
    y = ny
    z = nz
  }
  return tramos
}

/** Un tramo de rayo entre dos puntos. */
function Tramo({ a, b, grosor }: { a: [number, number, number]; b: [number, number, number]; grosor: number }) {
  const ref = useRef<Mesh>(null)
  useEffect(() => {
    const m = ref.current
    if (!m) return
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
    m.lookAt(b[0], b[1], b[2])
    m.rotateX(Math.PI / 2)
  }, [a, b])
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  return (
    <mesh ref={ref}>
      <boxGeometry args={[grosor, largo, grosor]} />
      <meshBasicMaterial color="#f8fbff" {...brillo} blending={AdditiveBlending} />
    </mesh>
  )
}

/** El rayo: primero un circulo de aviso que se cierra y luego el fogonazo con su trueno. */
function Rayo({ s, battle }: { s: Extract<Suceso, { k: 'rayo' }>; battle: Battle }) {
  const todo = useRef<Group>(null)
  const aviso = useRef<Group>(null)
  const avisoMat = useRef<MeshBasicMaterial>(null)
  const relleno = useRef<MeshBasicMaterial>(null)
  const bolt = useRef<Group>(null)
  const halo = useRef<Mesh>(null)
  const quemado = useRef<MeshBasicMaterial>(null)
  const onda = useRef<Mesh>(null)
  const sonado = useRef(false)
  const tramos = useMemo(() => trazoDeRayo(s.id), [s.id])
  useFrame(() => {
    const t = battle.time
    if (todo.current) todo.current.visible = t >= s.desde
    if (t < s.desde) return
    const antes = t < s.cae
    if (aviso.current && avisoMat.current && relleno.current) {
      const k = Math.min(1, (t - s.desde) / (s.cae - s.desde))
      aviso.current.visible = antes
      aviso.current.scale.setScalar(1.35 - k * 0.35)
      avisoMat.current.opacity = 0.35 + Math.abs(Math.sin(t * (8 + k * 22))) * 0.5
      relleno.current.opacity = 0.08 + k * 0.22
    }
    const tras = t - s.cae
    if (bolt.current) {
      // Parpadea dos veces, como los de verdad.
      bolt.current.visible = !antes && (tras < 0.12 || (tras > 0.18 && tras < 0.3))
      bolt.current.scale.x = 1 + Math.sin(t * 90) * 0.25
    }
    if (halo.current) {
      halo.current.visible = !antes && tras < 0.45
      halo.current.scale.setScalar(1 + tras * 4)
      ;(halo.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.75 - tras * 1.7)
    }
    if (onda.current) {
      onda.current.visible = !antes && tras < 0.6
      onda.current.scale.setScalar(0.5 + tras * 7)
      ;(onda.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.9 - tras * 1.5)
    }
    if (quemado.current) quemado.current.opacity = antes ? 0 : Math.max(0, 0.75 * Math.min(1, (s.hasta - t) / 0.6))
    if (!antes && !sonado.current) {
      sonado.current = true
      trueno()
    }
  })
  return (
    <group ref={todo} position={[s.x, 0, s.z]} visible={false}>
      <group ref={aviso}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[s.r * 0.84, s.r, 40]} />
          <meshBasicMaterial ref={avisoMat} color="#fde047" side={DoubleSide} {...brillo} blending={AdditiveBlending} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <circleGeometry args={[s.r * 0.84, 40]} />
          <meshBasicMaterial ref={relleno} color="#facc15" {...brillo} opacity={0.1} />
        </mesh>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[s.r * 0.9, 24]} />
        <meshBasicMaterial ref={quemado} color="#1c1917" {...brillo} opacity={0} />
      </mesh>
      <mesh ref={onda} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]} visible={false}>
        <ringGeometry args={[0.85, 1, 40]} />
        <meshBasicMaterial color="#e0f2fe" {...brillo} blending={AdditiveBlending} />
      </mesh>
      <group ref={bolt} visible={false}>
        {tramos.map(([x1, y1, z1, x2, y2, z2, grosor], i) => (
          <Tramo key={i} a={[x1, y1, z1]} b={[x2, y2, z2]} grosor={grosor} />
        ))}
        {/* El resplandor alrededor del rayo */}
        <mesh position={[0, 8, 0]}>
          <cylinderGeometry args={[0.7, 0.7, 16, 10, 1, true]} />
          <meshBasicMaterial color="#93c5fd" {...brillo} opacity={0.22} blending={AdditiveBlending} side={DoubleSide} />
        </mesh>
        {/* (Sin luz de verdad: añadir una a media partida obliga a recompilar todos los materiales y
            la partida se para. El resplandor y el halo ya dan el fogonazo.) */}
      </group>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} visible={false}>
        <circleGeometry args={[s.r, 32]} />
        <meshBasicMaterial color="#bae6fd" {...brillo} opacity={0.7} blending={AdditiveBlending} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Lluvia: los charcos
// ---------------------------------------------------------------------------

/** Un charco de barro con gotas que hacen ondas. */
function Charco({ s, battle }: { s: Extract<Suceso, { k: 'charco' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const agua = useRef<MeshBasicMaterial>(null)
  const ondas = useRef<(Mesh | null)[]>([])
  useFrame(() => {
    const { alfa } = vida(battle, s.desde, s.hasta)
    const crece = Math.max(0, Math.min(1, (battle.time - s.desde) / 0.8))
    if (g.current) {
      g.current.visible = battle.time >= s.desde
      g.current.scale.setScalar(0.3 + crece * 0.7)
    }
    if (agua.current) agua.current.opacity = 0.75 * alfa
    ondas.current.forEach((m, i) => {
      if (!m) return
      const f = (battle.time * 0.9 + i * 0.37) % 1
      m.scale.setScalar(0.2 + f * 0.8)
      ;(m.material as MeshBasicMaterial).opacity = (1 - f) * 0.6 * alfa
    })
  })
  return (
    <group ref={g} position={[s.x, 0.04, s.z]} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]}>
        <circleGeometry args={[s.r, 36]} />
        <meshBasicMaterial ref={agua} color="#5b4630" {...brillo} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[0.75, 0.55, 1]}>
        <circleGeometry args={[s.r, 36]} />
        <meshBasicMaterial color="#7aa5c4" opacity={0.45} {...brillo} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            ondas.current[i] = m
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[Math.cos(i * 2.1) * s.r * 0.4, 0.02, Math.sin(i * 2.1) * s.r * 0.3]}
        >
          <ringGeometry args={[0.5, 0.6, 24]} />
          <meshBasicMaterial color="#dbeafe" {...brillo} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Día: la rodadora, el golpe de calor y el tsunami
// ---------------------------------------------------------------------------

/** La rodadora: una bola de ramas secas que cruza el campo dando botes y levantando polvo. */
function Rodadora({ s, battle }: { s: Extract<Suceso, { k: 'rodadora' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  const bola = useRef<Group>(null)
  const polvo = useRef<(Mesh | null)[]>([])
  const golpes = useRef(0)
  useFrame(() => {
    if (!g.current || !bola.current) return
    const ya = actual(battle, s)
    const t = battle.time - ya.desde
    const bote = Math.abs(Math.sin(t * 4.5))
    g.current.position.set(ya.x, ya.r * 0.9 + bote * 0.9, ya.z)
    bola.current.rotation.z = -Math.sign(ya.dx) * t * 7
    bola.current.rotation.x = t * 1.3
    // El polvo que va dejando detrás.
    polvo.current.forEach((m, i) => {
      if (!m) return
      const f = (t * 1.6 + i / polvo.current.length) % 1
      m.position.set(ya.x - Math.sign(ya.dx) * (0.4 + f * 2.6), 0.2 + f * 0.6, ya.z + Math.sin(i * 2.3) * 0.5)
      m.scale.setScalar(0.3 + f * 0.9)
      ;(m.material as MeshBasicMaterial).opacity = (1 - f) * 0.45
    })
    if (ya.vistos.length > golpes.current) {
      golpes.current = ya.vistos.length
      porrazo()
    }
  })
  return (
    <>
      <group ref={g}>
        <group ref={bola}>
          <Suspense
            fallback={[0, 1, 2, 3, 4, 5].map((i) => (
              <mesh key={i} rotation={[i * 0.7, i * 1.1, i * 0.4]}>
                <torusGeometry args={[s.r * 0.8, 0.06, 4, 14]} />
                <meshStandardMaterial color={i % 2 ? '#a16207' : '#78350f'} roughness={1} />
              </mesh>
            ))}
          >
            <Model m="Prop_Tumbleweed_01" x={0} z={0} s={2.1} y={-0.6} />
          </Suspense>
        </group>
      </group>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            polvo.current[i] = m
          }}
        >
          <sphereGeometry args={[0.35, 8, 6]} />
          <meshBasicMaterial color="#d6b98a" {...brillo} opacity={0} />
        </mesh>
      ))}
    </>
  )
}

/** La insolacion: un sol que da vueltas encima del mareado. */
function Insolacion({ s, battle }: { s: Extract<Suceso, { k: 'sol' }>; battle: Battle }) {
  const g = useRef<Group>(null)
  useFrame(() => {
    if (!g.current) return
    const ya = actual(battle, s)
    const { alfa } = vida(battle, ya.desde, ya.hasta)
    g.current.position.set(ya.x, 2.5, ya.z)
    g.current.rotation.y = battle.time * 4
    g.current.scale.setScalar(alfa)
  })
  return (
    <group ref={g}>
      <mesh>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshBasicMaterial color="#fde047" toneMapped={false} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <mesh key={i} position={[Math.cos((i * Math.PI) / 4) * 0.45, 0, Math.sin((i * Math.PI) / 4) * 0.45]} rotation={[0, -(i * Math.PI) / 4, Math.PI / 2]}>
          <coneGeometry args={[0.07, 0.25, 4]} />
          <meshBasicMaterial color="#f59e0b" toneMapped={false} />
        </mesh>
      ))}
      <Html center position={[0, 0.7, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <span className="whitespace-nowrap font-west text-[14px] text-yellow-200 [text-shadow:0_2px_0_#7c2d12]">¡Insolación!</span>
      </Html>
    </group>
  )
}

const ESPUMA = 18
const SALPICONES = 90

/**
 * El cuerpo de la ola: su perfil de lado (largo por detrás, alto delante y con el rizo que cae
 * hacia delante) estirado a lo ancho. Más oscura abajo y clara arriba.
 */
function geoOla(ancho: number): ExtrudeGeometry {
  const perfil = new Shape()
  perfil.moveTo(-7, 0)
  perfil.splineThru([
    new Vector2(-4.5, 0.7),
    new Vector2(-2.4, 1.7),
    new Vector2(-0.9, 2.8),
    new Vector2(0.2, 3.4),
    new Vector2(1.0, 3.3),
    new Vector2(1.5, 2.85),
    new Vector2(1.35, 2.45),
  ])
  perfil.splineThru([new Vector2(0.95, 2.55), new Vector2(0.55, 2.1), new Vector2(0.7, 1.2), new Vector2(1.5, 0)])
  perfil.closePath()
  const geo = new ExtrudeGeometry(perfil, { depth: ancho, bevelEnabled: false, curveSegments: 10 })
  geo.translate(0, 0, -ancho / 2)
  const pos = geo.getAttribute('position') as BufferAttribute
  const colores = new Float32Array(pos.count * 3)
  const hondo = new Color('#0f4f86')
  const claro = new Color('#6fd3f5')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    c.copy(hondo).lerp(claro, Math.min(1, Math.max(0, pos.getY(i) / 3.3)))
    colores[i * 3] = c.r
    colores[i * 3 + 1] = c.g
    colores[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new BufferAttribute(colores, 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * El tsunami. Primero el aviso: el carril se pone azul, unas flechas marcan por donde viene y en la
 * punta se ve crecer el agua. Luego la ola: un muro de agua con su cresta rizada y espuma, que baja
 * por el carril dejando el suelo mojado detrás.
 */
function Tsunami({ s, battle }: { s: Extract<Suceso, { k: 'tsunami' }>; battle: Battle }) {
  const ancho = s.r * 2
  const dir = Math.sign(s.dz) || 1
  const carril = useRef<MeshBasicMaterial>(null)
  const flechas = useRef<(Group | null)[]>([])
  const ola_ = useRef<Group>(null)
  const espuma = useRef<(Mesh | null)[]>([])
  const mojado = useRef<Mesh>(null)
  const mojadoMat = useRef<MeshBasicMaterial>(null)
  const chispas = useRef<Points>(null)
  const sonado = useRef<0 | 1 | 2>(0)
  const salpicones = useMemo(() => {
    const azar = azarDe(s.id + 3)
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(SALPICONES * 3), 3))
    return { geo, gotas: Array.from({ length: SALPICONES }, () => ({ x: (azar() - 0.5) * ancho, f: azar(), v: 0.8 + azar() * 0.8 })) }
  }, [s.id, ancho])
  useEffect(() => () => salpicones.geo.dispose(), [salpicones])
  const cuerpo = useMemo(() => geoOla(ancho), [ancho])
  useEffect(() => () => cuerpo.dispose(), [cuerpo])

  useFrame(() => {
    const ya = actual(battle, s)
    const t = battle.time
    const avisando = t < ya.sale
    if (sonado.current === 0) {
      sonado.current = 1
      ola(false)
    }
    if (!avisando && sonado.current === 1) {
      sonado.current = 2
      ola(true)
    }
    // El aviso: el carril parpadea y las flechas avanzan.
    const fin = Math.min(1, (ya.hasta - t) / 0.8)
    if (carril.current) carril.current.opacity = (avisando ? 0.2 + Math.abs(Math.sin(t * 7)) * 0.28 : 0.12) * fin
    flechas.current.forEach((f, i) => {
      if (!f) return
      f.visible = avisando
      const paso = ((t * 1.6 + i / 5) % 1) * (FIELD_L / 5)
      f.position.z = ya.oz + dir * (4 + i * (FIELD_L / 5) + paso)
    })
    // La ola.
    if (ola_.current) {
      ola_.current.visible = true
      const sube = avisando ? 0.15 + Math.min(1, (t - ya.desde) / (ya.sale - ya.desde)) * 0.35 : Math.min(1, 0.5 + (t - ya.sale) * 1.6)
      ola_.current.position.set(ya.x, 0, avisando ? ya.oz + dir * 1.5 : ya.z)
      ola_.current.scale.set(1, sube * fin, 1)
      espuma.current.forEach((m, i) => {
        if (!m) return
        m.position.y = 3.2 + Math.sin(t * 9 + i * 1.7) * 0.18
        m.scale.setScalar(0.8 + Math.abs(Math.sin(t * 6 + i)) * 0.5)
      })
    }
    // Lo mojado: desde la punta por donde salió hasta la cresta.
    if (mojado.current && mojadoMat.current) {
      const hasta = avisando ? ya.oz : ya.z
      const largo = Math.max(0.01, Math.abs(hasta - ya.oz))
      mojado.current.scale.set(1, largo, 1)
      mojado.current.position.set(ya.x, 0.03, (ya.oz + hasta) / 2)
      mojadoMat.current.opacity = 0.42 * fin
    }
    // Las gotas que salta la cresta.
    if (chispas.current) {
      chispas.current.visible = !avisando
      const arr = (salpicones.geo.getAttribute('position') as BufferAttribute).array as Float32Array
      salpicones.gotas.forEach((g, i) => {
        const f = (t * g.v + g.f) % 1
        arr[i * 3] = ya.x + g.x
        arr[i * 3 + 1] = 3 + f * 2.2 - f * f * 2.6
        arr[i * 3 + 2] = ya.z + dir * (0.6 + f * 1.8)
      })
      salpicones.geo.getAttribute('position').needsUpdate = true
      ;(chispas.current.material as PointsMaterial).opacity = 0.9 * fin
    }
  })

  return (
    <group>
      {/* El carril por donde viene */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[s.x, 0.04, 0]}>
        <planeGeometry args={[ancho, FIELD_L]} />
        <meshBasicMaterial ref={carril} color="#38bdf8" {...brillo} opacity={0} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group
          key={i}
          ref={(g) => {
            flechas.current[i] = g
          }}
          position={[s.x, 0.08, 0]}
          rotation={[-Math.PI / 2, 0, dir > 0 ? Math.PI : 0]}
        >
          <mesh>
            <coneGeometry args={[0.9, 1.4, 3]} />
            <meshBasicMaterial color="#e0f2fe" {...brillo} opacity={0.75} />
          </mesh>
        </group>
      ))}
      {/* El suelo mojado */}
      <mesh ref={mojado} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ancho, 1]} />
        <meshBasicMaterial ref={mojadoMat} color="#1e3a5f" {...brillo} opacity={0} />
      </mesh>
      {/* La ola */}
      <group ref={ola_} visible={false}>
        <group rotation={[0, dir > 0 ? 0 : Math.PI, 0]}>
          {/* El agua: el perfil de la ola (con su rizo) estirado a lo ancho del carril */}
          <mesh geometry={cuerpo} rotation={[0, -Math.PI / 2, 0]}>
            <meshStandardMaterial vertexColors roughness={0.12} metalness={0.15} transparent opacity={0.94} side={DoubleSide} />
          </mesh>
          {/* La espuma de la cresta (dos filas) y la del pie, donde rompe */}
          {Array.from({ length: ESPUMA }).map((_, i) => (
            <mesh
              key={i}
              ref={(m) => {
                espuma.current[i] = m
              }}
              position={[(((i * 7) % ESPUMA) / (ESPUMA - 1) - 0.5) * ancho * 0.95, 3.2, i % 2 ? 0.55 : 0.95]}
            >
              <sphereGeometry args={[0.34, 8, 6]} />
              <meshStandardMaterial color="#f8fdff" roughness={0.6} />
            </mesh>
          ))}
          {[-0.36, -0.12, 0.12, 0.36].map((f) => (
            <mesh key={f} position={[f * ancho, 0.25, 1.35]} scale={[1.6, 0.6, 1]}>
              <sphereGeometry args={[0.5, 10, 6]} />
              <meshStandardMaterial color="#e6f6ff" roughness={0.7} transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      </group>
      <points ref={chispas} geometry={salpicones.geo} frustumCulled={false} visible={false}>
        <pointsMaterial color="#e0f6ff" size={6} sizeAttenuation={false} {...brillo} opacity={0} />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Noche: la bandada de murciélagos
// ---------------------------------------------------------------------------

/** El ala de murciélago: un triángulo con el borde de picos. */
function alaGeo(): ShapeGeometry {
  const f = new Shape()
  f.moveTo(0, 0)
  f.lineTo(0.55, 0.22)
  f.lineTo(0.62, -0.02)
  f.lineTo(0.48, 0.02)
  f.lineTo(0.42, -0.12)
  f.lineTo(0.28, -0.04)
  f.lineTo(0.18, -0.16)
  f.lineTo(0, -0.05)
  f.closePath()
  return new ShapeGeometry(f)
}

const MURCIELAGOS = 26

/**
 * Una bandada que entra por un lado, va de víctima en víctima (se cierra encima de cada una al
 * morder) y se va por el otro. Cada murciélago aletea a su ritmo, con sus ojillos rojos.
 */
function Murcielagos({ s, battle }: { s: Extract<Suceso, { k: 'murcielagos' }>; battle: Battle }) {
  const geo = useMemo(() => alaGeo(), [])
  useEffect(() => () => geo.dispose(), [geo])
  const bichos = useMemo(() => {
    const azar = azarDe(s.id + 11)
    return Array.from({ length: MURCIELAGOS }, () => ({
      a: azar() * Math.PI * 2,
      v: (1.6 + azar() * 2.2) * (azar() < 0.5 ? 1 : -1),
      r: 0.7 + azar() * 1.8,
      h: 1.9 + azar() * 1.9,
      f: azar() * 10,
      s: 1.25 + azar() * 0.7,
    }))
  }, [s.id])
  const refs = useRef<(Group | null)[]>([])
  const alas = useRef<(Group | null)[]>([])
  const sombra = useRef<Mesh>(null)
  const sonado = useRef(false)
  const mordidos = useRef(0)

  useFrame(() => {
    const ya = actual(battle, s)
    const t = battle.time
    if (!sonado.current) {
      sonado.current = true
      chillidos()
    }
    if (ya.hechos > mordidos.current) {
      mordidos.current = ya.hechos
      mordisco()
      if (ya.hechos % 2 === 1) chillidos()
    }
    const { alfa } = vida(battle, ya.desde, ya.hasta, 0.4, 0.6)
    // Cuanto se cierran: al morder, la bandada baja y se aprieta encima.
    let cierre = 0
    for (const g of ya.golpes) cierre = Math.max(cierre, 1 - Math.min(1, Math.abs(t - g) / 0.45))
    bichos.forEach((b, i) => {
      const m = refs.current[i]
      if (!m) return
      const ang = b.a + t * b.v
      const r = b.r * (1 - cierre * 0.65)
      const y = b.h * (1 - cierre * 0.45) + Math.sin(t * 3 + b.f) * 0.25
      m.position.set(ya.x + Math.cos(ang) * r, y, ya.z + Math.sin(ang) * r)
      m.rotation.y = -ang + (b.v > 0 ? 0 : Math.PI)
      m.scale.setScalar(b.s * alfa)
      const ala = alas.current[i]
      if (ala) {
        const flap = Math.sin(t * 28 + b.f) * 0.9
        const izq = ala.children[0]
        const der = ala.children[1]
        if (izq) izq.rotation.z = flap
        if (der) der.rotation.z = -flap
      }
    })
    if (sombra.current) {
      sombra.current.position.set(ya.x, 0.05, ya.z)
      sombra.current.scale.setScalar(1.6 - cierre * 0.8)
      ;(sombra.current.material as MeshBasicMaterial).opacity = 0.35 * alfa
    }
  })

  return (
    <group>
      <mesh ref={sombra} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.4, 24]} />
        <meshBasicMaterial color="#000000" {...brillo} opacity={0} />
      </mesh>
      {bichos.map((_, i) => (
        <group
          key={i}
          ref={(g) => {
            refs.current[i] = g
          }}
        >
          {/* El cuerpo y las orejas */}
          <mesh scale={[0.7, 0.6, 1.1]}>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshStandardMaterial color="#1c1424" roughness={0.9} />
          </mesh>
          {[-1, 1].map((lado) => (
            <mesh key={lado} position={[lado * 0.05, 0.1, 0.07]}>
              <coneGeometry args={[0.03, 0.09, 4]} />
              <meshStandardMaterial color="#1c1424" />
            </mesh>
          ))}
          {[-1, 1].map((lado) => (
            <mesh key={`o${lado}`} position={[lado * 0.04, 0.03, 0.13]}>
              <sphereGeometry args={[0.018, 6, 4]} />
              <meshBasicMaterial color="#ff2a2a" toneMapped={false} />
            </mesh>
          ))}
          {/* Las alas, que aletean */}
          <group
            ref={(g) => {
              alas.current[i] = g
            }}
          >
            <group position={[0.04, 0, 0]}>
              <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#2b1f36" side={DoubleSide} roughness={0.9} />
              </mesh>
            </group>
            <group position={[-0.04, 0, 0]} scale={[-1, 1, 1]}>
              <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="#2b1f36" side={DoubleSide} roughness={0.9} />
              </mesh>
            </group>
          </group>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Encima de la pantalla: el fogonazo del rayo, la escarcha de la ventisca…
// ---------------------------------------------------------------------------

/**
 * Lo que el clima le hace a la pantalla entera (va fuera del 3D, encima de todo): el fogonazo
 * blanco de cada rayo, la escarcha en los bordes con la ventisca, un tinte azul mientras viene el
 * tsunami y la oscuridad de la bandada.
 */
export function PantallaClima({ battle }: { battle: Battle }) {
  const flash = useRef<HTMLDivElement>(null)
  const escarcha = useRef<HTMLDivElement>(null)
  const tinte = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let id = 0
    const pinta = () => {
      id = requestAnimationFrame(pinta)
      const t = battle.time
      let blanco = 0
      let hielo = 0
      let azul = 0
      let negro = 0
      for (const s of battle.sucesos ?? []) {
        if (s.k === 'rayo' && t >= s.cae) blanco = Math.max(blanco, Math.max(0, 0.6 - (t - s.cae) * 3.2))
        else if (s.k === 'ventisca') hielo = Math.max(hielo, vida(battle, s.desde, s.hasta, 0.6, 0.9).alfa)
        else if (s.k === 'tsunami') azul = Math.max(azul, t < s.sale ? 0.5 + Math.sin(t * 7) * 0.2 : 0.35 * Math.min(1, (s.hasta - t) / 0.8))
        else if (s.k === 'murcielagos') negro = Math.max(negro, vida(battle, s.desde, s.hasta, 0.4, 0.6).alfa)
      }
      if (flash.current) flash.current.style.opacity = String(blanco)
      if (escarcha.current) escarcha.current.style.opacity = String(hielo)
      if (tinte.current) {
        tinte.current.style.opacity = String(Math.max(azul, negro))
        tinte.current.style.background =
          azul >= negro
            ? 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(14,116,190,0.55) 100%)'
            : 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(10,4,18,0.75) 100%)'
      }
    }
    pinta()
    return () => cancelAnimationFrame(id)
  }, [battle])
  return (
    <div className="pointer-events-none absolute inset-0 z-[15]">
      <div ref={tinte} className="absolute inset-0" style={{ opacity: 0 }} />
      <div
        ref={escarcha}
        className="absolute inset-0"
        style={{
          opacity: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0) 42%, rgba(224,242,254,0.45) 70%, rgba(240,249,255,0.92) 100%)',
          boxShadow: 'inset 0 0 60px 20px rgba(255,255,255,0.6)',
        }}
      />
      <div ref={flash} className="absolute inset-0 bg-[#f0f7ff]" style={{ opacity: 0, mixBlendMode: 'screen' }} />
    </div>
  )
}
