import { DECK_BATTLE, DECK_WEAPONS, rarityOf } from '../cards/model'
import { conClima } from '../battle/clima'
import { slotCard } from '../battle/engine'
import { Simulacion } from '../battle/simulacion'
import { ejecutarAccion } from './acciones'
import { mordiscoPorAbandonar, prepararPartida, terminarEncargo } from './partidas'
import { conJugadores, createPlayer, getPlayer, switchPlayer } from './players'
import type { Player } from './players'

function personaje(): Player {
  const p = createPlayer('Prueba', '', 'vaqueros', 'local:prueba')
  switchPlayer(p.id)
  for (let i = 0; i < 5; i++) ejecutarAccion({ tipo: 'abrirSobre' })
  return getPlayer()
}

const ganada = { ganada: true, segundos: 120, bajas: 6, perdidas: 2, fuerte: 80 }

describe('las partidas con premio', () => {
  it('con la misma semilla, el premio es el mismo (en el móvil y en el servidor)', () => {
    const p = personaje()
    const uno = conJugadores([p], p.id, () => terminarEncargo({ tipo: 'rango' }, 1234, ganada))
    const dos = conJugadores([p], p.id, () => terminarEncargo({ tipo: 'rango' }, 1234, ganada))
    expect(JSON.stringify(dos.resultado)).toBe(JSON.stringify(uno.resultado))
    expect(dos.jugadores[0]!.monedas).toBe(uno.jugadores[0]!.monedas)
    expect(dos.jugadores[0]!.lingotes).toBe(uno.jugadores[0]!.lingotes)
    expect(dos.jugadores[0]!.unlocked).toEqual(uno.jugadores[0]!.unlocked)
    // Y con otra semilla, otro sorteo (casi seguro).
    const otra = conJugadores([p], p.id, () => terminarEncargo({ tipo: 'rango' }, 98765, ganada))
    expect(JSON.stringify(otra.resultado) === JSON.stringify(uno.resultado) && otra.jugadores[0]!.monedas === uno.jugadores[0]!.monedas).toBe(false)
  })

  it('la partida se monta igual con la misma foto del personaje, y solo con cartas tuyas', () => {
    const p = personaje()
    const a = prepararPartida(p, 55)
    const b = prepararPartida(JSON.parse(JSON.stringify(p)), 55)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    const trucado = { ...p, decks: [{ name: 'x', battle: ['carta-que-no-tengo', ...p.decks[0]!.battle], weapons: p.decks[0]!.weapons }] }
    expect(prepararPartida(trucado, 55).mazos[0].some((c) => c.id === 'carta-que-no-tengo')).toBe(false)
  })

  it('irse de la de rango cuesta un mordisco de la bolsa (siempre el mismo con la misma semilla)', () => {
    const m = mordiscoPorAbandonar({ tipo: 'rango' }, 7, 200)
    expect(m.mordida).toBeGreaterThan(0)
    expect(mordiscoPorAbandonar({ tipo: 'rango' }, 7, 200)).toEqual(m)
    expect(mordiscoPorAbandonar({ tipo: 'libre' }, 7, 200).mordida).toBe(0)
  })
})

describe('las acciones (lo que hace el servidor)', () => {
  it('una baraja solo guarda cartas tuyas', () => {
    const p = personaje()
    ejecutarAccion({ tipo: 'guardarBaraja', indice: 0, baraja: { name: 'Mía', battle: ['no-es-mia', p.unlocked[0]!], weapons: [] } })
    expect(getPlayer().decks[0]!.battle).toEqual([p.unlocked[0]])
  })

  it('vestir compra lo que falta y se lo pone; sin dinero, no', () => {
    personaje()
    const look = { ...JSON.parse(JSON.stringify(getPlayer().pinta ?? {})), height: 1, hat: 'bombin' }
    expect(ejecutarAccion({ tipo: 'vestir', look }).error).toContain('lingotes')
  })

  it('no se puede crear un cuarto personaje en la misma cuenta', () => {
    const cuenta = 'local:llena'
    for (let i = 0; i < 3; i++) expect(ejecutarAccion({ tipo: 'crear', nombre: `P${i}`, avatar: '', clase: 'vaqueros' }, cuenta).id).toBeTruthy()
    expect(ejecutarAccion({ tipo: 'crear', nombre: 'P4', avatar: '', clase: 'vaqueros' }, cuenta).error).toBeTruthy()
  })
})

describe('tus cartas y tus características en la partida', () => {
  it('cada bando juega con su copia de la carta, aunque el bot tenga la misma', () => {
    const p = personaje()
    // Con las características al máximo, tus cartas pegan más que las del bot.
    const fuerte = { ...p, caracteristicas: { ...p.caracteristicas, punteria: 100, precision: 100, vida: 100 } }
    const prep = prepararPartida(fuerte, 21)
    const sim = new Simulacion(prep)
    const b = sim.battle
    for (let slot = 0; slot < b.hands[0].slots.length; slot++) {
      const mia = slotCard(b, 0, slot)!
      const original = prep.mazos[0].find((c) => c.id === mia.id)!
      // La que sale de tu mano es la tuya (con tus extras), no la del bot.
      expect(mia).toBe(original)
      // (Antes salía la del bot: el mismo nombre, pero su tipo de tirador y sin tus extras.)
      const delBot = prep.mazos[1].find((c) => c.id === mia.id)
      if (delBot) expect(slotCard(b, 0, slot)).not.toBe(delBot)
    }
    // Y la tropa que sacas lleva tu carta (con su ajuste del clima), no la del bot.
    const mia = slotCard(b, 0, 0)!
    expect(sim.jugar({ a: 'carta', slot: 0, x: 0, z: 10, precision: 1, torre: false })).toBe(true)
    const tropa = b.units.find((u) => u.side === 0)!
    const esperada = conClima(mia, b.clima, mia.arquetipo)
    expect(tropa.card.id).toBe(mia.id)
    expect(tropa.card.damage).toBe(esperada.damage)
    expect(tropa.card.fireMs).toBe(esperada.fireMs)
    expect(tropa.card.shields).toBe(esperada.shields)
  })

  it('la precisión alarga el arma y la vida engorda el fuerte', () => {
    const p = personaje()
    const normal = new Simulacion(prepararPartida({ ...p, caracteristicas: { ...p.caracteristicas, precision: 1, vida: 1 } }, 3)).battle
    const fino = new Simulacion(prepararPartida({ ...p, caracteristicas: { ...p.caracteristicas, precision: 100, vida: 100 } }, 3)).battle
    expect(fino.alcanceArma).toBeCloseTo(1.2, 5)
    expect(fino.alcanceArma).toBeGreaterThan(normal.alcanceArma)
    expect(fino.forts[0].maxHp).toBeGreaterThan(normal.forts[0].maxHp)
  })
})

describe('la baraja del bot, justa', () => {
  it('lleva 10 muñecos y 4 armas sin repetir, con las mismas rarezas que la tuya', () => {
    const p = personaje()
    for (const semilla of [1, 2, 3, 99]) {
      const prep = prepararPartida(p, semilla)
      const [mia, bot] = prep.mazos
      expect(bot.filter((c) => c.kind === 'batalla')).toHaveLength(DECK_BATTLE)
      expect(bot.filter((c) => c.kind === 'arma')).toHaveLength(DECK_WEAPONS)
      expect(new Set(bot.map((c) => c.id)).size).toBe(bot.length)
      const rarezas = (lista: typeof bot) => lista.map((c) => `${c.kind}:${rarityOf(c)}`).sort()
      expect(rarezas(bot)).toEqual(rarezas(mia))
    }
  })

  it('cada partida le toca otra baraja, pero con la misma semilla siempre la misma', () => {
    const p = personaje()
    const ids = (s: number) => prepararPartida(p, s).mazos[1].map((c) => c.id).join(',')
    expect(ids(5)).toBe(ids(5))
    expect(new Set([1, 2, 3, 4, 5, 6].map(ids)).size).toBeGreaterThan(1)
  })
})
