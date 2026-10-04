import { DECK_BATTLE, DECK_WEAPONS, claseDe } from '../cards/model'
import type { CardDef, ClaseId } from '../cards/model'

/**
 * Las **clases** del juego. Al crear un personaje eliges una y **solo juega con sus cartas**
 * (muñecos y armas): como indio o como vikingo no tienes ni un vaquero. Cada clase tiene su
 * estetica, sus armas y sus propios tipos de pelea.
 */

export interface ClaseInfo {
  id: ClaseId
  label: string
  /** El nombre en singular, para "Eres un ...". */
  singular: string
  icon: string
  color: string
  /** Lo que la hace distinta, en una frase. */
  lema: string
  /** Un parrafo corto para la pantalla de elegir. */
  descripcion: string
  /** Lo que tienen todos sus soldados por ser de esta clase. */
  pasiva: string
  /** Como se pega: con que y como. */
  armas: string
}

export const CLASES: ClaseInfo[] = [
  {
    id: 'vaqueros',
    label: 'Vaqueros',
    singular: 'Vaquero',
    icon: '🤠',
    color: '#e0b463',
    lema: 'Pólvora, dinamita y puntería',
    descripcion: 'Tiradores de revólver, escopeta y dinamita. De lejos y con mucha variedad: ráfagas, rebotes, fuego, cura…',
    pasiva: 'Recargan un cuarto más rápido: la pólvora es lo suyo.',
    armas: 'Tu arma: revólveres, escopetas y DINAMITA con mecha.',
  },
  {
    id: 'indios',
    label: 'Indios',
    singular: 'Indio',
    icon: '🏹',
    color: '#d9822b',
    lema: 'Flechas, trampas y presas marcadas',
    descripcion: 'Todo son flechas, lanzas y hachas arrojadas. Dejan marcada a su presa y atacan de lejos, con trampas y emboscadas.',
    pasiva: 'Cada flecha marca a su presa: durante 4 s recibe un cuarto más de daño de todos los indios.',
    armas: 'Tu arma: arcos, lanzas y hachas… y la CATAPULTA, cuya roca impacta al momento.',
  },
  {
    id: 'vikingos',
    label: 'Vikingos',
    singular: 'Vikingo',
    icon: '🪓',
    color: '#7dd3fc',
    lema: 'Hachas, escudos y furia',
    descripcion: 'Todos pelean cuerpo a cuerpo: hachazos, martillazos y lanzazos que llegan al instante. Corren más y aguantan más.',
    pasiva: 'Corren muchísimo más, llevan un escudo extra y pegan más fuerte de cerca.',
    armas: 'Tu arma: hachas, lanzas y martillos… y el CAÑONAZO, que explota como la dinamita.',
  },
]

export function claseInfo(id: ClaseId | 'todas'): ClaseInfo {
  return CLASES.find((clase) => clase.id === id) ?? CLASES[0]!
}

/** Las cartas de una clase. */
export function cartasDeClase(cards: CardDef[], clase: ClaseId): CardDef[] {
  return cards.filter((card) => claseDe(card) === clase)
}

/** Si una clase ya tiene cartas de sobra para jugar (10 muñecos y 4 armas como poco). */
export function claseDisponible(cards: CardDef[], clase: ClaseId): boolean {
  const suyas = cartasDeClase(cards, clase)
  return (
    suyas.filter((card) => card.kind === 'batalla').length >= DECK_BATTLE &&
    suyas.filter((card) => card.kind === 'arma').length >= DECK_WEAPONS
  )
}

/** Personajes que puede tener una cuenta. */
export const MAX_PERSONAJES = 3
