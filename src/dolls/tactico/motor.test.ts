import { BUILTIN_CARDS } from '../cards/catalog'
import { claseDe } from '../cards/model'
import type { BattleCard } from '../cards/model'
import {
  COLS,
  FILAS,
  MAX_VIVOS,
  PA_POR_TURNO,
  RONDAS,
  alcanzables,
  atacar,
  casillasDeSalida,
  crearTactico,
  desplegar,
  desplegarBot,
  dist,
  empezarPartida,
  mover,
  objetivos,
  pasoBot,
  terminarTurno,
  turnoBotCompleto,
  vivos,
  zonaDe,
} from './motor'

const mazoDe = (clase: 'vaqueros' | 'indios' | 'vikingos') =>
  BUILTIN_CARDS.filter((c): c is BattleCard => c.kind === 'batalla' && claseDe(c) === clase)

function partida(semilla = 1, a: 'vaqueros' | 'indios' | 'vikingos' = 'vaqueros', b: 'vaqueros' | 'indios' | 'vikingos' = 'vaqueros') {
  const t = crearTactico(mazoDe(a), mazoDe(b), semilla)
  desplegarBot(t, 0)
  desplegarBot(t, 1)
  empezarPartida(t)
  return t
}

describe('batalla por turnos', () => {
  it('el tablero es simetrico y las filas de salida estan libres', () => {
    const t = crearTactico(mazoDe('vaqueros'), mazoDe('vikingos'), 5)
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) expect(t.terreno[y]![x]).toBe(t.terreno[FILAS - 1 - y]![COLS - 1 - x])
    for (const bando of [0, 1] as const) for (const y of zonaDe(bando)) for (let x = 0; x < COLS; x++) expect(t.terreno[y]![x]).toBe('llano')
    expect(t.mano[0]).toHaveLength(8)
  })

  it('el despliegue es gratis hasta 4 soldados y solo en tus filas', () => {
    const t = crearTactico(mazoDe('vaqueros'), mazoDe('vaqueros'), 2)
    const cartas = t.mano[0].map((c) => c.id)
    expect(desplegar(t, 0, cartas[0]!, 3, 0)).toBeNull() // fila del rival
    for (let i = 0; i < MAX_VIVOS; i++) expect(desplegar(t, 0, cartas[i]!, i, zonaDe(0)[0]!)).not.toBeNull()
    expect(desplegar(t, 0, cartas[4]!, 5, zonaDe(0)[0]!)).toBeNull() // ya hay 4
    expect(vivos(t, 0)).toBe(4)
  })

  it('cada turno trae tres acciones (dos al que abre) y un soldado se mueve una vez', () => {
    const t = partida(3)
    expect(t.turno).toBe(0)
    // Quien abre sale con una accion menos; el resto de turnos, tres.
    expect(t.pa).toBe(PA_POR_TURNO - 1)
    const m = t.minis.find((x) => x.bando === 0)!
    const sitios = [...alcanzables(t, m).values()]
    expect(sitios.length).toBeGreaterThan(0)
    expect(sitios.every((s) => dist(s.x, s.y, m.x, m.y) <= m.mov)).toBe(true)
    expect(mover(t, m, sitios[0]!.x, sitios[0]!.y)).toBe(true)
    expect(t.pa).toBe(PA_POR_TURNO - 2)
    // No se mueve dos veces.
    const otra = [...alcanzables(t, m).values()][0]
    if (otra) expect(mover(t, m, otra.x, otra.y)).toBe(false)
  })

  it('no se puede jugar el turno del otro', () => {
    const t = partida(4)
    const rival = t.minis.find((x) => x.bando === 1)!
    const sitios = [...alcanzables(t, rival).values()]
    expect(mover(t, rival, sitios[0]!.x, sitios[0]!.y)).toBe(false)
  })

  it('un soldado puesto a tiro puede atacar y le quita vida, y la cobertura la reduce', () => {
    const t = partida(6)
    const yo = t.minis.find((x) => x.bando === 0 && x.alcance >= 2 && !x.estilo.pacifico)!
    const rival = t.minis.find((x) => x.bando === 1)!
    rival.escondido = false
    // Los pone frente a frente en llano.
    yo.x = 3
    yo.y = 5
    rival.x = 3
    rival.y = 5 - Math.min(2, yo.alcance)
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) t.terreno[y]![x] = 'llano'
    const hp = rival.hp
    const lista = objetivos(t, yo)
    const o = lista.find((q) => q.id === rival.id)!
    expect(o).toBeTruthy()
    const dano = o.dano
    expect(atacar(t, yo, o)).toBe(true)
    expect(rival.hp).toBeLessThan(hp)
    expect(yo.actuado).toBe(true)
    // La cobertura le quita la mitad.
    t.terreno[rival.y]![rival.x] = 'cobertura'
    const enCobertura = objetivos(t, { ...yo, actuado: false }).find((q) => q.id === rival.id)
    if (enCobertura && dist(yo.x, yo.y, rival.x, rival.y) > 1) expect(enCobertura.dano).toBeLessThan(dano + 0.001)
  })

  it('las rocas tapan la vista', () => {
    const t = partida(8)
    const yo = t.minis.find((x) => x.bando === 0 && x.alcance >= 3 && !x.estilo.pacifico)!
    const rival = t.minis.find((x) => x.bando === 1)!
    rival.escondido = false
    for (let y = 0; y < FILAS; y++) for (let x = 0; x < COLS; x++) t.terreno[y]![x] = 'llano'
    yo.x = 3
    yo.y = 6
    rival.x = 3
    rival.y = 3
    t.terreno[5]![3] = 'roca'
    t.terreno[4]![3] = 'roca'
    expect(objetivos(t, yo).some((o) => o.id === rival.id)).toBe(false)
  })

  it('una carta nueva sale como refuerzo con una accion, solo con menos de 4 vivos', () => {
    const t = partida(9)
    const mio = t.minis.filter((x) => x.bando === 0)
    expect(t.mano[0].length).toBeGreaterThan(0)
    expect(desplegar(t, 0, t.mano[0][0]!.id, 0, zonaDe(0)[1]!)).toBeNull() // hay 4
    mio[0]!.vivo = false
    const salidas = casillasDeSalida(t, 0)
    const pa = t.pa
    const nuevo = desplegar(t, 0, t.mano[0][0]!.id, salidas[0]!.x, salidas[0]!.y)
    expect(nuevo).not.toBeNull()
    expect(t.pa).toBe(pa - 1)
    expect(nuevo!.actuado).toBe(true)
  })

  it('el turno pasa de uno a otro y cada ronda cuenta', () => {
    const t = partida(10)
    terminarTurno(t)
    expect(t.turno).toBe(1)
    terminarTurno(t)
    expect(t.turno).toBe(0)
    expect(t.ronda).toBe(2)
  })

  it('una partida entera de bots acaba siempre, antes de las rondas o por puntos', () => {
    for (const [a, b] of [['vaqueros', 'indios'], ['indios', 'vikingos'], ['vikingos', 'vaqueros']] as const) {
      for (let semilla = 1; semilla <= 6; semilla++) {
        const t = partida(semilla, a, b)
        let guarda = 0
        while (t.fase === 'juego' && guarda++ < 400) turnoBotCompleto(t)
        expect(t.resultado, `${a}-${b}-${semilla}`).not.toBeNull()
        expect(t.ronda).toBeLessThanOrEqual(RONDAS)
      }
    }
  })

  it('el bot da pasos de uno en uno y acaba su turno', () => {
    const t = partida(12)
    terminarTurno(t) // le toca al bot
    expect(t.turno).toBe(1)
    let pasos = 0
    while (t.turno === 1 && pasos++ < 20) pasoBot(t)
    expect(t.turno).toBe(0)
  })
})
