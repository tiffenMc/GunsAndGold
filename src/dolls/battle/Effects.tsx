import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { FORT_R, fortPos } from './engine'
import type { Battle, Vec } from './engine'

const POOL = 48

/** Los tiros de las tropas: una bala con su estela que cruza de verdad hasta el objetivo. */
export function TroopShots({ battle }: { battle: Battle }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(() => {
    const shots = battle.shots
    for (let i = 0; i < POOL; i++) {
      const g = refs.current[i]
      if (!g) continue
      const shot = shots[i]
      if (!shot) {
        g.visible = false
        continue
      }
      // Los golpes cuerpo a cuerpo llegan al instante: no hay nada que dibujar volando.
      if (shot.melee) {
        g.visible = false
        continue
      }
      g.visible = true
      g.rotation.order = 'YXZ'
      const k = Math.min(1, shot.t / shot.dur)
      const toY = shot.target.kind === 'fort' ? 1.7 : 0.95
      const x = shot.from.x + (shot.to.x - shot.from.x) * k
      const z = shot.from.z + (shot.to.z - shot.from.z) * k
      const gun = shot.gun
      const thrown = gun === 'dinamita' || gun === 'botella'
      const flecha = gun === 'arco'
      const lanza = gun === 'lanza'
      const hacha = gun === 'hacha' || gun === 'martillo'
      const lob = thrown ? Math.sin(k * Math.PI) * 1.6 : flecha ? Math.sin(k * Math.PI) * 0.9 : lanza ? Math.sin(k * Math.PI) * 0.6 : hacha ? Math.sin(k * Math.PI) * 0.8 : 0
      const y = 1.05 + (toY - 1.05) * k + lob
      g.position.set(x, y, z)
      // La flecha y la lanza cabecean siguiendo su arco.
      const pitch = flecha || lanza ? Math.cos(k * Math.PI) * 0.5 : 0
      g.rotation.set(pitch, Math.atan2(shot.to.x - shot.from.x, shot.to.z - shot.from.z), 0)
      g.userData.gun = gun
      const tracer = g.children[0]
      const stick = g.children[1]
      const arrow = g.children[2]
      const axe = g.children[3]
      if (stick) {
        stick.visible = thrown
        stick.rotation.x = k * 14
      }
      if (tracer) tracer.visible = !thrown && !flecha && !lanza && !hacha
      if (arrow) {
        arrow.visible = flecha || lanza
        arrow.scale.set(lanza ? 1.5 : 1, lanza ? 1.5 : 1, lanza ? 1.7 : 1)
      }
      if (axe) {
        axe.visible = hacha
        axe.rotation.x = k * 22
      }
    }
  })
  return (
    <group>
      {Array.from({ length: POOL }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
        >
          <group>
            <mesh>
              <sphereGeometry args={[0.07, 8, 6]} />
              <meshBasicMaterial color="#fff2c4" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.005, 0.6, 6]} />
              <meshBasicMaterial color="#ffc861" transparent opacity={0.7} toneMapped={false} />
            </mesh>
          </group>
          <mesh>
            <cylinderGeometry args={[0.06, 0.06, 0.34, 8]} />
            <meshStandardMaterial color="#b3261e" />
          </mesh>
          {/* La flecha (y la lanza, mas grande): asta, punta y plumas */}
          <group visible={false}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.95, 6]} />
              <meshBasicMaterial color="#e8d9b0" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.055, 0.16, 6]} />
              <meshBasicMaterial color="#d6dde6" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.44]}>
              <boxGeometry args={[0.14, 0.012, 0.16]} />
              <meshBasicMaterial color="#c0392b" toneMapped={false} />
            </mesh>
          </group>
          {/* El hacha que gira */}
          <mesh visible={false}>
            <boxGeometry args={[0.08, 0.34, 0.22]} />
            <meshBasicMaterial color="#b8c2cf" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Las balas del arma: siguen tu trazo con una estela del color del arma. */
export function WeaponBullets({ battle }: { battle: Battle }) {
  const refs = useRef<(Group | null)[]>([])
  useFrame(() => {
    const bullets = battle.bullets
    for (let i = 0; i < POOL; i++) {
      const g = refs.current[i]
      if (!g) continue
      const b = bullets[i]
      if (!b || b.delay > 0) {
        g.visible = false
        continue
      }
      g.visible = true
      const explosive = b.mode === 'explosivo'
      const k = b.maxDist > 0 ? b.dist / b.maxDist : 0
      const y = explosive ? 0.6 + Math.sin(k * Math.PI) * 2.4 : 0.9
      g.position.set(b.x, y, b.z)
      g.rotation.set(0, Math.atan2(b.dx, b.dz), 0)
      const [trail, core, stick, glow, flecha, roca, bola, hacha] = g.children as Mesh[]
      const p = b.proyectil
      if (trail && core && stick) {
        trail.visible = p === 'bala'
        core.visible = p === 'bala'
        stick.visible = p === 'dinamita'
        stick.rotation.x = b.dist * 3
        const material = trail.material as MeshBasicMaterial
        material.color.set(b.accent)
      }
      if (flecha) {
        flecha.visible = p === 'flecha' || p === 'lanza'
        flecha.scale.set(p === 'lanza' ? 1.6 : 1.3, p === 'lanza' ? 1.6 : 1.3, p === 'lanza' ? 1.8 : 1.3)
      }
      if (roca) {
        roca.visible = p === 'roca'
        roca.rotation.x = b.dist * 4
      }
      if (bola) bola.visible = p === 'bola'
      if (hacha) {
        hacha.visible = p === 'hacha' || p === 'martillo'
        hacha.rotation.x = b.dist * 9
      }
      if (glow) (glow.material as MeshBasicMaterial).color.set(b.accent)
      // Con la mecha corriendo, la carga palpita para avisar de que va a estallar.
      const fuse = b.mode === 'explosivo' && b.fuseMs > 0
      g.scale.setScalar(fuse ? 1 + Math.sin(performance.now() / 70) * 0.22 : 1)
    }
  })
  return (
    <group>
      {Array.from({ length: POOL }).map((_, i) => (
        <group
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          visible={false}
        >
          <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.01, 1.25, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.13, 8, 6]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <group>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.08, 0.08, 0.45, 8]} />
              <meshStandardMaterial color="#b3261e" />
            </mesh>
            <mesh position={[0.28, 0, 0]}>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshBasicMaterial color="#ffb347" toneMapped={false} />
            </mesh>
          </group>
          {/* Halo: hace que la bala se vea aunque cruce rapido. */}
          <mesh>
            <sphereGeometry args={[0.36, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
          </mesh>
          {/* Flecha o lanza: asta, punta y plumas */}
          <group visible={false}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.95, 6]} />
              <meshBasicMaterial color="#f1e7c8" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.06, 0.18, 6]} />
              <meshBasicMaterial color="#e8eef5" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, -0.44]}>
              <boxGeometry args={[0.16, 0.014, 0.18]} />
              <meshBasicMaterial color="#e74c3c" toneMapped={false} />
            </mesh>
          </group>
          {/* La roca de la catapulta */}
          <mesh visible={false}>
            <dodecahedronGeometry args={[0.26, 0]} />
            <meshStandardMaterial color="#7a736a" roughness={1} />
          </mesh>
          {/* La bola de cañon */}
          <mesh visible={false}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshStandardMaterial color="#25272c" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* El hacha o el martillo lanzados */}
          <mesh visible={false}>
            <boxGeometry args={[0.1, 0.46, 0.3]} />
            <meshBasicMaterial color="#c2ccd8" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Cinta en el suelo para dibujar caminos (la ruta de la tropa y la de la bala)
// ---------------------------------------------------------------------------

const MAX_POINTS = 256

export interface RibbonData {
  points: Vec[]
  visible: boolean
  /** A partir de esta distancia el camino sale apagado (fuera de alcance). */
  cut?: number
  color: string
  dimColor?: string
  width: number
  dashed?: boolean
}

/** Una cinta plana sobre el suelo que sigue unos puntos. Se rehace cada fotograma. */
export function Ribbon({ data, order = 5 }: { data: MutableRefObject<RibbonData>; order?: number }) {
  const mesh = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(MAX_POINTS * 2 * 3), 3))
    const index: number[] = []
    for (let i = 0; i < MAX_POINTS - 1; i++) {
      const a = i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    g.setIndex(index)
    g.setDrawRange(0, 0)
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const lit = useMemo(() => new Color(), [])
  const dim = useMemo(() => new Color(), [])

  useFrame(() => {
    const d = data.current
    const m = mesh.current
    if (!m) return
    const pts = d.points
    if (!d.visible || pts.length < 2) {
      m.visible = false
      return
    }
    m.visible = true
    lit.set(d.color)
    dim.set(d.dimColor ?? '#555555')
    const pos = geometry.getAttribute('position') as BufferAttribute
    const col = geometry.getAttribute('color') as BufferAttribute
    const n = Math.min(MAX_POINTS, pts.length)
    let walked = 0
    for (let i = 0; i < n; i++) {
      const p = pts[i]!
      const prev = pts[Math.max(0, i - 1)]!
      const next = pts[Math.min(n - 1, i + 1)]!
      if (i > 0) walked += Math.hypot(p.x - prev.x, p.z - prev.z)
      let tx = next.x - prev.x
      let tz = next.z - prev.z
      const len = Math.hypot(tx, tz) || 1
      tx /= len
      tz /= len
      const nx = -tz * d.width * 0.5
      const nz = tx * d.width * 0.5
      pos.setXYZ(i * 2, p.x + nx, 0.06, p.z + nz)
      pos.setXYZ(i * 2 + 1, p.x - nx, 0.06, p.z - nz)
      const off = d.cut !== undefined && walked > d.cut
      const dash = d.dashed && Math.floor(walked / 0.45) % 2 === 1
      const c = off ? dim : lit
      const fade = dash ? 0.35 : 1
      col.setXYZ(i * 2, c.r * fade, c.g * fade, c.b * fade)
      col.setXYZ(i * 2 + 1, c.r * fade, c.g * fade, c.b * fade)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geometry.setDrawRange(0, (n - 1) * 6)
    geometry.computeBoundingSphere()
  })

  return (
    <mesh ref={mesh} geometry={geometry} frustumCulled={false} renderOrder={order}>
      <meshBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} side={DoubleSide} toneMapped={false} />
    </mesh>
  )
}

/** Marca en el suelo: donde saldra la tropa, o donde explotara la dinamita. */
export function GroundMark({
  data,
}: {
  data: MutableRefObject<{ visible: boolean; x: number; z: number; r: number; color: string }>
}) {
  const group = useRef<Group>(null)
  const ring = useRef<Mesh>(null)
  useFrame((state) => {
    const d = data.current
    const g = group.current
    if (!g) return
    g.visible = d.visible
    if (!d.visible) return
    g.position.set(d.x, 0.07, d.z)
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.06
    g.scale.set(d.r * pulse, 1, d.r * pulse)
    if (ring.current) (ring.current.material as MeshBasicMaterial).color.set(d.color)
  })
  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 1, 36]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.82, 36]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.045, 0.07, 1.25, 7]} />
        <meshBasicMaterial color="#fff0b3" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.34, 0]}>
        <octahedronGeometry args={[0.14, 0]} />
        <meshBasicMaterial color="#ffcc4d" toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Efectos de un momento: explosiones, chispas, polvo
// ---------------------------------------------------------------------------

export type FxKind = 'blast' | 'spark' | 'dust' | 'puff' | 'fort' | 'muzzle' | 'hit' | 'smoke' | 'shell' | 'warp' | 'rotura' | 'invocacion'

export interface Fx {
  id: number
  kind: FxKind
  x: number
  z: number
  /** Tamaño del fogonazo. */
  r: number
  color: string
  born: number
  /** Altura a la que pasa: la boca del arma no esta a ras de suelo. */
  y?: number
  /** Vainas: hacia que lado saltan. */
  side?: number
}

const FX_LIFE: Record<FxKind, number> = {
  blast: 0.7,
  spark: 0.35,
  dust: 0.6,
  puff: 0.3,
  fort: 0.4,
  muzzle: 0.14,
  hit: 0.42,
  smoke: 0.9,
  shell: 0.9,
  warp: 0.45,
  rotura: 1.6,
  invocacion: 2.2,
}

/** Altura de siempre para los efectos que no la traen puesta. */
const FALLBACK_Y: Partial<Record<FxKind, number>> = { muzzle: 0.9, smoke: 0.9, shell: 0.9, fort: 1.8 }

function FxItem({ fx }: { fx: Fx }) {
  const group = useRef<Group>(null)
  const pieces = useMemo(
    () =>
      Array.from({
        length: fx.kind === 'spark' || fx.kind === 'fort' ? 8 : fx.kind === 'dust' ? 7 : fx.kind === 'hit' ? 6 : fx.kind === 'rotura' ? 16 : fx.kind === 'invocacion' ? 24 : 0,
      }).map(() => ({
        a: Math.random() * Math.PI * 2,
        v: 1.5 + Math.random() * 2.5,
        up: 1 + Math.random() * 2.5,
      })),
    [fx.kind],
  )
  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = (state.clock.elapsedTime - fx.born) / FX_LIFE[fx.kind]
    const k = Math.min(1, Math.max(0, t))
    // `born` puede caer en el futuro (fogonazos encadenados de una rafaga): hasta entonces no existe.
    g.visible = t >= 0 && t <= 1
    if (fx.kind === 'blast') {
      const [ball, ring] = g.children as Mesh[]
      if (ball) {
        ball.scale.setScalar(fx.r * (0.3 + k * 0.8))
        ;(ball.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
      }
      if (ring) {
        ring.scale.setScalar(fx.r * (0.4 + k * 0.9))
        ;(ring.material as MeshBasicMaterial).opacity = 0.8 * (1 - k)
      }
      return
    }
    if (fx.kind === 'puff') {
      g.scale.setScalar(0.2 + k * 0.5)
      const mesh = g.children[0] as Mesh | undefined
      if (mesh) (mesh.material as MeshBasicMaterial).opacity = 0.7 * (1 - k)
      return
    }
    if (fx.kind === 'muzzle') {
      // Fogonazo del disparo: se abre y se apaga enseguida. El arma decide su tamaño.
      const [core, halo] = g.children as Mesh[]
      if (core) {
        core.scale.setScalar((0.45 + k * 1.7) * fx.r)
        ;(core.material as MeshBasicMaterial).opacity = 0.95 * (1 - k)
      }
      if (halo) {
        halo.scale.setScalar((0.8 + k * 2.4) * fx.r)
        ;(halo.material as MeshBasicMaterial).opacity = 0.5 * (1 - k)
      }
      return
    }
    if (fx.kind === 'smoke') {
      // El humo de la polvora: sube, se abre y se desvanece.
      const puff = g.children[0] as Mesh | undefined
      if (puff) {
        puff.scale.setScalar(0.25 + k * 0.7)
        puff.position.set(0, k * 0.7, 0)
        ;(puff.material as MeshBasicMaterial).opacity = 0.42 * (1 - k)
      }
      return
    }
    if (fx.kind === 'shell') {
      // La vaina: salta de lado girando y cae al suelo.
      const shell = g.children[0] as Mesh | undefined
      if (shell) {
        const time = k * FX_LIFE.shell
        const way = fx.side ?? 1
        shell.position.set(way * 1.1 * time, 2.1 * time - 9.5 * time * time, 0.5 * time)
        shell.rotation.set(time * 11, time * 6, time * 9)
        ;(shell.material as MeshBasicMaterial).opacity = 1 - k * k
      }
      return
    }
    if (fx.kind === 'warp') {
      // Miniteletransporte: el anillo se cierra y sube.
      const ring = g.children[0] as Mesh | undefined
      if (ring) {
        ring.scale.setScalar(1.6 - k * 1.2)
        ring.position.y = k * 0.7
        ;(ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
      }
      return
    }
    if (fx.kind === 'rotura') {
      // La rotura en camara lenta: un fogonazo que se apaga enseguida, una onda de choque que
      // se abre despacio por el suelo y astillas que suben, giran y caen flotando.
      const [flash, ring, ...bits] = g.children as Mesh[]
      const easeOut = 1 - (1 - k) ** 3
      if (flash) {
        flash.scale.setScalar(fx.r * (0.5 + k * 1.4))
        ;(flash.material as MeshBasicMaterial).opacity = Math.max(0, 1 - k * 5)
      }
      if (ring) {
        ring.scale.setScalar(fx.r * (0.5 + easeOut * 3.4))
        ;(ring.material as MeshBasicMaterial).opacity = 0.85 * (1 - k)
      }
      const flota = k * 1.5
      bits.forEach((child, i) => {
        const p = pieces[i]
        if (!p) return
        child.position.set(
          Math.cos(p.a) * p.v * flota * 0.85 * fx.r,
          0.9 + (p.up * flota - 2.6 * flota * flota) * fx.r,
          Math.sin(p.a) * p.v * flota * 0.85 * fx.r,
        )
        child.rotation.set(p.a * 3 + flota * 5, flota * 6 * (i % 2 ? 1 : -1), p.up)
        child.scale.setScalar(fx.r * (1 - k * k))
      })
      return
    }
    if (fx.kind === 'invocacion') {
      // La entrada de una carta grande: un pilar de luz que cae del cielo, dos ondas de choque que
      // se abren por el suelo, un charco de luz y chispas que suben dando vueltas.
      const [pilar, nucleo, ondaA, ondaB, disco, ...chispas] = g.children as Mesh[]
      const sale = Math.min(1, k * 7)
      const sube = 1 - (1 - k) ** 2
      if (pilar) {
        pilar.scale.set(fx.r * (0.9 + k * 0.4), sale, fx.r * (0.9 + k * 0.4))
        ;(pilar.material as MeshBasicMaterial).opacity = 0.8 * (1 - k) ** 1.4
      }
      if (nucleo) {
        nucleo.scale.set(fx.r * (0.9 - k * 0.5), sale, fx.r * (0.9 - k * 0.5))
        ;(nucleo.material as MeshBasicMaterial).opacity = 0.95 * (1 - k) ** 2
      }
      if (ondaA) {
        ondaA.scale.setScalar(fx.r * (0.4 + (1 - (1 - k) ** 3) * 4.2))
        ;(ondaA.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
      }
      if (ondaB) {
        const kk = Math.max(0, (k - 0.2) / 0.8)
        ondaB.scale.setScalar(fx.r * (0.4 + (1 - (1 - kk) ** 3) * 6))
        ;(ondaB.material as MeshBasicMaterial).opacity = kk > 0 ? 0.7 * (1 - kk) : 0
      }
      if (disco) {
        disco.scale.setScalar(fx.r * (2.2 + k * 1.2))
        ;(disco.material as MeshBasicMaterial).opacity = 0.55 * (1 - k) ** 1.5
      }
      chispas.forEach((child, i) => {
        const p = pieces[i]
        if (!p) return
        const orbita = p.a + k * 3.2 * (i % 2 ? 1 : -1)
        const radio = fx.r * (0.5 + p.v * 0.32) * (0.6 + sube * 0.8)
        child.position.set(Math.cos(orbita) * radio, 0.2 + p.up * 1.6 * sube * fx.r * 0.6, Math.sin(orbita) * radio)
        child.rotation.set(k * 6, k * 7 + p.a, 0)
        child.scale.setScalar(fx.r * 0.7 * (1 - k * k))
      })
      return
    }
    if (fx.kind === 'hit') {
      // Impacto: un anillo que se abre y chispas. Asi se ve CLARO que le has dado.
      const [ringMesh, ...bits] = g.children as Mesh[]
      if (ringMesh) {
        ringMesh.scale.setScalar(0.55 + k * 1.8)
        ;(ringMesh.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
      }
      const time = k * FX_LIFE.hit
      bits.forEach((child, i) => {
        const p = pieces[i]
        if (!p) return
        child.position.set(Math.cos(p.a) * p.v * time, 0.7 + p.up * time - 6 * time * time, Math.sin(p.a) * p.v * time)
        child.scale.setScalar(1 - k)
      })
      return
    }
    const time = k * FX_LIFE[fx.kind]
    g.children.forEach((child, i) => {
      const p = pieces[i]
      if (!p) return
      const spread = fx.kind === 'dust' ? 0.6 : 1
      child.position.set(
        Math.cos(p.a) * p.v * time * spread,
        (fx.kind === 'dust' ? 0.15 : 1) + p.up * time - 6 * time * time,
        Math.sin(p.a) * p.v * time * spread,
      )
      child.scale.setScalar(fx.kind === 'dust' ? 0.5 + k * 1.3 : 1 - k)
    })
  })

  const y = fx.y ?? FALLBACK_Y[fx.kind] ?? 0
  return (
    <group ref={group} position={[fx.x, y, fx.z]}>
      {fx.kind === 'blast' && (
        <>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#ffb347" transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial color="#ff6b3d" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
          </mesh>
        </>
      )}
      {fx.kind === 'puff' && (
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshBasicMaterial color="#e8d9b0" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}
      {fx.kind === 'muzzle' && (
        <>
          <mesh>
            <sphereGeometry args={[0.5, 12, 10]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.95} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.6, 12, 10]} />
            <meshBasicMaterial color="#fff6d8" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
          </mesh>
        </>
      )}
      {fx.kind === 'smoke' && (
        <mesh>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#d9d2c2" transparent opacity={0.42} depthWrite={false} />
        </mesh>
      )}
      {fx.kind === 'shell' && (
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, 0.17, 6]} />
          <meshBasicMaterial color="#c9a227" transparent toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {fx.kind === 'rotura' && (
        <>
          <mesh position={[0, 0.9, 0]}>
            <sphereGeometry args={[0.55, 12, 10]} />
            <meshBasicMaterial color="#fff3c4" transparent opacity={1} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <ringGeometry args={[0.82, 1, 40]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
          </mesh>
          {pieces.map((_, i) => (
            <mesh key={i}>
              <boxGeometry args={[0.14, 0.14, 0.14]} />
              <meshBasicMaterial color={i % 3 === 0 ? '#ffe9a8' : fx.color} toneMapped={false} />
            </mesh>
          ))}
        </>
      )}
      {fx.kind === 'invocacion' && (
        <>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.7, 0.9, 10, 20, 1, true]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.8} blending={AdditiveBlending} side={DoubleSide} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.3, 0.38, 10, 14, 1, true]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.95} blending={AdditiveBlending} side={DoubleSide} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <ringGeometry args={[0.85, 1, 48]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.9} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
            <ringGeometry args={[0.9, 1, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <circleGeometry args={[1, 32]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.5} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          {pieces.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[0.1, 0]} />
              <meshBasicMaterial color={i % 3 === 0 ? '#ffffff' : fx.color} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
        </>
      )}
      {fx.kind === 'warp' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[0.5, 0.9, 24]} />
          <meshBasicMaterial color={fx.color} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {fx.kind === 'hit' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.7, 0]}>
            <ringGeometry args={[0.55, 1, 28]} />
            <meshBasicMaterial color={fx.color} transparent opacity={0.9} toneMapped={false} depthWrite={false} />
          </mesh>
          {pieces.map((_, i) => (
            <mesh key={i}>
              <boxGeometry args={[0.09, 0.09, 0.09]} />
              <meshBasicMaterial color={fx.color} transparent toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
        </>
      )}
      {(fx.kind === 'spark' || fx.kind === 'fort' || fx.kind === 'dust') &&
        pieces.map((_, i) => (
          <mesh key={i}>
            {fx.kind === 'dust' ? <sphereGeometry args={[0.16, 6, 5]} /> : <boxGeometry args={[0.07, 0.07, 0.07]} />}
            <meshBasicMaterial
              color={fx.kind === 'dust' ? '#d9b98a' : fx.color}
              transparent
              opacity={fx.kind === 'dust' ? 0.55 : 1}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        ))}
    </group>
  )
}

export function FxLayer({ items }: { items: Fx[] }) {
  return (
    <group>
      {items.map((fx) => (
        <FxItem key={fx.id} fx={fx} />
      ))}
    </group>
  )
}

export const FX_MAX_LIFE = 2.6

/** Punto del fuerte que recibe los golpes (para las chispas). */
export function fortHitPoint(side: 0 | 1): Vec {
  const p = fortPos(side)
  return { x: p.x, z: p.z + (side === 0 ? -FORT_R * 0.5 : FORT_R * 0.5) }
}


/**
 * El aura que llevan puestos los soldados de las cartas epicas (un aro que late) y divinas (un aro
 * dorado y tres chispas que giran a su alrededor): se les ve venir entre todos los demas.
 */
export function AuraRareza({ color, grande }: { color: string; grande: boolean }) {
  const aro = useRef<Mesh>(null)
  const orbes = useRef<(Mesh | null)[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (aro.current) {
      const pulso = 1 + Math.sin(t * (grande ? 4 : 3)) * 0.1
      aro.current.scale.setScalar((grande ? 1.35 : 1.15) * pulso)
      ;(aro.current.material as MeshBasicMaterial).opacity = (grande ? 0.75 : 0.55) + Math.sin(t * 5) * 0.15
    }
    if (grande) {
      orbes.current.forEach((orbe, i) => {
        if (!orbe) return
        const a = t * 1.8 + (i * Math.PI * 2) / 3
        orbe.position.set(Math.cos(a) * 1.15, 0.5 + Math.sin(t * 3 + i) * 0.25 + i * 0.35, Math.sin(a) * 1.15)
        orbe.rotation.set(t * 3, t * 2, 0)
      })
    }
  })
  return (
    <group>
      <mesh ref={aro} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.92, 1, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
      </mesh>
      {grande &&
        [0, 1, 2].map((i) => (
          <mesh
            key={i}
            ref={(el) => {
              orbes.current[i] = el
            }}
          >
            <octahedronGeometry args={[0.1, 0]} />
            <meshBasicMaterial color={i === 0 ? '#ffffff' : color} blending={AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
        ))}
    </group>
  )
}

/** Lo que pinta el circulo de una torre mientras la estas colocando. `k` va de 0 (empieza) a 1 (armada). */
export interface RangoData {
  visible: boolean
  x: number
  z: number
  r: number
  k: number
}

/**
 * El **rango de la torre** mientras dejas el dedo quieto: un disco gris que crece desde tu dedo hasta
 * el tamaño de lo que va a proteger; al llegar (torre armada) se vuelve un aro blanco que late, con
 * estacas alrededor, para que se note de sobra que va a salir de torre.
 */
export function RangoTorre({ data }: { data: MutableRefObject<RangoData> }) {
  const grupo = useRef<Group>(null)
  const disco = useRef<Mesh>(null)
  const aro = useRef<Mesh>(null)
  const estacas = useRef<Group>(null)
  useFrame((state) => {
    const g = grupo.current
    const d = data.current
    if (!g) return
    g.visible = d.visible
    if (!d.visible) return
    g.position.set(d.x, 0.05, d.z)
    const t = state.clock.elapsedTime
    const armada = d.k >= 1
    const crece = 1 - (1 - Math.min(1, d.k)) ** 2
    if (disco.current) {
      disco.current.scale.setScalar(Math.max(0.05, d.r * crece))
      ;(disco.current.material as MeshBasicMaterial).opacity = armada ? 0.22 + Math.sin(t * 6) * 0.06 : 0.16
    }
    if (aro.current) {
      aro.current.visible = armada
      aro.current.scale.setScalar(d.r * (1 + Math.sin(t * 6) * 0.025))
    }
    if (estacas.current) {
      estacas.current.visible = armada
      estacas.current.rotation.y = t * 0.3
    }
  })
  return (
    <group ref={grupo} visible={false}>
      <mesh ref={disco} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#e2e8f0" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={aro} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={false}>
        <ringGeometry args={[0.95, 1, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={estacas} visible={false}>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 1.2, 0.5, Math.sin(a) * 1.2]}>
              <cylinderGeometry args={[0.08, 0.1, 1, 6]} />
              <meshBasicMaterial color="#cbd5e1" transparent opacity={0.8} toneMapped={false} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}
