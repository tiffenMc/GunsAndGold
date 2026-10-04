import { EXTRAS, GUNS, HATS, OUTFITS } from '../dollParams'
import type { DollLook, Extra, GunStyle, HatStyle, OutfitStyle } from '../dollParams'

/**
 * **La Sastrería: lo que se compra para tu vaquero.** Solo cambia cómo se ve (nunca da ventaja en la
 * partida). Se paga con **lingotes de oro** (salen jugando partidas de rango) o con **diamantes**
 * (salen muy de vez en cuando al azar, y algún día se podrán comprar).
 *
 * La cara y el cuerpo (medidas, ojos, boca, pelo, bigote, barba…) son gratis: eso es tuyo. Lo que se
 * compra son las prendas, las armas, los extras, los colores especiales y las animaciones dibujadas.
 *
 * Cada cosa a la venta es un **artículo** con su id (`sombrero:chistera`, `color:oro`…). Lo que ya
 * tienes se apunta en tu armario y no se vuelve a pagar.
 */

export type Moneda = 'lingotes' | 'diamantes'

export interface Precio {
  moneda: Moneda
  cantidad: number
}

export type Seccion = 'sombrero' | 'ropa' | 'arma' | 'extra' | 'color'

export interface Articulo {
  id: string
  seccion: Seccion
  nombre: string
  /** Sin precio: es gratis (y lo tiene todo el mundo). */
  precio?: Precio
}

const L = (cantidad: number): Precio => ({ moneda: 'lingotes', cantidad })
const D = (cantidad: number): Precio => ({ moneda: 'diamantes', cantidad })

/** Lo que cuesta cada sombrero (los que no salen aquí, gratis). */
const PRECIO_SOMBRERO: Partial<Record<HatStyle, Precio>> = {
  sombrero: L(60),
  bombin: L(40),
  minero: L(50),
  cofia: L(30),
  kepi: L(50),
  toca: L(30),
  pluma: L(45),
  gorro: L(35),
  cinta: L(40),
  casco: L(80),
  chistera: D(2),
  plumas: D(3),
  cuernos: D(3),
}

const PRECIO_ROPA: Partial<Record<OutfitStyle, Precio>> = {
  chaleco: L(40),
  tirantes: L(30),
  rayas: L(45),
  bandolera: L(70),
  abrigo: D(2),
}

const PRECIO_ARMA: Partial<Record<GunStyle, Precio>> = {
  escopeta: L(60),
  rifle: L(70),
  dinamita: L(50),
  botella: L(25),
  arco: L(55),
  hacha: L(55),
  lanza: L(55),
  'dos-revolveres': D(2),
  martillo: D(3),
}

/** Los extras que son de la cara (pecas, cicatriz) van gratis. */
const PRECIO_EXTRA: Partial<Record<Extra, Precio>> = {
  placa: L(80),
  panuelo: L(25),
  mascara: L(40),
  puro: L(30),
  parche: L(35),
  poncho: L(60),
  gafas: L(35),
  pendiente: L(30),
  pintura: L(40),
  piel: D(2),
}

export interface ColorDeTienda {
  id: string
  nombre: string
  hex: string
  precio?: Precio
}

/**
 * **Los colores de la ropa** (sombrero, camisa, chaleco, pantalón y botas). Los normales son gratis;
 * los especiales se compran una vez y valen para cualquier prenda.
 */
export const COLORES: ColorDeTienda[] = [
  { id: 'cuero', nombre: 'Cuero', hex: '#7a4b2a' },
  { id: 'chocolate', nombre: 'Chocolate', hex: '#3b2314' },
  { id: 'arena', nombre: 'Arena', hex: '#c9a46a' },
  { id: 'teja', nombre: 'Teja', hex: '#b5523b' },
  { id: 'vaquero', nombre: 'Vaquero', hex: '#3d5a80' },
  { id: 'pino', nombre: 'Pino', hex: '#3f6b3a' },
  { id: 'hueso', nombre: 'Hueso', hex: '#e8dcc0' },
  { id: 'gris', nombre: 'Ceniza', hex: '#6b6b6b' },
  { id: 'vino', nombre: 'Vino', hex: '#7c1d2b' },
  { id: 'mostaza', nombre: 'Mostaza', hex: '#c8961e' },
  { id: 'carbon', nombre: 'Carbón', hex: '#1f1f22', precio: L(30) },
  { id: 'cielo', nombre: 'Cielo', hex: '#5fa8d3', precio: L(30) },
  { id: 'lavanda', nombre: 'Lavanda', hex: '#9b7fd1', precio: L(40) },
  { id: 'rosa', nombre: 'Rosa chicle', hex: '#f472b6', precio: D(1) },
  { id: 'plata', nombre: 'Plata', hex: '#c0c7cf', precio: D(1) },
  { id: 'oro', nombre: 'Oro puro', hex: '#e2b007', precio: D(2) },
]

/** Las partes del muñeco que se pintan con los colores de la tienda. */
export const PARTES_DE_COLOR = [
  { campo: 'hatColor', nombre: 'Sombrero' },
  { campo: 'shirt', nombre: 'Camisa' },
  { campo: 'outfitColor', nombre: 'Chaleco / abrigo' },
  { campo: 'pants', nombre: 'Pantalón' },
  { campo: 'boots', nombre: 'Botas' },
] as const satisfies readonly { campo: keyof DollLook; nombre: string }[]

export type CampoDeColor = (typeof PARTES_DE_COLOR)[number]['campo']

/** Lo que cuesta guardar una animación dibujada (probarla es gratis). */
export const PRECIO_ANIMACION: Precio = D(2)
/** Hasta cuántas animaciones dibujadas se guardan. */
export const MAX_ANIMACIONES = 6

function articulos<K extends string>(seccion: Seccion, nombres: Record<K, string>, precios: Partial<Record<K, Precio>>): Articulo[] {
  return (Object.keys(nombres) as K[]).map((valor) => {
    const precio = precios[valor]
    return { id: `${seccion}:${valor}`, seccion, nombre: nombres[valor], ...(precio ? { precio } : {}) }
  })
}

/** Todo lo que hay en la Sastrería, por secciones. */
export const ARTICULOS: Articulo[] = [
  ...articulos('sombrero', HATS, PRECIO_SOMBRERO),
  ...articulos('ropa', OUTFITS, PRECIO_ROPA),
  ...articulos('arma', GUNS, PRECIO_ARMA),
  ...articulos('extra', EXTRAS, PRECIO_EXTRA),
  ...COLORES.map((color): Articulo => ({ id: `color:${color.id}`, seccion: 'color', nombre: color.nombre, ...(color.precio ? { precio: color.precio } : {}) })),
]

const POR_ID = new Map(ARTICULOS.map((articulo) => [articulo.id, articulo]))

export function articulo(id: string): Articulo | undefined {
  return POR_ID.get(id)
}

/** El color de la tienda con ese hex (null si no es de la tienda). */
export function colorPorHex(hex: string): ColorDeTienda | null {
  const limpio = hex.toLowerCase()
  return COLORES.find((color) => color.hex.toLowerCase() === limpio) ?? null
}

/**
 * Los artículos **de pago** que lleva puestos una pinta. Los colores que no son de la tienda (los
 * que traía de serie el muñeco de tu retrato) no cuentan: esos ya eran tuyos.
 */
export function articulosDePago(look: DollLook): string[] {
  const ids = [`sombrero:${look.hat}`, `ropa:${look.outfit}`, `arma:${look.weapon}`, ...look.extras.map((extra) => `extra:${extra}`)]
  for (const parte of PARTES_DE_COLOR) {
    const color = colorPorHex(look[parte.campo])
    if (color) ids.push(`color:${color.id}`)
  }
  return [...new Set(ids)].filter((id) => Boolean(articulo(id)?.precio))
}

/** Lo que le falta por comprar a alguien para llevar esa pinta. */
export function loQueFalta(look: DollLook, armario: readonly string[]): string[] {
  return articulosDePago(look).filter((id) => !armario.includes(id))
}
