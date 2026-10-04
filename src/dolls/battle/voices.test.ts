import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BUILTIN_BATTLE, BUILTIN_CARDS } from '../cards/catalog'
import { VOCES } from './voices'

describe('los sonidos de las cartas', () => {
  it('cada muñeco tiene su sonido al entrar al campo', () => {
    for (const card of BUILTIN_BATTLE) {
      expect(VOCES[card.id], card.id).toBeDefined()
      expect((VOCES[card.id]!.notas ?? VOCES[card.id]!.roces ?? []).length, card.id).toBeGreaterThan(0)
    }
  })

  it('las especiales tambien tienen el suyo', () => {
    for (const id of ['humo', 'rayo', 'tunel']) {
      expect(VOCES[id], id).toBeDefined()
    }
  })

  it('las frases grabadas que hay son de cartas que existen', () => {
    // Tener frase grabada es opcional: si falta el WAV, la carta suena con su receta. Lo que no
    // vale es que ande un WAV suelto de una carta que ya no esta en el catalogo.
    const ids = new Set(BUILTIN_CARDS.map((card) => card.id))
    for (const id of Object.keys(VOCES)) {
      const ruta = join(process.cwd(), 'public', 'sonidos', 'cartas', `${id}.wav`)
      if (existsSync(ruta)) expect(ids.has(id), `sobra ${id}.wav`).toBe(true)
    }
  })

  it('no hay dos cartas que suenen igual', () => {
    const oidas = new Map<string, string>()
    for (const [id, receta] of Object.entries(VOCES)) {
      const firma = JSON.stringify(receta)
      const gemela = oidas.get(firma)
      expect(gemela, `${id} suena igual que ${gemela}`).toBeUndefined()
      oidas.set(firma, id)
    }
  })
})
