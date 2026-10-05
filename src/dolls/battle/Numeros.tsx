import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import { CanvasTexture, DataTexture, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'
import type { Sprite, SpriteMaterial } from 'three'
import type { Side } from './engine'

/**
 * **Los números de daño**: cada golpe enseña lo que quita, del **color de quien pega** (azul los
 * tuyos, rojo los del rival) y **más grande cuanto más quita**. Así se ve qué carta pega fuerte y
 * qué carta pega flojo, y de quién es cada golpe.
 *
 * Los golpes seguidos al mismo muñeco se suman en un solo número (si no, una ráfaga llenaría el
 * campo de cifras). Se pintan con unas pocas imágenes que se reutilizan: nada de React por golpe.
 */

export interface Numero {
  x: number
  z: number
  /** Lo que quita: escudos a un soldado, o vida al fuerte. */
  cantidad: number
  /** Quién pega. */
  side: Side
  /** El que lo recibe: los golpes seguidos al mismo se suman. */
  clave?: string
  /** Al fuerte: el número va más alto y más grande. */
  fuerte?: boolean
}

const POOL = 22
/** Lo que dura un número (s) y lo que tarda en sumar los golpes seguidos. */
const VIDA = 1
const SUMA = 0.35
/** Lo mínimo que tiene que quitar un número para salir (los golpecitos se van juntando). */
const MINIMO = 0.5
const COLOR: Record<Side, string> = { 0: '#5ec8ff', 1: '#ff6b6b' }

/** Escudos con una coma como mucho ("-0,5", "-2"); la vida del fuerte, entera. */
export function textoDeDano(cantidad: number, fuerte = false): string {
  if (fuerte) return `-${Math.round(cantidad)}`
  const r = Math.round(cantidad * 10) / 10
  return `-${String(r).replace('.', ',')}`
}

const texturas = new Map<string, { tex: CanvasTexture; aspecto: number }>()
/** Para que el material nazca ya con imagen (si no, al ponérsela habría que compilar otro programa). */
const VACIA = (() => {
  const t = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  t.needsUpdate = true
  return t
})()

function textura(texto: string, color: string): { tex: CanvasTexture; aspecto: number } {
  const llave = `${texto}|${color}`
  const hecha = texturas.get(llave)
  if (hecha) {
    // La más usada se queda al final (las viejas se tiran primero).
    texturas.delete(llave)
    texturas.set(llave, hecha)
    return hecha
  }
  const alto = 128
  const lienzo = document.createElement('canvas')
  const ctx = lienzo.getContext('2d')!
  const fuente = `${alto * 0.78}px Rye, Georgia, serif`
  ctx.font = fuente
  const ancho = Math.ceil(ctx.measureText(texto).width + alto * 0.4)
  lienzo.width = ancho
  lienzo.height = alto
  ctx.font = fuente
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = alto * 0.2
  ctx.strokeStyle = '#140a03'
  ctx.strokeText(texto, ancho / 2, alto * 0.54)
  ctx.fillStyle = color
  ctx.fillText(texto, ancho / 2, alto * 0.54)
  // Un brillo blanco arriba, como el de las chapas.
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, 0, ancho, alto * 0.42)
  ctx.restore()
  const tex = new CanvasTexture(lienzo)
  tex.colorSpace = SRGBColorSpace
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  const hecho = { tex, aspecto: ancho / alto }
  texturas.set(llave, hecho)
  if (texturas.size > 120) {
    const [vieja, datos] = texturas.entries().next().value as [string, { tex: CanvasTexture }]
    texturas.delete(vieja)
    datos.tex.dispose()
  }
  return hecho
}

interface Hueco {
  activo: boolean
  edad: number
  cantidad: number
  side: Side
  clave?: string
  fuerte: boolean
  x: number
  z: number
  aspecto: number
}

/** Lo alto que sale el número: más cuanto más quita (y el del fuerte, más). */
function altoDe(h: Hueco): number {
  if (h.fuerte) return 1.9 + Math.min(1, h.cantidad / 400) * 1
  return 1.25 + Math.min(4, h.cantidad) * 0.55
}

export function NumerosDeDano({ cola }: { cola: MutableRefObject<Numero[]> }) {
  const sprites = useRef<(Sprite | null)[]>([])
  const huecos = useRef<Hueco[]>(
    Array.from({ length: POOL }, () => ({ activo: false, edad: 0, cantidad: 0, side: 0 as Side, fuerte: false, x: 0, z: 0, aspecto: 1 })),
  )
  const sueltos = useRef(new Map<string, { cantidad: number; t: number }>())
  const reloj = useRef(0)
  useFrame((_, dt) => {
    reloj.current += dt
    const lista = huecos.current
    const pintar = (i: number) => {
      const h = lista[i]!
      const s = sprites.current[i]
      if (!s) return
      const { tex, aspecto } = textura(textoDeDano(h.cantidad, h.fuerte), COLOR[h.side])
      const material = s.material as SpriteMaterial
      if (material.map !== tex) {
        material.map = tex
        material.needsUpdate = true
      }
      h.aspecto = aspecto
    }
    // Los nuevos: se suman al del mismo muñeco si es reciente; si no, cogen un hueco.
    for (const n of cola.current.splice(0)) {
      const igual = n.clave !== undefined ? lista.findIndex((h) => h.activo && h.clave === n.clave && h.side === n.side && h.edad < SUMA) : -1
      if (igual >= 0) {
        const h = lista[igual]!
        h.cantidad += n.cantidad
        h.edad = Math.min(h.edad, 0.12)
        pintar(igual)
        continue
      }
      // Los golpecitos (la minigun, el gas…) se juntan antes de salir: un número por cada medio
      // escudo, no una lluvia de cifras.
      if (!n.fuerte && n.clave !== undefined) {
        const antes = sueltos.current.get(n.clave)
        const suma = (antes && reloj.current - antes.t < 0.8 ? antes.cantidad : 0) + n.cantidad
        if (suma < MINIMO) {
          sueltos.current.set(n.clave, { cantidad: suma, t: antes && reloj.current - antes.t < 0.8 ? antes.t : reloj.current })
          continue
        }
        sueltos.current.delete(n.clave)
        n.cantidad = suma
      }
      let i = lista.findIndex((h) => !h.activo)
      if (i < 0) {
        // Todos ocupados: el más viejo deja su sitio.
        i = 0
        for (let j = 1; j < lista.length; j++) if (lista[j]!.edad > lista[i]!.edad) i = j
      }
      Object.assign(lista[i]!, { activo: true, edad: 0, cantidad: n.cantidad, side: n.side, clave: n.clave, fuerte: Boolean(n.fuerte), x: n.x, z: n.z })
      pintar(i)
    }
    for (let i = 0; i < lista.length; i++) {
      const h = lista[i]!
      const s = sprites.current[i]
      if (!s) continue
      if (!h.activo) {
        s.visible = false
        continue
      }
      h.edad += dt
      if (h.edad >= VIDA) {
        h.activo = false
        s.visible = false
        continue
      }
      s.visible = true
      // Salta (crece de golpe y se asienta), sube un poco y se funde al final.
      const salto = h.edad < 0.12 ? 0.6 + (h.edad / 0.12) * 0.65 : h.edad < 0.24 ? 1.25 - ((h.edad - 0.12) / 0.12) * 0.25 : 1
      const alto = altoDe(h) * salto
      s.scale.set(alto * h.aspecto, alto, 1)
      // Por encima de las cabezas (y de los escudos), para que no lo tape nadie.
      s.position.set(h.x, (h.fuerte ? 4.8 : 4.4) + h.edad * 1.2, h.z)
      ;(s.material as SpriteMaterial).opacity = h.edad > VIDA - 0.3 ? (VIDA - h.edad) / 0.3 : 1
    }
  })
  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <sprite
          key={i}
          ref={(el) => {
            sprites.current[i] = el
          }}
          visible={false}
          renderOrder={30}
        >
          <spriteMaterial map={VACIA} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
    </group>
  )
}
