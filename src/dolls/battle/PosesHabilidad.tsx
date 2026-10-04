import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import type { Battle, Unit } from './engine'
import { Zeta } from './EfectosHabilidad'
import { habDe } from './habilidades'

/**
 * El cuerpo durante la habilidad. Se mueve el muñeco entero (sin tocar su animación): baila dando
 * saltitos, gira como un trompo, se encoge en bola y rueda, salta haciendo una voltereta, se marea,
 * se inclina para cargar o desaparece. El grupo va dentro de la escala del muñeco.
 */
export function aplicarPose(battle: Battle, unit: Unit, pose: Group, _unidad: Group) {
  pose.position.set(0, 0, 0)
  pose.rotation.set(0, 0, 0)
  pose.scale.set(1, 1, 1)
  pose.visible = true
  const h = unit.hab
  const t = battle.time
  if (!h.pose || t > h.poseHasta || unit.state === 'muerto') return
  const desde = h.poseDesde
  const k = Math.min(1, (t - desde) / Math.max(0.01, h.poseHasta - desde))
  switch (h.pose) {
    case 'baile':
      // Saltitos, contoneo y media vuelta a un lado y a otro.
      pose.position.y = Math.abs(Math.sin(t * 9)) * 0.2
      pose.rotation.z = Math.sin(t * 7) * 0.3
      pose.rotation.y = Math.sin(t * 3.5) * 0.9
      break
    case 'giro':
      pose.rotation.y = (t - desde) * 22
      pose.rotation.z = Math.sin(t * 9) * 0.08
      break
    case 'bola':
      pose.scale.set(0.8, 0.55, 0.8)
      pose.rotation.x = (t - desde) * 14
      pose.position.y = 0.1
      break
    case 'salto':
      pose.position.y = Math.sin(k * Math.PI) * 1.2
      pose.rotation.x = k * Math.PI * 2
      break
    case 'mareo':
      pose.rotation.z = Math.sin(t * 5) * 0.3
      pose.rotation.x = Math.cos(t * 5) * 0.15
      break
    case 'canaliza':
      pose.position.y = 0.05 + Math.sin(t * 7) * 0.03
      pose.scale.setScalar(1 + Math.sin(t * 10) * 0.04)
      break
    case 'carga':
      pose.rotation.x = 0.45
      pose.position.y = Math.abs(Math.sin(t * 16)) * 0.06
      break
    case 'invisible':
      pose.visible = false
      break
  }
}

/**
 * Lo que se le ve encima a una tropa por las habilidades: que arde, que esta en una red, que duerme,
 * que esta mareada o aturdida, que lleva una cupula, que la han cegado los cuervos, que va hecha
 * bola o con la mecha encendida… y un aro a los pies cuando tiene su habilidad lista.
 */
export function EstadosUnidad({ unit, battle, alto, color }: { unit: Unit; battle: Battle; alto: number; color: string }) {
  const fuego = useRef<Group>(null)
  const red = useRef<Mesh>(null)
  const sueno = useRef<Group>(null)
  const estrellas = useRef<Group>(null)
  const burbuja = useRef<Mesh>(null)
  const ciego = useRef<Group>(null)
  const bola = useRef<Mesh>(null)
  const mecha = useRef<Mesh>(null)
  const lista = useRef<Mesh>(null)
  const listaMat = useRef<MeshBasicMaterial>(null)
  const cartel = useRef<Group>(null)

  useFrame(() => {
    const t = battle.time
    const h = unit.hab
    const vivo = unit.state !== 'muerto'
    if (fuego.current) {
      const v = vivo && t < h.quemaHasta
      fuego.current.visible = v
      if (v)
        fuego.current.children.forEach((c, i) => {
          c.scale.set(1, 0.7 + Math.abs(Math.sin(t * 13 + i * 2)) * 0.7, 1)
        })
    }
    if (red.current) red.current.visible = vivo && t < h.redHasta
    if (sueno.current) {
      const v = vivo && t < h.suenoHasta
      sueno.current.visible = v
      if (v) {
        const f = (t * 0.8) % 1
        sueno.current.position.set(0.4, alto + 0.4 + f * 0.9, 0)
        sueno.current.scale.setScalar(0.5 + f * 0.5)
      }
    }
    if (estrellas.current) {
      const v = vivo && (t < h.mareoHasta || unit.hitStun > 0.45 || unit.state === 'aturdido')
      estrellas.current.visible = v
      if (v) {
        estrellas.current.position.y = alto + 0.25
        estrellas.current.rotation.y = t * 6
      }
    }
    if (burbuja.current) {
      const v = vivo && h.burbuja > 0 && t < h.burbujaHasta
      burbuja.current.visible = v
      if (v) burbuja.current.scale.setScalar(1 + Math.sin(t * 5) * 0.04)
    }
    if (ciego.current) {
      const v = vivo && t < h.cegadoHasta
      ciego.current.visible = v
      if (v) {
        ciego.current.position.y = alto - 0.2
        ciego.current.rotation.y = -t * 5
      }
    }
    if (bola.current) {
      const v = vivo && h.pose === 'bola' && t <= h.poseHasta
      bola.current.visible = v
      if (v) bola.current.rotation.x = t * 14
    }
    if (mecha.current) {
      const v = vivo && h.activa !== null && h.activa.h.mecanica === 'kamikaze'
      mecha.current.visible = v
      if (v) {
        mecha.current.position.y = alto + 0.2
        mecha.current.scale.setScalar(0.7 + Math.random() * 0.8)
      }
    }
    // El cartel de "se busca": una diana roja girando encima.
    if (cartel.current) {
      const v = vivo && t < h.cartelHasta
      cartel.current.visible = v
      if (v) {
        cartel.current.position.y = alto + 0.6
        cartel.current.rotation.y = t * 3
      }
    }
    // El aro de "habilidad lista": late suave a los pies con el color de su habilidad.
    if (listaMat.current) listaMat.current.color.set(habDe(unit).color)
    if (lista.current && listaMat.current) {
      const v = vivo && !h.activa && t >= h.listaEn && !battle.practice
      lista.current.visible = v
      if (v) {
        listaMat.current.opacity = 0.45 + Math.sin(t * 5) * 0.25
        lista.current.rotation.z = t * 1.5
      }
    }
  })

  const habColor = unit.habilidad.color
  return (
    <group>
      <mesh ref={lista} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]} visible={false}>
        <ringGeometry args={[1.05, 1.22, 32, 1, 0, Math.PI * 1.7]} />
        <meshBasicMaterial ref={listaMat} color={habColor} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={fuego} visible={false}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.6) * 0.35, 0.5 + i * 0.35, Math.sin(i * 1.6) * 0.35]}>
            <coneGeometry args={[0.28, 0.8, 6]} />
            <meshBasicMaterial color={i % 2 ? '#f97316' : '#fde047'} transparent opacity={0.85} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
          </mesh>
        ))}
      </group>
      <mesh ref={red} position={[0, 0.2, 0]} scale={[1, Math.max(1, alto / 1.2), 1]} visible={false}>
        <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#f5f5f4" wireframe toneMapped={false} />
      </mesh>
      <group ref={sueno} visible={false}>
        <Zeta color="#c4b5fd" />
      </group>
      <group ref={estrellas} visible={false}>
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6]}>
              <octahedronGeometry args={[0.16, 0]} />
              <meshBasicMaterial color="#fde047" toneMapped={false} />
            </mesh>
          )
        })}
      </group>
      <mesh ref={burbuja} position={[0, alto * 0.5, 0]} visible={false}>
        <sphereGeometry args={[Math.max(1.2, alto * 0.62), 20, 14]} />
        <meshBasicMaterial color="#7dd3fc" transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={ciego} visible={false}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[Math.cos(i * Math.PI) * 0.45, 0, Math.sin(i * Math.PI) * 0.45]}>
            <boxGeometry args={[0.3, 0.05, 0.14]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
      </group>
      <mesh ref={bola} position={[0, 0.8, 0]} visible={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} flatShading transparent opacity={0.85} />
      </mesh>
      <group ref={cartel} visible={false}>
        <mesh>
          <torusGeometry args={[0.42, 0.07, 8, 24]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[1.05, 0.06, 0.06]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[1.05, 0.06, 0.06]} />
          <meshBasicMaterial color="#ef4444" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={mecha} visible={false}>
        <sphereGeometry args={[0.18, 6, 6]} />
        <meshBasicMaterial color="#fde047" toneMapped={false} />
      </mesh>
    </group>
  )
}
