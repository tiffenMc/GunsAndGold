import type { AnimSet } from '../cardConfig'
import { cloneLook } from '../dollParams'
import type { DollLook } from '../dollParams'
import type { BattleCard, CardDef, Rarity, ShotSpec, SpecialKind, WeaponCard, WeaponModel } from './model'
import { cardPower, patternLevelFor } from './model'
import { ASPECTOS } from './aspectos'
import { PATTERNS } from './patterns'
import { crearClases } from './catalogClases'
import { AJUSTES } from '../battle/ajustes'

/**
 * **El catalogo del Oeste**: 30 muñecos de batalla por clase — 10 normales, 10 especiales, 6 epicas y 4 divinas —
 * y, aparte, las armas (que tienen su propia rareza). Cada muñeco pelea a su manera: ver `COMBATE`.
 *
 * Las estadisticas van por escalones, con la escala del juego:
 *   normal   → 2-5 escudos y 60-130 de dano
 *   especial → 3-6 escudos, 80-160 de dano y algo raro (cadencia, alcance, area)
 *   epica    → 5-7 escudos y 80-170 de dano. Aqui van los **tanques**: escudos arriba, resistencia
 *              de piedra y andando como una carreta (GORDOFLOW es el de siempre)
 *   divina   → 6-7 escudos y 180-220 de dano, con alcance largo
 *
 * El **patron** va con la fuerza: cuanto mas tocha es la carta, mas dificil es el dibujo
 * (nivel 1-2 los normales, 2-3 los especiales, 3-4 las epicas y 4 las divinas).
 * Los alcances de las armas van medidos desde la raya, que esta detras de la casa.
 */

const PALETA = [
  '#38bdf8',
  '#f472b6',
  '#4ade80',
  '#fbbf24',
  '#c084fc',
  '#fb7185',
  '#22d3ee',
  '#a3e635',
  '#f59e0b',
  '#94a3b8',
]

/** El id sale del nombre: "EL FEO" → "el-feo". */
function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Cada muñeco usa una de las cinco tandas de animaciones, sacada de su nombre. */
function animsDe(id: string): AnimSet {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100003
  const n = (paso: number) => 1 + ((h >> (paso * 3)) % 5)
  return {
    andar: `andar-${n(0)}`,
    correr: `correr-${n(1)}`,
    disparar: `disparar-${n(2)}`,
    impacto: `impacto-${n(3)}`,
    morir: `morir-${n(4)}`,
  }
}

/** Fila: nombre, escudos, dano, alcance, cadencia (ms), velocidad, patron, cuerpo, resistencia. */
type Fila = [string, number, number, number, number, number, string, Partial<DollLook>?, number?]

/**
 * Los id de antes, para las cartas que los llevaban: el id no se ve (el nombre si), y asi todo lo
 * que busque al sheriff, al forajido o al ranger sigue encontrando su carta.
 */
const ID_DE_ANTES: Record<string, string> = {
  'EL NOVATO': 'sheriff',
  'EL PISTOLAS': 'forajido',
  'LA CUÑADA': 'pistolera',
  'LA GRUÑONA': 'minero',
  'EL TUERTO': 'cazador',
  'EL TARTAMUDO': 'tahur',
  'EL CURA DEL PUEBLO': 'predicador',
  'EL SIETE DEDOS': 'bandolero',
  'EL FLAQUILLO': 'rastreador',
  'EL COLOSO': 'herrero',
  'EL CANTINERO': 'diligenciero',
  'LA LEYENDA DEL RIO': 'ranger',
  'EL ENTERRADOR': 'enterrador',
}

/** Como pelea cada muñeco: su estilo (ver `battle/estilos.ts`) y sus numeros: escudos, daño al fuerte, alcance, cadencia (ms) y velocidad. */
const COMBATE: Record<string, [string, number, number, number, number, number]> = {
  // Normales
  'EL VAQUERO': ['clasico', 3, 100, 4.5, 2000, 1],
  'EL NOVATO': ['poker', 4, 90, 5, 1500, 1.1],
  'LA JIRAFA': ['francotirador', 2, 90, 8, 2900, 1],
  'EL FEO': ['matón', 5, 90, 1.5, 1100, 1],
  'EL PISTOLAS': ['doble', 2, 110, 4.5, 1900, 1.2],
  'DON SIESTA': ['perdigones', 5, 70, 4, 2400, 0.85],
  'LA CUÑADA': ['rebote', 3, 100, 5, 2000, 1.1],
  'LA PANZA': ['blindado', 6, 60, 4, 2600, 0.8],
  'EL FLAQUILLO': ['corredor', 2, 100, 5, 1500, 1.6],
  'PEPE CORTITO': ['kamikaze', 2, 90, 1.5, 1000, 1.5],
  // Especiales
  'LA LADRONA': ['sigilo', 3, 140, 6, 1700, 1.3],
  'EL CURA DEL PUEBLO': ['predicador', 5, 80, 5, 2000, 0.95],
  'LA BAILARINA': ['bailarina', 4, 100, 1.5, 1000, 1.4],
  'EL DOMADOR': ['lazo', 6, 110, 5, 2400, 0.9],
  'LA VENDEDORA DE POCIMAS': ['medico', 4, 60, 5, 2500, 1],
  'EL INDIANO': ['fuego', 5, 130, 5.5, 2400, 1],
  'EL ARISTÓCRATA': ['duelista', 5, 130, 6, 2300, 0.95],
  'EL SOLDADO RENEGADO': ['perfora', 5, 120, 6.5, 2100, 1],
  'LA MONJA PISTOLERA': ['escudera', 4, 80, 5, 2400, 1.1],
  'EL VIDENTE': ['gas', 4, 100, 7, 2600, 0.95],
  // Epicas
  GORDOFLOW: ['tanque', 7, 80, 4, 2800, 0.7],
  'EL CAZARRECOMPENSAS': ['caza', 5, 170, 7.5, 2400, 1.05],
  'LA REINA DEL SALOON': ['reina', 5, 110, 5.5, 2000, 1.05],
  'EL OSO PARDO': ['furia', 7, 110, 1.6, 1200, 0.95],
  'EL DINAMITERO LOCO': ['dinamitero', 4, 180, 6, 3200, 1],
  'EL ESPANTAPÁJAROS': ['emboscada', 5, 150, 5, 2000, 1],
  // Divinas
  'EL CUERVO': ['cuervo', 6, 200, 7, 2200, 1.1],
  'LA MUERTE': ['canon', 7, 220, 7, 3600, 0.95],
  'EL SANTO PISTOLERO': ['santo', 7, 170, 6, 2300, 1],
  'EL TORMENTO': ['minigun', 8, 200, 6, 2600, 0.85],
}

function muneco(rarity: Rarity, fila: Fila, indice: number, idFijo?: string): BattleCard {
  const [name, filaShields, filaDamage, filaRange, filaFireMs, filaSpeed, pattern, look, resistance] = fila
  const [estilo, shields, damage, range, fireMs, speed] = COMBATE[name] ?? ['clasico', filaShields, filaDamage, filaRange, filaFireMs, filaSpeed]
  const id = idFijo ?? ID_DE_ANTES[name] ?? slug(name)
  return {
    kind: 'batalla',
    id,
    name,
    builtin: true,
    rarity,
    accent: PALETA[indice % PALETA.length]!,
    // Lo que trae la fila (cuerpo, colores, arma) + la cara propia de cada carta.
    look: cloneLook({ ...look, ...ASPECTOS[name] }),
    anims: animsDe(id),
    shields,
    resistance: resistance ?? 50,
    damage,
    range,
    fireMs,
    speed,
    pattern,
    estilo,
  }
}

function weapon(
  id: string,
  name: string,
  accent: string,
  model: WeaponModel,
  shot: Partial<ShotSpec>,
  rarity: Rarity = 'normal',
): WeaponCard {
  return {
    kind: 'arma',
    id,
    name,
    builtin: true,
    accent,
    rarity,
    model,
    shot: {
      mode: 'bala',
      range: 15,
      shieldsPerHit: 1,
      pellets: 1,
      spread: 0,
      radius: 0,
      speed: 24,
      ...shot,
    },
  }
}

/** Armas especiales: de un solo uso, hacen su jugada y se gastan. */
function special(id: string, name: string, accent: string, kind: SpecialKind, model: WeaponModel, rarity: Rarity): WeaponCard {
  return {
    ...weapon(id, name, accent, model, { mode: 'explosivo', range: 14, radius: 3, speed: 12 }, rarity),
    special: kind,
    uses: 1,
  }
}

// ---------------------------------------------------------------------------
// NORMALES (24 muñecos + 6 armas). Patron nivel 1-2.
// ---------------------------------------------------------------------------

const NORMALES: Fila[] = [
  ['EL NOVATO', 4, 90, 5, 1500, 1.1, 'uve', { hat: 'vaquero', hatColor: '#8a5a2b', shirt: '#6b7a4a', pants: '#4a3b2a', weapon: 'revolver' }],
  ['LA JIRAFA', 3, 70, 6.5, 2000, 1.15, 'ele', { height: 1.7, fat: 0.55, legLength: 1.5, hat: 'vaquero', hatColor: '#3f4a2f', shirt: '#8a6a3a', skin: '#d99a6c', weapon: 'rifle' }],
  ['EL FEO', 5, 110, 4.5, 1900, 0.95, 'herradura', { fat: 1.2, belly: 0.5, mustache: 2, mustacheStyle: 'morsa', hat: 'vaquero', hatColor: '#4a3423', shirt: '#7a4a2b', skin: '#8d5a34', weapon: 'revolver', extras: ['parche'] }],
  ['EL PISTOLAS', 2, 130, 4, 1400, 1.2, 'zeta', { height: 0.95, hat: 'bombin', hatColor: '#1c1c1c', shirt: '#3a3a44', pants: '#22222a', weapon: 'dos-revolveres' }],
  ['EL TARTAMUDO', 3, 80, 5.5, 2300, 1, 'ese', { mustache: 1, mustacheStyle: 'lapiz', hat: 'vaquero', hatColor: '#5a4a3a', shirt: '#8a8a6a', weapon: 'revolver', extras: ['panuelo'] }],
  ['DON SIESTA', 5, 70, 4, 2400, 0.85, 'triangulo', { fat: 1.35, belly: 0.8, hat: 'sombrero', hatSize: 1.4, hatColor: '#d8c48a', shirt: '#3f6b4a', weapon: 'escopeta', extras: ['poncho'] }],
  ['LA CUÑADA', 3, 100, 5, 1700, 1.1, 'zeta', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#a13d5e', pants: '#4a3a4a', hat: 'vaquero', hatColor: '#6b2f4a', weapon: 'revolver' }],
  ['EL BOCAZAS', 4, 80, 5.5, 2100, 1, 'ele', { mustache: 2.2, mustacheStyle: 'manillar', hat: 'vaquero', hatColor: '#3a2f1f', shirt: '#b06a3a', weapon: 'revolver' }],
  ['LA PANZA', 6, 70, 4.5, 2500, 0.8, 'uve', { fat: 2, belly: 1.1, headSize: 0.9, shirt: '#7a5a2a', pants: '#5a4a2a', weapon: 'escopeta' }, 68],
  ['EL TUERTO', 3, 110, 6, 1600, 1, 'ese', { hat: 'vaquero', hatColor: '#2f3b52', shirt: '#4a5a7a', weapon: 'rifle', extras: ['parche'] }],
  ['DOÑA REGAÑO', 4, 100, 4.5, 1800, 1, 'triangulo', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#6b3f7a', hat: 'vaquero', hatColor: '#4a2f5a', weapon: 'revolver' }],
  ['EL FLAQUILLO', 2, 110, 6.5, 1300, 1.3, 'ele', { fat: 0.6, height: 1.35, legLength: 1.3, skin: '#d8a878', shirt: '#8a8a4a', weapon: 'dos-revolveres' }],
  ['LA SORDA', 4, 80, 5, 2200, 1, 'zeta', { shirt: '#4a6b8a', hat: 'vaquero', hatColor: '#2f4a6b', weapon: 'escopeta' }],
  ['EL CANTINERO', 5, 90, 4, 2000, 0.9, 'herradura', { fat: 1.2, belly: 0.5, mustache: 1.4, mustacheStyle: 'manillar', shirt: '#5a4a3a', pants: '#2f3b52', weapon: 'escopeta', extras: ['panuelo'] }],
  ['PEPE CORTITO', 2, 120, 5, 1200, 1.35, 'uve', { height: 0.7, fat: 0.7, skin: '#c98b52', hat: 'vaquero', hatSize: 0.7, shirt: '#d8c48a', weapon: 'revolver' }],
  ['EL MANCO', 4, 100, 5.5, 1700, 1.05, 'ese', { shirt: '#8a4a2b', hat: 'vaquero', hatColor: '#3a2a1a', weapon: 'rifle', extras: ['parche'] }],
  ['EL DORMILÓN', 5, 60, 5, 2600, 0.9, 'triangulo', { hat: 'bombin', hatSize: 0.9, hatColor: '#4a4a4a', shirt: '#8a8a8a', weapon: 'revolver' }],
  ['LA CHISMOSA', 3, 80, 6, 1900, 1.15, 'ele', { shirt: '#b06a8a', hat: 'vaquero', hatColor: '#7a4a6b', weapon: 'revolver' }],
  ['EL TABERNERO', 6, 90, 4, 2100, 0.85, 'herradura', { fat: 1.5, belly: 0.9, mustache: 1.6, mustacheStyle: 'morsa', shirt: '#3a2a1a', weapon: 'escopeta' }, 62],
  ['EL COJO', 4, 90, 5, 1900, 0.9, 'zeta', { legLength: 0.8, pants: '#4a3423', shirt: '#5a5a4a', weapon: 'revolver' }],
  ['LA BIGOTES', 4, 80, 5.5, 2000, 1.1, 'ese', { mustache: 2.4, mustacheStyle: 'morsa', shirt: '#8a3d3d', hat: 'vaquero', hatColor: '#3a1f1f', weapon: 'rifle' }],
  ['EL ZURRADO', 5, 100, 4.5, 2200, 0.95, 'uve', { shirt: '#5a5a4a', pants: '#3a3a2a', weapon: 'escopeta', extras: ['parche'] }],
  ['LA GRUÑONA', 4, 110, 5, 1700, 1.05, 'herradura', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#6b4a7a', hat: 'vaquero', hatColor: '#4a2f5a', weapon: 'dos-revolveres' }],
]

// ---------------------------------------------------------------------------
// ESPECIALES (16 muñecos + 4 armas). Patron nivel 2-3.
// ---------------------------------------------------------------------------

const ESPECIALES: Fila[] = [
  ['LA LADRONA', 4, 140, 6, 1300, 1.3, 'eme', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#2f2f3d', pants: '#1f1f2a', hat: 'vaquero', hatColor: '#1a1a22', weapon: 'dos-revolveres', extras: ['mascara'] }],
  ['EL ENTERRADOR', 6, 170, 5, 2600, 0.8, 'rayo', { height: 1.4, hat: 'chistera', hatSize: 1.6, hatColor: '#1a1a1a', shirt: '#1f1f1f', pants: '#111111', skin: '#cfd8c8', hair: '#111111', weapon: 'escopeta' }, 68],
  ['LA PITONISA', 4, 130, 7, 1700, 1, 'lazo', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#6b2f7a', hat: 'chistera', hatColor: '#4a1f5a', weapon: 'revolver', extras: ['gafas'] }],
  ['EL CURA DEL PUEBLO', 5, 90, 6, 2000, 0.95, 'ese', { shirt: '#2a2a2a', pants: '#1f1f1f', hat: 'chistera', hatColor: '#16161a', weapon: 'revolver' }],
  ['LA BAILARINA', 4, 120, 6.5, 1200, 1.35, 'eme', { mustache: 0, mustacheStyle: 'ninguno', height: 1.05, shirt: '#c14a6a', pants: '#4a2a3a', weapon: 'dos-revolveres', extras: ['panuelo'] }],
  ['EL DOMADOR', 6, 140, 4.5, 2400, 0.9, 'rayo', { fat: 1.3, mustache: 1.4, shirt: '#8a6a3a', hat: 'sombrero', hatSize: 1.3, hatColor: '#b09a5a', weapon: 'escopeta' }, 65],
  ['LA VENDEDORA DE POCIMAS', 4, 100, 7, 1800, 1, 'triangulo', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#3f8a6a', hat: 'vaquero', hatColor: '#2f6a4a', weapon: 'revolver', extras: ['gafas'] }],
  ['EL INDIANO', 5, 150, 5.5, 1900, 1, 'lazo', { shirt: '#d8c48a', pants: '#4a4a3a', hat: 'bombin', hatColor: '#b09a5a', weapon: 'revolver', extras: ['puro'] }],
  ['LA CONDESA', 4, 140, 6, 1600, 1.1, 'eme', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#7a2f4a', hat: 'sombrero', hatSize: 1.2, hatColor: '#4a1f2f', weapon: 'dos-revolveres' }],
  ['EL ARISTÓCRATA', 5, 130, 6, 1800, 0.95, 'rayo', { shirt: '#4a4a6b', pants: '#2f2f4a', hat: 'chistera', hatSize: 1.2, hatColor: '#2f2f4a', weapon: 'revolver', extras: ['puro'] }],
  ['LA CONTRASTACA', 6, 110, 5, 2500, 0.85, 'lazo', { fat: 1.6, belly: 1, shirt: '#8a4a2b', hat: 'vaquero', hatSize: 1.3, hatColor: '#4a3423', weapon: 'escopeta' }, 66],
  ['EL SOLDADO RENEGADO', 6, 120, 5.5, 2000, 1, 'eme', { shirt: '#2f4a2f', pants: '#1f3a1f', hat: 'vaquero', hatColor: '#1f3a1f', weapon: 'rifle', extras: ['parche'] }],
  ['LA MONJA PISTOLERA', 4, 130, 6, 1500, 1.15, 'ese', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#2a2a3a', hat: 'ninguno', weapon: 'dos-revolveres', extras: ['placa'] }],
  ['EL VIDENTE', 4, 110, 7.5, 2100, 0.95, 'rayo', { shirt: '#5a3f7a', hat: 'chistera', hatColor: '#3a2f5a', weapon: 'revolver', extras: ['gafas'] }],
  ['LA SERRANA', 6, 120, 5.5, 2200, 0.95, 'lazo', { fat: 1.2, shirt: '#6b5a2f', hat: 'sombrero', hatSize: 1.2, hatColor: '#8a7a4a', weapon: 'escopeta' }, 60],
  ['EL BARBERO', 4, 140, 6, 1400, 1.2, 'triangulo', { mustache: 2, mustacheStyle: 'manillar', shirt: '#d8d8d8', pants: '#3a3a3a', weapon: 'dos-revolveres' }],
]

// ---------------------------------------------------------------------------
// EPICAS (8 muñecos + 2 armas). Patron nivel 3-4. Aqui van los tanques.
// ---------------------------------------------------------------------------

const EPICAS: Fila[] = [
  // El tanque de verdad: escudos arriba, resistencia de piedra y andar de carreta.
  ['GORDOFLOW', 7, 80, 4, 2800, 0.7, 'estrella', { fat: 2.4, belly: 1.4, headSize: 0.9, legLength: 0.75, mustache: 2.4, mustacheStyle: 'morsa', shirt: '#a13d3d', pants: '#5a3a2a', hat: 'sombrero', hatSize: 1.4, hatColor: '#4a3423', weapon: 'escopeta' }, 88],
  ['EL SIETE DEDOS', 5, 160, 6.5, 1500, 1.15, 'rayo', { shirt: '#3a2f4a', hat: 'vaquero', hatColor: '#2a1f3a', weapon: 'dos-revolveres', extras: ['mascara'] }],
  ['LA SERPIENTE', 5, 150, 7, 1400, 1.25, 'lazo', { mustache: 0, mustacheStyle: 'ninguno', height: 1.2, shirt: '#2f6b4a', hat: 'vaquero', hatColor: '#1f4a2f', weapon: 'dos-revolveres' }],
  ['EL COLOSO', 7, 120, 4.5, 2600, 0.75, 'estrella', { height: 1.6, fat: 2, armLength: 1.4, shirt: '#5a4a3a', pants: '#3a2f22', weapon: 'escopeta' }, 82],
  ['EL CAZARRECOMPENSAS', 5, 170, 7.5, 1700, 1.05, 'espiral', { shirt: '#4a3f2f', hat: 'sombrero', hatSize: 1.3, hatColor: '#3a2f1f', weapon: 'rifle', extras: ['placa'] }],
  ['LA REINA DEL SALOON', 5, 160, 6, 1600, 1.1, 'espiral', { mustache: 0, mustacheStyle: 'ninguno', shirt: '#7a2f5a', hat: 'sombrero', hatSize: 1.2, hatColor: '#4a1f3a', weapon: 'dos-revolveres' }],
  ['EL OSO PARDO', 7, 110, 5, 2500, 0.8, 'estrella', { height: 1.7, fat: 2.2, beard: 1.6, shirt: '#6b4a2f', hat: 'ninguno', weapon: 'escopeta' }, 78],
  ['LA MAESTRA DE ESGRIMA', 5, 150, 7, 1500, 1.2, 'rayo', { mustache: 0, mustacheStyle: 'ninguno', height: 1.15, shirt: '#3f3f6b', pants: '#2a2a4a', hat: 'sombrero', hatSize: 1.1, hatColor: '#2a2a4a', weapon: 'rifle' }],
  ['EL DINAMITERO LOCO', 4, 180, 6, 3200, 1, 'espiral', { height: 0.95, fat: 1.1, shirt: '#8a3d2b', pants: '#3a2a1a', hat: 'ninguno', weapon: 'dinamita', extras: ['puro'] }],
  ['EL ESPANTAPÁJAROS', 5, 150, 5, 2000, 1, 'rayo', { height: 1.45, fat: 0.55, legLength: 1.3, shirt: '#6b5a2f', pants: '#4a3f22', hat: 'sombrero', hatSize: 1.5, hatColor: '#8a7a4a', weapon: 'revolver', extras: ['poncho'] }],
]

// ---------------------------------------------------------------------------
// DIVINAS (4 muñecos + 2 armas). Patron nivel 4.
// ---------------------------------------------------------------------------

const DIVINAS: Fila[] = [
  ['EL CUERVO', 6, 200, 7, 1500, 1.15, 'infinito', { height: 1.4, fat: 0.75, hat: 'chistera', hatSize: 1.5, hatColor: '#101018', shirt: '#1f1f2a', pants: '#12121a', hair: '#0a0a0a', mustache: 2, weapon: 'dos-revolveres', extras: ['poncho'] }, 72],
  ['LA MUERTE', 7, 220, 6, 1900, 1, 'cascabel', { height: 1.5, fat: 0.6, skin: '#d8d8d8', hair: '#111111', mustache: 0, mustacheStyle: 'ninguno', shirt: '#2a2a2a', pants: '#111111', hat: 'chistera', hatSize: 1.6, hatColor: '#0a0a0a', weapon: 'escopeta' }, 75],
  ['EL SANTO PISTOLERO', 7, 180, 7.5, 1600, 1.05, 'espiral', { shirt: '#d8c48a', pants: '#4a3f2a', hat: 'sombrero', hatSize: 1.35, hatColor: '#b09a5a', weapon: 'revolver', extras: ['placa', 'panuelo'] }, 70],
  ['LA LEYENDA DEL RIO', 6, 190, 6.5, 1800, 1.1, 'estrella', { height: 1.25, shirt: '#2f7a8a', pants: '#1f5a6b', hat: 'vaquero', hatSize: 1.2, hatColor: '#1f5a6b', weapon: 'rifle', extras: ['panuelo'] }, 68],
  ['EL TORMENTO', 8, 200, 6, 2600, 0.85, 'infinito', { height: 1.3, fat: 1.8, belly: 0.8, armLength: 1.3, shirt: '#2f2f2f', pants: '#3a2f22', hat: 'ninguno', weapon: 'escopeta', extras: ['panuelo'] }, 80],
]

export const BUILTIN_BATTLE: BattleCard[] = [
  // El vaquero de siempre se queda: es el retrato por defecto de medio pueblo.
  muneco(
    'normal',
    [
      'EL VAQUERO',
      3,
      100,
      4.5,
      2000,
      1,
      'herradura',
      { shirt: '#2f689d', pants: '#3d5a80', hat: 'vaquero', hatColor: '#8a5a2b', mustache: 1, mustacheStyle: 'manillar', weapon: 'revolver', extras: ['panuelo'] },
    ],
    0,
    'vaquero',
  ),
  ...NORMALES.filter((fila) => fila[0] in COMBATE).map((fila, i) => muneco('normal', fila, i + 1)),
  ...ESPECIALES.filter((fila) => fila[0] in COMBATE).map((fila, i) => muneco('especial', fila, i)),
  ...EPICAS.filter((fila) => fila[0] in COMBATE).map((fila, i) => muneco('epica', fila, i)),
  ...DIVINAS.filter((fila) => fila[0] in COMBATE).map((fila, i) => muneco('divina', fila, i)),
]

// Las otras dos clases (indios y vikingos): mismos estilos de pelea, otro mundo.
const CLASES_EXTRA = crearClases([...BUILTIN_BATTLE])
BUILTIN_BATTLE.push(...CLASES_EXTRA.battle)

/** Los escudos y la cadencia de cada carta antes del ajuste de equilibrio (de aqui parte el ajuste). */
export const SIN_AJUSTE: Record<string, { shields: number; fireMs: number }> = Object.fromEntries(
  BUILTIN_BATTLE.map((c) => [c.id, { shields: c.shields, fireMs: c.fireMs }]),
)

// El equilibrio (ver `battle/ajustes.ts`): los escudos y la cadencia de cada carta, ajustados a base de simular.
for (const carta of BUILTIN_BATTLE) {
  const escudos = AJUSTES[carta.id]?.escudos
  if (escudos) carta.shields = Math.max(2, Math.min(10, Math.round(carta.shields * escudos)))
  const cadencia = AJUSTES[carta.id]?.cadencia
  if (cadencia) carta.fireMs = Math.round(carta.fireMs * cadencia)
}

/**
 * El **patron** no se elige a mano: sale de la fuerza de la carta, que es lo que manda el juego.
 * Asi una divina nunca lleva un dibujo facil y un novato no lleva el infinito.
 */
for (const [indice, carta] of BUILTIN_BATTLE.entries()) {
  const nivel = patternLevelFor(cardPower(carta))
  const opciones = PATTERNS.filter((patron) => patron.level === nivel)
  if (opciones.length > 0) carta.pattern = opciones[indice % opciones.length]!.id
}

export const BUILTIN_WEAPONS: WeaponCard[] = [
  // --- Normales ---
  weapon('revolver', 'REVÓLVER DE FERIA', '#fbbf24', 'revolver', { mode: 'bala', range: 15, shieldsPerHit: 2, speed: 24 }),
  weapon('escopeta', 'ESCOPETA DEL ABUELO', '#f97316', 'escopeta', { mode: 'perdigones', range: 11, shieldsPerHit: 1, pellets: 5, spread: 34, speed: 20 }),
  weapon('rifle', 'RIFLE MOCHO', '#60a5fa', 'rifle', { mode: 'perforante', range: 20, shieldsPerHit: 1, speed: 30 }),
  weapon('dinamita', 'DINAMITA DE CANTERA', '#ef4444', 'dinamita', { mode: 'explosivo', range: 15, shieldsPerHit: 1, radius: 2.6, speed: 12 }),
  weapon('derringer', 'DERRINGER DE FALDRIQUERA', '#c084fc', 'revolver', { mode: 'bala', range: 12, shieldsPerHit: 3, speed: 28 }),
  weapon('trabuco', 'TRABUCO CASCADO', '#a3e635', 'escopeta', { mode: 'perdigones', range: 10, shieldsPerHit: 2, pellets: 4, spread: 38, speed: 18 }),

  // --- Especiales ---
  weapon('gatling', 'AMETRALLADORA OXIDADA', '#22d3ee', 'gatling', { mode: 'rafaga', range: 16, shieldsPerHit: 1, pellets: 6, speed: 26 }, 'especial'),
  weapon('postas', 'ESCOPETA DE POSTAS', '#fb7185', 'escopeta', { mode: 'perdigones', range: 13, shieldsPerHit: 1, pellets: 7, spread: 30, speed: 22 }, 'especial'),
  weapon('repeticion', 'RIFLE DE REPETICIÓN', '#4ade80', 'rifle', { mode: 'rafaga', range: 18, shieldsPerHit: 2, pellets: 3, speed: 32 }, 'especial'),
  special('humo', 'GRANADA DE HUMO', '#94a3b8', 'humo', 'granada', 'especial'),

  // --- Epicas ---
  weapon('bufalo', 'RIFLE BÚFALO', '#a78bfa', 'rifle-pesado', { mode: 'bala', range: 19, shieldsPerHit: 3, speed: 26 }, 'epica'),
  special('rayo', 'LA TORMENTA', '#fde047', 'rayo', 'tormenta', 'epica'),

  // --- Divinas ---
  weapon('canon-del-desierto', 'EL CAÑÓN DEL DESIERTO', '#38bdf8', 'rifle-pesado', { mode: 'explosivo', range: 21, shieldsPerHit: 4, radius: 3.4, speed: 24 }, 'divina'),
  special('tunel', 'EL TÚNEL DEL DIABLO', '#f472b6', 'tunel', 'pico', 'divina'),
]

BUILTIN_WEAPONS.push(...CLASES_EXTRA.weapons)

export const BUILTIN_CARDS: CardDef[] = [...BUILTIN_BATTLE, ...BUILTIN_WEAPONS]
