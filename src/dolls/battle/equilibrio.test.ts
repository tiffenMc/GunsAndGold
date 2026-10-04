import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { BUILTIN_BATTLE } from '../cards/catalog'
import { informeDeEquilibrio, simularEquilibrio } from './equilibrio'

/**
 * `npm run equilibrio`: juega miles de peleas simuladas y deja el informe en `equilibrio.md`.
 * Con los tests normales no corre (tarda un rato).
 */
it.skipIf(import.meta.env.MODE !== 'equilibrio')(
  'informe de equilibrio',
  () => {
    const partes = ['# Equilibrio de las cartas', '', `Simulado el ${new Date().toLocaleString('es-ES')}.`, '']
    for (const clase of ['vaqueros', 'indios', 'vikingos']) {
      const cartas = BUILTIN_BATTLE.filter((c) => (c.clase ?? 'vaqueros') === clase)
      const filas = simularEquilibrio(cartas)
      partes.push(informeDeEquilibrio(clase, filas))
      console.log(`${clase}: ${filas.filter((f) => f.veredicto !== 'bien').map((f) => `${f.nombre} ${f.veredicto} (${f.desvio})`).join(' · ')}`)
    }
    writeFileSync('equilibrio.md', partes.join('\n'))
  },
  30 * 60 * 1000,
)
