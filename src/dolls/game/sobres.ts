import type { CardDef, Rarity } from '../cards/model'
import { RARITY_ORDER, rarityOf } from '../cards/model'

/**
 * Los **sobres**: cada uno trae **7 cartas**. Los **cinco de inicio** llevan garantías (entre los
 * cinco tiene que haber **al menos una de cada rareza**, **10 muñecos distintos** y **4 armas
 * distintas**, que es lo mínimo para montarse la baraja). Los que se ganan después son **al azar**.
 *
 * Al abrirlos, las cartas salen **de una en una** y **siempre las más tochas al final**.
 */

export const CARTAS_POR_SOBRE = 7
export const SOBRES_DE_INICIO = 5
export const MIN_MUNECOS_DE_INICIO = 10
export const MIN_ARMAS_DE_INICIO = 4

/** Cuanto más rara, menos sale. */
const PESO: Record<Rarity, number> = { normal: 10, especial: 6, epica: 2.5, divina: 0.6 }

function azarPesoTotal(cards: CardDef[]): number {
  return cards.reduce((suma, card) => suma + (PESO[rarityOf(card)] ?? 4), 0)
}

function cogerAlAzar(cards: CardDef[], azar: () => number, total: number): CardDef {
  let tirada = azar() * total
  for (const card of cards) {
    tirada -= PESO[rarityOf(card)] ?? 4
    if (tirada <= 0) return card
  }
  return cards[cards.length - 1]!
}

/** Una carta que cumpla lo que pide `filtro` y que no esté ya usada, si se puede. */
function buscar(
  cards: CardDef[],
  usadas: Set<string>,
  filtro: (card: CardDef) => boolean,
  azar: () => number,
): CardDef | null {
  const libres = cards.filter((card) => !usadas.has(card.id) && filtro(card))
  if (libres.length === 0) return null
  const total = azarPesoTotal(libres)
  return cogerAlAzar(libres, azar, total)
}

/**
 * Los cinco sobres de inicio. Van saliendo cartas al azar, pero **sí o sí** acaban saliendo:
 * una de cada rareza, al menos 10 muñecos distintos y al menos 4 armas distintas.
 */
export function sobresDeInicio(cards: CardDef[], azar: () => number = Math.random): string[][] {
  const usadas = new Set<string>()
  const elegidas: CardDef[] = []
  const coge = (card: CardDef | null) => {
    if (!card) return
    usadas.add(card.id)
    elegidas.push(card)
  }

  // Primero lo que hay que garantizar: una de cada rareza (y las divinas, que son las más raras).
  for (const rareza of RARITY_ORDER) {
    coge(buscar(cards, usadas, (card) => rarityOf(card) === rareza, azar))
  }
  // Y luego los muñecos y las armas que hacen falta para una baraja.
  const cuantos = (kind: CardDef['kind']) => elegidas.filter((card) => card.kind === kind).length
  while (cuantos('batalla') < MIN_MUNECOS_DE_INICIO) {
    const card = buscar(cards, usadas, (item) => item.kind === 'batalla', azar)
    if (!card) break
    coge(card)
  }
  while (cuantos('arma') < MIN_ARMAS_DE_INICIO) {
    const card = buscar(cards, usadas, (item) => item.kind === 'arma', azar)
    if (!card) break
    coge(card)
  }
  // Se rellena hasta los cinco sobres. Si se acaban las cartas distintas, se repiten (y así sale
  // experiencia en vez de una carta nueva, como en cualquier juego de cartas).
  const total = CARTAS_POR_SOBRE * SOBRES_DE_INICIO
  while (elegidas.length < total) {
    const libres = cards.filter((card) => !usadas.has(card.id))
    const card = libres.length > 0 ? cogerAlAzar(libres, azar, azarPesoTotal(libres)) : cogerAlAzar(cards, azar, azarPesoTotal(cards))
    usadas.add(card.id)
    elegidas.push(card)
  }

  // Y se reparten en los cinco sobres, barajando un poco para que no salgan todas las buenas juntas.
  const mazo = [...elegidas]
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[mazo[i], mazo[j]] = [mazo[j]!, mazo[i]!]
  }
  const sobres: string[][] = []
  for (let i = 0; i < SOBRES_DE_INICIO; i++) {
    sobres.push(mazo.slice(i * CARTAS_POR_SOBRE, (i + 1) * CARTAS_POR_SOBRE).map((card) => card.id))
  }
  return sobres
}

/** Un sobre de los de después: siete cartas al azar, sin garantías. */
export function sobreAlAzar(cards: CardDef[], azar: () => number = Math.random): string[] {
  const usadas = new Set<string>()
  const salida: string[] = []
  for (let i = 0; i < CARTAS_POR_SOBRE; i++) {
    const libres = cards.filter((card) => !usadas.has(card.id))
    const pool = libres.length > 0 ? libres : cards
    const card = cogerAlAzar(pool, azar, azarPesoTotal(pool))
    usadas.add(card.id)
    salida.push(card.id)
  }
  return salida
}

/** En qué orden se enseñan las cartas de un sobre: **las más tochas al final**. */
export function ordenDeRevelado(ids: string[], cards: CardDef[]): string[] {
  const peso = (id: string) => RARITY_ORDER.indexOf(rarityOf(cards.find((card) => card.id === id) ?? cards[0]!))
  return [...ids].sort((a, b) => peso(a) - peso(b))
}

/** La rareza más alta de un sobre (para celebrarlo como toca). */
export function mejorRareza(ids: string[], cards: CardDef[]): Rarity | null {
  let mejor: Rarity | null = null
  for (const id of ids) {
    const card = cards.find((item) => item.id === id)
    if (!card) continue
    const rareza = rarityOf(card)
    if (!mejor || RARITY_ORDER.indexOf(rareza) > RARITY_ORDER.indexOf(mejor)) mejor = rareza
  }
  return mejor
}
