import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { BoxGeometry, CircleGeometry, DoubleSide, RingGeometry, Vector2 } from 'three'
import type { Group, Material, Mesh, Sprite, SpriteMaterial } from 'three'
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
import { personalidadDe } from './personalidad'
import type { Personalidad } from './personalidad'
import { EstadosUnidad, aplicarPose } from './PosesHabilidad'

type Act = 'mover' | 'quieto' | 'disparar' | 'impacto' | 'caer' | 'morir' | 'roto'

const QUIETO = motionById('quieto')
/** Los muñecos del campo van algo mas grandes que a escala: asi tienen presencia. */
export const UNIT_SCALE = 2.15

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

/**
 * La copia a medias (transparente) de un material, para un muñeco entre el humo. Los materiales de
 * los muñecos son de todos (uno para todo el ejército): si se tocara el de verdad, se pondrían a
 * medias todos a la vez. Así solo cambia el que está en el humo.
 */
const fantasmas = new WeakMap<Material, Material>()
function fantasmaDe(material: Material): Material {
  let copia = fantasmas.get(material)
  if (!copia) {
    copia = material.clone()
    copia.onBeforeCompile = material.onBeforeCompile
    copia.transparent = true
    copia.opacity = material.opacity * 0.4
    copia.depthWrite = false
    fantasmas.set(material, copia)
  }
  return copia
}

/**
 * Su animación de ataque: la del vaquero va con su manera de pelear (el francotirador, rodilla en
 * tierra; la ráfaga, sin bajar el brazo; el de escopeta, a la cadera; el de cuerpo a cuerpo, a
 * golpes…). Los vikingos y los indios ya traen la suya (hachazos, flechas).
 */
function ataqueDe(card: Unit['card'], unit: Unit): string {
  if (card.clase && card.clase !== 'vaqueros') return card.anims.disparar
  return personalidadDe(unit.estilo).ataque
}

const ARO_RECARGA = new RingGeometry(0.46, 0.64, 32)
const FONDO_RECARGA = new CircleGeometry(0.72, 32)
const BALITA = new BoxGeometry(0.1, 0.22, 0.1)

/**
 * **Recargando**: un aro amarillo encima de la cabeza que se va llenando (y unas balas que giran
 * dentro). Así se ve que está metiendo balas, no que se ha quedado congelado.
 */
function Recarga({ unit, y }: { unit: Unit; y: number }) {
  const grupo = useRef<Group>(null)
  const aro = useRef<Mesh>(null)
  const balas = useRef<Group>(null)
  // Cada uno el suyo (se pinta a trozos según su recarga).
  const geometria = useMemo(() => ARO_RECARGA.clone(), [])
  useEffect(() => () => geometria.dispose(), [geometria])
  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const recarga = unit.reloadLeft > 0 && unit.state !== 'muerto'
    g.visible = recarga
    if (!recarga) return
    const k = 1 - unit.reloadLeft / Math.max(0.1, unit.recargaS)
    // Cada trozo del aro son 6 índices: se pinta hasta donde va la recarga.
    aro.current?.geometry.setDrawRange(0, Math.max(6, Math.floor(32 * k) * 6))
    if (balas.current) balas.current.rotation.z -= dt * 5
  })
  return (
    <Billboard ref={grupo} position={[0, y, 0]} visible={false}>
      <mesh geometry={FONDO_RECARGA} renderOrder={22}>
        <meshBasicMaterial color="#120a04" transparent opacity={0.8} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={aro} geometry={geometria} rotation={[0, 0, Math.PI / 2]} scale={[-1, 1, 1]} renderOrder={23}>
        <meshBasicMaterial color="#fbbf24" transparent depthTest={false} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </mesh>
      <group ref={balas}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={BALITA} position={[Math.cos((i * Math.PI * 2) / 3) * 0.2, Math.sin((i * Math.PI * 2) / 3) * 0.2, 0]} renderOrder={23}>
            <meshBasicMaterial color="#fde68a" transparent depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </Billboard>
  )
}

interface Manera {
  fase: number
  /** Segundos desde su último ataque. */
  ataque: number
  giro: number
  tiros: number
}

/**
 * Mueve el muñeco **a su manera**, por encima de su animación: los saltitos y el giro de la
 * bailarina, los pisotones del tanque, la inclinación del que corre, el temblor del kamikaze, el
 * retroceso del cañonazo o la embestida del de cuerpo a cuerpo al pegar.
 */
function moverseASuManera(g: Group, m: Manera, per: Personalidad, unit: Unit, act: Act, pace: Pace, dt: number, escala: number) {
  // (Va dentro del muñeco ya agrandado: los metros se pasan a su tamaño.)
  const metro = 1 / escala
  if (unit.shotCount !== m.tiros) {
    m.tiros = unit.shotCount
    m.ataque = 0
  }
  m.ataque += dt
  const anda = act === 'mover'
  const dispara = unit.state === 'fuego'
  m.fase += dt * (anda ? 6.5 * per.ritmo * Math.max(0.7, unit.card.speed) * pace.anim : 1.6)
  const paso = Math.sin(m.fase)
  const ATAQUE_S = 0.38
  const k = m.ataque < ATAQUE_S ? m.ataque / ATAQUE_S : 1
  const golpe = 1 - k
  const pico = Math.sin(k * Math.PI)
  const flota = per.flota ? per.flota * (0.75 + 0.25 * Math.sin(m.fase * 0.45)) : 0
  g.position.y = (flota + (anda ? per.salto * Math.abs(paso) : 0)) * metro
  // Delante es +z: el tiro le echa para atrás; el golpe de cerca le lanza hacia delante.
  g.position.z = (-per.retroceso * golpe * golpe + per.embestida * pico) * metro
  const temblor = per.temblor + (dispara ? per.temblorAlDisparar : 0)
  g.position.x = temblor ? (Math.random() - 0.5) * 2 * temblor * metro : 0
  g.rotation.z = (anda ? 1 : 0.3) * per.balanceo * paso
  g.rotation.x = per.inclina * (anda ? 1 : 0.4)
  // Recargando: mira el arma (cabeza gacha) y la menea, metiendo balas.
  if (unit.reloadLeft > 0) {
    g.rotation.x = 0.32
    g.rotation.z = Math.sin(m.fase * 3) * 0.06
    g.position.y += Math.abs(Math.sin(m.fase * 3)) * 0.04 * metro
  }
  if (per.giro && anda) m.giro += dt * per.giro
  if (per.giroAlAtacar && m.ataque < ATAQUE_S * 1.3) m.giro += dt * 17
  else if (!anda) m.giro -= wrapAngle(m.giro) * Math.min(1, dt * 7)
  g.rotation.y = m.giro
  // En cada paso se aplasta un poco (y se ensancha): pisa fuerte.
  const pisa = anda && per.pisoton ? per.pisoton * Math.max(0, -Math.cos(m.fase * 2)) : 0
  g.scale.set(1 + pisa * 0.6, per.agacha * (1 - pisa), 1 + pisa * 0.6)
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
  /** Su manera de andar y de pegar (ver `personalidad.ts`): lo que hace que se le reconozca. */
  const andares = useRef<Group>(null)
  const manera = useRef({ fase: Math.random() * 6, ataque: 9, giro: 0, tiros: unit.shotCount })
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
          const mesh = obj as Mesh
          if (!mesh.isMesh) return
          const datos = mesh.userData as { original?: Material }
          if (ghosted) {
            const material = mesh.material
            if (!material || Array.isArray(material) || datos.original) return
            datos.original = material
            mesh.material = fantasmaDe(material)
          } else if (datos.original) {
            mesh.material = datos.original
            delete datos.original
          }
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
    if (andares.current) moverseASuManera(andares.current, manera.current, personalidadDe(unit.estilo), unit, actRef.current, paceRef.current, dt, UNIT_SCALE * tam)
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
      ? motionById(ataqueDe(card, unit))
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
          <group ref={andares}>
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
        </group>
      )}
      {act !== 'roto' && act !== 'morir' && torre && (
        <BarraTorre unit={unit} battle={battle} y={height * UNIT_SCALE * tam + 0.93 + 0.95} color={color} />
      )}
      {act !== 'roto' && act !== 'morir' && <EstadosUnidad unit={unit} battle={battle} alto={height * UNIT_SCALE * tam + (torre ? 0.93 : 0)} color={color} />}
      {act !== 'roto' && act !== 'morir' && <Recarga unit={unit} y={height * UNIT_SCALE * tam + 1.7 + (torre ? 0.93 : 0)} />}
      {act !== 'roto' && act !== 'morir' && (
        // La barra de escudos del bando: una sola imagen por soldado.
        <UnitBadge
          escudos={shields}
          maximo={Math.max(unit.maxShields, unit.baseShields)}
          color={color}
          y={height * UNIT_SCALE * tam + 0.45 + (torre ? 0.93 : 0)}
        />
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
