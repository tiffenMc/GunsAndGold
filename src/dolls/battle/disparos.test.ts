import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BUILTIN_WEAPONS } from '../cards/catalog'
import { ARMAS, BATALLA } from './sfx'

describe('los disparos de las armas', () => {
  it('cada arma del catalogo tiene su disparo: grabado o sintetizado', () => {
    for (const arma of BUILTIN_WEAPONS) {
      if (arma.special) continue
      // Todas pegan: las que tienen fichero grabado suenan con él y las demás con el sintetizado.
      expect(arma.shot.range, arma.id).toBeGreaterThan(0)
      expect(arma.shot.speed, arma.id).toBeGreaterThan(0)
      if (ARMAS.includes(arma.id)) {
        const ruta = join(process.cwd(), 'public', 'sonidos', 'armas', `${arma.id}.wav`)
        expect(existsSync(ruta), `falta ${arma.id}.wav (node scripts/sonidos.mjs)`).toBe(true)
      }
    }
  })

  it('cada disparo tiene su fichero en public/sonidos/armas', () => {
    for (const id of ARMAS) {
      const ruta = join(process.cwd(), 'public', 'sonidos', 'armas', `${id}.wav`)
      expect(existsSync(ruta), `falta ${id}.wav (node scripts/sonidos.mjs)`).toBe(true)
    }
  })

  it('la bala de las tropas y el rebote del escudo tambien tienen su fichero', () => {
    for (const id of BATALLA) {
      const ruta = join(process.cwd(), 'public', 'sonidos', 'batalla', `${id}.wav`)
      expect(existsSync(ruta), `falta batalla/${id}.wav (node scripts/sonidos.mjs)`).toBe(true)
    }
  })
})
