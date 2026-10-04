import { BUILTIN_CARDS } from './catalog'
import { cardStrength } from './model'

describe('la chapa de la fuerza', () => {
  it('el vaquero base marca 1 y ninguna carta se sale del 1 al 6', () => {
    const vaquero = BUILTIN_CARDS.find((card) => card.id === 'vaquero')!
    expect(cardStrength(vaquero)).toBe(1)
    for (const card of BUILTIN_CARDS) {
      expect(cardStrength(card), card.id).toBeGreaterThanOrEqual(1)
      expect(cardStrength(card), card.id).toBeLessThanOrEqual(6)
    }
  })
})
