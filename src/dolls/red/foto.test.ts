import { describe, expect, it } from 'vitest'
import { BUILTIN_BATTLE, BUILTIN_WEAPONS } from '../cards/catalog'
import { createBattle, drainEvents, hacerTorre, playCard, spawnUnit, step } from '../battle/engine'
import { aplicarFoto, espejo, tomarFoto } from './foto'

const vaquero = BUILTIN_BATTLE.find((c) => c.estilo === 'clasico')!
const otro = BUILTIN_BATTLE.find((c) => c.estilo === 'fuego')!
const mazo = [vaquero, otro, ...BUILTIN_BATTLE.slice(2, 12), ...BUILTIN_WEAPONS.slice(0, 4)]

/** Lo que viaja por la red: la foto en espejo, convertida a texto y vuelta. */
function porLaRed(foto: unknown) {
  return JSON.parse(JSON.stringify(espejo(foto)))
}

describe('partida con un amigo: la foto', () => {
  it('el invitado ve la partida dada la vuelta: se ve abajo y al anfitrion arriba', () => {
    const anfitrion = createBattle({ decks: [mazo, mazo], seed: 1 })
    const mio = spawnUnit(anfitrion, 0, vaquero, { x: 2, z: 8 }, 'excelente')
    const suyo = spawnUnit(anfitrion, 1, otro, { x: -3, z: -6 }, 'bien')
    anfitrion.forts[0].hp = 1000
    anfitrion.forts[1].hp = 2000
    step(anfitrion, 0.5)

    const invitado = createBattle({ decks: [mazo, mazo], seed: 2 })
    invitado.units = []
    aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, drainEvents(anfitrion))), () => undefined)

    const elMio = invitado.units.find((u) => u.id === mio.id)!
    const elSuyo = invitado.units.find((u) => u.id === suyo.id)!
    // Para el invitado, la tropa del anfitrion es la del bando de arriba (1) y la suya la de abajo (0).
    expect(elMio.side).toBe(1)
    expect(elSuyo.side).toBe(0)
    expect(elMio.x).toBeCloseTo(-mio.x)
    expect(elMio.z).toBeCloseTo(-mio.z)
    expect(elSuyo.z).toBeGreaterThan(0)
    // Su carta y su habilidad se recuperan del catalogo.
    expect(elSuyo.card.id).toBe(otro.id)
    expect(elSuyo.habilidad.nombre).toBeTruthy()
    // Los fuertes, cambiados: el suyo (abajo) es el del bando 1 del anfitrion.
    expect(invitado.forts[0].hp).toBe(2000)
    expect(invitado.forts[1].hp).toBe(1000)
    // Y su mano es la del bando 1 del anfitrion.
    expect(invitado.hands[0].slots.map((s) => s.cardId)).toEqual(anfitrion.hands[1].slots.map((s) => s.cardId))
  })

  it('las tropas del invitado se actualizan en su sitio (la escena no las pierde)', () => {
    const anfitrion = createBattle({ decks: [mazo, mazo], seed: 3 })
    spawnUnit(anfitrion, 1, vaquero, { x: 0, z: -8 }, 'excelente')
    const invitado = createBattle({ decks: [mazo, mazo], seed: 4 })
    invitado.units = []
    aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, [])), () => undefined)
    const misma = invitado.units[0]!
    const z = misma.z
    step(anfitrion, 2)
    aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, [])), () => undefined)
    expect(invitado.units[0]).toBe(misma)
    // Anda hacia el fuerte rival, que para el invitado esta arriba (z negativo).
    expect(misma.z).toBeLessThan(z)
  })

  it('lo que hace el invitado, dado la vuelta, cae en su mitad del campo del anfitrion', () => {
    const anfitrion = createBattle({ decks: [mazo, mazo], seed: 5 })
    // El invitado suelta una carta en SU campo (abajo, z positivo); al anfitrion le llega al reves.
    const x = 1.5
    const z = 10
    const sale = playCard(anfitrion, 1, 0, -x, -z, 1, true)
    expect(sale).not.toBeNull()
    expect(sale!.side).toBe(1)
    expect(sale!.z).toBeLessThan(0)
    hacerTorre(anfitrion, sale!)
    const invitado = createBattle({ decks: [mazo, mazo], seed: 6 })
    invitado.units = []
    aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, [])), () => undefined)
    // Y en la pantalla del invitado sale donde lo solto.
    expect(invitado.units[0]!.x).toBeCloseTo(x)
    expect(invitado.units[0]!.z).toBeCloseTo(z)
    expect(invitado.units[0]!.torre).toBe(true)
  })

  it('con clases distintas (vikingos contra vaqueros) el invitado ve las tropas y su mano', () => {
    const vikingos = BUILTIN_BATTLE.filter((c) => c.clase === 'vikingos')
    const mazoVikingo = [...vikingos.slice(0, 10), ...BUILTIN_WEAPONS.filter((w) => w.clase === 'vikingos').slice(0, 4)]
    const mazoVaquero = [...BUILTIN_BATTLE.filter((c) => !c.clase || c.clase === 'vaqueros').slice(0, 10), ...BUILTIN_WEAPONS.slice(0, 4)]
    // El anfitrion juega con vikingos y el invitado con vaqueros.
    const anfitrion = createBattle({ decks: [mazoVikingo, mazoVaquero], seed: 7 })
    const vik = spawnUnit(anfitrion, 0, vikingos[0]!, { x: 0, z: 8 }, 'excelente')
    // El invitado solo tiene su mazo vaquero en su partida: las cartas vikingas las saca del catalogo.
    const invitado = createBattle({ decks: [mazoVaquero, mazoVaquero], seed: 8 })
    invitado.units = []
    const catalogo = new Map([...BUILTIN_BATTLE, ...BUILTIN_WEAPONS].map((c) => [c.id, c]))
    aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, [])), (id) => catalogo.get(id))
    expect(invitado.units.find((u) => u.id === vik.id)?.card.clase).toBe('vikingos')
    // Su mano (la del bando de arriba del anfitrion) se conoce entera.
    for (const s of invitado.hands[0].slots) if (s.cardId) expect(invitado.cards.has(s.cardId)).toBe(true)
  })

  it('una carta que no se conoce no rompe la foto', () => {
    const anfitrion = createBattle({ decks: [mazo, mazo], seed: 9 })
    spawnUnit(anfitrion, 0, vaquero, { x: 0, z: 8 }, 'excelente')
    const invitado = createBattle({ decks: [mazo, mazo], seed: 10 })
    invitado.units = []
    invitado.cards.clear()
    expect(() => aplicarFoto(invitado, porLaRed(tomarFoto(anfitrion, [])), () => undefined)).not.toThrow()
    expect(invitado.time).toBe(anfitrion.time)
  })
})
