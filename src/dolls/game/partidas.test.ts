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
