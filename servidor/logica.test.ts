import { antesEnElRanking, idDeUsuario, iguales, limpiarFicha, problemaDeClave, problemaDePartida, problemaDeUsuario, resumirClave } from './logica'

describe('el servidor', () => {
  it('los usuarios se comparan sin mayúsculas ni espacios, y se piden razonables', () => {
    expect(idDeUsuario('  Pepe ')).toBe('pepe')
    expect(problemaDeUsuario('Pepe el Rápido')).toBeNull()
    expect(problemaDeUsuario('ab')).not.toBeNull()
    expect(problemaDeUsuario('pepe@correo.com')).not.toBeNull()
    expect(problemaDeUsuario('<script>')).not.toBeNull()
    expect(problemaDeClave('123')).not.toBeNull()
    expect(problemaDeClave('1234')).toBeNull()
  })

  it('la contraseña se guarda resumida: la misma con la misma sal da lo mismo, y otra no', async () => {
    const a = await resumirClave('secreto', 'sal1', 100)
    expect(a).toHaveLength(64)
    expect(a).not.toContain('secreto')
    expect(iguales(a, await resumirClave('secreto', 'sal1', 100))).toBe(true)
    expect(iguales(a, await resumirClave('otra', 'sal1', 100))).toBe(false)
    expect(iguales(a, await resumirClave('secreto', 'sal2', 100))).toBe(false)
  })

  it('de las fichas solo se acepta lo razonable, y el admin no entra en el ranking', () => {
    expect(limpiarFicha({ id: 'x', nombre: 'Admin', admin: true, monedas: 5 })).toBeNull()
    expect(limpiarFicha({ id: '', nombre: 'Sin id' })).toBeNull()
    const f = limpiarFicha({ id: 'j1', nombre: 'Billy', monedas: -40, partidas: 3, victorias: 99, mejorRacha: 9, look: { hat: 'kepi' } })!
    expect(f.monedas).toBe(0)
    expect(f.victorias).toBe(3)
    expect(f.mejorRacha).toBe(3)
    expect(f.look).toEqual({ hat: 'kepi' })
    expect(limpiarFicha({ id: 'j2', nombre: 'Gordo', look: { relleno: 'x'.repeat(5000) } })!.look).toBeNull()
  })

  it('el ranking va por monedas y, si empatan, por victorias', () => {
    const base = { partidas: 10, mejorRacha: 0, look: null, animacion: null }
    const lista = [
      { ...base, id: 'a', nombre: 'A', monedas: 100, victorias: 1 },
      { ...base, id: 'b', nombre: 'B', monedas: 300, victorias: 1 },
      { ...base, id: 'c', nombre: 'C', monedas: 100, victorias: 5 },
    ].sort(antesEnElRanking)
    expect(lista.map((f) => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('una partida tiene que ser una lista de personajes de tamaño normal', () => {
    expect(problemaDePartida([{ id: 'j1' }])).toBeNull()
    expect(problemaDePartida('nada')).not.toBeNull()
    expect(problemaDePartida(Array.from({ length: 20 }, () => ({})))).not.toBeNull()
  })
})
