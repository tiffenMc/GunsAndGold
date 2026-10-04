import {
  FORT_Z,
  WALK_SPEED,
  angleTo,
  clampFireLine,
  fireBonusDynamite,
  fireWeapon,
  hiddenBySmoke,
  other,
  paceAt,
  playCard,
  slotCard,
  soltarTorre,
  puedeSacar,
  useSpecial,
  weaponCard,
} from './engine'
import type { Battle, Side, Unit } from './engine'
import { estiloDe } from './estilos'

/**
 * El rival de la maquina. Es flojo a proposito: tarda en reaccionar, dibuja regular y
 * apunta con error, para que se le pueda ganar.
 */

export interface Bot {
  side: Side
  nextPlayAt: number
  nextShotAt: number
}

export function createBot(side: Side = 1): Bot {
  return { side, nextPlayAt: 3.5, nextShotAt: 6 }
}

function forwardOf(side: Side): number {
  return side === 0 ? -1 : 1
}

/** Cuanto ha avanzado una tropa enemiga hacia el fuerte del bot (0 = recien salida). */
function threat(bot: Bot, unit: Unit): number {
  // Para el bot (arriba) las tropas rivales vienen hacia z negativo.
  return bot.side === 1 ? -unit.z : unit.z
}

export function stepBot(battle: Battle, bot: Bot): void {
  if (battle.over) return
  const rand = battle.rand
  const hand = battle.hands[bot.side]
  const pace = paceAt(battle.time)

  // --- Sacar cartas: con las mismas reglas que tu (maximo de vivos y pausa) ---
  if (battle.time >= bot.nextPlayAt) {
    const posibles = hand.slots
      .map((slot, index) => (slot.cardId && puedeSacar(battle, bot.side, index).ok ? index : -1))
      .filter((index) => index >= 0)
    if (posibles.length > 0) {
      const slot = posibles[Math.floor(rand() * posibles.length)]!
      // Sale en su mitad: lejos de su casa (hacia el frente) o cerca, a ratos.
      const lado = bot.side === 1 ? -1 : 1
      const x = (rand() - 0.5) * 9
      const z = lado * (4 + rand() * 14)
      // Casi siempre "medio" o "bien"; alguna vez perfecto.
      const accuracy = 0.4 + rand() * 0.45
      // Algunas cartas las pone de torre, cerca de casa: las de apoyo y las duras, a menudo.
      const carta = slotCard(battle, bot.side, slot)
      const est = carta ? estiloDe(carta) : null
      const defensiva = Boolean(est && (est.pacifico || est.pulso || est.blindaje || est.provoca || est.area))
      const torresYa = battle.units.filter((u) => u.side === bot.side && u.torre && u.state !== 'muerto').length
      const torre = torresYa < 2 && rand() < (defensiva ? 0.35 : 0.06)
      const zTorre = (bot.side === 1 ? -1 : 1) * (12 + rand() * 6)
      playCard(battle, bot.side, slot, x, torre ? zTorre : z, accuracy, torre)
    }
    // Mira cada poco si puede sacar algo: el que frena es el maximo de vivos, no su reaccion.
    bot.nextPlayAt = battle.time + 1.2 + rand() * 1.6
  }

  // De vez en cuando suelta una torre para empujar (mas a menudo al final de la partida).
  if (battle.time > 45 && rand() < (battle.time > 150 ? 0.012 : 0.005)) {
    const torre = battle.units.find((u) => u.side === bot.side && u.torre && u.state !== 'muerto')
    if (torre) soltarTorre(battle, torre.id)
  }

  // --- Defender con el arma ---
  const weapon = weaponCard(battle, bot.side)
  if (!weapon || hand.weapon.uses <= 0 || battle.time < bot.nextShotAt) return
  // Las especiales: el bot las suelta en su sitio y a su manera.
  if (weapon.special) {
    const mine = bot.side === 1 ? -1 : 1
    if (weapon.special === 'tunel') {
      // En mitad de su campo, por donde suben sus tropas: asi el tunel les gana el viaje.
      useSpecial(battle, bot.side, { x: 0, z: mine * 10 })
    } else if (weapon.special === 'humo') {
      // Delante de su casa, que es por donde le entran las tropas.
      useSpecial(battle, bot.side, { x: 0, z: mine * (FORT_Z - 8) })
    } else {
      useSpecial(battle, bot.side, { x: 0, z: 0 })
    }
    bot.nextShotAt = battle.time + 2.5 + rand() * 2
    return
  }

  const foes = battle.units.filter(
    (unit) =>
      unit.side === other(bot.side) &&
      unit.state !== 'muerto' &&
      threat(bot, unit) > -1 &&
      // Con su humo de por medio el bot no las ve: no las dispara ni sabe por donde andan.
      !hiddenBySmoke(battle, unit),
  )
  if (battle.cart && battle.dynamiteAmmo[bot.side] > 0 && rand() < 0.55) {
    fireBonusDynamite(battle, bot.side, 0, battle.cart)
    bot.nextShotAt = battle.time + 1.8 + rand() * 1.8
    return
  }
  if (battle.cart && rand() < 0.35) {
    const position = clampFireLine(bot.side, 0)
    fireWeapon(battle, bot.side, position.x, angleTo(bot.side, position, battle.cart))
    bot.nextShotAt = battle.time + 1.8 + rand() * 1.8
    return
  }
  if (foes.length === 0) {
    bot.nextShotAt = battle.time + 0.8
    return
  }
  foes.sort((a, b) => threat(bot, b) - threat(bot, a))
  const target = foes[0]!
  // Se desliza por su linea de fuego hasta ponerse a tiro y gira para apuntar.
  const position = clampFireLine(bot.side, target.x * 0.35)
  const travel =
    Math.hypot(target.x - position.x, target.z - position.z) / Math.max(1, weapon.shot.speed)
  const moving = target.state === 'andar' ? WALK_SPEED * target.card.speed * pace.mult : 0
  const lead = moving * travel
  // Hacia donde va la tropa (hacia el fuerte del bot).
  const fz = forwardOf(target.side)
  const aim = {
    x: target.x + (rand() - 0.5) * 1.6,
    z: target.z + fz * lead + (rand() - 0.5) * 1.2,
  }
  fireWeapon(battle, bot.side, position.x, angleTo(bot.side, position, aim))
  bot.nextShotAt = battle.time + 1.8 + rand() * 1.8
}
