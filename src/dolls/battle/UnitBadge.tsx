import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace, Vector2 } from 'three'
import type { Sprite, SpriteMaterial } from 'three'
import { pintarPapel } from './papeles'
import type { PapelInfo } from './papeles'

const CENTRO = new Vector2(0.5, 0)

/**
 * Sobre cada soldado, **el icono de su papel** (francotirador, área, tanque, cura…) y sus **escudos
 * en circulitos** con el color de su bando (azul los tuyos, rojo los del rival): uno por escudo,
 * lleno o vacio. Es **una sola imagen** por soldado, y es lo unico que flota encima: cuanto menos
 * adorno, mas se ve el campo. El icono es lo que dice de un vistazo qué es cada muñeco.
 */

const cache = new Map<string, CanvasTexture>()

/** Lo que mide cada circulito en el dibujo (px) y en el campo (unidades del mundo). */
const PIP = 64
const PIP_MUNDO = 0.55
/** El icono del papel mide esto (en circulitos) y deja este hueco hasta los escudos. */
const ICONO = 1.9
const HUECO = 0.12

function textura(escudos: number, maximo: number, color: string, papel: PapelInfo | null): CanvasTexture {
  const llave = `${escudos}|${maximo}|${color}|${papel?.id ?? ''}`
  const hecha = cache.get(llave)
  if (hecha) return hecha
  const n = Math.max(1, maximo)
  const lienzo = document.createElement('canvas')
  const delante = papel ? PIP * (ICONO + HUECO) : 0
  const alto = papel ? PIP * ICONO : PIP
  lienzo.width = delante + PIP * n
  lienzo.height = alto
  const ctx = lienzo.getContext('2d')!
  if (papel) pintarPapel(ctx, papel, alto / 2, alto / 2, alto / 2 - 1, color)
  const r = PIP * 0.4
  for (let i = 0; i < n; i++) {
    const cx = delante + PIP * (i + 0.5)
    const cy = alto / 2
    // Aro oscuro para que se lea sobre cualquier suelo.
    ctx.beginPath()
    ctx.arc(cx, cy, r + PIP * 0.07, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(6,10,16,0.85)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    if (i < escudos) {
      ctx.fillStyle = color
      ctx.fill()
      // Un brillo arriba, como una chapa.
      ctx.beginPath()
      ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.35, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fill()
    }
  }
  const tex = new CanvasTexture(lienzo)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  cache.set(llave, tex)
  return tex
}

/** El papel y la barra de escudos del soldado. `y` es la altura a la que flota. */
export function UnitBadge({
  escudos,
  maximo,
  color,
  y,
  papel = null,
}: {
  escudos: number
  maximo: number
  color: string
  y: number
  papel?: PapelInfo | null
}) {
  const total = Math.min(10, Math.max(1, Math.max(maximo, escudos)))
  const llenos = Math.min(total, Math.max(0, Math.ceil(escudos)))
  const tex = useMemo(() => textura(llenos, total, color, papel), [llenos, total, color, papel])
  // Un circulito por escudo; con muchos, se encogen un poco para no hacer una fila enorme.
  const pip = total > 6 ? PIP_MUNDO * (6 / total) ** 0.5 : PIP_MUNDO
  const ancho = pip * (total + (papel ? ICONO + HUECO : 0))
  return (
    <sprite position={[0, y, 0]} center={CENTRO} scale={[ancho, papel ? pip * ICONO : pip, 1]} renderOrder={20}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

const bases = new Map<string, CanvasTexture>()

/** La peana del bando (sombra, disco y aro grueso) como una sola imagen: un dibujo en vez de tres mallas. */
function texturaBase(color: string): CanvasTexture {
  const hecha = bases.get(color)
  if (hecha) return hecha
  const n = 128
  const lienzo = document.createElement('canvas')
  lienzo.width = n
  lienzo.height = n
  const ctx = lienzo.getContext('2d')!
  const c = n / 2
  ctx.beginPath()
  ctx.arc(c, c, c * 0.96, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(5,7,10,0.55)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(c, c, c * 0.88, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.88
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.arc(c, c, c * 0.78, 0, Math.PI * 2)
  ctx.lineWidth = c * 0.27
  ctx.strokeStyle = color
  ctx.stroke()
  const tex = new CanvasTexture(lienzo)
  tex.colorSpace = SRGBColorSpace
  bases.set(color, tex)
  return tex
}

/** La peana en el suelo, con el color del bando. */
export function UnitBase({ color }: { color: string }) {
  const tex = useMemo(() => texturaBase(color), [color])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.034, 0]}>
      <planeGeometry args={[2.15, 2.15]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

const etiquetas = new Map<string, CanvasTexture>()
const ETIQUETA_W = 512
const ETIQUETA_H = 150

/** El cartel del nombre: la carta en grande y debajo su papel, con el borde del color del bando. */
function texturaEtiqueta(nombre: string, papel: PapelInfo, color: string): CanvasTexture {
  const llave = `${nombre}|${papel.id}|${color}`
  const hecha = etiquetas.get(llave)
  if (hecha) return hecha
  const lienzo = document.createElement('canvas')
  lienzo.width = ETIQUETA_W
  lienzo.height = ETIQUETA_H
  const ctx = lienzo.getContext('2d')!
  const w = ETIQUETA_W
  const h = ETIQUETA_H
  ctx.beginPath()
  ctx.roundRect(6, 6, w - 12, h - 12, 26)
  ctx.fillStyle = 'rgba(12,7,3,0.86)'
  ctx.fill()
  ctx.lineWidth = 9
  ctx.strokeStyle = color
  ctx.stroke()
  pintarPapel(ctx, papel, 72, h / 2, 50, color)
  const texto = nombre.toUpperCase()
  let tam = 50
  ctx.font = `${tam}px Rye, Georgia, serif`
  while (tam > 24 && ctx.measureText(texto).width > w - 160) {
    tam -= 2
    ctx.font = `${tam}px Rye, Georgia, serif`
  }
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 7
  ctx.strokeStyle = '#1a0d04'
  ctx.strokeText(texto, 138, h * 0.38)
  ctx.fillStyle = '#fff7e6'
  ctx.fillText(texto, 138, h * 0.38)
  ctx.font = 'bold 30px system-ui, sans-serif'
  ctx.fillStyle = papel.color
  ctx.fillText(papel.label.toUpperCase(), 140, h * 0.74)
  const tex = new CanvasTexture(lienzo)
  tex.colorSpace = SRGBColorSpace
  // Se ve mucho más pequeño que el dibujo: con mipmaps las letras no se rompen.
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  etiquetas.set(llave, tex)
  return tex
}

/** Lo que dura el cartel del nombre al entrar al campo (s) y lo que tarda en irse. */
const ETIQUETA_S = 2.4
/** Lo ancho que sale en el campo. */
const ETIQUETA_MUNDO = 4.4
const ETIQUETA_FUNDIDO = 0.5

/**
 * Al salir al campo, cada muñeco enseña unos segundos **quién es**: su nombre y su papel. Así se
 * sabe qué carta acaba de sacar el rival (y la tuya se reconoce al momento).
 */
export function EtiquetaNombre({ nombre, papel, color, y }: { nombre: string; papel: PapelInfo; color: string; y: number }) {
  const tex = useMemo(() => texturaEtiqueta(nombre, papel, color), [nombre, papel, color])
  const sprite = useRef<Sprite>(null)
  const nacio = useRef(-1)
  useFrame(({ clock }) => {
    const s = sprite.current
    if (!s || !s.visible) return
    if (nacio.current < 0) nacio.current = clock.elapsedTime
    const edad = clock.elapsedTime - nacio.current
    const material = s.material as SpriteMaterial
    // Entra con un saltito y se va fundiendo.
    const entra = Math.min(1, edad / 0.18)
    const k = ETIQUETA_MUNDO * (0.7 + 0.3 * entra)
    s.scale.set(k, k * (ETIQUETA_H / ETIQUETA_W), 1)
    material.opacity = edad < ETIQUETA_S ? 1 : Math.max(0, 1 - (edad - ETIQUETA_S) / ETIQUETA_FUNDIDO)
    if (edad > ETIQUETA_S + ETIQUETA_FUNDIDO) s.visible = false
  })
  return (
    <sprite ref={sprite} position={[0, y, 0]} center={CENTRO} scale={[0.01, 0.01, 1]} renderOrder={21}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}
