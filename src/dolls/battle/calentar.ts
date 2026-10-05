import { useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
} from 'three'
import type { Object3D, Scene } from 'three'
import { outlineMaterial } from '../dollParts'
import SEMILLA from './materialesDeSerie.json'

/**
 * **Precalentar los materiales de la batalla**, para que no se pare a media partida.
 *
 * La tarjeta gráfica necesita "compilar" un programa la primera vez que pinta cada tipo de material
 * (con niebla o sin ella, con textura o sin ella…). En el móvil eso tarda: si pasa a media partida
 * (la primera explosión, el primer humo…), la partida se congela un momento. Además cada partida
 * monta su lienzo de nuevo, así que empieza otra vez de cero.
 *
 * Así que: mientras sale el cartel de "VS" y la ruleta del clima (aún no se juega), se compila de
 * golpe todo lo que la partida va a usar. Lo que se usa se va apuntando (en este móvil, y una lista
 * de serie para la primera vez), así que cada vez se calienta mejor. Y lo calentado se queda
 * guardado hasta el final: si no, al irse la última chispa la tarjeta tira su programa y la
 * siguiente lo vuelve a compilar.
 *
 * Hay dos escenas: el campo (con niebla y sus luces) y la mano de cartas (otras luces). Cada una
 * compila sus propios programas, así que cada una lleva su lista.
 */

/** Dónde se pinta: en el campo o en la mano de cartas. */
export type Escena = 'campo' | 'mano'

type Clase = 'mesh' | 'instanced' | 'points' | 'line' | 'segments' | 'sprite'

/** Lo que define el programa de un material (lo justo para volver a crear uno igual). */
export interface Firma {
  clase: Clase
  tipo: string
  map?: boolean
  gradientMap?: boolean
  alphaMap?: boolean
  emissiveMap?: boolean
  vertexColors?: boolean
  transparent?: boolean
  side?: number
  fog?: boolean
  flatShading?: boolean
  toneMapped?: boolean
  alphaTest?: boolean
  sizeAttenuation?: boolean
  premultipliedAlpha?: boolean
  dithering?: boolean
}

const clave = (donde: Escena) => `oeste-materiales-${donde}-v1`
const TIPOS: Record<string, new () => Material> = {
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  PointsMaterial,
  LineBasicMaterial,
  SpriteMaterial,
}

function claseDe(obj: Object3D): Clase | null {
  const o = obj as Object3D & Record<string, boolean>
  if (o.isInstancedMesh) return 'instanced'
  if (o.isMesh) return 'mesh'
  if (o.isPoints) return 'points'
  if (o.isLineSegments) return 'segments'
  if (o.isLine) return 'line'
  if (o.isSprite) return 'sprite'
  return null
}

/** La firma de un material en un objeto (null si es de los que no se saben rehacer). */
export function firmaDe(obj: Object3D, mat: Material): Firma | null {
  const clase = claseDe(obj)
  if (!clase || !TIPOS[mat.type]) return null
  // Los que retocan su programa (el contorno, la nieve) no se saben rehacer por la firma.
  if (mat.onBeforeCompile !== Material.prototype.onBeforeCompile) return null
  const m = mat as Material & Record<string, unknown>
  const f: Firma = { clase, tipo: mat.type }
  if (m.map) f.map = true
  if (m.gradientMap) f.gradientMap = true
  if (m.alphaMap) f.alphaMap = true
  if (m.emissiveMap) f.emissiveMap = true
  if (mat.vertexColors) f.vertexColors = true
  if (mat.transparent) f.transparent = true
  if (mat.side !== 0) f.side = mat.side
  if (m.fog === false) f.fog = false
  if (m.flatShading) f.flatShading = true
  if (mat.toneMapped === false) f.toneMapped = false
  if (mat.alphaTest > 0) f.alphaTest = true
  if (m.sizeAttenuation === false) f.sizeAttenuation = false
  if (mat.premultipliedAlpha) f.premultipliedAlpha = true
  if (mat.dithering) f.dithering = true
  return f
}

const claveDe = (f: Firma) => JSON.stringify(f)

function leer(donde: Escena): Firma[] {
  try {
    const raw = localStorage.getItem(clave(donde))
    const lista = raw ? (JSON.parse(raw) as Firma[]) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

const listas = new Map<Escena, Map<string, Firma>>()
/** Las firmas conocidas de una escena: las de serie y las que ha ido viendo este móvil. */
function conocidas(donde: Escena): Map<string, Firma> {
  let lista = listas.get(donde)
  if (!lista) {
    const deSerie = (SEMILLA as Partial<Record<Escena, Firma[]>>)[donde] ?? []
    lista = new Map([...deSerie, ...leer(donde)].filter((f) => f && TIPOS[f.tipo]).map((f) => [claveDe(f), f]))
    listas.set(donde, lista)
  }
  return lista
}

/** Apunta los materiales que hay ahora en la escena (los nuevos se recuerdan para la próxima). */
export function aprender(scene: Scene, donde: Escena): void {
  const lista = conocidas(donde)
  let nuevas = false
  scene.traverse((obj) => {
    const mats = (obj as Object3D & { material?: Material | Material[] }).material
    if (!mats) return
    for (const mat of Array.isArray(mats) ? mats : [mats]) {
      const f = firmaDe(obj, mat)
      if (!f) continue
      const k = claveDe(f)
      if (!lista.has(k)) {
        lista.set(k, f)
        nuevas = true
      }
    }
  })
  if (!nuevas) return
  try {
    localStorage.setItem(clave(donde), JSON.stringify([...lista.values()]))
  } catch {
    // Sin sitio: se recuerdan solo mientras dure la página.
  }
}

/** Todas las firmas que se conocen de una escena (para sacar la lista de serie). */
export function firmasConocidas(donde: Escena): Firma[] {
  return [...conocidas(donde).values()]
}

const TEXTURA = (() => {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()

function material(f: Firma): Material {
  const m = new TIPOS[f.tipo]!() as Material & Record<string, unknown>
  if (f.map) m.map = TEXTURA
  if (f.gradientMap) m.gradientMap = TEXTURA
  if (f.alphaMap) m.alphaMap = TEXTURA
  if (f.emissiveMap) m.emissiveMap = TEXTURA
  if (f.vertexColors) m.vertexColors = true
  // (Siempre: los sprites vienen transparentes de fábrica.)
  m.transparent = Boolean(f.transparent)
  if (f.side !== undefined) m.side = f.side as Material['side']
  if (f.fog === false) m.fog = false
  if (f.flatShading) m.flatShading = true
  if (f.toneMapped === false) m.toneMapped = false
  if (f.alphaTest) m.alphaTest = 0.5
  if (f.sizeAttenuation === false) m.sizeAttenuation = false
  if (f.premultipliedAlpha) m.premultipliedAlpha = true
  if (f.dithering) m.dithering = true
  return m
}

function geometria(): BufferGeometry {
  const g = new BoxGeometry(0.01, 0.01, 0.01)
  // Por si el material quiere colores por vértice.
  g.setAttribute('color', new BufferAttribute(new Float32Array(g.attributes.position!.count * 3).fill(1), 3))
  return g
}

function objeto(f: Firma, g: BufferGeometry): Object3D {
  const m = material(f)
  switch (f.clase) {
    case 'instanced':
      return new InstancedMesh(g, m, 1)
    case 'points':
      return new Points(g, m)
    case 'line':
      return new Line(g, m)
    case 'segments':
      return new LineSegments(g, m)
    case 'sprite':
      return new Sprite(m as SpriteMaterial)
    default:
      return new Mesh(g, m)
  }
}

/** El contorno de equipo de los muñecos, opaco y a medias (cuando andan entre el humo). */
function contornos(g: BufferGeometry): { fijo: Mesh; fantasma: Mesh } {
  const material = outlineMaterial('#000000')
  const fantasma = material.clone()
  fantasma.onBeforeCompile = material.onBeforeCompile
  fantasma.transparent = true
  return { fijo: new Mesh(g, material), fantasma: new Mesh(g, fantasma) }
}

/**
 * Va dentro de cada escena de la batalla: al montarse compila (en segundo plano, si el móvil sabe)
 * todo lo conocido, y mientras se juega apunta lo nuevo que vea.
 */
export function CalentarMateriales({ donde }: { donde: Escena }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const get = useThree((s) => s.get)
  useLayoutEffect(() => {
    // Sin las comprobaciones de errores de los programas: obligan a esperar a cada uno (en el
    // juego publicado no hacen falta).
    if (import.meta.env.PROD) gl.debug.checkShaderErrors = false
    const g = geometria()
    // Los puntos sin coordenadas de textura (como los de verdad: si no, sería otro programa).
    const gPuntos = new BufferGeometry()
    gPuntos.setAttribute('position', g.attributes.position!.clone())
    gPuntos.setAttribute('color', g.attributes.color!.clone())
    const lista = [...conocidas(donde).values()]
    const objetos = lista.map((f) => objeto(f, f.clase === 'points' ? gPuntos : g))
    // El contorno es el mismo material para todos los muñecos: ese no se tira al acabar.
    const contorno = donde === 'campo' ? contornos(g) : null
    if (contorno) objetos.push(contorno.fantasma)
    const todos = contorno ? [...objetos, contorno.fijo] : objetos
    for (const o of todos) {
      o.position.set(0, -500, 0)
      o.frustumCulled = false
      scene.add(o)
    }
    try {
      void gl.compileAsync(scene, get().camera).catch(() => undefined)
    } catch {
      // Si no sabe compilar por adelantado, se compilan al pintarse (como siempre).
    }
    // Ya están pedidos: que no se pinten. Se quedan (escondidos) hasta que acabe la partida: si se
    // tiraran ya, la tarjeta olvidaría los programas y habría que volver a compilarlos al usarlos.
    for (const o of todos) o.visible = false
    return () => {
      for (const o of todos) scene.remove(o)
      for (const o of objetos) ((o as Mesh).material as Material).dispose()
      g.dispose()
      gPuntos.dispose()
    }
  }, [gl, scene, get, donde])
  // Cada vez que la tarjeta estrena un programa, se mira qué hay en la escena: así se apunta
  // justo lo que acaba de salir (aunque sea una chispa que dura un momento).
  const programas = useRef(-1)
  useFrame(() => {
    const n = gl.info.programs?.length ?? 0
    if (n === programas.current) return
    programas.current = n
    aprender(scene, donde)
  })
  return null
}
