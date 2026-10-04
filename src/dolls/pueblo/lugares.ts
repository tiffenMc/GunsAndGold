import type { NombreDeIcono } from '../Icono'
import type { Placement } from '../scenes/models'

/**
 * **El mundo por el que anda tu vaquero**: el pueblo y el desierto. Cada uno es una calle que va
 * de izquierda a derecha (a lo largo de X) con los edificios al fondo mirando a la cámara, para que
 * desde el móvil se vean de frente. Se anda por la calle (Z entre `calle[0]` y `calle[1]`).
 *
 * Cada **sitio** es un edificio (o una cosa) al que se entra: tiene su puerta (donde se para el
 * vaquero), su caja para tocarlo y su cartel flotante.
 */

export type Lugar = 'pueblo' | 'desierto'

/** Lo que se abre al entrar en un sitio. */
export type Zona =
  | 'tablon'
  | 'ranking'
  | 'bar'
  | 'sastreria'
  | 'saloon'
  | 'sheriff'
  | 'diligencia'
  | 'incursiones'
  | 'entrenar'
  | 'rango'

export interface Sitio {
  zona: Zona
  nombre: string
  /** Lo que se hace dentro, en pocas palabras. */
  lema: string
  icono: NombreDeIcono
  color: string
  /** Donde se para el vaquero para entrar. */
  puerta: { x: number; z: number }
  /** La caja que se toca (centro y medidas en el suelo, y alto). */
  caja: { x: number; z: number; w: number; d: number; h: number }
  /** A que altura va el cartel flotante. */
  cartelY: number
}

export interface Mundo {
  lugar: Lugar
  nombre: string
  /** Donde aparece el vaquero si no venia de ningun sitio. */
  inicio: { x: number; z: number }
  /** Hasta donde se puede andar. */
  limites: { x: [number, number]; z: [number, number] }
  /** Cosas de la calle que no se pueden atravesar (circulos en el suelo). */
  estorbos: { x: number; z: number; r: number }[]
  sitios: Sitio[]
  modelos: Placement[]
  /** El suelo: arena de fuera, tierra de la calle y las tablas de delante de las casas. */
  suelo: { arena: string; calle: string; tablas: boolean }
  /** El cielo y la niebla. */
  cielo: string
}

/**
 * Una casa entera del pack Western, que viene por piezas: paredes, tejado, fachada de abajo (puerta
 * y ventanas), fachada alta, el porche y su toldo. Todas van en el mismo sitio.
 */
function casa(tipo: 'grande' | 'pequena', x: number, z: number, variante: 1 | 2 = 1): Placement[] {
  if (tipo === 'grande') {
    return ['Bld_Large_01', `Bld_Double_Roof_0${variante}`, `Bld_Double_Front_0${variante}`, variante === 1 ? 'Bld_Double_Facade_01' : 'Bld_Double_Facade_03', 'Bld_Double_Deck_01', 'Bld_Double_DeckCover_01'].map((m) => ({ m, x, z }))
  }
  return ['Bld_Single_01', `Bld_Single_Roof_0${variante}`, `Bld_Single_Front_0${variante}`, `Bld_Single_Facade_0${variante}`, 'Bld_Single_Deck_01', 'Bld_Single_DeckCover_01'].map((m) => ({ m, x, z }))
}

// ---------------------------------------------------------------------------
// El pueblo
// ---------------------------------------------------------------------------

export const PUEBLO: Mundo = {
  lugar: 'pueblo',
  nombre: 'El pueblo',
  inicio: { x: 0, z: 6 },
  limites: { x: [-50, 46], z: [0.4, 11] },
  estorbos: [
    { x: 6.5, z: 9.5, r: 1.3 }, // el pozo
    { x: 24, z: 1.4, r: 0.9 }, // el poste de atar los caballos y el abrevadero
    { x: 26.2, z: 1.2, r: 0.9 },
    { x: 39, z: 4.6, r: 2.2 }, // la diligencia
    { x: 42, z: 4.6, r: 1.6 },
  ],
  sitios: [
    {
      zona: 'tablon',
      nombre: 'Tablón de anuncios',
      lema: 'Se busca: tu ficha y los encargos de hoy',
      icono: 'se_busca',
      color: '#fbbf24',
      puerta: { x: -6.8, z: 2.6 },
      caja: { x: -6.8, z: 0.4, w: 4.4, d: 1.4, h: 3.6 },
      cartelY: 4.6,
    },
    {
      zona: 'ranking',
      nombre: 'Los Más Buscados',
      lema: 'Los cinco mejores del Oeste',
      icono: 'ranking',
      color: '#facc15',
      puerta: { x: 0, z: 2.8 },
      caja: { x: 0, z: -0.6, w: 9.4, d: 2.8, h: 8 },
      cartelY: 9.1,
    },
    {
      zona: 'bar',
      nombre: 'El Bar',
      lema: 'Tus cartas y tus barajas',
      icono: 'cartas',
      color: '#f59e0b',
      puerta: { x: -15, z: 1.8 },
      caja: { x: -15, z: -4, w: 10.2, d: 8.2, h: 7 },
      cartelY: 8.6,
    },
    {
      zona: 'saloon',
      nombre: 'El Saloon',
      lema: 'Partida rápida y con amigos',
      icono: 'partida',
      color: '#ef4444',
      puerta: { x: 17, z: 1.8 },
      caja: { x: 17, z: -6, w: 16, d: 12, h: 9.7 },
      cartelY: 11,
    },
    {
      zona: 'sheriff',
      nombre: 'Oficina del Sheriff',
      lema: 'Tu perfil y tus personajes',
      icono: 'personaje',
      color: '#60a5fa',
      puerta: { x: -32.3, z: 1.8 },
      caja: { x: -32.3, z: -4, w: 8.4, d: 8, h: 5.5 },
      cartelY: 7,
    },
    {
      zona: 'sastreria',
      nombre: 'La Sastrería',
      lema: 'Viste a tu vaquero a tu gusto',
      icono: 'sastreria',
      color: '#f472b6',
      puerta: { x: -24, z: 1.8 },
      caja: { x: -24, z: -4, w: 6.6, d: 7, h: 6 },
      cartelY: 7.2,
    },
    {
      zona: 'diligencia',
      nombre: 'Diligencia al desierto',
      lema: 'Incursiones, rango y entrenar',
      icono: 'desierto',
      color: '#fb923c',
      puerta: { x: 36, z: 5 },
      caja: { x: 40.5, z: 4.6, w: 7, d: 3, h: 3.4 },
      cartelY: 5.4,
    },
  ],
  modelos: [
    // La calle, de izquierda a derecha. Las fachadas miran a la cámara (hacia +Z).
    { m: 'Bld_Windmill_01', x: -53, z: -6, r: 20 },
    { m: 'Bld_Church_01', x: -44, z: -7.5 },
    { m: 'Bld_Jail_01', x: -31, z: -3 },
    ...casa('pequena', -24, -1),
    ...casa('grande', -15, -1),
    // En medio de la plaza va la tarima de Los Más Buscados (hecha a mano, no es un modelo).
    { m: 'Prop_Barrel_01', x: 5.7, z: -0.4 },
    { m: 'Prop_Barrel_01', x: 6.2, z: 0.4, r: 40 },
    { m: 'Prop_Crate_01', x: 7.6, z: -0.2, r: 15 },
    { m: 'Bld_Well_01', x: 6.5, z: 9.5 },
    { m: 'Bld_Saloon_01', x: 17, z: -9.3 },
    ...casa('pequena', 29, -1, 2),
    { m: 'Prop_Water_Tower_01', x: 35, z: -4 },
    { m: 'Prop_RoadSign_01', x: 34.5, z: 1.4, r: -20 },
    { m: 'Veh_Stagecoach_01', x: 40, z: 4.6, r: 90 },
    { m: 'Prop_HitchingPost_01', x: 24, z: 1.4 },
    { m: 'Prop_WaterTrough_01', x: 26.2, z: 1.2 },
    { m: 'Prop_LogPile_01', x: 32, z: 0.6 },
    // El borde de abajo: valla, cactus y trastos (bajitos: no tapan la calle).
    { m: 'Prop_PikeFence_01', x: -20, z: 13.5 },
    { m: 'Prop_PikeFence_01', x: -16, z: 13.5 },
    { m: 'Prop_PikeFence_01', x: 14, z: 13.5 },
    { m: 'Prop_PikeFence_01', x: 18, z: 13.5 },
    { m: 'Env_Cactus_01', x: -36, z: 14 },
    { m: 'Env_Cactus_05', x: -6, z: 15 },
    { m: 'Env_Cactus_10', x: 27, z: 14.5 },
    { m: 'Env_Cactus_01', x: 47, z: 9 },
    { m: 'Prop_Cart_02', x: -26, z: 13, r: 70 },
    { m: 'Prop_Hay_Bale_01', x: 9, z: 13 },
    { m: 'Prop_Barrel_01', x: 30, z: 12.5 },
    { m: 'Env_Shrub_01', x: -12, z: 14 },
    { m: 'Env_Shrub_01', x: 3, z: 14.6 },
    { m: 'Env_Rock_01', x: 44, z: 13 },
    // Al fondo, el desierto: mesetas y cactus grandes.
    { m: 'Env_Butte_01', x: -55, z: -140, s: 2.6 },
    { m: 'Env_Butte_02', x: 15, z: -160, s: 3 },
    { m: 'Env_Butte_01', x: 85, z: -150, s: 2.2, r: 40 },
    { m: 'Env_Cactus_Large_01', x: -20, z: -22 },
    { m: 'Env_Cactus_Large_01', x: 40, z: -24, r: 60 },
    { m: 'Env_Tree_Desert_01', x: 4, z: -26 },
  ],
  suelo: { arena: '#c9955b', calle: '#a8743f', tablas: true },
  cielo: '#f0a868',
}

// ---------------------------------------------------------------------------
// El desierto
// ---------------------------------------------------------------------------

export const DESIERTO: Mundo = {
  lugar: 'desierto',
  nombre: 'El desierto',
  inicio: { x: -26, z: 6 },
  limites: { x: [-36, 40], z: [0.4, 11] },
  estorbos: [
    { x: -31, z: 4.6, r: 2.2 },
    { x: -28, z: 4.6, r: 1.6 },
    { x: 15, z: -0.2, r: 1.3 }, // la hoguera
    { x: 21, z: 1.6, r: 1.1 }, // las barricadas del fuerte
    { x: 31, z: 1.6, r: 1.1 },
  ],
  sitios: [
    {
      zona: 'diligencia',
      nombre: 'Diligencia al pueblo',
      lema: 'Vuelta al pueblo',
      icono: 'pueblo',
      color: '#fb923c',
      puerta: { x: -25, z: 5 },
      caja: { x: -29.5, z: 4.6, w: 7, d: 3, h: 3.4 },
      cartelY: 5.4,
    },
    {
      zona: 'entrenar',
      nombre: 'Campo de tiro',
      lema: 'Entrena tus características',
      icono: 'entrenar',
      color: '#22c55e',
      puerta: { x: -13, z: 2.2 },
      caja: { x: -13, z: -2.5, w: 10, d: 5, h: 3 },
      cartelY: 5.2,
    },
    {
      zona: 'incursiones',
      nombre: 'Cañón del Antiguo Oeste',
      lema: 'Las incursiones de la hora',
      icono: 'incursion',
      color: '#fbbf24',
      puerta: { x: 4, z: 2.2 },
      caja: { x: 4, z: -4, w: 12, d: 6, h: 6 },
      cartelY: 8,
    },
    {
      zona: 'rango',
      nombre: 'El Fuerte',
      lema: 'Partida de rango: por monedas',
      icono: 'monedas',
      color: '#e879f9',
      puerta: { x: 26, z: 2.2 },
      caja: { x: 26, z: -4, w: 13, d: 7, h: 8 },
      cartelY: 10.5,
    },
  ],
  modelos: [
    { m: 'Veh_Stagecoach_01', x: -29.5, z: 4.6, r: -90 },
    { m: 'Prop_RoadSign_01', x: -24, z: 0.8, r: 20 },
    { m: 'Env_Cactus_Large_01', x: -34, z: -3 },
    // El campo de tiro: barriles, cajas y balas de paja (las dianas van aparte).
    { m: 'Prop_Hay_Bale_01', x: -17, z: -1.6 },
    { m: 'Prop_Hay_Bale_01', x: -9, z: -1.6, r: 10 },
    { m: 'Prop_Barrel_01', x: -15.5, z: -3.4 },
    { m: 'Prop_Barrel_01', x: -10.5, z: -3.6 },
    { m: 'Prop_Crate_01', x: -13, z: -4.4, r: 20 },
    { m: 'Prop_Tnt_Box', x: -18.6, z: -3.6 },
    // El cañón: la mina, las paredes de roca y el carro.
    { m: 'Env_Quarry_Wall_Straight_01', x: -3, z: -10, s: 1.3 },
    { m: 'Env_Quarry_Wall_Straight_01', x: 11, z: -10, s: 1.3 },
    { m: 'Env_Mine_Entrance_01', x: 4, z: -4.6, s: 1.8 },
    { m: 'Env_Mine_Track_Straight_01', x: 4, z: -2.6 },
    { m: 'Prop_Cart_01', x: 4, z: -1.6, s: 1.4 },
    { m: 'Env_Quarry_Rocks_01', x: -3, z: -1 },
    { m: 'Env_RockTall_01', x: -5, z: -5 },
    { m: 'Prop_Lantern_01', x: 0.6, z: -1 },
    // El campamento del medio.
    { m: 'Prop_Campfire_01', x: 15, z: -0.2, s: 0.8 },
    { m: 'Bld_Teepee_01', x: 14.6, z: -4 },
    // El fuerte: muro de troncos y dos torres.
    { m: 'Bld_Fort_Tower_01', x: 19.5, z: -2.5 },
    { m: 'Bld_Fort_Wall_01', x: 23.2, z: -2.5 },
    { m: 'Bld_Fort_Wall_01', x: 28.2, z: -2.5 },
    { m: 'Bld_Fort_Tower_01', x: 32, z: -2.5 },
    { m: 'Prop_Barricade_Wood_01', x: 21, z: 1.6, r: 10 },
    { m: 'Prop_Barricade_Wood_01', x: 31, z: 1.6, r: -10 },
    // El borde de abajo y el fondo.
    { m: 'Env_Cactus_05', x: -22, z: 14 },
    { m: 'Env_Cactus_10', x: -4, z: 14.5 },
    { m: 'Prop_Cow_Skull_01', x: 6, z: 13 },
    { m: 'Env_Cactus_01', x: 24, z: 14 },
    { m: 'Env_Rock_01', x: 36, z: 13 },
    { m: 'Prop_Wagon_Destroyed_01', x: 38, z: -4, r: -30 },
    { m: 'Env_TreeDead_01', x: -6, z: -9 },
    { m: 'Env_Butte_01', x: -40, z: -120, s: 2.6 },
    { m: 'Env_Butte_02', x: 25, z: -135, s: 3 },
    { m: 'Env_Butte_01', x: 80, z: -125, s: 2.2, r: 50 },
    { m: 'Env_Butte_02', x: -95, z: -110, s: 2 },
    { m: 'Env_Cactus_Large_01', x: -8, z: -18 },
    { m: 'Env_Cactus_Large_01', x: 40, z: -16, r: 90 },
  ],
  suelo: { arena: '#d6a466', calle: '#b98450', tablas: false },
  cielo: '#f4b678',
}

export const MUNDOS: Record<Lugar, Mundo> = { pueblo: PUEBLO, desierto: DESIERTO }

/** El sitio de una zona en un mundo. */
export function sitioDe(mundo: Mundo, zona: Zona): Sitio | undefined {
  return mundo.sitios.find((sitio) => sitio.zona === zona)
}

/**
 * Lleva un punto a donde se puede estar: dentro de la calle y fuera de los estorbos (si cae dentro
 * de uno, se le saca por el lado mas corto: asi el vaquero se desliza por el borde).
 */
export function dondeSePuede(mundo: Mundo, p: { x: number; z: number }, radio = 0.45): { x: number; z: number } {
  let x = Math.min(mundo.limites.x[1], Math.max(mundo.limites.x[0], p.x))
  let z = Math.min(mundo.limites.z[1], Math.max(mundo.limites.z[0], p.z))
  for (const e of mundo.estorbos) {
    const dx = x - e.x
    const dz = z - e.z
    const d = Math.hypot(dx, dz)
    const min = e.r + radio
    if (d < min) {
      const k = d > 0.001 ? min / d : 1
      x = e.x + (d > 0.001 ? dx * k : min)
      z = e.z + (d > 0.001 ? dz * k : 0)
    }
  }
  return { x, z }
}

/**
 * Donde se queda cada mundo (por donde andaba el vaquero), para que al volver de una partida o de
 * un menú siga donde estaba. Vive en memoria mientras el juego esté abierto.
 */
const ultimoSitio: Partial<Record<Lugar, { x: number; z: number }>> = {}

export function posicionGuardada(lugar: Lugar): { x: number; z: number } | undefined {
  return ultimoSitio[lugar]
}

export function guardarPosicion(lugar: Lugar, p: { x: number; z: number }): void {
  ultimoSitio[lugar] = { x: p.x, z: p.z }
}
