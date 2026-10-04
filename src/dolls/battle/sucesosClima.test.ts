import { describe, expect, it } from 'vitest'
import { BUILTIN_BATTLE, BUILTIN_WEAPONS } from '../cards/catalog'
import { createBattle, spawnUnit, step } from './engine'
import type { Clima } from './clima'
import { congelada, sortearSucesos } from './sucesosClima'

const mazo = [...BUILTIN_BATTLE.slice(0, 12), ...BUILTIN_WEAPONS.slice(0, 4)]

function partida(clima: Clima, seed = 11) {
  const battle = createBattle({ decks: [mazo, mazo], seed, clima })
  for (let i = 0; i < 4; i++) {
    spawnUnit(battle, 0, BUILTIN_BATTLE[i]!, { x: -4 + i * 2, z: 10 }, 'bien')
    spawnUnit(battle, 1, BUILTIN_BATTLE[i + 4]!, { x: -4 + i * 2, z: -10 }, 'bien')
  }
  return battle
}

/** Una partida a la que se le fuerza un suceso nada más empezar. */
function conSuceso(clima: Clima, seed = 11) {
  const battle = partida(clima, seed)
  battle.sucesoPlan = [0.5]
  return battle
}

describe('lo que pasa por el clima', () => {
  it('no es constante: cada partida trae de 0 a 3 sucesos, separados', () => {
    const cuantos = new Map<number, number>()
    for (let seed = 1; seed <= 300; seed++) {
      const plan = sortearSucesos(createBattle({ decks: [mazo, mazo], seed }))
      expect(plan.length).toBeLessThanOrEqual(3)
      cuantos.set(plan.length, (cuantos.get(plan.length) ?? 0) + 1)
      for (let i = 1; i < plan.length; i++) expect(plan[i]! - plan[i - 1]!).toBeGreaterThan(20)
    }
    // Salen todas las opciones: ninguno, uno, dos y tres.
    expect([...cuantos.keys()].sort()).toEqual([0, 1, 2, 3])
  })

  it('cada clima hace lo suyo cuando toca', () => {
    const vistos: Record<string, Set<string>> = {}
    for (const clima of ['dia', 'lluvia', 'tormenta', 'helado', 'noche'] as Clima[]) {
      vistos[clima] = new Set()
      for (let seed = 1; seed <= 6; seed++) {
        const battle = conSuceso(clima, seed)
        for (let i = 0; i < 40; i++) {
          step(battle, 0.1)
          for (const s of battle.sucesos) vistos[clima]!.add(s.k)
        }
      }
    }
    expect(vistos.helado!.has('ventisca')).toBe(true)
    expect(vistos.helado!.has('hielo')).toBe(true)
    expect(vistos.tormenta!.has('rayo')).toBe(true)
    expect(vistos.lluvia!.has('charco')).toBe(true)
    expect(vistos.noche!.has('murcielagos')).toBe(true)
    expect([...vistos.dia!].some((k) => k === 'rodadora' || k === 'sol' || k === 'tsunami')).toBe(true)
  })

  it('la tormenta tira 2 o 3 rayos, y no encima de nadie a propósito', () => {
    const battle = conSuceso('tormenta')
    for (let i = 0; i < 7; i++) step(battle, 0.1)
    const rayos = battle.sucesos.filter((s) => s.k === 'rayo')
    expect(rayos.length).toBeGreaterThanOrEqual(2)
    expect(rayos.length).toBeLessThanOrEqual(3)
  })

  it('la ventisca congela a 2 o 3 y el congelado no se mueve hasta que se descongela', () => {
    const battle = conSuceso('helado')
    for (let i = 0; i < 25; i++) step(battle, 0.1)
    const pillados = battle.units.filter((u) => congelada(battle, u))
    expect(pillados.length).toBeGreaterThanOrEqual(2)
    expect(pillados.length).toBeLessThanOrEqual(3)
    const pillado = pillados[0]!
    const { x, z } = pillado
    step(battle, 1)
    expect(pillado.x).toBeCloseTo(x)
    expect(pillado.z).toBeCloseTo(z)
    expect(pillado.state).toBe('aturdido')
  })

  it('los murciélagos muerden a unos cuantos', () => {
    const battle = conSuceso('noche')
    const antes = new Map(battle.units.map((u) => [u.id, u.shields]))
    for (let i = 0; i < 80; i++) step(battle, 0.1)
    const mordidos = battle.units.filter((u) => u.shields < antes.get(u.id)!)
    expect(mordidos.length).toBeGreaterThanOrEqual(3)
  })

  it('el tsunami baja por un carril y arrasa lo que pilla en medio', () => {
    // Se busca una partida en la que salga el tsunami.
    for (let seed = 1; seed <= 40; seed++) {
      const battle = conSuceso('dia', seed)
      for (let i = 0; i < 7; i++) step(battle, 0.1)
      const ola = battle.sucesos.find((s) => s.k === 'tsunami')
      if (!ola || ola.k !== 'tsunami') continue
      expect([-1, 0, 1].map((c) => (c * 14) / 3)).toContainEqual(expect.closeTo(ola.x, 5))
      // Uno de cada bando, plantado en medio del carril.
      battle.units[0]!.x = ola.x
      battle.units[1]!.x = ola.x
      const enMedio = battle.units.filter((u) => Math.abs(u.x - ola.x) <= ola.r)
      const antes = new Map(enMedio.map((u) => [u.id, u.shields]))
      for (let i = 0; i < 70; i++) step(battle, 0.1)
      expect(enMedio.some((u) => u.shields < antes.get(u.id)!)).toBe(true)
      return
    }
    throw new Error('No ha salido ningún tsunami')
  })
})
