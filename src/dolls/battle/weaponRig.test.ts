import { describe, expect, it } from 'vitest'
import { aimDir } from './engine'
import { GUN_YAW, muzzleProfile } from './WeaponRig'

/** Hacia donde mira el cañon del arma (su +X) con ese giro. */
function facing(yaw: number) {
  return { x: Math.cos(yaw), z: -Math.sin(yaw) }
}

describe('el arma del campo', () => {
  it('tira recto: el cañon mira al fuerte rival, igual que la bala', () => {
    const gun = facing(GUN_YAW)
    const shot = aimDir(0, 0)
    expect(gun.x).toBeCloseTo(shot.x, 6)
    expect(gun.z).toBeCloseTo(shot.z, 6)
  })
})

describe('cada arma se porta distinto al disparar', () => {
  it('la escopeta pega mas culatazo y mas fogonazo que el revolver', () => {
    const revolver = muzzleProfile('bala')
    const escopeta = muzzleProfile('perdigones')
    expect(escopeta.kick).toBeGreaterThan(revolver.kick)
    expect(escopeta.flash).toBeGreaterThan(revolver.flash)
    expect(escopeta.shake).toBeGreaterThan(revolver.shake)
  })

  it('el rifle pega un tiro seco: fogonazo corto y sin vaina', () => {
    const rifle = muzzleProfile('perforante')
    expect(rifle.shells).toBe(0)
    expect(rifle.flash).toBeLessThan(muzzleProfile('bala').flash)
  })

  it('la gatling casi no acusa el culatazo de cada bala', () => {
    expect(muzzleProfile('rafaga').kick).toBeLessThan(muzzleProfile('bala').kick)
  })

  it('la carga lanzada no hace fogonazo ni suelta vaina', () => {
    expect(muzzleProfile('explosivo').flash).toBe(0)
    expect(muzzleProfile('explosivo').shells).toBe(0)
  })
})
