// Convierte los modelos OBJ de los packs Synty (carpeta Assets/) en GLB binarios pequeños para
// los escenarios. Solo se convierten los de la lista. Uso:  node scripts/obj2glb.mjs
// Guarda en public/escenarios/modelos/ y copia las dos texturas atlas.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..')
const WEST = path.join(ROOT, 'Assets/POLYGON_Western_Pack_Source_Files_v4/SourceFiles')
const FRONT = path.join(ROOT, 'Assets/POLYGON_Western_Frontier_SourceFiles_v4/SourceFiles')
const OUT = path.join(ROOT, 'public/escenarios')

/** W: pack Western, F: pack Frontier. */
const MODELS = [
  // Desierto
  'W:SM_Env_Cactus_01', 'W:SM_Env_Cactus_05', 'W:SM_Env_Cactus_10', 'W:SM_Env_Butte_01', 'W:SM_Env_Butte_02',
  'W:SM_Env_Rock_01', 'W:SM_Env_Rocks_02', 'W:SM_Env_TreeDead_01', 'W:SM_Prop_Tumbleweed_01', 'W:SM_Prop_Cow_Skull_01',
  'W:SM_Env_Grave_01', 'W:SM_Bld_Windmill_01', 'W:SM_Bld_Well_01', 'W:SM_Veh_Cart_01', 'W:SM_Prop_Hay_Bale_01',
  'F:SM_Env_Tree_Desert_01', 'F:SM_Env_Cactus_Large_01', 'F:SM_Bld_Teepee_01', 'F:SM_Bld_Tent_01',
  'F:SM_Prop_Wagon_Destroyed_01', 'F:SM_Env_RockTall_01', 'F:SM_Prop_Campfire_01', 'F:SM_Env_Shrub_01',
  // Pueblo
  'W:SM_Bld_Saloon_01', 'W:SM_Bld_Single_01', 'W:SM_Bld_Double_01', 'W:SM_Bld_Large_01', 'W:SM_Bld_Jail_01',
  'W:SM_Bld_Church_01', 'W:SM_Prop_HitchingPost_01', 'W:SM_Prop_WaterTrough_01', 'W:SM_Prop_Barrel_01',
  'W:SM_Prop_Crate_01', 'W:SM_Prop_Water_Tower_01', 'W:SM_Veh_Stagecoach_01', 'W:SM_Bld_Outhouse_01',
  'W:SM_Prop_Bench_01', 'W:SM_Prop_RoadSign_01', 'F:SM_Bld_Mexican_01',
  // Piezas de las casas del pueblo 3D (paredes + tejado + fachada + porche + toldo + letrero)
  'W:SM_Bld_Double_Roof_01', 'W:SM_Bld_Double_Roof_02', 'W:SM_Bld_Double_Front_01', 'W:SM_Bld_Double_Front_02',
  'W:SM_Bld_Double_Facade_01', 'W:SM_Bld_Double_Facade_03', 'W:SM_Bld_Double_Deck_01', 'W:SM_Bld_Double_DeckCover_01',
  'W:SM_Bld_Double_Balcony_01', 'W:SM_Bld_Single_Roof_01', 'W:SM_Bld_Single_Roof_02', 'W:SM_Bld_Single_Front_01',
  'W:SM_Bld_Single_Front_02', 'W:SM_Bld_Single_Facade_01', 'W:SM_Bld_Single_Facade_02', 'W:SM_Bld_Single_Deck_01',
  'W:SM_Bld_Single_DeckCover_01', 'W:SM_Bld_Roof_Patch_01', 'W:SM_Bld_TowerClock_01', 'W:SM_Bld_Shed_01',
  'W:SM_Bld_Sign_01', 'W:SM_Bld_Sign_02', 'W:SM_Bld_Sign_03', 'W:SM_Bld_Sign_04', 'W:SM_Bld_Sign_05', 'W:SM_Bld_Sign_06',
  'W:SM_Bld_Sign_07', 'W:SM_Bld_Sign_08', 'W:SM_Bld_Sign_09', 'W:SM_Bld_Sign_10', 'W:SM_Bld_Sign_11', 'W:SM_Bld_Sign_12',
  'W:SM_Bld_Sign_13', 'W:SM_Bld_Sign_14', 'W:SM_Bld_Sign_15', 'W:SM_Bld_Sign_16', 'W:SM_Bld_Sign_17', 'W:SM_Bld_Sign_18',
  'W:SM_Bld_Sign_19', 'W:SM_Bld_Sign_20',
  // Tren
  'W:SM_Env_Train_Track_Straight_01', 'W:SM_Veh_Train_01', 'W:SM_Veh_Train_Coal_01', 'W:SM_Veh_Train_Carriage_01',
  'W:SM_Veh_Train_Freight_01', 'W:SM_Bld_TrainStation_01', 'W:SM_Prop_Sack_01',
  // Mina
  'F:SM_Env_Mine_Entrance_01', 'F:SM_Env_Mine_Track_Straight_01', 'F:SM_Env_Mine_Framing_01', 'F:SM_Bld_Quarry_Tower_01',
  'F:SM_Bld_Quarry_01', 'F:SM_Bld_Quarry_Chimney_01', 'F:SM_Env_Quarry_Wall_Straight_01', 'F:SM_Env_Quarry_Rocks_01',
  'F:SM_Prop_Tnt_Box', 'F:SM_Prop_Tnt_Barrel_01', 'F:SM_Prop_Cart_01', 'F:SM_Prop_Cart_02', 'F:SM_Prop_Lantern_01',
  'F:SM_Prop_Quarry_Machine_01', 'F:SM_Prop_WoodPile_01',
  // Nieve
  'F:SM_Env_Birch_01', 'F:SM_Env_Birch_02', 'F:SM_Env_Tree_Tall_01', 'F:SM_Env_Tree_Tall_02', 'F:SM_Env_Tree_Clump_01',
  'F:SM_Bld_Cabin_01', 'F:SM_Bld_Fort_Tower_01', 'F:SM_Bld_Fort_Wall_01', 'F:SM_Prop_LogPile_01', 'F:SM_Env_RockFlat_01',
  'F:SM_Env_TreeStump_01', 'F:SM_Prop_PikeFence_01', 'F:SM_Prop_Barricade_Wood_01',
]

function sourcePath(spec) {
  const [pack, name] = spec.split(':')
  return pack === 'W' ? path.join(WEST, 'Obj', `${name}.obj`) : path.join(FRONT, 'Misc/OBJ', `${name}.obj`)
}

/** Lee un OBJ y lo deja como malla indexada (posicion en metros, normal y uv tal cual). */
function parseObj(text) {
  const v = []
  const vt = []
  const vn = []
  const pos = []
  const nor = []
  const uv = []
  const index = []
  const seen = new Map()
  const vertex = (token) => {
    let id = seen.get(token)
    if (id !== undefined) return id
    const [a, b, c] = token.split('/')
    const vi = (Number(a) < 0 ? v.length / 3 + Number(a) : Number(a) - 1) * 3
    pos.push(v[vi] * 0.01, v[vi + 1] * 0.01, v[vi + 2] * 0.01)
    if (b) {
      const ti = (Number(b) < 0 ? vt.length / 2 + Number(b) : Number(b) - 1) * 2
      uv.push(vt[ti], vt[ti + 1])
    } else uv.push(0, 0)
    if (c) {
      const ni = (Number(c) < 0 ? vn.length / 3 + Number(c) : Number(c) - 1) * 3
      nor.push(vn[ni], vn[ni + 1], vn[ni + 2])
    } else nor.push(0, 1, 0)
    id = pos.length / 3 - 1
    seen.set(token, id)
    return id
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('v ')) v.push(...line.split(/\s+/).slice(1, 4).map(Number))
    else if (line.startsWith('vt ')) vt.push(...line.split(/\s+/).slice(1, 3).map(Number))
    else if (line.startsWith('vn ')) vn.push(...line.split(/\s+/).slice(1, 4).map(Number))
    else if (line.startsWith('f ')) {
      const ids = line.split(/\s+/).slice(1).map(vertex)
      for (let i = 1; i < ids.length - 1; i++) index.push(ids[0], ids[i], ids[i + 1])
    }
  }
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), uv: new Float32Array(uv), index }
}

function pad4(buffer, fill) {
  const extra = (4 - (buffer.length % 4)) % 4
  return extra ? Buffer.concat([buffer, Buffer.alloc(extra, fill)]) : buffer
}

function toGlb(mesh) {
  const count = mesh.pos.length / 3
  const big = count > 65535
  const indices = big ? new Uint32Array(mesh.index) : new Uint16Array(mesh.index)
  const parts = [Buffer.from(mesh.pos.buffer), Buffer.from(mesh.nor.buffer), Buffer.from(mesh.uv.buffer), Buffer.from(indices.buffer)].map(
    (b) => pad4(b, 0),
  )
  const views = []
  let offset = 0
  parts.forEach((part, i) => {
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.length, ...(i === 3 ? { target: 34963 } : { target: 34962 }) })
    offset += part.length
  })
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < mesh.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], mesh.pos[i + k])
      max[k] = Math.max(max[k], mesh.pos[i + k])
    }
  }
  const json = {
    asset: { version: '2.0', generator: 'obj2glb (Duelo en el Oeste)' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3 }] }],
    buffers: [{ byteLength: offset }],
    bufferViews: views,
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count, type: 'VEC2' },
      { bufferView: 3, componentType: big ? 5125 : 5123, count: indices.length, type: 'SCALAR' },
    ],
  }
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20)
  const binChunk = Buffer.concat(parts)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8)
  const chunk = (data, type) => {
    const head = Buffer.alloc(8)
    head.writeUInt32LE(data.length, 0)
    head.writeUInt32LE(type, 4)
    return Buffer.concat([head, data])
  }
  return Buffer.concat([header, chunk(jsonChunk, 0x4e4f534a), chunk(binChunk, 0x004e4942)])
}

fs.mkdirSync(path.join(OUT, 'modelos'), { recursive: true })
let total = 0
for (const spec of MODELS) {
  const name = spec.split(':')[1]
  const glb = toGlb(parseObj(fs.readFileSync(sourcePath(spec), 'utf8')))
  fs.writeFileSync(path.join(OUT, 'modelos', `${name.replace(/^SM_/, '')}.glb`), glb)
  total += glb.length
}
fs.copyFileSync(path.join(WEST, 'Textures/PolygonWestern_Texture_01.png'), path.join(OUT, 'western.png'))
fs.copyFileSync(path.join(FRONT, 'Textures/PolygonWesternFrontier_Texture_01_A.png'), path.join(OUT, 'frontier.png'))
console.log(`${MODELS.length} modelos, ${(total / 1024 / 1024).toFixed(1)} MB`)
