import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { BoxGeometry, BufferAttribute, CapsuleGeometry, CatmullRomCurve3, Color, ConeGeometry, CylinderGeometry, DataTexture, DoubleSide, Euler, ExtrudeGeometry, LatheGeometry, Matrix4, MeshStandardMaterial, MeshToonMaterial, NearestFilter, Quaternion, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3, BackSide, MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BufferGeometry, Group, Mesh, Side } from 'three'
import type { DollLook, GunStyle, Proportions } from './dollParams'

/**
 * Las piezas del muñeco, al estilo de DER DAED: primitivas escaladas con sombreado de comic
 * (tres tonos). Cada pieza va colocada RESPECTO A SU ARTICULACION, asi la misma pieza sirve
 * para el muñeco montado y para el despiece al morir.
 */

// ---------------------------------------------------------------------------
// Materiales y geometrias compartidas
// ---------------------------------------------------------------------------

/** Rampa de tres tonos para el sombreado de comic. */
const GRADIENT = (() => {
  const tex = new DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1)
  tex.minFilter = NearestFilter
  tex.magFilter = NearestFilter
  tex.needsUpdate = true
  return tex
})()

const materials = new Map<string, MeshToonMaterial>()
export function toon(color: string, emissive?: string, side?: Side): MeshToonMaterial {
  const key = `${color}|${emissive ?? ''}|${side ?? ''}`
  let material = materials.get(key)
  if (!material) {
    material = new MeshToonMaterial({ color, gradientMap: GRADIENT })
    if (emissive) material.emissive = new Color(emissive)
    if (side !== undefined) material.side = side
    materials.set(key, material)
  }
  return material
}

/** Aclara u oscurece un color (en luminosidad). */
export function shade(hex: string, amount: number): string {
  const color = new Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  color.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)))
  return `#${color.getHexString()}`
}

/** La version con menos poligonos de cada geometria compartida. */
const LOW = new Map<BufferGeometry, BufferGeometry>()
export const SPHERE = new SphereGeometry(1, 18, 14)
const HEMI = new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
export const CYL = new CylinderGeometry(1, 1, 1, 20)
export const BOX = new BoxGeometry(1, 1, 1)
export const CONE = new ConeGeometry(1, 1, 18)
const TORUS = new TorusGeometry(1, 0.08, 6, 28)
/** Medio aro: una sonrisa (al darle la vuelta). */
const ARC = new TorusGeometry(1, 0.14, 6, 16, Math.PI)
const BRIM_PTS = (
  [
    [0, 0],
    [0.6, 0],
    [0.85, 0.03],
    [0.97, 0.12],
    [1.0, 0.22],
    [0.98, 0.24],
    [0.9, 0.1],
    [0.6, 0.03],
    [0, 0.03],
  ] as [number, number][]
).map(([x, y]) => new Vector2(x, y))
const BRIM = new LatheGeometry(BRIM_PTS, 24)
const STAR = (() => {
  const shape = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false })
})()
LOW.set(SPHERE, new SphereGeometry(1, 10, 7))
LOW.set(HEMI, new SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2))
LOW.set(CYL, new CylinderGeometry(1, 1, 1, 10))
LOW.set(CONE, new ConeGeometry(1, 1, 10))
LOW.set(TORUS, new TorusGeometry(1, 0.08, 4, 14))
LOW.set(ARC, new TorusGeometry(1, 0.14, 4, 8, Math.PI))
LOW.set(BRIM, new LatheGeometry(BRIM_PTS, 12))
const capsules = new Map<string, CapsuleGeometry>()
function capsule(r: number, len: number, lite = false): CapsuleGeometry {
  const key = `${r.toFixed(3)}|${len.toFixed(3)}|${lite ? 'l' : ''}`
  let g = capsules.get(key)
  if (!g) {
    g = lite ? new CapsuleGeometry(r, Math.max(0.001, len), 2, 8) : new CapsuleGeometry(r, Math.max(0.001, len), 5, 12)
    capsules.set(key, g)
  }
  return g
}
const mustaches = new Map<string, TubeGeometry>()
function mustacheTube(style: 'manillar' | 'fumanchu'): TubeGeometry {
  let g = mustaches.get(style)
  if (!g) {
    const pts =
      style === 'manillar'
        ? [
            [0, 0, 0],
            [0.35, -0.05, 0],
            [0.7, 0.05, -0.05],
            [0.85, 0.3, -0.1],
            [0.72, 0.42, -0.1],
          ]
        : [
            [0, 0, 0],
            [0.3, -0.05, 0],
            [0.45, -0.3, 0],
            [0.5, -0.8, -0.05],
            [0.52, -1.1, -0.05],
          ]
    const curve = new CatmullRomCurve3(pts.map(([x, y, z]) => new Vector3(x, y, z)))
    g = new TubeGeometry(curve, 20, style === 'manillar' ? 0.13 : 0.07, 8)
    mustaches.set(style, g)
  }
  return g
}

type V3 = [number, number, number]

// ---------------------------------------------------------------------------
// Piezas "horneadas": en la batalla cada muñeco se une en pocas mallas
// ---------------------------------------------------------------------------

/**
 * Un muñeco entero son unas 90 piezas sueltas, y con 20 en el campo eso son miles de llamadas de
 * dibujo: el movil se arrastra. Dentro de una pieza `Baked` las primitivas NO se pintan: cada una
 * se apunta (geometria, color y sitio) y al final se **funden en una sola malla** con el color en
 * los vertices. Se hace una vez por aspecto y se reparte entre todos los muñecos iguales.
 * Fuera de `Baked` todo se pinta como siempre (cartas, fichas, vitrinas…), con todo detalle.
 */

interface BakeItem {
  g: BufferGeometry
  color: string
  matrix: Matrix4
}

interface BakeScope {
  items: BakeItem[]
  matrix: Matrix4
}

const BakeCtx = createContext<BakeScope | null>(null)

/**
 * El contorno de equipo: si hay un color en este contexto, cada malla fundida se pinta otra vez por
 * detras, un poco hinchada y lisa de ese color. Es el borde grueso azul/rojo que se ve en cualquier
 * postura, incluso con los soldados amontonados. Solo se usa en la batalla.
 */
export const OutlineCtx = createContext<string | null>(null)
const outlineMaterials = new Map<string, MeshBasicMaterial>()

export function outlineMaterial(color: string): MeshBasicMaterial {
  const hecho = outlineMaterials.get(color)
  if (hecho) return hecho
  const material = new MeshBasicMaterial({ color, side: BackSide, toneMapped: false })
  material.onBeforeCompile = (shader) => {
    // Cada vertice se empuja un poco hacia fuera, siguiendo su normal: asi el borde mide igual en todas partes.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n transformed += normalize(normal) * 0.045;',
    )
  }
  outlineMaterials.set(color, material)
  return material
}

function lo(g: BufferGeometry): BufferGeometry {
  return LOW.get(g) ?? g
}

const IDENTITY = new Matrix4()
const tmpQ = new Quaternion()
const tmpE = new Euler()
const tmpP = new Vector3()
const tmpS = new Vector3()

function localMatrix(p: V3, r: V3 | undefined, s: V3): Matrix4 {
  tmpE.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0)
  tmpQ.setFromEuler(tmpE)
  return new Matrix4().compose(tmpP.set(p[0], p[1], p[2]), tmpQ, tmpS.set(s[0], s[1], s[2]))
}

/** Un grupo que, dentro de `Baked`, solo suma su posicion a lo que cuelga de el. */
function Frame({ p = [0, 0, 0], r, s = [1, 1, 1], children }: { p?: V3; r?: V3; s?: V3; children?: ReactNode }) {
  const scope = useContext(BakeCtx)
  const next = useMemo(() => {
    if (!scope) return null
    return { items: scope.items, matrix: scope.matrix.clone().multiply(localMatrix(p, r, s)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, p[0], p[1], p[2], r?.[0], r?.[1], r?.[2], s[0], s[1], s[2]])
  if (!next) return <group position={p} rotation={r} scale={s}>{children}</group>
  return <BakeCtx.Provider value={next}>{children}</BakeCtx.Provider>
}

const BAKED_MATERIAL = new MeshToonMaterial({ vertexColors: true, gradientMap: GRADIENT, side: DoubleSide })
/** Para el campo (vallas, fuertes…): el material liso de siempre, pero con el color en los vertices. */
const BAKED_STANDARD = new MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.06, flatShading: true })
const bakedCache = new Map<string, BufferGeometry>()

function fuse(items: BakeItem[]): BufferGeometry | null {
  const parts: BufferGeometry[] = []
  for (const item of items) {
    const geometry = item.g.index ? item.g.toNonIndexed() : item.g.clone()
    geometry.deleteAttribute('uv')
    geometry.applyMatrix4(item.matrix)
    const count = geometry.getAttribute('position').count
    const color = new Color(item.color)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    parts.push(geometry)
  }
  const merged = parts.length > 0 ? mergeGeometries(parts, false) : null
  for (const part of parts) part.dispose()
  return merged
}

/**
 * Pinta lo que lleva dentro como UNA sola malla. `bakeKey` dice de que aspecto es: los muñecos
 * con el mismo aspecto comparten la malla ya fundida y ni siquiera vuelven a montar las piezas.
 */
export function Baked(props: { bakeKey: string; children: ReactNode; standard?: boolean }) {
  // Si cambia el aspecto (el mismo muñeco se viste de otra forma), se funde de nuevo: con la llave
  // React monta otra pieza en vez de quedarse con la malla de antes.
  return <BakedFundido key={props.bakeKey} {...props} />
}

function BakedFundido({ bakeKey, children, standard = false }: { bakeKey: string; children: ReactNode; standard?: boolean }) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(() => bakedCache.get(bakeKey) ?? null)
  const scope = useMemo<BakeScope>(() => ({ items: [], matrix: IDENTITY }), [])
  useLayoutEffect(() => {
    if (geometry) return
    const cached = bakedCache.get(bakeKey)
    if (cached) {
      setGeometry(cached)
      return
    }
    const merged = fuse(scope.items)
    if (merged) bakedCache.set(bakeKey, merged)
    setGeometry(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const contorno = useContext(OutlineCtx)
  if (geometry) {
    return (
      <>
        <mesh geometry={geometry} material={standard ? BAKED_STANDARD : BAKED_MATERIAL} />
        {contorno && <mesh geometry={geometry} material={outlineMaterial(contorno)} />}
      </>
    )
  }
  return <BakeCtx.Provider value={scope}>{children}</BakeCtx.Provider>
}

/** La llave de un aspecto para el cache: todo lo que cambia lo que se ve. */
export function bakeKeyOf(part: string, look: DollLook): string {
  return `${part}|${JSON.stringify(look)}`
}


/** Una pieza: geometria unitaria escalada, con su color. */
export function P({
  g,
  color,
  s,
  p = [0, 0, 0],
  r,
  emissive,
  side,
}: {
  g: BufferGeometry
  color: string
  s: V3 | number
  p?: V3
  r?: V3
  emissive?: string
  side?: Side
}) {
  const scope = useContext(BakeCtx)
  const scale: V3 = typeof s === 'number' ? [s, s, s] : s
  // Dentro de `Baked` no se pinta: se apunta para fundirla con las demas (y se desapunta al irse).
  useLayoutEffect(() => {
    if (!scope) return
    const item: BakeItem = { g: lo(g), color, matrix: scope.matrix.clone().multiply(localMatrix(p, r, scale)) }
    scope.items.push(item)
    return () => {
      const index = scope.items.indexOf(item)
      if (index >= 0) scope.items.splice(index, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (scope) return null
  return (
    <mesh geometry={g} material={toon(color, emissive, side)} position={p} rotation={r} scale={scale} castShadow />
  )
}

export interface PartProps {
  pr: Proportions
  look: DollLook
  /** En la batalla: pocas mallas y pocos poligonos (los detalles pequeños no se ven a esa distancia). */
  lite?: boolean
}

// ---------------------------------------------------------------------------
// Cuerpo
// ---------------------------------------------------------------------------

/** Cadera: tapa el hueco entre las piernas. */
export function PelvisPart({ pr, look, lite }: PartProps) {
  return <P g={lite ? lo(SPHERE) : SPHERE} color={look.pants} s={[pr.torsoW * 0.92, pr.limbR * 1.5, pr.torsoD * 0.9]} p={[0, 0.01, 0]} />
}

/** Tronco: pecho, barriga, cinturon con hebilla y lo que lleve encima. */
export function TorsoPart({ pr, look, lite }: PartProps) {
  const { torsoH, torsoW, torsoD, bellyR, headR } = pr
  const B = look.belly
  const E = look.extras
  const cuerpo = (
    <>
      <P g={SPHERE} color={look.shirt} s={[torsoW, torsoH * 0.58, torsoD]} p={[0, torsoH * 0.5, 0]} />
      <P
        g={SPHERE}
        color={look.shirt}
        s={[bellyR, bellyR * 0.9, bellyR * (0.7 + B * 0.5)]}
        p={[0, torsoH * 0.3, torsoD * 0.25 + B * torsoD * 0.35]}
      />
      <P g={CYL} color="#3b2314" s={[torsoW * 0.98, 0.05, torsoD * 1.02 + B * 0.05]} p={[0, torsoH * 0.12, 0]} />
      <P g={BOX} color="#e8c14a" s={[0.07, 0.05, 0.02]} p={[0, torsoH * 0.12, torsoD * 1.02 + B * 0.05]} />
      <Outfit pr={pr} look={look} />
      {E.includes('placa') && (
        <P
          g={STAR}
          color="#f2c94c"
          emissive="#402a00"
          s={0.07}
          p={[-torsoW * 0.5, torsoH * 0.62, torsoD * 0.97]}
        />
      )}
      {E.includes('piel') && (
        <>
          {/* Capa de piel sobre los hombros */}
          <P g={SPHERE} color="#8a6a43" s={[torsoW * 1.25, torsoH * 0.3, torsoD * 1.5]} p={[0, torsoH * 0.88, -torsoD * 0.1]} />
          <P g={SPHERE} color="#cbb890" s={[torsoW * 1.05, torsoH * 0.16, torsoD * 1.3]} p={[0, torsoH * 0.96, torsoD * 0.1]} />
        </>
      )}
      {E.includes('poncho') && (
        <>
          <P g={CONE} color="#d9822b" s={[torsoW * 1.6, torsoH * 0.85, torsoD * 1.8 + B * 0.05]} p={[0, torsoH * 0.6, 0]} />
          <P g={CYL} color="#2e86ab" s={[torsoW * 1.35, 0.04, torsoD * 1.55 + B * 0.05]} p={[0, torsoH * 0.45, 0]} />
        </>
      )}
      {E.includes('panuelo') && (
        <P
          g={CONE}
          color="#c0392b"
          s={[headR * 0.75, headR * 0.6, headR * 0.5]}
          p={[0, torsoH * 0.95, torsoD * 0.5]}
          r={[Math.PI, 0, 0]}
        />
      )}
      {look.prop === 'medico' && (
        <>
          {/* Mochila blanca con la cruz roja: se ve de lejos quien cura */}
          <P g={BOX} color="#f4f4f4" s={[torsoW * 1.05, torsoH * 0.7, 0.16]} p={[0, torsoH * 0.55, -torsoD * 1.15]} />
          <P g={BOX} color="#d62828" s={[torsoW * 0.7, torsoH * 0.16, 0.05]} p={[0, torsoH * 0.55, -torsoD * 1.15 - 0.09]} />
          <P g={BOX} color="#d62828" s={[torsoH * 0.16, torsoH * 0.5, 0.05]} p={[0, torsoH * 0.55, -torsoD * 1.15 - 0.09]} />
        </>
      )}
      {look.prop === 'bandera' && (
        <>
          {/* Una bandera alta en la espalda, del color del bando */}
          <P g={CYL} color="#6b4423" s={[0.035, 1.25, 0.035]} p={[torsoW * 0.35, torsoH * 0.5 + 0.55, -torsoD * 1.2]} />
          <P g={BOX} color={look.team ?? '#e8c14a'} s={[0.5, 0.34, 0.03]} p={[torsoW * 0.35 + 0.26, torsoH * 0.5 + 1.0, -torsoD * 1.2]} />
        </>
      )}
      {look.prop === 'barril' && (
        <>
          <P g={CYL} color="#8a5a2b" s={[0.3, 0.42, 0.3]} p={[0, torsoH * 0.55, -torsoD * 1.45]} />
          <P g={CYL} color="#3a2a1a" s={[0.32, 0.05, 0.32]} p={[0, torsoH * 0.42, -torsoD * 1.45]} />
          <P g={CYL} color="#3a2a1a" s={[0.32, 0.05, 0.32]} p={[0, torsoH * 0.7, -torsoD * 1.45]} />
        </>
      )}
      {look.prop === 'dinamita' && (
        <>
          {/* Un manojo de dinamita atado al pecho */}
          {[-1, 0, 1].map((i) => (
            <P key={i} g={CYL} color="#c0392b" s={[0.07, 0.3, 0.07]} p={[i * 0.1, torsoH * 0.55, torsoD * 1.1 + B * 0.06]} />
          ))}
          <P g={CYL} color="#f2c94c" s={[0.2, 0.04, 0.2]} p={[0, torsoH * 0.55, torsoD * 1.1 + B * 0.06 + 0.02]} />
          <P g={SPHERE} color="#ff9f1c" emissive="#ff6a00" s={0.05} p={[0, torsoH * 0.75, torsoD * 1.1 + B * 0.06]} />
        </>
      )}
      {look.prop === 'municion' && (
        <>
          {/* El tambor de municion de la minigun */}
          <P g={CYL} color="#3b3f45" s={[0.34, 0.3, 0.34]} p={[0, torsoH * 0.55, -torsoD * 1.35]} r={[Math.PI / 2, 0, 0]} />
          <P g={CYL} color="#c9a227" s={[0.36, 0.06, 0.36]} p={[0, torsoH * 0.55, -torsoD * 1.35]} r={[Math.PI / 2, 0, 0]} />
        </>
      )}
      {look.prop === 'armadura' && (
        <>
          {/* Hombreras y peto de hierro: un tanque se nota */}
          {[-1, 1].map((side) => (
            <P key={side} g={SPHERE} color="#7b8794" s={[torsoW * 0.5, torsoW * 0.36, torsoW * 0.5]} p={[side * torsoW * 0.95, torsoH * 0.85, 0]} />
          ))}
          <P g={BOX} color="#9aa5b1" s={[torsoW * 1.05, torsoH * 0.45, 0.08]} p={[0, torsoH * 0.55, torsoD * 1.0 + B * 0.06]} />
        </>
      )}
      {look.team && (
        <>
          {/* El pañuelo del bando: grande y del color de su lado, se ve desde lejos */}
          <P g={TORUS} color={look.team} s={[torsoW * 0.62, torsoW * 0.62, torsoW * 0.62]} p={[0, torsoH * 0.97, 0]} r={[Math.PI / 2, 0, 0]} />
          <P
            g={CONE}
            color={look.team}
            s={[headR * 1.05, headR * 0.95, headR * 0.7]}
            p={[0, torsoH * 0.93, torsoD * 0.55]}
            r={[Math.PI, 0, 0]}
          />
        </>
      )}
    </>
  )
  return lite ? <Baked bakeKey={bakeKeyOf('torso', look)}>{cuerpo}</Baked> : cuerpo
}

/** Lo que lleva encima de la camisa: chaleco, tirantes, bandolera, rayas o abrigo. */
function Outfit({ pr, look }: PartProps) {
  const { torsoH, torsoW, torsoD } = pr
  const B = look.belly
  const c = look.outfitColor
  // El tronco es un elipsoide: a cada altura mide menos de ancho. Las prendas lo siguen.
  const ring = (dy: number) => Math.sqrt(Math.max(0.05, 1 - (dy / (torsoH * 0.58)) ** 2))
  switch (look.outfit) {
    case 'chaleco':
      return (
        <>
          {[-1, 1].map((side) => (
            <P
              key={side}
              g={SPHERE}
              color={c}
              s={[torsoW * 0.5, torsoH * 0.5, torsoD * 1.07]}
              p={[side * torsoW * 0.42, torsoH * 0.55, torsoD * 0.06]}
            />
          ))}
          {[0.62, 0.46, 0.3].map((y) => (
            <P key={y} g={SPHERE} color="#e8c14a" s={0.014} p={[0, torsoH * y, torsoD * 1.04 + B * 0.04]} />
          ))}
        </>
      )
    case 'tirantes':
      return (
        <>
          {[-1, 1].map((side) => (
            <P
              key={side}
              g={BOX}
              color={c}
              s={[0.035, torsoH * 0.62, 0.02]}
              p={[side * torsoW * 0.36, torsoH * 0.52, torsoD * 0.98]}
              r={[-0.12, 0, side * 0.05]}
            />
          ))}
        </>
      )
    case 'bandolera':
      return (
        <>
          <P g={BOX} color={c} s={[torsoW * 1.7, 0.05, 0.03]} p={[0, torsoH * 0.5, torsoD * 1.0]} r={[0, 0, -0.85]} />
          {[-0.3, -0.1, 0.1, 0.3].map((t) => (
            <P
              key={t}
              g={CYL}
              color="#e8c14a"
              s={[0.018, 0.045, 0.018]}
              p={[t * torsoW * 0.9, torsoH * (0.5 - t * 0.55), torsoD * 1.02]}
              r={[0, 0, 0.1]}
            />
          ))}
        </>
      )
    case 'rayas':
      return (
        <>
          {[0.7, 0.55, 0.4, 0.25].map((y) => {
            const k = ring(torsoH * y - torsoH * 0.5)
            return <P key={y} g={CYL} color={c} s={[torsoW * k * 1.01, 0.028, torsoD * k * 1.01]} p={[0, torsoH * y, 0]} />
          })}
        </>
      )
    case 'abrigo':
      return (
        <>
          <P g={CYL} color={c} s={[torsoW * 1.02, torsoH * 0.34, torsoD * 1.15 + B * 0.04]} p={[0, torsoH * 0.04, 0]} />
          {[-1, 1].map((side) => (
            <P
              key={side}
              g={BOX}
              color={shade(c, 0.12)}
              s={[0.06, torsoH * 0.5, 0.025]}
              p={[side * torsoW * 0.18, torsoH * 0.66, torsoD * 1.0]}
              r={[0, 0, side * 0.35]}
            />
          ))}
        </>
      )
    default:
      return null
  }
}

/** El cuello no se ve: la cabeza va apoyada sobre el tronco. */
export function NeckPart(_props: PartProps) {
  return null
}

function Mustache({ look, size }: { look: DollLook; size: number }) {
  const s = size
  const style = look.mustacheStyle
  if (style === 'ninguno' || s < 0.005) return null
  if (style === 'manillar' || style === 'fumanchu') {
    const tube = mustacheTube(style)
    return (
      <>
        {[-1, 1].map((side) => (
          <P key={side} g={tube} color={look.hair} s={[side * s, s, s]} />
        ))}
        <P g={SPHERE} color={look.hair} s={[s * 0.22, s * 0.14, s * 0.12]} />
      </>
    )
  }
  if (style === 'morsa') {
    return (
      <>
        <P g={SPHERE} color={look.hair} s={[s * 0.5, s * 0.22, s * 0.18]} p={[0, -s * 0.05, 0]} />
        {[-1, 1].map((side) => (
          <P key={side} g={SPHERE} color={look.hair} s={[s * 0.17, s * 0.28, s * 0.14]} p={[side * s * 0.38, -s * 0.22, 0]} />
        ))}
      </>
    )
  }
  return <P g={BOX} color={look.hair} s={[s * 0.9, s * 0.06, s * 0.08]} />
}

function Hat({ look, r }: { look: DollLook; r: number }) {
  const color = look.hatColor
  switch (look.hat) {
    case 'vaquero':
      return (
        <>
          <P g={BRIM} color={color} s={[r * 1.8, r * 0.9, r * 1.45]} side={DoubleSide} />
          <P g={CYL} color={color} s={[r * 0.78, r * 0.8, r * 0.85]} p={[0, r * 0.4, 0]} />
          <P g={SPHERE} color={shade(color, -0.15)} s={[r * 0.55, r * 0.12, r * 0.25]} p={[0, r * 0.8, 0]} />
          <P g={CYL} color="#2b1a0e" s={[r * 0.8, r * 0.14, r * 0.87]} p={[0, r * 0.12, 0]} />
        </>
      )
    case 'sombrero':
      return (
        <>
          <P g={CYL} color={color} s={[r * 2.6, r * 0.06, r * 2.6]} />
          <P g={TORUS} color={shade(color, -0.1)} s={r * 2.6} p={[0, r * 0.12, 0]} r={[Math.PI / 2, 0, 0]} />
          <P g={CONE} color={color} s={[r * 0.8, r * 1.3, r * 0.8]} p={[0, r * 0.65, 0]} />
          <P g={CYL} color="#c0392b" s={[r * 0.72, r * 0.15, r * 0.72]} p={[0, r * 0.12, 0]} />
        </>
      )
    case 'chistera':
      return (
        <>
          <P g={CYL} color={color} s={[r * 1.25, r * 0.06, r * 1.25]} />
          <P g={CYL} color={color} s={[r * 0.78, r * 1.5, r * 0.78]} p={[0, r * 0.75, 0]} />
          <P g={CYL} color="#8e2b2b" s={[r * 0.8, r * 0.18, r * 0.8]} p={[0, r * 0.15, 0]} />
        </>
      )
    case 'bombin':
      return (
        <>
          <P g={CYL} color={color} s={[r * 1.15, r * 0.06, r * 1.15]} />
          <P g={HEMI} color={color} s={r * 0.85} />
        </>
      )
    case 'minero':
      return (
        <>
          <P g={HEMI} color="#d8b13a" s={[r * 1.05, r * 0.9, r * 1.05]} p={[0, -r * 0.15, 0]} />
          <P g={CYL} color="#d8b13a" s={[r * 1.15, r * 0.05, r * 1.2]} p={[0, -r * 0.15, 0]} />
          <P g={CYL} color="#555555" s={[r * 0.22, r * 0.2, r * 0.22]} p={[0, r * 0.3, r * 0.95]} r={[Math.PI / 2, 0, 0]} />
          <P g={SPHERE} color="#fff6a0" emissive="#ffe070" s={r * 0.16} p={[0, r * 0.3, r * 1.07]} />
        </>
      )
    case 'cofia':
      return (
        <>
          <P g={SPHERE} color={color} s={[r * 1.05, r * 1.0, r * 0.9]} p={[0, -r * 0.25, -r * 0.25]} />
          <P g={TORUS} color="#ffffff" s={r * 0.98} p={[0, -r * 0.25, r * 0.15]} />
          {[-1, 1].map((side) => (
            <P key={side} g={SPHERE} color="#e67e9f" s={[r * 0.2, r * 0.14, r * 0.1]} p={[side * r * 0.2, -r * 1.35, r * 0.45]} />
          ))}
        </>
      )
    case 'kepi':
      return (
        <>
          <P g={CYL} color={color} s={[r * 0.95, r * 0.5, r * 0.95]} p={[0, r * 0.22, 0]} />
          <P g={CYL} color={shade(color, 0.08)} s={[r * 1.02, r * 0.1, r * 1.02]} p={[0, r * 0.46, 0]} />
          <P g={BOX} color="#16130f" s={[r * 1.0, r * 0.05, r * 0.7]} p={[0, r * 0.0, r * 0.95]} r={[0.12, 0, 0]} />
          <P g={SPHERE} color="#e8c14a" emissive="#402a00" s={r * 0.13} p={[0, r * 0.25, r * 0.97]} />
        </>
      )
    case 'toca':
      return (
        <>
          <P g={HEMI} color={color} s={[r * 1.12, r * 1.0, r * 1.08]} p={[0, -r * 0.2, -r * 0.05]} />
          {[-1, 1].map((side) => (
            <P key={side} g={SPHERE} color={color} s={[r * 0.2, r * 0.85, r * 0.55]} p={[side * r * 1.0, -r * 0.7, -r * 0.1]} />
          ))}
          <P g={BOX} color="#f6f1e4" s={[r * 1.8, r * 0.16, r * 0.1]} p={[0, -r * 0.18, r * 1.0]} />
        </>
      )
    case 'bandana':
      return (
        <>
          <P g={HEMI} color={color} s={[r * 1.06, r * 0.62, r * 1.02]} p={[0, -r * 0.12, 0]} />
          <P g={SPHERE} color={shade(color, -0.1)} s={[r * 0.3, r * 0.22, r * 0.22]} p={[0, -r * 0.2, -r * 1.0]} />
          {[-1, 1].map((side) => (
            <P
              key={side}
              g={SPHERE}
              color={shade(color, -0.1)}
              s={[r * 0.1, r * 0.3, r * 0.08]}
              p={[side * r * 0.15, -r * 0.5, -r * 1.05]}
              r={[0, 0, side * 0.3]}
            />
          ))}
        </>
      )
    case 'pluma':
      return (
        <>
          <P g={TORUS} color={color} s={r * 1.02} p={[0, -r * 0.1, 0]} r={[Math.PI / 2, 0, 0]} />
          <P g={CONE} color="#f1ede1" s={[r * 0.14, r * 1.2, r * 0.05]} p={[r * 0.95, r * 0.55, 0]} r={[0, 0, -0.35]} />
          <P g={CONE} color="#c0392b" s={[r * 0.14, r * 0.35, r * 0.06]} p={[r * 1.15, r * 1.0, 0]} r={[0, 0, -0.35]} />
        </>
      )
    case 'plumas':
      // El tocado de guerra: una cinta y un abanico de plumas blancas con la punta roja y azul.
      return (
        <>
          <P g={TORUS} color={color} s={r * 1.04} p={[0, -r * 0.05, 0]} r={[Math.PI / 2, 0, 0]} />
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => (
            <group key={i}>
              <P
                g={CONE}
                color="#f4efe2"
                s={[r * 0.2, r * 1.35, r * 0.07]}
                p={[Math.sin(i * 0.27) * r * 1.2, r * (0.55 + Math.cos(i * 0.27) * 0.4), -r * 0.35]}
                r={[0, 0, -i * 0.27]}
              />
              <P
                g={CONE}
                color={i % 2 === 0 ? '#c0392b' : '#2e86ab'}
                s={[r * 0.2, r * 0.4, r * 0.075]}
                p={[Math.sin(i * 0.27) * r * 1.75, r * (0.9 + Math.cos(i * 0.27) * 0.78), -r * 0.35]}
                r={[0, 0, -i * 0.27]}
              />
            </group>
          ))}
        </>
      )
    case 'cuernos':
      // El casco vikingo: cupula de hierro, nariz y dos cuernos largos.
      return (
        <>
          <P g={HEMI} color="#7b8794" s={[r * 1.1, r * 1.0, r * 1.08]} p={[0, -r * 0.12, 0]} />
          <P g={CYL} color="#5d6773" s={[r * 1.12, r * 0.12, r * 1.1]} p={[0, -r * 0.1, 0]} />
          <P g={BOX} color="#5d6773" s={[r * 0.12, r * 0.7, r * 0.1]} p={[0, -r * 0.5, r * 1.02]} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <P g={CONE} color="#efe6cf" s={[r * 0.3, r * 1.1, r * 0.3]} p={[side * r * 1.15, r * 0.4, 0]} r={[0, 0, -side * 0.55]} />
              <P g={SPHERE} color="#cbbf9f" s={r * 0.22} p={[side * r * 1.0, -r * 0.05, 0]} />
            </group>
          ))}
        </>
      )
    case 'casco':
      return (
        <>
          <P g={HEMI} color="#8a949f" s={[r * 1.1, r * 1.0, r * 1.08]} p={[0, -r * 0.12, 0]} />
          <P g={CYL} color="#5d6773" s={[r * 1.12, r * 0.12, r * 1.1]} p={[0, -r * 0.1, 0]} />
          <P g={BOX} color="#5d6773" s={[r * 0.12, r * 0.7, r * 0.1]} p={[0, -r * 0.5, r * 1.02]} />
          <P g={BOX} color="#5d6773" s={[r * 0.1, r * 0.1, r * 1.9]} p={[0, r * 0.78, 0]} />
        </>
      )
    case 'cinta':
      return (
        <>
          <P g={TORUS} color={color} s={r * 1.03} p={[0, -r * 0.05, 0]} r={[Math.PI / 2, 0, 0]} />
          <P g={CONE} color="#f1ede1" s={[r * 0.14, r * 1.1, r * 0.05]} p={[-r * 0.95, r * 0.5, -r * 0.2]} r={[0, 0, 0.3]} />
          <P g={CONE} color="#2e86ab" s={[r * 0.14, r * 0.4, r * 0.06]} p={[-r * 1.1, r * 0.95, -r * 0.2]} r={[0, 0, 0.3]} />
        </>
      )
    case 'gorro':
      return (
        <>
          <P g={HEMI} color={color} s={[r * 1.08, r * 0.95, r * 1.05]} p={[0, -r * 0.1, 0]} />
          <P g={TORUS} color={shade(color, 0.12)} s={r * 1.03} p={[0, -r * 0.1, 0]} r={[Math.PI / 2, 0, 0]} />
          <P g={SPHERE} color={shade(color, 0.2)} s={r * 0.22} p={[0, r * 0.88, 0]} />
        </>
      )
    default:
      return null
  }
}

/** Como cambia cada tipo de ojo: tamaño, pupila, parpado y la ceja que lo acompaña. */
interface EyeLook {
  size: number
  white: number
  pupil: number
  pupilColor: string
  /** Cuanto se acerca la pupila al centro de la cara (bizco). */
  cross: number
  noWhite?: boolean
  /** 0 = abierto, 1 = cerrado del todo: el parpado de arriba. */
  lid: number
  /** Inclinacion de la ceja (+ la baja hacia la nariz = cara de enfado). */
  brow: number
  lift: number
}

const EYE_LOOKS: Record<string, EyeLook> = {
  normal: { size: 1, white: 1, pupil: 0.5, pupilColor: '#1a1a1a', cross: 0.1, lid: 0, brow: 0.25, lift: 0 },
  furioso: { size: 0.95, white: 0.85, pupil: 0.45, pupilColor: '#1a1a1a', cross: 0.1, lid: 0.35, brow: 0.62, lift: -0.02 },
  dormilon: { size: 1, white: 1, pupil: 0.5, pupilColor: '#1a1a1a', cross: 0, lid: 0.62, brow: 0.05, lift: -0.04 },
  bizco: { size: 1.05, white: 1, pupil: 0.55, pupilColor: '#1a1a1a', cross: 0.5, lid: 0, brow: 0.1, lift: 0.02 },
  asustado: { size: 1.35, white: 1, pupil: 0.28, pupilColor: '#1a1a1a', cross: 0, lid: 0, brow: -0.3, lift: 0.1 },
  punto: { size: 0.8, white: 0, pupil: 0.62, pupilColor: '#101010', cross: 0, noWhite: true, lid: 0, brow: 0.12, lift: 0 },
  siniestro: { size: 1, white: 0.5, pupil: 0.42, pupilColor: '#9b1c1c', cross: 0, lid: 0.25, brow: 0.5, lift: 0 },
}

/** La boca, segun su tipo. */
function Mouth({ look, headR }: { look: DollLook; headR: number }) {
  const y = -headR * 0.46
  const z = headR * 0.88
  const hw = look.headWidth
  switch (look.mouth) {
    case 'seria':
      return <P g={BOX} color="#4a1410" s={[headR * 0.34, headR * 0.05, headR * 0.05]} p={[0, y, z]} />
    case 'mueca':
      return <P g={BOX} color="#4a1410" s={[headR * 0.32, headR * 0.06, headR * 0.05]} p={[headR * 0.05, y, z]} r={[0, 0, 0.35]} />
    case 'boquiabierto':
      return (
        <>
          <P g={SPHERE} color="#3a0d0a" s={[headR * 0.14, headR * 0.19, headR * 0.06]} p={[0, y - headR * 0.04, z]} />
          <P g={SPHERE} color="#d76a6a" s={[headR * 0.09, headR * 0.06, headR * 0.04]} p={[0, y - headR * 0.11, z + headR * 0.015]} />
        </>
      )
    case 'dientes':
      return (
        <>
          <P g={SPHERE} color="#3a0d0a" s={[headR * 0.27 * Math.min(hw, 1.2), headR * 0.12, headR * 0.05]} p={[0, y, z]} />
          <P
            g={BOX}
            color="#f7f1dc"
            s={[headR * 0.4 * Math.min(hw, 1.2), headR * 0.06, headR * 0.02]}
            p={[0, y + headR * 0.05, z + headR * 0.04]}
          />
        </>
      )
    case 'diente-oro':
      return (
        <>
          <P g={BOX} color="#4a1410" s={[headR * 0.34, headR * 0.05, headR * 0.05]} p={[0, y, z]} />
          <P
            g={BOX}
            color="#f2c94c"
            emissive="#402a00"
            s={[headR * 0.07, headR * 0.1, headR * 0.03]}
            p={[headR * 0.07, y - headR * 0.06, z + headR * 0.01]}
          />
        </>
      )
    case 'lengua':
      return (
        <>
          <P g={BOX} color="#4a1410" s={[headR * 0.3, headR * 0.05, headR * 0.05]} p={[0, y, z]} r={[0, 0, -0.18]} />
          <P g={SPHERE} color="#e0587a" s={[headR * 0.1, headR * 0.15, headR * 0.05]} p={[headR * 0.08, y - headR * 0.12, z + headR * 0.01]} />
        </>
      )
    default:
      return <P g={ARC} color="#4a1410" s={[headR * 0.2, headR * 0.16, headR * 0.05]} p={[0, y + headR * 0.1, z]} r={[0, 0, Math.PI]} />
  }
}

/** El pelo: lo que asoma por debajo del sombrero, o todo si no lleva. */
function Hair({ look, headR }: { look: DollLook; headR: number }) {
  const hw = look.headWidth
  const c = look.hair
  const cap = (
    <P g={HEMI} color={c} s={[headR * 1.04 * hw, headR * 0.82, headR]} p={[0, headR * 0.15, -headR * 0.04]} r={[-0.25, 0, 0]} />
  )
  switch (look.hairStyle) {
    case 'calvo':
      return null
    case 'tonsura':
      // Solo una corona de pelo alrededor de la coronilla pelada.
      return (
        <P g={TORUS} color={c} s={[headR * 0.98 * hw, headR * 0.98, headR * 0.9]} p={[0, headR * 0.28, -headR * 0.05]} r={[Math.PI / 2, 0, 0]} />
      )
    case 'melena':
      return (
        <>
          {cap}
          <P g={SPHERE} color={c} s={[headR * 1.02 * hw, headR * 1.35, headR * 0.5]} p={[0, -headR * 0.45, -headR * 0.55]} />
          {[-1, 1].map((side) => (
            <P
              key={side}
              g={SPHERE}
              color={c}
              s={[headR * 0.2, headR * 0.7, headR * 0.3]}
              p={[side * headR * 0.95 * hw, -headR * 0.2, -headR * 0.15]}
            />
          ))}
        </>
      )
    case 'coleta':
      return (
        <>
          {cap}
          <P g={SPHERE} color="#c0392b" s={headR * 0.14} p={[0, headR * 0.0, -headR * 1.0]} />
          <P g={SPHERE} color={c} s={[headR * 0.2, headR * 0.28, headR * 0.2]} p={[0, -headR * 0.25, -headR * 1.12]} />
          <P g={SPHERE} color={c} s={[headR * 0.17, headR * 0.3, headR * 0.17]} p={[0, -headR * 0.62, -headR * 1.16]} />
          <P g={SPHERE} color={c} s={[headR * 0.12, headR * 0.26, headR * 0.12]} p={[0, -headR * 0.95, -headR * 1.14]} />
        </>
      )
    case 'trenzas':
      return (
        <>
          {cap}
          {[-1, 1].map((side) =>
            [0, 1, 2].map((i) => (
              <P
                key={`${side}${i}`}
                g={SPHERE}
                color={i === 2 ? '#c0392b' : c}
                s={[headR * 0.15, headR * 0.2, headR * 0.15]}
                p={[side * headR * (0.98 * hw + i * 0.03), -headR * (0.2 + i * 0.36), -headR * 0.15]}
              />
            )),
          )}
        </>
      )
    case 'tupe':
      return (
        <>
          {cap}
          <P g={SPHERE} color={c} s={[headR * 0.78 * hw, headR * 0.42, headR * 0.6]} p={[0, headR * 0.92, headR * 0.28]} r={[0.3, 0, 0]} />
        </>
      )
    default:
      return cap
  }
}

/** Cabeza: craneo, mandibula, orejas, ojos (parpadean), cejas, nariz, boca, pelo, sombrero y extras. */
export function HeadPart({ pr, look, eyesRef, lite }: PartProps & { eyesRef?: Ref<Group> }) {
  const headR = pr.headR
  const E = look.extras
  const hw = look.headWidth
  const style = EYE_LOOKS[look.eyes] ?? EYE_LOOKS.normal!
  const eyeR = headR * 0.2 * look.eyeSize * style.size
  const eyeZ = headR * 0.82
  const eyeX = headR * 0.36 * Math.min(hw, 1.25)
  const eyeY = headR * 0.12 + headR * style.lift
  const patch = E.includes('parche')
  const lidColor = shade(look.skin, -0.06)
  const G = (g: BufferGeometry) => (lite ? lo(g) : g)
  // Lo fijo de la cabeza (todo menos los ojos, que parpadean) se funde en una sola malla.
  const fijo = (
    <>
      <P g={SPHERE} color={look.skin} s={[headR * hw, headR * 1.02, headR * 0.95]} />
      {/* La mandibula: cuanta barbilla tiene */}
      <P
        g={SPHERE}
        color={look.skin}
        s={[headR * hw * (0.55 + look.jaw * 0.4), headR * (0.28 + look.jaw * 0.3), headR * 0.7]}
        p={[0, -headR * 0.58, headR * 0.12]}
      />
      {[-1, 1].map((side) => (
        <P
          key={side}
          g={SPHERE}
          color={look.skin}
          s={[headR * 0.18 * look.earSize, headR * 0.26 * look.earSize, headR * 0.12 * look.earSize]}
          p={[side * headR * hw * 0.95, 0, 0]}
        />
      ))}
      {E.includes('pendiente') && (
        <P g={TORUS} color="#f2c94c" emissive="#402a00" s={headR * 0.1} p={[headR * hw * 0.98, -headR * 0.28 * look.earSize, headR * 0.02]} />
      )}

      {patch && (
        <>
          <P g={SPHERE} color="#111111" s={[eyeR * 1.2, eyeR * 1.1, eyeR * 0.4]} p={[eyeX, headR * 0.12, eyeZ + eyeR * 0.2]} />
          <P g={CYL} color="#111111" s={[headR * 1.02 * hw, headR * 0.05, headR * 1.0]} p={[0, headR * 0.2, 0]} r={[0, 0, -0.5]} />
        </>
      )}
      {E.includes('gafas') &&
        [-1, 1].map((side) => (
          <P key={side} g={TORUS} color="#c9a227" s={eyeR * 1.35} p={[side * eyeX, headR * 0.12, eyeZ + eyeR * 0.7]} />
        ))}
      {look.eyebrows > 0.05 &&
        [-1, 1].map((side) => (
          <P
            key={side}
            g={BOX}
            color={look.hair}
            s={[headR * 0.42 * (0.7 + look.eyebrows * 0.3), headR * 0.08 * look.eyebrows, headR * 0.1]}
            p={[side * eyeX, headR * 0.38 + eyeR * 0.5 + headR * style.lift * 1.6, headR * 0.84]}
            r={[0, 0, side * -style.brow]}
          />
        ))}
      <P
        g={SPHERE}
        color={shade(look.skin, -0.12)}
        s={[headR * 0.17 * look.noseSize, headR * 0.15 * look.noseSize, headR * 0.17 * look.noseSize]}
        p={[0, -headR * 0.05, headR * 0.95]}
      />
      <Mouth look={look} headR={headR} />
      {E.includes('cicatriz') && (
        <>
          <P g={BOX} color="#b5584a" s={[headR * 0.035, headR * 0.6, headR * 0.03]} p={[-headR * 0.5 * hw, -headR * 0.05, headR * 0.82]} r={[0, 0.4, 0.25]} />
          {[-0.12, 0.05, 0.22].map((dy) => (
            <P key={dy} g={BOX} color="#b5584a" s={[headR * 0.12, headR * 0.025, headR * 0.03]} p={[-headR * 0.5 * hw, -headR * dy, headR * 0.84]} />
          ))}
        </>
      )}
      {E.includes('pintura') &&
        [-1, 1].map((side) => (
          <group key={side}>
            <P g={BOX} color="#c0392b" s={[headR * 0.34, headR * 0.07, headR * 0.03]} p={[side * headR * 0.42 * hw, -headR * 0.05, headR * 0.84]} r={[0, 0, side * 0.2]} />
            <P g={BOX} color="#f4efe2" s={[headR * 0.3, headR * 0.05, headR * 0.03]} p={[side * headR * 0.42 * hw, -headR * 0.2, headR * 0.84]} r={[0, 0, side * 0.2]} />
          </group>
        ))}
      {E.includes('pecas') &&
        [-1, 1].flatMap((side) =>
          [0, 1, 2].map((i) => (
            <P
              key={`${side}${i}`}
              g={SPHERE}
              color={shade(look.skin, -0.22)}
              s={headR * 0.032}
              p={[side * (headR * 0.2 + i * headR * 0.06) * hw, -headR * (0.12 + (i % 2) * 0.07), headR * 0.93]}
            />
          )),
        )}
      {look.beard > 0.05 && (
        <P
          g={SPHERE}
          color={look.hair}
          s={[headR * 0.82 * hw, headR * 0.55 * look.beard + headR * 0.2, headR * 0.55]}
          p={[0, -headR * 0.55 - look.beard * headR * 0.25, headR * 0.35]}
        />
      )}
      <Frame p={[0, -headR * 0.28, headR * 0.95]}>
        <Mustache look={look} size={look.mustache * headR} />
      </Frame>
      <Hair look={look} headR={headR} />
      {E.includes('mascara') && (
        <P g={CONE} color="#7a1f1f" s={[headR * 1.02 * hw, headR * 0.9, headR]} p={[0, -headR * 0.5, headR * 0.05]} r={[Math.PI, 0, 0]} />
      )}
      {E.includes('puro') && (
        <>
          <P
            g={CYL}
            color="#6b4226"
            s={[headR * 0.06, headR * 0.5, headR * 0.06]}
            p={[headR * 0.25, -headR * 0.45, headR * 1.1]}
            r={[Math.PI / 2, 0, 0.4]}
          />
          <P g={SPHERE} color="#ff5a1f" emissive="#ff3000" s={headR * 0.07} p={[headR * 0.36, -headR * 0.45, headR * 1.33]} />
        </>
      )}
      <Frame p={[0, headR * 0.6, 0]} r={[0, 0, 0.06]}>
        <Hat look={look} r={headR * look.hatSize} />
      </Frame>
    </>
  )
  const ojos = (
    <>
        {[-1, 1].map((side) =>
          patch && side === 1 ? null : (
            <group key={side}>
              {!style.noWhite && (
                <P g={G(SPHERE)} color="#ffffff" s={[eyeR, eyeR * 1.1 * style.white, eyeR * 0.7]} p={[side * eyeX, eyeY, eyeZ]} />
              )}
              <P
                g={G(SPHERE)}
                color={style.pupilColor}
                s={eyeR * style.pupil * (style.noWhite ? 1.2 : 1)}
                p={[side * eyeX - side * eyeR * style.cross, eyeY - headR * 0.02, eyeZ + eyeR * 0.6]}
              />
              {style.lid > 0 && (
                <P
                  g={G(SPHERE)}
                  color={lidColor}
                  s={[eyeR * 1.08, eyeR * (0.35 + style.lid * 0.55), eyeR * 0.78]}
                  p={[side * eyeX, eyeY + eyeR * (1.02 - style.lid * 0.45), eyeZ + eyeR * 0.05]}
                  r={[0, 0, side * (style.brow > 0.4 ? -0.35 : 0)]}
                />
              )}
            </group>
          ),
        )}
    </>
  )
  return (
    <>
      {lite ? <Baked bakeKey={bakeKeyOf('head', look)}>{fijo}</Baked> : fijo}
      <group ref={eyesRef}>{lite ? <Baked bakeKey={bakeKeyOf('ojos', look)}>{ojos}</Baked> : ojos}</group>
    </>
  )
}

// ---------------------------------------------------------------------------
// Brazos y piernas: capsulas partidas en dos para que doblen codo y rodilla
// ---------------------------------------------------------------------------

export function UpperArmPart({ pr, look, lite }: PartProps) {
  const r = pr.limbR * 0.9
  const brazo = (
    <>
      <P g={capsule(r, pr.upperArm, lite)} color={look.shirt} s={1} p={[0, -pr.upperArm / 2, 0]} />
      {/* El brazalete del bando */}
      {look.team && <P g={TORUS} color={look.team} s={[r * 1.65, r * 1.65, r * 2.6]} p={[0, -pr.upperArm * 0.5, 0]} r={[Math.PI / 2, 0, 0]} />}
    </>
  )
  return lite && look.team ? <Baked bakeKey={bakeKeyOf('arm', look)}>{brazo}</Baked> : brazo
}

export function LowerArmPart({ pr, look, lite }: PartProps) {
  const r = pr.limbR * 0.85
  return <mesh geometry={capsule(r, pr.foreArm, lite)} material={toon(look.shirt)} position={[0, -pr.foreArm / 2, 0]} castShadow />
}

/**
 * El arma que lleva en la mano. Apunta "hacia abajo del brazo": al levantar el brazo para
 * disparar, el canon queda mirando al frente.
 */
function gunBuild(style: GunStyle, handR: number): { body: JSX.Element; len: number; thrown: boolean } {
  const steel = '#39414f'
  const wood = '#6b3f1f'
  let len = handR * 3.6
  let body: JSX.Element
  switch (style) {
    case 'rifle':
      len = handR * 9
      body = (
        <>
          <P g={BOX} color={steel} s={[handR * 0.36, len, handR * 0.36]} p={[0, -len * 0.5, 0]} />
          <P g={BOX} color={wood} s={[handR * 0.55, handR * 3.2, handR * 0.8]} p={[0, len * 0.08, handR * 0.1]} r={[0.12, 0, 0]} />
          <P g={BOX} color={wood} s={[handR * 0.5, len * 0.3, handR * 0.55]} p={[0, -len * 0.38, handR * 0.1]} />
        </>
      )
      break
    case 'escopeta':
      len = handR * 6.4
      body = (
        <>
          {[-1, 1].map((side) => (
            <P key={side} g={CYL} color={steel} s={[handR * 0.22, len, handR * 0.22]} p={[side * handR * 0.22, -len * 0.5, 0]} />
          ))}
          <P g={BOX} color={wood} s={[handR * 0.7, handR * 2.6, handR * 0.9]} p={[0, len * 0.06, handR * 0.12]} r={[0.2, 0, 0]} />
        </>
      )
      break
    case 'dinamita':
      len = handR * 2.6
      body = (
        <>
          <P g={CYL} color="#b3261e" s={[handR * 0.42, len, handR * 0.42]} p={[0, -len * 0.5, 0]} />
          <P g={CYL} color="#e8d9b0" s={[handR * 0.06, len * 0.3, handR * 0.06]} p={[0, -len * 1.05, 0]} />
        </>
      )
      break
    case 'arco':
      len = handR * 6
      body = (
        <>
          {/* Dos palas curvas, la cuerda y una flecha al frente */}
          {[-1, 1].map((side) => (
            <P key={side} g={BOX} color="#8a5a2b" s={[handR * 0.28, len * 0.62, handR * 0.28]} p={[side * len * 0.2, -len * 0.18, 0]} r={[0, 0, side * 0.42]} />
          ))}
          <P g={BOX} color="#e8d9b0" s={[len * 0.74, handR * 0.06, handR * 0.06]} p={[0, -len * 0.5, 0]} />
          <P g={BOX} color="#cbbf9f" s={[handR * 0.1, len * 1.05, handR * 0.1]} p={[0, -len * 0.5, 0]} />
          <P g={CONE} color="#9aa5b1" s={[handR * 0.2, handR * 0.5, handR * 0.2]} p={[0, -len * 1.08, 0]} r={[Math.PI, 0, 0]} />
        </>
      )
      break
    case 'hacha':
      len = handR * 5.2
      body = (
        <>
          <P g={CYL} color="#6b4423" s={[handR * 0.22, len, handR * 0.22]} p={[0, -len * 0.5, 0]} />
          <P g={BOX} color="#9aa5b1" s={[handR * 1.5, handR * 1.1, handR * 0.22]} p={[handR * 0.7, -len * 0.92, 0]} />
          <P g={BOX} color="#5d6773" s={[handR * 0.3, handR * 0.5, handR * 0.3]} p={[0, -len * 0.92, 0]} />
        </>
      )
      break
    case 'lanza':
      len = handR * 9.5
      body = (
        <>
          <P g={CYL} color="#6b4423" s={[handR * 0.2, len, handR * 0.2]} p={[0, -len * 0.45, 0]} />
          <P g={CONE} color="#9aa5b1" s={[handR * 0.42, handR * 1.5, handR * 0.2]} p={[0, -len * 1.0, 0]} r={[Math.PI, 0, 0]} />
          <P g={BOX} color="#c0392b" s={[handR * 0.5, handR * 0.5, handR * 0.1]} p={[0, -len * 0.88, 0]} />
        </>
      )
      break
    case 'martillo':
      len = handR * 5
      body = (
        <>
          <P g={CYL} color="#6b4423" s={[handR * 0.24, len, handR * 0.24]} p={[0, -len * 0.5, 0]} />
          <P g={BOX} color="#7b8794" s={[handR * 1.6, handR * 1.1, handR * 1.1]} p={[0, -len * 0.95, 0]} />
          <P g={BOX} color="#c9a227" s={[handR * 1.62, handR * 0.16, handR * 1.12]} p={[0, -len * 0.82, 0]} />
        </>
      )
      break
    case 'botella':
      len = handR * 3
      body = (
        <>
          <P g={CYL} color="#3d7a3a" s={[handR * 0.5, len * 0.6, handR * 0.5]} p={[0, -len * 0.55, 0]} />
          <P g={CYL} color="#3d7a3a" s={[handR * 0.2, len * 0.4, handR * 0.2]} p={[0, -len * 0.05, 0]} />
          <P g={BOX} color="#e8d9b0" s={[handR * 0.52, len * 0.25, handR * 0.1]} p={[0, -len * 0.55, handR * 0.46]} />
        </>
      )
      break
    default:
      body = (
        <>
          <P g={BOX} color={steel} s={[handR * 0.5, len, handR * 0.5]} p={[0, -len * 0.5, 0]} />
          <P g={CYL} color="#39415a" s={[handR * 0.82, handR * 0.72, handR * 0.82]} p={[0, -len * 0.2, 0]} r={[0, 0, Math.PI / 2]} />
          <P g={BOX} color={wood} s={[handR * 0.45, handR * 1.3, handR * 0.7]} p={[0, len * 0.12, handR * 0.55]} r={[0.5, 0, 0]} />
        </>
      )
  }
  return { body, len, thrown: style === 'dinamita' || style === 'botella' }
}

/** El arma de la mano con su fogonazo (la version completa, para cartas y fichas). */
function HeldGun({ style, handR, flashRef }: { style: GunStyle; handR: number; flashRef?: Ref<Mesh> }) {
  const { body, len, thrown } = gunBuild(style, handR)
  return (
    <group position={[0, -handR * 0.9, handR * 0.4]} rotation={[-0.25, 0, 0]}>
      {body}
      <mesh ref={flashRef} visible={false} position={[0, thrown ? -len * 1.2 : -len * 1.04, 0]} geometry={SPHERE} scale={handR * (style === 'escopeta' ? 1.4 : 0.95)}>
        <meshBasicMaterial color={thrown ? '#ffb347' : '#ffd27a'} transparent opacity={0.9} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Mano. Lleva el arma en la derecha (y en la izquierda si son dos revolveres). */
export function HandPart({
  pr,
  look,
  right = false,
  flashRef,
  lite,
}: PartProps & { right?: boolean; flashRef?: Ref<Mesh> }) {
  const twin = look.weapon === 'dos-revolveres'
  const gun: GunStyle | null = twin ? 'revolver' : right ? look.weapon : null
  if (!lite) {
    return (
      <>
        <P g={SPHERE} color={look.skin} s={pr.handR} p={[0, -pr.limbR * 0.4, 0]} />
        {gun && <HeldGun style={gun} handR={pr.handR} flashRef={flashRef} />}
      </>
    )
  }
  // En la batalla: la mano y el arma, fundidas en una sola malla; solo el fogonazo va suelto.
  const { len, thrown } = gun ? gunBuild(gun, pr.handR) : { len: 0, thrown: false }
  return (
    <>
      <Baked bakeKey={`mano|${gun}|${look.skin}|${pr.handR.toFixed(4)}|${pr.limbR.toFixed(4)}`}>
        <P g={SPHERE} color={look.skin} s={pr.handR} p={[0, -pr.limbR * 0.4, 0]} />
        {gun && (
          <Frame p={[0, -pr.handR * 0.9, pr.handR * 0.4]} r={[-0.25, 0, 0]}>
            {gunBuild(gun, pr.handR).body}
          </Frame>
        )}
      </Baked>
      {gun && (
        <group position={[0, -pr.handR * 0.9, pr.handR * 0.4]} rotation={[-0.25, 0, 0]}>
          <mesh
            ref={flashRef}
            visible={false}
            position={[0, thrown ? -len * 1.2 : -len * 1.04, 0]}
            geometry={lo(SPHERE)}
            scale={pr.handR * (gun === 'escopeta' ? 1.4 : 0.95)}
          >
            <meshBasicMaterial color={thrown ? '#ffb347' : '#ffd27a'} transparent opacity={0.9} toneMapped={false} />
          </mesh>
        </group>
      )}
    </>
  )
}

export function ThighPart({ pr, look, lite }: PartProps) {
  return <mesh geometry={capsule(pr.limbR, pr.thigh, lite)} material={toon(look.pants)} position={[0, -pr.thigh / 2, 0]} castShadow />
}

export function ShinPart({ pr, look, lite }: PartProps) {
  return <mesh geometry={capsule(pr.limbR * 0.95, pr.shin, lite)} material={toon(look.pants)} position={[0, -pr.shin / 2, 0]} castShadow />
}

/** Bota de bloque. */
export function BootPart({ pr, look }: PartProps) {
  const { limbR, bootH } = pr
  return <P g={BOX} color={look.boots} s={[limbR * 2.4, bootH, limbR * 3.6]} p={[0, -bootH / 2 + 0.01, limbR * 0.7]} />
}

/** Material liso para cosas que no son del muñeco (campo, fuertes...). */
export function Mat({
  color,
  rough = 0.82,
  metal = 0.06,
  flat = true,
  emissive,
}: {
  color: string
  rough?: number
  metal?: number
  flat?: boolean
  emissive?: string
}) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={rough}
      metalness={metal}
      flatShading={flat}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissive ? 1.4 : 0}
    />
  )
}
