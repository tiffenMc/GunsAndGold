import { ARQUETIPOS, arquetipoAlAzar, conArquetipo } from '../cards/arquetipos'
import { BUILTIN_BATTLE, BUILTIN_CARDS } from '../cards/catalog'
import { claseDe } from '../cards/model'
import { CLIMAS, ajusteDeCarta, ajusteDeDisparos, climaAlAzar, conClima, visionDeClima } from '../battle/clima'
import { RETOS, incursionesDeLaHora, msParaCambiar, pagar, premioDeCarta, puedePagar, retoCumplido } from './incursiones'
import type { ResumenDeBatalla } from './incursiones'
import { aplicarDesgaste, caracteristicasDeFabrica, premioDeEntreno } from './caracteristicas'

const vaquero = BUILTIN_BATTLE.find((card) => card.id === 'vaquero')!

const resumen = (parcial: Partial<ResumenDeBatalla> = {}): ResumenDeBatalla => ({
  ganada: true,
  segundos: 60,
  bajas: 0,
  perdidas: 0,
  fuerte: 100,
  ...parcial,
})

describe('los tipos de tirador', () => {
  it('son cuatro y cada uno tiene su papel escrito', () => {
    expect(ARQUETIPOS.map((tipo) => tipo.id)).toEqual(['medio', 'selecto', 'profesional', 'berserker'])
    for (const tipo of ARQUETIPOS) expect(tipo.label.length).toBeGreaterThan(5)
  })

  it('el berserker sale menos que los demas', () => {
    let berserkers = 0
    for (let i = 0; i < 400; i++) if (arquetipoAlAzar() === 'berserker') berserkers++
    expect(berserkers).toBeGreaterThan(0)
    expect(berserkers).toBeLessThan(400 * 0.2)
  })

  it('cambian el daño y el rango de la carta', () => {
    const cercano = conArquetipo(vaquero, 'profesional')
    const lejano = conArquetipo(vaquero, 'selecto')
    const bestia = conArquetipo(vaquero, 'berserker')
    expect(cercano.damage).toBeGreaterThan(vaquero.damage)
    expect(cercano.range).toBeLessThan(vaquero.range)
    expect(lejano.damage).toBeLessThan(vaquero.damage)
    expect(lejano.range).toBeGreaterThan(vaquero.range)
    expect(bestia.damage).toBeGreaterThan(vaquero.damage)
    expect(bestia.range).toBeGreaterThan(vaquero.range)
    // Y la carta se queda con el tipo escrito para poder enseñarlo.
    expect(bestia.arquetipo).toBe('berserker')
  })
})

describe('el clima', () => {
  it('son cinco y todos recortan algo el rango', () => {
    expect(CLIMAS.map((item) => item.id)).toEqual(['dia', 'noche', 'lluvia', 'tormenta', 'helado'])
    for (const info of CLIMAS) {
      const ajuste = ajusteDeCarta(info.id)
      expect(ajuste.rango).toBeLessThanOrEqual(1)
      if (info.id !== 'dia') expect(ajuste.rango).toBeLessThan(1)
    }
  })

  it('la lluvia y la noche recortan TUS disparos; el dia no toca nada', () => {
    expect(ajusteDeDisparos('dia')).toBe(1)
    expect(ajusteDeDisparos('noche')).toBeLessThan(1)
    expect(ajusteDeDisparos('lluvia')).toBeLessThan(1)
    expect(ajusteDeDisparos('lluvia')).toBeLessThan(ajusteDeDisparos('noche'))
  })

  it('cada clima castiga a su tipo: selectos con lluvia, berserkers con tormenta, medios con hielo', () => {
    expect(ajusteDeCarta('lluvia', 'selecto').rango).toBeLessThan(ajusteDeCarta('lluvia', 'medio').rango)
    expect(ajusteDeCarta('tormenta', 'berserker').dano).toBeLessThan(ajusteDeCarta('tormenta', 'medio').dano)
    expect(ajusteDeCarta('tormenta', 'berserker').rango).toBeLessThan(ajusteDeCarta('tormenta', 'medio').rango)
    expect(ajusteDeCarta('helado', 'medio').rango).toBeLessThan(ajusteDeCarta('helado', 'selecto').rango)
  })

  it('de noche el campo rival se pierde a lo lejos, pero tus soldados ganan vista al avanzar', () => {
    expect(visionDeClima('dia', 40, [])).toBe('claro')
    expect(visionDeClima('noche', 5, [])).toBe('claro')
    expect(visionDeClima('noche', 13, [])).toBe('fantasma')
    expect(visionDeClima('noche', 30, [])).toBe('oculto')
    // Un soldado recien salido ve poco; el mismo, ya avanzado, ve mucho mas.
    expect(visionDeClima('noche', 30, [{ distancia: 12, andado: 0 }])).toBe('oculto')
    expect(visionDeClima('noche', 30, [{ distancia: 12, andado: 20 }])).toBe('claro')
    // La lluvia tambien limita la vista, algo menos que la noche; el dia y el hielo, no.
    expect(visionDeClima('lluvia', 30, [])).toBe('oculto')
    expect(visionDeClima('helado', 30, [])).toBe('claro')
  })

  it('la carta con clima cambia de numeros, no de identidad', () => {
    const mojada = conClima(vaquero, 'lluvia', 'selecto')
    expect(mojada.id).toBe('vaquero')
    expect(mojada.range).toBeLessThan(vaquero.range)
  })

  it('sabe sacar un clima al azar', () => {
    expect(CLIMAS.map((item) => item.id)).toContain(climaAlAzar())
  })
})

describe('las incursiones de carta', () => {
  it('cada hora salen cinco, iguales para todos, y duran la hora', () => {
    const ahora = 1_700_000_000_000
    const unas = incursionesDeLaHora(ahora)
    const otras = incursionesDeLaHora(ahora + 60_000)
    expect(unas).toHaveLength(5)
    expect(otras.map((item) => item.cardId)).toEqual(unas.map((item) => item.cardId))
    expect(new Set(unas.map((item) => item.cardId)).size).toBe(5)
    // Y a la hora siguiente cambian.
    const luego = incursionesDeLaHora(ahora + 3_600_000)
    expect(luego.map((item) => item.cardId)).not.toEqual(unas.map((item) => item.cardId))
    expect(msParaCambiar(ahora)).toBeGreaterThan(0)
    expect(msParaCambiar(ahora)).toBeLessThanOrEqual(3_600_000)
  })

  it('las incursiones son las mismas para todos: mismos carteles en cada clase, mismo puesto y misión', () => {
    const ahora = Date.UTC(2026, 9, 4, 18, 30)
    const vaqueros = incursionesDeLaHora(ahora, 'vaqueros')
    // Dos jugadores de la misma clase (o el mismo en otro dispositivo) ven exactamente lo mismo.
    expect(incursionesDeLaHora(ahora, 'vaqueros')).toEqual(vaqueros)
    // El admin ve los mismos que los vaqueros.
    expect(incursionesDeLaHora(ahora, 'todas')).toEqual(vaqueros)
    for (const clase of ['indios', 'vikingos'] as const) {
      const suyas = incursionesDeLaHora(ahora, clase)
      const munecos = BUILTIN_CARDS.filter((card) => card.kind === 'batalla' && claseDe(card) === clase)
      const base = BUILTIN_CARDS.filter((card) => card.kind === 'batalla' && claseDe(card) === 'vaqueros')
      expect(suyas.map((inc) => inc.reto.id)).toEqual(vaqueros.map((inc) => inc.reto.id))
      // Cada cartel es la version de su clase de la misma carta (mismo puesto en el catalogo).
      expect(suyas.map((inc) => munecos.findIndex((card) => card.id === inc.cardId))).toEqual(
        vaqueros.map((inc) => base.findIndex((card) => card.id === inc.cardId)),
      )
    }
  })

  it('cada incursion pide características: sin ellas no entras, con ellas pagas', () => {
    const incursion = incursionesDeLaHora()[0]!
    expect(incursion.coste.length).toBeGreaterThan(0)
    const pobre = caracteristicasDeFabrica()
    for (const parte of incursion.coste) pobre[parte.stat] = Math.max(1, parte.cantidad - 1)
    expect(puedePagar(pobre, incursion.coste)).toBe(false)
    const rico = caracteristicasDeFabrica()
    for (const parte of incursion.coste) rico[parte.stat] = 100
    expect(puedePagar(rico, incursion.coste)).toBe(true)
    const pagado = pagar(rico, incursion.coste)
    for (const parte of incursion.coste) expect(pagado[parte.stat]).toBe(100 - parte.cantidad)
  })

  it('cada reto se cumple (o no) con lo que pasa en la batalla', () => {
    const [faena, relampago, muralla, pulso] = RETOS
    expect(retoCumplido(faena!, resumen({ bajas: faena!.meta }))).toBe(true)
    expect(retoCumplido(faena!, resumen({ bajas: faena!.meta - 1 }))).toBe(false)
    expect(retoCumplido(relampago!, resumen({ segundos: 10 }))).toBe(true)
    expect(retoCumplido(relampago!, resumen({ segundos: 500 }))).toBe(false)
    expect(retoCumplido(muralla!, resumen({ fuerte: 100 }))).toBe(true)
    expect(retoCumplido(muralla!, resumen({ fuerte: 20 }))).toBe(false)
    expect(retoCumplido(pulso!, resumen())).toBe(true)
    expect(retoCumplido(pulso!, resumen({ perdidas: 1 }))).toBe(false)
    // Y si pierdes la partida, nada cuenta.
    expect(retoCumplido(pulso!, resumen({ ganada: false }))).toBe(false)
  })

  it('el premio es un % de la carta, de 1 a 100', () => {
    for (let i = 0; i < 60; i++) {
      const premio = premioDeCarta()
      expect(premio).toBeGreaterThanOrEqual(1)
      expect(premio).toBeLessThanOrEqual(100)
    }
  })
})

describe('las características', () => {
  it('de fábrica empiezan bajas y el entreno da entre 30 y 100', () => {
    const stats = caracteristicasDeFabrica()
    for (const valor of Object.values(stats)) expect(valor).toBeGreaterThan(0)
    for (let i = 0; i < 40; i++) {
      const premio = premioDeEntreno()
      expect(premio).toBeGreaterThanOrEqual(30)
      expect(premio).toBeLessThanOrEqual(100)
    }
  })

  it('bajan solas con el tiempo y nunca del 1%', () => {
    const stats = caracteristicasDeFabrica()
    const unaHora = aplicarDesgaste(stats, 0, 3_600_000)
    expect(unaHora.stats.punteria).toBeLessThan(stats.punteria)
    const unAno = aplicarDesgaste(stats, 0, 365 * 24 * 3_600_000)
    for (const valor of Object.values(unAno.stats)) expect(valor).toBe(1)
  })
})
