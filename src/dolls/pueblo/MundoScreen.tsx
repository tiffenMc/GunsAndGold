import { Html } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject, ReactNode } from 'react'
import { AdditiveBlending } from 'three'
import type { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { Icono } from '../Icono'
import { EVENTO_ANDA } from '../tutorial/TourDeMenus'
import type { BattleCard } from '../cards/model'
import { Model } from '../scenes/models'
import { fundirDecorado } from '../scenes/Scenery'
import { MUNDOS, dondeSePuede, guardarPosicion, posicionGuardada } from './lugares'
import type { Lugar, Mundo, Sitio, Zona } from './lugares'
import {
  Bandera,
  Diana,
  Letrero,
  MarcaDeDestino,
  MunecoQueAnda,
  RodadoraDeLaCalle,
  Sombra,
  TablonDeAnuncios,
  TablonDelCanon,
  Vecino,
} from './Piezas3D'

/**
 * **El pueblo (y el desierto) en tercera persona.** Ves a tu vaquero en la calle y vas donde
 * toques: tocas el suelo y anda hasta ahí; tocas una casa (o su cartel) y va a su puerta y entra.
 * Dejando el dedo pulsado, te sigue mientras lo arrastras. Abajo hay atajos para ir a cada sitio
 * de un toque, y en el ordenador también se anda con las flechas o WASD.
 */

export interface InfoDeSitio {
  /** Una línea con lo que hay ahora (monedas, cartas, cuánto falta…). */
  texto?: string
  /** Un globito con un número (encargos para cobrar, sobres…). */
  aviso?: number
}

export interface MundoProps {
  lugar: Lugar
  /** Tu vaquero (el muñeco de tu retrato). */
  card: BattleCard
  /** La gente que hay por la calle. */
  vecinos: BattleCard[]
  /** Hay un menú abierto encima: el mundo se queda quieto (y gasta menos batería). */
  pausado: boolean
  info: Partial<Record<Zona, InfoDeSitio>>
  /** Lo del tablón de anuncios del pueblo. */
  tablon?: { nombre: string; recompensa: string; encargos: { texto: string; hecho: boolean }[] }
  /** Los nombres de las cartas de las cinco incursiones (en el tablón del cañón). */
  carteles?: string[]
  onEntrar: (zona: Zona) => void
  /** Lo que va encima (la barra de arriba). */
  children?: ReactNode
}

/** Velocidades (metros por segundo): andando y corriendo (lejos). */
const ANDA = 7.5
const CORRE = 15
/** A partir de esta distancia, corre. */
const LEJOS = 6
/** Lo que se ve el salto de los atajos antes de entrar (ms). */
const SALTO_MS = 380
/** Lo cerca que hay que estar de una puerta para que salga el botón de entrar. */
const CERCA = 2.6

interface Destino {
  x: number
  z: number
  zona?: Zona
}

/** El último salto de los atajos: donde y cuando (reloj de la página). */
export interface Salto {
  x: number
  z: number
  desde: number
}

export function MundoScreen(props: MundoProps) {
  const { lugar, pausado, onEntrar, info, children } = props
  const mundo = MUNDOS[lugar]
  // Sigue donde estaba (al volver de una partida o de la diligencia); la primera vez, en el inicio.
  const inicio = useMemo(() => posicionGuardada(lugar) ?? mundo.inicio, [lugar, mundo])
  const pos = useRef({ ...inicio })
  const destino = useRef<Destino | null>(null)
  const salto = useRef<Salto | null>(null)
  const [cerca, setCerca] = useState<Sitio | null>(null)
  const [listo, setListo] = useState(false)
  const entrar = useRef(onEntrar)
  entrar.current = onEntrar

  // Al irse (a una partida o al otro mundo), se apunta donde estaba.
  useEffect(() => () => guardarPosicion(lugar, pos.current), [lugar])

  /** Ir andando a un sitio (y entrar al llegar). Si ya está en la puerta, entra directamente. */
  const irAlSitio = (sitio: Sitio) => {
    if (Math.hypot(pos.current.x - sitio.puerta.x, pos.current.z - sitio.puerta.z) < 0.6) {
      onEntrar(sitio.zona)
      return
    }
    destino.current = { ...sitio.puerta, zona: sitio.zona }
  }

  /**
   * Los atajos de abajo: **salto** a la puerta (casi al instante, con su nube de polvo) y entra.
   * Para andar ya está el dedo; los atajos son para no esperar.
   */
  const saltarAlSitio = (sitio: Sitio) => {
    destino.current = null
    pos.current = { ...sitio.puerta }
    salto.current = { ...sitio.puerta, desde: performance.now() }
    window.setTimeout(() => entrar.current(sitio.zona), SALTO_MS)
  }

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden"
      style={{ background: `linear-gradient(180deg, #5f7fb3 0%, #b9a3a8 38%, ${mundo.cielo} 62%, ${mundo.suelo.arena} 100%)` }}
    >
      <Canvas
        dpr={[1, 1.75]}
        frameloop={pausado ? 'never' : 'always'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 50, near: 0.5, far: 260, position: [inicio.x, 12, inicio.z + 18] }}
      >
        <fog attach="fog" args={[mundo.cielo, 55, 175]} />
        <hemisphereLight args={['#ffe9c7', '#8a5a2b', 1.05]} />
        <directionalLight position={[-25, 40, 30]} intensity={1.7} color="#ffd9a8" />
        <Suelo mundo={mundo} destino={destino} pausado={pausado} />
        <Suspense fallback={null}>
          <Decorado mundo={mundo} onListo={() => setListo(true)} />
        </Suspense>
        <Extras {...props} mundo={mundo} />
        <Sitios mundo={mundo} info={info} onTocar={irAlSitio} />
        <Jugador
          mundo={mundo}
          card={props.card}
          pos={pos}
          salto={salto}
          destino={destino}
          pausado={pausado}
          onLlegar={(zona) => entrar.current(zona)}
          onCerca={setCerca}
        />
        <MarcaDeDestino destino={destino} />
        <NubeDeSalto salto={salto} />
        <Camara pos={pos} mundo={mundo} salto={salto} />
      </Canvas>

      {!listo && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="animate-pulse font-west text-xl text-amber-100" style={{ textShadow: '0 2px 6px #000' }}>
            Levantando el pueblo…
          </span>
        </div>
      )}

      {children}

      {/* Abajo: el botón de entrar (si estás en una puerta) y los atajos a cada sitio */}
      {!pausado && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-2 pb-[max(10px,env(safe-area-inset-bottom))]">
          {cerca && (
            <button
              type="button"
              onClick={() => onEntrar(cerca.zona)}
              className="boton pointer-events-auto sobre-entra flex items-center gap-2 px-5 py-2.5 text-[16px] shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
            >
              <Icono nombre={cerca.icono} /> {cerca.zona === 'diligencia' ? `Subir · ${cerca.nombre}` : `Entrar · ${cerca.nombre}`}
            </button>
          )}
          <nav
            data-tuto="atajos"
            className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-2xl border-2 border-[#6b4423] bg-[#1a0f06]/85 p-1 backdrop-blur-[2px]"
          >
            {mundo.sitios.map((sitio) => {
              const aviso = info[sitio.zona]?.aviso ?? 0
              return (
                <button
                  key={sitio.zona}
                  type="button"
                  data-tuto={`atajo-${sitio.zona}`}
                  onClick={() => saltarAlSitio(sitio)}
                  className="relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10.5px] font-bold uppercase leading-tight tracking-wide text-amber-100/85 active:scale-95"
                >
                  <span className="text-[22px]" style={{ color: sitio.color }}>
                    <Icono nombre={sitio.icono} />
                  </span>
                  {nombreCorto(sitio)}
                  {aviso > 0 && (
                    <span className="absolute right-1 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[11px] text-white">
                      {aviso}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}

function nombreCorto(sitio: Sitio): string {
  const nombres: Record<Zona, string> = {
    tablon: 'Tablón',
    bar: 'Bar',
    saloon: 'Saloon',
    sheriff: 'Sheriff',
    diligencia: sitio.icono === 'pueblo' ? 'Al pueblo' : 'Desierto',
    incursiones: 'Cañón',
    entrenar: 'Entrenar',
    rango: 'Fuerte',
  }
  return nombres[sitio.zona]
}

// ---------------------------------------------------------------------------
// El suelo (y tocarlo para andar)
// ---------------------------------------------------------------------------

function Suelo({ mundo, destino, pausado }: { mundo: Mundo; destino: MutableRefObject<Destino | null>; pausado: boolean }) {
  const apretado = useRef(false)
  useEffect(() => {
    const suelta = () => {
      apretado.current = false
    }
    window.addEventListener('pointerup', suelta)
    window.addEventListener('pointercancel', suelta)
    return () => {
      window.removeEventListener('pointerup', suelta)
      window.removeEventListener('pointercancel', suelta)
    }
  }, [])
  const ir = (e: ThreeEvent<PointerEvent>) => {
    if (pausado) return
    const p = dondeSePuede(mundo, { x: e.point.x, z: e.point.z })
    destino.current = { x: p.x, z: p.z }
    // Para quien quiera saberlo (el tutorial): el vaquero echa a andar.
    window.dispatchEvent(new Event(EVENTO_ANDA))
  }
  const [x0, x1] = mundo.limites.x
  const largo = x1 - x0 + 40
  const medio = (x0 + x1) / 2
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          apretado.current = true
          ir(e)
        }}
        onPointerMove={(e) => {
          // Con el dedo pulsado, te sigue.
          if (apretado.current) ir(e)
        }}
      >
        <planeGeometry args={[500, 500]} />
        <meshLambertMaterial color={mundo.suelo.arena} />
      </mesh>
      {/* La calle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[medio, 0.02, 5.6]}>
        <planeGeometry args={[largo, 12.4]} />
        <meshLambertMaterial color={mundo.suelo.calle} />
      </mesh>
      {/* Las rodadas de los carros */}
      {[4.2, 7.4].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[medio, 0.03, z]}>
          <planeGeometry args={[largo, 0.35]} />
          <meshLambertMaterial color="#8f6034" />
        </mesh>
      ))}
      {/* Las tablas de delante de las casas */}
      {mundo.suelo.tablas && (
        <mesh position={[-7, 0.07, -0.45]}>
          <boxGeometry args={[82, 0.14, 1.6]} />
          <meshLambertMaterial color="#7a4a26" />
        </mesh>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Los edificios y el decorado
// ---------------------------------------------------------------------------

function Decorado({ mundo, onListo }: { mundo: Mundo; onListo: () => void }) {
  const grupo = useRef<Group>(null)
  useEffect(() => {
    // Ya ha cargado todo (esto va dentro del Suspense): se funde en un par de mallas.
    if (grupo.current) fundirDecorado(grupo.current)
    onListo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mundo.lugar])
  return (
    <group ref={grupo}>
      {mundo.modelos.map((p, i) => (
        <Model key={`${p.m}-${i}`} {...p} />
      ))}
    </group>
  )
}

/** Lo hecho a mano de cada mundo: tablón, letreros, dianas, banderas… y la gente. */
function Extras(props: MundoProps & { mundo: Mundo }) {
  const { mundo, vecinos, tablon, carteles } = props
  const v = (i: number) => vecinos[i % Math.max(1, vecinos.length)]
  if (mundo.lugar === 'pueblo') {
    return (
      <>
        {tablon && <TablonDeAnuncios x={0} z={0} nombre={tablon.nombre} recompensa={tablon.recompensa} encargos={tablon.encargos} />}
        <Letrero x={-15} z={-0.3} texto="BAR" ancho={5} y={6.9} postes={false} />
        <Letrero x={-32.3} z={-0.85} texto="SHERIFF" ancho={4.2} y={4.3} postes={false} />
        <Letrero x={36.6} z={1.4} texto="DESIERTO" ancho={4} y={2.6} />
        <RodadoraDeLaCalle desde={mundo.limites.x[0] - 6} hasta={mundo.limites.x[1] + 6} />
        {vecinos.length > 0 && (
          <>
            <Vecino card={v(0)!} x={-10.6} z={1.1} giro={-0.4} />
            <Vecino card={v(1)!} x={-28.4} z={1.2} giro={-0.3} />
            <Vecino card={v(2)!} x={10.4} z={1.2} giro={0.4} />
            <Vecino card={v(3)!} x={34} z={3.4} giro={0.6} />
          </>
        )}
      </>
    )
  }
  return (
    <>
      <Letrero x={-23.6} z={1.6} texto="AL PUEBLO" ancho={4} y={2.6} />
      <Letrero x={-13} z={-3.8} texto="CAMPO DE TIRO" ancho={6} y={3.2} />
      <Letrero x={25.7} z={-1.6} texto="EL FUERTE" ancho={5} y={6.2} />
      <Diana x={-16} z={-0.6} giro={0.2} />
      <Diana x={-13} z={-1.2} />
      <Diana x={-10} z={-0.6} giro={-0.2} />
      {carteles && <TablonDelCanon x={9} z={-0.6} nombres={carteles} />}
      <Bandera x={19.5} z={-2.5} alto={12.5} color="#e879f9" />
      <Bandera x={32} z={-2.5} alto={12.5} color="#fbbf24" />
      {vecinos.length > 0 && (
        <>
          <Vecino card={v(4)!} x={-18.5} z={1.4} giro={0.5} />
          <Vecino card={v(5)!} x={13} z={0.6} giro={0.5} />
          <Vecino card={v(6)!} x={17} z={0.6} giro={-0.5} />
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Los sitios: la caja que se toca y el cartel flotante
// ---------------------------------------------------------------------------

function Sitios({ mundo, info, onTocar }: { mundo: Mundo; info: MundoProps['info']; onTocar: (sitio: Sitio) => void }) {
  return (
    <>
      {mundo.sitios.map((sitio) => {
        const dato = info[sitio.zona]
        return (
          <group key={sitio.zona}>
            <mesh
              position={[sitio.caja.x, sitio.caja.h / 2, sitio.caja.z]}
              onPointerDown={(e) => {
                e.stopPropagation()
                onTocar(sitio)
              }}
            >
              <boxGeometry args={[sitio.caja.w, sitio.caja.h, sitio.caja.d]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <Html position={[sitio.caja.x, sitio.cartelY, Math.max(sitio.caja.z, 0)]} center zIndexRange={[5, 0]}>
              <button
                type="button"
                onClick={() => onTocar(sitio)}
                className="relative flex flex-col items-center whitespace-nowrap rounded-xl border-2 bg-[#1a0f06]/85 px-2.5 py-1 text-center shadow-[0_4px_14px_rgba(0,0,0,0.55)] active:scale-95"
                style={{ borderColor: sitio.color }}
              >
                <span className="flex items-center gap-1 font-west text-[15px] leading-none text-amber-50">
                  <Icono nombre={sitio.icono} style={{ color: sitio.color }} /> {sitio.nombre}
                </span>
                <span className="mt-0.5 text-[11px] font-bold leading-none text-amber-100/75">{dato?.texto ?? sitio.lema}</span>
                {(dato?.aviso ?? 0) > 0 && (
                  <span className="tuto-latido absolute -right-2 -top-2 grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-600 px-1 text-[12px] font-black text-white">
                    {dato!.aviso}
                  </span>
                )}
                <span className="absolute -bottom-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 bg-[#1a0f06]" style={{ borderColor: sitio.color }} />
              </button>
            </Html>
          </group>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Tu vaquero
// ---------------------------------------------------------------------------

function Jugador({
  mundo,
  card,
  pos,
  salto,
  destino,
  pausado,
  onLlegar,
  onCerca,
}: {
  mundo: Mundo
  card: BattleCard
  pos: MutableRefObject<{ x: number; z: number }>
  salto: MutableRefObject<Salto | null>
  destino: MutableRefObject<Destino | null>
  pausado: boolean
  onLlegar: (zona: Zona) => void
  onCerca: (sitio: Sitio | null) => void
}) {
  const g = useRef<Group>(null)
  const [paso, setPaso] = useState<'quieto' | 'andar' | 'correr'>('quieto')
  const pasoRef = useRef(paso)
  const rumbo = useRef(0)
  const atasco = useRef(0)
  const cercaRef = useRef<Sitio | null>(null)
  const teclas = useTeclas()

  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    const p = pos.current
    let quiere: 'quieto' | 'andar' | 'correr' = 'quieto'
    // Con el teclado (ordenador): anda en la direccion de las teclas.
    const tx = (teclas.current.has('d') ? 1 : 0) - (teclas.current.has('a') ? 1 : 0)
    const tz = (teclas.current.has('s') ? 1 : 0) - (teclas.current.has('w') ? 1 : 0)
    if (!pausado && (tx || tz)) {
      destino.current = null
      const l = Math.hypot(tx, tz)
      const n = dondeSePuede(mundo, { x: p.x + (tx / l) * ANDA * dt, z: p.z + (tz / l) * ANDA * dt })
      p.x = n.x
      p.z = n.z
      rumbo.current = girarHacia(rumbo.current, Math.atan2(tx, tz), dt)
      quiere = 'andar'
    }
    const d = destino.current
    if (d && !pausado) {
      const dx = d.x - p.x
      const dz = d.z - p.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.12) {
        destino.current = null
        if (d.zona) onLlegar(d.zona)
      } else {
        const corre = dist > LEJOS
        const avance = Math.min(dist, (corre ? CORRE : ANDA) * dt)
        const n = dondeSePuede(mundo, { x: p.x + (dx / dist) * avance, z: p.z + (dz / dist) * avance })
        const movido = Math.hypot(n.x - p.x, n.z - p.z)
        // Si choca y no avanza, se para (no se queda andando contra la pared).
        atasco.current = movido < avance * 0.25 ? atasco.current + dt : 0
        if (atasco.current > 0.35) {
          destino.current = null
          atasco.current = 0
        }
        p.x = n.x
        p.z = n.z
        rumbo.current = girarHacia(rumbo.current, Math.atan2(dx, dz), dt)
        quiere = corre ? 'correr' : 'andar'
      }
    }
    if (quiere !== pasoRef.current) {
      pasoRef.current = quiere
      setPaso(quiere)
    }
    if (g.current) {
      // Recien llegado de un salto: aparece de golpe desde el suelo, mirando a la puerta.
      const tras = salto.current ? (performance.now() - salto.current.desde) / 1000 : 9
      if (tras < 0.05) rumbo.current = Math.PI
      const pop = tras < 0.35 ? Math.sin(Math.min(1, tras / 0.35) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1
      g.current.position.set(p.x, tras < 0.35 ? (1 - tras / 0.35) * 0.6 : 0, p.z)
      g.current.scale.set(1 / Math.max(0.35, pop * 0.9 + 0.1), pop, 1 / Math.max(0.35, pop * 0.9 + 0.1))
      if (tras >= 0.35) g.current.scale.setScalar(1)
      g.current.rotation.y = rumbo.current
    }
    // La puerta mas cercana (para el boton de entrar).
    let mejor: Sitio | null = null
    let mejorD = CERCA
    for (const sitio of mundo.sitios) {
      const dd = Math.hypot(sitio.puerta.x - p.x, sitio.puerta.z - p.z)
      if (dd < mejorD) {
        mejor = sitio
        mejorD = dd
      }
    }
    if (mejor !== cercaRef.current) {
      cercaRef.current = mejor
      onCerca(mejor)
    }
  })

  return (
    <group ref={g}>
      <Sombra r={0.85} />
      <MunecoQueAnda card={card} paso={paso} />
    </group>
  )
}

/**
 * La nube del salto de los atajos: un fogonazo dorado, un aro que se abre en el suelo y unas
 * bolas de polvo que salen hacia los lados.
 */
function NubeDeSalto({ salto }: { salto: MutableRefObject<Salto | null> }) {
  const g = useRef<Group>(null)
  const aro = useRef<Mesh>(null)
  const columna = useRef<Mesh>(null)
  const polvo = useRef<(Mesh | null)[]>([])
  useFrame(() => {
    const grupo = g.current
    const s = salto.current
    if (!grupo) return
    const t = s ? (performance.now() - s.desde) / 1000 : 9
    grupo.visible = t < 0.7
    if (!s || t >= 0.7) return
    grupo.position.set(s.x, 0, s.z)
    const k = t / 0.7
    if (aro.current) {
      aro.current.scale.setScalar(0.4 + k * 2.6)
      ;(aro.current.material as MeshBasicMaterial).opacity = 0.9 * (1 - k)
    }
    if (columna.current) {
      columna.current.scale.set(1 - k * 0.7, 1 + k * 0.6, 1 - k * 0.7)
      ;(columna.current.material as MeshBasicMaterial).opacity = 0.75 * (1 - k) ** 1.5
    }
    polvo.current.forEach((m, i) => {
      if (!m) return
      const a = (i / polvo.current.length) * Math.PI * 2
      const r = 0.3 + k * 1.9
      m.position.set(Math.cos(a) * r, 0.25 + Math.sin(k * Math.PI) * 0.5, Math.sin(a) * r)
      m.scale.setScalar(0.6 + k * 0.9)
      ;(m.material as MeshBasicMaterial).opacity = 0.7 * (1 - k)
    })
  })
  return (
    <group ref={g} visible={false}>
      <mesh ref={aro} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[0.7, 0.95, 36]} />
        <meshBasicMaterial color="#fde047" transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={columna} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.55, 0.9, 3.2, 20, 1, true]} />
        <meshBasicMaterial color="#fff3c4" transparent depthWrite={false} toneMapped={false} side={2} blending={AdditiveBlending} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            polvo.current[i] = m
          }}
        >
          <sphereGeometry args={[0.3, 8, 6]} />
          <meshBasicMaterial color="#e6c999" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

/** Gira poco a poco hacia un angulo (por el camino corto). */
function girarHacia(actual: number, objetivo: number, dt: number): number {
  let d = objetivo - actual
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return actual + d * Math.min(1, dt * 12)
}

/** Las teclas de andar que hay pulsadas (flechas o WASD, ya pasadas a wasd). */
function useTeclas() {
  const teclas = useRef(new Set<string>())
  useEffect(() => {
    const mapa: Record<string, string> = {
      ArrowUp: 'w',
      ArrowDown: 's',
      ArrowLeft: 'a',
      ArrowRight: 'd',
      w: 'w',
      a: 'a',
      s: 's',
      d: 'd',
      W: 'w',
      A: 'a',
      S: 's',
      D: 'd',
    }
    const baja = (e: KeyboardEvent) => {
      const t = mapa[e.key]
      if (!t || (e.target as HTMLElement | null)?.closest?.('input, textarea')) return
      teclas.current.add(t)
    }
    const sube = (e: KeyboardEvent) => {
      const t = mapa[e.key]
      if (t) teclas.current.delete(t)
    }
    const fuera = () => teclas.current.clear()
    window.addEventListener('keydown', baja)
    window.addEventListener('keyup', sube)
    window.addEventListener('blur', fuera)
    return () => {
      window.removeEventListener('keydown', baja)
      window.removeEventListener('keyup', sube)
      window.removeEventListener('blur', fuera)
    }
  }, [])
  return teclas
}

// ---------------------------------------------------------------------------
// La camara: detras y por encima, siguiendo al vaquero
// ---------------------------------------------------------------------------

function Camara({
  pos,
  mundo,
  salto,
}: {
  pos: MutableRefObject<{ x: number; z: number }>
  mundo: Mundo
  salto: MutableRefObject<Salto | null>
}) {
  const { camera, size } = useThree()
  const mira = useRef({ x: pos.current.x, z: pos.current.z })
  const ultimoSalto = useRef<Salto | null>(null)
  useEffect(() => {
    // En vertical (movil) se ve menos de ancho: la camara se aleja y abre un poco el angulo.
    const cam = camera as PerspectiveCamera
    cam.fov = size.width / size.height < 0.8 ? 62 : 46
    cam.updateProjectionMatrix()
  }, [camera, size])
  useFrame((_, raw) => {
    const dt = Math.min(0.05, raw)
    const vertical = size.width / size.height < 0.8
    const [x0, x1] = mundo.limites.x
    const margen = vertical ? 5 : 12
    const objetivoX = Math.min(x1 - margen, Math.max(x0 + margen, pos.current.x))
    // Tras un salto, la camara ya esta alli (no hace el viaje).
    if (salto.current !== ultimoSalto.current) {
      ultimoSalto.current = salto.current
      mira.current.x = objetivoX
      mira.current.z = pos.current.z
    }
    const k = Math.min(1, dt * 6)
    mira.current.x += (objetivoX - mira.current.x) * k
    mira.current.z += (pos.current.z - mira.current.z) * k
    // Baja y algo lejos: se ven las fachadas (no los tejados) y la calle con el vaquero.
    const alto = vertical ? 8.5 : 8
    const atras = vertical ? 18 : 17
    camera.position.set(mira.current.x, alto, mira.current.z * 0.4 + atras)
    camera.lookAt(mira.current.x, 3.4, mira.current.z * 0.4 - 4)
  })
  return null
}
