import { BUILTIN_CARDS } from '../cards/catalog'
import { ESTILOS } from './estilos'
import { PAPELES, papelDe, papelDelEstilo } from './papeles'

describe('papeles', () => {
  it('cada estilo cae en el papel que se espera', () => {
    const esperado: Record<string, string> = {
      clasico: 'tirador',
      francotirador: 'pesado',
      cerrojo: 'pesado',
      minigun: 'rafaga',
      rafaga: 'rafaga',
      canon: 'area',
      perdigones: 'area',
      rebote: 'rebote',
      perfora: 'perfora',
      cuerpo: 'cuerpo',
      tanque: 'tanque',
      blindado: 'tanque',
      medico: 'cura',
      abanderado: 'apoyo',
      fuego: 'trampa',
      kamikaze: 'bomba',
      sigilo: 'sigilo',
      predicador: 'control',
      lazo: 'control',
    }
    for (const [id, papel] of Object.entries(esperado)) expect([id, papelDelEstilo(ESTILOS[id]!)]).toEqual([id, papel])
  })

  it('las cartas del juego no son todas del mismo papel', () => {
    const vistos = new Set(BUILTIN_CARDS.filter((c) => c.kind === 'batalla').map((c) => papelDe(c).id))
    expect(vistos.size).toBeGreaterThanOrEqual(8)
    for (const id of vistos) expect(PAPELES[id]).toBeDefined()
  })
})
