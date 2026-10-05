import type { BattleCard } from '../cards/model'
import { estiloDe } from './estilos'
import type { Estilo } from './estilos'

/**
 * **Los sellos.** Cada carta de batalla lleva un sello, y el sello es lo que manda en la pelea: dice
 * para qué sirve la carta (aguantar, matar rápido, tirar de lejos, curar, reventar grupos…), cómo
 * va de soldado y cómo va de torre, y contra quién es fuerte o débil. El **estilo** de la carta es su
 * variante: dos tanques son tanques, pero cada uno a su manera (uno pega en área, otro empuja…).
 *
 * Así sacar cartas deja de ser soltar muñecos sin más: se monta un equipo. Dos tanques delante para
 * que se coman los tiros, un asesino para romper sus tanques, alguien que cure detrás…
 *
 * Las ventajas, en corto:
 *  - el **tanque** casi no recibe daño… salvo del **asesino** y del **área**;
 *  - el **asesino** va a por los tanques, pero el **control** lo frena y le pega más;
 *  - el **área** revienta grupos, pero la **distancia** le pega el doble;
 *  - el **apoyo** no pega: cura;
 *  - el **asalto** es el de siempre, sin ventajas ni pegas.
 *
 * Todo lo de aquí lo usa el motor (es lo mismo en tu móvil y en el servidor).
 */

export type Sello = 'tanque' | 'asesino' | 'distancia' | 'apoyo' | 'area' | 'asalto' | 'control'

export const SELLOS_EN_ORDEN: Sello[] = ['tanque', 'asesino', 'distancia', 'area', 'asalto', 'control', 'apoyo']

/** Lo que cambia un sello (multiplica lo de la carta). */
export interface Mods {
  escudos: number
  velocidad: number
  /** Escudos que quita cada golpe a los soldados. */
  golpe: number
  /** La espera entre ataques (más = más lento). */
  cadencia: number
  alcance: number
  /** Lo que tarda en recargar. */
  recarga: number
  /** Daño al fuerte. */
  fuerte: number
}

const IGUAL: Mods = { escudos: 1, velocidad: 1, golpe: 1, cadencia: 1, alcance: 1, recarga: 1, fuerte: 1 }

export interface SelloInfo {
  id: Sello
  label: string
  /** Un emoji, para la página (el lienzo de la carta dibuja el suyo). */
  icono: string
  color: string
  /** Para qué sirve, en una línea. */
  nota: string
  soldado: string[]
  torre: string[]
  fuerte: string
  debil: string
  mods: { soldado: Mods; torre: Mods }
}

export const SELLOS: Record<Sello, SelloInfo> = {
  tanque: {
    id: 'tanque',
    label: 'Tanque',
    icono: '🛡️',
    color: '#94a3b8',
    nota: 'Aguanta delante y se come los tiros',
    soldado: ['Muy lento', 'El doble de escudos', 'Atrae los disparos de los rivales', 'Pega poco'],
    torre: ['Mucho alcance y mucha vida', 'No pega: frena a los que entran (y algunos aturden o congelan)'],
    fuerte: 'Solo le hacen daño de verdad los asesinos y los de área',
    debil: 'Los asesinos lo rompen',
    mods: {
      soldado: { ...IGUAL, escudos: 2, velocidad: 0.6, golpe: 0.5, cadencia: 1.15, fuerte: 0.6 },
      torre: { ...IGUAL, escudos: 1.5, alcance: 1.4, golpe: 0, fuerte: 0 },
    },
  },
  asesino: {
    id: 'asesino',
    label: 'Asesino',
    icono: '🗡️',
    color: '#f43f5e',
    nota: 'Rapidísimo y letal: va a por los tanques',
    soldado: ['Muy rápido', 'Pocos escudos', 'Quita muchísimo', 'Va primero a por los tanques'],
    torre: ['Golpea muy rápido y quita mucho', 'Poca defensa y poco alcance'],
    fuerte: 'Rompe a los tanques (les pega más que nadie)',
    debil: 'El control lo frena y le pega más; cae rápido',
    mods: {
      soldado: { ...IGUAL, escudos: 0.6, velocidad: 1.6, golpe: 1.7, cadencia: 0.85, fuerte: 1.15 },
      torre: { ...IGUAL, escudos: 0.6, alcance: 0.65, golpe: 1.3, cadencia: 0.55 },
    },
  },
  distancia: {
    id: 'distancia',
    label: 'Distancia',
    icono: '🎯',
    color: '#38bdf8',
    nota: 'Tira desde lejos a un solo blanco, hasta tumbarlo',
    soldado: ['Dispara desde muy lejos', 'Marca a un rival y no lo suelta', 'Nunca en área', 'Tarda en recargar'],
    torre: ['Muchísimo alcance', 'Dispara despacio'],
    fuerte: 'Le pega el doble a los de área',
    debil: 'Si le llegan cerca, cae',
    mods: {
      soldado: { ...IGUAL, alcance: 1.45, golpe: 1.2, recarga: 1.5 },
      torre: { ...IGUAL, alcance: 1.5, cadencia: 1.45 },
    },
  },
  apoyo: {
    id: 'apoyo',
    label: 'Apoyo',
    icono: '➕',
    color: '#4ade80',
    nota: 'No pega: cura a los suyos',
    soldado: ['No ataca', 'Cura en área o a uno solo (cada uno a su manera)'],
    torre: ['Junto a una torre o a tus soldados, los va curando', 'Poca vida'],
    fuerte: 'Mantiene vivos a tus tanques',
    debil: 'Sin nadie delante, no hace nada',
    mods: {
      soldado: { ...IGUAL, escudos: 0.9, velocidad: 0.95, golpe: 0, fuerte: 0.3 },
      torre: { ...IGUAL, escudos: 0.6, golpe: 0, fuerte: 0 },
    },
  },
  area: {
    id: 'area',
    label: 'Área',
    icono: '💥',
    color: '#fb923c',
    nota: 'Revienta grupos: cada golpe da a todos los de alrededor',
    soldado: ['Golpes en área, lentos', 'Quita mucho', 'Pocos escudos'],
    torre: ['Daño en área', 'Alcance medio y poca vida'],
    fuerte: 'Contra grupos y contra los tanques',
    debil: 'Los de distancia le pegan el doble',
    mods: {
      soldado: { ...IGUAL, escudos: 0.7, golpe: 1.15, cadencia: 1.5 },
      torre: { ...IGUAL, escudos: 0.6 },
    },
  },
  asalto: {
    id: 'asalto',
    label: 'Asalto',
    icono: '🔫',
    color: '#fbbf24',
    nota: 'El pistolero de siempre: bueno en todo',
    soldado: ['Normal en todo'],
    torre: ['Normal en todo'],
    fuerte: 'Sin pegas: sirve para cualquier hueco',
    debil: 'No destaca en nada',
    mods: { soldado: { ...IGUAL }, torre: { ...IGUAL } },
  },
  control: {
    id: 'control',
    label: 'Control',
    icono: '🌀',
    color: '#c084fc',
    nota: 'Como un mago: aturde, frena, empuja o congela',
    soldado: ['Lento', 'Poco daño y alcance medio', 'Sus golpes aturden, frenan, empujan o congelan (algunos, en área)'],
    torre: ['Bastante defensa y poco alcance', 'No pega: frena, aturde o empuja a los que entran'],
    fuerte: 'Para en seco a los asesinos (y les pega más)',
    debil: 'Hace poco daño',
    mods: {
      soldado: { ...IGUAL, escudos: 1.2, velocidad: 0.85, golpe: 0.85, alcance: 1.1, fuerte: 0.6 },
      torre: { ...IGUAL, escudos: 1.4, alcance: 0.75, golpe: 0, fuerte: 0 },
    },
  },
}

/** El sello de cada estilo (el mismo para el vaquero, el vikingo y el indio). */
const DE_ESTILO: Record<string, Sello> = {
  tanque: 'tanque',
  blindado: 'tanque',
  murallaCebo: 'tanque',
  cebo: 'tanque',
  matón: 'tanque',
  coloso: 'tanque',

  bailarina: 'asesino',
  estocada: 'asesino',
  kamikaze: 'asesino',
  sigilo: 'asesino',
  emboscada: 'asesino',
  caza: 'asesino',
  furia: 'asesino',
  corredor: 'asesino',

  francotirador: 'distancia',
  cerrojo: 'distancia',
  legendario: 'distancia',
  duelista: 'distancia',
  perfora: 'distancia',
  cuervo: 'distancia',

  medico: 'apoyo',
  sanadora: 'apoyo',
  escudera: 'apoyo',
  santo: 'apoyo',
  abanderado: 'apoyo',
  cantinero: 'apoyo',
  reina: 'apoyo',

  perdigones: 'area',
  escopetazo: 'area',
  dinamitero: 'area',
  canon: 'area',
  tumba: 'area',
  fuego: 'area',
  gas: 'area',
  circulo: 'area',
  veneno: 'area',
  barril: 'area',
  rebote: 'area',
  rebotaLargo: 'area',
  minigun: 'area',

  clasico: 'asalto',
  poker: 'asalto',
  doble: 'asalto',
  rafaga: 'asalto',
  rafagaLarga: 'asalto',
  fusileria: 'asalto',
  cuerpo: 'asalto',

  predicador: 'control',
  lazo: 'control',
  regano: 'control',
  cepos: 'control',
  cuchillos: 'control',
}

export const baseDelEstilo = (estilo: Pick<Estilo, 'id'>) => estilo.id.replace(/^[vi]:/, '')

export function selloDelEstilo(estilo: Pick<Estilo, 'id'>): Sello {
  return DE_ESTILO[baseDelEstilo(estilo)] ?? 'asalto'
}

export function selloDe(card: Pick<BattleCard, 'estilo'>): Sello {
  return selloDelEstilo(estiloDe(card))
}

export function infoDeSello(card: Pick<BattleCard, 'estilo'>): SelloInfo {
  return SELLOS[selloDe(card)]
}

export function modsDe(sello: Sello, torre: boolean): Mods {
  return torre ? SELLOS[sello].mods.torre : SELLOS[sello].mods.soldado
}

/** Quién pega: un sello, el arma del jugador (`arma`) o nadie en concreto (el clima…). */
export type Atacante = Sello | 'arma' | null

/**
 * **Lo que multiplica el golpe** según quién pega a quién: el corazón de los sellos.
 */
export function danoEntre(atacante: Atacante, victima: Sello): number {
  if (victima === 'tanque') {
    if (atacante === 'asesino') return 1.5
    if (atacante === 'area' || atacante === null) return 1
    if (atacante === 'arma') return 0.5
    return 0.25
  }
  if (victima === 'area' && atacante === 'distancia') return 2
  if (victima === 'asesino' && atacante === 'control') return 2
  return 1
}

/** Lo que hace la torre de un tanque o de un control (no pegan: frenan, aturden, congelan o empujan). */
export type EfectoDeTorre = 'ralentiza' | 'aturde' | 'congela' | 'empuja'

const EFECTO_TORRE: Record<string, EfectoDeTorre> = {
  blindado: 'ralentiza',
  matón: 'ralentiza',
  tanque: 'congela',
  coloso: 'aturde',
  murallaCebo: 'aturde',
  cebo: 'aturde',
  predicador: 'aturde',
  regano: 'aturde',
  lazo: 'empuja',
  cepos: 'congela',
  cuchillos: 'ralentiza',
}

/** Las torres de tanque y de control no pegan: hacen su efecto a los que entran en su zona. */
export function torreSinDano(sello: Sello): boolean {
  return sello === 'tanque' || sello === 'control'
}

export function efectoDeTorre(estilo: Pick<Estilo, 'id'>): EfectoDeTorre {
  return EFECTO_TORRE[baseDelEstilo(estilo)] ?? 'ralentiza'
}

/** Las curas que dan uno solo (a quien más lo necesita) en vez de en área. */
const CURA_INDIVIDUAL = new Set(['santo', 'escudera', 'cantinero'])
/** Los tanques que pegan en área (un pisotón) en vez de a uno. */
const TANQUE_EN_AREA = new Set(['tanque', 'coloso'])

/**
 * **El estilo con su sello encima**: el sello manda (un distancia nunca pega en área, un apoyo no
 * ataca y cura, un control siempre deja su efecto…) y el estilo pone la variante.
 */
export function estiloConSello(estilo: Estilo, sello: Sello): Estilo {
  const e: Estilo = { ...estilo }
  const base = baseDelEstilo(estilo)
  switch (sello) {
    case 'tanque':
      // Le hacen focus: los rivales que lo tienen cerca le disparan a él.
      e.provoca = Math.max(e.provoca ?? 0, 7)
      if (TANQUE_EN_AREA.has(base)) e.area = Math.max(e.area ?? 0, 1.5)
      break
    case 'asesino':
      e.objetivo = 'tanque'
      break
    case 'distancia':
      // Un solo blanco, siempre.
      delete e.area
      delete e.rebota
      delete e.campo
      if (e.perfora) {
        delete e.perfora
        e.golpe = (e.golpe ?? 1) + 0.5
      }
      break
    case 'apoyo': {
      e.pacifico = true
      const individual = CURA_INDIVIDUAL.has(base)
      const pulso = e.pulso ?? { radio: 5.5, cadaS: 6, cura: 1 }
      e.pulso = { ...pulso, cura: Math.max(1, pulso.cura ?? 1) * (individual ? 2 : 1), individual }
      break
    }
    case 'area':
      if (!e.area && !e.campo && !e.rebota) e.area = 1.6
      break
    case 'control':
      if (!e.aturde && !e.ralentiza && !e.empuja && !e.pulso) e.ralentiza = 2
      break
    case 'asalto':
      break
  }
  return e
}
