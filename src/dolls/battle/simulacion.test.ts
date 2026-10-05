import { BUILTIN_CARDS } from '../cards/catalog'
import { MAX_PASOS, Repeticion, Simulacion, repetir } from './simulacion'
import type { Jugada, Preparativos } from './simulacion'

/** Un "jugador" de prueba: hace jugadas al azar (con su propio azar, no el de la partida). */
function jugadorDePrueba(semilla: number) {
  let s = semilla
  const azar = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  return (sim: Simulacion) => {
    const r = azar()
    let j: Jugada | null = null
    if (r < 0.02) j = { a: 'carta', slot: Math.floor(azar() * 4), x: (azar() - 0.5) * 8, z: 4 + azar() * 12, precision: 0.3 + azar() * 0.7, torre: azar() < 0.1 }
    else if (r < 0.035) j = { a: 'disparo', posicion: (azar() - 0.5) * 8 }
    else if (r < 0.037) j = { a: 'reroll' }
    else if (r < 0.039) j = { a: 'dinamita', origen: (azar() - 0.5) * 6, destino: { x: (azar() - 0.5) * 8, z: -10 - azar() * 10 } }
    if (j) sim.jugar(j)
  }
}

/** Lo que define cómo ha quedado una partida (si esto coincide, la partida es la misma). */
function foto(sim: Simulacion) {
  const b = sim.battle
  return JSON.stringify({
    over: b.over,
    pasos: sim.pasos,
    fuertes: b.forts.map((f) => f.hp),
    muertes: b.muertes,
    kills: b.kills,
    unidades: b.units.map((u) => [u.id, u.card.id, Math.round(u.x * 1e6), Math.round(u.z * 1e6), u.state]),
    resumen: sim.resumen(),
  })
}

const prep = (semilla: number): Preparativos => ({ mazos: [BUILTIN_CARDS, BUILTIN_CARDS], semilla, clima: 'dia' })

describe('la partida grabada', () => {
  it('repetida con sus jugadas sale idéntica, aunque en vivo el móvil fuera a trompicones', () => {
    for (const semilla of [3, 77]) {
      const vivo = new Simulacion(prep(semilla))
      const juega = jugadorDePrueba(semilla * 13)
      // Fotogramas irregulares, como en un móvil de verdad (de 8 a 50 ms).
      let s = semilla
      while (!vivo.battle.over && vivo.pasos < MAX_PASOS) {
        s = (s * 16807) % 2147483647
        vivo.avanzar(0.008 + (s / 2147483647) * 0.042)
        juega(vivo)
        vivo.battle.events.length = 0
      }
      expect(vivo.battle.over).not.toBeNull()
      expect(vivo.jugadas.length).toBeGreaterThan(20)
      const otra = repetir(prep(semilla), JSON.parse(JSON.stringify(vivo.jugadas)))
      expect(foto(otra)).toBe(foto(vivo))
    }
  })

  it('a trozos (como en el servidor) sale lo mismo que de un tirón', () => {
    const vivo = new Simulacion(prep(5))
    const juega = jugadorDePrueba(99)
    while (!vivo.battle.over && vivo.pasos < MAX_PASOS) {
      vivo.avanzar(1 / 60)
      juega(vivo)
    }
    const trozos = new Repeticion(prep(5), vivo.jugadas)
    while (!trozos.acabada()) trozos.seguir(250)
    expect(foto(trozos.sim)).toBe(foto(vivo))
  })

  it('si cambias una sola jugada, la partida ya no es la misma', () => {
    const vivo = new Simulacion(prep(8))
    const juega = jugadorDePrueba(5)
    while (!vivo.battle.over && vivo.pasos < MAX_PASOS) {
      vivo.avanzar(1 / 60)
      juega(vivo)
    }
    const trucadas = vivo.jugadas.map((g) => (g.j.a === 'carta' ? { ...g, j: { ...g.j, precision: 1 } } : g))
    expect(foto(repetir(prep(8), trucadas))).not.toBe(foto(vivo))
  })
})
