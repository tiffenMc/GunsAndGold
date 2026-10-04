import { FIELD_L, FIELD_W } from '../battle/engine'
import type { Placement } from './models'

/**
 * Los 5 escenarios de batalla. El campo de juego es el mismo en todos (10,5 x 44 m); lo que
 * cambia es el suelo, la raya del centro, la luz y todo lo que hay alrededor.
 *
 * Se ve una franja de unos 2 m a cada lado del campo y unos 5 m por detras del fuerte rival:
 * ahi va el decorado. Los edificios de los lados miran hacia el campo.
 */
/**
 * El decorado se coloco a mano para un campo de 26 m, asi que sus profundidades (z) se estiran
 * igual que el campo: asi las cosas del fondo siguen quedando detras del fuerte rival.
 */
export const DECOR_STRETCH = FIELD_L / 26
export const DECOR_SIDE_STRETCH = FIELD_W / 10.5

export function stretchPlacementX(x: number): number {
  const threshold = 4.8
  return Math.sign(x) * (threshold + (Math.abs(x) - threshold) * DECOR_SIDE_STRETCH)
}

export type ScenarioId = 'oeste' | 'tren' | 'pueblo' | 'mina' | 'nieve'

/** Que hay en la raya del centro que separa los dos campos. */
export type Divider = 'arroyo' | 'vias' | 'calle' | 'rieles-mina' | 'hielo'

export type SceneFx = 'rodadores' | 'tren' | 'polvo' | 'nieve' | 'ninguno'

export interface ScenarioDef {
  id: ScenarioId
  name: string
  note: string
  icon: string
  /** Suelo del campo y de fuera. */
  field: string
  outside: string
  sky: string
  fog: [number, number]
  sun: string
  sunIntensity: number
  hemiSky: string
  hemiGround: string
  divider: Divider
  fx: SceneFx
  snow: boolean
  props: Placement[]
}

/** Edificio en el lado izquierdo mirando al campo, o en el derecho. */
const L = 90
const R = -90

const OESTE: ScenarioDef = {
  id: 'oeste',
  name: 'Desierto del Oeste',
  note: 'Cactus, calaveras y mesetas al sol',
  icon: '🌵',
  field: '#e6b377',
  outside: '#c79257',
  sky: '#f2c890',
  fog: [60, 110],
  sun: '#fff1d4',
  sunIntensity: 2.3,
  hemiSky: '#ffe3b8',
  hemiGround: '#6b3f1f',
  divider: 'arroyo',
  fx: 'rodadores',
  snow: false,
  props: [
    { m: 'Env_Butte_01', x: -7, z: -22, s: 0.45 },
    { m: 'Env_Butte_02', x: 8, z: -21, s: 0.4, r: 40 },
    { m: 'Env_RockTall_01', x: 0.5, z: -17.5, s: 0.45, r: 20 },
    { m: 'Env_Cactus_Large_01', x: -4, z: -15, s: 0.9 },
    { m: 'Env_Cactus_05', x: 4.2, z: -14.6, s: 1.1 },
    { m: 'Prop_Cow_Skull_01', x: -1.8, z: -14.4, r: 30 },
    { m: 'Bld_Teepee_01', x: -8.5, z: -8, s: 0.6 },
    { m: 'Prop_Campfire_01', x: -7, z: -4.5, s: 0.5 },
    { m: 'Env_Cactus_01', x: -6.4, z: -1.5, s: 1.1 },
    { m: 'Env_Cactus_10', x: -6.2, z: 2.5 },
    { m: 'Env_TreeDead_01', x: -8.2, z: 6, s: 0.6 },
    { m: 'Env_Rock_01', x: -6.3, z: 9, s: 1.4 },
    { m: 'Env_Grave_01', x: -6.5, z: 11.5, r: 80 },
    { m: 'Bld_Windmill_01', x: 8.5, z: -8, s: 0.7 },
    { m: 'Prop_Wagon_Destroyed_01', x: 7.8, z: -2, r: 30, s: 0.7 },
    { m: 'Env_Cactus_05', x: 6.4, z: 3 },
    { m: 'Bld_Well_01', x: 7, z: 7, s: 0.8 },
    { m: 'Env_Tree_Desert_01', x: 8.4, z: 11, s: 0.7 },
    { m: 'Env_Shrub_01', x: 6.2, z: 12.5, s: 1.5 },
    { m: 'Prop_Hay_Bale_01', x: 6.5, z: 9.8, r: 70 },
  ],
}

const TREN: ScenarioDef = {
  id: 'tren',
  name: 'Vías del tren',
  note: 'La estación, el depósito de agua y el tren que pasa',
  icon: '🚂',
  field: '#d9a870',
  outside: '#b98752',
  sky: '#efc38a',
  fog: [60, 110],
  sun: '#fff1d4',
  sunIntensity: 2.2,
  hemiSky: '#ffe3b8',
  hemiGround: '#5a3a24',
  divider: 'vias',
  fx: 'tren',
  snow: false,
  props: [
    // Vias del fondo, por donde pasa el tren.
    { m: 'Env_Train_Track_Straight_01', x: -19.5, z: -16.5, r: 90 },
    { m: 'Env_Train_Track_Straight_01', x: -13, z: -16.5, r: 90 },
    { m: 'Env_Train_Track_Straight_01', x: -6.5, z: -16.5, r: 90 },
    { m: 'Env_Train_Track_Straight_01', x: 0, z: -16.5, r: 90 },
    { m: 'Env_Train_Track_Straight_01', x: 6.5, z: -16.5, r: 90 },
    { m: 'Env_Train_Track_Straight_01', x: 13, z: -16.5, r: 90 },
    { m: 'Bld_TrainStation_01', x: -8.4, z: -1.5, r: L, s: 0.7 },
    { m: 'Prop_Water_Tower_01', x: 7.2, z: -8, s: 0.8 },
    { m: 'Prop_Crate_01', x: -6.3, z: -6.5, r: 20 },
    { m: 'Prop_Crate_01', x: -6.4, z: -5.6, r: 60 },
    { m: 'Prop_Sack_01', x: -6.2, z: 5.5 },
    { m: 'Prop_Barrel_01', x: -6.3, z: 7 },
    { m: 'Prop_Barrel_01', x: 6.3, z: 3.5 },
    { m: 'Prop_Crate_01', x: 6.5, z: 9, r: 35 },
    { m: 'Env_Cactus_01', x: 7, z: -2 },
    { m: 'Env_Rock_01', x: 6.4, z: 12, s: 1.3 },
    { m: 'Prop_RoadSign_01', x: 6.2, z: -12.8, r: -20 },
  ],
}

// Las casas de la calle tienen el origen en la fachada: se ponen justo detras de la valla.
const PUEBLO_LEFT: Placement[] = [
  { m: 'Bld_Saloon_01', x: -11, z: -5, r: L, s: 0.55 },
  { m: 'Bld_Single_01', x: -6.3, z: 3.2, r: L, s: 0.9 },
  { m: 'Bld_Double_01', x: -6.3, z: 8.4, r: L, s: 0.9 },
  { m: 'Prop_WaterTrough_01', x: -6.1, z: -11.5, r: L },
  { m: 'Prop_Barrel_01', x: -6.0, z: 12 },
]

const PUEBLO: ScenarioDef = {
  id: 'pueblo',
  name: 'Pueblo del Oeste',
  note: 'La calle mayor, el saloon, la cárcel y la iglesia',
  icon: '🍺',
  field: '#c99a66',
  outside: '#a77a4c',
  sky: '#f0c28c',
  fog: [60, 110],
  sun: '#fff1d4',
  sunIntensity: 2.1,
  hemiSky: '#ffe3b8',
  hemiGround: '#5a3a24',
  divider: 'calle',
  fx: 'rodadores',
  snow: false,
  props: [
    ...PUEBLO_LEFT,
    { m: 'Bld_Jail_01', x: 7.9, z: -6, r: R, s: 0.8 },
    { m: 'Bld_Large_01', x: 6.3, z: 3.5, r: R, s: 0.8 },
    { m: 'Bld_Mexican_01', x: 9.6, z: 11.5, r: R, s: 0.8 },
    { m: 'Prop_Bench_01', x: 6.1, z: -11.8, r: R },
    { m: 'Prop_HitchingPost_01', x: -2.5, z: -14, r: 0 },
    { m: 'Bld_Church_01', x: -3.5, z: -21, s: 0.6 },
    { m: 'Prop_Water_Tower_01', x: 5, z: -17, s: 0.7 },
    { m: 'Veh_Stagecoach_01', x: 1.5, z: -15.2, r: 90, s: 0.8 },
    { m: 'Bld_Outhouse_01', x: -7.8, z: -14.5, s: 0.8 },
  ],
}

const MINA: ScenarioDef = {
  id: 'mina',
  name: 'La mina',
  note: 'Vagonetas, dinamita y la boca de la mina',
  icon: '⛏️',
  field: '#a8906f',
  outside: '#7f6a52',
  sky: '#b89a78',
  fog: [60, 118],
  sun: '#ffe2b8',
  sunIntensity: 1.8,
  hemiSky: '#e8d2b4',
  hemiGround: '#3a2a1c',
  divider: 'rieles-mina',
  fx: 'polvo',
  snow: false,
  props: [
    { m: 'Env_Quarry_Wall_Straight_01', x: -7, z: -18.5, s: 0.9 },
    { m: 'Env_Quarry_Wall_Straight_01', x: 7, z: -18.5, s: 0.9 },
    { m: 'Env_Mine_Entrance_01', x: 0, z: -16.3, s: 1.2 },
    { m: 'Env_Mine_Track_Straight_01', x: 0, z: -14.2 },
    { m: 'Prop_Cart_01', x: 0, z: -14.2, r: 0 },
    { m: 'Env_Quarry_Rocks_01', x: -3.8, z: -14.8, s: 0.9 },
    { m: 'Prop_Tnt_Box', x: 3, z: -14.2, s: 1.4, r: 20 },
    { m: 'Prop_Tnt_Barrel_01', x: 3.8, z: -14.6, s: 1.4 },
    { m: 'Bld_Quarry_Tower_01', x: 9.5, z: -11, s: 0.45 },
    { m: 'Bld_Quarry_Chimney_01', x: -8.5, z: -11, s: 0.9 },
    { m: 'Bld_Quarry_01', x: -8.6, z: -4.5, r: L, s: 0.7 },
    { m: 'Env_Mine_Framing_01', x: -6.4, z: 2, r: L, s: 0.8 },
    { m: 'Prop_Cart_02', x: -6.4, z: 5, r: 10, s: 1.3 },
    { m: 'Prop_Lantern_01', x: -6.1, z: 8, s: 1.6 },
    { m: 'Prop_WoodPile_01', x: -6.5, z: 11, r: L },
    { m: 'Prop_Quarry_Machine_01', x: 7, z: -3, r: R },
    { m: 'Env_Quarry_Rocks_01', x: 7.2, z: 2.5, s: 1.1, r: 60 },
    { m: 'Prop_Tnt_Box', x: 6.3, z: 6, s: 1.4 },
    { m: 'Prop_Lantern_01', x: 6.1, z: 8.5, s: 1.6 },
    { m: 'Prop_Cart_01', x: 6.6, z: 11, r: 90, s: 1.3 },
  ],
}

const NIEVE_LEFT: Placement[] = [
  { m: 'Env_Birch_01', x: -6.8, z: -9, s: 0.75 },
  { m: 'Env_Tree_Tall_01', x: -7.4, z: -4, s: 0.7 },
  { m: 'Bld_Cabin_01', x: -10.4, z: 2.5, r: L, s: 0.75 },
  { m: 'Prop_LogPile_01', x: -6.5, z: 7.5, r: L, s: 0.8 },
  { m: 'Env_TreeStump_01', x: -6.2, z: 10.5, s: 1.2 },
  { m: 'Env_Birch_02', x: -7, z: 12.5, s: 0.7 },
]

const NIEVE: ScenarioDef = {
  id: 'nieve',
  name: 'Paso nevado',
  note: 'Abedules, un fuerte de troncos y la nevada',
  icon: '❄️',
  field: '#eef3f8',
  outside: '#d9e3ec',
  sky: '#cfdbe6',
  fog: [55, 110],
  sun: '#f4f8ff',
  sunIntensity: 1.9,
  hemiSky: '#e8f0ff',
  hemiGround: '#8a98a8',
  divider: 'hielo',
  fx: 'nieve',
  snow: true,
  props: [
    ...NIEVE_LEFT,
    { m: 'Bld_Fort_Tower_01', x: 7.6, z: -8, s: 0.7 },
    { m: 'Bld_Fort_Wall_01', x: 7.3, z: -3.5, r: R, s: 0.8 },
    { m: 'Env_Birch_02', x: 6.8, z: 1, s: 0.8 },
    { m: 'Prop_PikeFence_01', x: 6.2, z: 5, r: R },
    { m: 'Env_RockFlat_01', x: 6.6, z: 8, s: 0.9 },
    { m: 'Env_Tree_Tall_02', x: 7.6, z: 11.5, s: 0.7 },
    { m: 'Env_Tree_Clump_01', x: -5, z: -19, s: 0.7 },
    { m: 'Env_Tree_Clump_01', x: 6, z: -20, s: 0.75, r: 60 },
    { m: 'Prop_Campfire_01', x: 1.5, z: -15, s: 0.5 },
    { m: 'Prop_Barricade_Wood_01', x: -2, z: -14.5, r: 10 },
    { m: 'Env_RockFlat_01', x: 4.5, z: -14.5 },
  ],
}

export const SCENARIOS: ScenarioDef[] = [OESTE, TREN, PUEBLO, MINA, NIEVE]

export function scenarioById(id: string | null | undefined): ScenarioDef {
  return SCENARIOS.find((s) => s.id === id) ?? OESTE
}

/** Uno al azar, distinto del ultimo que se jugo. */
export function nextScenario(last: string | null | undefined): ScenarioDef {
  const pool = SCENARIOS.filter((s) => s.id !== last)
  return pool[Math.floor(Math.random() * pool.length)] ?? OESTE
}

/** Los modelos que usa un escenario (para cargarlos antes de empezar). */
export function modelsOf(scenario: ScenarioDef): string[] {
  const names = new Set(scenario.props.map((p) => p.m))
  if (scenario.fx === 'tren') {
    for (const name of ['Veh_Train_01', 'Veh_Train_Coal_01', 'Veh_Train_Carriage_01', 'Veh_Train_Freight_01']) names.add(name)
  }
  if (scenario.fx === 'rodadores') names.add('Prop_Tumbleweed_01')
  if (scenario.divider === 'vias') names.add('Env_Train_Track_Straight_01')
  if (scenario.divider === 'rieles-mina') names.add('Env_Mine_Track_Straight_01')
  return [...names]
}

