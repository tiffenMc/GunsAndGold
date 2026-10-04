/**
 * Donde va cada cosa de la interfaz, en pixeles de pantalla. La escena 3D ocupa todo y la
 * interfaz flota encima: arriba el fuerte rival, abajo tu vida y la mano (3 cartas + arma).
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface HudLayout {
  width: number
  height: number
  top: number
  /** Donde empieza la franja de la mano (todo lo de encima es campo). */
  handTop: number
  card: { w: number; h: number }
  /** Los 3 huecos de batalla y, el ultimo, el del arma. */
  slots: Rect[]
  weapon: Rect
  /** Hueco extra de la carta premio (dinamita), solo cuando la tienes. */
  bonus?: Rect
  /** El boton de reroll, justo debajo de la carta del arma. */
  reroll: Rect
  /** La franja libre para el campo. */
  field: { top: number; bottom: number }
}

export const TOP_BAR = 56
const HP_BAR = 28
const PAD = 8
const GAP = 6
const WEAPON_GAP = 12
/** El reroll vive debajo de la carta del arma: hay que dejarle su franja. */
const REROLL_H = 30
const REROLL_GAP = 6

/** `withBonus` reserva un quinto hueco para la carta premio, sin tocar las cuatro de siempre. */
export function hudLayout(width: number, height: number, withBonus = false): HudLayout {
  const count = withBonus ? 5 : 4
  const cardW = Math.max(52, (width - PAD * 2 - GAP * (count - 2) - WEAPON_GAP) / count)
  const cardH = cardW * 1.4
  const bottomPad = 10 + REROLL_H + REROLL_GAP
  const cardsTop = height - bottomPad - cardH
  const handTop = cardsTop - HP_BAR
  const slots: Rect[] = [0, 1, 2].map((i) => ({ x: PAD + i * (cardW + GAP), y: cardsTop, w: cardW, h: cardH }))
  const weapon: Rect = {
    x: PAD + 3 * cardW + 2 * GAP + WEAPON_GAP,
    y: cardsTop,
    w: cardW,
    h: cardH,
  }
  const bonus: Rect | undefined = withBonus
    ? { x: weapon.x + cardW + GAP, y: cardsTop, w: cardW, h: cardH }
    : undefined
  return {
    width,
    height,
    top: TOP_BAR,
    handTop,
    card: { w: cardW, h: cardH },
    slots,
    weapon,
    bonus,
    reroll: { x: weapon.x, y: weapon.y + cardH + REROLL_GAP, w: cardW, h: REROLL_H },
    field: { top: TOP_BAR, bottom: handTop },
  }
}

export function inside(rect: Rect, x: number, y: number, grow = 0): boolean {
  return x >= rect.x - grow && x <= rect.x + rect.w + grow && y >= rect.y - grow && y <= rect.y + rect.h + grow
}
