import { createPlayer, getPlayer, players, switchPlayer, updatePlayer } from './players'
import { EN_LA_TARIMA, losMasBuscados, porcentajeDeVictorias, ranking } from './ranking'

function jugador(nombre: string, monedas: number, played: number, won: number) {
  const player = createPlayer(nombre, '')
  switchPlayer(player.id)
  updatePlayer({ monedas, played, won })
  return getPlayer()
}

describe('Los Más Buscados', () => {
  it('manda el rango (monedas); con empate, el que más ha ganado; el admin y los que no han jugado no salen', () => {
    jugador('Sin jugar', 9999, 0, 0)
    jugador('Tercero', 500, 10, 2)
    jugador('Primero', 900, 10, 5)
    jugador('Segundo', 500, 10, 6)
    const lista = ranking(players())
    expect(lista.map((f) => f.nombre)).toEqual(['Primero', 'Segundo', 'Tercero'])
    expect(lista.map((f) => f.puesto)).toEqual([1, 2, 3])
    expect(lista.some((f) => f.nombre === 'Admin')).toBe(false)
  })

  it('en la tarima solo caben cinco, y cada uno sale con su pinta', () => {
    for (let i = 0; i < 4; i++) jugador(`Relleno ${i}`, 100 + i, 3, 1)
    const tarima = losMasBuscados(players())
    expect(tarima).toHaveLength(EN_LA_TARIMA)
    for (const ficha of tarima) expect(ficha.look.hat).toBeTruthy()
    expect(porcentajeDeVictorias({ partidas: 4, victorias: 3 })).toBe(75)
    expect(porcentajeDeVictorias({ partidas: 0, victorias: 0 })).toBe(0)
  })
})
