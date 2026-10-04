/**
 * El aspecto de los muñecos, al estilo de DER DAED REDEMEPTION 3: cabezones, con barriga,
 * bigotazos y sombreros enormes, todo hecho con piezas (nada de modelos descargados).
 *
 * Por dentro llevan el mismo esqueleto articulado de siempre (cadera, tronco, cuello, cabeza,
 * hombros, codos, manos, caderas, rodillas y pies): asi sirven las 5 animaciones de cada tipo y
 * al morir se desmontan pieza a pieza.
 */

export type HatStyle =
  | 'vaquero'
  | 'sombrero'
  | 'chistera'
  | 'bombin'
  | 'minero'
  | 'cofia'
  | 'kepi'
  | 'toca'
  | 'bandana'
  | 'pluma'
  | 'gorro'
  | 'plumas'
  | 'cuernos'
  | 'casco'
  | 'cinta'
  | 'ninguno'
/** Los ojos: lo que mas cambia la cara de un vistazo. */
export type EyeStyle = 'normal' | 'furioso' | 'dormilon' | 'bizco' | 'asustado' | 'punto' | 'siniestro'
export type MouthStyle = 'sonrisa' | 'seria' | 'mueca' | 'boquiabierto' | 'dientes' | 'diente-oro' | 'lengua'
export type HairStyle = 'calvo' | 'corto' | 'melena' | 'coleta' | 'trenzas' | 'tonsura' | 'tupe'
/** La ropa del torso, encima de la camisa. */
export type OutfitStyle = 'liso' | 'chaleco' | 'tirantes' | 'bandolera' | 'rayas' | 'abrigo'
export type MustacheStyle = 'manillar' | 'morsa' | 'lapiz' | 'fumanchu' | 'ninguno'
/** Lo que lleva en la mano: sale en la carta y es con lo que dispara en el campo. */
export type GunStyle =
  | 'revolver'
  | 'dos-revolveres'
  | 'escopeta'
  | 'rifle'
  | 'dinamita'
  | 'botella'
  | 'arco'
  | 'hacha'
  | 'lanza'
  | 'martillo'
export type Extra =
  | 'placa'
  | 'panuelo'
  | 'mascara'
  | 'puro'
  | 'parche'
  | 'poncho'
  | 'gafas'
  | 'cicatriz'
  | 'pecas'
  | 'pendiente'
  | 'pintura'
  | 'piel'

export interface DollLook {
  height: number
  fat: number
  belly: number
  headSize: number
  legLength: number
  armLength: number
  noseSize: number
  eyeSize: number
  /** Ancho de la cabeza (1 = redonda; mas = cara ancha; menos = cara estrecha). */
  headWidth: number
  /** Cuanta mandibula tiene (0 = sin barbilla; 1 = barbilla de piedra). */
  jaw: number
  earSize: number
  eyes: EyeStyle
  mouth: MouthStyle
  hairStyle: HairStyle
  outfit: OutfitStyle
  /** El color del chaleco, los tirantes o el abrigo. */
  outfitColor: string
  eyebrows: number
  mustache: number
  mustacheStyle: MustacheStyle
  beard: number
  hat: HatStyle
  hatSize: number
  skin: string
  /** Pelo, cejas, bigote y barba. */
  hair: string
  shirt: string
  pants: string
  hatColor: string
  boots: string
  weapon: GunStyle
  extras: Extra[]
  /**
   * El color del bando (solo en la batalla): pañuelo al cuello y brazaletes de este color, para
   * distinguir a los tuyos de los del rival de un vistazo. No se guarda en las cartas.
   */
  team?: string
  /**
   * Un objeto grande que cambia la silueta del muñeco en la batalla (mochila de medico, bandera,
   * barril, dinamita, tambor de minigun, armadura). Solo en la batalla; no se guarda en las cartas.
   */
  prop?: 'medico' | 'bandera' | 'barril' | 'dinamita' | 'municion' | 'armadura'
}

export const HATS: Record<HatStyle, string> = {
  vaquero: 'Vaquero',
  sombrero: 'Sombrero mexicano',
  chistera: 'Chistera',
  bombin: 'Bombín',
  minero: 'Casco de minero',
  cofia: 'Cofia de abuela',
  kepi: 'Kepi de soldado',
  toca: 'Toca de monja',
  bandana: 'Bandana',
  pluma: 'Cinta con pluma',
  gorro: 'Gorro de lana',
  plumas: 'Tocado de plumas',
  cuernos: 'Casco con cuernos',
  casco: 'Casco de hierro',
  cinta: 'Cinta de guerra',
  ninguno: 'Sin sombrero',
}

export const EYES: Record<EyeStyle, string> = {
  normal: 'Normales',
  furioso: 'Furiosos',
  dormilon: 'Dormilones',
  bizco: 'Bizcos',
  asustado: 'Asustados',
  punto: 'De botón',
  siniestro: 'Siniestros',
}

export const MOUTHS: Record<MouthStyle, string> = {
  sonrisa: 'Sonrisa',
  seria: 'Seria',
  mueca: 'Mueca torcida',
  boquiabierto: 'Boquiabierto',
  dientes: 'Dientes',
  'diente-oro': 'Diente de oro',
  lengua: 'Lengua fuera',
}

export const HAIRS_STYLE: Record<HairStyle, string> = {
  calvo: 'Calvo',
  corto: 'Corto',
  melena: 'Melena',
  coleta: 'Coleta',
  trenzas: 'Trenzas',
  tonsura: 'Tonsura',
  tupe: 'Tupé',
}

export const OUTFITS: Record<OutfitStyle, string> = {
  liso: 'Camisa lisa',
  chaleco: 'Chaleco',
  tirantes: 'Tirantes',
  bandolera: 'Bandolera de balas',
  rayas: 'Rayas',
  abrigo: 'Abrigo largo',
}

export const MUSTACHES: Record<MustacheStyle, string> = {
  manillar: 'Manillar',
  morsa: 'Morsa',
  lapiz: 'Lápiz',
  fumanchu: 'Fu Manchú',
  ninguno: 'Afeitado',
}

export const GUNS: Record<GunStyle, string> = {
  revolver: 'Revólver',
  'dos-revolveres': 'Dos revólveres',
  escopeta: 'Escopeta',
  rifle: 'Rifle',
  dinamita: 'Dinamita',
  botella: 'Botellazo',
  arco: 'Arco',
  hacha: 'Hacha',
  lanza: 'Lanza',
  martillo: 'Martillo',
}

export const EXTRAS: Record<Extra, string> = {
  placa: 'Placa de sheriff',
  panuelo: 'Pañuelo al cuello',
  mascara: 'Pañuelo de bandido',
  puro: 'Puro',
  parche: 'Parche en el ojo',
  poncho: 'Poncho',
  gafas: 'Gafas redondas',
  cicatriz: 'Cicatriz',
  pecas: 'Pecas',
  pendiente: 'Pendiente',
  pintura: 'Pintura de guerra',
  piel: 'Capa de piel',
}

type NumericKey = {
  [K in keyof DollLook]-?: DollLook[K] extends number ? K : never
}[keyof DollLook]

export interface SliderDef {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  /** Lo que significa cada punta del deslizador. */
  ends: [string, string]
}

export const BODY_SLIDERS: SliderDef[] = [
  { key: 'height', label: 'Altura', min: 0.6, max: 1.8, step: 0.05, ends: ['Retaco', 'Rascacielos'] },
  { key: 'fat', label: 'Gordura', min: 0.5, max: 2.2, step: 0.05, ends: ['Palillo', 'Tonel'] },
  { key: 'belly', label: 'Barriga', min: 0, max: 1, step: 0.05, ends: ['Tableta', 'Cervecera'] },
  { key: 'legLength', label: 'Largo de piernas', min: 0.5, max: 1.7, step: 0.05, ends: ['Salchicha', 'Zancudo'] },
  { key: 'armLength', label: 'Largo de brazos', min: 0.6, max: 1.6, step: 0.05, ends: ['T-Rex', 'Orangután'] },
  { key: 'headSize', label: 'Tamaño de cabeza', min: 0.6, max: 1.8, step: 0.05, ends: ['Alfiler', 'Cabezón'] },
]

export const FACE_SLIDERS: SliderDef[] = [
  { key: 'mustache', label: 'Tamaño de bigote', min: 0, max: 2.5, step: 0.05, ends: ['Pelusilla', 'Legendario'] },
  { key: 'beard', label: 'Barba', min: 0, max: 2, step: 0.05, ends: ['Lampiño', 'Ermitaño'] },
  { key: 'eyebrows', label: 'Cejas', min: 0, max: 2.5, step: 0.05, ends: ['Ninguna', 'Orugas'] },
  { key: 'noseSize', label: 'Nariz', min: 0.3, max: 2.5, step: 0.05, ends: ['Botón', 'Patata'] },
  { key: 'eyeSize', label: 'Ojos', min: 0.5, max: 2, step: 0.05, ends: ['Chinitos', 'Platos'] },
]

export const HAT_SLIDERS: SliderDef[] = [
  { key: 'hatSize', label: 'Tamaño del sombrero', min: 0.5, max: 2.2, step: 0.05, ends: ['Mini', 'Paraguas'] },
]

type ColorKey = 'skin' | 'hair' | 'shirt' | 'pants' | 'hatColor' | 'boots'

export const FACE_COLORS: { key: ColorKey; label: string }[] = [
  { key: 'skin', label: 'Piel' },
  { key: 'hair', label: 'Pelo / bigote' },
]

export const CLOTHES_COLORS: { key: ColorKey; label: string }[] = [
  { key: 'hatColor', label: 'Sombrero' },
  { key: 'shirt', label: 'Camisa' },
  { key: 'pants', label: 'Pantalón' },
  { key: 'boots', label: 'Botas' },
]

export const DEFAULT_LOOK: DollLook = {
  height: 1,
  fat: 1,
  belly: 0.3,
  headSize: 1,
  legLength: 1,
  armLength: 1,
  noseSize: 1,
  eyeSize: 1,
  headWidth: 1,
  jaw: 0.3,
  earSize: 1,
  eyes: 'normal',
  mouth: 'sonrisa',
  hairStyle: 'corto',
  outfit: 'liso',
  outfitColor: '#3b2314',
  eyebrows: 1,
  mustache: 1,
  mustacheStyle: 'manillar',
  beard: 0,
  hat: 'vaquero',
  hatSize: 1,
  skin: '#f1c27d',
  hair: '#4a2c17',
  shirt: '#b5523b',
  pants: '#3d5a80',
  hatColor: '#7a4b2a',
  boots: '#3b2314',
  weapon: 'revolver',
  extras: [],
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Copia independiente de un aspecto, rellenando lo que falte (y descartando formatos viejos). */
export function cloneLook(look?: Partial<DollLook>): DollLook {
  const src = (look ?? {}) as Partial<DollLook>
  const out: DollLook = { ...DEFAULT_LOOK, extras: [] }
  for (const key of Object.keys(DEFAULT_LOOK) as (keyof DollLook)[]) {
    const base = DEFAULT_LOOK[key]
    const value = src[key]
    if (typeof base === 'number') (out[key] as number) = num(value, base)
    else if (typeof base === 'string' && typeof value === 'string') (out[key] as string) = value
  }
  if (!(out.hat in HATS)) out.hat = DEFAULT_LOOK.hat
  if (!(out.eyes in EYES)) out.eyes = DEFAULT_LOOK.eyes
  if (!(out.mouth in MOUTHS)) out.mouth = DEFAULT_LOOK.mouth
  if (!(out.hairStyle in HAIRS_STYLE)) out.hairStyle = DEFAULT_LOOK.hairStyle
  if (!(out.outfit in OUTFITS)) out.outfit = DEFAULT_LOOK.outfit
  if (!(out.mustacheStyle in MUSTACHES)) out.mustacheStyle = DEFAULT_LOOK.mustacheStyle
  if (!(out.weapon in GUNS)) out.weapon = DEFAULT_LOOK.weapon
  out.extras = Array.isArray(src.extras) ? src.extras.filter((extra): extra is Extra => extra in EXTRAS) : []
  return out
}

/** ¿Es un aspecto de este formato? (los del taller viejo traian params/colors/outfit). */
export function isLook(value: unknown): value is Partial<DollLook> {
  return Boolean(value && typeof value === 'object' && 'height' in value && !('params' in value))
}

// ---------------------------------------------------------------------------
// Sorpréndeme: un muñeco al azar, a veces con proporciones exageradas
// ---------------------------------------------------------------------------

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f3d1b5', '#d99a6c', '#cfd8c8', '#9fc26b']
const HAIRS = ['#111111', '#4a2c17', '#8d5524', '#d9d9d9', '#e8c170', '#b23a1a', '#ffffff']

function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

export function randomLook(rand: () => number = Math.random): DollLook {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!
  const extreme = (min: number, max: number) => {
    const r = rand()
    if (r < 0.175) return min
    if (r < 0.35) return max
    return Math.round((min + rand() * (max - min)) * 20) / 20
  }
  const color = () => hslHex(rand(), 0.35 + rand() * 0.4, 0.3 + rand() * 0.35)
  const extras = (Object.keys(EXTRAS) as Extra[]).filter(() => rand() < 0.2)
  return {
    height: extreme(0.6, 1.8),
    fat: extreme(0.5, 2.2),
    belly: extreme(0, 1),
    headSize: extreme(0.6, 1.8),
    legLength: extreme(0.5, 1.7),
    armLength: extreme(0.6, 1.6),
    noseSize: extreme(0.3, 2.5),
    eyeSize: extreme(0.5, 2),
    headWidth: extreme(0.8, 1.35),
    jaw: extreme(0, 1),
    earSize: extreme(0.5, 2.5),
    eyes: pick(Object.keys(EYES) as EyeStyle[]),
    mouth: pick(Object.keys(MOUTHS) as MouthStyle[]),
    hairStyle: pick(Object.keys(HAIRS_STYLE) as HairStyle[]),
    outfit: pick(Object.keys(OUTFITS) as OutfitStyle[]),
    outfitColor: color(),
    eyebrows: extreme(0, 2.5),
    mustache: extreme(0, 2.5),
    mustacheStyle: pick(Object.keys(MUSTACHES) as MustacheStyle[]),
    beard: rand() < 0.3 ? extreme(0.3, 2) : 0,
    hat: pick(Object.keys(HATS) as HatStyle[]),
    hatSize: extreme(0.5, 2.2),
    skin: pick(SKINS),
    hair: pick(HAIRS),
    shirt: color(),
    pants: color(),
    hatColor: color(),
    boots: color(),
    weapon: pick(Object.keys(GUNS) as GunStyle[]),
    extras,
  }
}

const NAMES_A = ['Sheriff', 'Tío', 'Flaco', 'Abuela', 'Doc', 'Big', 'Pistolero', 'Chato', 'Manco', 'Jack']
const NAMES_B = ['Bigotón', 'Barrigas', 'Jim', 'Dinamita', 'Pólvora', 'Cactus', 'Mofeta', 'Tequila', 'Rata', 'Zurdo']

export function randomName(rand: () => number = Math.random): string {
  const a = NAMES_A[Math.floor(rand() * NAMES_A.length)]!
  const b = NAMES_B[Math.floor(rand() * NAMES_B.length)]!
  return `${a} ${b}`.slice(0, 16)
}

// ---------------------------------------------------------------------------
// Medidas resueltas: donde va cada articulacion
// ---------------------------------------------------------------------------

export interface Proportions {
  /** Alto total, sombrero incluido. */
  H: number
  bootH: number
  legLen: number
  thigh: number
  shin: number
  /** Altura de la cadera (donde nace el tronco). */
  hipY: number
  hipX: number
  torsoH: number
  torsoW: number
  torsoD: number
  bellyR: number
  headR: number
  /** Del cuello al centro de la cabeza. */
  headUp: number
  limbR: number
  upperArm: number
  foreArm: number
  shoulderX: number
  shoulderY: number
  handR: number
  /** Radio para no chocar con otros. */
  radius: number
}

function hatHeight(look: DollLook, headR: number): number {
  const r = headR * look.hatSize
  switch (look.hat) {
    case 'ninguno':
      return 0
    case 'chistera':
      return r * 1.5
    case 'sombrero':
      return r * 1.3
    case 'cofia':
      return r * 0.2
    case 'bandana':
      return r * 0.15
    case 'pluma':
      return r * 1.4
    case 'toca':
    case 'gorro':
      return r * 0.8
    default:
      return r * 0.9
  }
}

export function proportions(look: DollLook): Proportions {
  const h = look.height
  const fat = look.fat
  const bootH = 0.08
  const legLen = 0.3 * h * look.legLength
  const torsoH = 0.38 * h
  const torsoW = 0.2 * fat
  const torsoD = 0.15 * fat
  const headR = 0.2 * look.headSize
  const limbR = 0.06 * (0.75 + 0.25 * fat)
  const armLen = 0.28 * look.armLength * Math.sqrt(h)
  const hipY = legLen + bootH
  const headUp = headR * 0.85
  return {
    H: hipY + torsoH + headUp + headR * 0.6 + Math.max(headR * 0.42, hatHeight(look, headR)),
    bootH,
    legLen,
    thigh: legLen * 0.5,
    shin: legLen * 0.5,
    hipY,
    hipX: torsoW * 0.5,
    torsoH,
    torsoW,
    torsoD,
    bellyR: torsoW * (0.55 + look.belly * 0.55),
    headR,
    headUp,
    limbR,
    upperArm: armLen * 0.5,
    foreArm: armLen * 0.5,
    shoulderX: torsoW * 0.95 + limbR * 0.3,
    shoulderY: torsoH * 0.82,
    handR: limbR * 1.2,
    radius: Math.max(0.25, torsoW * 1.2 + look.belly * 0.08),
  }
}
