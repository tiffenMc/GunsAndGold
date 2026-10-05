import * as M from './mates'
import type { Battle, Side, Unit, Vec } from './engine'
import { FIELD_L, FIELD_W, FORT_Z, SIEGE_RANGE, UNIT_R, alive, hiddenBySmoke, hurtUnit } from './engine'
import type { Estilo } from './estilos'
import { AJUSTES } from './ajustes'

/**
 * **Las habilidades.** Cada muñeco tiene un ataque propio que se ve de lejos y que salta **justo al
 * encontrarse con un enemigo**: una lluvia de balas mientras baila, un lanzallamas, un remolino con
 * el hacha, hacerse una bola y arrollar, teletransportar a los suyos, girar como un trompo… Al
 * acabar recarga, sigue peleando normal y, cuando vuelve a tenerla lista, la suelta otra vez.
 *
 * De **torre** cada una tiene su version: la torre no se mueve, asi que la habilidad se hace desde
 * la atalaya (el remolino gira alli arriba con el hacha larga, la bola sale como una roca rodando…).
 *
 * Aqui va la logica (el motor). Lo que se pinta esta en `Habilidades.tsx`, que lee `battle.efectos`
 * y el estado de cada tropa (`unit.hab`).
 */

export type Mecanica =
  | 'lluvia'
  | 'llamas'
  | 'torbellino'
  | 'bola'
  | 'teleporte'
  | 'trompo'
  | 'red'
  | 'lazo'
  | 'salto'
  | 'carga'
  | 'mortero'
  | 'meteoro'
  | 'rayo'
  | 'bandada'
  | 'cura'
  | 'burbuja'
  | 'grito'
  | 'estandarte'
  | 'barril'
  | 'franco'
  | 'bumeran'
  | 'nube'
  | 'sombra'
  | 'ruleta'
  | 'iman'
  | 'duelo'
  | 'abanico'
  | 'kamikaze'
  | 'estampida'
  | 'nana'
  | 'manos'
  // Solo de torre
  | 'torreta'
  | 'apuesta'
  | 'nido'
  | 'rugido'
  | 'cortina'
  | 'orbita'
  | 'humareda'
  | 'cepos'
  | 'botica'
  | 'reto'
  | 'cartel'
  | 'tormenta'
  | 'santuario'

export interface Habilidad {
  mecanica: Mecanica
  /** Lo que se grita al soltarla (sale en un bocadillo encima). */
  nombre: string
  nota: string
  notaTorre: string
  color: string
  /** Lo que tarda en volver a tenerla lista, en segundos. */
  cdS: number
  /** Las variantes de una misma mecanica (cambian numeros y aspecto). */
  variante?: string
  /** Solo las de torre: hasta donde defiende (cada carta el suyo). */
  rango?: number
  /** La habilidad de la carta cuando se planta de torre: otra distinta, con su rango. */
  torre?: Habilidad
}

const H = (
  mecanica: Mecanica,
  nombre: string,
  color: string,
  cdS: number,
  nota: string,
  notaTorre: string,
  variante?: string,
): Habilidad => ({ mecanica, nombre, color, cdS, nota, notaTorre, variante })

/** Una habilidad por estilo: cada carta de una clase tiene la suya y no se repite. */
const POR_ESTILO: Record<string, Habilidad> = {
  clasico: H('abanico', '¡ABANICO!', '#fbbf24', 9, 'Abanica el revólver: seis balas en abanico a todo lo que tiene delante', 'Desde la atalaya, diez balas en abanico'),
  doble: H('lluvia', '¡LLUVIA DE PLOMO!', '#38bdf8', 12, 'Salta y baila disparando al cielo: cae una lluvia de balas en un círculo durante 5 segundos', 'El círculo de balas es más grande desde la torre'),
  cuchillos: H('abanico', '¡CUCHILLOS!', '#cbd5e1', 9, 'Lanza cinco cuchillos en abanico que frenan a quien tocan', 'Ocho cuchillos en abanico que frenan', 'cuchillos'),
  rafaga: H('mortero', '¡GRANADAS!', '#84cc16', 10, 'Lanza tres granadas seguidas alrededor del enemigo', 'Cinco granadas desde la torre', 'granadas'),
  rafagaLarga: H('trompo', '¡TROMPO!', '#facc15', 12, 'Gira tres veces disparando hacia todos lados (8 balas por vuelta)… y se marea', 'Cuatro vueltas sin marearse, desde la atalaya'),
  minigun: H('trompo', '¡TORMENTO!', '#ef4444', 14, 'Cuatro vueltas de minigun, diez balas por vuelta… y acaba mareadísimo', 'Cinco vueltas de minigun desde la torre', 'minigun'),
  cerrojo: H('franco', '¡TIRO SECO!', '#f87171', 8, 'Apunta con la mirilla un instante y suelta un tiro que quita casi dos escudos', 'Apunta más rápido desde la torre'),
  francotirador: H('franco', '¡EN LA MIRA!', '#ef4444', 11, 'Un láser rojo marca al enemigo… y un balazo que quita dos escudos y medio', 'Mirilla más rápida y más lejos', 'largo'),
  legendario: H('franco', '¡BALA LEGENDARIA!', '#fde047', 13, 'Carga la mirilla y su bala dorada atraviesa a todos los de la línea', 'La bala dorada cruza el campo entero', 'leyenda'),
  perdigones: H('nana', '¡A LA SIESTA!', '#a78bfa', 13, 'Bosteza tan fuerte que los enemigos de alrededor se quedan dormidos', 'La nana llega más lejos desde la torre'),
  escopetazo: H('grito', '¡ESCOPETAZO!', '#fb923c', 9, 'Un cono de perdigones que lanza por los aires a los de delante', 'Un escopetazo más ancho desde la torre', 'escopetazo'),
  regano: H('grito', '¡A CALLAR!', '#fde68a', 10, 'Una bronca en cono que deja aturdidos a los de delante', 'La bronca llega más lejos desde la torre', 'regano'),
  predicador: H('grito', '¡CAMPANADA!', '#facc15', 11, 'Toca la campana: la onda aturde y frena a todos los de alrededor', 'La campana suena más lejos desde la torre', 'campana'),
  rebote: H('bumeran', '¡BUMERÁN!', '#38bdf8', 8, 'Lanza su arma como un bumerán: da a todos a la ida y a la vuelta', 'Dos bumeranes cruzados desde la torre'),
  rebotaLargo: H('rayo', '¡CADENA!', '#7dd3fc', 10, 'Un rayo que salta de enemigo en enemigo (hasta cinco) y los deja tiesos', 'El rayo salta hasta siete veces'),
  perfora: H('carga', '¡A LA BAYONETA!', '#e5e7eb', 10, 'Carga en línea recta con la bayoneta y atraviesa a todos los que pilla', 'Lanza una bayoneta que atraviesa la línea', 'bayoneta'),
  estocada: H('carga', '¡ESTOCADA DOBLE!', '#f0abfc', 10, 'Dos embestidas relámpago, ida y vuelta, atravesando a todos', 'Lanza dos estoques que atraviesan', 'estocada'),
  corredor: H('estampida', '¡ESTAMPIDA!', '#d6a35c', 12, 'Silba y sale una manada de caballos salvajes que arrolla todo lo que hay delante', 'Cuatro caballos desde la torre', 'caballos'),
  caza: H('red', '¡VIVO O MUERTO!', '#e7e5e4', 10, 'Dispara una red que atrapa a los enemigos un rato: ni andan ni disparan', 'La red es más grande desde la torre'),
  duelista: H('duelo', '¡A DUELO!', '#f8fafc', 10, 'Duelo al sol: los dos quietos un segundo… gana él, quita dos escudos y medio y aturde', 'Duelo desde la torre, aún más rápido'),
  dinamitero: H('mortero', '¡DINAMITA!', '#dc2626', 11, 'Tres cartuchos de dinamita por el aire alrededor del enemigo', 'Cinco cartuchos desde la torre'),
  canon: H('meteoro', '¡CAÑONAZO!', '#f97316', 13, 'Marca el suelo con una diana… y cae una bala de cañón enorme que aturde', 'La diana es más grande desde la torre', 'canon'),
  santo: H('botica', '¡MILAGRO!', '#fde047', 11, 'Lanza agua bendita a los suyos más heridos que tenga cerca', 'Desde la torre llega mucho más lejos'),
  cuerpo: H('salto', '¡AL SUELO!', '#f59e0b', 9, 'Salta por los aires y cae encima del enemigo: onda que empuja a todos', 'Pisotón desde la torre: onda alrededor'),
  matón: H('salto', '¡PISOTÓN!', '#b45309', 10, 'Un salto enorme y un pisotón que lanza por los aires a los de alrededor', 'Pisotón gigante desde la torre', 'pisoton'),
  furia: H('torbellino', '¡REMOLINO!', '#ef4444', 12, 'Gira con el hacha sin rumbo por el campo golpeando a todo el que pilla… y se marea', 'Gira en su atalaya con el hacha larga: da a todo lo que pase'),
  bailarina: H('estandarte', '¡CANCÁN!', '#f472b6', 13, 'Baila el cancán: los suyos de alrededor corren y disparan mucho más rápido', 'El cancán se nota más lejos desde la torre'),
  coloso: H('estampida', '¡TOROS!', '#a16207', 13, 'Llama a tres toros fantasma que arrollan todo lo que hay delante', 'Cuatro toros desde la torre'),
  kamikaze: H('kamikaze', '¡MECHA ENCENDIDA!', '#f97316', 99, 'Enciende la mecha, corre hacia el enemigo y explota a lo grande', 'Lanza un fardo de dinamita enorme'),
  barril: H('barril', '¡BARRIL VA!', '#b45309', 11, 'Echa a rodar un barril de pólvora que explota al llegar', 'Dos barriles rodando desde la torre'),
  cebo: H('iman', '¡VENID AQUÍ!', '#a78bfa', 12, 'Un remolino que arrastra hacia él a todos los enemigos cercanos', 'El remolino es más grande desde la torre'),
  murallaCebo: H('burbuja', '¡MURALLA!', '#60a5fa', 12, 'Se cubre con una cúpula que aguanta cuatro golpes y atrae los disparos', 'Cúpula de cinco golpes para él y los de al lado', 'muralla'),
  blindado: H('bola', '¡RODILLO!', '#a8a29e', 11, 'Se hace una bola, sale rodando a toda velocidad y aturde al que arrolla', 'Echa a rodar una roca que aturde a los que pilla'),
  tanque: H('iman', '¡AQUÍ, COBARDES!', '#c084fc', 12, 'Un remolino que arrastra hacia él a todos los enemigos cercanos y les obliga a pegarle a él', 'El remolino es más grande desde la torre'),
  lazo: H('lazo', '¡YIJAAA!', '#d97706', 9, 'Echa el lazo, arrastra al enemigo hasta él y lo deja aturdido', 'Lo arrastra hasta la torre y lo deja atado'),
  sigilo: H('sombra', '¡POR LA ESPALDA!', '#64748b', 10, 'Se esfuma, aparece detrás del enemigo y le da un golpe que aturde', 'Su sombra sale de la torre y golpea al enemigo'),
  emboscada: H('manos', '¡DE LA TIERRA!', '#86efac', 11, 'Salen manos del suelo que agarran a los enemigos y no los sueltan', 'Las manos salen en un círculo más grande'),
  fuego: H('llamas', '¡LANZALLAMAS!', '#f97316', 10, 'Un chorro de fuego que quema a todos los de delante (siguen ardiendo)', 'Barre el campo de lado a lado con el lanzallamas'),
  veneno: H('llamas', '¡ÁCIDO!', '#84cc16', 10, 'Un chorro de ácido que quema y frena a los de delante', 'Barre el campo con ácido de lado a lado', 'acido'),
  gas: H('nube', '¡GAS!', '#a3e635', 11, 'Tira un frasco: sale una nube que quita escudos y frena', 'La nube es más grande desde la torre'),
  cepos: H('red', '¡RED!', '#e7e5e4', 10, 'Dispara una red que atrapa a los enemigos un rato: ni andan ni disparan', 'La red es más grande desde la torre'),
  tumba: H('manos', '¡DE LA TUMBA!', '#86efac', 11, 'Salen manos del suelo que agarran a los enemigos y no los sueltan', 'Las manos salen en un círculo más grande'),
  circulo: H('lluvia', '¡CÍRCULO DE BALAS!', '#7dd3fc', 12, 'Baila mientras cae una lluvia de balas en un círculo durante 5 segundos', 'El círculo de balas es más grande desde la torre'),
  fusileria: H('lluvia', '¡DESCARGA!', '#93c5fd', 12, 'Baila mientras cae una descarga de balas larga sobre el enemigo', 'Descarga más larga desde la torre', 'descarga'),
  medico: H('cura', '¡POCIÓN!', '#4ade80', 10, 'Una columna de luz verde que cura a los suyos de alrededor', 'La cura llega mucho más lejos desde la torre'),
  sanadora: H('cura', '¡SANACIÓN!', '#22c55e', 10, 'Un círculo de cura enorme para todos los suyos', 'Un círculo de cura gigante desde la torre', 'grande'),
  escudera: H('burbuja', '¡ESCUDOS ARRIBA!', '#38bdf8', 12, 'Pone una cúpula a los suyos de alrededor que aguanta dos golpes', 'Cúpulas a todos los suyos de alrededor'),
  abanderado: H('estandarte', '¡A LA CARGA!', '#fbbf24', 13, 'Clava su estandarte: los suyos cerca corren y disparan mucho más rápido', 'El estandarte llega más lejos desde la torre'),
  cantinero: H('estandarte', '¡RONDA PARA TODOS!', '#d97706', 13, 'Saca un barril de whisky: los suyos cerca disparan más rápido y se curan un poco', 'El barril llega más lejos desde la torre', 'ronda'),
  reina: H('teleporte', '¡CONMIGO!', '#e879f9', 15, 'Abre un portal y se lleva a todos los suyos de alrededor hacia el campo rival', 'El portal manda a los enemigos de vuelta a su campo'),
  poker: H('ruleta', '¡HAGAN JUEGO!', '#facc15', 10, 'Gira una ruleta encima de la cabeza: bala de oro, triple tiro, curarse o un tiro aturdidor', 'Gira la ruleta desde la torre'),
  cuervo: H('bandada', '¡CUERVOS!', '#312e81', 11, 'Suelta una bandada de cuervos que pican y ciegan a los enemigos', 'Una bandada enorme desde la torre'),
}

const T = (mecanica: Mecanica, nombre: string, color: string, cdS: number, rango: number, nota: string, variante?: string): Habilidad => ({
  mecanica,
  nombre,
  color,
  cdS,
  rango,
  nota,
  notaTorre: nota,
  variante,
})

/**
 * **Las 30 defensas.** Cada carta, plantada de torre, defiende a su manera y hasta donde le llega:
 * ninguna se repite y ninguna es la misma que su ataque. El rango va con la carta: el nido del
 * francotirador cubre medio campo y el pisoton del matón solo lo que tiene alrededor.
 */
const TORRES: Record<string, Habilidad> = {
  clasico: T('torreta', '¡TORRETA!', '#fbbf24', 10, 6, 'Dispara solo, sin parar, a todo el que entra en su rango durante 5 segundos'),
  poker: T('apuesta', '¡TODO AL ROJO!', '#facc15', 10, 6, 'Reparte cartas a los enemigos de su rango: a cada uno le toca una desgracia distinta'),
  francotirador: T('nido', '¡NIDO DE TIRADOR!', '#ef4444', 11, 10, 'Desde lo alto apunta a los tres enemigos más lejanos y les mete un balazo a cada uno'),
  matón: T('salto', '¡TERREMOTO!', '#b45309', 9, 3.2, 'Salta en la atalaya y el pisotón lanza por los aires a los que tiene pegados', 'pisoton'),
  doble: T('cortina', '¡CORTINA DE PLOMO!', '#38bdf8', 12, 7, 'Tres lluvias de balas en fila delante de la torre: nadie cruza sin llevarse lo suyo'),
  perdigones: T('grito', '¡PERDIGONADA!', '#fb923c', 9, 4.5, 'Un escopetazo en cono que lanza hacia atrás a los que se acercan', 'escopetazo'),
  rebote: T('orbita', '¡BUMERANES EN ÓRBITA!', '#38bdf8', 11, 3.6, 'Dos bumeranes giran alrededor de la torre y golpean a todo el que se acerca'),
  blindado: T('bola', '¡ALUD!', '#a8a29e', 10, 8, 'Echa a rodar una roca enorme que aturde a todos los que pilla en la línea'),
  corredor: T('carga', '¡CUCHILLAS!', '#d6a35c', 9, 7.5, 'Lanza tres cuchillas en zigzag que atraviesan a los de delante', 'sprint'),
  kamikaze: T('kamikaze', '¡FARDO DE DINAMITA!', '#f97316', 14, 7, 'Lanza un fardo de dinamita enorme al grupo de enemigos'),
  sigilo: T('humareda', '¡HUMAREDA!', '#94a3b8', 14, 5, 'Suelta una humareda: los tuyos que estén dentro no se ven'),
  predicador: T('cura', '¡SANTUARIO DEL PUEBLO!', '#4ade80', 12, 5.5, 'Bendice el suelo: los tuyos que estén cerca de la torre se curan durante unos segundos', 'grande'),
  bailarina: T('torbellino', '¡CARRUSEL!', '#f472b6', 9, 3, 'Gira en la atalaya como un carrusel: da a todo lo que pase pegado'),
  lazo: T('cepos', '¡LAZOS AL SUELO!', '#d97706', 11, 6, 'Deja lazos tendidos alrededor: el primero que pisa cada uno se queda atado'),
  medico: T('botica', '¡BOTICA!', '#22c55e', 8, 8, 'Lanza pociones a los tuyos más heridos que estén en su rango'),
  fuego: T('llamas', '¡BARRIDO DE FUEGO!', '#f97316', 10, 5.5, 'Barre el frente de lado a lado con el lanzallamas: todo el que pasa arde'),
  duelista: T('reto', '¡QUE PASE EL SIGUIENTE!', '#f8fafc', 11, 7, 'Se bate en duelo con tres enemigos, uno detrás de otro, y les quita escudos'),
  perfora: T('carga', '¡BAYONETAS!', '#e5e7eb', 9, 9, 'Lanza una bayoneta que atraviesa a toda la fila', 'bayoneta'),
  escudera: T('burbuja', '¡BASTIÓN!', '#38bdf8', 12, 6, 'Cúpulas para todos los tuyos que estén en su rango'),
  gas: T('nube', '¡CHIMENEA!', '#a3e635', 11, 4, 'Una nube de gas rodea la torre: quita escudos y frena a quien entra'),
  tanque: T('iman', '¡FORTALEZA!', '#c084fc', 13, 5, 'Se cubre con una cúpula enorme y arrastra a los enemigos para que le peguen a él'),
  caza: T('cartel', '¡SE BUSCA!', '#ef4444', 11, 8, 'Cuelga un cartel al enemigo más duro: todos le quitan el doble de escudos'),
  reina: T('teleporte', '¡DESTIERRO!', '#e879f9', 15, 5, 'Abre un portal que manda a los enemigos de su rango de vuelta a su campo'),
  furia: T('rugido', '¡RUGIDO!', '#ef4444', 10, 4, 'Ruge tan fuerte que los enemigos de su rango salen despedidos y se quedan frenados'),
  dinamitero: T('barril', '¡POLVORÍN!', '#b45309', 11, 8, 'Echa a rodar dos barriles de pólvora que explotan al llegar'),
  emboscada: T('bandada', '¡ESPANTAPÁJAROS!', '#1f2937', 11, 8, 'Los cuervos del espantapájaros pican y ciegan a todos los de su rango'),
  cuervo: T('tormenta', '¡TORMENTA!', '#c7d2fe', 12, 8, 'Durante 4 segundos caen rayos sobre los enemigos de su rango'),
  canon: T('mortero', '¡ARTILLERÍA!', '#dc2626', 12, 10, 'Bombardea con cinco cargas al enemigo más lejano de su rango'),
  santo: T('cura', '¡SANTUARIO!', '#fde047', 12, 7, 'Bendice el suelo: los tuyos (y las torres) de su rango se curan durante unos segundos', 'grande'),
  minigun: T('abanico', '¡BARRERA DE FUEGO!', '#ef4444', 12, 7, 'Una barrera de balas en abanico ancho delante de la torre', 'barrera'),
}

/** La habilidad de un estilo (vale para los de las tres clases), con su version de torre. */
export function habilidadDe(estilo: Pick<Estilo, 'id'>): Habilidad {
  const base = estilo.id.replace(/^[vi]:/, '')
  const ataque = POR_ESTILO[base] ?? POR_ESTILO.clasico!
  return { ...ataque, torre: TORRES[base] ?? TORRES.clasico! }
}

/** Hasta donde defiende una carta plantada de torre. */
export function rangoDeTorreDe(estilo: Pick<Estilo, 'id'>): number {
  return habilidadDe(estilo).torre?.rango ?? 6
}

/** La habilidad que toca ahora: la de la torre si es torre (o la que este soltando). */
export function habDe(unit: Unit): Habilidad {
  return unit.hab.activa?.h ?? (unit.torre ? unit.habilidad.torre ?? unit.habilidad : unit.habilidad)
}

export const TODAS_LAS_HABILIDADES = POR_ESTILO

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type Pose = 'baile' | 'giro' | 'bola' | 'salto' | 'mareo' | 'canaliza' | 'carga' | 'invisible'

/** Lo de la habilidad de cada tropa, y los estados que le dejan las de los demas. */
export interface HabEstado {
  /** Cuando la vuelve a tener lista. */
  listaEn: number
  activa: Activa | null
  /** Como se pone el cuerpo (bailar, girar, bola…) y hasta cuando. */
  pose: Pose | null
  poseDesde: number
  poseHasta: number
  /** Lo que le han hecho: arder, red, dormir, mareo, cupula, ceguera, prisa. */
  quemaHasta: number
  quemaNext: number
  redHasta: number
  suenoHasta: number
  mareoHasta: number
  /** Congelado por el clima helado (un muñeco de hielo). */
  hieloHasta?: number
  burbuja: number
  burbujaHasta: number
  cegadoHasta: number
  prisaHasta: number
  /** Le han colgado el cartel de "se busca": recibe el doble. */
  cartelHasta: number
}

interface Activa {
  /** Por que paso va (cada mecanica los usa a su manera). */
  fase: number
  t: number
  dur: number
  objetivo: number | null
  /** Numeros de la mecanica (punto de llegada, angulo, vueltas…). */
  n: Record<string, number>
  /** A quien ya ha dado (para no dar dos veces al mismo). */
  ids: number[]
  /** La habilidad que se esta soltando (la de ataque o la de torre). */
  h: Habilidad
}

export function nuevoHabEstado(t: number): HabEstado {
  return {
    listaEn: t,
    activa: null,
    pose: null,
    poseDesde: 0,
    poseHasta: 0,
    quemaHasta: 0,
    quemaNext: 0,
    redHasta: 0,
    suenoHasta: 0,
    mareoHasta: 0,
    burbuja: 0,
    burbujaHasta: 0,
    cegadoHasta: 0,
    prisaHasta: 0,
    cartelHasta: 0,
  }
}

/** Lo que se pinta en el campo mientras dura una habilidad. */
export type Efecto =
  | {
      k: 'zona'
      id: number
      side: Side
      x: number
      z: number
      r: number
      desde: number
      hasta: number
      color: string
      estilo: 'balas' | 'fuego' | 'gas' | 'cura' | 'estandarte' | 'sueno' | 'iman' | 'aviso' | 'manos' | 'red' | 'portal' | 'divino' | 'ronda'
      cadaS: number
      next: number
      golpe: number
      ralentiza?: number
      cura?: number
      duerme?: number
      atrapa?: number
      atrae?: number
      /** La zona va pegada a una tropa (la cura, el remolino). */
      sigue?: number
      /** Se gasta al atrapar a alguien (los lazos tendidos). */
      usos?: number
    }
  | {
      k: 'proy'
      id: number
      side: Side
      from: Vec
      to: Vec
      desde: number
      dur: number
      alto: number
      modelo: 'bala' | 'flecha' | 'red' | 'dinamita' | 'granada' | 'frasco' | 'barril' | 'roca' | 'cuervo' | 'cuchillo' | 'bumeran' | 'toro' | 'bayoneta'
      color: string
      /** Lo que hace al llegar. */
      impacto: Impacto
      /** Da a los que pilla por el camino (una vez a cada uno). */
      camino?: { r: number; golpe: number; aturde?: number; empuja?: number; ralentiza?: number; primero?: boolean }
      vistos: number[]
      /** El bumeran vuelve a quien lo tiro. */
      vuelta?: number
      grande?: number
      /** Gira alrededor de una tropa (los bumeranes en orbita). */
      orbita?: { unitId: number; r: number; w: number; a0: number }
    }
  | { k: 'linea'; id: number; from: Vec; to: Vec; desde: number; hasta: number; color: string; estilo: 'laser' | 'rayo' | 'cuerda' | 'estela'; deA?: number; aB?: number }
  | { k: 'cono'; id: number; unitId: number; ang: number; abre: number; alcance: number; desde: number; hasta: number; color: string; estilo: 'llama' | 'acido' | 'onda' }
  | { k: 'pilar'; id: number; x: number; z: number; desde: number; hasta: number; color: string; ancho: number }
  | { k: 'onda'; id: number; x: number; z: number; r: number; desde: number; hasta: number; color: string }
  | { k: 'ruleta'; id: number; unitId: number; desde: number; hasta: number; premio: number }

type Impacto =
  | { tipo: 'nada' }
  | { tipo: 'red'; r: number; dur: number }
  | { tipo: 'bomba'; r: number; golpe: number; aturde?: number }
  | { tipo: 'nube'; r: number; dur: number; golpe: number }
  | { tipo: 'pica'; golpe: number; ciega: number; unitId: number }
  | { tipo: 'golpe'; golpe: number; unitId: number; ralentiza?: number }
  | { tipo: 'cura'; cura: number; unitId: number }

// ---------------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------------

function dist(a: Vec, b: Vec): number {
  return M.hypot(a.x - b.x, a.z - b.z)
}

function dentro(at: Vec): Vec {
  return {
    x: Math.min(FIELD_W / 2 - 0.6, Math.max(-FIELD_W / 2 + 0.6, at.x)),
    z: Math.min(FIELD_L / 2 - 1, Math.max(-FIELD_L / 2 + 1, at.z)),
  }
}

/** Hacia donde queda el campo rival (+1 o -1 en z). */
function adelante(side: Side): number {
  return side === 0 ? -1 : 1
}

function enemigosEn(battle: Battle, side: Side, at: Vec, r: number): Unit[] {
  return battle.units.filter((u) => u.side !== side && alive(u) && !hiddenBySmoke(battle, u) && dist(u, at) <= r + UNIT_R)
}

function amigosEn(battle: Battle, side: Side, at: Vec, r: number): Unit[] {
  return battle.units.filter((u) => u.side === side && alive(u) && dist(u, at) <= r)
}

/** Lo fuerte que sale la habilidad: la calidad del dibujo tambien cuenta (de 0,35 a 1). */
function fuerza(unit: Unit): number {
  return Math.min(1, Math.max(0.35, unit.damage / Math.max(1, unit.card.damage))) * poderDe(unit)
}

/** El ajuste de equilibrio de su habilidad (la de ataque o la de torre). */
function poderDe(unit: Unit): number {
  const a = AJUSTES[unit.card.id]
  return (unit.torre ? a?.torre : a?.poder) ?? 1
}

function pon(battle: Battle, e: Efecto) {
  // Las balas de cada clase: flechas los indios y hachas arrojadizas los vikingos.
  if (e.k === 'proy' && e.modelo === 'bala') {
    const u = battle.units.find((x) => x.side === e.side && Math.abs(x.x - e.from.x) < 0.5 && Math.abs(x.z - e.from.z) < 0.5)
    if (u?.card.clase === 'indios') e.modelo = 'flecha'
    else if (u?.card.clase === 'vikingos') e.modelo = 'cuchillo'
  }
  battle.efectos.push(e)
}

function pose(battle: Battle, unit: Unit, p: Pose, dur: number) {
  unit.hab.pose = p
  unit.hab.poseDesde = battle.time
  unit.hab.poseHasta = battle.time + dur
}

function empujar(unit: Unit, from: Vec, fuerzaM: number) {
  const dx = unit.x - from.x
  const dz = unit.z - from.z
  const l = M.hypot(dx, dz) || 1
  unit.knockback.x += (dx / l) * fuerzaM * 2.2
  unit.knockback.z += (dz / l) * fuerzaM * 2.2
  unit.hitStun = Math.max(unit.hitStun, 0.25)
}

function golpear(battle: Battle, foe: Unit, golpe: number, from: Vec, extra?: { aturde?: number; empuja?: number; ralentiza?: number; arma?: boolean }) {
  if (!alive(foe)) return
  hurtUnit(battle, foe, golpe, Boolean(extra?.arma), from)
  if (!alive(foe)) return
  if (extra?.aturde) foe.hitStun = Math.max(foe.hitStun, extra.aturde)
  if (extra?.ralentiza) foe.slowUntil = Math.max(foe.slowUntil, battle.time + extra.ralentiza)
  if (extra?.empuja) empujar(foe, from, extra.empuja)
}

function proyectil(battle: Battle, unit: Unit, to: Vec, dur: number, alto: number, modelo: Extract<Efecto, { k: 'proy' }>['modelo'], impacto: Impacto, extra?: Partial<Extract<Efecto, { k: 'proy' }>>) {
  pon(battle, {
    k: 'proy',
    id: battle.nextId++,
    side: unit.side,
    from: { x: unit.x, z: unit.z },
    to: dentro(to),
    desde: battle.time,
    dur,
    alto,
    modelo,
    color: habDe(unit).color,
    impacto,
    vistos: [],
    ...extra,
  })
}

/** Un punto a `largo` de la tropa en la direccion `ang` (0 = hacia +z). */
function enDireccion(from: Vec, ang: number, largo: number): Vec {
  return { x: from.x + M.sin(ang) * largo, z: from.z + M.cos(ang) * largo }
}

function anguloA(from: Vec, to: Vec): number {
  return M.atan2(to.x - from.x, to.z - from.z)
}

/** El enemigo mas cercano a un punto (de los que se ven). */
function cercano(battle: Battle, side: Side, at: Vec, r: number, quitar: number[] = []): Unit | null {
  let mejor: Unit | null = null
  let md = r
  for (const u of battle.units) {
    if (u.side === side || !alive(u) || hiddenBySmoke(battle, u) || quitar.includes(u.id)) continue
    const d = dist(u, at)
    if (d < md) {
      md = d
      mejor = u
    }
  }
  return mejor
}

// ---------------------------------------------------------------------------
// Estados que dejan las habilidades (arder, red, dormir, mareo…)
// ---------------------------------------------------------------------------

/** Si la tropa no puede hacer nada (atrapada, dormida o mareada). */
export function bloqueada(battle: Battle, unit: Unit): boolean {
  const h = unit.hab
  return battle.time < h.redHasta || battle.time < h.suenoHasta || battle.time < h.mareoHasta
}

/** Lo que pasa cada paso por los estados: el fuego quema poco a poco. */
export function pasoEstados(battle: Battle, unit: Unit) {
  const h = unit.hab
  if (battle.time < h.quemaHasta && battle.time >= h.quemaNext) {
    h.quemaNext = battle.time + 0.8
    hurtUnit(battle, unit, 0.22, false)
  }
}

/** Lo que recibe de mas: con el cartel de "se busca" colgado, el doble. */
export function multiplicadorDeDano(battle: Battle, unit: Unit): number {
  return battle.time < unit.hab.cartelHasta ? 2 : 1
}

/** Antes de quitar escudos: la cupula se come el golpe y el que duerme se despierta. */
export function antesDeHerir(battle: Battle, unit: Unit): boolean {
  const h = unit.hab
  if (battle.time < h.suenoHasta) h.suenoHasta = battle.time
  if (h.burbuja > 0 && battle.time < h.burbujaHasta) {
    h.burbuja -= 1
    battle.events.push({ type: 'blast', x: unit.x, z: unit.z, r: 0.9, side: unit.side })
    return false
  }
  return true
}

/** Lo que corre y dispara de mas por los estandartes y la prisa. */
export function extraDeHabilidades(battle: Battle, unit: Unit): { vel: number; cad: number } {
  let vel = battle.time < unit.hab.prisaHasta ? 0.35 : 0
  let cad = battle.time < unit.hab.prisaHasta ? 0.3 : 0
  for (const e of battle.efectos) {
    if (e.k !== 'zona' || e.side !== unit.side || battle.time > e.hasta) continue
    if (e.estilo !== 'estandarte' && e.estilo !== 'ronda') continue
    if (dist(unit, e) > e.r) continue
    vel += e.estilo === 'estandarte' ? 0.5 : 0.15
    cad += e.estilo === 'estandarte' ? 0.4 : 0.45
  }
  // La ceguera de los cuervos: dispara a la mitad.
  if (battle.time < unit.hab.cegadoHasta) cad -= 0.5
  return { vel: Math.min(0.8, vel), cad: Math.max(-0.5, Math.min(0.8, cad)) }
}

// ---------------------------------------------------------------------------
// Soltar la habilidad
// ---------------------------------------------------------------------------

/** Si la tropa tiene la habilidad lista y algo contra lo que usarla, la suelta. Devuelve si la ha soltado. */
export function intentarHabilidad(battle: Battle, unit: Unit, enemigo: Unit | null): boolean {
  const h = unit.hab
  if (h.activa || battle.time < h.listaEn || battle.practice) return false
  const hab = habDe(unit)
  // La torre mira a todo su rango (cada carta el suyo).
  let objetivo = unit.torre ? cercano(battle, unit.side, unit, hab.rango ?? 6) : enemigo
  if (unit.torre && !objetivo) {
    const curaTorre = (hab.mecanica === 'botica' || hab.mecanica === 'cura') && amigosEn(battle, unit.side, unit, hab.rango ?? 6).some((a) => a.shields < a.maxShields - 0.4)
    if (!curaTorre) return false
  }
  // Las de apoyo se sueltan con un enemigo cerca (o, las de cura, con un compañero herido).
  if (!objetivo && !unit.torre) {
    // (Los de apoyo no se pelean: sueltan la suya con un enemigo cerca, sea cual sea.)
    const apoyo = unit.estilo.pacifico || hab.mecanica === 'cura' || hab.mecanica === 'burbuja' || hab.mecanica === 'estandarte'
    if (!apoyo) return false
    objetivo = cercano(battle, unit.side, unit, unit.card.range + 3)
    const herido = hab.mecanica === 'cura' && amigosEn(battle, unit.side, unit, 5).some((a) => a.shields < a.maxShields - 0.4)
    if (!objetivo && !herido) return false
  }
  iniciar(battle, unit, objetivo)
  battle.events.push({ type: 'habilidad', unitId: unit.id, x: unit.x, z: unit.z, side: unit.side, nombre: hab.nombre, color: hab.color })
  return true
}

function activar(unit: Unit, dur: number, objetivo: Unit | null, n: Record<string, number> = {}) {
  const h = unit.torre ? unit.habilidad.torre ?? unit.habilidad : unit.habilidad
  unit.hab.activa = { fase: 0, t: 0, dur, objetivo: objetivo?.id ?? null, n, ids: [], h }
}

function iniciar(battle: Battle, unit: Unit, foe: Unit | null) {
  const hab = habDe(unit)
  const R = hab.rango ?? 6
  const torre = unit.torre
  const f = fuerza(unit)
  const t = battle.time
  const at = foe ? { x: foe.x, z: foe.z } : enDireccion(unit, unit.heading, 4)
  if (foe) unit.heading = anguloA(unit, foe)

  switch (hab.mecanica) {
    case 'lluvia': {
      const r = (hab.variante === 'descarga' ? 3 : 2.6) * (torre ? 1.3 : 1)
      const dur = hab.variante === 'descarga' ? 4 : 5
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: at.x, z: at.z, r, desde: t, hasta: t + dur, color: hab.color, estilo: 'balas', cadaS: 0.5, next: t + 0.4, golpe: 0.3 * f })
      pose(battle, unit, 'baile', dur)
      activar(unit, dur, foe)
      break
    }
    case 'llamas': {
      const dur = torre ? 3.5 : 2.6
      const ang = foe ? anguloA(unit, foe) : unit.heading
      pon(battle, { k: 'cono', id: battle.nextId++, unitId: unit.id, ang, abre: 0.5, alcance: torre ? R : Math.min(5.5, unit.card.range + 0.6), desde: t, hasta: t + dur, color: hab.color, estilo: hab.variante === 'acido' ? 'acido' : 'llama' })
      pose(battle, unit, 'canaliza', dur)
      activar(unit, dur, foe, { ang, next: t + 0.2 })
      break
    }
    case 'torbellino': {
      const dur = torre ? 3 : 3.5
      pose(battle, unit, 'giro', dur)
      activar(unit, dur, foe, { dir: battle.rand() * Math.PI * 2, cambia: t + 0.5, next: t + 0.1, orb: anguloA(at, unit) })
      break
    }
    case 'bola': {
      if (torre) {
        const grande = hab.variante === 'grande'
        proyectil(battle, unit, enDireccion(unit, anguloA(unit, at), R + 1), 1.4, 0, 'roca', { tipo: 'nada' }, {
          camino: { r: grande ? 1.5 : 1.1, golpe: 0.8 * f, aturde: 1.3, empuja: 1.2 },
          grande: grande ? 1.6 : 1,
        })
        activar(unit, 0.4, foe)
        break
      }
      pose(battle, unit, 'bola', 3)
      activar(unit, 3, foe, { tx: at.x, tz: at.z })
      break
    }
    case 'teleporte': {
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r: torre ? R : 5.5, desde: t, hasta: t + 1, color: hab.color, estilo: 'portal', cadaS: 99, next: t + 99, golpe: 0 })
      pon(battle, { k: 'pilar', id: battle.nextId++, x: unit.x, z: unit.z, desde: t, hasta: t + 1.1, color: hab.color, ancho: 1.6 })
      pose(battle, unit, 'canaliza', 0.9)
      activar(unit, 0.9, foe)
      break
    }
    case 'trompo': {
      const vueltas = (hab.variante === 'minigun' ? 4 : 3) + (torre ? 1 : 0)
      const dur = vueltas * 0.6
      pose(battle, unit, 'giro', dur)
      activar(unit, dur, foe, { vueltas, tiros: hab.variante === 'minigun' ? 10 : 8, next: t, i: 0 })
      break
    }
    case 'red': {
      const r = torre ? 2.1 : 1.5
      proyectil(battle, unit, at, Math.max(0.35, dist(unit, at) / 12), 1.6, 'red', { tipo: 'red', r, dur: 3.2 })
      activar(unit, 0.5, foe)
      break
    }
    case 'manos': {
      const r = torre ? 2.5 : 1.9
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: at.x, z: at.z, r, desde: t, hasta: t + 3, color: hab.color, estilo: 'manos', cadaS: 1, next: t + 0.25, golpe: 0.25 * f, atrapa: 1.2 })
      pose(battle, unit, 'canaliza', 1)
      activar(unit, 1, foe)
      break
    }
    case 'lazo': {
      if (!foe) return
      pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: at, desde: t, hasta: t + 1, color: '#c08a4a', estilo: 'cuerda', deA: unit.id, aB: foe.id })
      pose(battle, unit, 'canaliza', 1)
      activar(unit, 1, foe)
      break
    }
    case 'salto': {
      if (torre) {
        const r = R
        pose(battle, unit, 'salto', 0.6)
        activar(unit, 0.6, foe, { tx: unit.x, tz: unit.z, ox: unit.x, oz: unit.z, r })
        break
      }
      const destino = foe ? dentro({ x: foe.x - M.sin(anguloA(unit, foe)) * 0.8, z: foe.z - M.cos(anguloA(unit, foe)) * 0.8 }) : dentro(at)
      pose(battle, unit, 'salto', 0.75)
      activar(unit, 0.75, foe, { tx: destino.x, tz: destino.z, ox: unit.x, oz: unit.z, r: hab.variante === 'pisoton' ? 2.8 : 2.3 })
      break
    }
    case 'carga': {
      const ang = anguloA(unit, at)
      if (torre) {
        const n = hab.variante === 'sprint' ? 3 : hab.variante === 'estocada' ? 2 : 1
        for (let i = 0; i < n; i++) {
          const a = ang + (n === 1 ? 0 : (i - (n - 1) / 2) * 0.35)
          proyectil(battle, unit, enDireccion(unit, a, R + 1), 0.6, 0.6, 'bayoneta', { tipo: 'nada' }, { camino: { r: 0.9, golpe: 0.9 * f, empuja: 0.8 } })
        }
        activar(unit, 0.4, foe)
        break
      }
      const tramos = hab.variante === 'sprint' ? 3 : hab.variante === 'estocada' ? 2 : 1
      pose(battle, unit, 'carga', 0.45 * tramos + 0.2)
      activar(unit, 0.45 * tramos + 0.2, foe, { ang, tramos, tramo: 0, desde: t, ox: unit.x, oz: unit.z })
      break
    }
    case 'mortero': {
      if (torre) {
        const lejano = enemigosEn(battle, unit.side, unit, R).sort((a, b) => dist(b, unit) - dist(a, unit))[0]
        if (lejano) {
          at.x = lejano.x
          at.z = lejano.z
        }
      }
      const n = (hab.variante === 'granadas' ? 3 : 3) + (torre ? 2 : 0)
      pose(battle, unit, 'canaliza', 0.35 * n + 0.2)
      activar(unit, 0.35 * n + 0.3, foe, { n, i: 0, next: t, tx: at.x, tz: at.z })
      break
    }
    case 'meteoro': {
      const r = (hab.variante === 'santo' ? 2.6 : 2.8) + (torre ? 0.6 : 0)
      // Al grupo mas gordo de enemigos alrededor del objetivo.
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: at.x, z: at.z, r, desde: t, hasta: t + 1.4, color: hab.color, estilo: 'aviso', cadaS: 99, next: t + 99, golpe: 0 })
      pose(battle, unit, 'canaliza', 1.4)
      activar(unit, 1.5, foe, { tx: at.x, tz: at.z, r })
      break
    }
    case 'rayo': {
      const saltos = torre ? 7 : 5
      activar(unit, 0.15 * saltos + 0.2, foe, { saltos, i: 0, next: t, lx: unit.x, lz: unit.z })
      pose(battle, unit, 'canaliza', 0.15 * saltos + 0.2)
      break
    }
    case 'bandada': {
      const n = torre ? 9 : 6
      const blancos = enemigosEn(battle, unit.side, unit, torre ? R : unit.card.range + 3).slice(0, torre ? 5 : 3)
      if (blancos.length === 0 && foe) blancos.push(foe)
      for (let i = 0; i < n; i++) {
        const b = blancos[i % Math.max(1, blancos.length)]
        if (!b) break
        const de = { x: unit.x + (battle.rand() - 0.5) * 1.5, z: unit.z + (battle.rand() - 0.5) * 1.5 }
        pon(battle, {
          k: 'proy',
          id: battle.nextId++,
          side: unit.side,
          from: de,
          to: { x: b.x, z: b.z },
          desde: t + i * 0.08,
          dur: 0.7 + battle.rand() * 0.3,
          alto: 2.2 + battle.rand(),
          modelo: 'cuervo',
          color: hab.color,
          impacto: { tipo: 'pica', golpe: 0.4 * f, ciega: 3, unitId: b.id },
          vistos: [],
        })
      }
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'cura': {
      const grande = hab.variante === 'grande'
      const r = torre ? R : grande ? 6 : 4
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r, desde: t, hasta: t + 4, color: hab.color, estilo: 'cura', cadaS: 1, next: t + 0.3, golpe: 0, cura: (grande ? 0.8 : 0.6) * poderDe(unit), sigue: unit.id })
      pon(battle, { k: 'pilar', id: battle.nextId++, x: unit.x, z: unit.z, desde: t, hasta: t + 1.4, color: hab.color, ancho: 1.2 })
      pose(battle, unit, 'canaliza', 1.2)
      activar(unit, 1.2, foe)
      break
    }
    case 'burbuja': {
      const muralla = hab.variante === 'muralla'
      const r = muralla ? (torre ? 3 : 0) : torre ? R : 5
      const golpes = muralla ? (torre ? 5 : 4) : 2
      const suyos = muralla && !torre ? [unit] : amigosEn(battle, unit.side, unit, r)
      for (const a of suyos) {
        a.hab.burbuja = Math.max(a.hab.burbuja, golpes)
        a.hab.burbujaHasta = t + 6
      }
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: Math.max(2, r), desde: t, hasta: t + 0.7, color: hab.color })
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'grito': {
      const v = hab.variante
      const k = torre ? R / 5 : 1
      if (v === 'campana') {
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 5 * k, desde: t, hasta: t + 0.8, color: hab.color })
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 3.5 * k, desde: t + 0.2, hasta: t + 1, color: hab.color })
        for (const e of enemigosEn(battle, unit.side, unit, 5 * k)) golpear(battle, e, 0.3 * f, unit, { aturde: 1.1, ralentiza: 3 })
      } else {
        const ang = anguloA(unit, at)
        const alcance = (v === 'escopetazo' ? 5 : 4.6) * k
        const abre = v === 'escopetazo' ? 0.6 : 0.7
        pon(battle, { k: 'cono', id: battle.nextId++, unitId: unit.id, ang, abre, alcance, desde: t, hasta: t + 0.6, color: hab.color, estilo: 'onda' })
        for (const e of enemigosEn(battle, unit.side, unit, alcance)) {
          const d = Math.abs(((anguloA(unit, e) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
          if (d > abre) continue
          if (v === 'escopetazo') golpear(battle, e, 0.9 * f, unit, { empuja: 3.6, arma: true })
          else golpear(battle, e, 0.3 * f, unit, { aturde: 1.7 })
        }
      }
      pose(battle, unit, 'canaliza', 0.6)
      activar(unit, 0.6, foe)
      break
    }
    case 'estandarte': {
      const ronda = hab.variante === 'ronda'
      const r = 5 * (torre ? 1.4 : 1)
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r, desde: t, hasta: t + 7, color: hab.color, estilo: ronda ? 'ronda' : 'estandarte', cadaS: ronda ? 1.5 : 99, next: t + 1, golpe: 0, cura: ronda ? 0.3 * poderDe(unit) : 0 })
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'barril': {
      const n = torre ? 2 : 1
      for (let i = 0; i < n; i++) {
        const a = anguloA(unit, at) + (n === 1 ? 0 : (i - 0.5) * 0.4)
        const to = enDireccion(unit, a, Math.min(9, dist(unit, at) + 0.5))
        proyectil(battle, unit, to, Math.max(0.6, dist(unit, to) / 6), 0, 'barril', { tipo: 'bomba', r: 2.3, golpe: 1.3 * f })
      }
      activar(unit, 0.5, foe)
      break
    }
    case 'franco': {
      if (!foe) return
      const carga = (hab.variante === 'leyenda' ? 1.6 : hab.variante === 'largo' ? 1.3 : 0.75) * (torre ? 0.6 : 1)
      pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: at, desde: t, hasta: t + carga, color: '#ef4444', estilo: 'laser', deA: unit.id, aB: foe.id })
      pose(battle, unit, 'canaliza', carga + 0.2)
      activar(unit, carga + 0.2, foe, { carga })
      break
    }
    case 'bumeran': {
      const n = torre ? 2 : 1
      for (let i = 0; i < n; i++) {
        const a = anguloA(unit, at) + (n === 1 ? 0 : (i - 0.5) * 0.5)
        proyectil(battle, unit, enDireccion(unit, a, 7.5), 0.8, 0.8, 'bumeran', { tipo: 'nada' }, { camino: { r: 0.95, golpe: 0.8 * f }, vuelta: unit.id })
      }
      activar(unit, 0.5, foe)
      break
    }
    case 'nube': {
      if (torre) {
        pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r: R, desde: t, hasta: t + 6, color: hab.color, estilo: 'gas', cadaS: 0.8, next: t + 0.2, golpe: 0.3 * f, ralentiza: 1.2 })
        activar(unit, 0.5, foe)
        break
      }
      const r = 2.6
      proyectil(battle, unit, at, Math.max(0.45, dist(unit, at) / 10), 2.2, 'frasco', { tipo: 'nube', r, dur: 6, golpe: 0.3 * f })
      activar(unit, 0.5, foe)
      break
    }
    case 'sombra': {
      if (!foe) return
      if (torre) {
        pon(battle, { k: 'pilar', id: battle.nextId++, x: foe.x, z: foe.z, desde: t, hasta: t + 0.8, color: '#111827', ancho: 0.9 })
        activar(unit, 0.7, foe, { torre: 1 })
        break
      }
      pose(battle, unit, 'invisible', 0.7)
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 1.4, desde: t, hasta: t + 0.5, color: '#1f2937' })
      activar(unit, 0.9, foe)
      break
    }
    case 'ruleta': {
      const premio = Math.floor(battle.rand() * 4)
      pon(battle, { k: 'ruleta', id: battle.nextId++, unitId: unit.id, desde: t, hasta: t + 1.6, premio })
      pose(battle, unit, 'canaliza', 1.3)
      activar(unit, 1.3, foe, { premio })
      break
    }
    case 'iman': {
      const r = torre ? R : 4.5
      if (torre) {
        unit.hab.burbuja = Math.max(unit.hab.burbuja, 6)
        unit.hab.burbujaHasta = t + 6
      }
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r, desde: t, hasta: t + 3, color: hab.color, estilo: 'iman', cadaS: 99, next: t + 99, golpe: 0, atrae: 2.8, sigue: unit.id })
      pose(battle, unit, 'canaliza', 3)
      activar(unit, 3, foe, { r })
      break
    }
    case 'duelo': {
      if (!foe) return
      const espera = (hab.variante === 'caza' ? 0.8 : 1) * (torre ? 0.6 : 1)
      pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: at, desde: t, hasta: t + espera, color: hab.color, estilo: 'laser', deA: unit.id, aB: foe.id })
      pon(battle, { k: 'onda', id: battle.nextId++, x: foe.x, z: foe.z, r: 1.3, desde: t, hasta: t + espera, color: hab.color })
      foe.hitStun = Math.max(foe.hitStun, espera)
      pose(battle, unit, 'canaliza', espera)
      activar(unit, espera + 0.1, foe, { espera })
      break
    }
    case 'abanico': {
      const v = hab.variante
      const n = v === 'barrera' ? 14 : (v === 'cuchillos' ? 5 : 6) + (torre ? (v === 'cuchillos' ? 3 : 4) : 0)
      const abanicos = v === 'cruzado' ? 2 : 1
      pose(battle, unit, 'canaliza', 0.6)
      activar(unit, 0.65, foe, { n, abanicos, i: 0, next: t, ang: anguloA(unit, at) })
      break
    }
    case 'kamikaze': {
      if (torre) {
        proyectil(battle, unit, at, Math.max(0.6, dist(unit, at) / 8), 3.5, 'dinamita', { tipo: 'bomba', r: 3, golpe: 2 * f, aturde: 0.8 }, { grande: 1.8 })
        unit.hab.listaEn = t + 14
        activar(unit, 0.5, foe)
        break
      }
      pose(battle, unit, 'carga', 4)
      activar(unit, 4, foe)
      break
    }
    case 'estampida': {
      const n = torre ? 4 : 3
      const ang = anguloA(unit, at)
      for (let i = 0; i < n; i++) {
        const lado = (i - (n - 1) / 2) * 1.6
        const de = { x: unit.x + M.cos(ang) * lado, z: unit.z - M.sin(ang) * lado }
        pon(battle, {
          k: 'proy',
          id: battle.nextId++,
          side: unit.side,
          from: de,
          to: dentro(enDireccion(de, ang, 11)),
          desde: t + i * 0.12,
          dur: 1.3,
          alto: 0,
          modelo: 'toro',
          color: hab.color,
          impacto: { tipo: 'nada' },
          camino: { r: 1.15, golpe: 0.8 * f, empuja: 2.6, aturde: 0.5 },
          vistos: [],
        })
      }
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    // ------------------------------------------------------------ Solo de torre
    case 'torreta': {
      pose(battle, unit, 'canaliza', 5)
      activar(unit, 5, foe, { next: t })
      break
    }
    case 'apuesta': {
      const victimas = enemigosEn(battle, unit.side, unit, R).slice(0, 5)
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: R, desde: t, hasta: t + 0.7, color: hab.color })
      for (const e of victimas) {
        const carta = Math.floor(battle.rand() * 4)
        const color = ['#ef4444', '#a78bfa', '#38bdf8', '#111827'][carta]!
        pon(battle, { k: 'pilar', id: battle.nextId++, x: e.x, z: e.z, desde: t, hasta: t + 0.7, color, ancho: 0.5 })
        if (carta === 0) golpear(battle, e, 1.2 * f, e)
        else if (carta === 1) golpear(battle, e, 0.3 * f, e, { aturde: 1.6 })
        else if (carta === 2) golpear(battle, e, 0.3 * f, e, { ralentiza: 4 })
        else e.hab.cegadoHasta = Math.max(e.hab.cegadoHasta, t + 5)
      }
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'nido': {
      const lejanos = enemigosEn(battle, unit.side, unit, R)
        .sort((a, b) => dist(b, unit) - dist(a, unit))
        .slice(0, 3)
      pose(battle, unit, 'canaliza', 1.3)
      activar(unit, 1.3, foe, { i: 0, next: t + 0.25 })
      unit.hab.activa!.ids = lejanos.map((u) => u.id)
      for (const e of lejanos) pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: e.x, z: e.z }, desde: t, hasta: t + 1.2, color: '#ef4444', estilo: 'laser', deA: unit.id, aB: e.id })
      break
    }
    case 'rugido': {
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: R, desde: t, hasta: t + 0.7, color: hab.color })
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: R * 0.65, desde: t + 0.15, hasta: t + 0.85, color: '#fde68a' })
      for (const e of enemigosEn(battle, unit.side, unit, R)) golpear(battle, e, 0.4 * f, unit, { empuja: 3.2, ralentiza: 3, arma: true })
      pose(battle, unit, 'canaliza', 0.7)
      activar(unit, 0.7, foe)
      break
    }
    case 'cortina': {
      const ida = adelante(unit.side)
      const z = unit.z + ida * R * 0.65
      for (const dx of [-3.4, 0, 3.4]) {
        pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x + dx * 0.9, z, r: 1.8, desde: t, hasta: t + 4, color: hab.color, estilo: 'balas', cadaS: 0.5, next: t + 0.3, golpe: 0.25 * f })
      }
      pose(battle, unit, 'baile', 4)
      activar(unit, 4, foe)
      break
    }
    case 'orbita': {
      for (const a0 of [0, Math.PI]) {
        pon(battle, {
          k: 'proy',
          id: battle.nextId++,
          side: unit.side,
          from: { x: unit.x, z: unit.z },
          to: { x: unit.x, z: unit.z },
          desde: t,
          dur: 4.5,
          alto: 0.9,
          modelo: 'bumeran',
          color: hab.color,
          impacto: { tipo: 'nada' },
          camino: { r: 0.9, golpe: 0.5 * f },
          vistos: [],
          orbita: { unitId: unit.id, r: R * 0.75, w: 3.2, a0 },
        })
      }
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'humareda': {
      battle.smokes.push({ id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, radius: R, until: t + 6 })
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: R, desde: t, hasta: t + 0.8, color: hab.color })
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'cepos': {
      const ida = adelante(unit.side)
      for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * 0.55
        const at = dentro({ x: unit.x + M.sin(a) * R * 0.7, z: unit.z + ida * M.cos(a) * R * 0.7 })
        pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: at.x, z: at.z, r: 0.9, desde: t, hasta: t + 12, color: hab.color, estilo: 'red', cadaS: 0.2, next: t + 0.2, golpe: 0, atrapa: 2.6, usos: 1 })
      }
      pose(battle, unit, 'canaliza', 0.8)
      activar(unit, 0.8, foe)
      break
    }
    case 'botica': {
      const heridos = amigosEn(battle, unit.side, unit, R)
        .filter((a) => a.shields < a.maxShields)
        .sort((a, b) => a.shields / a.maxShields - b.shields / b.maxShields)
        .slice(0, 4)
      for (const a of heridos) {
        proyectil(battle, unit, { x: a.x, z: a.z }, Math.max(0.4, dist(unit, a) / 9), 2.2, 'frasco', { tipo: 'cura', cura: 1.2 * poderDe(unit), unitId: a.id })
      }
      pose(battle, unit, 'canaliza', 0.6)
      activar(unit, 0.6, foe)
      break
    }
    case 'reto': {
      pose(battle, unit, 'canaliza', 2.1)
      activar(unit, 2.1, foe, { i: 0, next: t, apunta: -1 })
      break
    }
    case 'cartel': {
      const duro = enemigosEn(battle, unit.side, unit, R).sort((a, b) => b.shields - a.shields)[0]
      if (duro) {
        duro.hab.cartelHasta = t + 6
        pon(battle, { k: 'pilar', id: battle.nextId++, x: duro.x, z: duro.z, desde: t, hasta: t + 0.8, color: hab.color, ancho: 0.7 })
        pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: duro.x, z: duro.z }, desde: t, hasta: t + 0.6, color: hab.color, estilo: 'laser', deA: unit.id, aB: duro.id })
      }
      pose(battle, unit, 'canaliza', 0.6)
      activar(unit, 0.6, duro ?? foe)
      break
    }
    case 'tormenta': {
      pose(battle, unit, 'canaliza', 4)
      activar(unit, 4, foe, { next: t })
      break
    }
    case 'santuario': {
      pon(battle, { k: 'pilar', id: battle.nextId++, x: unit.x, z: unit.z, desde: t, hasta: t + 1.2, color: hab.color, ancho: 1.4 })
      pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: R, desde: t, hasta: t + 0.9, color: hab.color })
      for (const a of amigosEn(battle, unit.side, unit, R)) a.shields = Math.min(a.maxShields, a.shields + poderDe(unit))
      for (const e of enemigosEn(battle, unit.side, unit, R).slice(0, 5)) {
        pon(battle, { k: 'pilar', id: battle.nextId++, x: e.x, z: e.z, desde: t, hasta: t + 0.8, color: '#fef08a', ancho: 0.6 })
        golpear(battle, e, 0.9 * f, e, { aturde: 0.5 })
      }
      pose(battle, unit, 'canaliza', 1.2)
      activar(unit, 1.2, foe)
      break
    }
    case 'nana': {
      const r = torre ? 4.4 : 3.4
      pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: unit.x, z: unit.z, r, desde: t, hasta: t + 3.5, color: hab.color, estilo: 'sueno', cadaS: 0.5, next: t + 0.3, golpe: 0, duerme: 2.6 })
      pose(battle, unit, 'canaliza', 1.2)
      activar(unit, 1.2, foe)
      break
    }
  }
  unit.hab.listaEn = Math.max(unit.hab.listaEn, t + hab.cdS)
}

// ---------------------------------------------------------------------------
// Mientras dura
// ---------------------------------------------------------------------------

/**
 * Un paso de la habilidad en curso. Devuelve `true` si la habilidad sigue mandando en la tropa
 * (entonces el motor no la mueve ni la hace disparar).
 */
export function pasoHabilidad(battle: Battle, unit: Unit, dt: number): boolean {
  const a = unit.hab.activa
  if (!a) return false
  a.t += dt
  const hab = a.h
  const R = hab.rango ?? 6
  const f = fuerza(unit)
  const t = battle.time
  const foe = a.objetivo !== null ? battle.units.find((u) => u.id === a.objetivo) ?? null : null
  const vivo = foe && alive(foe) ? foe : null
  const n = a.n
  unit.state = 'fuego'
  unit.duelWith = null
  unit.fireIn = null

  switch (hab.mecanica) {
    case 'llamas': {
      // Sigue al objetivo (la torre barre de lado a lado).
      let ang = n.ang!
      if (unit.torre) ang = n.ang! + M.sin(a.t * 2.2) * 1.1
      else if (vivo) ang = anguloA(unit, vivo)
      n.ang = unit.torre ? n.ang! : ang
      unit.heading = ang
      const cono = battle.efectos.find((e) => e.k === 'cono' && e.unitId === unit.id)
      if (cono && cono.k === 'cono') cono.ang = ang
      if (t >= n.next!) {
        n.next = t + 0.35
        const alcance = cono && cono.k === 'cono' ? cono.alcance : 4
        for (const e of enemigosEn(battle, unit.side, unit, alcance)) {
          const d = Math.abs(((anguloA(unit, e) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
          if (d > 0.55) continue
          if (hab.variante === 'acido') golpear(battle, e, 0.3 * f, unit, { ralentiza: 2.5 })
          else golpear(battle, e, 0.28 * f, unit)
          if (alive(e)) {
            e.hab.quemaHasta = Math.max(e.hab.quemaHasta, t + 3)
            if (e.hab.quemaNext < t) e.hab.quemaNext = t + 0.8
          }
        }
      }
      break
    }
    case 'torbellino': {
      const orbita = hab.variante === 'orbita'
      if (!unit.torre) {
        if (orbita && vivo) {
          n.orb = n.orb! + dt * 4.2
          const destino = dentro({ x: vivo.x + M.sin(n.orb) * 1.6, z: vivo.z + M.cos(n.orb) * 1.6 })
          unit.x += (destino.x - unit.x) * Math.min(1, dt * 8)
          unit.z += (destino.z - unit.z) * Math.min(1, dt * 8)
        } else {
          // Sin rumbo: cambia de direccion cada poco, y rebota en los bordes.
          if (t >= n.cambia!) {
            n.cambia = t + 0.45 + battle.rand() * 0.4
            const haciaEnemigo = vivo ? anguloA(unit, vivo) : n.dir!
            n.dir = haciaEnemigo + (battle.rand() - 0.5) * 2.4
          }
          const p = dentro(enDireccion(unit, n.dir!, 2.6 * dt))
          // Si choca con el borde, sale rebotado hacia otro lado.
          if (Math.abs(p.x - unit.x - M.sin(n.dir!) * 2.6 * dt) > 0.001) n.dir = -n.dir!
          unit.x = p.x
          unit.z = p.z
        }
      }
      if (t >= n.next!) {
        n.next = t + 0.35
        const r = unit.torre ? R : 1.8
        // El filo del hacha girando: un aro que barre alrededor en cada golpe.
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: r + 0.3, desde: t, hasta: t + 0.35, color: hab.color })
        for (const e of enemigosEn(battle, unit.side, unit, r)) golpear(battle, e, 0.45 * f, unit, { empuja: 0.9, arma: true })
      }
      break
    }
    case 'bola': {
      if (unit.torre) break
      if (n.fase === undefined) n.fase = 0
      if (n.fase === 0) {
        const tx = vivo ? vivo.x : n.tx!
        const tz = vivo ? vivo.z : n.tz!
        const d = M.hypot(tx - unit.x, tz - unit.z)
        unit.heading = M.atan2(tx - unit.x, tz - unit.z)
        const paso = Math.min(d, 8 * dt)
        unit.x += M.sin(unit.heading) * paso
        unit.z += M.cos(unit.heading) * paso
        if (d <= 1 || a.t > 2.4) {
          const grande = hab.variante === 'grande'
          const r = grande ? 2 : 1.2
          pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: r + 0.6, desde: t, hasta: t + 0.5, color: hab.color })
          for (const e of enemigosEn(battle, unit.side, unit, r)) golpear(battle, e, 1 * f, unit, { aturde: 1.6, empuja: 1.8, arma: true })
          n.fase = 1
          a.dur = a.t + 0.4
          unit.hab.poseHasta = t + 0.4
        }
      }
      break
    }
    case 'teleporte': {
      if (a.t >= 0.8 && !n.hecho) {
        n.hecho = 1
        const ida = adelante(unit.side)
        if (unit.torre) {
          // De torre: manda a los enemigos de vuelta a su campo.
          for (const e of enemigosEn(battle, unit.side, unit, R)) {
            const to = dentro({ x: e.x, z: e.z - ida * 6 })
            battle.events.push({ type: 'teleport', side: e.side, from: { x: e.x, z: e.z }, to })
            e.x = to.x
            e.z = to.z
            e.slowUntil = Math.max(e.slowUntil, t + 1.5)
          }
        } else {
          const limite = FORT_Z - SIEGE_RANGE + 0.5
          for (const amigo of amigosEn(battle, unit.side, unit, 5.5)) {
            if (amigo.torre) continue
            const z = amigo.z + ida * 6
            const to = dentro({ x: amigo.x, z: ida < 0 ? Math.max(-limite, z) : Math.min(limite, z) })
            battle.events.push({ type: 'teleport', side: amigo.side, from: { x: amigo.x, z: amigo.z }, to })
            pon(battle, { k: 'onda', id: battle.nextId++, x: to.x, z: to.z, r: 1.5, desde: t, hasta: t + 0.6, color: hab.color })
            amigo.x = to.x
            amigo.z = to.z
            amigo.duelWith = null
          }
        }
      }
      break
    }
    case 'trompo': {
      unit.heading += dt * 11
      if (t >= n.next! && n.i! < n.vueltas!) {
        n.next = t + 0.6
        const base = battle.rand() * Math.PI
        for (let k = 0; k < n.tiros!; k++) {
          const ang = base + (k / n.tiros!) * Math.PI * 2
          pon(battle, {
            k: 'proy',
            id: battle.nextId++,
            side: unit.side,
            from: { x: unit.x, z: unit.z },
            to: dentro(enDireccion(unit, ang, 7)),
            desde: t + (k / n.tiros!) * 0.5,
            dur: 0.45,
            alto: 0,
            modelo: 'bala',
            color: hab.color,
            impacto: { tipo: 'nada' },
            camino: { r: 0.6, golpe: 0.35 * f, primero: true },
            vistos: [],
          })
        }
        n.i = n.i! + 1
      }
      break
    }
    case 'lazo': {
      if (vivo) {
        const d = dist(unit, vivo)
        if (d > 1.3) {
          const paso = Math.min(d - 1.3, 10 * dt)
          vivo.x += ((unit.x - vivo.x) / d) * paso
          vivo.z += ((unit.z - vivo.z) / d) * paso
          vivo.hitStun = Math.max(vivo.hitStun, 0.2)
        } else if (!n.hecho) {
          n.hecho = 1
          golpear(battle, vivo, 0.5 * f, unit, { aturde: unit.torre ? 0.4 : 1.2 })
          if (unit.torre) vivo.hab.redHasta = t + 2.2
        }
      }
      break
    }
    case 'salto': {
      const k = Math.min(1, a.t / 0.6)
      unit.x = n.ox! + (n.tx! - n.ox!) * k
      unit.z = n.oz! + (n.tz! - n.oz!) * k
      if (k >= 1 && !n.hecho) {
        n.hecho = 1
        const r = n.r!
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r, desde: t, hasta: t + 0.6, color: hab.color })
        battle.events.push({ type: 'blast', x: unit.x, z: unit.z, r: r * 0.6, side: unit.side })
        for (const e of enemigosEn(battle, unit.side, unit, r)) golpear(battle, e, (hab.variante === 'pisoton' ? 1.2 : 1) * f, unit, { empuja: 2.6, aturde: 0.6, arma: true })
      }
      break
    }
    case 'carga': {
      // De torre solo lanza (las cuchillas y bayonetas ya van solas).
      if (unit.torre) break
      const largo = hab.variante === 'sprint' ? 3.5 : 6.5
      const tramoDur = 0.45
      const i = Math.min(n.tramos! - 1, Math.floor(a.t / tramoDur))
      if (i !== n.tramo) {
        n.tramo = i
        n.ox = unit.x
        n.oz = unit.z
        const vuelta = hab.variante === 'estocada' && i % 2 === 1
        const zig = hab.variante === 'sprint' ? (i % 2 === 0 ? 0.7 : -0.7) : 0
        n.ang = (vuelta ? n.ang! + Math.PI : n.ang!) + zig
      }
      const k = Math.min(1, (a.t - i * tramoDur) / tramoDur)
      const p = dentro(enDireccion({ x: n.ox!, z: n.oz! }, n.ang!, largo * k))
      unit.x = p.x
      unit.z = p.z
      unit.heading = n.ang!
      for (const e of enemigosEn(battle, unit.side, unit, 1)) {
        // En cada tramo puede volver a dar al mismo (la estocada de vuelta, el zigzag).
        const clave = e.id * 10 + i
        if (a.ids.includes(clave)) continue
        a.ids.push(clave)
        golpear(battle, e, 0.9 * f, unit, { empuja: 1.4, arma: true })
      }
      if (a.t % 0.1 < dt) pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 0.7, desde: t, hasta: t + 0.4, color: '#d6b98a' })
      break
    }
    case 'mortero': {
      if (t >= n.next! && n.i! < n.n!) {
        n.next = t + 0.35
        n.i = n.i! + 1
        const tx = (vivo ? vivo.x : n.tx!) + (battle.rand() - 0.5) * 2.6
        const tz = (vivo ? vivo.z : n.tz!) + (battle.rand() - 0.5) * 2.6
        const granada = hab.variante === 'granadas'
        const dur = Math.max(0.7, dist(unit, { x: tx, z: tz }) / 7)
        pon(battle, { k: 'zona', id: battle.nextId++, side: unit.side, x: tx, z: tz, r: granada ? 1.5 : 1.8, desde: t, hasta: t + dur, color: '#ef4444', estilo: 'aviso', cadaS: 99, next: t + 99, golpe: 0 })
        proyectil(battle, unit, { x: tx, z: tz }, dur, 3.5, granada ? 'granada' : 'dinamita', { tipo: 'bomba', r: granada ? 1.5 : 1.8, golpe: (granada ? 0.8 : 1) * f })
      }
      break
    }
    case 'meteoro': {
      if (a.t >= 1.4 && !n.hecho) {
        n.hecho = 1
        const at = { x: n.tx!, z: n.tz! }
        const santo = hab.variante === 'santo'
        pon(battle, { k: 'pilar', id: battle.nextId++, x: at.x, z: at.z, desde: t, hasta: t + 0.9, color: santo ? '#fde047' : '#f97316', ancho: n.r! * 0.8 })
        pon(battle, { k: 'onda', id: battle.nextId++, x: at.x, z: at.z, r: n.r! + 0.8, desde: t, hasta: t + 0.7, color: hab.color })
        battle.events.push({ type: 'blast', x: at.x, z: at.z, r: n.r!, side: unit.side })
        for (const e of enemigosEn(battle, unit.side, at, n.r!)) golpear(battle, e, (santo ? 1.6 : 2) * f, at, { aturde: santo ? 0.5 : 0.9, arma: true })
        if (santo) for (const amigo of amigosEn(battle, unit.side, at, n.r! + 1)) amigo.shields = Math.min(amigo.maxShields, amigo.shields + 1)
      }
      break
    }
    case 'rayo': {
      if (t >= n.next! && n.i! < n.saltos!) {
        n.next = t + 0.15
        const desde = { x: n.lx!, z: n.lz! }
        const sig = n.i === 0 && vivo ? vivo : cercano(battle, unit.side, desde, 4.5, a.ids)
        if (!sig) {
          n.i = n.saltos
          break
        }
        pon(battle, { k: 'linea', id: battle.nextId++, from: desde, to: { x: sig.x, z: sig.z }, desde: t, hasta: t + 0.35, color: hab.color, estilo: 'rayo' })
        golpear(battle, sig, 0.7 * f, desde, { aturde: 0.5 })
        n.lx = sig.x
        n.lz = sig.z
        a.ids.push(sig.id)
        n.i = n.i! + 1
      }
      break
    }
    case 'ruleta': {
      if (a.t >= 1.2 && !n.hecho) {
        n.hecho = 1
        const objetivo = vivo ?? cercano(battle, unit.side, unit, unit.card.range + 2)
        if (n.premio === 0 && objetivo) {
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: objetivo.x, z: objetivo.z }, desde: t, hasta: t + 0.4, color: '#fde047', estilo: 'estela' })
          golpear(battle, objetivo, 3 * f, unit, { arma: true })
        } else if (n.premio === 1) {
          for (const e of enemigosEn(battle, unit.side, unit, unit.card.range + 2).slice(0, 3)) {
            pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: e.x, z: e.z }, desde: t, hasta: t + 0.3, color: '#f87171', estilo: 'estela' })
            golpear(battle, e, 1 * f, unit)
          }
        } else if (n.premio === 2) {
          unit.shields = Math.min(unit.maxShields, unit.shields + 2)
          pon(battle, { k: 'pilar', id: battle.nextId++, x: unit.x, z: unit.z, desde: t, hasta: t + 0.8, color: '#4ade80', ancho: 0.8 })
        } else if (objetivo) {
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: objetivo.x, z: objetivo.z }, desde: t, hasta: t + 0.4, color: '#a78bfa', estilo: 'estela' })
          golpear(battle, objetivo, 1 * f, unit, { aturde: 2 })
        }
      }
      break
    }
    case 'iman': {
      // Los de dentro se arrastran hacia el y le disparan a el.
      for (const e of enemigosEn(battle, unit.side, unit, n.r!)) {
        const d = dist(e, unit)
        if (d < 1.2) continue
        const paso = Math.min(d - 1.2, 2.8 * dt)
        e.x += ((unit.x - e.x) / d) * paso
        e.z += ((unit.z - e.z) / d) * paso
      }
      if (a.t >= a.dur - dt * 1.5 && !n.hecho) {
        n.hecho = 1
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: n.r!, desde: t, hasta: t + 0.6, color: hab.color })
        for (const e of enemigosEn(battle, unit.side, unit, 2)) golpear(battle, e, 0.6 * f, unit, { aturde: 0.6 })
      }
      break
    }
    case 'duelo': {
      if (a.t >= n.espera! && !n.hecho) {
        n.hecho = 1
        if (vivo) {
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: vivo.x, z: vivo.z }, desde: t, hasta: t + 0.35, color: '#fde047', estilo: 'estela' })
          golpear(battle, vivo, (hab.variante === 'caza' ? 3 : 2.5) * f, unit, { aturde: 1.2, arma: true })
        }
      }
      break
    }
    case 'abanico': {
      if (t >= n.next! && n.i! < n.n! * n.abanicos!) {
        n.next = t + 0.6 / (n.n! * n.abanicos!)
        const i = n.i!
        const cual = n.abanicos === 2 ? i % 2 : 0
        const k = Math.floor(i / n.abanicos!) / Math.max(1, n.n! - 1)
        const barrido = (k - 0.5) * (hab.variante === 'barrera' ? 2.6 : 1.3) * (cual === 1 ? -1 : 1)
        const ang = n.ang! + barrido
        const cuchillo = hab.variante === 'cuchillos'
        pon(battle, {
          k: 'proy',
          id: battle.nextId++,
          side: unit.side,
          from: { x: unit.x + (n.abanicos === 2 ? (cual ? 0.35 : -0.35) : 0), z: unit.z },
          to: dentro(enDireccion(unit, ang, unit.torre ? R + 0.5 : unit.card.range + 2.5)),
          desde: t,
          dur: 0.4,
          alto: 0,
          modelo: cuchillo ? 'cuchillo' : 'bala',
          color: hab.color,
          impacto: { tipo: 'nada' },
          camino: { r: 0.65, golpe: (cuchillo ? 0.45 : 0.5) * f, primero: true, ralentiza: cuchillo ? 2.5 : undefined },
          vistos: [],
        })
        n.i = i + 1
      }
      break
    }
    case 'sombra': {
      if (!vivo) break
      if (n.torre) {
        if (a.t >= 0.6 && !n.hecho) {
          n.hecho = 1
          golpear(battle, vivo, 1.5 * f, vivo, { aturde: 1 })
          if (hab.variante === 'susto') for (const e of enemigosEn(battle, unit.side, vivo, 2.5)) e.slowUntil = Math.max(e.slowUntil, t + 2)
        }
        break
      }
      if (a.t >= 0.6 && !n.hecho) {
        n.hecho = 1
        // Aparece detras del enemigo (del lado de su propio fuerte).
        const atras = adelante(unit.side) * 1.1
        const p = dentro({ x: vivo.x, z: vivo.z + atras })
        unit.x = p.x
        unit.z = p.z
        unit.heading = anguloA(unit, vivo)
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 1.6, desde: t, hasta: t + 0.5, color: hab.variante === 'susto' ? '#a3a3a3' : '#334155' })
        golpear(battle, vivo, 2 * f, unit, { aturde: 1, arma: true })
        if (hab.variante === 'susto') for (const e of enemigosEn(battle, unit.side, unit, 2.6)) e.slowUntil = Math.max(e.slowUntil, t + 2.2)
      }
      break
    }
    case 'franco': {
      // Acaba de cargar la mirilla: el balazo.
      if (a.t >= n.carga! && !n.hecho) {
        n.hecho = 1
        if (vivo) {
          const leyenda = hab.variante === 'leyenda'
          const golpe = (leyenda ? 3 : hab.variante === 'largo' ? 2.5 : 1.8) * f
          const fin = leyenda ? enDireccion(unit, anguloA(unit, vivo), 30) : { x: vivo.x, z: vivo.z }
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: dentro(fin), desde: t, hasta: t + 0.35, color: leyenda ? '#fde047' : '#fef3c7', estilo: 'estela' })
          golpear(battle, vivo, golpe, unit, { arma: true })
          // La bala legendaria atraviesa a todos los de la linea.
          if (leyenda) {
            const ang = anguloA(unit, vivo)
            for (const e of enemigosEn(battle, unit.side, unit, 30)) {
              if (e === vivo) continue
              const rx = e.x - unit.x
              const rz = e.z - unit.z
              const along = rx * M.sin(ang) + rz * M.cos(ang)
              const lateral = Math.abs(rx * M.cos(ang) - rz * M.sin(ang))
              if (along > 0 && lateral < 0.8) golpear(battle, e, golpe * 0.8, unit, { arma: true })
            }
          }
        }
      }
      break
    }
    case 'torreta': {
      if (t >= n.next!) {
        n.next = t + 0.3
        const blanco = cercano(battle, unit.side, unit, R)
        if (blanco) {
          unit.heading = anguloA(unit, blanco)
          proyectil(battle, unit, enDireccion(unit, anguloA(unit, blanco), R + 1), 0.35, 0, 'bala', { tipo: 'nada' }, { camino: { r: 0.6, golpe: 0.3 * f, primero: true } })
        }
      }
      break
    }
    case 'nido': {
      if (t >= n.next! && n.i! < a.ids.length) {
        n.next = t + 0.3
        const e = battle.units.find((u) => u.id === a.ids[n.i!])
        n.i = n.i! + 1
        if (e && alive(e)) {
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: e.x, z: e.z }, desde: t, hasta: t + 0.3, color: '#fde047', estilo: 'estela' })
          golpear(battle, e, 1.8 * f, unit, { arma: true })
        }
      }
      break
    }
    case 'reto': {
      // Cada 0,7 s un duelo: medio segundo quietos mirándose… y su tiro.
      if (t >= n.next! && n.i! < 3) {
        if (n.apunta! < 0) {
          const e = cercano(battle, unit.side, unit, R, a.ids)
          if (!e) {
            n.i = 3
            break
          }
          a.ids.push(e.id)
          n.apunta = e.id
          e.hitStun = Math.max(e.hitStun, 0.5)
          pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: e.x, z: e.z }, desde: t, hasta: t + 0.45, color: hab.color, estilo: 'laser', deA: unit.id, aB: e.id })
          n.next = t + 0.45
        } else {
          const e = battle.units.find((u) => u.id === n.apunta)
          if (e && alive(e)) {
            pon(battle, { k: 'linea', id: battle.nextId++, from: { x: unit.x, z: unit.z }, to: { x: e.x, z: e.z }, desde: t, hasta: t + 0.3, color: '#fde047', estilo: 'estela' })
            golpear(battle, e, 1.5 * f, unit, { aturde: 0.8, arma: true })
          }
          n.apunta = -1
          n.i = n.i! + 1
          n.next = t + 0.25
        }
      }
      break
    }
    case 'tormenta': {
      if (t >= n.next!) {
        n.next = t + 0.5
        const lista = enemigosEn(battle, unit.side, unit, R)
        const e = lista[Math.floor(battle.rand() * lista.length)]
        if (e) {
          pon(battle, { k: 'pilar', id: battle.nextId++, x: e.x, z: e.z, desde: t, hasta: t + 0.35, color: hab.color, ancho: 0.35 })
          pon(battle, { k: 'onda', id: battle.nextId++, x: e.x, z: e.z, r: 1.2, desde: t, hasta: t + 0.4, color: '#e0e7ff' })
          golpear(battle, e, 0.6 * f, e, { aturde: 0.4 })
        }
      }
      break
    }
    case 'kamikaze': {
      if (unit.torre) break
      const tx = vivo ? vivo.x : unit.x
      const tz = vivo ? vivo.z : unit.z + adelante(unit.side) * 3
      const d = M.hypot(tx - unit.x, tz - unit.z)
      unit.heading = M.atan2(tx - unit.x, tz - unit.z)
      const paso = Math.min(d, 5.5 * dt)
      unit.x += M.sin(unit.heading) * paso
      unit.z += M.cos(unit.heading) * paso
      if (d < 0.9 || a.t > 3.5) {
        // Explota: el estilo ya lo tiene (explota al caer).
        unit.sacrificado = true
        pon(battle, { k: 'onda', id: battle.nextId++, x: unit.x, z: unit.z, r: 3, desde: t, hasta: t + 0.6, color: '#f97316' })
        for (const e of enemigosEn(battle, unit.side, unit, 2.6)) golpear(battle, e, 1.2 * f, unit, { arma: true })
        unit.hab.activa = null
        hurtUnit(battle, unit, unit.shields + 99, false)
        return true
      }
      break
    }
  }

  if (a.t >= a.dur) {
    unit.hab.activa = null
    // Lo que deja cada una al acabar.
    if (hab.mecanica === 'trompo' && !unit.torre) {
      unit.hab.mareoHasta = t + 1.4
      pose(battle, unit, 'mareo', 1.4)
    } else if (hab.mecanica === 'torbellino' && !unit.torre && hab.variante !== 'orbita') {
      unit.hab.mareoHasta = t + 1.1
      pose(battle, unit, 'mareo', 1.1)
    }
    if (hab.mecanica === 'lluvia' || hab.mecanica === 'trompo') {
      // Recarga despues de vaciarlo todo.
      unit.ammo = 0
      unit.reloadLeft = unit.recargaS
      battle.events.push({ type: 'reload', unitId: unit.id, x: unit.x, z: unit.z })
    }
    unit.cooldown = Math.max(unit.cooldown, 0.3)
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Lo que hay en el campo
// ---------------------------------------------------------------------------

/** Mueve proyectiles, aplica las zonas y quita lo que se ha acabado. */
export function pasoEfectos(battle: Battle) {
  if (battle.efectos.length === 0) return
  const t = battle.time
  const nuevos: Efecto[] = []
  const siguen: Efecto[] = []
  const antes = battle.efectos
  battle.efectos = nuevos
  for (const e of antes) {
    switch (e.k) {
      case 'zona': {
        if (e.sigue !== undefined) {
          const u = battle.units.find((x) => x.id === e.sigue)
          if (u && alive(u)) {
            e.x = u.x
            e.z = u.z
          }
        }
        if (t >= e.next && t <= e.hasta) {
          e.next = t + e.cadaS
          if (e.estilo === 'cura' || e.estilo === 'ronda') {
            for (const a of amigosEn(battle, e.side, e, e.r)) {
              if (e.cura) a.shields = Math.min(a.maxShields, a.shields + e.cura)
            }
          } else {
            for (const foe of enemigosEn(battle, e.side, e, e.r)) {
              if (e.golpe > 0) hurtUnit(battle, foe, e.golpe, false, e)
              if (!alive(foe)) continue
              if (e.ralentiza) foe.slowUntil = Math.max(foe.slowUntil, t + e.ralentiza)
              // Se duerme si esta despierto (y no le acaban de despertar a golpes).
              if (e.duerme && t > foe.hab.suenoHasta + 1) foe.hab.suenoHasta = t + e.duerme
              if (e.atrapa) foe.hab.redHasta = Math.max(foe.hab.redHasta, t + e.atrapa)
              // Los lazos tendidos se gastan con el primero que atrapan.
              if (e.usos !== undefined) {
                e.usos -= 1
                if (e.usos <= 0) {
                  e.hasta = t + 3
                  e.next = t + 99
                  break
                }
              }
            }
          }
        }
        if (t <= e.hasta) siguen.push(e)
        break
      }
      case 'proy': {
        if (t < e.desde) {
          siguen.push(e)
          break
        }
        const k = Math.min(1, (t - e.desde) / e.dur)
        // El bumeran vuelve: la ida en la primera mitad y la vuelta en la segunda.
        let pos: Vec
        if (e.orbita) {
          const u = battle.units.find((x) => x.id === e.orbita!.unitId)
          const centro = u && alive(u) ? u : e.from
          const ang = e.orbita.a0 + (t - e.desde) * e.orbita.w
          pos = { x: centro.x + M.cos(ang) * e.orbita.r, z: centro.z + M.sin(ang) * e.orbita.r }
          // Cada vuelta puede volver a dar al mismo.
          if (Math.floor(((t - e.desde) * e.orbita.w) / (Math.PI * 2)) !== Math.floor(((t - e.desde - 1 / 60) * e.orbita.w) / (Math.PI * 2))) e.vistos = []
        } else if (e.vuelta !== undefined) {
          const u = battle.units.find((x) => x.id === e.vuelta)
          const casa = u && alive(u) ? { x: u.x, z: u.z } : e.from
          const ida = Math.min(1, k * 2)
          const vuelta = Math.max(0, k * 2 - 1)
          pos =
            k < 0.5
              ? { x: e.from.x + (e.to.x - e.from.x) * ida, z: e.from.z + (e.to.z - e.from.z) * ida }
              : { x: e.to.x + (casa.x - e.to.x) * vuelta, z: e.to.z + (casa.z - e.to.z) * vuelta }
          if (k >= 0.5 && e.vistos.length > 0 && !e.vistos.includes(-1)) e.vistos = [-1]
        } else {
          pos = { x: e.from.x + (e.to.x - e.from.x) * k, z: e.from.z + (e.to.z - e.from.z) * k }
        }
        let gastado = false
        if (e.camino) {
          for (const foe of enemigosEn(battle, e.side, pos, e.camino.r)) {
            if (e.vistos.includes(foe.id)) continue
            e.vistos.push(foe.id)
            golpear(battle, foe, e.camino.golpe, pos, { aturde: e.camino.aturde, empuja: e.camino.empuja, ralentiza: e.camino.ralentiza })
            if (e.camino.primero) {
              gastado = true
              break
            }
          }
        }
        if (gastado) break
        if (k >= 1) {
          impactar(battle, e)
          break
        }
        siguen.push(e)
        break
      }
      default:
        if (t <= e.hasta) siguen.push(e)
    }
  }
  battle.efectos = [...siguen, ...nuevos]
}

function impactar(battle: Battle, e: Extract<Efecto, { k: 'proy' }>) {
  const t = battle.time
  const at = e.to
  const imp = e.impacto
  switch (imp.tipo) {
    case 'red':
      pon(battle, { k: 'zona', id: battle.nextId++, side: e.side, x: at.x, z: at.z, r: imp.r, desde: t, hasta: t + imp.dur, color: '#e7e5e4', estilo: 'red', cadaS: 99, next: t + 99, golpe: 0 })
      for (const foe of enemigosEn(battle, e.side, at, imp.r)) {
        foe.hab.redHasta = Math.max(foe.hab.redHasta, t + imp.dur)
        hurtUnit(battle, foe, 0.25, false, at)
      }
      break
    case 'bomba':
      battle.events.push({ type: 'blast', x: at.x, z: at.z, r: imp.r, side: e.side })
      pon(battle, { k: 'onda', id: battle.nextId++, x: at.x, z: at.z, r: imp.r + 0.4, desde: t, hasta: t + 0.5, color: '#fb923c' })
      for (const foe of enemigosEn(battle, e.side, at, imp.r)) golpear(battle, foe, imp.golpe, at, { aturde: imp.aturde, arma: true })
      break
    case 'nube':
      pon(battle, { k: 'zona', id: battle.nextId++, side: e.side, x: at.x, z: at.z, r: imp.r, desde: t, hasta: t + imp.dur, color: e.color, estilo: 'gas', cadaS: 0.8, next: t + 0.2, golpe: imp.golpe, ralentiza: 1.2 })
      break
    case 'pica': {
      const u = battle.units.find((x) => x.id === imp.unitId)
      if (u && alive(u)) {
        golpear(battle, u, imp.golpe, at)
        u.hab.cegadoHasta = Math.max(u.hab.cegadoHasta, t + imp.ciega)
      }
      break
    }
    case 'golpe': {
      const u = battle.units.find((x) => x.id === imp.unitId)
      if (u && alive(u)) golpear(battle, u, imp.golpe, at, { ralentiza: imp.ralentiza })
      break
    }
    case 'cura': {
      const u = battle.units.find((x) => x.id === imp.unitId)
      if (u && alive(u)) {
        u.shields = Math.min(u.maxShields, u.shields + imp.cura)
        pon(battle, { k: 'pilar', id: battle.nextId++, x: u.x, z: u.z, desde: t, hasta: t + 0.7, color: '#4ade80', ancho: 0.6 })
      }
      break
    }
    case 'nada':
      break
  }
}

/** Donde esta ahora un proyectil (para pintarlo): posicion en el suelo y altura. */
export function posicionDe(battle: Battle, e: Extract<Efecto, { k: 'proy' }>): { x: number; y: number; z: number; k: number } {
  const k = Math.min(1, Math.max(0, (battle.time - e.desde) / e.dur))
  if (e.orbita) {
    const u = battle.units.find((x) => x.id === e.orbita!.unitId)
    const centro = u ?? e.from
    const ang = e.orbita.a0 + (battle.time - e.desde) * e.orbita.w
    return { x: centro.x + M.cos(ang) * e.orbita.r, y: 1.6, z: centro.z + M.sin(ang) * e.orbita.r, k }
  }
  if (e.vuelta !== undefined) {
    const u = battle.units.find((x) => x.id === e.vuelta)
    const casa = u ? { x: u.x, z: u.z } : e.from
    const ida = Math.min(1, k * 2)
    const vuelta = Math.max(0, k * 2 - 1)
    const p = k < 0.5 ? { x: e.from.x + (e.to.x - e.from.x) * ida, z: e.from.z + (e.to.z - e.from.z) * ida } : { x: e.to.x + (casa.x - e.to.x) * vuelta, z: e.to.z + (casa.z - e.to.z) * vuelta }
    return { x: p.x, y: e.alto, z: p.z, k }
  }
  return {
    x: e.from.x + (e.to.x - e.from.x) * k,
    y: e.alto * 4 * k * (1 - k) + (e.alto === 0 ? 0.35 : 0.9),
    z: e.from.z + (e.to.z - e.from.z) * k,
    k,
  }
}

