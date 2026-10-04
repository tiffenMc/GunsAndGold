import { useGLTF, useTexture } from '@react-three/drei'
import { useMemo } from 'react'
import { MeshLambertMaterial, SRGBColorSpace } from 'three'
import type { Group, Mesh, Texture } from 'three'

/**
 * Modelos de los packs POLYGON Western (Synty), convertidos a GLB con scripts/obj2glb.mjs.
 * Todos usan una textura atlas: la del pack Western o la del Frontier.
 */

const FRONTIER = new Set([
  'Env_Tree_Desert_01', 'Env_Cactus_Large_01', 'Bld_Teepee_01', 'Bld_Tent_01', 'Prop_Wagon_Destroyed_01',
  'Env_RockTall_01', 'Prop_Campfire_01', 'Env_Shrub_01', 'Bld_Mexican_01', 'Env_Mine_Entrance_01',
  'Env_Mine_Track_Straight_01', 'Env_Mine_Framing_01', 'Bld_Quarry_Tower_01', 'Bld_Quarry_01',
  'Bld_Quarry_Chimney_01', 'Env_Quarry_Wall_Straight_01', 'Env_Quarry_Rocks_01', 'Prop_Tnt_Box',
  'Prop_Tnt_Barrel_01', 'Prop_Cart_01', 'Prop_Cart_02', 'Prop_Lantern_01', 'Prop_Quarry_Machine_01',
  'Prop_WoodPile_01', 'Env_Birch_01', 'Env_Birch_02', 'Env_Tree_Tall_01', 'Env_Tree_Tall_02', 'Env_Tree_Clump_01',
  'Bld_Cabin_01', 'Bld_Fort_Tower_01', 'Bld_Fort_Wall_01', 'Prop_LogPile_01', 'Env_RockFlat_01', 'Env_TreeStump_01',
  'Prop_PikeFence_01', 'Prop_Barricade_Wood_01',
])

const BASE = `${import.meta.env.BASE_URL}escenarios/`
export const modelUrl = (name: string) => `${BASE}modelos/${name}.glb`

const materials = new Map<string, MeshLambertMaterial>()

/** Material del atlas. Con nieve, lo que mira hacia arriba se cubre de blanco. */
function atlasMaterial(map: Texture, key: string, snow: boolean): MeshLambertMaterial {
  const id = `${key}|${snow ? 'nieve' : ''}`
  let material = materials.get(id)
  if (material) return material
  material = new MeshLambertMaterial({ map })
  if (snow) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;')
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvSnowN = normalize(mat3(modelMatrix) * objectNormal);')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;')
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.96, 1.0), smoothstep(0.45, 0.8, vSnowN.y));',
        )
    }
    material.customProgramCacheKey = () => 'nieve'
  }
  materials.set(id, material)
  return material
}

function useAtlas(name: string): { map: Texture; key: string } {
  const [western, frontier] = useTexture([`${BASE}western.png`, `${BASE}frontier.png`])
  // Las UV vienen del OBJ tal cual: la textura se usa sin voltear al reves que en glTF.
  for (const tex of [western, frontier]) {
    if (tex && tex.colorSpace !== SRGBColorSpace) {
      tex.flipY = true
      tex.colorSpace = SRGBColorSpace
      tex.needsUpdate = true
    }
  }
  return FRONTIER.has(name) ? { map: frontier!, key: 'F' } : { map: western!, key: 'W' }
}

export interface Placement {
  m: string
  x: number
  z: number
  /** Giro en grados. */
  r?: number
  s?: number
  y?: number
}

/** Un modelo colocado en el escenario (comparte geometria con los demas iguales). */
export function Model({ m, x, z, r = 0, s = 1, y = 0, snow = false }: Placement & { snow?: boolean }) {
  const gltf = useGLTF(modelUrl(m))
  const { map, key } = useAtlas(m)
  const object = useMemo(() => {
    const clone = gltf.scene.clone(true) as Group
    const material = atlasMaterial(map, key, snow)
    clone.traverse((child) => {
      const mesh = child as Mesh
      if (mesh.isMesh) mesh.material = material
    })
    return clone
  }, [gltf, map, key, snow])
  return <primitive object={object} position={[x, y, z]} rotation={[0, (r * Math.PI) / 180, 0]} scale={s} />
}

export function preloadModels(names: string[]) {
  for (const name of names) useGLTF.preload(modelUrl(name))
}
