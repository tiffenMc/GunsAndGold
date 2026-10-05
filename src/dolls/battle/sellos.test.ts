import { BUILTIN_BATTLE } from '../cards/catalog'
import type { BattleCard } from '../cards/model'
import { createBattle, hacerTorre, spawnUnit, step } from './engine'
import type { Unit } from './engine'
import { ESTILO_LISTA, estiloDe } from './estilos'
import { SELLOS, SELLOS_EN_ORDEN, danoEntre, estiloConSello, selloDe, selloDelEstilo } from './sellos'
import type { Sello } from './sellos'

const vaqueros = BUILTIN_BATTLE.filter((c) => !c.clase || c.clase === 'vaqueros') as BattleCard[]
const de = (s: Sello) => vaqueros.filter((c) => selloDe(c) === s)

/** Dos contra dos, hasta que quede un bando (los fuertes no cuentan). */
function pelea(a: BattleCard[], b: BattleCard[], seed: number): 0 | 1 | null {
  const battle = createBattle({ decks: [[...a, ...b], [...a, ...b]], seed })
  battle.lastPlayAt[0] = 1e9
  battle.lastPlayAt[1] = 1e9
  battle.nextCartAt = 1e9
  const ua = a.map((c, i) => spawnUnit(battle, 0, c, { x: -2 + i * 2.5, z: 4 + (i % 2) }, 'bien'))
  const ub = b.map((c, i) => spawnUnit(battle, 1, c, { x: -2 + i * 2.5, z: -4 - (i % 2) }, 'bien'))
  const vivo = (u: Unit) => u.state !== 'muerto'
  for (let t = 0; t < 60; t += 1 / 20) {
    step(battle, 1 / 20)
    battle.forts[0].hp = battle.forts[0].maxHp
    battle.forts[1].hp = battle.forts[1].maxHp
    const va = ua.some(vivo)
    const vb = ub.some(vivo)
    if (!va || !vb) return va ? 0 : vb ? 1 : null
  }
  const resto = (l: Unit[]) => l.reduce((s, u) => s + (vivo(u) ? u.shields / u.maxShields : 0), 0)
  return Math.abs(resto(ua) - resto(ub)) < 0.05 ? null : resto(ua) > resto(ub) ? 0 : 1
}

/** El % de peleas que gana el sello `a` contra el `b` (cambiando de lado, para que no cuente la posición). */
function gana(a: Sello, b: Sello, rondas = 12): number {
  const A = de(a)
  const B = de(b)
  let si = 0
  let total = 0
  for (let k = 0; k < rondas; k++) {
    const ea = [A[k % A.length]!, A[(k + 1) % A.length]!]
    const eb = [B[(k * 3) % B.length]!, B[(k * 3 + 1) % B.length]!]
    const w1 = pelea(ea, eb, 100 + k)
    const w2 = pelea(eb, ea, 300 + k)
    if (w1 === 0) si++
    if (w2 === 1) si++
    if (w1 !== null) total++
    if (w2 !== null) total++
  }
  return (100 * si) / Math.max(1, total)
}

describe('sellos', () => {
  it('cada estilo tiene su sello, y hay cartas de los siete', () => {
    for (const estilo of ESTILO_LISTA) expect(SELLOS[selloDelEstilo(estilo)]).toBeDefined()
    for (const s of SELLOS_EN_ORDEN) expect(de(s).length).toBeGreaterThan(0)
  })

  it('el daño entre sellos: el tanque solo cae de verdad ante asesinos y área', () => {
    expect(danoEntre('asesino', 'tanque')).toBeGreaterThan(1)
    expect(danoEntre('area', 'tanque')).toBe(1)
    expect(danoEntre('asalto', 'tanque')).toBeLessThan(0.5)
    expect(danoEntre('distancia', 'tanque')).toBeLessThan(0.5)
    expect(danoEntre('distancia', 'area')).toBeGreaterThan(1)
    expect(danoEntre('control', 'asesino')).toBeGreaterThan(1)
    expect(danoEntre('asalto', 'asalto')).toBe(1)
  })

  it('el sello manda en el estilo: el de distancia nunca pega en área y el de apoyo no ataca', () => {
    const conArea = ESTILO_LISTA.find((e) => e.area)!
    expect(estiloConSello(conArea, 'distancia').area).toBeUndefined()
    expect(estiloConSello(conArea, 'apoyo').pacifico).toBe(true)
    expect(estiloConSello(ESTILO_LISTA[0]!, 'tanque').provoca).toBeGreaterThan(0)
  })

  it('de soldado y de torre: el tanque aguanta el doble, el asesino corre más, la torre de tanque no pega', () => {
    const battle = createBattle({ decks: [vaqueros, vaqueros], seed: 5 })
    const tanque = de('tanque')[0]!
    const t = spawnUnit(battle, 0, tanque, { x: 0, z: 10 }, 'excelente')
    expect(t.sello).toBe('tanque')
    expect(t.shields).toBeGreaterThan(tanque.shields)
    expect(t.card.speed).toBeLessThan(tanque.speed)
    const asesino = de('asesino')[0]!
    const a = spawnUnit(battle, 0, asesino, { x: 2, z: 10 }, 'excelente', true)
    expect(a.card.speed).toBeGreaterThan(asesino.speed)
    // La torre del tanque: frena a los que entran y no les quita escudos.
    hacerTorre(battle, t)
    const rival = spawnUnit(battle, 1, de('asalto')[0]!, { x: 0, z: 8 }, 'excelente', true)
    const antes = rival.shields
    for (let i = 0; i < 60; i++) step(battle, 1 / 20)
    expect(rival.slowUntil).toBeGreaterThan(battle.time - 0.5)
    expect(rival.shields).toBe(antes)
    expect(estiloDe(tanque)).toBeDefined()
  })

  it('las ventajas se cumplen peleando: asesino > tanque, distancia > área, control > asesino, tanque > asalto', () => {
    expect(gana('asesino', 'tanque')).toBeGreaterThan(60)
    expect(gana('distancia', 'area')).toBeGreaterThan(60)
    expect(gana('control', 'asesino')).toBeGreaterThan(60)
    expect(gana('tanque', 'asalto')).toBeGreaterThan(60)
  }, 60000)
})
