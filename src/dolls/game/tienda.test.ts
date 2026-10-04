import { DEFAULT_LOOK, cloneLook } from '../dollParams'
import { brazoEn, movimientoDeDibujo, problemaDelDibujo, repartir } from './animacionDibujada'
import type { Punto } from './animacionDibujada'
import {
  animacionDe,
  comprar,
  createPlayer,
  ganarBotin,
  getPlayer,
  guardarAnimacion,
  loTienes,
  pintaDe,
  ponerPinta,
  switchPlayer,
} from './players'
import { LINGOTES_GANANDO, LINGOTES_PERDIENDO, botinDeRango } from './progreso'
import { ARTICULOS, PRECIO_ANIMACION, articulo, articulosDePago, loQueFalta } from './tienda'

function nuevo(nombre: string) {
  const player = createPlayer(nombre, '')
  switchPlayer(player.id)
  return getPlayer()
}

describe('lingotes y diamantes', () => {
  it('una partida de rango siempre da lingotes (más si ganas) y a veces un diamante', () => {
    expect(botinDeRango(true, () => 0.99)).toEqual({ lingotes: LINGOTES_GANANDO, diamantes: 0 })
    expect(botinDeRango(false, () => 0.99)).toEqual({ lingotes: LINGOTES_PERDIENDO, diamantes: 0 })
    expect(botinDeRango(false, () => 0)).toEqual({ lingotes: LINGOTES_PERDIENDO, diamantes: 1 })
    expect(LINGOTES_GANANDO).toBeGreaterThan(LINGOTES_PERDIENDO)
    expect(LINGOTES_PERDIENDO).toBeGreaterThan(0)
  })

  it('un jugador nuevo empieza sin lingotes ni diamantes y los va sumando', () => {
    const player = nuevo('Bolsillos')
    expect(player.lingotes).toBe(0)
    expect(player.diamantes).toBe(0)
    ganarBotin({ lingotes: 15, diamantes: 1 })
    ganarBotin({ lingotes: 6, diamantes: 0 })
    expect(getPlayer().lingotes).toBe(21)
    expect(getPlayer().diamantes).toBe(1)
  })
})

describe('la Sastrería', () => {
  it('cada artículo tiene id único, y lo de pago cuesta algo', () => {
    const ids = ARTICULOS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const a of ARTICULOS) if (a.precio) expect(a.precio.cantidad).toBeGreaterThan(0)
    // Hay cosas de las dos monedas.
    expect(ARTICULOS.some((a) => a.precio?.moneda === 'lingotes')).toBe(true)
    expect(ARTICULOS.some((a) => a.precio?.moneda === 'diamantes')).toBe(true)
  })

  it('la pinta de serie es gratis: no hay que comprar nada para llevarla', () => {
    expect(articulosDePago(cloneLook(DEFAULT_LOOK))).toEqual([])
  })

  it('se compra con lingotes, no se paga dos veces y sin dinero no se puede', () => {
    nuevo('Comprador')
    expect(comprar('sombrero:bombin')).toBe('No te llegan los lingotes')
    ganarBotin({ lingotes: 100, diamantes: 0 })
    expect(comprar('sombrero:bombin')).toBeNull()
    expect(getPlayer().lingotes).toBe(100 - articulo('sombrero:bombin')!.precio!.cantidad)
    expect(loTienes(getPlayer(), 'sombrero:bombin')).toBe(true)
    expect(comprar('sombrero:bombin')).toBe('Ya lo tienes')
    // Lo de diamantes no se paga con lingotes.
    expect(comprar('sombrero:chistera')).toBe('No te llegan los diamantes')
  })

  it('no te puedes poner lo que no has comprado; cuando lo compras, sí', () => {
    nuevo('Presumido')
    const look = { ...pintaDe(getPlayer()), hat: 'chistera' as const, hatColor: '#e2b007' }
    expect(loQueFalta(look, [])).toEqual(['sombrero:chistera', 'color:oro'])
    expect(ponerPinta(look)).toContain('Te falta comprar')
    expect(getPlayer().pinta).toBeUndefined()
    ganarBotin({ lingotes: 0, diamantes: 4 })
    expect(comprar('sombrero:chistera')).toBeNull()
    expect(comprar('color:oro')).toBeNull()
    expect(getPlayer().diamantes).toBe(0)
    expect(ponerPinta(look)).toBeNull()
    expect(pintaDe(getPlayer()).hat).toBe('chistera')
  })
})

describe('las animaciones dibujadas', () => {
  const zigzag: Punto[] = [
    [0.2, 0.3],
    [0.5, 0.9],
    [0.8, 0.3],
    [0.5, 0.6],
  ]

  it('un trazo se reparte en puntos a la misma distancia, dentro del lienzo', () => {
    const puntos = repartir([...zigzag, [1.4, -0.2]], 16)
    expect(puntos).toHaveLength(16)
    for (const [x, y] of puntos) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
    expect(puntos[0]).toEqual([0.2, 0.3])
  })

  it('un garabato demasiado corto no vale', () => {
    expect(problemaDelDibujo([[0.5, 0.5], [0.52, 0.5]])).not.toBeNull()
    expect(problemaDelDibujo(zigzag)).toBeNull()
  })

  it('arriba del lienzo el brazo sube y abajo cuelga; el tiro sale al final del trazo', () => {
    expect(brazoEn([0.5, 1]).hombro[0]).toBeGreaterThan(brazoEn([0.5, 0]).hombro[0])
    // A la derecha del lienzo (donde queda la mano del arma), el brazo se abre hacia fuera.
    expect(brazoEn([1, 0.5]).hombro[2]).toBeGreaterThan(brazoEn([0, 0.5]).hombro[2])
    const motion = movimientoDeDibujo({ id: 'x', nombre: 'Zigzag', puntos: repartir(zigzag) })
    expect(motion.kind).toBe('disparar')
    expect(motion.firesAt).toHaveLength(1)
    expect(motion.firesAt![0]!).toBeLessThan(motion.length)
    // Las claves van en orden de tiempo.
    for (let i = 1; i < motion.keys.length; i++) expect(motion.keys[i]!.t).toBeGreaterThanOrEqual(motion.keys[i - 1]!.t)
    expect(movimientoDeDibujo({ id: 'x', nombre: 'Zigzag', puntos: zigzag }, true).loop).toBe(true)
  })

  it('guardar una animación cuesta diamantes y se queda puesta', () => {
    nuevo('Dibujante')
    expect(guardarAnimacion('Zigzag', zigzag)).toBe('No te llegan los diamantes')
    ganarBotin({ lingotes: 0, diamantes: PRECIO_ANIMACION.cantidad })
    expect(guardarAnimacion('Zigzag', zigzag)).toBeNull()
    const player = getPlayer()
    expect(player.diamantes).toBe(0)
    expect(player.animaciones).toHaveLength(1)
    expect(animacionDe(player)?.nombre).toBe('Zigzag')
  })
})
