import type { AnimSet } from '../cardConfig'
import { cloneLook } from '../dollParams'
import type { DollLook, Extra, GunStyle, HairStyle, HatStyle } from '../dollParams'
import type { BattleCard, ClaseId, Rarity, ShotSpec, SpecialKind, WeaponCard, WeaponModel } from './model'

/**
 * **Indios y vikingos.** Cada clase trae lo suyo: 50 muñecos de batalla (20 normales, 15 especiales,
 * 10 epicas y 5 divinas) y 14 armas. Cada muñeco de una clase pelea con el mismo estilo que tiene
 * su "hermano" vaquero (minigun, rebote, medico…), pero con otro nombre, otra cara, otras armas y
 * otro tono: los indios son mas ligeros y rapidos, los vikingos mas duros y lentos.
 *
 * Las caras salen de un generador que reparte rasgos segun el nombre: no hay dos iguales.
 */

const PALETA = ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#c084fc', '#fb7185', '#22d3ee', '#a3e635', '#f59e0b', '#94a3b8']

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

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

/** Un numero repetible a partir de un texto: asi cada nombre siempre tiene la misma cara. */
function hash(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Elige uno de la lista segun el hash y un "salto" distinto para cada rasgo. */
function elige<T>(lista: readonly T[], h: number, salto: number): T {
  return lista[Math.floor(((h >>> salto) ^ Math.imul(h, salto + 7)) >>> 0) % lista.length]!
}

function rango(h: number, salto: number, min: number, max: number): number {
  const u = (((h >>> salto) ^ Math.imul(h, 2654435761 + salto)) >>> 0) / 4294967296
  return Math.round((min + u * (max - min)) * 100) / 100
}

// ---------------------------------------------------------------------------
// Que estilos pegan de cerca, cuales llevan explosivos…
// ---------------------------------------------------------------------------

const CUERPO = new Set(['matón', 'bailarina', 'coloso', 'furia', 'estocada', 'kamikaze'])
const EXPLOSIVO = new Set(['dinamitero', 'canon', 'barril', 'kamikaze', 'fuego', 'tumba'])
const GRANDES = new Set(['tanque', 'coloso', 'furia', 'minigun', 'matón', 'blindado', 'murallaCebo', 'canon'])
const PEQUENOS = new Set(['corredor', 'kamikaze', 'bailarina', 'sigilo', 'cuchillos'])

// ---------------------------------------------------------------------------
// Los nombres de cada clase, uno por estilo
// ---------------------------------------------------------------------------

const INDIOS: Record<string, string> = {
  clasico: 'PIE LIGERO',
  poker: 'EL JUGADOR DE HUESOS',
  francotirador: 'OJO DE ÁGUILA',
  matón: 'CUERNO DE BÚFALO',
  doble: 'DOS FLECHAS',
  rafaga: 'LLUVIA MENUDA',
  perdigones: 'SOPLADOR DE DARDOS',
  rebote: 'FLECHA SALTARINA',
  cebo: 'VOZ DE TRUENO',
  blindado: 'PIEL DE ROCA',
  cerrojo: 'FLECHA CERTERA',
  regano: 'ABUELA CUERVO',
  corredor: 'VIENTO VELOZ',
  escopetazo: 'HONDERO ATRONADOR',
  cantinero: 'TAMBORILERO',
  kamikaze: 'GUERRERO DE FUEGO',
  cuchillos: 'CUCHILLO DE OBSIDIANA',
  cepos: 'TRAMPERO SILENCIOSO',
  abanderado: 'PORTAESTANDARTE',
  barril: 'HOMBRE CALABAZA',
  sigilo: 'SOMBRA QUE CAMINA',
  tumba: 'DANZA DE LA TIERRA',
  rebotaLargo: 'FLECHA DEL ESPÍRITU',
  predicador: 'CHAMÁN DE LA CALMA',
  bailarina: 'DANZANTE DEL SOL',
  lazo: 'DOMADOR DE MUSTANGS',
  medico: 'LA CURANDERA',
  fuego: 'FUEGO DE GUERRA',
  rafagaLarga: 'TORMENTA DE FLECHAS',
  duelista: 'RETADOR DEL RÍO',
  murallaCebo: 'GUARDIÁN DEL TÓTEM',
  perfora: 'LANZA DEL VALLE',
  escudera: 'MADRE DEL ESCUDO',
  gas: 'HUMO SAGRADO',
  circulo: 'CÍRCULO DE GUERRA',
  tanque: 'GRAN BÚFALO',
  fusileria: 'CAZADOR DE MIL FLECHAS',
  veneno: 'HIJA DE LA VÍBORA',
  coloso: 'GIGANTE DE LA MONTAÑA',
  caza: 'CAZADOR DE PIELES',
  reina: 'GRAN MADRE BISONTE',
  furia: 'OSO ENFURECIDO',
  estocada: 'LANZA DANZANTE',
  dinamitero: 'TRONADOR DEL CAÑÓN',
  emboscada: 'FANTASMA DEL CAÑÓN',
  cuervo: 'GRAN CUERVO BLANCO',
  canon: 'ESPÍRITU DEL TRUENO',
  santo: 'GRAN CHAMÁN SANADOR',
  legendario: 'EL ARCO DEL AMANECER',
  minigun: 'LLUVIA DE MIL FLECHAS',
}

const VIKINGOS: Record<string, string> = {
  clasico: 'BJORN EL JOVEN',
  poker: 'DADOS DE ODÍN',
  francotirador: 'ARQUERO DEL FIORDO',
  matón: 'ROMPEHUESOS',
  doble: 'DOBLE HACHA',
  rafaga: 'TRÍO DE JABALINAS',
  perdigones: 'LANZADOR DE GUIJARROS',
  rebote: 'HACHA BUMERÁN',
  cebo: 'CUERNO DE GUERRA',
  blindado: 'MURO DE ESCUDOS',
  cerrojo: 'JABALINA PESADA',
  regano: 'ESCALDO GRITÓN',
  corredor: 'ESQUIADOR DEL NORTE',
  escopetazo: 'MARTILLAZO DE TROLL',
  cantinero: 'TABERNERO DE HIDROMIEL',
  kamikaze: 'FANÁTICO DEL FUEGO',
  cuchillos: 'CUCHILLERO DE HIELO',
  cepos: 'TRAMPERO DEL FIORDO',
  abanderado: 'PORTAESTANDARTE DEL DRAGÓN',
  barril: 'BARRIL DE HIDROMIEL',
  sigilo: 'SOMBRA DE NIEBLA',
  tumba: 'CAVATUMBAS',
  rebotaLargo: 'RUNA SALTARINA',
  predicador: 'ESCALDO DE LA TORMENTA',
  bailarina: 'VALQUIRIA DANZANTE',
  lazo: 'PESCADOR DE HOMBRES',
  medico: 'CURANDERA DE RUNAS',
  fuego: 'BREA ARDIENTE',
  rafagaLarga: 'LLUVIA DE JABALINAS',
  duelista: 'DUELISTA DEL HOLMGANG',
  murallaCebo: 'GUARDIA DEL JARL',
  perfora: 'LANZA ATRAVESADORA',
  escudera: 'DONCELLA DEL ESCUDO',
  gas: 'NIEBLA DE HEL',
  circulo: 'CÍRCULO DE RUNAS',
  tanque: 'JARL MONTAÑA',
  fusileria: 'LANZADOR DE SEIS',
  veneno: 'HIJA DE JÖRMUNGANDR',
  coloso: 'GIGANTE DE HIELO',
  caza: 'CAZADOR DE DRAGONES',
  reina: 'REINA DE LOS FIORDOS',
  furia: 'BERSERKER OSO',
  estocada: 'MAESTRA DE LA LANZA',
  dinamitero: 'LANZADOR DE BREA',
  emboscada: 'EL DRAUGR',
  cuervo: 'EL CUERVO DE ODÍN',
  canon: 'EL MARTILLO DE THOR',
  santo: 'FRIGG LA SANADORA',
  legendario: 'LA LANZA DE ODÍN',
  minigun: 'LLUVIA DE HACHAS',
}

// ---------------------------------------------------------------------------
// Aspecto: cara, pelo, ropa y armas, repartidos por el nombre
// ---------------------------------------------------------------------------

const ROPA_INDIO = ['#b5651d', '#8a5a2b', '#c0845a', '#7a4a2a', '#a0522d', '#d9a066', '#6b4a2f']
const PANTALON_INDIO = ['#6b4423', '#8a6a43', '#4a3423', '#a1773f']
const ROPA_VIKINGO = ['#3f5a7a', '#6b2f2f', '#4a6b4a', '#7a6a4a', '#2f4a6b', '#8a4a2b', '#5a5a6b']
const PANTALON_VIKINGO = ['#4a3f2a', '#3a3a44', '#5a4a3a', '#2f3b52']
const PIEL_INDIO = ['#c68642', '#b8763a', '#a0622d', '#8d5524', '#c98b52', '#d99a6c']
const PIEL_VIKINGO = ['#f6dcc3', '#f1c27d', '#e8b890', '#f4d2b0', '#e0937a']
const PELO_INDIO = ['#111111', '#1a1008', '#2b1a10', '#3a2416']
const PELO_VIKINGO = ['#e8c170', '#b23a1a', '#d2691e', '#4a2c17', '#ececec', '#9a9a9a']
const PELOS_INDIO: HairStyle[] = ['melena', 'trenzas', 'coleta', 'tupe']
const PELOS_VIKINGO: HairStyle[] = ['melena', 'trenzas', 'coleta', 'corto', 'tupe']
const OJOS = ['normal', 'furioso', 'siniestro', 'asustado', 'bizco', 'punto'] as const
const BOCAS = ['sonrisa', 'seria', 'mueca', 'dientes', 'diente-oro', 'boquiabierto'] as const
const ROPAS = ['chaleco', 'tirantes', 'bandolera', 'rayas', 'abrigo', 'liso'] as const

function armaDe(clase: ClaseId, estilo: string, h: number): GunStyle {
  if (EXPLOSIVO.has(estilo) && estilo !== 'fuego' && estilo !== 'tumba') return 'dinamita'
  if (clase === 'indios') {
    if (CUERPO.has(estilo)) return elige<GunStyle>(['hacha', 'lanza'], h, 3)
    if (estilo === 'perfora' || estilo === 'legendario') return 'lanza'
    return 'arco'
  }
  // vikingos
  if (estilo === 'coloso' || estilo === 'canon' || estilo === 'furia') return 'martillo'
  if (CUERPO.has(estilo)) return elige<GunStyle>(['hacha', 'martillo', 'hacha'], h, 3)
  if (estilo === 'francotirador' || estilo === 'cerrojo' || estilo === 'caza') return 'arco'
  return elige<GunStyle>(['lanza', 'hacha', 'lanza'], h, 3)
}

function aspectoDe(clase: ClaseId, name: string, estilo: string, rarity: Rarity): Partial<DollLook> {
  const h = hash(`${clase}|${name}`)
  const indio = clase === 'indios'
  const grande = GRANDES.has(estilo)
  const pequeno = PEQUENOS.has(estilo)
  const rara = rarity === 'epica' || rarity === 'divina'
  const sombreros: HatStyle[] = indio
    ? rara
      ? ['plumas', 'plumas', 'cinta']
      : ['cinta', 'cinta', 'ninguno', 'plumas']
    : rara
      ? ['cuernos', 'cuernos', 'casco']
      : ['casco', 'cuernos', 'gorro', 'ninguno', 'casco']
  const extras: Extra[] = indio ? ['pintura'] : []
  if (indio) {
    if (h % 3 === 0) extras.push('pendiente')
    if (h % 5 === 0) extras.push('poncho')
    if (h % 7 === 0) extras.push('cicatriz')
  } else {
    if (h % 2 === 0) extras.push('piel')
    if (h % 3 === 0) extras.push('cicatriz')
    if (h % 5 === 0) extras.push('pendiente')
    if (h % 7 === 0) extras.push('parche')
  }
  const hatColor = indio ? elige(['#c0392b', '#2e86ab', '#e8c14a', '#3f8a5a', '#f4efe2'], h, 5) : elige(['#7b8794', '#8a949f', '#5d6773', '#6b4423'], h, 5)
  return {
    hat: elige(sombreros, h, 2),
    hatColor,
    hatSize: grande ? 1.15 : pequeno ? 0.9 : 1,
    skin: elige(indio ? PIEL_INDIO : PIEL_VIKINGO, h, 4),
    hair: elige(indio ? PELO_INDIO : PELO_VIKINGO, h, 6),
    hairStyle: elige(indio ? PELOS_INDIO : PELOS_VIKINGO, h, 8),
    eyes: elige(OJOS, h, 10),
    mouth: elige(BOCAS, h, 12),
    headWidth: rango(h, 14, 0.82, 1.3),
    jaw: rango(h, 16, 0.2, 1),
    earSize: rango(h, 18, 0.7, 1.6),
    noseSize: rango(h, 20, 0.6, 2),
    eyeSize: rango(h, 22, 0.9, 1.4),
    eyebrows: rango(h, 24, 0.7, 2.2),
    headSize: rango(h, 26, 0.9, 1.15) * (grande ? 1.05 : 1),
    // Los vikingos, con barbas de verdad; los indios, sin vello.
    beard: indio ? 0 : rango(h, 28, 0.9, 2.4),
    mustache: indio ? 0 : rango(h, 30, 0.8, 2),
    mustacheStyle: indio ? 'ninguno' : elige(['morsa', 'manillar', 'fumanchu'] as const, h, 9),
    outfit: elige(ROPAS, h, 11),
    outfitColor: indio ? elige(['#c0392b', '#2e86ab', '#e8c14a', '#3f8a5a'], h, 13) : elige(['#3a2a1a', '#5a3a1a', '#6b2f2f', '#2f3b52'], h, 13),
    shirt: elige(indio ? ROPA_INDIO : ROPA_VIKINGO, h, 15),
    pants: elige(indio ? PANTALON_INDIO : PANTALON_VIKINGO, h, 17),
    weapon: armaDe(clase, estilo, h),
    extras,
    height: grande ? rango(h, 1, 1.2, 1.45) : pequeno ? rango(h, 1, 0.75, 0.95) : rango(h, 1, 0.95, 1.15),
    fat: grande ? rango(h, 3, 1.6, 2.2) : pequeno ? rango(h, 3, 0.6, 0.85) : rango(h, 3, 0.8, 1.4),
  }
}

// ---------------------------------------------------------------------------
// Muñecos
// ---------------------------------------------------------------------------

/**
 * Lo que cambia cada clase respecto al vaquero con el mismo estilo:
 *  - **vikingos**: todos pegan de cerca, corren bastante mas y aguantan mas escudos;
 *  - **indios**: algo mas rapidos, con mas alcance y menos aguante.
 */
function sabor(clase: ClaseId, base: BattleCard): Pick<BattleCard, 'shields' | 'range' | 'speed' | 'resistance' | 'fireMs'> {
  const estiloBase = base.estilo ?? 'clasico'
  if (clase === 'indios') {
    const cuerpo = CUERPO.has(estiloBase)
    return {
      shields: Math.max(2, base.shields - 1),
      range: cuerpo ? base.range : Math.round((base.range + 0.3) * 10) / 10,
      speed: base.speed,
      resistance: Math.max(0, base.resistance - 8),
      fireMs: base.fireMs,
    }
  }
  // Vikingos: el alcance es el de su arma (hacha 1.8 m, lanza 2.4 m); los de apoyo no pegan, asi que mantienen el suyo.
  const apoyo = estiloBase === 'medico' || estiloBase === 'escudera' || estiloBase === 'sanadora'
  const largo = estiloBase === 'francotirador' || estiloBase === 'perfora' || estiloBase === 'estocada' || estiloBase === 'legendario' || estiloBase === 'cerrojo'
  return {
    shields: Math.min(10, base.shields + 1),
    range: apoyo ? base.range : largo ? 2.5 : 1.8,
    speed: Math.min(2, Math.round(base.speed * 1.42 * 100) / 100),
    resistance: Math.min(95, base.resistance + 8),
    // Pegar de cerca es mas rapido que disparar de lejos.
    fireMs: Math.max(600, Math.round(base.fireMs * 0.65)),
  }
}

/** La animacion de ataque de cada carta: los vikingos golpean (hachazo, martillazo, barrido…) y los indios tensan el arco o lanzan. */
function ataqueDe(clase: ClaseId, estilo: string, arma: GunStyle | undefined, h: number): string {
  if (clase === 'vikingos') {
    if (arma === 'martillo') return 'golpe-2'
    if (arma === 'lanza') return 'golpe-5'
    if (estilo === 'blindado' || estilo === 'murallaCebo' || estilo === 'tanque' || estilo === 'matón') return 'golpe-4'
    if (estilo === 'perdigones' || estilo === 'escopetazo' || estilo === 'bailarina' || estilo === 'minigun') return 'golpe-3'
    return elige(['golpe-1', 'golpe-3', 'golpe-1'], h, 21)
  }
  if (arma === 'lanza' || arma === 'hacha' || arma === 'dinamita') return 'flecha-5'
  return elige(['flecha-1', 'flecha-2', 'flecha-3', 'flecha-4'], h, 21)
}

/**
 * **La rareza cambia de una clase a otra.** La misma habilidad que en los vaqueros es de una carta
 * normal, en los indios la lleva una epica y en los vikingos una divina (y asi con todas, rotando):
 * nadie tiene todas las habilidades de golpe, y cada clase las consigue en otro orden. Se rota
 * sobre la lista entera, asi que cada clase sigue teniendo 10 normales, 10 especiales, 6 epicas y 4 divinas.
 */
const ROTACION: Record<Exclude<ClaseId, 'vaqueros'>, number> = { indios: 20, vikingos: 26 }

/** Lo fuerte que es cada rareza: al cambiar de rareza, escudos y daño se ajustan en proporcion. */
const FUERZA_DE_RAREZA: Record<Rarity, number> = { normal: 1, especial: 1.15, epica: 1.35, divina: 1.6 }

export function rarezaEnClase(clase: Exclude<ClaseId, 'vaqueros'>, indice: number, base: BattleCard[]): Rarity {
  return base[(indice + ROTACION[clase]) % base.length]?.rarity ?? 'normal'
}

function crearMunecos(clase: Exclude<ClaseId, 'vaqueros'>, nombres: Record<string, string>, base: BattleCard[]): BattleCard[] {
  return base.map((origen, indice) => {
    const estilo = origen.estilo ?? 'clasico'
    const name = nombres[estilo]
    if (!name) throw new Error(`Falta el nombre de ${clase} para el estilo ${estilo}`)
    const id = slug(name)
    const rarity = rarezaEnClase(clase, indice, base)
    // Lo que sube (o baja) al cambiar de rareza respecto a su hermano vaquero.
    const escala = FUERZA_DE_RAREZA[rarity] / FUERZA_DE_RAREZA[origen.rarity ?? 'normal']
    const extra = sabor(clase, origen)
    const aspecto = aspectoDe(clase, name, estilo, rarity)
    const anims = animsDe(id)
    anims.disparar = ataqueDe(clase, estilo, aspecto.weapon, hash(name))
    return {
      kind: 'batalla',
      id,
      name,
      builtin: true,
      rarity,
      clase,
      estilo: `${clase === 'indios' ? 'i' : 'v'}:${estilo}`,
      accent: PALETA[indice % PALETA.length]!,
      look: cloneLook(aspecto),
      anims,
      shields: Math.max(2, Math.min(10, Math.round(extra.shields * escala))),
      resistance: extra.resistance,
      damage: Math.round(origen.damage * escala),
      range: extra.range,
      fireMs: extra.fireMs,
      speed: extra.speed,
      pattern: origen.pattern,
    }
  })
}

// ---------------------------------------------------------------------------
// Armas
// ---------------------------------------------------------------------------

function arma(
  clase: ClaseId,
  id: string,
  name: string,
  accent: string,
  model: WeaponModel,
  shot: Partial<ShotSpec>,
  rarity: Rarity,
): WeaponCard {
  return {
    kind: 'arma',
    id,
    name,
    builtin: true,
    accent,
    rarity,
    clase,
    model,
    shot: { mode: 'bala', range: 15, shieldsPerHit: 1, pellets: 1, spread: 0, radius: 0, speed: 24, ...shot },
  }
}

function especial(clase: ClaseId, id: string, name: string, accent: string, kind: SpecialKind, model: WeaponModel, rarity: Rarity): WeaponCard {
  return {
    ...arma(clase, id, name, accent, model, { mode: 'explosivo', range: 14, radius: 3, speed: 12 }, rarity),
    special: kind,
    uses: 1,
  }
}

function armasIndios(): WeaponCard[] {
  const c = 'indios'
  return [
    arma(c, 'arco-corto', 'ARCO CORTO', '#fbbf24', 'arco', { mode: 'bala', range: 15, shieldsPerHit: 2, speed: 24 }, 'normal'),
    arma(c, 'arco-de-caza', 'ARCO DE CAZA', '#60a5fa', 'arco', { mode: 'perforante', range: 20, shieldsPerHit: 1, speed: 30 }, 'normal'),
    arma(c, 'tomahawk', 'TOMAHAWK', '#ef4444', 'hacha', { mode: 'bala', range: 12, shieldsPerHit: 3, speed: 22 }, 'normal'),
    arma(c, 'lanza-arrojadiza', 'LANZA ARROJADIZA', '#a3e635', 'lanza', { mode: 'perforante', range: 17, shieldsPerHit: 2, speed: 26 }, 'normal'),
    arma(c, 'cerbatana', 'CERBATANA DE DARDOS', '#f97316', 'lanza', { mode: 'perdigones', range: 10, shieldsPerHit: 2, pellets: 4, spread: 38, speed: 18 }, 'normal'),
    arma(c, 'catapulta', 'CATAPULTA', '#fb7185', 'catapulta', { mode: 'explosivo', range: 15, shieldsPerHit: 2, radius: 2.8, speed: 16, mecha: 0 }, 'normal'),
    arma(c, 'lluvia-de-flechas', 'LLUVIA DE FLECHAS', '#22d3ee', 'arco', { mode: 'rafaga', range: 16, shieldsPerHit: 1, pellets: 6, speed: 26 }, 'especial'),
    arma(c, 'flechas-dobles', 'FLECHAS DOBLES', '#c084fc', 'arco', { mode: 'perdigones', range: 13, shieldsPerHit: 1, pellets: 7, spread: 30, speed: 22 }, 'especial'),
    arma(c, 'arco-compuesto', 'ARCO COMPUESTO', '#4ade80', 'arco', { mode: 'rafaga', range: 18, shieldsPerHit: 2, pellets: 3, speed: 32 }, 'especial'),
    especial(c, 'humo-de-senales', 'HUMO DE SEÑALES', '#94a3b8', 'humo', 'granada', 'especial'),
    arma(c, 'arco-del-jefe', 'ARCO DEL GRAN JEFE', '#a78bfa', 'arco', { mode: 'bala', range: 19, shieldsPerHit: 3, speed: 26 }, 'epica'),
    especial(c, 'danza-de-la-lluvia', 'DANZA DE LA LLUVIA', '#fde047', 'rayo', 'tormenta', 'epica'),
    arma(c, 'arco-del-sol', 'EL ARCO DEL SOL', '#38bdf8', 'arco', { mode: 'explosivo', range: 21, shieldsPerHit: 4, radius: 3.4, speed: 26, mecha: 0 }, 'divina'),
    especial(c, 'camino-de-espiritus', 'EL CAMINO DE LOS ESPÍRITUS', '#f472b6', 'tunel', 'pico', 'divina'),
  ]
}

function armasVikingos(): WeaponCard[] {
  const c = 'vikingos'
  return [
    arma(c, 'hacha-arrojadiza', 'HACHA ARROJADIZA', '#fbbf24', 'hacha', { mode: 'bala', range: 15, shieldsPerHit: 2, speed: 24 }, 'normal'),
    arma(c, 'lanza-larga', 'LANZA LARGA', '#60a5fa', 'lanza', { mode: 'perforante', range: 20, shieldsPerHit: 1, speed: 30 }, 'normal'),
    arma(c, 'martillo-de-guerra', 'MARTILLO DE GUERRA', '#ef4444', 'martillo', { mode: 'bala', range: 12, shieldsPerHit: 3, speed: 22 }, 'normal'),
    arma(c, 'jabalinas', 'JABALINAS', '#a3e635', 'lanza', { mode: 'perdigones', range: 11, shieldsPerHit: 1, pellets: 5, spread: 34, speed: 20 }, 'normal'),
    arma(c, 'cuchillo-de-hielo', 'CUCHILLO DE HIELO', '#c084fc', 'hacha', { mode: 'bala', range: 12, shieldsPerHit: 3, speed: 28 }, 'normal'),
    arma(c, 'canonazo', 'CAÑONAZO', '#fb7185', 'canon', { mode: 'explosivo', range: 15, shieldsPerHit: 2, radius: 2.8, speed: 13, mecha: 1000 }, 'normal'),
    arma(c, 'hachas-gemelas', 'HACHAS GEMELAS', '#22d3ee', 'hacha', { mode: 'rafaga', range: 16, shieldsPerHit: 1, pellets: 6, speed: 26 }, 'especial'),
    arma(c, 'lluvia-de-lanzas', 'LLUVIA DE LANZAS', '#f97316', 'lanza', { mode: 'perdigones', range: 13, shieldsPerHit: 1, pellets: 7, spread: 30, speed: 22 }, 'especial'),
    arma(c, 'lanza-de-repeticion', 'LANZA DE REPETICIÓN', '#4ade80', 'lanza', { mode: 'rafaga', range: 18, shieldsPerHit: 2, pellets: 3, speed: 32 }, 'especial'),
    especial(c, 'niebla-del-fiordo', 'NIEBLA DEL FIORDO', '#94a3b8', 'humo', 'granada', 'especial'),
    arma(c, 'martillo-bufalo', 'MARTILLO DEL JARL', '#a78bfa', 'martillo', { mode: 'bala', range: 19, shieldsPerHit: 3, speed: 26 }, 'epica'),
    especial(c, 'tormenta-de-thor', 'LA TORMENTA DE THOR', '#fde047', 'rayo', 'tormenta', 'epica'),
    arma(c, 'martillo-de-thor', 'EL MARTILLO DE THOR', '#38bdf8', 'martillo', { mode: 'explosivo', range: 21, shieldsPerHit: 4, radius: 3.4, speed: 18, mecha: 900 }, 'divina'),
    especial(c, 'puente-del-bifrost', 'EL PUENTE DEL BIFROST', '#f472b6', 'tunel', 'pico', 'divina'),
  ]
}

/** Todo lo de las clases nuevas, a partir de los vaqueros (que ponen los estilos, las rarezas y los numeros de base). */
export function crearClases(vaqueros: BattleCard[]): { battle: BattleCard[]; weapons: WeaponCard[] } {
  return {
    battle: [...crearMunecos('indios', INDIOS, vaqueros), ...crearMunecos('vikingos', VIKINGOS, vaqueros)],
    weapons: [...armasIndios(), ...armasVikingos()],
  }
}
