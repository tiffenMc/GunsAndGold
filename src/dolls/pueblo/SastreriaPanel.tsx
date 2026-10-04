import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Icono } from '../Icono'
import { motionById } from '../animations'
import {
  BODY_SLIDERS,
  EYES,
  FACE_SLIDERS,
  HAIRS,
  HAIRS_STYLE,
  HAT_SLIDERS,
  MOUTHS,
  MUSTACHES,
  SKINS,
  cloneLook,
} from '../dollParams'
import type { DollLook, EyeStyle, Extra, HairStyle, MouthStyle, MustacheStyle, SliderDef } from '../dollParams'
import { movimientoDeDibujo, problemaDelDibujo, repartir } from '../game/animacionDibujada'
import type { AnimacionDibujada, Punto } from '../game/animacionDibujada'
import {
  animacionDe,
  borrarAnimacion,
  comprar,
  guardarAnimacion,
  loTienes,
  pintaDe,
  ponerAnimacion,
  ponerPinta,
  usePlayer,
} from '../game/players'
import type { Player } from '../game/players'
import { ARTICULOS, COLORES, MAX_ANIMACIONES, PARTES_DE_COLOR, PRECIO_ANIMACION, articulo, loQueFalta } from '../game/tienda'
import type { Articulo, CampoDeColor, Precio, Seccion } from '../game/tienda'
import { PanelDeSitio } from './Zonas'
import { VistaDeMuneco } from './VistaDeMuneco'

/**
 * **La Sastrería por dentro.** Arriba (o a la izquierda) tu vaquero en grande; abajo, todo lo que te
 * puedes poner. Probarse cosas es gratis: se pagan al guardar la pinta, y solo lo que no tengas.
 */

/** El disparo de siempre, en bucle (para cuando no llevas animación dibujada). */
const DISPARO_DE_SIEMPRE = { ...motionById('disparar-1'), id: 'disparar-1-bucle', loop: true, length: 1.9 }

type Pestana = 'cuerpo' | 'cara' | 'sombrero' | 'ropa' | 'arma' | 'extra' | 'color' | 'animacion'

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'sombrero', nombre: 'Sombreros' },
  { id: 'ropa', nombre: 'Ropa' },
  { id: 'color', nombre: 'Colores' },
  { id: 'arma', nombre: 'Armas' },
  { id: 'extra', nombre: 'Extras' },
  { id: 'animacion', nombre: 'Animaciones' },
  { id: 'cara', nombre: 'Cara' },
  { id: 'cuerpo', nombre: 'Cuerpo' },
]

/** Lo que pide cada moneda, sumado. */
function sumar(ids: string[]): Record<Precio['moneda'], number> {
  const total = { lingotes: 0, diamantes: 0 }
  for (const id of ids) {
    const precio = articulo(id)?.precio
    if (precio) total[precio.moneda] += precio.cantidad
  }
  return total
}

function PrecioChapa({ precio, className = '' }: { precio: Precio; className?: string }) {
  const diamante = precio.moneda === 'diamantes'
  return (
    <span className={`inline-flex items-center gap-0.5 font-west ${diamante ? 'text-cyan-300' : 'text-yellow-300'} ${className}`}>
      {precio.cantidad} <Icono nombre={diamante ? 'diamantes' : 'lingotes'} />
    </span>
  )
}

/** Un artículo para tocar: se lo prueba; dice si es tuyo, gratis o lo que cuesta. */
function Ficha({
  activo,
  onClick,
  nombre,
  estado,
  muestra,
}: {
  activo: boolean
  onClick: () => void
  nombre: string
  estado: ReactNode
  muestra?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-1.5 text-center text-[12px] leading-tight active:scale-95 ${
        activo ? 'border-amber-300 bg-amber-300/20 text-amber-50' : 'border-amber-900/60 bg-black/30 text-amber-100/85'
      }`}
    >
      {muestra && <span className="h-5 w-10 rounded-md border border-black/50" style={{ background: muestra }} />}
      <span className="font-bold">{nombre}</span>
      <span className="text-[11px]">{estado}</span>
    </button>
  )
}

function estadoDe(player: Player, cosa: Articulo): ReactNode {
  if (!cosa.precio) return <span className="text-amber-200/55">Gratis</span>
  if (loTienes(player, cosa.id)) return <span className="text-emerald-300">Tuyo</span>
  return <PrecioChapa precio={cosa.precio} />
}

function Deslizador({ def, value, onChange }: { def: SliderDef; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-bold text-amber-100">{def.label}</span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-7 w-full accent-amber-400"
      />
      <span className="flex justify-between text-[10.5px] text-amber-200/55">
        <span>{def.ends[0]}</span>
        <span>{def.ends[1]}</span>
      </span>
    </label>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <p className="font-west text-[16px] leading-none text-amber-100">{titulo}</p>
      {children}
    </section>
  )
}

const REJILLA = 'grid grid-cols-3 gap-1.5 sm:grid-cols-4'

function Opciones<K extends string>({ nombres, valor, onElegir }: { nombres: Record<K, string>; valor: K; onElegir: (k: K) => void }) {
  return (
    <div className={REJILLA}>
      {(Object.keys(nombres) as K[]).map((k) => (
        <Ficha key={k} activo={valor === k} onClick={() => onElegir(k)} nombre={nombres[k]} estado={<span className="text-amber-200/55">Gratis</span>} />
      ))}
    </div>
  )
}

function Muestras({ colores, valor, onElegir }: { colores: string[]; valor: string; onElegir: (hex: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colores.map((hex) => (
        <button
          key={hex}
          type="button"
          onClick={() => onElegir(hex)}
          className={`h-9 w-9 rounded-full border-2 active:scale-95 ${valor.toLowerCase() === hex.toLowerCase() ? 'border-amber-200 ring-2 ring-amber-300' : 'border-black/50'}`}
          style={{ background: hex }}
          aria-label={hex}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// El lienzo para dibujar animaciones
// ---------------------------------------------------------------------------

function Lienzo({ puntos, onCambio }: { puntos: Punto[]; onCambio: (p: Punto[]) => void }) {
  const caja = useRef<HTMLDivElement>(null)
  const pintando = useRef(false)
  const punto = (e: ReactPointerEvent): Punto => {
    const r = caja.current!.getBoundingClientRect()
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))]
  }
  const camino = puntos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * 100).toFixed(1)},${((1 - y) * 100).toFixed(1)}`).join(' ')
  const fin = puntos[puntos.length - 1]
  return (
    <div
      ref={caja}
      className="relative aspect-square w-full max-w-[300px] touch-none select-none overflow-hidden rounded-2xl border-2 border-amber-900/70 bg-[#f3e2b8]"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        pintando.current = true
        onCambio([punto(e)])
      }}
      onPointerMove={(e) => {
        if (!pintando.current) return
        onCambio([...puntos, punto(e)].slice(-400))
      }}
      onPointerUp={() => {
        pintando.current = false
      }}
      onPointerCancel={() => {
        pintando.current = false
      }}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
        {/* La silueta del vaquero, de frente: la mano del arma es la que queda a tu derecha. */}
        <g fill="#c9a46a" opacity="0.55">
          <circle cx="50" cy="38" r="9" />
          <rect x="40" y="48" width="20" height="26" rx="5" />
          <rect x="34" y="20" width="32" height="4" rx="2" />
          <rect x="42" y="12" width="16" height="10" rx="3" />
        </g>
        <circle cx="60" cy="52" r="2.5" fill="#9f1d1d" opacity="0.7" />
        <text x="4" y="8" fontSize="5" fill="#7a4a26">Arriba: brazo en alto</text>
        <text x="4" y="97" fontSize="5" fill="#7a4a26">Abajo: brazo colgando</text>
        {camino && <path d={camino} fill="none" stroke="#2a1a10" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {fin && <text x={fin[0] * 100 + 2} y={(1 - fin[1]) * 100 - 2} fontSize="7">💥</text>}
      </svg>
      {puntos.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-[30%] text-center font-west text-[15px] text-[#7a4a26]">Dibuja aquí con el dedo</p>
      )}
    </div>
  )
}

function PestanaAnimacion({
  player,
  onVer,
}: {
  player: Player
  onVer: (animacion: AnimacionDibujada | null) => void
}) {
  const [puntos, setPuntos] = useState<Punto[]>([])
  const [nombre, setNombre] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const borrador: AnimacionDibujada | null = puntos.length > 1 ? { id: 'borrador', nombre: nombre || 'Borrador', puntos: repartir(puntos) } : null
  const problema = problemaDelDibujo(puntos)
  const puesta = animacionDe(player)
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] leading-snug text-amber-100/75">
        Dibuja el movimiento que hace el brazo de tu vaquero antes de disparar. El dibujo es como si lo tuvieras delante: el tiro sale
        donde acabas el trazo. Probarlo es gratis; guardarlo cuesta <PrecioChapa precio={PRECIO_ANIMACION} />.
      </p>
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
        <Lienzo
          puntos={puntos}
          onCambio={(p) => {
            setPuntos(p)
            setAviso(null)
          }}
        />
        <div className="grid w-full max-w-[300px] gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={24}
            placeholder="Nombre (p. ej. El molinillo)"
            className="rounded-xl border-2 border-amber-900/60 bg-black/40 px-3 py-2 text-[14px] text-amber-50 placeholder:text-amber-200/40"
          />
          <button type="button" className="boton boton-fantasma text-[13px]" disabled={Boolean(problema)} onClick={() => onVer(borrador)}>
            ▶ Probar
          </button>
          <button
            type="button"
            className="boton text-[13px]"
            disabled={Boolean(problema)}
            onClick={() => {
              const fallo = guardarAnimacion(nombre, puntos)
              setAviso(fallo ?? '¡Guardada y puesta!')
              if (!fallo) {
                setPuntos([])
                setNombre('')
                onVer(null)
              }
            }}
          >
            Guardar · <PrecioChapa precio={PRECIO_ANIMACION} />
          </button>
          <button type="button" className="boton boton-fantasma text-[13px]" onClick={() => setPuntos([])}>
            Borrar el dibujo
          </button>
          {(aviso || (puntos.length > 1 && problema)) && <p className="text-center text-[13px] font-bold text-amber-200">{aviso ?? problema}</p>}
        </div>
      </div>
      <Grupo titulo={`Tus animaciones (${player.animaciones.length}/${MAX_ANIMACIONES})`}>
        <div className="grid gap-1.5">
          <FilaDeAnimacion nombre="La de siempre" puesta={!puesta} onPoner={() => ponerAnimacion(null)} onVer={() => onVer(null)} />
          {player.animaciones.map((a) => (
            <FilaDeAnimacion
              key={a.id}
              nombre={a.nombre}
              puesta={puesta?.id === a.id}
              onPoner={() => ponerAnimacion(a.id)}
              onVer={() => onVer(a)}
              onBorrar={() => borrarAnimacion(a.id)}
            />
          ))}
        </div>
      </Grupo>
    </div>
  )
}

function FilaDeAnimacion({ nombre, puesta, onPoner, onVer, onBorrar }: { nombre: string; puesta: boolean; onPoner: () => void; onVer: () => void; onBorrar?: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 ${puesta ? 'border-amber-300 bg-amber-300/15' : 'border-amber-900/60 bg-black/30'}`}>
      <span className="min-w-0 flex-1 truncate font-bold text-amber-50">{nombre}</span>
      <button type="button" onClick={onVer} className="rounded-lg bg-black/40 px-2 py-1 text-[12px] text-amber-100">
        Ver
      </button>
      {puesta ? (
        <span className="px-2 text-[12px] font-bold text-emerald-300">Puesta</span>
      ) : (
        <button type="button" onClick={onPoner} className="rounded-lg bg-amber-500/80 px-2 py-1 text-[12px] font-bold text-[#2a1a10]">
          Ponérmela
        </button>
      )}
      {onBorrar && (
        <button type="button" onClick={onBorrar} className="rounded-lg bg-rose-900/60 px-2 py-1 text-[12px] text-rose-100" title="Borrar">
          ✕
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// El panel
// ---------------------------------------------------------------------------

export function SastreriaPanel({ onSalir }: { onSalir: () => void }) {
  const player = usePlayer()
  const [prueba, setPrueba] = useState<DollLook>(() => pintaDe(player))
  const [pestana, setPestana] = useState<Pestana>('sombrero')
  const [parte, setParte] = useState<CampoDeColor>('hatColor')
  const [aviso, setAviso] = useState<string | null>(null)
  /** Lo que está haciendo el muñeco grande: su animación (o la que estás probando). */
  const [viendo, setViendo] = useState<{ animacion: AnimacionDibujada | null; vez: number } | null>(null)

  const cambiar = (cambios: Partial<DollLook>) => {
    setPrueba((antes) => cloneLook({ ...antes, ...cambios }))
    setAviso(null)
  }
  const falta = useMemo(() => loQueFalta(prueba, []).filter((id) => !loTienes(player, id)), [prueba, player])
  const total = sumar(falta)
  const alcanza = player.admin || (player.lingotes >= total.lingotes && player.diamantes >= total.diamantes)
  const guardada = JSON.stringify(pintaDe(player)) === JSON.stringify(prueba)

  const guardar = () => {
    for (const id of falta) {
      const fallo = comprar(id)
      if (fallo) {
        setAviso(fallo)
        return
      }
    }
    const fallo = ponerPinta(prueba)
    setAviso(fallo ?? '¡Hecho! Así irás por el pueblo.')
  }

  const mostrar = viendo ? viendo.animacion ?? animacionDe(player) : null
  const motion = useMemo(() => (mostrar ? movimientoDeDibujo(mostrar, true) : viendo ? DISPARO_DE_SIEMPRE : null), [mostrar, viendo])

  const articulosDe = (seccion: Seccion) => ARTICULOS.filter((a) => a.seccion === seccion)
  const valorDe = (seccion: Seccion): string =>
    seccion === 'sombrero' ? prueba.hat : seccion === 'ropa' ? prueba.outfit : seccion === 'arma' ? prueba.weapon : ''

  const cabecera = (
    <div className="flex items-center gap-3 text-[15px]">
      <span className="font-west text-yellow-300">
        <Icono nombre="lingotes" /> {player.lingotes} lingotes
      </span>
      <span className="font-west text-cyan-300">
        <Icono nombre="diamantes" /> {player.diamantes} diamantes
      </span>
      {player.admin && <span className="text-[11px] text-amber-200/60">(admin: todo gratis)</span>}
    </div>
  )

  return (
    <PanelDeSitio
      titulo="La Sastrería"
      lema="Pruébate lo que quieras: solo pagas lo que te quedas"
      icono="sastreria"
      color="#f472b6"
      onSalir={onSalir}
      fondo="linear-gradient(180deg, #3b1f2c 0%, #1a0f06 100%)"
      cabecera={cabecera}
      ancho={1000}
    >
      <div className="mx-auto flex h-full w-full max-w-[1000px] flex-col md:flex-row">
        {/* El vaquero en grande */}
        <div className="relative h-[38%] shrink-0 md:h-full md:w-[42%]">
          <VistaDeMuneco look={prueba} motion={motion} claveMotion={viendo?.vez} />
          <div className="absolute inset-x-2 bottom-2 flex justify-center gap-2">
            <button
              type="button"
              className="boton boton-fantasma px-3 py-1.5 text-[12px]"
              onClick={() => setViendo((v) => (v ? null : { animacion: null, vez: Date.now() }))}
            >
              {viendo ? '■ Quieto' : '🔫 Disparar'}
            </button>
            <button type="button" className="boton boton-fantasma px-3 py-1.5 text-[12px]" onClick={() => cambiar(pintaDe(player))} disabled={guardada}>
              Deshacer
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Las pestañas */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b-2 border-black/40 bg-black/30 p-1.5">
            {PESTANAS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPestana(p.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-bold uppercase tracking-wide ${
                  pestana === p.id ? 'bg-amber-400 text-[#2a1a10]' : 'text-amber-100/80'
                }`}
              >
                {p.nombre}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {(pestana === 'sombrero' || pestana === 'ropa' || pestana === 'arma') && (
              <>
                <div className={REJILLA}>
                  {articulosDe(pestana).map((cosa) => {
                    const valor = cosa.id.split(':')[1]!
                    return (
                      <Ficha
                        key={cosa.id}
                        activo={valorDe(pestana) === valor}
                        nombre={cosa.nombre}
                        estado={estadoDe(player, cosa)}
                        onClick={() =>
                          cambiar(pestana === 'sombrero' ? { hat: valor as DollLook['hat'] } : pestana === 'ropa' ? { outfit: valor as DollLook['outfit'] } : { weapon: valor as DollLook['weapon'] })
                        }
                      />
                    )
                  })}
                </div>
                {pestana === 'sombrero' &&
                  HAT_SLIDERS.map((def) => <Deslizador key={def.key} def={def} value={prueba[def.key]} onChange={(v) => cambiar({ [def.key]: v })} />)}
                {pestana === 'arma' && <p className="text-[12px] text-amber-200/60">El arma es de adorno: tu vaquero la lleva por el pueblo y en Los Más Buscados.</p>}
              </>
            )}

            {pestana === 'extra' && (
              <>
                <p className="text-[12px] text-amber-200/60">Puedes llevar varios a la vez: toca para ponerlo o quitarlo.</p>
                <div className={REJILLA}>
                  {articulosDe('extra').map((cosa) => {
                    const valor = cosa.id.split(':')[1] as Extra
                    const puesto = prueba.extras.includes(valor)
                    return (
                      <Ficha
                        key={cosa.id}
                        activo={puesto}
                        nombre={cosa.nombre}
                        estado={estadoDe(player, cosa)}
                        onClick={() => cambiar({ extras: puesto ? prueba.extras.filter((e) => e !== valor) : [...prueba.extras, valor] })}
                      />
                    )
                  })}
                </div>
              </>
            )}

            {pestana === 'color' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {PARTES_DE_COLOR.map((p) => (
                    <button
                      key={p.campo}
                      type="button"
                      onClick={() => setParte(p.campo)}
                      className={`rounded-full border-2 px-3 py-1 text-[12.5px] font-bold ${parte === p.campo ? 'border-amber-300 bg-amber-300/20 text-amber-50' : 'border-amber-900/60 text-amber-100/75'}`}
                    >
                      <span className="mr-1 inline-block h-3 w-3 rounded-full border border-black/50 align-[-1px]" style={{ background: prueba[p.campo] }} />
                      {p.nombre}
                    </button>
                  ))}
                </div>
                <div className={REJILLA}>
                  {COLORES.map((color) => {
                    const cosa = articulo(`color:${color.id}`)!
                    return (
                      <Ficha
                        key={color.id}
                        activo={prueba[parte].toLowerCase() === color.hex.toLowerCase()}
                        nombre={color.nombre}
                        muestra={color.hex}
                        estado={estadoDe(player, cosa)}
                        onClick={() => cambiar({ [parte]: color.hex })}
                      />
                    )
                  })}
                </div>
                <p className="text-[12px] text-amber-200/60">Un color especial se paga una vez y vale para todas tus prendas.</p>
              </>
            )}

            {pestana === 'cara' && (
              <>
                <Grupo titulo="Piel">
                  <Muestras colores={SKINS} valor={prueba.skin} onElegir={(skin) => cambiar({ skin })} />
                </Grupo>
                <Grupo titulo="Pelo, cejas y bigote">
                  <Muestras colores={HAIRS} valor={prueba.hair} onElegir={(hair) => cambiar({ hair })} />
                </Grupo>
                <Grupo titulo="Ojos">
                  <Opciones nombres={EYES} valor={prueba.eyes} onElegir={(eyes: EyeStyle) => cambiar({ eyes })} />
                </Grupo>
                <Grupo titulo="Boca">
                  <Opciones nombres={MOUTHS} valor={prueba.mouth} onElegir={(mouth: MouthStyle) => cambiar({ mouth })} />
                </Grupo>
                <Grupo titulo="Peinado">
                  <Opciones nombres={HAIRS_STYLE} valor={prueba.hairStyle} onElegir={(hairStyle: HairStyle) => cambiar({ hairStyle })} />
                </Grupo>
                <Grupo titulo="Bigote">
                  <Opciones nombres={MUSTACHES} valor={prueba.mustacheStyle} onElegir={(mustacheStyle: MustacheStyle) => cambiar({ mustacheStyle })} />
                </Grupo>
                {FACE_SLIDERS.map((def) => (
                  <Deslizador key={def.key} def={def} value={prueba[def.key]} onChange={(v) => cambiar({ [def.key]: v })} />
                ))}
              </>
            )}

            {pestana === 'cuerpo' && (
              <>
                <p className="text-[12px] text-amber-200/60">El cuerpo y la cara son tuyos: cámbialos gratis cuando quieras.</p>
                {BODY_SLIDERS.map((def) => (
                  <Deslizador key={def.key} def={def} value={prueba[def.key]} onChange={(v) => cambiar({ [def.key]: v })} />
                ))}
              </>
            )}

            {pestana === 'animacion' && <PestanaAnimacion player={player} onVer={(animacion) => setViendo({ animacion, vez: Date.now() })} />}
          </div>

          {/* Guardar la pinta (pagando lo que falte) */}
          {pestana !== 'animacion' && (
            <div className="shrink-0 border-t-2 border-black/40 bg-[#1a0f06]/90 p-2.5 pb-[max(10px,env(safe-area-inset-bottom))]">
              {falta.length > 0 && (
                <p className="mb-1.5 text-center text-[12.5px] text-amber-100/80">
                  Te falta comprar: <b>{falta.map((id) => articulo(id)?.nombre).join(', ')}</b>
                </p>
              )}
              <button type="button" className="boton w-full text-[14px]" disabled={guardada || !alcanza} onClick={guardar}>
                {guardada ? (
                  'Así vas vestido'
                ) : falta.length === 0 ? (
                  'Ponérmelo'
                ) : (
                  <>
                    Comprar y ponérmelo ·
                    {total.lingotes > 0 && <PrecioChapa precio={{ moneda: 'lingotes', cantidad: total.lingotes }} />}
                    {total.diamantes > 0 && <PrecioChapa precio={{ moneda: 'diamantes', cantidad: total.diamantes }} />}
                  </>
                )}
              </button>
              {!alcanza && !guardada && (
                <p className="mt-1 text-center text-[12px] text-rose-200">No te llega: juega partidas de rango en El Fuerte para ganar lingotes (y algún diamante).</p>
              )}
              {aviso && <p className="mt-1 text-center text-[13px] font-bold text-amber-200">{aviso}</p>}
            </div>
          )}
        </div>
      </div>
    </PanelDeSitio>
  )
}
