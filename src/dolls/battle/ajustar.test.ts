import { writeFileSync } from 'node:fs'
import { it } from 'vitest'
import { BUILTIN_BATTLE, SIN_AJUSTE } from '../cards/catalog'
import { AJUSTES } from './ajustes'
import type { Ajuste } from './ajustes'
import { ajustarEquilibrio } from './equilibrio'

const CABECERA = [
  '/**',
  ' * **Los ajustes del equilibrio**, carta a carta. Los calcula `npm run ajustar` jugando miles de',
  ' * peleas simuladas (ver `equilibrio.ts`): no se tocan a mano.',
  ' *',
  ' *  - `poder`: lo que pega (o cura) su habilidad de ataque (1 = tal cual).',
  ' *  - `torre`: lo mismo con su defensa de torre.',
  ' *  - `escudos`: los escudos de la carta (entre 0,6 y 1,4 como mucho, para no cambiarla de arriba abajo).',
  ' *  - `cadencia`: lo que espera entre tiro y tiro (entre 0,7 y 1,5; mas = dispara menos seguido).',
  ' */',
  'export interface Ajuste {',
  '  poder?: number',
  '  torre?: number',
  '  escudos?: number',
  '  /** Lo que espera entre tiro y tiro (1 = tal cual; mas = dispara menos seguido). */',
  '  cadencia?: number',
  '}',
  '',
].join('\n')

/**
 * `npm run ajustar`: equilibra las cartas a base de simular y reescribe `battle/ajustes.ts`.
 * Parte de los ajustes que ya hay (asi cada pasada afina la anterior), pero siempre sobre los numeros
 * originales de cada carta y dentro de sus limites: nunca se amontonan.
 */
it.skipIf(import.meta.env.MODE !== 'ajuste')(
  'ajuste del equilibrio',
  () => {
    const nuevos: Record<string, Ajuste> = {}
    const limita = (v: number | undefined, min: number, max: number) => Math.round(Math.min(max, Math.max(min, v ?? 1)) * 100) / 100
    for (const clase of ['vaqueros', 'indios', 'vikingos']) {
      const cartas = BUILTIN_BATTLE.filter((c) => (c.clase ?? 'vaqueros') === clase)
      // El poder se lee de AJUSTES durante la simulacion: se trabaja sobre ese mismo objeto.
      for (const c of cartas) {
        const a = AJUSTES[c.id] ?? {}
        AJUSTES[c.id] = { poder: a.poder ?? 1, torre: a.torre ?? 1, escudos: a.escudos ?? 1, cadencia: a.cadencia ?? 1 }
      }
      const trabajo = Object.fromEntries(cartas.map((c) => [c.id, AJUSTES[c.id]!]))
      // El vaquero es la carta de referencia (la que marca 1 en la chapa de fuerza).
      ajustarEquilibrio(cartas, trabajo, 12, (t) => console.log(`${clase} · ${t}`), SIN_AJUSTE, ['vaquero'])
      for (const c of cartas) {
        const a = trabajo[c.id]!
        nuevos[c.id] = {
          poder: limita(a.poder, 0.35, 3),
          torre: limita(a.torre, 0.35, 3),
          escudos: limita(a.escudos, 0.6, 1.4),
          cadencia: limita(a.cadencia, 0.7, 1.5),
        }
      }
    }
    const lineas = Object.entries(nuevos)
      .map(([id, a]) => `  '${id}': { poder: ${a.poder}, torre: ${a.torre}, escudos: ${a.escudos}, cadencia: ${a.cadencia} },`)
      .join('\n')
    writeFileSync('src/dolls/battle/ajustes.ts', `${CABECERA}\nexport const AJUSTES: Record<string, Ajuste> = {\n${lineas}\n}\n`)
  },
  60 * 60 * 1000,
)
