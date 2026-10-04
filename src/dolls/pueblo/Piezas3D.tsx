import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, DoubleSide, SRGBColorSpace } from 'three'
import type { Group, Mesh, MeshBasicMaterial } from 'three'
import { motionById } from '../animations'
import type { Motion } from '../animations'
import { DollBody } from '../DollBody'
import type { BattleCard } from '../cards/model'
import { movimientoDeDibujo } from '../game/animacionDibujada'
import type { FichaDeBuscado } from '../game/ranking'

/**
 * **Las piezas hechas a mano del pueblo y del desierto**: el vaquero que manejas, la gente que hay
 * por la calle, el tablón de anuncios, las dianas, el tablón de carteles del cañón, las banderas…
 * (los edificios son los modelos del pack Western).
 */

/** Lo alto que sale un muñeco por la calle (los de la batalla son más grandes). */
export const ESCALA_MUNECO = 1.75

// ---------------------------------------------------------------------------
// Texturas con letras (en la letra del Oeste)
// ---------------------------------------------------------------------------

/** Cuando la letra 'Rye' ya está cargada (si no, se pinta con la de reserva y luego se repinta). */
function useLetraLista(): boolean {
  const [lista, setLista] = useState(() => typeof document !== 'undefined' && document.fonts?.check?.('40px Rye'))
  useEffect(() => {
    if (lista || !document.fonts) return
    let vivo = true
    document.fonts
      .load('40px Rye')
      .then(() => vivo && setLista(true))
      .catch(() => undefined)
    return () => {
      vivo = false
    }
  }, [lista])
  return Boolean(lista)
}

/** Un papel o una tabla pintados en un lienzo, como textura. */
function useTextura(ancho: number, alto: number, pintar: (c: CanvasRenderingContext2D) => void, claves: unknown[]) {
  const letra = useLetraLista()
  const textura = useMemo(() => {
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const c = lienzo.getContext('2d')
    if (c) pintar(c)
    const t = new CanvasTexture(lienzo)
    t.colorSpace = SRGBColorSpace
    t.anisotropy = 4
    return t
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ancho, alto, letra, ...claves])
  useEffect(() => () => textura.dispose(), [textura])
  return textura
}

/** El fondo de papel viejo, con manchas y bordes oscuros. */
function papelViejo(c: CanvasRenderingContext2D, w: number, h: number) {
  const g = c.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.75)
  g.addColorStop(0, '#f3e2b8')
  g.addColorStop(1, '#c9a46a')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  c.strokeStyle = 'rgba(80,45,15,0.55)'
  c.lineWidth = w * 0.025
  c.strokeRect(w * 0.04, h * 0.03, w * 0.92, h * 0.94)
}

/** Un cartel de SE BUSCA con un nombre (y una recompensa) escritos. */
export function useCartelSeBusca(nombre: string, abajo: string) {
  return useTextura(
    256,
    340,
    (c) => {
      papelViejo(c, 256, 340)
      c.fillStyle = '#2a1a10'
      c.textAlign = 'center'
      c.font = '44px Rye, Georgia, serif'
      c.fillText('SE BUSCA', 128, 62)
      // El retrato: un vaquero en silueta.
      c.fillStyle = '#5b3a1c'
      c.fillRect(58, 84, 140, 130)
      c.fillStyle = '#e8cf9c'
      c.beginPath()
      c.arc(128, 160, 34, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#2a1a10'
      c.fillRect(78, 112, 100, 14)
      c.fillRect(100, 92, 56, 26)
      c.font = `${nombre.length > 10 ? 22 : 28}px Rye, Georgia, serif`
      c.fillText(nombre.toUpperCase().slice(0, 16), 128, 250)
      c.font = 'bold 22px Georgia, serif'
      c.fillStyle = '#7a2d0c'
      c.fillText(abajo, 128, 292)
    },
    [nombre, abajo],
  )
}

/** Una nota clavada (los encargos): tres rayas de letra y un sello. */
function useNota(texto: string, hecho: boolean) {
  return useTextura(
    200,
    150,
    (c) => {
      papelViejo(c, 200, 150)
      c.fillStyle = '#2a1a10'
      c.font = '22px Rye, Georgia, serif'
      c.textAlign = 'center'
      c.fillText(texto, 100, 44)
      c.fillStyle = 'rgba(42,26,16,0.45)'
      for (let i = 0; i < 3; i++) c.fillRect(30, 66 + i * 20, 140 - i * 26, 5)
      if (hecho) {
        c.save()
        c.translate(140, 110)
        c.rotate(-0.3)
        c.strokeStyle = '#15803d'
        c.lineWidth = 5
        c.strokeRect(-46, -20, 92, 40)
        c.fillStyle = '#15803d'
        c.font = 'bold 20px Georgia, serif'
        c.fillText('¡LISTO!', 0, 8)
        c.restore()
      }
    },
    [texto, hecho],
  )
}

/** Un letrero de madera con letras talladas. */
export function useLetrero(texto: string, ancho = 512, alto = 128) {
  return useTextura(
    ancho,
    alto,
    (c) => {
      const g = c.createLinearGradient(0, 0, 0, alto)
      g.addColorStop(0, '#8a5a2b')
      g.addColorStop(1, '#5c3a1c')
      c.fillStyle = g
      c.fillRect(0, 0, ancho, alto)
      c.strokeStyle = 'rgba(0,0,0,0.25)'
      c.lineWidth = 3
      for (let y = alto / 4; y < alto; y += alto / 4) {
        c.beginPath()
        c.moveTo(0, y)
        c.lineTo(ancho, y + 4)
        c.stroke()
      }
      c.strokeStyle = '#2a1a10'
      c.lineWidth = 10
      c.strokeRect(5, 5, ancho - 10, alto - 10)
      c.font = `${Math.round(alto * 0.5)}px Rye, Georgia, serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = '#2a1a10'
      c.fillText(texto, ancho / 2 + 3, alto / 2 + 5)
      c.fillStyle = '#fde68a'
      c.fillText(texto, ancho / 2, alto / 2 + 2)
    },
    [texto],
  )
}

const madera = '#6b4423'
const maderaClara = '#8a5a2b'

// ---------------------------------------------------------------------------
// El tablón de anuncios del pueblo
// ---------------------------------------------------------------------------

/**
 * El tablón de anuncios de la plaza: dos postes, un tejadillo, tu cartel de SE BUSCA en el centro y
 * las notas de los encargos de hoy alrededor. Si hay alguno listo para cobrar, brilla.
 */
export function TablonDeAnuncios({
  x,
  z,
  nombre,
  recompensa,
  encargos,
}: {
  x: number
  z: number
  nombre: string
  recompensa: string
  encargos: { texto: string; hecho: boolean }[]
}) {
  const cartel = useCartelSeBusca(nombre, recompensa)
  const hayListo = encargos.some((e) => e.hecho)
  const brillo = useRef<MeshBasicMaterial>(null)
  useFrame((state) => {
    if (brillo.current) brillo.current.opacity = hayListo ? 0.25 + Math.abs(Math.sin(state.clock.elapsedTime * 3)) * 0.35 : 0
  })
  return (
    <group position={[x, 0, z]}>
      {/* Postes y tejadillo */}
      {[-2.15, 2.15].map((px) => (
        <mesh key={px} position={[px, 1.9, 0]}>
          <boxGeometry args={[0.22, 3.8, 0.22]} />
          <meshLambertMaterial color={madera} />
        </mesh>
      ))}
      <mesh position={[0, 3.95, 0.1]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[5, 0.12, 1.1]} />
        <meshLambertMaterial color="#4a2c14" />
      </mesh>
      {/* El tablero */}
      <mesh position={[0, 2.3, 0]}>
        <boxGeometry args={[4.2, 2.6, 0.12]} />
        <meshLambertMaterial color={maderaClara} />
      </mesh>
      {/* El brillo de "hay algo que cobrar" */}
      <mesh position={[0, 2.3, 0.07]}>
        <planeGeometry args={[4.5, 2.9]} />
        <meshBasicMaterial ref={brillo} color="#fde047" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Tu cartel */}
      <mesh position={[0, 2.3, 0.08]} rotation={[0, 0, 0.02]}>
        <planeGeometry args={[1.45, 1.93]} />
        <meshBasicMaterial map={cartel} toneMapped={false} />
      </mesh>
      {/* Las notas de los encargos */}
      {encargos.slice(0, 4).map((e, i) => (
        <Nota key={i} texto={e.texto} hecho={e.hecho} x={i < 2 ? -1.45 : 1.45} y={i % 2 === 0 ? 2.85 : 1.75} giro={(i % 2 ? -1 : 1) * 0.06} />
      ))}
    </group>
  )
}

function Nota({ texto, hecho, x, y, giro }: { texto: string; hecho: boolean; x: number; y: number; giro: number }) {
  const mapa = useNota(texto, hecho)
  return (
    <group position={[x, y, 0.08]} rotation={[0, 0, giro]}>
      <mesh>
        <planeGeometry args={[1.05, 0.79]} />
        <meshBasicMaterial map={mapa} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.33, 0.01]}>
        <circleGeometry args={[0.05, 10]} />
        <meshBasicMaterial color="#b91c1c" />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Letreros, dianas, carteles del cañón, bandera
// ---------------------------------------------------------------------------

/** Un letrero de madera: con sus dos postes, o clavado en una fachada (`postes={false}`). */
export function Letrero({
  x,
  z,
  texto,
  ancho = 4,
  y = 3.2,
  postes = true,
}: {
  x: number
  z: number
  texto: string
  ancho?: number
  y?: number
  postes?: boolean
}) {
  const mapa = useLetrero(texto)
  return (
    <group position={[x, 0, z]}>
      {postes && [-ancho / 2 + 0.15, ancho / 2 - 0.15].map((px) => (
        <mesh key={px} position={[px, y / 2, -0.05]}>
          <boxGeometry args={[0.16, y + 0.4, 0.16]} />
          <meshLambertMaterial color={madera} />
        </mesh>
      ))}
      <mesh position={[0, y, 0.04]}>
        <planeGeometry args={[ancho, ancho / 4]} />
        <meshBasicMaterial map={mapa} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** Una diana de tiro clavada en un poste. */
export function Diana({ x, z, giro = 0 }: { x: number; z: number; giro?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, giro, 0]}>
      <mesh position={[0, 0.9, -0.08]}>
        <boxGeometry args={[0.14, 1.8, 0.14]} />
        <meshLambertMaterial color={madera} />
      </mesh>
      {['#f8fafc', '#b91c1c', '#f8fafc', '#b91c1c', '#facc15'].map((color, i) => (
        <mesh key={i} position={[0, 1.75, 0.01 * i]}>
          <circleGeometry args={[0.75 - i * 0.15, 28]} />
          <meshLambertMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

/** El tablón del cañón: cinco carteles de SE BUSCA, uno por incursión de la hora. */
export function TablonDelCanon({ x, z, nombres }: { x: number; z: number; nombres: string[] }) {
  return (
    <group position={[x, 0, z]}>
      {[-2.2, 2.2].map((px) => (
        <mesh key={px} position={[px, 1.4, -0.05]}>
          <boxGeometry args={[0.2, 2.8, 0.2]} />
          <meshLambertMaterial color={madera} />
        </mesh>
      ))}
      <mesh position={[0, 1.9, -0.06]}>
        <boxGeometry args={[4.8, 1.7, 0.1]} />
        <meshLambertMaterial color="#5c3a1c" />
      </mesh>
      {nombres.slice(0, 5).map((nombre, i) => (
        <CartelPequeno key={i} nombre={nombre} x={-1.8 + i * 0.9} giro={(i % 2 ? -1 : 1) * 0.05} />
      ))}
    </group>
  )
}

function CartelPequeno({ nombre, x, giro }: { nombre: string; x: number; giro: number }) {
  const mapa = useCartelSeBusca(nombre, '¡RECOMPENSA!')
  return (
    <mesh position={[x, 1.9, 0.01]} rotation={[0, 0, giro]}>
      <planeGeometry args={[0.78, 1.04]} />
      <meshBasicMaterial map={mapa} toneMapped={false} />
    </mesh>
  )
}

/** Una bandera que ondea en lo alto de un mástil. */
export function Bandera({ x, z, alto = 11, color = '#e879f9' }: { x: number; z: number; alto?: number; color?: string }) {
  const tela = useRef<Mesh>(null)
  useFrame((state) => {
    if (!tela.current) return
    const t = state.clock.elapsedTime
    tela.current.rotation.y = Math.sin(t * 2.4) * 0.25
    tela.current.scale.x = 1 + Math.sin(t * 5) * 0.05
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, alto / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.08, alto, 6]} />
        <meshLambertMaterial color="#3b2410" />
      </mesh>
      <mesh ref={tela} position={[0.75, alto - 0.6, 0]}>
        <planeGeometry args={[1.5, 0.95]} />
        <meshLambertMaterial color={color} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/** Una rodadora que cruza la calle de vez en cuando (para que el pueblo tenga vida). */
export function RodadoraDeLaCalle({ desde, hasta }: { desde: number; hasta: number }) {
  const g = useRef<Group>(null)
  const estado = useRef({ x: desde, z: 7, espera: 4, va: false })
  useFrame((state, raw) => {
    const dt = Math.min(0.05, raw)
    const s = estado.current
    const grupo = g.current
    if (!grupo) return
    if (!s.va) {
      grupo.visible = false
      s.espera -= dt
      if (s.espera <= 0) {
        s.va = true
        s.x = desde
        s.z = 2 + Math.random() * 9
      }
      return
    }
    s.x += dt * 4.2
    const t = state.clock.elapsedTime
    grupo.visible = true
    grupo.position.set(s.x, 0.45 + Math.abs(Math.sin(t * 4)) * 0.5, s.z + Math.sin(t * 0.8) * 0.6)
    grupo.rotation.z = -t * 5
    if (s.x > hasta) {
      s.va = false
      s.espera = 14 + Math.random() * 18
    }
  })
  return (
    <group ref={g} visible={false}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} rotation={[i * 0.7, i * 1.1, i * 0.4]}>
          <torusGeometry args={[0.45, 0.04, 4, 12]} />
          <meshLambertMaterial color={i % 2 ? '#a16207' : '#78350f'} />
        </mesh>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// La gente: tu vaquero y los del pueblo
// ---------------------------------------------------------------------------

const QUIETO = motionById('quieto')

/**
 * Tu vaquero: el muñeco de tu retrato, que anda, corre o se queda quieto. Lo mueve la escena (su
 * grupo); aquí solo se elige la animación.
 */
export function MunecoQueAnda({ card, paso }: { card: BattleCard; paso: 'quieto' | 'andar' | 'correr' }) {
  const motion = paso === 'quieto' ? QUIETO : motionById(paso === 'andar' ? card.anims.andar : card.anims.correr)
  return <DollBody look={card.look} motion={motion} playing speed={paso === 'correr' ? 1.25 : 1.1} scale={ESCALA_MUNECO} />
}

/** Uno del pueblo: quieto en su sitio, mirando a la calle, con su sombra. */
export function Vecino({ card, x, z, giro = 0 }: { card: BattleCard; x: number; z: number; giro?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, giro, 0]}>
      <Sombra />
      <DollBody look={card.look} motion={QUIETO} playing lite scale={ESCALA_MUNECO} />
    </group>
  )
}

/** La sombra redonda bajo un muñeco. */
export function Sombra({ r = 0.75 }: { r?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
      <circleGeometry args={[r, 20]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  )
}

/** La marca del suelo a donde va el vaquero: un aro dorado que late. */
export function MarcaDeDestino({ destino }: { destino: { current: { x: number; z: number } | null } }) {
  const g = useRef<Group>(null)
  useFrame((state) => {
    const grupo = g.current
    if (!grupo) return
    const d = destino.current
    grupo.visible = Boolean(d)
    if (!d) return
    grupo.position.set(d.x, 0.06, d.z)
    const k = (state.clock.elapsedTime * 1.6) % 1
    grupo.scale.setScalar(0.6 + k * 0.6)
    const aro = grupo.children[0] as Mesh | undefined
    if (aro) (aro.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
  })
  return (
    <group ref={g} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial color="#fde047" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color="#fde047" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Los Más Buscados: la tarima de la plaza con los cinco mejores
// ---------------------------------------------------------------------------

/** Lo alto que es la tarima. */
const TARIMA = 0.35

/** Cada puesto de la tarima: donde va, lo alto de su pedestal, su color y lo grande del muñeco. */
const PUESTOS = [
  { puesto: 1, x: 0, alto: 0.8, color: '#d4a017', escala: 1.12 },
  { puesto: 2, x: -1.9, alto: 0.52, color: '#b8c0c8', escala: 1 },
  { puesto: 3, x: 1.9, alto: 0.52, color: '#b0703a', escala: 1 },
  { puesto: 4, x: -3.75, alto: 0.28, color: '#7a4a26', escala: 0.95 },
  { puesto: 5, x: 3.75, alto: 0.28, color: '#7a4a26', escala: 0.95 },
] as const

/** El cartel de SE BUSCA de un puesto: su número, su nombre, su rango y lo que vale su cabeza. */
function useCartelDelBuscado(puesto: number, nombre: string | null, rango: string, monedas: number) {
  return useTextura(
    256,
    340,
    (c) => {
      papelViejo(c, 256, 340)
      c.textAlign = 'center'
      c.fillStyle = '#2a1a10'
      c.font = '42px Rye, Georgia, serif'
      c.fillText('SE BUSCA', 128, 58)
      c.font = 'bold 15px Georgia, serif'
      c.fillText(nombre ? 'VIVO O MUERTO' : 'SE ADMITEN CANDIDATOS', 128, 82)
      // El número del puesto, como un sello rojo.
      c.save()
      c.translate(128, 150)
      c.rotate(-0.12)
      c.strokeStyle = '#9f1d1d'
      c.lineWidth = 6
      c.beginPath()
      c.arc(0, 0, 50, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#9f1d1d'
      c.font = '62px Rye, Georgia, serif'
      c.textBaseline = 'middle'
      c.fillText(nombre ? `Nº${puesto}` : '?', 0, 4)
      c.restore()
      c.fillStyle = '#2a1a10'
      const texto = (nombre ?? '¿Tú?').toUpperCase().slice(0, 14)
      c.font = `${texto.length > 9 ? 24 : 32}px Rye, Georgia, serif`
      c.fillText(texto, 128, 240)
      c.font = 'bold 18px Georgia, serif'
      c.fillStyle = '#5b3a1c'
      c.fillText(nombre ? rango : 'Juega partidas de rango', 128, 270)
      c.fillStyle = '#7a2d0c'
      c.font = 'bold 24px Georgia, serif'
      c.fillText(nombre ? `${monedas} MONEDAS` : 'SITIO LIBRE', 128, 306)
    },
    [puesto, nombre, rango, monedas],
  )
}

/** La chapa con el número en el pedestal. */
function useChapa(puesto: number) {
  return useTextura(
    128,
    128,
    (c) => {
      c.fillStyle = '#1a0f06'
      c.beginPath()
      c.arc(64, 64, 62, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#fde68a'
      c.font = '78px Rye, Georgia, serif'
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(String(puesto), 64, 70)
    },
    [puesto],
  )
}

/** La corona dorada que flota y gira encima del número uno. */
function Corona({ y }: { y: number }) {
  const g = useRef<Group>(null)
  useFrame((state) => {
    if (!g.current) return
    g.current.rotation.y = state.clock.elapsedTime * 1.2
    g.current.position.y = y + Math.sin(state.clock.elapsedTime * 2) * 0.08
  })
  return (
    <group ref={g} position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[0.32, 0.28, 0.2, 18, 1, true]} />
        <meshStandardMaterial color="#facc15" metalness={0.8} roughness={0.25} emissive="#7a5200" side={DoubleSide} />
      </mesh>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3]}>
            <coneGeometry args={[0.07, 0.22, 6]} />
            <meshStandardMaterial color="#facc15" metalness={0.8} roughness={0.25} emissive="#7a5200" />
          </mesh>
        )
      })}
      <mesh position={[0, 0.02, 0.29]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  )
}

/** El muñeco de un buscado: hace su animación dibujada (si tiene) o se queda en su pose. */
function MunecoBuscado({ ficha, escala }: { ficha: FichaDeBuscado; escala: number }) {
  const motion: Motion = useMemo(() => (ficha.animacion ? movimientoDeDibujo(ficha.animacion, true) : QUIETO), [ficha.animacion])
  // Ligeros (pocas mallas), como la gente de la calle: son cinco y en el móvil pesan.
  return <DollBody look={ficha.look} motion={motion} playing lite scale={ESCALA_MUNECO * escala} />
}

function Puesto({ sitio, ficha }: { sitio: (typeof PUESTOS)[number]; ficha: FichaDeBuscado | undefined }) {
  const cartel = useCartelDelBuscado(sitio.puesto, ficha?.nombre ?? null, ficha ? `${ficha.rango.icon} ${ficha.rango.label}` : '', ficha?.monedas ?? 0)
  const chapa = useChapa(sitio.puesto)
  const arriba = TARIMA + sitio.alto
  // Los carteles van en lo alto de la pared, por encima de los sombreros (el nº1, más arriba).
  const cartelY = sitio.puesto === 1 ? 5.15 : 4.75
  const metal = sitio.puesto <= 3
  return (
    <group position={[sitio.x, 0, 0]}>
      {/* El pedestal, con su chapa delante */}
      <mesh position={[0, TARIMA + sitio.alto / 2, 0.1]}>
        <cylinderGeometry args={[0.66, 0.74, sitio.alto, 24]} />
        {metal ? (
          <meshStandardMaterial color={sitio.color} metalness={0.65} roughness={0.35} />
        ) : (
          <meshLambertMaterial color={sitio.color} />
        )}
      </mesh>
      <mesh position={[0, TARIMA + sitio.alto / 2, 0.85]}>
        <circleGeometry args={[Math.min(0.2, sitio.alto * 0.42), 20]} />
        <meshBasicMaterial map={chapa} toneMapped={false} />
      </mesh>
      {/* El cartel de SE BUSCA, clavado en la pared de detrás */}
      <mesh position={[0, cartelY, -1.08]} rotation={[0, 0, sitio.puesto % 2 === 0 ? 0.03 : -0.03]}>
        <planeGeometry args={[1.3, 1.73]} />
        <meshBasicMaterial map={cartel} toneMapped={false} />
      </mesh>
      <mesh position={[0, cartelY + 0.78, -1.06]}>
        <circleGeometry args={[0.05, 10]} />
        <meshBasicMaterial color="#b91c1c" />
      </mesh>
      {sitio.puesto === 1 && ficha && <Corona y={cartelY + 1.15} />}
      {/* El muñeco, encima de su pedestal */}
      {ficha && (
        <group position={[0, arriba, 0.1]}>
          <Sombra r={0.55} />
          <MunecoBuscado ficha={ficha} escala={sitio.escala} />
        </group>
      )}
    </group>
  )
}

/**
 * **La tarima de Los Más Buscados**, en medio de la plaza: una pared de tablas con el letrero, cinco
 * pedestales (oro, plata, bronce y dos de madera) y encima de cada uno el muñeco del jugador tal y
 * como va vestido, con su cartel de SE BUSCA detrás. Los huecos que falten esperan candidato.
 */
export function SalonDeLosBuscados({ x, z, fichas }: { x: number; z: number; fichas: FichaDeBuscado[] }) {
  const letrero = useLetrero('LOS MÁS BUSCADOS', 1024, 150)
  return (
    <group position={[x, 0, z]}>
      {/* La tarima y su escalón */}
      <mesh position={[0, TARIMA / 2, 0]}>
        <boxGeometry args={[9.6, TARIMA, 2.6]} />
        <meshLambertMaterial color={maderaClara} />
      </mesh>
      <mesh position={[0, TARIMA / 4, 1.5]}>
        <boxGeometry args={[3.2, TARIMA / 2, 0.5]} />
        <meshLambertMaterial color={madera} />
      </mesh>
      {/* La pared de tablas */}
      <mesh position={[0, TARIMA + 3, -1.2]}>
        <boxGeometry args={[9.6, 6, 0.18]} />
        <meshLambertMaterial color="#5c3a1c" />
      </mesh>
      {[-2, -0.5, 1, 2.5].map((y) => (
        <mesh key={y} position={[0, TARIMA + 3 + y, -1.1]}>
          <boxGeometry args={[9.6, 0.05, 0.02]} />
          <meshLambertMaterial color="#3b2410" />
        </mesh>
      ))}
      {/* Los postes y el tejadillo */}
      {[-4.85, 4.85].map((px) => (
        <mesh key={px} position={[px, 3.45, -1.1]}>
          <boxGeometry args={[0.26, 6.9, 0.26]} />
          <meshLambertMaterial color={madera} />
        </mesh>
      ))}
      <mesh position={[0, 6.95, -0.75]} rotation={[0.32, 0, 0]}>
        <boxGeometry args={[10.4, 0.14, 1.3]} />
        <meshLambertMaterial color="#4a2c14" />
      </mesh>
      {/* El letrero de arriba */}
      <mesh position={[0, 7.8, -0.95]}>
        <planeGeometry args={[7.6, 7.6 * (150 / 1024)]} />
        <meshBasicMaterial map={letrero} toneMapped={false} side={DoubleSide} />
      </mesh>
      {PUESTOS.map((sitio) => (
        <Puesto key={sitio.puesto} sitio={sitio} ficha={fichas[sitio.puesto - 1]} />
      ))}
    </group>
  )
}
