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

function shieldPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - s)
  ctx.quadraticCurveTo(cx + s * 0.55, cy - s * 0.72, cx + s * 0.9, cy - s * 0.78)
  ctx.quadraticCurveTo(cx + s * 0.95, cy + s * 0.3, cx, cy + s)
  ctx.quadraticCurveTo(cx - s * 0.95, cy + s * 0.3, cx - s * 0.9, cy - s * 0.78)
  ctx.quadraticCurveTo(cx - s * 0.55, cy - s * 0.72, cx, cy - s)
  ctx.closePath()
}

function burstPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath()
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? s : s * 0.5
    const a = -Math.PI / 2 + (i * Math.PI) / 8
    const px = cx + Math.cos(a) * r
    const py = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/** Reloj de agujas de las especiales: lo que dura su jugada. */
function clockPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath()
  ctx.arc(cx, cy, s * 0.82, 0, Math.PI * 2)
  ctx.moveTo(cx, cy - s * 0.5)
  ctx.lineTo(cx, cy)
  ctx.lineTo(cx + s * 0.42, cy + s * 0.2)
  ctx.stroke()
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

/** Chapa con icono y numero grande: el daño arriba a un lado y el escudo al otro. */
function statBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  icon: BadgeIcon,
  text: string,
  color: string,
  alignRight: boolean,
) {
  ctx.font = `bold 46px Georgia, serif`
  const textW = ctx.measureText(text).width
  const w = textW + 86
  const h = 66
  const bx = alignRight ? x - w : x
  ctx.fillStyle = 'rgba(12,7,3,0.92)'
  roundRect(ctx, bx, y, w, h, 16)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  roundRect(ctx, bx, y, w, h, 16)
  ctx.stroke()
  const ix = bx + 36
  const iy = y + h / 2
  ctx.strokeStyle = color
  ctx.lineWidth = 4
  if (icon === 'escudo') {
    shieldPath(ctx, ix, iy, 21)
    ctx.fillStyle = color
    ctx.fill()
  } else if (icon === 'reloj') {
    clockPath(ctx, ix, iy, 22)
  } else {
    burstPath(ctx, ix, iy, 24)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.fillStyle = '#fff7e6'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, bx + 66, iy + 2)
}

export interface FrameInfo {
  name: string
  sub: string
  accent: string
  /** La rareza manda en el marco: color, remaches y galones. */
  rarity: Rarity
  rarityColor: string
  left: { icon: BadgeIcon; text: string; color: string }
  right: { icon: BadgeIcon; text: string; color: string }
  pattern?: Pt[]
  /** El sello de la carta de batalla: va estampado en la esquina del retrato. */
  sello?: { label: string; color: string; icono: string }
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
      sub: `${sello.label} · ${LEVEL_LABEL[level]}`,
      accent: card.accent,
      sello: { label: sello.label, color: sello.color, icono: sello.icono },
      // (Los números de verdad en la partida: con lo que les cambia su sello.)
      left: { icon: 'golpe', text: String(Math.round(card.damage * sello.mods.soldado.fuerte)), color: '#fca5a5' },
      right: { icon: 'escudo', text: String(Math.max(1, Math.round(card.shields * sello.mods.soldado.escudos))), color: '#7dd3fc' },
      pattern: patternById(card.pattern).points,
    }
  }
  const special = specialOf(card)
  if (special) {
    // Las especiales no pegan ni tienen alcance: lo suyo es que duran y que se gastan de una vez.
    return {
      ...rareza,
      name: card.name,
      sub: 'Especial · 1 uso',
      accent: card.accent,
      left: { icon: 'golpe', text: '0', color: '#94a3b8' },
      right: { icon: 'reloj', text: `${special.seconds}s`, color: '#fcd34d' },
    }
  }
  const mode = SHOT_MODES.find((item) => item.id === card.shot.mode)
  return {
    ...rareza,
    name: card.name,
    sub: `Arma · ${mode?.label ?? ''}`,
    accent: card.accent,
    left: { icon: 'escudo', text: `-${card.shot.shieldsPerHit}`, color: '#7dd3fc' },
    right: { icon: 'golpe', text: `${Math.round(card.shot.range)}m`, color: '#fcd34d' },
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

  // Arriba: estadisticas a los lados y el patron en medio.
  statBadge(ctx, 30, 18, info.left.icon, info.left.text, info.left.color, false)
  statBadge(ctx, w - 30, 18, info.right.icon, info.right.text, info.right.color, true)
  if (info.pattern) {
    const size = 64
    const gx = w / 2 - size / 2
    const gy = 20
    ctx.fillStyle = 'rgba(12,7,3,0.92)'
    roundRect(ctx, gx - 4, gy - 2, size + 8, size + 6, 14)
    ctx.fill()
    ctx.strokeStyle = 'rgba(224,180,99,0.8)'
    ctx.lineWidth = 3
    roundRect(ctx, gx - 4, gy - 2, size + 8, size + 6, 14)
    ctx.stroke()
    drawPatternGlyph(ctx, info.pattern, gx + 6, gy + 6, size - 12, '#f5d69a', 5)
  }

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
  ctx.font = `${info.sello ? 700 : 600} 22px "Cinzel", Georgia, serif`
  ctx.fillStyle = info.sello?.color ?? info.accent
  ctx.fillText(info.sub.toUpperCase(), w / 2, plateY + plateH * 0.8)

  // El sello, estampado en la esquina del retrato: lo primero que se ve de la carta.
  if (info.sello) {
    const r = 46
    const cx = wx0 + 26
    const cy = wy1 - 22
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = '#140a04'
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2)
    ctx.lineWidth = 7
    ctx.strokeStyle = info.sello.color
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, r - 13, 0, Math.PI * 2)
    ctx.fillStyle = tono(info.sello.color, -0.55)
    ctx.fill()
    ctx.font = `44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(info.sello.icono, cx, cy + 2)
  }
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
