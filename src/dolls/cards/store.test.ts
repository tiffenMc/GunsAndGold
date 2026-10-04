import { BUILTIN_CARDS } from './catalog'
import { DECK_BATTLE, claseDe } from './model'
import type { CardDef } from './model'
import { deleteCard, normalize, publishCard, publishState, saveCard, todasLasCartasDelJuego, unpublishCard } from './store'
import { SCENARIOS, nextScenario } from '../scenes/scenarios'

describe('admin y juego', () => {
  it('las cartas guardadas antes de resistencia se leen con 50 por defecto', () => {
    const base = BUILTIN_CARDS.find((card) => card.id === 'vaquero')!
    if (base.kind !== 'batalla') throw new Error('Se esperaba una carta de batalla')
    const { resistance: _resistance, ...legacy } = base
    const loaded = normalize(legacy as CardDef)
    expect(loaded.kind === 'batalla' ? loaded.resistance : null).toBe(50)
  })

  it('las cartas del catalogo traen su rareza y su clase', () => {
    expect(BUILTIN_CARDS.every((card) => card.rarity)).toBe(true)
    for (const clase of ['vaqueros', 'indios', 'vikingos'] as const) {
      const suyas = BUILTIN_CARDS.filter((card) => claseDe(card) === clase)
      // 30 muñecos y 14 armas por clase; las divinas son 4 muñecos y 2 armas.
      expect(suyas.filter((card) => card.kind === 'batalla'), clase).toHaveLength(30)
      expect(suyas.filter((card) => card.kind === 'arma'), clase).toHaveLength(14)
      expect(suyas.filter((card) => card.rarity === 'divina'), clase).toHaveLength(6)
    }
  })

  it('al empezar, el juego tiene las cartas del catalogo (de todas las clases)', () => {
    expect(todasLasCartasDelJuego()).toHaveLength(BUILTIN_CARDS.length)
  })

  it('una carta nueva no llega al juego hasta que se acepta', () => {
    const base = BUILTIN_CARDS[0]!
    const card: CardDef = { ...base, id: 'prueba-1', name: 'Prueba', builtin: false }
    saveCard(card)
    expect(publishState(card)).toBe('fuera')
    publishCard(card)
    expect(publishState(card)).toBe('igual')
    expect(todasLasCartasDelJuego()).toHaveLength(BUILTIN_CARDS.length + 1)
  })

  it('si la retocas, el juego sigue con la version aceptada', () => {
    const inGame = todasLasCartasDelJuego().find((card) => card.id === 'prueba-1')!
    const edited = { ...inGame, name: 'Prueba retocada' }
    saveCard(edited)
    expect(publishState(edited)).toBe('cambios')
    expect(todasLasCartasDelJuego().find((card) => card.id === 'prueba-1')!.name).toBe('Prueba')
  })

  it('el juego no deja quitarse cartas si ya no quedarían para una baraja', () => {
    expect(unpublishCard('prueba-1')).toBeNull()
    const battles = todasLasCartasDelJuego().filter((card) => card.kind === 'batalla')
    const allowed = battles.filter((card) => unpublishCard(card.id) === null).length
    // Solo se pueden quedar fuera las que sobran por encima de los 10 muñecos de la baraja.
    expect(allowed).toBe(battles.length - DECK_BATTLE)
    expect(todasLasCartasDelJuego().filter((card) => card.kind === 'batalla')).toHaveLength(DECK_BATTLE)
    expect(deleteCard('prueba-1')).toBeNull()
  })
})

describe('escenarios', () => {
  it('hay 5 y la partida siguiente nunca repite el anterior', () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(['mina', 'nieve', 'oeste', 'pueblo', 'tren'])
    for (const scenario of SCENARIOS) {
      for (let i = 0; i < 20; i++) expect(nextScenario(scenario.id).id).not.toBe(scenario.id)
    }
  })
})
