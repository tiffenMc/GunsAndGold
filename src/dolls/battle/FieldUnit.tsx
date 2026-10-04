import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Vector2 } from 'three'
import type { Group, Mesh, MeshStandardMaterial, Sprite, SpriteMaterial } from 'three'
import { motionById, samplePose } from '../animations'
import type { BurstStyle } from '../animations'
import { DollBody } from '../DollBody'
import { DollDebris } from '../DollDebris'
import { proportions } from '../dollParams'
import { TORRE_S, rangoDeTorre, smokeVisibility } from './engine'
import type { Battle, Pace, Side, Unit } from './engine'
import { SIDE_COLOR } from './Field'
import { estiloDe, propDe } from './estilos'
import { rarityInfo, rarityOf } from '../cards/model'
import { AuraRareza } from './Effects'
import { UnitBadge, UnitBase } from './UnitBadge'
import { EstadosUnidad, aplicarPose } from './PosesHabilidad'

type Act = 'mover' | 'quieto' | 'disparar' | 'impacto' | 'caer' | 'morir' | 'roto'

const QUIETO = motionById('quieto')
/** Los muñecos del campo van algo mas grandes que a escala: asi tienen presencia. */
export const UNIT_SCALE = 2.45

/** Los colores del bando en el muñeco: azul los tuyos, rojo los del rival (bien vivos, que se vean de lejos). */
const TEAM_COLOR: Record<Side, string> = { 0: '#2f9bff', 1: '#ff3b30' }

/** Mezcla dos colores (`k` = cuanto del segundo). */
function mixHex(a: string, b: string, k: number): string {
  const n = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const c = (i: number) =>
    Math.round(n(a, i) * (1 - k) + n(b, i) * k)
      .toString(16)
      .padStart(2, '0')
  return `#${c(0)}${c(1)}${c(2)}`
}

function wrapAngle(a: number): number {
  let x = a
  while (x > Math.PI) x -= Math.PI * 2
  while (x < -Math.PI) x += Math.PI * 2
  return x
}

/** Un muñeco en el campo. Lee su tropa del motor en cada fotograma y elige la animacion. */
export function FieldUnit({
  unit,
  battle,
  paceRef,
  viewer = 0,
}: {
  unit: Unit
  battle: Battle
  paceRef: MutableRefObject<Pace>
  /** Desde que bando se mira: el humo enseña a las tuyas a medias y esconde las suyas. */
  viewer?: Side
}) {
  const group = useRef<Group>(null)
  const body = useRef<Group>(null)
  /** Lo que hace el cuerpo con la habilidad: bailar, girar, hacerse bola, saltar, marearse… */
  const poseRef = useRef<Group>(null)
  const [act, setAct] = useState<Act>('mover')
  const [gait, setGait] = useState<'andar' | 'correr'>(paceRef.current.gait)
  const [shields, setShields] = useState(unit.shields)
  const [torre, setTorre] = useState(unit.torre)
  const smoke = useRef<'claro' | 'fantasma' | 'oculto'>('claro')
  const seen = useRef({ shots: unit.shotCount, hits: unit.hitCount, weaponHits: unit.weaponHitCount, grow: 0 })
  const returnTilt = useRef(0)
  const actRef = useRef<Act>('mover')
  actRef.current = act

  const card = unit.card
  const death = useMemo(() => motionById(card.anims.morir), [card.anims.morir])
  const burst: BurstStyle = death.burst ?? 'estallido'
  const restPose = useMemo(() => samplePose(death, death.length), [death])
  const color = SIDE_COLOR[unit.side]
  // El aspecto con la marca del bando: pañuelo y brazaletes de su color y la camisa algo teñida.
  const look = useMemo(
    () => ({
      ...card.look,
      shirt: mixHex(card.look.shirt, TEAM_COLOR[unit.side], 0.3),
      team: TEAM_COLOR[unit.side],
      prop: propDe(unit.estilo),
    }),
    [card.look, unit.side, unit.estilo],
  )
  // Los tanques salen mas grandes y los corredores mas pequeños: se reconocen de lejos.
  const rareza = rarityOf(card)
  // Las cartas grandes se notan: las epicas salen un 12 % mas grandes y las divinas un 25 %.
  const tam = (estiloDe(card).tam ?? 1) * (rareza === 'divina' ? 1.25 : rareza === 'epica' ? 1.12 : 1)

  useFrame((_, dt) => {
    const g = group.current
    if (g) {
      // Con el humo encima: las tuyas se ven a medias (para saber donde andan) y las del rival
      // desaparecen del todo: no sabes por donde caen.
      const look = smokeVisibility(battle, unit, viewer)
      if (look !== smoke.current) {
        smoke.current = look
        g.visible = look !== 'oculto'
        const ghosted = look === 'fantasma'
        g.traverse((obj) => {
          const material = (obj as Mesh).material as MeshStandardMaterial | undefined
          if (!material || Array.isArray(material)) return
          material.transparent = ghosted
          material.opacity = ghosted ? 0.4 : 1
          material.needsUpdate = true
        })
      }
      g.position.set(unit.x, 0, unit.z)
      if (act !== 'roto' && act !== 'morir') {
        const diff = wrapAngle(unit.heading - g.rotation.y)
        g.rotation.y += diff * Math.min(1, dt * 10)
        const fallProgress = unit.fallDuration > 0 ? Math.min(1, unit.fallTime / unit.fallDuration) : 1
        const fallPulse = unit.fallTime < unit.fallDuration ? Math.sin(fallProgress * Math.PI) * unit.fallStrength : 0
        const wantedTilt = fallPulse * 0.68
        returnTilt.current += (wantedTilt - returnTilt.current) * Math.min(1, dt * 12)
        g.rotation.x = unit.fallDirection.z * returnTilt.current
        g.rotation.z = -unit.fallDirection.x * returnTilt.current
      }
    }
    const s = seen.current
    if (body.current && s.grow < 1) {
      s.grow = Math.min(1, s.grow + dt * 4)
      const k = s.grow
      body.current.scale.setScalar(0.3 + 0.7 * (1 - (1 - k) * (1 - k)) + Math.sin(k * Math.PI) * 0.12)
    }

    if (poseRef.current && g) aplicarPose(battle, unit, poseRef.current, g)
    const current = actRef.current
    if (unit.state === 'muerto') {
      if (current !== 'morir' && current !== 'roto') setAct('morir')
      return
    }
    if (unit.shields !== shields) setShields(unit.shields)
    if (unit.torre !== torre) setTorre(unit.torre)
    if (paceRef.current.gait !== gait) setGait(paceRef.current.gait)
    if (unit.weaponHitCount !== s.weaponHits) {
      s.weaponHits = unit.weaponHitCount
      s.hits = unit.hitCount
      setAct(unit.fallTime < unit.fallDuration ? 'caer' : 'impacto')
      return
    }
    if (unit.hitCount !== s.hits) {
      s.hits = unit.hitCount
      setAct('impacto')
      return
    }
    if (actRef.current === 'caer' && unit.fallTime >= unit.fallDuration && unit.hitStun <= 0) {
      setAct(unit.state === 'andar' ? 'mover' : 'quieto')
      return
    }
    if (unit.shotCount !== s.shots) {
      s.shots = unit.shotCount
      setAct('disparar')
      return
    }
    if (current === 'mover' && unit.state !== 'andar') setAct('quieto')
    else if (current === 'quieto' && unit.state === 'andar') setAct('mover')
  })

  const motion =
    act === 'disparar'
      ? motionById(card.anims.disparar)
      : act === 'impacto' || act === 'caer'
        ? motionById(card.anims.impacto)
        : act === 'morir'
          ? death
          : act === 'quieto'
            ? QUIETO
            : motionById(card.anims[gait])

  // Si dispara muy seguido, la animacion de tiro se acelera para no pisarse.
  const shootSpeed = Math.max(1, motion.length / Math.max(0.3, (card.fireMs / 1000) * 0.9))
  const speed =
    act === 'mover'
      ? paceRef.current.anim * Math.max(0.7, card.speed)
      : act === 'disparar'
        ? shootSpeed
        : act === 'morir'
          ? 0.55
          : 1

  const handleDone = () => {
    const current = actRef.current
    if (current === 'morir') {
      setAct('roto')
      // La escena lo oye y le pone la camara lenta, la onda de choque y las astillas.
      battle.events.push({ type: 'roto', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side })
    }
    else if (current === 'disparar' || current === 'impacto') setAct(unit.state === 'andar' ? 'mover' : 'quieto')
  }

  const height = useMemo(() => proportions(card.look).H, [card.look])

  return (
    <group ref={group} position={[unit.x, 0, unit.z]} rotation={[0, unit.heading, 0]}>
      {act !== 'roto' && act !== 'morir' && (
        <>
          {/* Peana con el color del bando: un disco macizo y un aro grueso, que se ven desde lejos */}
          <UnitBase color={color} />
          {torre && <Empalizada color={color} guardian={unit.estilo.cuerpo !== undefined} rango={rangoDeTorre(card)} />}
          {(rareza === 'epica' || rareza === 'divina') && <AuraRareza color={rarityInfo(rareza).color} grande={rareza === 'divina'} />}
        </>
      )}
      {act === 'roto' ? (
        <group scale={UNIT_SCALE * tam}>
          <DollDebris
            look={look}
            lite
            camaraLenta
            escala={battle}
            style={burst}
            pose={restPose}
          />
        </group>
      ) : (
        <group scale={UNIT_SCALE * tam} position={[0, torre ? 0.93 : 0, 0]}>
          <group ref={poseRef}>
          <group ref={body}>
            <DollBody
              look={look}
              lite
              escala={battle}
              motion={motion}
              playing
              speed={speed}
              onDone={handleDone}
            />
          </group>
          </group>
        </group>
      )}
      {act !== 'roto' && act !== 'morir' && torre && (
        <BarraTorre unit={unit} battle={battle} y={height * UNIT_SCALE * tam + 0.93 + 0.95} color={color} />
      )}
      {act !== 'roto' && act !== 'morir' && <EstadosUnidad unit={unit} battle={battle} alto={height * UNIT_SCALE * tam + (torre ? 0.93 : 0)} color={color} />}
      {act !== 'roto' && act !== 'morir' && (
        // La barra de escudos del bando: una sola imagen por soldado.
        <UnitBadge escudos={shields} maximo={Math.max(unit.maxShields, unit.baseShields)} color={color} y={height * UNIT_SCALE * tam + 0.45 + (torre ? 0.93 : 0)} />
      )}
    </group>
  )
}

/**
 * La empalizada de una torre: un anillo de estacas y piedras alrededor del soldado, con banderines
 * de su bando. Los guardianes (cuerpo a cuerpo) llevan ademas un escudo grande clavado delante.
 */
function Empalizada({ color, guardian, rango }: { color: string; guardian: boolean; rango: number }) {
  // Las estacas se ponen fuera del muñeco: el soldado queda encima de su atalaya, dentro.
  const estacas = 12
  return (
    <group>
      {/* El rango que protege, siempre a la vista: disco suave y borde del color del bando */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[rango, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <ringGeometry args={[rango - 0.16, rango, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* La atalaya: tablado de madera alto sobre cuatro patas, con la barandilla de estacas */}
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.16, 12]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        return (
          <mesh key={`pata-${i}`} position={[Math.cos(a) * 1.0, 0.42, Math.sin(a) * 1.0]}>
            <boxGeometry args={[0.18, 0.84, 0.18]} />
            <meshStandardMaterial color="#5e3a1a" roughness={0.9} />
          </mesh>
        )
      })}
      {Array.from({ length: estacas }).map((_, i) => {
        const a = (i / estacas) * Math.PI * 2
        const alta = i % 2 === 0
        const h = alta ? 0.85 : 0.6
        return (
          <group key={i} position={[Math.cos(a) * 1.25, 0.93, Math.sin(a) * 1.25]}>
            <mesh position={[0, h / 2, 0]}>
              <cylinderGeometry args={[0.08, 0.1, h, 6]} />
              <meshStandardMaterial color="#7a4a22" roughness={0.9} />
            </mesh>
            <mesh position={[0, h + 0.1, 0]}>
              <coneGeometry args={[0.09, 0.2, 6]} />
              <meshStandardMaterial color={i % 3 === 0 ? color : '#5e3a1a'} roughness={0.9} />
            </mesh>
          </group>
        )
      })}
      {/* El banderin del bando, arriba del todo */}
      <mesh position={[0, 2.6, -1.1]}>
        <cylinderGeometry args={[0.04, 0.04, 2.2, 6]} />
        <meshStandardMaterial color="#5e3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 3.4, -1.1]}>
        <boxGeometry args={[0.6, 0.36, 0.03]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {guardian && (
        <mesh position={[0, 1.5, 1.3]}>
          <cylinderGeometry args={[0.55, 0.55, 0.1, 16]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
        </mesh>
      )}
    </group>
  )
}

/**
 * La barra de tiempo de la torre: se va vaciando (verde, amarilla, roja) y al acabarse la torre
 * vuelve a ser soldado. En los ultimos segundos parpadea para avisar.
 */
const CENTRO_IZQUIERDA = new Vector2(0, 0.5)

function BarraTorre({ unit, battle, y, color }: { unit: Unit; battle: Battle; y: number; color: string }) {
  const relleno = useRef<Sprite>(null)
  const mat = useRef<SpriteMaterial>(null)
  const ANCHO = 1.9
  useFrame(() => {
    const k = Math.max(0, Math.min(1, (unit.torreHasta - battle.time) / TORRE_S))
    const r = relleno.current
    if (r) {
      r.scale.set(Math.max(0.001, ANCHO * k), 0.2, 1)
      r.position.x = -ANCHO / 2
    }
    if (mat.current) {
      mat.current.color.set(k > 0.5 ? '#4ade80' : k > 0.2 ? '#facc15' : '#ef4444')
      mat.current.opacity = k > 0.2 ? 1 : 0.55 + Math.abs(Math.sin(battle.time * 8)) * 0.45
    }
  })
  return (
    <group position={[0, y, 0]}>
      <sprite scale={[ANCHO + 0.12, 0.32, 1]} renderOrder={21}>
        <spriteMaterial color="#0b0f17" transparent opacity={0.85} depthTest={false} toneMapped={false} />
      </sprite>
      <sprite ref={relleno} center={CENTRO_IZQUIERDA} renderOrder={22}>
        <spriteMaterial ref={mat} transparent depthTest={false} toneMapped={false} />
      </sprite>
      {/* Un puntito del color del bando, para que se sepa de quien es */}
      <sprite position={[-ANCHO / 2 - 0.22, 0, 0]} scale={[0.22, 0.22, 1]} renderOrder={22}>
        <spriteMaterial color={color} depthTest={false} toneMapped={false} />
      </sprite>
    </group>
  )
}
