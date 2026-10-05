import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'
import type { CardDef, Rarity } from '../cards/model'
import { LEVEL_LABEL, SHOT_MODES, cardPower, patternLevelFor, rarityInfo, rarityOf, specialOf } from '../cards/model'
import { patternById } from '../cards/patterns'
import { infoDeSello } from '../battle/sellos'
import type { Pt } from '../cards/patterns'

/**
 * Medidas de la carta-vitrina (en metros de la escena). La ventana es el hueco por el que se ve
 * al muñeco atrapado dentro.
 */
export const CARD_W = 0.8
export const CARD_H = 1.12
export const CARD_DEPTH = 0.26
export const WINDOW = { x0: -0.335, x1: 0.335, y0: -0.335, y1: 0.4 }

const TEX_W = 512
const TEX_H = 717

function toPx(x: number, y: number): [number, number] {
  return [((x + CARD_W / 2) / CARD_W) * TEX_W, ((CARD_H / 2 - y) / CARD_H) * TEX_H]
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/** Dibuja un patron (coordenadas 0-1) dentro de un cuadro, con el punto de salida marcado. */
export function drawPatternGlyph(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  x: number,
  y: number,
  size: number,
  color: string,
  width = Math.max(2, size * 0.07),
) {
  if (points.length < 2) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  points.forEach((p, i) => {
    const px = x + p.x * size
    const py = y + p.y * size
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  })
  ctx.stroke()
  const start = points[0]!
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x + start.x * size, y + start.y * size, width * 0.95, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, maxWidth: number): number {
  let size = max
  while (size > 18) {
    ctx.font = `${size}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) break
    size -= 2
  }
  return size
}

const TITLE_FONT = '"Rye", "Cinzel", Georgia, serif'

/** Icono de las chapas de arriba: golpe (daño), escudo (vida) o reloj (duracion). */
type BadgeIcon = 'escudo' | 'golpe' | 'reloj'

/** Un dato de la carta: su nombre escrito arriba ("DAÑO", "ESCUDOS"…) y el número bien grande. */
function datoGrande(ctx: CanvasRenderingContext2D, x: number, y: number, dato: FrameInfo['left'], alignRight: boolean) {
  ctx.font = `bold 66px Georgia, serif`
  const numW = ctx.measureText(dato.text).width
  ctx.font = `900 25px system-ui, sans-serif`
  const labW = ctx.measureText(dato.label.toUpperCase()).width
  const w = Math.max(numW + 30, labW + 24, 112)
  const h = 108
  const bx = alignRight ? x - w : x
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'
  ctx.shadowBlur = 12
  ctx.fillStyle = 'rgba(12,7,3,0.95)'
  roundRect(ctx, bx, y, w, h, 18)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = dato.color
  ctx.lineWidth = 6
  roundRect(ctx, bx, y, w, h, 18)
  ctx.stroke()
  // El nombre del dato, en una cinta de su color.
  ctx.fillStyle = dato.color
  roundRect(ctx, bx + 7, y + 7, w - 14, 32, 9)
  ctx.fill()
  ctx.fillStyle = '#140a04'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `900 25px system-ui, sans-serif`
  ctx.fillText(dato.label.toUpperCase(), bx + w / 2, y + 24)
  // El número, bien grande.
  ctx.font = `bold 66px Georgia, serif`
  ctx.lineWidth = 8
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1a0d04'
  ctx.strokeText(dato.text, bx + w / 2, y + 74)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(dato.text, bx + w / 2, y + 74)
}

export interface FrameInfo {
  name: string
  sub: string
  accent: string
  /** La rareza manda en el marco: color, remaches y galones. */
  rarity: Rarity
  rarityColor: string
  /** Los dos datos de la carta, con su nombre escrito (para que se sepa qué es cada número). */
  left: { icon: BadgeIcon; text: string; color: string; label: string }
  right: { icon: BadgeIcon; text: string; color: string; label: string }
  pattern?: Pt[]
  /** La franja de arriba del marco: el sello escrito en grande (o "ARMA", "ESPECIAL"), de su color. */
  banda: { texto: string; color: string }
}

export function frameInfo(card: CardDef): FrameInfo {
  const rarity = rarityOf(card)
  const rareza = { rarity, rarityColor: rarityInfo(rarity).color }
  if (card.kind === 'batalla') {
    const level = patternLevelFor(cardPower(card))
    const sello = infoDeSello(card)
    return {
      ...rareza,
      name: card.name,
      sub: `Trazo ${LEVEL_LABEL[level].toLowerCase()}`,
      accent: card.accent,
      banda: { texto: sello.label, color: sello.color },
      // (Los números de verdad en la partida: con lo que les cambia su sello.)
      left: { icon: 'golpe', text: String(Math.round(card.damage * sello.mods.soldado.fuerte)), color: '#f87171', label: 'Daño' },
      right: { icon: 'escudo', text: String(Math.max(1, Math.round(card.shields * sello.mods.soldado.escudos))), color: '#60a5fa', label: 'Escudos' },
      pattern: patternById(card.pattern).points,
    }
  }
  const special = specialOf(card)
  if (special) {
    // Las especiales no pegan ni tienen alcance: lo suyo es que duran y que se gastan de una vez.
    return {
      ...rareza,
      name: card.name,
      sub: '1 uso',
      accent: card.accent,
      banda: { texto: 'Especial', color: '#e879f9' },
      left: { icon: 'golpe', text: '0', color: '#94a3b8', label: 'Daño' },
      right: { icon: 'reloj', text: `${special.seconds}s`, color: '#fcd34d', label: 'Dura' },
    }
  }
  const mode = SHOT_MODES.find((item) => item.id === card.shot.mode)
  return {
    ...rareza,
    name: card.name,
    sub: mode?.label ?? '',
    accent: card.accent,
    banda: { texto: 'Arma', color: '#d6a36a' },
    left: { icon: 'escudo', text: `-${card.shot.shieldsPerHit}`, color: '#60a5fa', label: 'Quita' },
    right: { icon: 'golpe', text: `${Math.round(card.shot.range)}m`, color: '#fcd34d', label: 'Alcance' },
  }
}

function hexRgb(color: string): [number, number, number] {
  const raw = color.replace('#', '')
  const largo = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return [parseInt(largo.slice(0, 2), 16), parseInt(largo.slice(2, 4), 16), parseInt(largo.slice(4, 6), 16)]
}

/** Aclara (t > 0, hacia el blanco) u oscurece (t < 0, hacia el negro) un color. */
export function tono(color: string, t: number): string {
  const [r, g, b] = hexRgb(color)
  const mezcla = (v: number) => Math.max(0, Math.min(255, Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t))))
  return `rgb(${mezcla(r)}, ${mezcla(g)}, ${mezcla(b)})`
}

/** Remache de la esquina: bola (normales y especiales), rombo (epicas) o estrella (divinas). */
function remache(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, kind: 'bola' | 'rombo' | 'estrella') {
  ctx.beginPath()
  if (kind === 'bola') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
  } else if (kind === 'rombo') {
    ctx.moveTo(cx, cy - r * 1.4)
    ctx.lineTo(cx + r * 1.4, cy)
    ctx.lineTo(cx, cy + r * 1.4)
    ctx.lineTo(cx - r * 1.4, cy)
    ctx.closePath()
  } else {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r * 1.6 : r * 0.66
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const px = cx + Math.cos(a) * rad
      const py = cy + Math.sin(a) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
  }
  ctx.fill()
}

function paintFrame(ctx: CanvasRenderingContext2D, info: FrameInfo) {
  const w = TEX_W
  const h = TEX_H
  const normal = info.rarity === 'normal'
  const divina = info.rarity === 'divina'
  ctx.clearRect(0, 0, w, h)

  const leather = ctx.createLinearGradient(0, 0, w, h)
  leather.addColorStop(0, '#80502a')
  leather.addColorStop(0.45, '#4f2e15')
  leather.addColorStop(1, '#2a1707')
  ctx.fillStyle = leather
  roundRect(ctx, 0, 0, w, h, 34)
  ctx.fill()

  // El tinte de la rareza sobre el cuero: azul las especiales, morado las epicas y oro las divinas.
  if (!normal) {
    ctx.save()
    ctx.globalAlpha = divina ? 0.4 : 0.28
    ctx.fillStyle = info.rarityColor
    roundRect(ctx, 0, 0, w, h, 34)
    ctx.fill()
    ctx.restore()
  }

  // Vetas de la madera.
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.strokeStyle = '#1a0d04'
  ctx.lineWidth = 2
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * h + Math.sin(i * 7.3) * 6
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(w * 0.3, y + 8, w * 0.7, y - 8, w, y + 3)
    ctx.stroke()
  }
  ctx.restore()

  // Galon de fuera: gordo y con brillo, para que la rareza se vea hasta en la mano de la partida.
  const banda = divina ? 30 : 26
  const laton = normal ? '#e0b463' : info.rarityColor
  const brillo = ctx.createLinearGradient(0, 0, w, h)
  brillo.addColorStop(0, tono(laton, 0.6))
  brillo.addColorStop(0.38, laton)
  brillo.addColorStop(0.72, tono(laton, -0.45))
  brillo.addColorStop(1, tono(laton, 0.35))
  ctx.strokeStyle = brillo
  ctx.lineWidth = banda
  roundRect(ctx, banda / 2 + 1, banda / 2 + 1, w - banda - 2, h - banda - 2, 32)
  ctx.stroke()
  // El canto de dentro, claro: le da volumen al galon.
  ctx.strokeStyle = tono(laton, 0.7)
  ctx.lineWidth = 3
  roundRect(ctx, banda + 4, banda + 4, w - banda * 2 - 8, h - banda * 2 - 8, 26)
  ctx.stroke()

  // Remaches de las esquinas, mas gordos cuanto mas rara es la carta.
  const forma = divina ? 'estrella' : info.rarity === 'epica' ? 'rombo' : 'bola'
  const tamano = divina ? 13 : info.rarity === 'epica' ? 10 : 8
  for (const [cx, cy] of [
    [banda / 2 + 2, banda / 2 + 2],
    [w - banda / 2 - 2, banda / 2 + 2],
    [banda / 2 + 2, h - banda / 2 - 2],
    [w - banda / 2 - 2, h - banda / 2 - 2],
  ] as const) {
    ctx.fillStyle = normal ? '#f5d69a' : tono(info.rarityColor, 0.35)
    remache(ctx, cx, cy, tamano, forma)
  }

  // Ventana: se recorta para que se vea el interior de la vitrina.
  const [wx0, wy0] = toPx(WINDOW.x0, WINDOW.y1)
  const [wx1, wy1] = toPx(WINDOW.x1, WINDOW.y0)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  roundRect(ctx, wx0, wy0, wx1 - wx0, wy1 - wy0, 18)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = info.accent
  ctx.lineWidth = 5
  roundRect(ctx, wx0 - 2, wy0 - 2, wx1 - wx0 + 4, wy1 - wy0 + 4, 20)
  ctx.stroke()
  ctx.strokeStyle = normal ? '#e0b463' : info.rarityColor
  ctx.lineWidth = 3
  roundRect(ctx, wx0 - 8, wy0 - 8, wx1 - wx0 + 16, wy1 - wy0 + 16, 24)
  ctx.stroke()

  // Arriba, como parte del marco: la franja del sello escrita en grande y de su color (siempre el
  // mismo: el apoyo rosa, el tanque gris, el asesino rojo…). A la derecha, el trazo que hay que dibujar.
  {
    const by = 16
    const bh = 76
    const bx = 26
    const bw = w - 52
    const franja = ctx.createLinearGradient(0, by, 0, by + bh)
    franja.addColorStop(0, tono(info.banda.color, 0.25))
    franja.addColorStop(0.5, info.banda.color)
    franja.addColorStop(1, tono(info.banda.color, -0.35))
    ctx.fillStyle = franja
    roundRect(ctx, bx, by, bw, bh, 18)
    ctx.fill()
    ctx.strokeStyle = '#1a0d04'
    ctx.lineWidth = 5
    roundRect(ctx, bx, by, bw, bh, 18)
    ctx.stroke()
    const glifo = info.pattern ? 60 : 0
    const texto = info.banda.texto.toUpperCase()
    const ancho = bw - (glifo ? glifo + 34 : 24)
    const tam = fitFont(ctx, texto, TITLE_FONT, 58, ancho)
    ctx.font = `${tam}px ${TITLE_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tx = bx + 12 + ancho / 2
    ctx.lineJoin = 'round'
    ctx.lineWidth = 9
    ctx.strokeStyle = '#1a0d04'
    ctx.strokeText(texto, tx, by + bh / 2 + 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(texto, tx, by + bh / 2 + 3)
    if (info.pattern) {
      const gx = bx + bw - glifo - 10
      const gy = by + (bh - glifo) / 2
      ctx.fillStyle = 'rgba(12,7,3,0.9)'
      roundRect(ctx, gx, gy, glifo, glifo, 12)
      ctx.fill()
      drawPatternGlyph(ctx, info.pattern, gx + 8, gy + 8, glifo - 16, '#f5d69a', 5)
    }
  }

  // Los dos datos, grandes y con su nombre: abajo del retrato, uno a cada lado.
  datoGrande(ctx, wx0 - 6, wy1 - 96, info.left, false)
  datoGrande(ctx, wx1 + 6, wy1 - 96, info.right, true)

  // Abajo: la chapa con el nombre bien grande.
  const plateY = wy1 + 14
  const plateH = h - plateY - 26
  const plate = ctx.createLinearGradient(0, plateY, 0, plateY + plateH)
  plate.addColorStop(0, 'rgba(0,0,0,0.9)')
  plate.addColorStop(1, 'rgba(26,13,4,0.96)')
  ctx.fillStyle = plate
  roundRect(ctx, 30, plateY, w - 60, plateH, 16)
  ctx.fill()
  ctx.strokeStyle = normal ? '#e0b463' : info.rarityColor
  ctx.lineWidth = 4
  roundRect(ctx, 30, plateY, w - 60, plateH, 16)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const title = info.name.toUpperCase()
  const size = fitFont(ctx, title, TITLE_FONT, 60, w - 100)
  ctx.font = `${size}px ${TITLE_FONT}`
  ctx.lineWidth = 8
  ctx.strokeStyle = '#1a0d04'
  ctx.strokeText(title, w / 2, plateY + plateH * 0.42)
  ctx.fillStyle = '#fff3d6'
  ctx.fillText(title, w / 2, plateY + plateH * 0.42)
  ctx.font = `600 22px "Cinzel", Georgia, serif`
  ctx.fillStyle = info.accent
  ctx.fillText(info.sub.toUpperCase(), w / 2, plateY + plateH * 0.8)

}

function makeTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const tex = new CanvasTexture(canvas)
  tex.minFilter = LinearFilter
  tex.magFilter = LinearFilter
  tex.anisotropy = 4
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Repinta cuando llega la fuente del Oeste (si no, el nombre sale con la de reserva). */
function whenFonts(redraw: () => void) {
  if (typeof document === 'undefined' || !document.fonts) return
  document.fonts.load(`40px "Rye"`).then(redraw, () => undefined)
}

export function makeFrameTexture(info: FrameInfo): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')!
  paintFrame(ctx, info)
  const tex = makeTexture(canvas)
  whenFonts(() => {
    paintFrame(ctx, info)
    tex.needsUpdate = true
  })
  return tex
}

/** El fondo de dentro de la vitrina: atardecer del desierto tenido del color de la carta. */
export function makeBackdropTexture(accent: string): CanvasTexture {
  const w = 256
  const h = 300
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#1d1030')
  sky.addColorStop(0.45, '#7a3522')
  sky.addColorStop(0.72, '#e39a4f')
  sky.addColorStop(1, '#f3c77a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(w * 0.5, h * 0.62, 4, w * 0.5, h * 0.62, w * 0.7)
  glow.addColorStop(0, `${accent}aa`)
  glow.addColorStop(1, `${accent}00`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  // Sol.
  ctx.fillStyle = '#ffe7a8'
  ctx.beginPath()
  ctx.arc(w * 0.68, h * 0.6, 26, 0, Math.PI * 2)
  ctx.fill()
  // Mesas del desierto.
  ctx.fillStyle = '#3b1d14'
  ctx.beginPath()
  ctx.moveTo(0, h * 0.72)
  ctx.lineTo(w * 0.08, h * 0.72)
  ctx.lineTo(w * 0.12, h * 0.58)
  ctx.lineTo(w * 0.3, h * 0.58)
  ctx.lineTo(w * 0.34, h * 0.7)
  ctx.lineTo(w * 0.55, h * 0.7)
  ctx.lineTo(w * 0.6, h * 0.64)
  ctx.lineTo(w * 0.72, h * 0.64)
  ctx.lineTo(w * 0.76, h * 0.72)
  ctx.lineTo(w, h * 0.72)
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()
  // Cactus.
  ctx.fillStyle = '#26361c'
  ctx.fillRect(w * 0.14, h * 0.66, 8, 30)
  ctx.fillRect(w * 0.14 - 9, h * 0.7, 9, 5)
  ctx.fillRect(w * 0.14 - 9, h * 0.66, 5, 9)
  ctx.fillRect(w * 0.84, h * 0.68, 7, 24)
  // Suelo.
  const ground = ctx.createLinearGradient(0, h * 0.78, 0, h)
  ground.addColorStop(0, '#7a4d26')
  ground.addColorStop(1, '#4a2c14')
  ctx.fillStyle = ground
  ctx.fillRect(0, h * 0.8, w, h * 0.2)
  return makeTexture(canvas)
}

let chispa: CanvasTexture | null = null

/** La bolita de luz de las chispas de las cartas especiales. */
export function sparkTexture(): CanvasTexture {
  if (chispa) return chispa
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const luz = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  luz.addColorStop(0, 'rgba(255,255,255,1)')
  luz.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  luz.addColorStop(0.55, 'rgba(255,255,255,0.25)')
  luz.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = luz
  ctx.fillRect(0, 0, 64, 64)
  chispa = makeTexture(canvas)
  return chispa
}

let franja: CanvasTexture | null = null

/** La franja de luz que recorre la carta: el brillo que barre a las especiales y a las divinas. */
export function sweepTexture(): CanvasTexture {
  if (franja) return franja
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const banda = ctx.createLinearGradient(0, 0, 0, 128)
  banda.addColorStop(0, 'rgba(255,255,255,0)')
  banda.addColorStop(0.4, 'rgba(255,255,255,0.06)')
  banda.addColorStop(0.5, 'rgba(255,255,255,0.95)')
  banda.addColorStop(0.6, 'rgba(255,255,255,0.06)')
  banda.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = banda
  ctx.fillRect(0, 0, 128, 128)
  // Se difuminan las puntas para que la franja no corte a canto.
  const puntas = ctx.createLinearGradient(0, 0, 128, 0)
  puntas.addColorStop(0, 'rgba(255,255,255,0)')
  puntas.addColorStop(0.3, 'rgba(255,255,255,1)')
  puntas.addColorStop(0.7, 'rgba(255,255,255,1)')
  puntas.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = puntas
  ctx.fillRect(0, 0, 128, 128)
  franja = makeTexture(canvas)
  return franja
}

let rayos: CanvasTexture | null = null

/** Rayos girando alrededor, como un sol: el resplandor de detras de las divinas. */
export function sunburstTexture(): CanvasTexture {
  if (rayos) return rayos
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.translate(128, 128)
  for (let i = 0; i < 14; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI * 2) / 14)
    const rayo = ctx.createLinearGradient(0, 0, 0, -127)
    rayo.addColorStop(0, 'rgba(255,255,255,0.9)')
    rayo.addColorStop(0.45, 'rgba(255,255,255,0.22)')
    rayo.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = rayo
    ctx.beginPath()
    ctx.moveTo(-5, 0)
    ctx.lineTo(0, -127)
    ctx.lineTo(5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  const nucleo = ctx.createRadialGradient(0, 0, 0, 0, 0, 70)
  nucleo.addColorStop(0, 'rgba(255,255,255,0.95)')
  nucleo.addColorStop(0.5, 'rgba(255,255,255,0.25)')
  nucleo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = nucleo
  ctx.beginPath()
  ctx.arc(0, 0, 70, 0, Math.PI * 2)
  ctx.fill()
  rayos = makeTexture(canvas)
  return rayos
}

let estrellaTxt: CanvasTexture | null = null

/** Destello de cuatro puntas: las estrellitas que parpadean en las cartas divinas. */
export function twinkleTexture(): CanvasTexture {
  if (estrellaTxt) return estrellaTxt
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const nucleo = ctx.createRadialGradient(64, 64, 0, 64, 64, 34)
  nucleo.addColorStop(0, 'rgba(255,255,255,1)')
  nucleo.addColorStop(0.35, 'rgba(255,255,255,0.5)')
  nucleo.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = nucleo
  ctx.fillRect(0, 0, 128, 128)
  const puntas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const
  for (const [dx, dy] of puntas) {
    const punta = ctx.createLinearGradient(64, 64, 64 + dx * 58, 64 + dy * 58)
    punta.addColorStop(0, 'rgba(255,255,255,0.95)')
    punta.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = punta
    ctx.beginPath()
    ctx.moveTo(64 - dy * 5, 64 - dx * 5)
    ctx.lineTo(64 + dx * 58, 64 + dy * 58)
    ctx.lineTo(64 + dy * 5, 64 + dx * 5)
    ctx.closePath()
    ctx.fill()
  }
  estrellaTxt = makeTexture(canvas)
  return estrellaTxt
}

let glare: CanvasTexture | null = null

/** Reflejo del cristal: una franja de luz que se mueve al inclinar la carta. */
export function glareTexture(): CanvasTexture {
  if (glare) return glare
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 128, 128)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.42, 'rgba(255,255,255,0)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.56, 'rgba(255,255,255,0.08)')
  grad.addColorStop(0.62, 'rgba(255,255,255,0.3)')
  grad.addColorStop(0.68, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  glare = makeTexture(canvas)
  return glare
}
