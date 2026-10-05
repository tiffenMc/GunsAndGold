import { selloDe, torreSinDano } from './sellos'
import { BUILTIN_BATTLE, BUILTIN_CARDS, BUILTIN_WEAPONS } from '../cards/catalog'
import {
  DRAW_S,
  QUALITIES,
  SPECIAL_SECONDS,
  claseDe,
  cardPower,
  patternLevelFor,
  qualityOf,
  scaledStats,
  specialOf,
  usesOf,
} from '../cards/model'
import type { BattleCard, WeaponCard } from '../cards/model'
import { PATTERNS, patternById, traceAccuracy } from '../cards/patterns'
import { ESTILOS, ESTILO_LISTA, estiloDe } from './estilos'
import { habilidadDe } from './habilidades'
import type { Pt } from '../cards/patterns'
import { createBot, stepBot } from './bot'
import {
  DEPLOY_BACK,
  DEPLOY_FRONT,
  CART_FIRST_S,
  CART_FIRST_MAX_S,
  CART_GRACE_S,
  CART_HP,
  DYNAMITE_AMMO,
  DYNAMITE_FUSE_MS,
  FIRE_LINE,
  FORT_HP,
  FORT_Z,
  REROLL_S,
  lobLanding,
  TUNNEL_LEN,
  TUNNEL_S,
  createBattle,
  drainEvents,
  fireBonusDynamite,
  fireWeapon,
  paceAt,
  playCard,
  rerollWeapon,
  spawnUnit,
  hurtUnit,
  hacerTorre,
  rangoDeTorre,
  TORRE_S,
  step,
  weaponCard,
  isStunned,
  hiddenBySmoke,
  smokeVisibility,
  useSpecial,
  alcanceDe,
  soltarTorre,
  weaponShotFromStroke,
  SMOKE_R,
  SMOKE_S,
  ZAP_S,
} from './engine'
import type { Battle } from './engine'
import { hudLayout } from './layout'
import { BALAS, RACHA_MAX, RECARGA_S, TIEMPO_MAXIMO_S, furiaEn, maxVivosEn } from './economia'

const card = (id: string) => BUILTIN_CARDS.find((c) => c.id === id)!
const vaquero = card('vaquero') as BattleCard
const sheriff = card('sheriff') as BattleCard

/** Para probar el disparo de siempre sin que salte la habilidad. */
function sinHabilidad<T extends { hab: { listaEn: number } }>(unit: T): T {
  unit.hab.listaEn = Infinity
  return unit
}

function run(battle: Battle, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) step(battle, 1 / 30)
}

function onlyDeck(battles: BattleCard[], weapons: WeaponCard[]) {
  return [...battles, ...weapons]
}

describe('catalogo', () => {
  it('trae 3 clases con 30 muñecos de batalla cada una: 10 normales, 10 especiales, 6 epicas y 4 divinas (y 14 armas)', () => {
    expect(BUILTIN_BATTLE).toHaveLength(90)
    expect(BUILTIN_WEAPONS).toHaveLength(42)
    expect(BUILTIN_CARDS).toHaveLength(132)
    for (const clase of ['vaqueros', 'indios', 'vikingos'] as const) {
      const suyos = BUILTIN_BATTLE.filter((card) => claseDe(card) === clase)
      expect(suyos, clase).toHaveLength(30)
      const porRareza = (rareza: string) => suyos.filter((card) => card.rarity === rareza).length
      expect(porRareza('normal')).toBe(10)
      expect(porRareza('especial')).toBe(10)
      expect(porRareza('epica')).toBe(6)
      expect(porRareza('divina')).toBe(4)
      // Cada muñeco pelea a su manera: no se repite ningun estilo dentro de la clase.
      const estilos = suyos.map((card) => card.estilo)
      expect(estilos.every((estilo) => estilo && ESTILOS[estilo])).toBe(true)
      expect(new Set(estilos).size, clase).toBe(30)
      expect(BUILTIN_WEAPONS.filter((arma) => claseDe(arma) === clase), clase).toHaveLength(14)
    }
    // Los id no se repiten entre clases.
    expect(new Set(BUILTIN_CARDS.map((card) => card.id)).size).toBe(BUILTIN_CARDS.length)
    // Las especiales son de un solo uso y no tiran balas.
    const specials = BUILTIN_WEAPONS.filter((weapon) => weapon.special)
    expect(specials.map((weapon) => weapon.special).sort()).toEqual(['humo', 'humo', 'humo', 'rayo', 'rayo', 'rayo', 'tunel', 'tunel', 'tunel'])
    expect(specials.every((weapon) => weapon.uses === 1)).toBe(true)
  })

  it('cada especial lleva su modelo, su duración y su ficha', () => {
    expect(SPECIAL_SECONDS).toEqual({ humo: 10, rayo: 8, tunel: 10 })
    const specials = BUILTIN_WEAPONS.filter((weapon) => weapon.special && claseDe(weapon) === 'vaqueros')
    // Cada una se dibuja distinta en la carta: nada de compartir el modelo de la dinamita.
    expect(new Set(specials.map((weapon) => weapon.model)).size).toBe(specials.length)
    for (const weapon of specials) {
      const info = specialOf(weapon)
      expect(info?.seconds, weapon.id).toBe(SPECIAL_SECONDS[weapon.special!])
      expect(info?.note, weapon.id).toBeTruthy()
    }
  })

  it('cada carta lleva el patron que le toca por su fuerza', () => {
    for (const c of BUILTIN_BATTLE) {
      expect(patternById(c.pattern).level, c.id).toBe(patternLevelFor(cardPower(c)))
    }
  })

  it('los patrones que se usan existen y hay variedad', () => {
    const usados = new Set(BUILTIN_BATTLE.map((card) => card.pattern))
    for (const id of usados) expect(PATTERNS.some((patron) => patron.id === id), id).toBe(true)
    expect(usados.size).toBeGreaterThanOrEqual(8)
  })
})

describe('calidad del trazo', () => {
  const shift = (points: Pt[], dx: number, dy: number) => points.map((p) => ({ x: p.x + dx, y: p.y + dy }))

  it('calcado = excelente, y da igual el sentido', () => {
    for (const pattern of PATTERNS) {
      expect(qualityOf(traceAccuracy(pattern.points, pattern.points)).id).toBe('excelente')
      expect(qualityOf(traceAccuracy(pattern.points, [...pattern.points].reverse())).id).toBe('excelente')
    }
  })

  it('cuanto mas te desvias, peor calidad', () => {
    const pattern = patternById('herradura')
    const order = QUALITIES.map((q) => q.id)
    const near = qualityOf(traceAccuracy(pattern.points, shift(pattern.points, 0.02, 0.01))).id
    const mid = qualityOf(traceAccuracy(pattern.points, shift(pattern.points, 0.08, 0.05))).id
    const far = qualityOf(traceAccuracy(pattern.points, shift(pattern.points, 0.25, 0.2))).id
    expect(near).toBe('excelente')
    expect(order.indexOf(mid)).toBeLessThan(order.indexOf('excelente'))
    expect(order.indexOf(mid)).toBeGreaterThan(order.indexOf('mal'))
    expect(far).toBe('mal')
  })

  it('un toque no es un trazo', () => {
    const pattern = patternById('circulo')
    expect(traceAccuracy(pattern.points, [{ x: 0.5, y: 0.5 }, { x: 0.51, y: 0.5 }])).toBe(0)
  })

  it('excelente saca la carta entera y mal la saca muy tocada', () => {
    const big = { ...vaquero, shields: 5, damage: 120 }
    expect(scaledStats(big, QUALITIES[4]!)).toEqual({ shields: 5, damage: 120 })
    const bad = scaledStats(big, QUALITIES[0]!)
    expect(bad.shields).toBeLessThan(5)
    expect(bad.damage).toBeLessThan(120)
    expect(scaledStats({ ...vaquero, shields: 1 }, QUALITIES[0]!).shields).toBe(1)
  })
})

describe('mano', () => {
  it('la carta premio añade un quinto hueco a la derecha, sin pisar las otras cuatro', () => {
    const plain = hudLayout(460, 569)
    expect(plain.bonus).toBeUndefined()
    expect([...plain.slots, plain.weapon]).toHaveLength(4)

    const withBonus = hudLayout(460, 569, true)
    const rects = [...withBonus.slots, withBonus.weapon, withBonus.bonus!]
    expect(rects).toHaveLength(5)
    for (let i = 1; i < rects.length; i++) {
      expect(rects[i]!.x).toBeGreaterThanOrEqual(rects[i - 1]!.x + rects[i - 1]!.w)
    }
    expect(withBonus.bonus!.x + withBonus.bonus!.w).toBeLessThanOrEqual(460)
  })

  it('el reroll cabe justo debajo de la carta del arma', () => {
    const layout = hudLayout(460, 569)
    expect(layout.reroll.x).toBe(layout.weapon.x)
    expect(layout.reroll.w).toBe(layout.weapon.w)
    expect(layout.reroll.y).toBeGreaterThanOrEqual(layout.weapon.y + layout.weapon.h)
    expect(layout.reroll.y + layout.reroll.h).toBeLessThanOrEqual(569)
  })
})

describe('batalla', () => {
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))

  it('empieza con 3 cartas de batalla y un arma con 2 usos', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 1 })
    expect(battle.hands[0].slots.every((slot) => slot.cardId)).toBe(true)
    expect(weaponCard(battle, 0)).not.toBeNull()
    expect(battle.hands[0].weapon.uses).toBe(2)
  })

  it('la tropa avisa cuando dispara (para que suene la bala)', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 18 })
    spawnUnit(battle, 0, vaquero, { x: 0, z: -FORT_Z + 6 }, 'excelente')
    run(battle, 3)
    expect(battle.events.some((event) => event.type === 'troopShot' && event.side === 0)).toBe(true)
  })

  it('la tropa sale donde sueltas y enseguida llega otra carta', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 2 })
    const unit = playCard(battle, 0, 0, 3, 8, 1)!
    expect(unit.x).toBe(3)
    expect(unit.z).toBe(8)
    expect(unit.quality).toBe('excelente')
    expect(battle.hands[0].slots[0]!.cardId).toBeNull()
    run(battle, DRAW_S - 0.2)
    expect(battle.hands[0].slots[0]!.cardId).toBeNull()
    run(battle, 0.4)
    expect(battle.hands[0].slots[0]!.cardId).not.toBeNull()
  })

  it('el arma tiene 2 usos y a los 3 s llega otra distinta', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 3 })
    const first = weaponCard(battle, 0)!.id
    expect(fireWeapon(battle, 0, 0, 0)).toBe(true)
    expect(fireWeapon(battle, 0, 0, 0)).toBe(true)
    expect(fireWeapon(battle, 0, 0, 0)).toBe(false)
    run(battle, 2.9)
    expect(weaponCard(battle, 0)).toBeNull()
    run(battle, 0.2)
    expect(weaponCard(battle, 0)!.id).not.toBe(first)
  })

  it('una tropa sin defensa llega, se planta y le quita vida al fuerte', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 4 })
    const unit = spawnUnit(battle, 0, vaquero, { x: 0, z: 3 }, 'excelente')
    // El campo es mas largo: la tropa tiene que cruzar mas para llegar a la linea de la casa.
    run(battle, 60)
    expect(unit.state).toBe('fuego')
    expect(battle.forts[1].hp).toBeLessThan(FORT_HP)
  })

  it('dos cartas iguales se pelean escudo a escudo y una se rompe', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 5 })
    const mine = spawnUnit(battle, 0, vaquero, { x: 0, z: 2 }, 'excelente')
    const theirs = spawnUnit(battle, 1, vaquero, { x: 0, z: -2 }, 'mal')
    run(battle, 12)
    expect(theirs.state).toBe('muerto')
    expect(mine.state).not.toBe('muerto')
    // En el duelo no hay daño a los fuertes todavia.
    expect(battle.forts[0].hp).toBe(FORT_HP)
  })

  it('el campo es un campo de tiro: tambien se disparan entre si las cartas distintas', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 6 })
    const mine = spawnUnit(battle, 0, vaquero, { x: 0, z: 2 }, 'excelente')
    const theirs = spawnUnit(battle, 1, sheriff, { x: 0, z: -2 }, 'excelente')
    run(battle, 8)
    expect(mine.shields + theirs.shields).toBeLessThan(mine.maxShields + theirs.maxShields)
  })

  it('las balas del arma quitan escudos pero nunca dañan al fuerte', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 7 })
    const foe = spawnUnit(battle, 1, sheriff, { x: 0, z: FIRE_LINE - 15 }, 'excelente', true)
    const before = foe.shields
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.hands[0].weapon.cardId = rifle.id
    battle.cards.set(rifle.id, rifle)
    // De frente: sale de la linea de fuego y sube recto hasta el alcance del rifle.
    fireWeapon(battle, 0, 0, 0)
    run(battle, 2)
    expect(foe.shields).toBe(before - 1)
    expect(battle.forts[1].hp).toBe(FORT_HP)
  })

  it('la dinamita explota al final de su alcance y da a todos los de alrededor', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 8 })
    const dynamite = BUILTIN_WEAPONS.find((w) => w.id === 'dinamita')!
    // Los muñecos se ponen justo donde llega la carga.
    const landingZ = FIRE_LINE - dynamite.shot.range
    const a = spawnUnit(battle, 1, vaquero, { x: -0.8, z: landingZ }, 'excelente', true)
    const b = spawnUnit(battle, 1, sheriff, { x: 0.8, z: landingZ + 0.4 }, 'excelente', true)
    battle.hands[0].weapon.cardId = dynamite.id
    battle.cards.set(dynamite.id, dynamite)
    fireWeapon(battle, 0, 0, 0)
    run(battle, 1.5)
    expect(a.shields).toBe(a.maxShields - 1)
    expect(b.shields).toBe(b.maxShields - 1)
  })

  it('la boca se pone en la vertical del dedo, sin importar donde cruzaste', () => {
    // Cruzas tu linea por la izquierda y acabas con el dedo a la derecha.
    const shot = weaponShotFromStroke(0, [
      { x: -1.5, z: FIRE_LINE + 2.5 },
      { x: -1.5, z: FIRE_LINE - 2 },
      { x: 2.5, z: FIRE_LINE - 4 },
    ])
    expect(shot).not.toBeNull()
    expect(shot!.position).toBeCloseTo(2.5, 5)
  })

  it('el arma tira recto: no hay rotacion que valga', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 12 })
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.hands[0].weapon.cardId = rifle.id
    battle.cards.set(rifle.id, rifle)
    fireWeapon(battle, 0, -4)
    const bolt = battle.bullets[0]!
    expect(bolt.x).toBeCloseTo(-4, 5)
    expect(bolt.dx).toBeCloseTo(0, 5)
    expect(bolt.dz).toBeCloseTo(-1, 5)
  })

  it('el humo esconde a tus tropas: el rival no las ve y ellas le siguen pegando', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 21 })
    battle.smokes.push({ id: 1, side: 0, x: 0, z: 4, radius: SMOKE_R, until: SMOKE_S })
    const mine = spawnUnit(battle, 0, vaquero, { x: 0, z: 4 }, 'excelente')
    const theirs = spawnUnit(battle, 1, vaquero, { x: 0, z: 2 }, 'excelente')
    expect(hiddenBySmoke(battle, mine)).toBe(true)
    expect(hiddenBySmoke(battle, theirs)).toBe(false)
    run(battle, 3)
    // La tuya no recibe ni un tiro; la suya si.
    expect(mine.shields).toBe(mine.maxShields)
    expect(theirs.shields).toBeLessThan(theirs.maxShields)
  })

  it('el humo enseña a las tuyas a medias y esconde a las del rival del todo', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 26 })
    const mine = spawnUnit(battle, 0, vaquero, { x: 0, z: 4 }, 'excelente')
    const theirs = spawnUnit(battle, 1, vaquero, { x: 0, z: 4 }, 'excelente')
    // Sin humo, todos se ven enteros desde cualquier lado.
    expect(smokeVisibility(battle, mine, 0)).toBe('claro')
    expect(smokeVisibility(battle, mine, 1)).toBe('claro')
    // Tu humo: a los tuyos los ves a medias, el rival no ve nada.
    battle.smokes.push({ id: 1, side: 0, x: 0, z: 4, radius: SMOKE_R, until: SMOKE_S })
    expect(smokeVisibility(battle, mine, 0)).toBe('fantasma')
    expect(smokeVisibility(battle, mine, 1)).toBe('oculto')
    // El suyo tapado por SU humo: tu no lo ves y el si lo ve a medias.
    battle.smokes.push({ id: 2, side: 1, x: 0, z: 4, radius: SMOKE_R, until: SMOKE_S })
    expect(smokeVisibility(battle, theirs, 0)).toBe('oculto')
    expect(smokeVisibility(battle, theirs, 1)).toBe('fantasma')
    // Se acaba el humo y vuelve a verse todo.
    battle.time = SMOKE_S + 1
    expect(smokeVisibility(battle, mine, 1)).toBe('claro')
    expect(smokeVisibility(battle, theirs, 0)).toBe('claro')
  })

  it('el bot no dispara a las tropas que van tapadas por el humo', () => {
    const hidden = createBattle({ decks: [deck, deck], seed: 25 })
    // Ya con el reloj avanzado: al bot le toca disparar.
    hidden.time = 10
    hidden.smokes.push({ id: 1, side: 0, x: 0, z: -2, radius: SMOKE_R, until: hidden.time + SMOKE_S })
    spawnUnit(hidden, 0, vaquero, { x: 0, z: -2 }, 'excelente')
    for (let i = 0; i < 30; i++) stepBot(hidden, createBot(1))
    expect(hidden.bullets).toHaveLength(0)

    // Sin la nube, ese mismo disparo sí sale: la prueba tiene sentido.
    const clear = createBattle({ decks: [deck, deck], seed: 25 })
    clear.time = 10
    spawnUnit(clear, 0, vaquero, { x: 0, z: -2 }, 'excelente')
    for (let i = 0; i < 30; i++) stepBot(clear, createBot(1))
    expect(clear.bullets.length).toBeGreaterThan(0)
  })

  it('la tormenta deja al bando rival clavado y sin disparar, y no le quita vida', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 22 })
    const foe = spawnUnit(battle, 1, vaquero, { x: 0, z: 6 }, 'excelente')
    battle.stunUntil[1] = ZAP_S
    const before = foe.z
    run(battle, 4)
    expect(isStunned(battle, 1)).toBe(true)
    expect(foe.state).toBe('aturdido')
    expect(foe.z).toBe(before)
    // Ni un escudo menos: el rayo solo deja tonto.
    expect(foe.shields).toBe(foe.maxShields)
    // Se le pasa el chispazo y sigue andando.
    run(battle, 6)
    expect(isStunned(battle, 1)).toBe(false)
    expect(foe.z).not.toBe(before)
  })

  it('el tunel se traga a tus tropas y las saca por la otra boca', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 23 })
    battle.tunnels.push({ id: 1, side: 0, entry: { x: 0, z: 8 }, exit: { x: 0, z: -6 }, until: 60 })
    const unit = spawnUnit(battle, 0, vaquero, { x: 0, z: 8.5 }, 'excelente')
    // Las del rival pisan la otra boca y no les hace nada: el tunel es tuyo.
    const foe = spawnUnit(battle, 1, vaquero, { x: 0, z: -6 }, 'excelente')
    run(battle, 1)
    // La tuya ha cruzado el campo de golpe; la suya sigue donde estaba.
    expect(unit.z).toBeLessThan(0)
    expect(foe.z).toBeLessThan(0)
  })

  it('el tunel cae donde lo sueltas, saca la otra boca enfrente y se gasta de una vez', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 24 })
    const tunel = BUILTIN_WEAPONS.find((weapon) => weapon.id === 'tunel')!
    battle.hands[0].weapon.cardId = tunel.id
    battle.hands[0].weapon.uses = 1
    battle.cards.set(tunel.id, tunel)
    // Lo sueltas en tu campo y las dos bocas salen solas: una donde lo pones y la otra enfrente.
    expect(useSpecial(battle, 0, { x: 0, z: 6 })).toBe(true)
    expect(battle.tunnels).toHaveLength(1)
    const tunnel = battle.tunnels[0]!
    expect(tunnel.entry).toEqual({ x: 0, z: 6 })
    expect(tunnel.exit.z).toBeCloseTo(6 - TUNNEL_LEN, 5)
    expect(tunnel.exit.z).toBeLessThan(-DEPLOY_FRONT)
    // Se gasta de una vez: el arma se va a cambiar.
    expect(weaponCard(battle, 0)).toBeNull()
  })

  it('el tunel mide siempre lo mismo, lo sueltes donde lo sueltes', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 27 })
    const tunel = BUILTIN_WEAPONS.find((weapon) => weapon.id === 'tunel')!
    battle.hands[0].weapon.cardId = tunel.id
    battle.hands[0].weapon.uses = 9
    battle.cards.set(tunel.id, tunel)
    // Pegado a tu raya, en mitad y pegado a tu casa: siempre una boca en cada campo y a la
    // misma distancia la una de la otra.
    for (const z of [DEPLOY_FRONT, 6, DEPLOY_BACK]) {
      battle.tunnels = []
      expect(useSpecial(battle, 0, { x: 0, z }), `z=${z}`).toBe(true)
      const tunnel = battle.tunnels[0]!
      expect(tunnel.entry.z - tunnel.exit.z, `z=${z}`).toBeCloseTo(TUNNEL_LEN, 5)
      expect(tunnel.entry.z).toBeGreaterThanOrEqual(DEPLOY_FRONT - 0.001)
      expect(tunnel.exit.z).toBeLessThanOrEqual(-DEPLOY_FRONT + 0.001)
      expect(tunnel.exit.z).toBeGreaterThanOrEqual(-DEPLOY_BACK - 0.001)
    }
  })

  it('el tunel se cierra a los 10 s y si nadie lo cruza se pierde', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 28 })
    battle.tunnels.push({ id: 1, side: 0, entry: { x: 0, z: 8 }, exit: { x: 0, z: 8 - TUNNEL_LEN }, until: TUNNEL_S })
    run(battle, TUNNEL_S - 0.5)
    expect(battle.tunnels).toHaveLength(1)
    run(battle, 1)
    expect(battle.tunnels).toHaveLength(0)
  })

  it('el reroll cambia el arma al azar y tarda 30 s en recargarse', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 29 })
    const before = weaponCard(battle, 0)!.id
    expect(rerollWeapon(battle, 0)).toBe(true)
    const after = weaponCard(battle, 0)
    expect(after).not.toBeNull()
    expect(after!.id).not.toBe(before)
    // El arma nueva llega entera y el boton se queda recargando.
    expect(battle.hands[0].weapon.uses).toBe(usesOf(after))
    expect(rerollWeapon(battle, 0)).toBe(false)
    run(battle, REROLL_S - 0.2)
    expect(rerollWeapon(battle, 0)).toBe(false)
    run(battle, 0.5)
    expect(rerollWeapon(battle, 0)).toBe(true)
  })

  it('si el trazo no cruza tu linea de fuego no hay disparo', () => {
    expect(
      weaponShotFromStroke(0, [
        { x: 0, z: FIRE_LINE + 3 },
        { x: 1, z: FIRE_LINE + 1 },
      ]),
    ).toBeNull()
  })

  it('si sacas el arma ya por delante de la raya, dispara desde la raya a esa altura', () => {
    const shot = weaponShotFromStroke(0, [
      { x: -3.2, z: FIRE_LINE - 1.5 },
      { x: -3.2, z: FIRE_LINE - 5 },
      { x: -4.6, z: FIRE_LINE - 7 },
    ])
    expect(shot).not.toBeNull()
    // La boca no entra en el campo rival: se queda en la raya, en la vertical del dedo.
    expect(shot!.position).toBeCloseTo(-4.6, 5)
  })

  it('si sacas el arma por delante pero casi no mueves el dedo, no hay disparo', () => {
    expect(
      weaponShotFromStroke(0, [
        { x: 1, z: FIRE_LINE - 2 },
        { x: 1.1, z: FIRE_LINE - 2.2 },
      ]),
    ).toBeNull()
  })

  it('el arma se desliza por tu linea de fuego y apunta con la rotacion', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 11 })
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.hands[0].weapon.cardId = rifle.id
    battle.cards.set(rifle.id, rifle)
    // Posicion empujada fuera de la linea: se queda pegada al borde, no cruza la raya.
    fireWeapon(battle, 0, 99, Math.PI / 2)
    const bolt = battle.bullets[0]!
    expect(bolt.z).toBeCloseTo(FIRE_LINE, 5)
    expect(Math.abs(bolt.x)).toBeLessThanOrEqual(6.4)
    // Rotacion 90°: sale de lado, no hacia el fuerte.
    expect(Math.abs(bolt.dx)).toBeGreaterThan(0.99)
    expect(Math.abs(bolt.dz)).toBeLessThan(0.01)
  })

  it('la vagoneta aparece en el centro tras el aviso inicial y tiene mucha vida', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 13 })
    // Sale al azar, pero siempre dentro de su margen (rara: no antes de 75 s ni despues de 130 s).
    expect(battle.nextCartAt).toBeGreaterThanOrEqual(CART_FIRST_S)
    expect(battle.nextCartAt).toBeLessThanOrEqual(CART_FIRST_MAX_S)
    run(battle, battle.nextCartAt - 0.2)
    expect(battle.cart).toBeNull()
    run(battle, 0.4)
    expect(battle.cart).toMatchObject({ x: 0, z: 0, hp: CART_HP, maxHp: CART_HP })
    expect(battle.events.some((event) => event.type === 'cartSpawn')).toBe(true)
  })

  it('la vagoneta lleva escudo los primeros segundos: los tiros rebotan y no le hacen nada', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 17 })
    run(battle, battle.nextCartAt + 0.4)
    expect(battle.cart).not.toBeNull()
    // Se pone a tiro del rifle (que dispara desde tu raya de fuego).
    battle.cart!.x = 0
    battle.cart!.z = FIRE_LINE - 15
    const hp = battle.cart!.hp
    battle.hands[0].weapon.cardId = 'rifle'
    battle.hands[0].weapon.uses = 2
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.cards.set(rifle.id, rifle)
    expect(fireWeapon(battle, 0, 0, 0)).toBe(true)
    run(battle, 1)
    expect(battle.cart!.hp).toBe(hp)
    expect(battle.events.some((event) => event.type === 'cartBlocked')).toBe(true)
    // Pasado el escudo, el mismo tiro si entra.
    run(battle, CART_GRACE_S)
    expect(fireWeapon(battle, 0, 0, 0)).toBe(true)
    run(battle, 1)
    expect(battle.cart!.hp).toBeLessThan(hp)
  })

  it('el ultimo golpe de la vagoneta da cinco cargas al bando que la reclama', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 14 })
    battle.cart = { x: 0, z: FIRE_LINE - 15, hp: 1, maxHp: CART_HP, shieldUntil: 0 }
    battle.hands[0].weapon.cardId = 'rifle'
    battle.hands[0].weapon.uses = 2
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.cards.set(rifle.id, rifle)
    fireWeapon(battle, 0, 0, 0)
    run(battle, 1)
    expect(battle.cart).toBeNull()
    expect(battle.dynamiteAmmo[0]).toBe(DYNAMITE_AMMO)
    expect(battle.hands[0].weapon.uses).toBe(1)
    expect(battle.events.some((event) => event.type === 'cartClaimed' && event.side === 0)).toBe(true)
  })

  it('la dinamita extra cae donde se suelta, espera la mecha y no gasta el arma equipada', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 15 })
    battle.dynamiteAmmo[0] = 1
    const uses = battle.hands[0].weapon.uses
    expect(fireBonusDynamite(battle, 0, 1.25, { x: 1.25, z: 2 })).toBe(true)
    expect(battle.dynamiteAmmo[0]).toBe(0)
    expect(battle.hands[0].weapon.uses).toBe(uses)
    const bomb = battle.bullets[0]!
    expect(bomb.weaponId).toBe('dinamita')
    expect(bomb.fuseMs).toBe(DYNAMITE_FUSE_MS)
    // Ya ha caido en su punto, pero la mecha sigue corriendo: todavia no estalla.
    run(battle, 2.2)
    expect(battle.events.some((event) => event.type === 'blast')).toBe(false)
    expect(bomb.fuseMs).toBeLessThan(DYNAMITE_FUSE_MS)
    // Al acabarse la mecha, revienta justo donde la soltaste.
    run(battle, 1.6)
    expect(battle.events.some((event) => event.type === 'blast' && event.x === 1.25 && event.z === 2)).toBe(true)
  })

  it('la resistencia alta frena el empuje y la baja provoca caída y desplazamiento', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 12 })
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.hands[0].weapon.cardId = rifle.id
    battle.cards.set(rifle.id, rifle)
    const heavy = spawnUnit(battle, 1, { ...vaquero, resistance: 100 }, { x: -1.5, z: 12 }, 'excelente')
    const light = spawnUnit(battle, 1, { ...vaquero, id: 'vaquero-light', resistance: 20 }, { x: 1.5, z: 12 }, 'excelente')
    fireWeapon(battle, 0, -1.5, 0)
    fireWeapon(battle, 0, 1.5, 0)
    run(battle, 0.7)
    expect(heavy.weaponHitCount).toBe(1)
    expect(heavy.fallDuration).toBe(0)
    expect(heavy.fallTime).toBe(0)
    expect(light.weaponHitCount).toBe(1)
    expect(light.fallDuration).toBeGreaterThan(0.5)
    expect(light.fallTime).toBeGreaterThan(0)
    expect(light.z).toBeLessThan(heavy.z)
    run(battle, 1.5)
    expect(light.fallTime).toBe(light.fallDuration)
    expect(light.state).not.toBe('muerto')
  })

  it('cada 30 s van mas rapido y desde el 1:30 corren', () => {
    expect(paceAt(10).gait).toBe('andar')
    expect(paceAt(35).mult).toBeGreaterThan(paceAt(10).mult)
    expect(paceAt(65).mult).toBeGreaterThan(paceAt(35).mult)
    expect(paceAt(89).gait).toBe('andar')
    expect(paceAt(90).gait).toBe('correr')
    expect(paceAt(125).mult).toBeGreaterThan(paceAt(95).mult)
  })

  it('una partida contra el bot termina', () => {
    const full = BUILTIN_CARDS
    const battle = createBattle({ decks: [full, full], seed: 9 })
    const bots = [createBot(0), createBot(1)]
    for (let t = 0; t < 400 && !battle.over; t += 1 / 30) {
      for (const bot of bots) stepBot(battle, bot)
      step(battle, 1 / 30)
    }
    expect(battle.over).not.toBeNull()
    expect(battle.time).toBeGreaterThan(60)
    // Cinco minutos como mucho.
    expect(battle.time).toBeLessThanOrEqual(TIEMPO_MAXIMO_S + 0.1)
  })

  it('las tropas van hacia el fuerte rival', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 10 })
    const unit = spawnUnit(battle, 1, vaquero, { x: 4, z: -FORT_Z + 3 }, 'bien')
    run(battle, 3)
    expect(unit.z).toBeGreaterThan(-FORT_Z + 3)
    expect(Math.abs(unit.x)).toBeLessThan(4)
  })

  it('la dinamita cae donde apuntas, aunque haya soldados cerca, y reventando alli', () => {
    const dinamita = BUILTIN_WEAPONS.find((w) => w.id === 'dinamita')!
    const battle = createBattle({ decks: [[vaquero, dinamita], [vaquero]], seed: 12 })
    battle.hands[0].weapon.cardId = dinamita.id
    battle.hands[0].weapon.uses = 2
    // Un rival muy cerca de tu raya: antes la carga volaba 15 m y no le daba.
    const enemigo = spawnUnit(battle, 1, vaquero, { x: 0, z: FIRE_LINE - 4 }, 'bien', true)
    const antes = enemigo.shields
    expect(fireWeapon(battle, 0, 0, 0, { x: 0, z: FIRE_LINE - 4 })).toBe(true)
    run(battle, 3)
    expect(enemigo.shields).toBeLessThan(antes)
  })

  it('una carga lanzada mas lejos que su alcance cae en el limite, en la misma direccion', () => {
    const at = lobLanding(0, 0, 10, { x: 0, z: FIRE_LINE - 40 })
    expect(Math.hypot(at.x, at.z - FIRE_LINE)).toBeCloseTo(10, 1)
    expect(at.x).toBeCloseTo(0, 3)
  })
})

describe('maximo de soldados, racha y tiroteo entre todos', () => {
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))
  const batalla = (seed: number) => createBattle({ decks: [deck, deck], seed })

  it('con el campo lleno no sale otra carta de batalla; en cuanto cae un soldado tuyo, si', () => {
    const battle = batalla(30)
    const mios = Array.from({ length: maxVivosEn(0) }, (_, i) => spawnUnit(battle, 0, vaquero, { x: i - 2, z: 12 }, 'bien', true))
    const cartaAntes = battle.hands[0].slots[0]!.cardId
    run(battle, 1)
    expect(playCard(battle, 0, 0, 0, 8, 1)).toBeNull()
    expect(battle.hands[0].slots[0]!.cardId).toBe(cartaAntes)
    mios[0]!.state = 'muerto'
    mios[0]!.shields = 0
    expect(playCard(battle, 0, 0, 0, 8, 1)).not.toBeNull()
  })

  it('el maximo de soldados sube cada minuto: 4, 5 y 6', () => {
    expect(maxVivosEn(0)).toBe(4)
    expect(maxVivosEn(61)).toBe(5)
    expect(maxVivosEn(121)).toBe(6)
    expect(maxVivosEn(290)).toBe(6)
  })

  it('hay una pausa corta entre dos cartas seguidas', () => {
    const battle = batalla(31)
    expect(playCard(battle, 0, 0, 0, 8, 1)).not.toBeNull()
    expect(playCard(battle, 0, 1, 2, 8, 1)).toBeNull()
    run(battle, 1)
    expect(playCard(battle, 0, 1, 2, 8, 1)).not.toBeNull()
  })

  it('tumbar a un soldado sube la racha del que lo tumba (hasta el tope) y acaba pasado un rato', () => {
    const battle = batalla(37)
    const victima = spawnUnit(battle, 1, vaquero, { x: 0, z: 8 }, 'bien', true)
    victima.shields = 1
    battle.hands[0].weapon.cardId = 'rifle'
    battle.hands[0].weapon.uses = 2
    const rifle = BUILTIN_WEAPONS.find((w) => w.id === 'rifle')!
    battle.cards.set(rifle.id, rifle)
    fireWeapon(battle, 0, 0, 0)
    run(battle, 2)
    expect(victima.state).toBe('muerto')
    expect(battle.kills[0]).toBe(1)
    expect(battle.racha[0]).toBeGreaterThan(0)
    expect(battle.racha[0]).toBeLessThanOrEqual(RACHA_MAX)
    expect(battle.events.some((event) => event.type === 'baja' && event.side === 0)).toBe(true)
    run(battle, 8)
    expect(battle.racha[0]).toBe(0)
  })

  it('el fuerte recibe mas daño cuanto mas dura la partida', () => {
    expect(furiaEn(0)).toBe(1)
    expect(furiaEn(TIEMPO_MAXIMO_S)).toBeGreaterThan(1.5)
  })

  it('cada muñeco tiene su tambor: dispara las balas que lleva y recarga a tiro', () => {
    const battle = batalla(38)
    const mine = sinHabilidad(spawnUnit(battle, 0, vaquero, { x: 0, z: 2 }, 'excelente'))
    const objetivo = spawnUnit(battle, 1, vaquero, { x: 0, z: -1.5 }, 'excelente', true)
    objetivo.shields = 999
    let recargo = false
    let tiros = 0
    for (let t = 0; t < 40; t += 1 / 30) {
      step(battle, 1 / 30)
      for (const event of drainEvents(battle)) {
        if (event.type === 'troopShot' && event.side === 0) tiros++
        if (event.type === 'reload' && event.unitId === mine.id) recargo = true
      }
      if (recargo) break
    }
    expect(recargo).toBe(true)
    expect(tiros).toBe(BALAS)
    expect(mine.reloadLeft).toBeGreaterThan(0)
    run(battle, RECARGA_S + 0.5)
    expect(mine.ammo).toBeGreaterThan(0)
  })

  it('al llegar a los 5 minutos la partida se acaba y gana quien tenga mas vida en su fuerte', () => {
    const battle = batalla(39)
    battle.forts[1].hp = battle.forts[1].maxHp * 0.5
    run(battle, TIEMPO_MAXIMO_S + 1)
    expect(battle.over).toEqual({ winner: 0, by: 'tiempo' })
  })

  it('la vagoneta es rara: como mucho dos por partida', () => {
    const battle = batalla(40)
    let vistas = 0
    let hay = false
    for (let t = 0; t < TIEMPO_MAXIMO_S; t += 1 / 20) {
      step(battle, 1 / 20)
      if (battle.cart && !hay) vistas++
      hay = Boolean(battle.cart)
      if (battle.cart) battle.cart = null
    }
    expect(vistas).toBeLessThanOrEqual(2)
  })

  it('en una partida entera de bots hay bajas y nunca pasan del maximo de soldados', () => {
    const battle = createBattle({ decks: [BUILTIN_CARDS, BUILTIN_CARDS], seed: 41 })
    const bots = [createBot(0), createBot(1)]
    let pasado = false
    for (let t = 0; t < TIEMPO_MAXIMO_S && !battle.over; t += 1 / 30) {
      for (const bot of bots) stepBot(battle, bot)
      step(battle, 1 / 30)
      for (const side of [0, 1] as const) {
        const vivos = battle.units.filter((u) => u.side === side && u.state !== 'muerto').length
        if (vivos > maxVivosEn(battle.time)) pasado = true
      }
    }
    expect(battle.kills[0] + battle.kills[1]).toBeGreaterThan(0)
    expect(pasado).toBe(false)
  })
})

describe('estilos de combate', () => {
  const por = (estilo: string) => BUILTIN_BATTLE.find((c) => c.estilo === estilo)!
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))
  const batalla = (seed: number) => createBattle({ decks: [deck, deck], seed })
  /** Un blanco clavado y duro del bando rival. */
  const blanco = (battle: Battle, x: number, z: number, escudos = 20) => {
    const unit = spawnUnit(battle, 1, vaquero, { x, z }, 'excelente', true)
    unit.shields = escudos
    unit.maxShields = escudos
    return unit
  }

  it('la minigun vacia el cargador sobre varios blancos y luego tarda en recargar', () => {
    const battle = batalla(60)
    const tirador = spawnUnit(battle, 0, por('minigun'), { x: 0, z: 2 }, 'excelente')
    const a = blanco(battle, -1, -2)
    const b = blanco(battle, 1, -2.2)
    run(battle, 8)
    expect(a.shields).toBeLessThan(20)
    expect(b.shields).toBeLessThan(20)
    expect(tirador.reloadLeft).toBeGreaterThan(5)
  })

  it('el rebote salta a un segundo enemigo', () => {
    const battle = batalla(61)
    spawnUnit(battle, 0, por('rebote'), { x: 0, z: 2 }, 'excelente')
    const a = blanco(battle, 0, -1)
    const b = blanco(battle, 1.5, -1.5)
    // (Es de área: dispara despacio, y entre medias suelta su habilidad.)
    run(battle, 7)
    expect(a.shields).toBeLessThan(20)
    expect(b.shields).toBeLessThan(20)
  })

  it('la dinamita da en area: tambien al que esta cerca del blanco', () => {
    const battle = batalla(62)
    spawnUnit(battle, 0, por('dinamitero'), { x: 0, z: 3 }, 'excelente')
    blanco(battle, 0, -1)
    const cerca = blanco(battle, 1.2, -1.4)
    run(battle, 5)
    expect(cerca.shields).toBeLessThan(20)
  })

  it('el cuerpo a cuerpo se lanza a por el enemigo cercano', () => {
    const battle = batalla(63)
    const matón = spawnUnit(battle, 0, por('matón'), { x: 0, z: 6 }, 'excelente')
    const objetivo = blanco(battle, 3, 0)
    run(battle, 14)
    expect(Math.hypot(matón.x - objetivo.x, matón.z - objetivo.z)).toBeLessThan(2.5)
    expect(objetivo.shields).toBeLessThan(20)
  })

  it('el medico cura a los suyos y no se pelea con los soldados', () => {
    const battle = batalla(64)
    const medico = spawnUnit(battle, 0, por('medico'), { x: 0, z: 10 }, 'excelente', false)
    const amigo = spawnUnit(battle, 0, vaquero, { x: 1, z: 10 }, 'excelente', true)
    amigo.shields = 1
    blanco(battle, 0, 9)
    run(battle, 4)
    expect(amigo.shields).toBeGreaterThan(1)
    expect(medico.duelWith).toBeNull()
  })

  it('el molotov deja un campo de fuego que quema a quien lo pisa', () => {
    const battle = batalla(65)
    sinHabilidad(spawnUnit(battle, 0, por('fuego'), { x: 0, z: 3 }, 'excelente'))
    const victima = blanco(battle, 0, -1)
    run(battle, 4)
    expect(battle.campos.length).toBeGreaterThan(0)
    expect(victima.shields).toBeLessThan(20)
  })

  it('el sigilo esconde al soldado hasta que dispara', () => {
    const battle = batalla(66)
    const ladrona = spawnUnit(battle, 0, por('sigilo'), { x: 0, z: 10 }, 'excelente', true)
    expect(hiddenBySmoke(battle, ladrona)).toBe(true)
    ladrona.lastShotAt = battle.time
    expect(hiddenBySmoke(battle, ladrona)).toBe(false)
  })

  it('el kamikaze explota al llegar: cae el y dañan los de alrededor, sin darle racha al rival', () => {
    const battle = batalla(67)
    const bomba = spawnUnit(battle, 0, por('kamikaze'), { x: 0, z: 3 }, 'excelente')
    const a = blanco(battle, 0, 0, 6)
    run(battle, 5)
    expect(bomba.state).toBe('muerto')
    expect(a.shields).toBeLessThan(6)
    expect(battle.racha[1]).toBe(0)
  })

  it('el cebo atrae los disparos de los rivales cercanos', () => {
    const battle = batalla(68)
    const cebo = spawnUnit(battle, 0, por('tanque'), { x: 0, z: 2 }, 'excelente', true)
    const otro = spawnUnit(battle, 0, vaquero, { x: 0.5, z: 1.4 }, 'excelente', true)
    cebo.shields = 30
    otro.shields = 30
    const tirador = sinHabilidad(spawnUnit(battle, 1, vaquero, { x: 0, z: -1.5 }, 'excelente'))
    run(battle, 5)
    expect(tirador.duelWith).toBe(cebo.id)
    expect(otro.shields).toBe(30)
  })
})

describe('torres', () => {
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))

  it('una carta sacada como torre no se mueve, tiene mas escudos y mas alcance', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 70 })
    const torre = playCard(battle, 0, 0, 0, 10, 1, true)!
    const normal = spawnUnit(battle, 0, vaquero, { x: 3, z: 10 }, 'excelente')
    expect(torre.torre).toBe(true)
    expect(torre.maxShields).toBeGreaterThan(torre.baseShields)
    expect(alcanceDe(torre)).toBeGreaterThan(torre.card.range)
    run(battle, 4)
    expect(torre.z).toBeCloseTo(10, 1)
    expect(normal.z).toBeLessThan(9)
  })

  it('con doble toque vuelve a ser soldado, avanza y ya no puede ser torre otra vez', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 71 })
    const torre = playCard(battle, 0, 0, 0, 10, 1, true)!
    expect(soltarTorre(battle, torre.id)).toBe(true)
    expect(torre.torre).toBe(false)
    expect(torre.torreUsada).toBe(true)
    expect(torre.shields).toBeLessThanOrEqual(torre.baseShields)
    expect(soltarTorre(battle, torre.id)).toBe(false)
    run(battle, 3)
    expect(torre.z).toBeLessThan(9.5)
  })

  it('el guardian (torre de cuerpo a cuerpo) golpea a los que pasan a su lado y los frena', () => {
    // (Uno de cuerpo a cuerpo que no sea tanque: la torre del tanque no pega, solo frena.)
    const melee = BUILTIN_BATTLE.find((c) => c.estilo === 'furia')!
    const battle = createBattle({ decks: [[melee, ...deck], deck], seed: 72 })
    const g = spawnUnit(battle, 0, melee, { x: 0, z: 4 }, 'excelente', false)
    hacerTorre(battle, g)
    const rival = spawnUnit(battle, 1, vaquero, { x: 2, z: 4 }, 'excelente', true)
    rival.shields = 30
    run(battle, 3)
    expect(rival.shields).toBeLessThan(30)
    expect(rival.slowUntil).toBeGreaterThan(0)
  })
})

describe('habilidades', () => {
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))

  /**
   * Cada estilo, con su habilidad: delante tiene un grupo de enemigos duros y quietos y detras unos
   * compañeros heridos. La habilidad tiene que saltar sola y notarse: quitar escudos, frenar,
   * atrapar, aturdir, curar, mover a alguien o poner algo en el campo.
   */
  for (const estilo of ESTILO_LISTA) {
    it(`${estilo.id}: suelta su habilidad al ver al enemigo y se nota`, () => {
      const carta = BUILTIN_BATTLE.find((c) => c.estilo === estilo.id)
      if (!carta) return
      const battle = createBattle({ decks: [deck, deck], seed: 90 })
      const yo = spawnUnit(battle, 0, carta, { x: 0, z: 2 }, 'excelente')
      const amigo = spawnUnit(battle, 0, vaquero, { x: 1, z: 3 }, 'excelente', true)
      amigo.shields = amigo.maxShields - 1
      const enemigos = [-1.2, 0, 1.2].map((x) => {
        const u = spawnUnit(battle, 1, vaquero, { x, z: -1 }, 'excelente', true)
        u.shields = 30
        u.maxShields = 30
        return u
      })
      const antes = enemigos.map((u) => ({ x: u.x, z: u.z }))
      const amigoAntes = { x: amigo.x, z: amigo.z, s: amigo.shields }
      let solto = false
      let efectos = 0
      for (let t = 0; t < 6; t += 1 / 30) {
        step(battle, 1 / 30)
        efectos = Math.max(efectos, battle.efectos.length)
        for (const event of drainEvents(battle)) if (event.type === 'habilidad' && event.unitId === yo.id) solto = true
      }
      expect(solto).toBe(true)
      expect(efectos).toBeGreaterThan(0)
      const t = battle.time
      const seNota =
        enemigos.some((u, i) => u.shields < 30 || u.slowUntil > t || u.hab.redHasta > 0 || u.hab.suenoHasta > 0 || u.hab.cegadoHasta > 0 || u.hab.quemaHasta > 0 || Math.hypot(u.x - antes[i]!.x, u.z - antes[i]!.z) > 0.3) ||
        amigo.shields > amigoAntes.s ||
        amigo.hab.burbuja > 0 ||
        Math.hypot(amigo.x - amigoAntes.x, amigo.z - amigoAntes.z) > 1 ||
        battle.efectos.some((e) => e.k === 'zona' && (e.estilo === 'estandarte' || e.estilo === 'ronda'))
      expect(seNota).toBe(true)
    })
  }

  it('en cada clase, cada carta tiene una mecánica de habilidad distinta', () => {
    for (const clase of ['vaqueros', 'indios', 'vikingos']) {
      const mecanicas = BUILTIN_BATTLE.filter((c) => (c.clase ?? 'vaqueros') === clase).map((c) => habilidadDe(estiloDe(c)).mecanica)
      expect(new Set(mecanicas).size).toBe(mecanicas.length)
    }
  })

  it('cada estilo vaquero tiene una habilidad distinta (nombre propio)', () => {
    const nombres = BUILTIN_BATTLE.filter((c) => !c.clase || c.clase === 'vaqueros').map((c) => habilidadDe(estiloDe(c)).nombre)
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('la cupula se come los golpes', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 91 })
    const u = spawnUnit(battle, 0, vaquero, { x: 0, z: 5 }, 'excelente', true)
    u.hab.burbuja = 2
    u.hab.burbujaHasta = 99
    const antes = u.shields
    hurtUnit(battle, u, 1, false)
    hurtUnit(battle, u, 1, false)
    expect(u.shields).toBe(antes)
    hurtUnit(battle, u, 1, false)
    expect(u.shields).toBe(antes - 1)
  })

  it('la red deja al enemigo sin andar ni disparar', () => {
    const battle = createBattle({ decks: [deck, deck], seed: 92 })
    const u = spawnUnit(battle, 1, vaquero, { x: 0, z: -5 }, 'excelente')
    u.hab.redHasta = 3
    const z = u.z
    run(battle, 2)
    expect(u.z).toBeCloseTo(z, 3)
    expect(u.shotCount).toBe(0)
  })
})

describe('defensas de torre', () => {
  const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))
  const vaqueros = BUILTIN_BATTLE.filter((c) => (c.clase ?? 'vaqueros') === 'vaqueros')

  it('las 30 defensas son distintas entre si y distintas del ataque de su carta', () => {
    const defensas = vaqueros.map((c) => habilidadDe(estiloDe(c)).torre!)
    expect(new Set(defensas.map((d) => d.nombre)).size).toBe(30)
    for (const c of vaqueros) {
      const h = habilidadDe(estiloDe(c))
      expect(h.torre!.nombre).not.toBe(h.nombre)
    }
  })

  it('el rango de defensa depende de la carta', () => {
    const rangos = new Set(vaqueros.map((c) => rangoDeTorre(c)))
    expect(rangos.size).toBeGreaterThan(6)
    expect(Math.min(...rangos)).toBeLessThan(4)
    expect(Math.max(...rangos)).toBeGreaterThanOrEqual(10)
  })

  for (const carta of vaqueros) {
    it(`${carta.name}: de torre suelta su defensa y se nota`, () => {
      const battle = createBattle({ decks: [deck, deck], seed: 95 })
      const torre = spawnUnit(battle, 0, carta, { x: 0, z: 6 }, 'excelente')
      hacerTorre(battle, torre)
      const rango = rangoDeTorre(carta)
      const amigo = spawnUnit(battle, 0, vaquero, { x: 0.8, z: 6.5 }, 'excelente', true)
      amigo.shields = amigo.maxShields - 1
      // Enemigos repartidos dentro de su rango (los mas lejos, a 3/4 del rango).
      const enemigos = [-0.6, 0, 0.6].map((dx, i) => {
        const d = Math.max(1.2, rango * (0.45 + i * 0.15))
        const u = spawnUnit(battle, 1, vaquero, { x: dx * 2, z: 6 - d }, 'excelente', true)
        u.shields = 30
        u.maxShields = 30
        return u
      })
      const antes = enemigos.map((u) => ({ x: u.x, z: u.z }))
      let solto = false
      for (let t = 0; t < 6; t += 1 / 30) {
        step(battle, 1 / 30)
        for (const event of drainEvents(battle)) if (event.type === 'habilidad' && event.unitId === torre.id) solto = true
      }
      // Las torres de tanque y de control no sueltan habilidad: frenan (y aturden, congelan o
      // empujan) a los que entran en su zona.
      if (torreSinDano(selloDe(carta))) {
        expect(torre.z).toBeCloseTo(6, 1)
        expect(enemigos.some((u) => u.slowUntil > battle.time - 0.5)).toBe(true)
        expect(enemigos.every((u) => u.shields === 30)).toBe(true)
        return
      }
      expect(solto).toBe(true)
      expect(torre.z).toBeCloseTo(6, 1)
      const t = battle.time
      const seNota =
        enemigos.some((u, i) => u.shields < 30 || u.slowUntil > t || u.hab.redHasta > 0 || u.hab.suenoHasta > 0 || u.hab.cegadoHasta > 0 || u.hab.quemaHasta > 0 || u.hab.cartelHasta > 0 || Math.hypot(u.x - antes[i]!.x, u.z - antes[i]!.z) > 0.3) ||
        amigo.shields > amigo.maxShields - 1 ||
        amigo.hab.burbuja > 0 ||
        torre.hab.burbuja > 0 ||
        battle.smokes.length > 0 ||
        battle.efectos.some((e) => e.k === 'zona' && e.estilo === 'red')
      expect(seNota).toBe(true)
    })
  }
})

describe('torre con tiempo', () => {
  it('al acabarse su tiempo, la torre vuelve a ser soldado y avanza', () => {
    const deck = onlyDeck([vaquero, sheriff], BUILTIN_WEAPONS.slice(0, 2))
    const battle = createBattle({ decks: [deck, deck], seed: 99 })
    const torre = playCard(battle, 0, 0, 0, 12, 1, true)!
    expect(torre.torre).toBe(true)
    run(battle, TORRE_S - 1)
    expect(torre.torre).toBe(true)
    run(battle, 3)
    expect(torre.torre).toBe(false)
    expect(torre.torreUsada).toBe(true)
    const z = torre.z
    run(battle, 2)
    expect(torre.z).toBeLessThan(z)
  })
})
