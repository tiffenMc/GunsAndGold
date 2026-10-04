import { useMemo } from 'react'
import { CanvasTexture, LinearFilter, SRGBColorSpace, Vector2 } from 'three'

const CENTRO = new Vector2(0.5, 0)

/**
 * Sobre cada soldado, sus **escudos en circulitos** con el color de su bando (azul los tuyos, rojo
 * los del rival): uno por escudo, lleno o vacio. Es **una sola imagen** por soldado, y es lo unico
 * que flota encima: cuanto menos adorno, mas se ve el campo.
 */

const cache = new Map<string, CanvasTexture>()

/** Lo que mide cada circulito en el dibujo (px) y en el campo (unidades del mundo). */
const PIP = 64
const PIP_MUNDO = 0.55

function textura(escudos: number, maximo: number, color: string): CanvasTexture {
  const llave = `${escudos}|${maximo}|${color}`
  const hecha = cache.get(llave)
  if (hecha) return hecha
  const n = Math.max(1, maximo)
  const lienzo = document.createElement('canvas')
  lienzo.width = PIP * n
  lienzo.height = PIP
  const ctx = lienzo.getContext('2d')!
  const r = PIP * 0.4
  for (let i = 0; i < n; i++) {
    const cx = PIP * (i + 0.5)
    const cy = PIP / 2
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

/** La barra de escudos del soldado. `y` es la altura a la que flota. */
export function UnitBadge({ escudos, maximo, color, y }: { escudos: number; maximo: number; color: string; y: number }) {
  const total = Math.min(10, Math.max(1, Math.max(maximo, escudos)))
  const llenos = Math.min(total, Math.max(0, Math.ceil(escudos)))
  const tex = useMemo(() => textura(llenos, total, color), [llenos, total, color])
  // Un circulito por escudo; con muchos, se encogen un poco para no hacer una fila enorme.
  const pip = total > 6 ? PIP_MUNDO * (6 / total) ** 0.5 : PIP_MUNDO
  return (
    <sprite position={[0, y, 0]} center={CENTRO} scale={[pip * total, pip, 1]} renderOrder={20}>
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
