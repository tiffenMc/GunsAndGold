import * as M from './mates'

describe('las matemáticas iguales en todos los aparatos', () => {
  it('dan lo mismo que las del navegador (hasta la billonésima)', () => {
    let s = 1
    const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 20000; i++) {
      const a = (azar() - 0.5) * 80
      const b = (azar() - 0.5) * 80
      expect(Math.abs(M.sin(a) - Math.sin(a))).toBeLessThan(1e-12)
      expect(Math.abs(M.cos(a) - Math.cos(a))).toBeLessThan(1e-12)
      expect(Math.abs(M.atan2(a, b) - Math.atan2(a, b))).toBeLessThan(1e-12)
      expect(Math.abs(M.hypot(a, b) - Math.hypot(a, b))).toBeLessThan(1e-9)
      const e = (azar() - 0.5) * 20
      expect(Math.abs(M.exp(e) - Math.exp(e)) / Math.exp(e)).toBeLessThan(1e-13)
      const p = azar() * 3
      expect(Math.abs(M.pow(p, 1.35) - Math.pow(p, 1.35))).toBeLessThan(1e-12)
      const t = (azar() - 0.5) * 2.8
      expect(Math.abs(M.tan(t) - Math.tan(t)) / Math.max(1, Math.abs(Math.tan(t)))).toBeLessThan(1e-11)
    }
    expect(M.atan2(0, 0)).toBe(0)
    expect(M.atan2(0, -1)).toBeCloseTo(Math.PI, 14)
    expect(M.pow(0.5, 0)).toBe(1)
    expect(M.exp(0)).toBe(1)
  })
})
