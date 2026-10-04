import { BUILTIN_BATTLE } from '../cards/catalog'
import { PULLAS, nombreDeRival, pullaDe } from './taunts'

describe('las pullas de las cartas', () => {
  it('cada muñeco tiene varias, para que no diga siempre lo mismo', () => {
    for (const card of BUILTIN_BATTLE) {
      expect(PULLAS[card.id], card.id).toBeDefined()
      expect(PULLAS[card.id]!.length, card.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('las especiales tambien sueltan lo suyo', () => {
    for (const id of ['humo', 'rayo', 'tunel']) expect(PULLAS[id]!.length, id).toBeGreaterThanOrEqual(3)
  })

  it('nunca repite la misma dos veces seguidas', () => {
    for (const id of Object.keys(PULLAS)) {
      let anterior = ''
      for (let i = 0; i < 14; i++) {
        const dicha = pullaDe(id)!
        expect(dicha, id).not.toBe(anterior)
        anterior = dicha
      }
    }
  })

  it('sabe devolver un nombre de rival para el cartel del principio', () => {
    const nombre = nombreDeRival()
    expect(nombre.length).toBeGreaterThan(3)
  })
})
