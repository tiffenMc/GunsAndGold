import { BUILTIN_CARDS } from '../cards/catalog'
import { DECK_BATTLE, DECK_WEAPONS, MAX_DECKS, claseDe, rarityOf } from '../cards/model'
import {
  DEFAULT_UNLOCK,
  abrirSobre,
  createPlayer,
  deckProblem,
  defaultUnlocked,
  getPlayer,
  personajesDe,
  players,
  repairDeck,
  switchPlayer,
} from './players'

const cards = BUILTIN_CARDS

describe('jugadores', () => {
  it('el ADMIN viene con todas las cartas y una baraja completa', () => {
    const admin = players().find((player) => player.admin)!
    expect(admin.unlocked).toHaveLength(cards.length)
    expect(admin.decks).toHaveLength(1)
    expect(deckProblem(admin.decks[0]!, admin.unlocked, cards)).toBeNull()
  })

  it('abriendo los cinco sobres de inicio sale baraja: 10 muñecos, 4 armas y una de cada rareza', () => {
    const player = createPlayer('Sobres', 'vaquero')
    switchPlayer(player.id)
    for (let i = 0; i < 5; i++) expect(abrirSobre(cards)).toHaveLength(7)

    const ahora = getPlayer()
    expect(ahora.sobres).toHaveLength(0)
    const battle = cards.filter((card) => card.kind === 'batalla' && ahora.unlocked.includes(card.id))
    const weapons = cards.filter((card) => card.kind === 'arma' && ahora.unlocked.includes(card.id))
    expect(battle.length).toBeGreaterThanOrEqual(DECK_BATTLE)
    expect(weapons.length).toBeGreaterThanOrEqual(DECK_WEAPONS)
    for (const rareza of ['normal', 'especial', 'epica', 'divina'] as const) {
      expect(ahora.unlocked.some((id) => rarityOf(cards.find((card) => card.id === id)!) === rareza)).toBe(true)
    }
    // La baraja se rellena sola con lo que ha salido, y cada carta del sobre entra al nivel 1.
    expect(deckProblem(ahora.decks[0]!, ahora.unlocked, cards)).toBeNull()
    // Un sobre da un nivel entero: la primera carta que ha salido llega al 1 como poco.
    expect(ahora.progreso[ahora.unlocked[0]!]!).toBeGreaterThanOrEqual(100)
  })

  it('cada clase tiene su baraja: los cinco sobres de inicio solo traen cartas de su clase y bastan para armar la baraja', () => {
    for (const clase of ['vaqueros', 'indios', 'vikingos'] as const) {
      const player = createPlayer(`Clase ${clase}`, '', clase, `prueba:${clase}`)
      switchPlayer(player.id)
      expect(personajesDe(`prueba:${clase}`)).toHaveLength(1)
      const suyas = cards.filter((card) => claseDe(card) === clase)
      for (let i = 0; i < 5; i++) expect(abrirSobre(suyas)).toHaveLength(7)
      const ahora = getPlayer()
      expect(ahora.clase).toBe(clase)
      expect(ahora.unlocked.every((id) => claseDe(cards.find((card) => card.id === id)!) === clase)).toBe(true)
      expect(deckProblem(ahora.decks[0]!, ahora.unlocked, suyas), clase).toBeNull()
    }
  })

  it('un jugador nuevo arranca con las de siempre, sin divinas y con para armar la baraja', () => {
    const unlocked = defaultUnlocked(cards)
    const battle = cards.filter((card) => card.kind === 'batalla' && unlocked.includes(card.id))
    const weapons = cards.filter((card) => card.kind === 'arma' && unlocked.includes(card.id))
    expect(battle.length).toBeGreaterThanOrEqual(DECK_BATTLE)
    expect(weapons.length).toBeGreaterThanOrEqual(DECK_WEAPONS)
    // Hasta 15 muñecos y 7 armas, y las divinas se ganan jugando.
    expect(battle.length).toBeLessThanOrEqual(DEFAULT_UNLOCK.batalla)
    expect(weapons.length).toBeLessThanOrEqual(DEFAULT_UNLOCK.arma)
    expect(unlocked.filter((id) => rarityOf(cards.find((card) => card.id === id)!) === 'divina')).toHaveLength(0)
  })

  it('la baraja se completa sola con 10 muñecos y 4 armas, sin repetir', () => {
    const unlocked = defaultUnlocked(cards)
    const deck = repairDeck({ name: 'Prueba', battle: [], weapons: [] }, unlocked, cards)
    expect(deck.battle).toHaveLength(DECK_BATTLE)
    expect(deck.weapons).toHaveLength(DECK_WEAPONS)
    expect(new Set([...deck.battle, ...deck.weapons]).size).toBe(DECK_BATTLE + DECK_WEAPONS)
    expect(deckProblem(deck, unlocked, cards)).toBeNull()
  })

  it('una baraja a medias no vale para jugar', () => {
    const unlocked = defaultUnlocked(cards)
    const deck = repairDeck({ name: 'Prueba', battle: [], weapons: [] }, unlocked, cards)
    expect(deckProblem({ ...deck, battle: deck.battle.slice(0, DECK_BATTLE - 1) }, unlocked, cards)).toContain('muñecos')
    expect(deckProblem({ ...deck, weapons: [] }, unlocked, cards)).toContain('armas')
    const repeated = [deck.battle[0]!, ...deck.battle.slice(0, DECK_BATTLE - 1)]
    expect(deckProblem({ ...deck, battle: repeated }, unlocked, cards)).toContain('repetido')
  })

  it('cada jugador nuevo llega con las manos vacías y sus cinco sobres', () => {
    const player = createPlayer('Prueba', 'vaquero')
    expect(player.unlocked).toHaveLength(0)
    expect(player.sobres).toHaveLength(5)
    expect(player.sobres.every((sobre) => sobre.length === 7)).toBe(true)
    expect(player.decks).toHaveLength(1)
    expect(MAX_DECKS).toBe(3)
    switchPlayer(player.id)
    expect(getPlayer().id).toBe(player.id)
  })
})
