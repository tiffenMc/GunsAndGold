import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { Vector3 } from 'three'
import type { Group, OrthographicCamera } from 'three'
import { motionById } from '../animations'
import { DollBody } from '../DollBody'
import { proportions } from '../dollParams'
import { FRAMELOOP, MANUAL } from '../debugClock'
import { rarityInfo, rarityOf } from '../cards/model'
import type { BattleCard } from '../cards/model'
import { AuraRareza, FX_MAX_LIFE, FxLayer } from '../battle/Effects'
import type { Fx } from '../battle/Effects'
import { estiloDe, propDe } from '../battle/estilos'
import { SIDE_COLOR } from '../battle/Field'
import { sfx } from '../battle/sfx'
import { UnitBadge, UnitBase } from '../battle/UnitBadge'
import type { ScenarioDef } from '../scenes/scenarios'
import {
  COLS,
  FILAS,
  MAX_VIVOS,
  PA_POR_TURNO,
  RONDAS,
  alcanzables,
  atacar,
  casillasDeSalida,
  crearTactico,
  desplegar,
  desplegarBot,
  dist,
  empezarPartida,
  habilidad,
  miniEn,
  minisDe,
  mover,
  objetivos,
  pasoBot,
  puedeAtacar,
  puedeHabilidad,
  puedeMover,
  terminarTurno,
  vivos,
} from './motor'
import type { Mini, Tactico } from './motor'

/** Lado de una casilla en el mundo. */
const TILE = 2
/** Lo que se agranda el muñeco para que llene la casilla. */
const ESCALA = 1.85
/** Segundos que tiene el jugador para acabar su turno. */
const SEGUNDOS_TURNO = 35

const TEAM_COLOR = { 0: '#2f9bff', 1: '#ff3b30' } as const

function aMundo(x: number, y: number): { x: number; z: number } {
  return { x: (x - (COLS - 1) / 2) * TILE, z: (y - (FILAS - 1) / 2) * TILE }
}

function mixHex(a: string, b: string, k: number): string {
  const n = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
  const c = (i: number) =>
    Math.round(n(a, i) * (1 - k) + n(b, i) * k)
      .toString(16)
      .padStart(2, '0')
  return `#${c(0)}${c(1)}${c(2)}`
}

// ---------------------------------------------------------------------------
// Camara y reloj
// ---------------------------------------------------------------------------

/** Encuadra el tablero entero en la pantalla, visto de arriba y de lado. */
function Camara() {
  const camera = useThree((s) => s.camera) as OrthographicCamera
  const size = useThree((s) => s.size)
  useEffect(() => {
    const ancho = COLS * TILE + 2.2
    const alto = FILAS * TILE * 0.78 + 4
    camera.zoom = Math.min(size.width / ancho, size.height / alto)
    camera.position.set(0, 17, 15)
    camera.lookAt(new Vector3(0, 0, 0.6))
    camera.near = 0.1
    camera.far = 120
    camera.updateProjectionMatrix()
  }, [camera, size.width, size.height])
  return null
}

function SondaReloj({ reloj }: { reloj: MutableRefObject<number> }) {
  useFrame((state) => {
    reloj.current = state.clock.elapsedTime
  })
  return null
}

// ---------------------------------------------------------------------------
// Casillas y terreno
// ---------------------------------------------------------------------------

type Resalte = 'mover' | 'atacar' | 'salida' | 'seleccion' | null

const COLOR_RESALTE: Record<Exclude<Resalte, null>, string> = {
  mover: '#38bdf8',
  atacar: '#ef4444',
  salida: '#fbbf24',
  seleccion: '#ffffff',
}

function Tablero({
  t,
  scenario,
  resaltes,
  onTile,
}: {
  t: Tactico
  scenario: ScenarioDef
  resaltes: Map<string, Resalte>
  onTile: (x: number, y: number) => void
}) {
  const claro = useMemo(() => mixHex(scenario.field, '#ffffff', 0.08), [scenario.field])
  const oscuro = useMemo(() => mixHex(scenario.field, '#000000', 0.1), [scenario.field])
  return (
    <group>
      {/* El suelo de fuera */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[60, 70]} />
        <meshStandardMaterial color={scenario.outside} roughness={1} />
      </mesh>
      {Array.from({ length: FILAS }).flatMap((_, y) =>
        Array.from({ length: COLS }).map((__, x) => {
          const p = aMundo(x, y)
          const resalte = resaltes.get(`${x},${y}`) ?? null
          const terreno = t.terreno[y]![x]!
          return (
            <group key={`${x},${y}`} position={[p.x, 0, p.z]}>
              <mesh
                rotation={[-Math.PI / 2, 0, 0]}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onTile(x, y)
                }}
              >
                <planeGeometry args={[TILE - 0.06, TILE - 0.06]} />
                <meshStandardMaterial color={(x + y) % 2 === 0 ? claro : oscuro} roughness={1} />
              </mesh>
              {resalte && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                  <planeGeometry args={[TILE - 0.2, TILE - 0.2]} />
                  <meshBasicMaterial color={COLOR_RESALTE[resalte]} transparent opacity={resalte === 'seleccion' ? 0.35 : 0.42} depthWrite={false} toneMapped={false} />
                </mesh>
              )}
              {terreno === 'roca' && (
                <group position={[0, 0, 0]}>
                  <mesh position={[0, 0.55, 0]} rotation={[0.2, 0.6, 0.1]}>
                    <dodecahedronGeometry args={[0.85, 0]} />
                    <meshStandardMaterial color="#6f6a63" roughness={1} flatShading />
                  </mesh>
                  <mesh position={[0.45, 0.3, 0.35]} rotation={[0.4, 0.2, 0.3]}>
                    <dodecahedronGeometry args={[0.45, 0]} />
                    <meshStandardMaterial color="#847e75" roughness={1} flatShading />
                  </mesh>
                </group>
              )}
              {terreno === 'cobertura' && (
                <group>
                  {/* Barricada de tablones: se nota que tapa */}
                  <mesh position={[0, 0.38, 0]}>
                    <boxGeometry args={[1.5, 0.18, 0.22]} />
                    <meshStandardMaterial color="#8a5a2b" roughness={0.9} />
                  </mesh>
                  <mesh position={[0, 0.64, 0]}>
                    <boxGeometry args={[1.5, 0.18, 0.22]} />
                    <meshStandardMaterial color="#9a6a35" roughness={0.9} />
                  </mesh>
                  {[-0.6, 0.6].map((dx) => (
                    <mesh key={dx} position={[dx, 0.4, 0]}>
                      <boxGeometry args={[0.14, 0.9, 0.2]} />
                      <meshStandardMaterial color="#5e3c1c" roughness={0.9} />
                    </mesh>
                  ))}
                </group>
              )}
            </group>
          )
        }),
      )}
    </group>
  )
}

function FuerteMini({ t, bando }: { t: Tactico; bando: 0 | 1 }) {
  const f = t.fuertes[bando]
  const p = aMundo(f.x, f.y)
  const color = SIDE_COLOR[bando]
  const pct = Math.max(0, f.hp / f.maxHp)
  const roto = f.hp <= 0
  return (
    <group position={[p.x, 0, p.z]}>
      <UnitBase color={color} />
      {/* La casa del bando */}
      <mesh position={[0, 0.9, 0]} rotation={[0, roto ? 0.4 : 0, roto ? 0.25 : 0]}>
        <boxGeometry args={[1.6, 1.8, 1.4]} />
        <meshStandardMaterial color={mixHex('#7a4a26', color, 0.18)} roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.05, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.35, 0.9, 4]} />
        <meshStandardMaterial color="#4a2c16" roughness={0.9} />
      </mesh>
      <mesh position={[0.7, 2.7, 0]}>
        <boxGeometry args={[0.7, 0.4, 0.04]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      {/* Su vida */}
      <group position={[0, 3.3, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 0.2, 0.05]} />
          <meshBasicMaterial color="#06111d" toneMapped={false} />
        </mesh>
        <mesh position={[-(2.1 * (1 - pct)) / 2, 0, 0.04]}>
          <boxGeometry args={[2.1 * pct, 0.14, 0.05]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Los soldados
// ---------------------------------------------------------------------------

function Mini3D({
  mini,
  seleccionado,
  visible,
  animacion,
  hacia,
}: {
  mini: Mini
  seleccionado: boolean
  visible: boolean
  /** Cuando acaba su ultimo ataque (reloj del lienzo) y el tipo. */
  animacion: MutableRefObject<Record<number, { hasta: number; x: number; z: number }>>
  hacia: MutableRefObject<Record<number, number>>
}) {
  const grupo = useRef<Group>(null)
  const [movimiento, setMovimiento] = useState<'quieto' | 'andar' | 'disparar' | 'morir'>('quieto')
  const [oculto, setOculto] = useState(false)
  const mov = useRef<'quieto' | 'andar' | 'disparar' | 'morir'>('quieto')
  const card = mini.card
  const objetivo = aMundo(mini.x, mini.y)
  const look = useMemo(
    () => ({
      ...card.look,
      shirt: mixHex(card.look.shirt, TEAM_COLOR[mini.bando], 0.3),
      team: TEAM_COLOR[mini.bando],
      prop: propDe(mini.estilo),
    }),
    [card.look, mini.bando, mini.estilo],
  )
  const altura = useMemo(() => proportions(card.look).H, [card.look])
  const rareza = rarityOf(card)
  const tam = (estiloDe(card).tam ?? 1) * (rareza === 'divina' ? 1.2 : rareza === 'epica' ? 1.1 : 1)
  const colocado = useRef(false)

  const cambiar = (siguiente: 'quieto' | 'andar' | 'disparar' | 'morir') => {
    if (mov.current === siguiente) return
    mov.current = siguiente
    setMovimiento(siguiente)
  }

  useFrame((state, dt) => {
    const g = grupo.current
    if (!g) return
    if (!colocado.current) {
      g.position.set(objetivo.x, 0, objetivo.z)
      g.rotation.y = mini.bando === 0 ? Math.PI : 0
      colocado.current = true
    }
    if (!mini.vivo) {
      cambiar('morir')
      return
    }
    const dx = objetivo.x - g.position.x
    const dz = objetivo.z - g.position.z
    const d = Math.hypot(dx, dz)
    const k = 1 - Math.exp(-dt * 7)
    g.position.x += dx * k
    g.position.z += dz * k
    const anim = animacion.current[mini.id]
    const t = state.clock.elapsedTime
    if (anim && t < anim.hasta) {
      // Mirando al blanco mientras ataca.
      const giro = Math.atan2(anim.x - g.position.x, anim.z - g.position.z)
      let diff = giro - g.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      g.rotation.y += diff * Math.min(1, dt * 12)
      cambiar('disparar')
    } else if (d > 0.12) {
      const giro = Math.atan2(dx, dz)
      let diff = giro - g.rotation.y
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      g.rotation.y += diff * Math.min(1, dt * 10)
      cambiar('andar')
    } else {
      cambiar('quieto')
    }
    void hacia
  })

  if (oculto || !visible) return null
  const motion =
    movimiento === 'disparar'
      ? motionById(card.anims.disparar)
      : movimiento === 'andar'
        ? motionById(card.anims.andar)
        : movimiento === 'morir'
          ? motionById(card.anims.morir)
          : motionById('quieto')
  const color = SIDE_COLOR[mini.bando]
  return (
    <group ref={grupo}>
      <UnitBase color={color} />
      {(rareza === 'epica' || rareza === 'divina') && mini.vivo && <AuraRareza color={rarityInfo(rareza).color} grande={rareza === 'divina'} />}
      {seleccionado && mini.vivo && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[1.05, 1.2, 36]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      <group scale={ESCALA * tam}>
        <DollBody
          look={look}
          lite
          motion={motion}
          playing
          speed={movimiento === 'andar' ? 1.3 : 1}
          onDone={() => {
            if (mov.current === 'morir') setOculto(true)
            else if (mov.current === 'disparar') cambiar('quieto')
          }}
        />
      </group>
      {mini.vivo && <UnitBadge escudos={mini.hp} maximo={mini.maxHp} color={color} y={altura * ESCALA * tam + 0.45} />}
    </group>
  )
}

// ---------------------------------------------------------------------------
// La pantalla
// ---------------------------------------------------------------------------

export interface TacticoProps {
  /** Tu mazo (de aqui salen tus 8 cartas: 4 al tablero y el resto de refuerzos). */
  deck: BattleCard[]
  botDeck: BattleCard[]
  scenario: ScenarioDef
  nombreRival: string
  onSalir: () => void
}

export function TacticoScreen({ deck, botDeck, scenario, nombreRival, onSalir }: TacticoProps) {
  const [semilla, setSemilla] = useState(() => Math.floor(Math.random() * 1e9))
  return <Partida key={semilla} deck={deck} botDeck={botDeck} scenario={scenario} nombreRival={nombreRival} onSalir={onSalir} otra={() => setSemilla(Math.floor(Math.random() * 1e9))} />
}

function Partida({ deck, botDeck, scenario, nombreRival, onSalir, otra }: TacticoProps & { otra: () => void }) {
  const t = useMemo(() => {
    const juego = crearTactico(deck, botDeck)
    desplegarBot(juego, 1)
    return juego
  }, [deck, botDeck])
  // Con ?manual en la direccion, el estado queda a mano en la consola: __tactico
  if (MANUAL) Object.assign(window, { __tactico: t })
  const [, setVersion] = useState(0)
  const refrescar = () => setVersion((v) => v + 1)
  const [seleccion, setSeleccion] = useState<number | null>(null)
  const [colocando, setColocando] = useState<string | null>(null)
  const [restante, setRestante] = useState(SEGUNDOS_TURNO)
  const [aviso, setAviso] = useState<string>('Elige una carta y toca una casilla dorada para colocarla')
  const [fx, setFx] = useState<Fx[]>([])
  const reloj = useRef(0)
  const animacion = useRef<Record<number, { hasta: number; x: number; z: number }>>({})
  const hacia = useRef<Record<number, number>>({})
  const procesados = useRef(0)
  const idFx = useRef(1)

  const yo = 0 as const
  const miTurno = t.fase === 'juego' && t.turno === yo
  const mini = seleccion !== null ? t.minis.find((m) => m.id === seleccion && m.vivo) ?? null : null

  /** Convierte lo que ha pasado en el motor en efectos, sonidos y animaciones. */
  const procesar = () => {
    const nuevos: Fx[] = []
    for (; procesados.current < t.eventos.length; procesados.current++) {
      const ev = t.eventos[procesados.current]!
      const ahora = reloj.current
      if (ev.t === 'ataque') {
        const origen = t.minis.find((m) => m.id === ev.de)
        const p = aMundo(ev.x, ev.y)
        animacion.current[ev.de] = { hasta: ahora + 0.9, x: p.x, z: p.z }
        if (ev.tipo === 'explosion') {
          nuevos.push({ id: idFx.current++, kind: 'blast', x: p.x, z: p.z, r: 1.6, color: '', born: ahora + 0.25 })
          sfx.blast()
        } else if (ev.tipo === 'cura') {
          nuevos.push({ id: idFx.current++, kind: 'warp', x: p.x, z: p.z, r: 2.2, color: '#4ade80', born: ahora })
          sfx.ready()
        } else {
          nuevos.push({ id: idFx.current++, kind: 'spark', x: p.x, z: p.z, r: 1, color: '#ffffff', born: ahora + 0.25 })
          sfx.shot()
        }
        void origen
      } else if (ev.t === 'dano') {
        const p = aMundo(ev.x, ev.y)
        nuevos.push({ id: idFx.current++, kind: 'hit', x: p.x, z: p.z, r: 1, color: ev.fuerte ? '#f59e0b' : '#ffd166', born: ahora + 0.25 })
        sfx.hit()
        if (ev.muere && ev.fuerte) nuevos.push({ id: idFx.current++, kind: 'blast', x: p.x, z: p.z, r: 3, color: '', born: ahora + 0.3 })
      } else if (ev.t === 'muerte') {
        const p = aMundo(ev.x, ev.y)
        nuevos.push({ id: idFx.current++, kind: 'rotura', x: p.x, z: p.z, r: 1, color: '#ffd166', born: ahora + 0.3 })
        sfx.kill()
      } else if (ev.t === 'despliegue') {
        const m = t.minis.find((q) => q.id === ev.id)
        if (m) {
          const p = aMundo(m.x, m.y)
          nuevos.push({ id: idFx.current++, kind: 'dust', x: p.x, z: p.z, r: 1, color: '', born: reloj.current })
        }
      }
    }
    if (nuevos.length > 0) setFx((lista) => [...lista.filter((q) => reloj.current - q.born < FX_MAX_LIFE), ...nuevos].slice(-50))
  }

  // El turno del bot: va haciendo una accion cada poco, para poder seguirlo.
  useEffect(() => {
    if (t.fase !== 'juego' || t.turno !== 1) return
    let vivo = true
    const id = window.setInterval(() => {
      if (!vivo) return
      const sigue = pasoBot(t)
      procesar()
      refrescar()
      if (!sigue) window.clearInterval(id)
    }, 950)
    return () => {
      vivo = false
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fase, t.turno, t.ronda])

  // El reloj de tu turno.
  useEffect(() => {
    if (!miTurno) return
    setRestante(SEGUNDOS_TURNO)
    const id = window.setInterval(() => setRestante((r) => r - 1), 1000)
    return () => window.clearInterval(id)
  }, [miTurno, t.ronda])
  useEffect(() => {
    if (miTurno && restante <= 0) {
      terminarTurno(t)
      setSeleccion(null)
      setColocando(null)
      procesar()
      refrescar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante, miTurno])

  useEffect(() => {
    if (t.fase === 'fin' && t.resultado) sfx.ready()
  }, [t.fase, t.resultado])

  // Mensajes de ayuda segun lo que toque hacer.
  useEffect(() => {
    if (t.fase === 'fin') return
    if (t.fase === 'despliegue') {
      setAviso(vivos(t, yo) >= MAX_VIVOS ? '¡Listo! Pulsa «Empezar» cuando quieras' : 'Elige una carta y toca una casilla dorada para colocarla')
    } else if (!miTurno) setAviso(`Turno de ${nombreRival}…`)
    else if (colocando) setAviso('Toca una casilla dorada de tu zona de salida')
    else if (mini) setAviso('Casilla azul: moverte · enemigo en rojo: atacar · otro soldado: cambiar')
    else setAviso('Tu turno: toca un soldado tuyo')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fase, miTurno, colocando, seleccion, vivos(t, yo)])

  // Lo que se resalta en el tablero.
  const resaltes = useMemo(() => {
    const mapa = new Map<string, Resalte>()
    if (t.fase === 'fin') return mapa
    if (colocando && (t.fase === 'despliegue' || miTurno)) {
      for (const c of casillasDeSalida(t, yo)) mapa.set(`${c.x},${c.y}`, 'salida')
      return mapa
    }
    if (miTurno && mini) {
      if (puedeMover(t, mini)) for (const c of alcanzables(t, mini).values()) mapa.set(`${c.x},${c.y}`, 'mover')
      if (puedeAtacar(t, mini)) for (const o of objetivos(t, mini)) mapa.set(`${o.x},${o.y}`, 'atacar')
      mapa.set(`${mini.x},${mini.y}`, 'seleccion')
    }
    return mapa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.fase, t.turno, t.pa, colocando, seleccion, t.eventos.length, miTurno])

  const alTocar = (x: number, y: number) => {
    if (t.fase === 'fin') return
    if (colocando) {
      if (desplegar(t, yo, colocando, x, y)) {
        setColocando(null)
        procesar()
        refrescar()
      }
      return
    }
    if (!miTurno) return
    const ahi = miniEn(t, x, y)
    if (ahi && ahi.bando === yo) {
      setSeleccion(seleccion === ahi.id ? null : ahi.id)
      return
    }
    if (!mini) return
    if (puedeAtacar(t, mini)) {
      const objetivo = objetivos(t, mini).find((o) => o.x === x && o.y === y)
      if (objetivo && atacar(t, mini, objetivo)) {
        procesar()
        refrescar()
        return
      }
    }
    if (puedeMover(t, mini) && mover(t, mini, x, y)) {
      procesar()
      refrescar()
      return
    }
    setSeleccion(null)
  }

  const empezar = () => {
    if (vivos(t, yo) === 0) return
    empezarPartida(t)
    setColocando(null)
    procesar()
    refrescar()
  }

  const finTurno = () => {
    terminarTurno(t)
    setSeleccion(null)
    setColocando(null)
    procesar()
    refrescar()
  }

  const usarHabilidad = () => {
    if (mini && habilidad(t, mini)) {
      procesar()
      refrescar()
    }
  }

  const resultado = t.resultado
  const ganas = resultado?.ganador === yo
  const reserva = t.mano[yo]
  const puedeRefuerzo = t.fase === 'despliegue' || (miTurno && t.pa >= 1 && vivos(t, yo) < MAX_VIVOS)
  const hayEscondidoAjeno = (m: Mini) => m.bando === 1 && m.escondido && minisDe(t, yo).every((a) => dist(a.x, a.y, m.x, m.y) > 2)

  return (
    <div className="relative flex h-full flex-col bg-[#150d07]">
      {/* Barra de arriba */}
      <header className="flex items-center gap-2 border-b border-amber-900/60 bg-[#1b1108] px-2.5 py-2">
        <button type="button" onClick={onSalir} className="rounded-lg border border-amber-300/40 px-2.5 py-1.5 text-[14px] text-amber-100">
          ✕
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-west text-[17px] leading-none text-amber-100">
            {t.fase === 'despliegue' ? 'Despliegue' : `Ronda ${Math.min(t.ronda, RONDAS)}/${RONDAS}`}
          </p>
          <p className="mt-0.5 text-[13px] font-bold" style={{ color: miTurno ? '#7dd3fc' : '#fca5a5' }}>
            {t.fase === 'despliegue' ? 'Coloca tus soldados' : miTurno ? '⚔ TU TURNO' : `⏳ ${nombreRival}`}
          </p>
        </div>
        <div className="flex items-center gap-1" title="Acciones que te quedan este turno">
          {Array.from({ length: PA_POR_TURNO }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 ${miTurno && i < t.pa ? 'border-amber-200 bg-amber-400' : 'border-amber-900/70 bg-black/40'}`}
            />
          ))}
        </div>
        {miTurno && (
          <span className={`w-9 text-center font-mono text-[14px] font-bold ${restante <= 8 ? 'text-rose-400' : 'text-amber-100'}`}>{Math.max(0, restante)}</span>
        )}
      </header>

      {/* El tablero */}
      <div className="relative min-h-0 flex-1">
        <Canvas frameloop={FRAMELOOP} orthographic dpr={[1, 1.5]} camera={{ position: [0, 17, 15], zoom: 30 }}>
          <color attach="background" args={[scenario.sky]} />
          <Camara />
          <SondaReloj reloj={reloj} />
          <hemisphereLight args={[scenario.hemiSky, scenario.hemiGround, 0.9]} />
          <ambientLight intensity={0.45} color="#ffe9c8" />
          <directionalLight position={[8, 16, 10]} intensity={scenario.sunIntensity} color={scenario.sun} />
          <directionalLight position={[-10, 6, -8]} intensity={0.6} color="#ff9d5c" />
          <Tablero t={t} scenario={scenario} resaltes={resaltes} onTile={alTocar} />
          <FuerteMini t={t} bando={0} />
          <FuerteMini t={t} bando={1} />
          {t.minis.map((m) => (
            <Mini3D
              key={m.id}
              mini={m}
              seleccionado={seleccion === m.id}
              visible={!(t.fase === 'despliegue' && m.bando === 1) && !hayEscondidoAjeno(m)}
              animacion={animacion}
              hacia={hacia}
            />
          ))}
          <FxLayer items={fx} />
        </Canvas>
        <p className="pointer-events-none absolute inset-x-0 top-1.5 mx-auto w-fit max-w-[92%] rounded-full bg-black/70 px-3 py-1 text-center text-[13px] font-bold text-amber-100">
          {aviso}
        </p>
      </div>

      {/* Panel de abajo */}
      <footer className="space-y-2 border-t border-amber-900/60 bg-[#1b1108] px-2.5 pb-3 pt-2">
        {/* Panel del soldado elegido: siempre ocupa el mismo alto, para que el tablero no salte al elegir */}
        <div className="h-[104px]">
          {mini && t.fase === 'juego' ? (
            <div className="h-full overflow-hidden rounded-xl border border-amber-300/40 bg-black/35 p-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-west text-lg leading-none text-amber-50">{mini.card.name}</p>
                <p className="shrink-0 text-[13px] text-amber-100">
                  ❤ {Math.ceil(mini.hp)}/{mini.maxHp} · 👣 {mini.mov} · 🎯 {mini.alcance === 1 ? 'cuerpo a cuerpo' : `${mini.alcance} casillas`}
                </p>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-amber-200/85">
                <b>{mini.estilo.label}:</b> {mini.estilo.nota}
              </p>
              {(mini.frenado || mini.sinAtacar) && (
                <p className="text-[12px] font-bold text-rose-300">
                  {mini.frenado ? '🐢 Frenado ' : ''}
                  {mini.sinAtacar ? '💫 Aturdido' : ''}
                </p>
              )}
              {puedeHabilidad(t, mini) && (
                <button type="button" onClick={usarHabilidad} className="btn-gold mt-1 w-full py-1 text-[14px]">
                  ✨ Habilidad ({mini.estilo.label})
                </button>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-amber-900/60 px-3 text-center text-[13px] leading-snug text-amber-200/50">
              {t.fase === 'despliegue'
                ? 'Toca una carta y luego una casilla dorada. Los de cuerpo a cuerpo, delante; los tiradores, detrás.'
                : 'Toca uno de tus soldados para ver qué hace y adónde puede ir.'}
            </div>
          )}
        </div>

        {/* Cartas por sacar */}
        <div className="h-[74px]">
        {puedeRefuerzo && reserva.length > 0 && (
          <div>
            <p className="mb-1 text-[12px] uppercase tracking-[0.18em] text-amber-200/60">
              {t.fase === 'despliegue' ? 'Tus cartas (coloca hasta 4)' : 'Refuerzos (cuesta una acción)'}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {reserva.map((c) => {
                const est = estiloDe(c)
                const activa = colocando === c.id
                const color = rarityInfo(rarityOf(c)).color
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColocando(activa ? null : c.id)}
                    className="min-w-[96px] shrink-0 rounded-xl border-2 px-2 py-1.5 text-left active:scale-95"
                    style={{ borderColor: activa ? '#fbbf24' : color, background: activa ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.35)' }}
                  >
                    <span className="block truncate text-[13px] font-bold leading-tight text-amber-50">{c.name}</span>
                    <span className="block truncate text-[11px] leading-tight" style={{ color }}>
                      {est.label}
                    </span>
                    <span className="block text-[11px] text-amber-200/70">❤ {c.shields}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        </div>

        <div className="flex gap-2">
          {t.fase === 'despliegue' ? (
            <button type="button" onClick={empezar} disabled={vivos(t, yo) === 0} className="btn-gold flex-1 text-[15px] disabled:opacity-40">
              ⚔ Empezar batalla
            </button>
          ) : (
            <button type="button" onClick={finTurno} disabled={!miTurno} className="btn-gold flex-1 text-[15px] disabled:opacity-40">
              ⏭ Acabar turno
            </button>
          )}
        </div>
      </footer>

      {/* El final */}
      {resultado && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-5">
          <div className="resultado-pop panel w-full max-w-xs space-y-3 p-5 text-center">
            <p className="text-5xl">{ganas ? '🏆' : '💀'}</p>
            <p className="font-west text-3xl leading-none text-amber-50">{ganas ? '¡Victoria!' : 'Derrota'}</p>
            <p className="text-[15px] text-amber-100/85">
              {resultado.por === 'fuerte'
                ? ganas
                  ? 'Has tumbado el fuerte rival.'
                  : 'Te han tumbado el fuerte.'
                : resultado.por === 'aniquilacion'
                  ? ganas
                    ? 'No le queda ni un soldado.'
                    : 'Te has quedado sin soldados.'
                  : ganas
                    ? 'Se acabaron las rondas y vas por delante.'
                    : 'Se acabaron las rondas y ibas por detrás.'}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onSalir} className="btn-ghost flex-1">
                Salir
              </button>
              <button type="button" onClick={otra} className="btn-gold flex-1">
                Otra partida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
