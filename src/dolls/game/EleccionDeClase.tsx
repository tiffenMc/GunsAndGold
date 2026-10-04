import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import type { Group, Points, PointsMaterial } from 'three'
import { motionById } from '../animations'
import { DollBody } from '../DollBody'
import { RARITY_ORDER, rarityOf } from '../cards/model'
import type { BattleCard, CardDef, ClaseId } from '../cards/model'
import { usePortrait } from '../card3d/portraits'
import { Model } from '../scenes/models'
import type { Placement } from '../scenes/models'
import { SafeCanvas } from '../SafeCanvas'
import { sfx } from '../battle/sfx'
import { CLASES, cartasDeClase, claseDisponible } from './clases'
import type { ClaseInfo } from './clases'

/**
 * **Elige tu bando.** Lo primero que ve un jugador nuevo, así que tiene que entrar por los ojos:
 * cada clase sale con su escuadrón (sus tres mejores muñecos, que disparan de vez en cuando) en su
 * escenario, con su cielo y su ambiente (polvo dorado del desierto, brasas de la hoguera, nieve del
 * norte). Se cambia deslizando el dedo o tocando los emblemas. Debajo, lo que la hace distinta en
 * barras, su poder y sus mejores cartas. Luego se le pone nombre (con un dado de nombres del Oeste).
 */

interface Tema {
  /** El cielo de detrás (CSS). */
  cielo: string
  /** La luz principal de la escena. */
  luz: string
  ambiente: 'polvo' | 'brasas' | 'nieve'
  decorado: Placement[]
  nieve?: boolean
  /** Sus puntos fuertes, de 1 a 5. */
  barras: { label: string; valor: number }[]
  /** Cómo es de jugar. */
  estilo: string
  nombres: string[]
}

const TEMAS: Record<ClaseId, Tema> = {
  vaqueros: {
    cielo: 'linear-gradient(180deg, #2b1b3d 0%, #8c3b2f 30%, #f08a3c 55%, #ffd27a 70%, #b8692f 71%, #5a2c12 100%)',
    luz: '#ffc58a',
    ambiente: 'polvo',
    decorado: [
      { m: 'Bld_Saloon_01', x: 0, z: -15, s: 0.75 },
      { m: 'Env_Cactus_Large_01', x: -6.5, z: -6, s: 0.8 },
      { m: 'Env_Cactus_01', x: 5.8, z: -5, s: 1.1 },
      { m: 'Prop_Barrel_01', x: -3.3, z: -2.2 },
      { m: 'Prop_Barrel_01', x: -2.6, z: -3, r: 30 },
      { m: 'Prop_Tnt_Barrel_01', x: 3.4, z: -2.4 },
      { m: 'Prop_Cow_Skull_01', x: 2.3, z: 1.2, r: -30 },
      { m: 'Env_Butte_01', x: -40, z: -70, s: 1.4 },
      { m: 'Env_Butte_02', x: 30, z: -80, s: 1.6 },
    ],
    barras: [
      { label: 'Alcance', valor: 4 },
      { label: 'Daño', valor: 3 },
      { label: 'Aguante', valor: 3 },
      { label: 'Velocidad', valor: 3 },
    ],
    estilo: 'Fácil de empezar · mucha variedad',
    nombres: ['Billy el Rápido', 'Jack Polvorón', 'Doc Gatillo', 'Calamity Rosa', 'Tex Mostacho', 'Kid Tequila', 'Sam Espuelas', 'Johnny Dinamita'],
  },
  indios: {
    cielo: 'linear-gradient(180deg, #120c2e 0%, #4b1d55 30%, #b33b3b 55%, #f2a65a 69%, #6b3a1f 70%, #2b170b 100%)',
    luz: '#ff9a5c',
    ambiente: 'brasas',
    decorado: [
      { m: 'Bld_Teepee_01', x: -5.2, z: -7, s: 0.9, r: 20 },
      { m: 'Bld_Teepee_01', x: 5.4, z: -8.5, s: 1, r: -30 },
      { m: 'Prop_Campfire_01', x: 0, z: -3.6, s: 0.7 },
      { m: 'Env_Tree_Desert_01', x: -9, z: -12 },
      { m: 'Env_RockTall_01', x: 9, z: -12, s: 0.8 },
      { m: 'Prop_Cow_Skull_01', x: -2.4, z: 1.2, r: 40 },
      { m: 'Env_Butte_01', x: 20, z: -75, s: 1.6, r: 30 },
      { m: 'Env_Butte_02', x: -35, z: -70, s: 1.4 },
    ],
    barras: [
      { label: 'Alcance', valor: 5 },
      { label: 'Daño', valor: 3 },
      { label: 'Aguante', valor: 2 },
      { label: 'Velocidad', valor: 4 },
    ],
    estilo: 'Táctico · marcas y emboscadas',
    nombres: ['Halcón Veloz', 'Mil Flechas', 'Oso Sereno', 'Luna Roja', 'Lobo Gris', 'Pluma de Trueno', 'Nube Ligera', 'Flecha Rota'],
  },
  vikingos: {
    cielo: 'linear-gradient(180deg, #050b1f 0%, #10305a 34%, #2f6f8f 56%, #9fd6e8 69%, #dfeef5 70%, #8fb0c4 100%)',
    luz: '#bfe6ff',
    ambiente: 'nieve',
    nieve: true,
    decorado: [
      { m: 'Bld_Fort_Tower_01', x: -5.5, z: -9, s: 0.8 },
      { m: 'Bld_Fort_Wall_01', x: -2, z: -9.5, s: 0.8 },
      { m: 'Bld_Fort_Wall_01', x: 2, z: -9.5, s: 0.8 },
      { m: 'Bld_Fort_Tower_01', x: 5.5, z: -9, s: 0.8 },
      { m: 'Env_Tree_Tall_01', x: -9, z: -6 },
      { m: 'Env_Tree_Tall_02', x: 9, z: -6.5 },
      { m: 'Env_Birch_01', x: -7, z: -14 },
      { m: 'Prop_LogPile_01', x: 3.4, z: -2.6, s: 0.8 },
      { m: 'Env_RockFlat_01', x: -3, z: -1.4 },
    ],
    barras: [
      { label: 'Alcance', valor: 1 },
      { label: 'Daño', valor: 5 },
      { label: 'Aguante', valor: 5 },
      { label: 'Velocidad', valor: 5 },
    ],
    estilo: 'Directo · todo al cuerpo a cuerpo',
    nombres: ['Bjorn Barbaroja', 'Ragnar Hachazo', 'Freya Escudo', 'Olaf Martillo', 'Sigrid Tormenta', 'Ulf Cuernos', 'Astrid la Brava', 'Leif Rompehielo'],
  },
}

/** Los tres mejores muñecos de una clase (el más gordo, en el centro). */
function escuadronDe(cartas: CardDef[], clase: ClaseId): BattleCard[] {
  return cartasDeClase(cartas, clase)
    .filter((card): card is BattleCard => card.kind === 'batalla')
    .sort((a, b) => RARITY_ORDER.indexOf(rarityOf(b)) - RARITY_ORDER.indexOf(rarityOf(a)))
    .slice(0, 3)
}

export function EleccionDeClase({
  cartas,
  onCrear,
  onVolver,
  aviso,
}: {
  cartas: CardDef[]
  onCrear: (clase: ClaseId, nombre: string) => void
  /** Si ya tiene personajes, puede volver a la lista. */
  onVolver?: () => void
  aviso: string | null
}) {
  const disponibles = CLASES.filter((item) => claseDisponible(cartas, item.id))
  const [indice, setIndice] = useState(0)
  const [paso, setPaso] = useState<'clase' | 'nombre'>('clase')
  const [nombre, setNombre] = useState('')
  const info = disponibles[indice] ?? CLASES[0]!
  const tema = TEMAS[info.id]
  const escuadron = useMemo(() => escuadronDe(cartas, info.id), [cartas, info.id])
  const arrastre = useRef<number | null>(null)

  const ir = (paso: number) => {
    if (disponibles.length < 2) return
    setIndice((i) => (i + paso + disponibles.length) % disponibles.length)
    sfx.invocar('especial')
  }

  // Con las flechas del teclado también se cambia.
  useEffect(() => {
    if (paso !== 'clase') return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') ir(-1)
      if (e.key === 'ArrowRight') ir(1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, disponibles.length])

  const bajar = (e: ReactPointerEvent) => {
    arrastre.current = e.clientX
  }
  const soltar = (e: ReactPointerEvent) => {
    if (arrastre.current === null || paso !== 'clase') return
    const dx = e.clientX - arrastre.current
    arrastre.current = null
    if (Math.abs(dx) > 45) ir(dx < 0 ? 1 : -1)
  }

  const nombreAlAzar = () => {
    const opciones = tema.nombres.filter((n) => n !== nombre)
    setNombre(opciones[Math.floor(Math.random() * opciones.length)] ?? tema.nombres[0]!)
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-black" onPointerDown={bajar} onPointerUp={soltar}>
      {/* Los cielos de las tres clases, uno encima de otro: se funden al cambiar */}
      {CLASES.map((item) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ background: TEMAS[item.id].cielo, opacity: item.id === info.id ? 1 : 0 }}
        />
      ))}
      {/* El sol (o la luna) */}
      <div
        className="pointer-events-none absolute left-1/2 top-[22%] aspect-square w-[70vmin] -translate-x-1/2 rounded-full transition-all duration-700"
        style={{ background: `radial-gradient(circle, ${tema.luz}cc 0%, ${tema.luz}44 30%, transparent 62%)` }}
      />

      {/* El escuadrón en 3D */}
      <div className="absolute inset-0">
        <SafeCanvas note="">
          <Canvas dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }} camera={{ fov: 38, position: [0, 2.4, 9.5] }}>
            <Escena clase={info.id} escuadron={escuadron} tema={tema} />
          </Canvas>
        </SafeCanvas>
      </div>
      {/* Oscuro arriba y abajo, para leer bien */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.65)_0%,transparent_26%,transparent_52%,rgba(0,0,0,0.88)_74%)]" />

      {/* Arriba: el paso y el nombre de la clase */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-4 pt-[max(12px,env(safe-area-inset-top))] text-center">
        <div className="flex items-center justify-between">
          <span className="whitespace-nowrap rounded-full bg-black/45 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100/80">
            {paso === 'clase' ? '1/2 · Elige tu bando' : '2/2 · Tu nombre'}
          </span>
          {onVolver && (
            <button
              type="button"
              onClick={onVolver}
              className="pointer-events-auto rounded-full border-2 border-amber-200/40 bg-black/50 px-3 py-1 text-[12px] font-bold uppercase text-amber-100"
            >
              Volver
            </button>
          )}
        </div>
        <div key={info.id} className="clase-titulo mt-3">
          <p className="text-[34px] leading-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.7)]">{info.icon}</p>
          <p
            className="font-west text-[52px] uppercase leading-[0.95] tracking-wide"
            style={{ color: info.color, textShadow: `0 4px 0 #120804, 0 0 30px ${info.color}aa, 0 0 2px #000` }}
          >
            {info.label}
          </p>
          <p className="mt-1 font-west text-[18px] text-amber-50" style={{ textShadow: '0 2px 4px #000' }}>
            «{info.lema}»
          </p>
        </div>
      </div>

      {/* Flechas para cambiar (también se desliza el dedo) */}
      {paso === 'clase' && disponibles.length > 1 && (
        <>
          {[-1, 1].map((lado) => (
            <button
              key={lado}
              type="button"
              onClick={() => ir(lado)}
              aria-label={lado < 0 ? 'Clase anterior' : 'Clase siguiente'}
              className={`absolute top-[33%] grid h-12 w-12 place-items-center rounded-full border-2 border-amber-200/50 bg-black/45 font-west text-[26px] text-amber-100 backdrop-blur-[2px] active:scale-90 ${
                lado < 0 ? 'left-2' : 'right-2'
              }`}
            >
              {lado < 0 ? '‹' : '›'}
            </button>
          ))}
        </>
      )}

      {/* Abajo: lo que la hace distinta y el botón */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[460px]">
          {paso === 'clase' ? (
            <PanelDeClase key={info.id} info={info} tema={tema} escuadron={escuadron} />
          ) : (
            <div className="clase-panel rounded-2xl border-2 bg-black/60 p-3 backdrop-blur-[3px]" style={{ borderColor: `${info.color}99` }}>
              <p className="font-west text-[22px] leading-none text-amber-50">¿Cómo te llaman, forastero?</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={nombre}
                  autoFocus
                  onChange={(event) => setNombre(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && onCrear(info.id, nombre)}
                  placeholder={tema.nombres[0]}
                  maxLength={16}
                  className="min-w-0 flex-1 rounded-xl border-2 bg-black/50 px-3 py-2 font-west text-[22px] text-amber-50 outline-none placeholder:text-amber-100/30"
                  style={{ borderColor: `${info.color}88` }}
                />
                <button
                  type="button"
                  onClick={nombreAlAzar}
                  title="Un nombre al azar"
                  className="grid w-14 shrink-0 place-items-center rounded-xl border-2 bg-black/50 text-[26px] active:scale-90"
                  style={{ borderColor: `${info.color}88` }}
                >
                  🎲
                </button>
              </div>
              <p className="mt-1.5 text-[12px] text-amber-100/60">Toca el dado si no se te ocurre ninguno.</p>
            </div>
          )}

          {aviso && <p className="mt-2 rounded-lg bg-rose-600/80 px-2 py-1.5 text-center text-[14px] font-bold text-white">{aviso}</p>}

          {/* Los emblemas de las clases */}
          {paso === 'clase' && (
            <div className="mt-2 flex justify-center gap-3">
              {disponibles.map((item, i) => {
                const elegida = i === indice
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (i !== indice) {
                        setIndice(i)
                        sfx.invocar('especial')
                      }
                    }}
                    className="grid place-items-center rounded-full border-[3px] transition-all duration-300 active:scale-90"
                    style={{
                      width: elegida ? 56 : 44,
                      height: elegida ? 56 : 44,
                      fontSize: elegida ? 30 : 22,
                      borderColor: elegida ? item.color : '#ffffff33',
                      background: elegida ? `radial-gradient(circle, ${item.color}66, #000a)` : '#0008',
                      boxShadow: elegida ? `0 0 22px ${item.color}` : undefined,
                    }}
                    aria-label={item.label}
                  >
                    {item.icon}
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-2 flex gap-2">
            {paso === 'nombre' && (
              <button type="button" onClick={() => setPaso('clase')} className="btn-ghost px-4">
                ‹
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (paso === 'clase') {
                  setPaso('nombre')
                  sfx.invocar('divina')
                } else onCrear(info.id, nombre)
              }}
              className="clase-boton relative flex-1 overflow-hidden rounded-2xl border-[3px] px-4 py-3.5 font-west text-[24px] leading-none text-[#1a0d04] active:scale-[0.97]"
              style={
                {
                  borderColor: '#fff3',
                  background: `linear-gradient(180deg, #fff2c4 0%, ${info.color} 45%, ${info.color} 70%, #6b3a12 100%)`,
                  boxShadow: `0 0 26px ${info.color}aa, inset 0 2px 0 #fff8`,
                  '--brillo': info.color,
                } as CSSProperties
              }
            >
              {paso === 'clase' ? `¡Soy ${info.singular.toLowerCase()}!` : '¡A cabalgar!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Lo de debajo del escuadrón: barras, poder, arma y sus tres estrellas. */
function PanelDeClase({ info, tema, escuadron }: { info: ClaseInfo; tema: Tema; escuadron: BattleCard[] }) {
  return (
    <div className="clase-panel rounded-2xl border-2 bg-black/55 p-2.5 backdrop-blur-[3px]" style={{ borderColor: `${info.color}88` }}>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {tema.barras.map((barra, i) => (
            <div key={barra.label} className="flex items-center gap-2">
              <span className="w-[62px] shrink-0 text-[11px] font-black uppercase tracking-wider text-amber-100/75">{barra.label}</span>
              <span className="flex flex-1 gap-[3px]">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className="clase-barra h-2.5 flex-1 -skew-x-12 rounded-[2px]"
                    style={{
                      background: n <= barra.valor ? info.color : '#ffffff1f',
                      boxShadow: n <= barra.valor ? `0 0 6px ${info.color}` : undefined,
                      animationDelay: `${i * 70 + n * 45}ms`,
                    }}
                  />
                ))}
              </span>
            </div>
          ))}
          <p className="pt-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: info.color }}>
            {tema.estilo}
          </p>
        </div>
        {/* Sus estrellas: los retratos de sus mejores cartas */}
        <div className="flex shrink-0 items-end -space-x-3">
          {escuadron.map((card, i) => (
            <Retrato key={card.id} card={card} color={info.color} giro={(i - 1) * 9} alto={i === 1} />
          ))}
        </div>
      </div>
      <p className="mt-2 rounded-lg bg-white/5 px-2 py-1 text-[12.5px] leading-snug text-amber-50">
        <b style={{ color: info.color }}>⚡ Poder:</b> {info.pasiva}
      </p>
    </div>
  )
}

function Retrato({ card, color, giro, alto }: { card: BattleCard; color: string; giro: number; alto: boolean }) {
  const foto = usePortrait(card)
  return (
    <span
      className="block overflow-hidden rounded-lg border-2 bg-black/60"
      style={{ width: alto ? 50 : 42, height: alto ? 70 : 58, borderColor: color, rotate: `${giro}deg`, zIndex: alto ? 2 : 1, boxShadow: `0 0 10px ${color}88` }}
    >
      {foto && <img src={foto} alt="" draggable={false} className="h-full w-full object-cover object-top" />}
    </span>
  )
}

// ---------------------------------------------------------------------------
// La escena 3D
// ---------------------------------------------------------------------------

const QUIETO = motionById('quieto')

function Escena({ clase, escuadron, tema }: { clase: ClaseId; escuadron: BattleCard[]; tema: Tema }) {
  const camara = useRef(0)
  useFrame((state, dt) => {
    // La cámara se mece despacio alrededor del escuadrón. En vertical (móvil) se aleja para que
    // quepan los tres, y mira algo más abajo para que queden entre el título y el panel.
    camara.current += dt
    const t = camara.current
    const vertical = state.size.width / state.size.height < 0.8
    const lejos = vertical ? 14.5 : 9.5
    state.camera.position.set(Math.sin(t * 0.25) * (vertical ? 0.8 : 1.3), (vertical ? 1.7 : 2.3) + Math.sin(t * 0.4) * 0.12, lejos)
    state.camera.lookAt(0, vertical ? 0.2 : 1.55, 0)
  })
  const sitios = [
    { x: -1.75, z: -0.7, giro: 0.35 },
    { x: 0, z: 0.4, giro: 0 },
    { x: 1.75, z: -0.7, giro: -0.35 },
  ]
  // El mejor va en el centro.
  const orden = escuadron.length === 3 ? [escuadron[1]!, escuadron[0]!, escuadron[2]!] : escuadron
  return (
    <>
      <hemisphereLight args={[tema.luz, '#2a170b', 1.1]} />
      <directionalLight position={[3, 6, 6]} intensity={2.2} color={tema.luz} />
      <directionalLight position={[-4, 3, -4]} intensity={1.2} color="#ffffff" />
      <fog attach="fog" args={[clase === 'vikingos' ? '#9fd6e8' : clase === 'indios' ? '#b33b3b' : '#f08a3c', 18, 90]} />
      {/* El suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[60, 48]} />
        <meshLambertMaterial color={clase === 'vikingos' ? '#e6f1f7' : clase === 'indios' ? '#7a4524' : '#c98b4f'} />
      </mesh>
      {/* El círculo de luz donde están */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[3.6, 48]} />
        <meshBasicMaterial color={tema.luz} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <Suspense fallback={null}>
        <group key={clase}>
          {tema.decorado.map((p, i) => (
            <Model key={`${p.m}-${i}`} {...p} snow={tema.nieve} />
          ))}
        </group>
      </Suspense>
      <group key={`e-${clase}`}>
        {orden.map((card, i) => (
          <Soldado key={card.id} card={card} {...sitios[i]!} retraso={i * 0.12} grande={i === 1} />
        ))}
      </group>
      <Ambiente tipo={tema.ambiente} />
    </>
  )
}

/** Uno del escuadrón: cae al escenario de un salto, respira y dispara de vez en cuando. */
function Soldado({ card, x, z, giro, retraso, grande }: { card: BattleCard; x: number; z: number; giro: number; retraso: number; grande: boolean }) {
  const g = useRef<Group>(null)
  const tiempo = useRef(-retraso)
  const [disparando, setDisparando] = useState(false)
  const proximo = useRef(1.4 + retraso * 6 + Math.random() * 1.5)
  const disparo = useMemo(() => motionById(card.anims.disparar), [card.anims.disparar])
  useFrame((_, dt) => {
    tiempo.current += dt
    const t = tiempo.current
    const grupo = g.current
    if (!grupo) return
    // Entra cayendo desde arriba y rebota.
    const k = Math.max(0, Math.min(1, t / 0.55))
    const caida = k < 1 ? (1 - k) ** 2 * 6 : 0
    const rebote = t > 0.55 && t < 0.85 ? Math.sin(((t - 0.55) / 0.3) * Math.PI) * 0.18 : 0
    grupo.position.set(x, caida + rebote, z)
    const aplasta = t > 0.5 && t < 0.7 ? 1 - Math.sin(((t - 0.5) / 0.2) * Math.PI) * 0.15 : 1
    grupo.scale.set(1 / Math.sqrt(aplasta), aplasta, 1 / Math.sqrt(aplasta))
    grupo.visible = t > 0
    if (!disparando && t > proximo.current) setDisparando(true)
  })
  return (
    <group ref={g} rotation={[0, giro, 0]} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.7, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <DollBody
        look={card.look}
        motion={disparando ? disparo : QUIETO}
        playing
        scale={grande ? 1.95 : 1.65}
        onDone={() => {
          setDisparando(false)
          proximo.current = tiempo.current + 2.5 + Math.random() * 3.5
        }}
      />
    </group>
  )
}

/** El ambiente de cada sitio: polvo dorado, brasas que suben o nieve que cae. */
function Ambiente({ tipo }: { tipo: Tema['ambiente'] }) {
  const puntos = useRef<Points>(null)
  const CUANTOS = tipo === 'nieve' ? 500 : 220
  const { geo, vel } = useMemo(() => {
    const geo = new BufferGeometry()
    const pos = new Float32Array(CUANTOS * 3)
    const vel = new Float32Array(CUANTOS)
    for (let i = 0; i < CUANTOS; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16
      pos[i * 3 + 1] = Math.random() * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1
      vel[i] = 0.4 + Math.random()
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3))
    return { geo, vel }
  }, [CUANTOS])
  useEffect(() => () => geo.dispose(), [geo])
  useFrame((state, raw) => {
    const dt = Math.min(0.05, raw)
    const attr = geo.getAttribute('position') as BufferAttribute
    const a = attr.array as Float32Array
    const t = state.clock.elapsedTime
    for (let i = 0; i < CUANTOS; i++) {
      const v = vel[i]!
      if (tipo === 'nieve') {
        a[i * 3 + 1] -= dt * 1.1 * v
        a[i * 3] += Math.sin(t + i) * dt * 0.4
        if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 8
      } else if (tipo === 'brasas') {
        a[i * 3 + 1] += dt * 0.9 * v
        a[i * 3] += Math.sin(t * 2 + i) * dt * 0.3
        if (a[i * 3 + 1] > 7) {
          a[i * 3 + 1] = 0
          a[i * 3] = (Math.random() - 0.5) * 4
          a[i * 3 + 2] = -3.6 + (Math.random() - 0.5) * 2
        }
      } else {
        a[i * 3] += dt * 0.5 * v
        a[i * 3 + 1] += Math.sin(t * 0.7 + i) * dt * 0.08
        if (a[i * 3] > 8) a[i * 3] = -8
      }
    }
    attr.needsUpdate = true
    if (puntos.current) (puntos.current.material as PointsMaterial).opacity = tipo === 'polvo' ? 0.55 : 0.9
  })
  return (
    <points ref={puntos} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        color={tipo === 'nieve' ? '#ffffff' : tipo === 'brasas' ? '#ffb347' : '#ffe2a8'}
        size={tipo === 'nieve' ? 0.09 : 0.07}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  )
}
