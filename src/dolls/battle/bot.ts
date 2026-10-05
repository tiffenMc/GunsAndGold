import * as M from './mates'
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
import { selloDe } from './sellos'
import type { Sello } from './sellos'

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
      // **Juega con los sellos**: monta un equipo (tanque delante, curas y tiradores detrás) y
      // contesta a lo que ve (a sus tanques, asesinos o área; a sus asesinos, control).
      const sellos = posibles.map((i) => {
        const c = slotCard(battle, bot.side, i)
        return c ? selloDe(c) : 'asalto'
      })
      const mios = battle.units.filter((u) => u.side === bot.side && u.state !== 'muerto')
      const suyos = battle.units.filter((u) => u.side !== bot.side && u.state !== 'muerto')
      const hay = (lista: Unit[], s: Sello) => lista.some((u) => u.sello === s)
      const peso = (s: Sello): number => {
        let p = 1
        if (s === 'tanque' && !hay(mios, 'tanque')) p += 3
        if (s === 'apoyo') p += hay(mios, 'tanque') ? 2 : -0.6
        if ((s === 'asesino' || s === 'area') && hay(suyos, 'tanque')) p += 3
        if (s === 'control' && hay(suyos, 'asesino')) p += 3
        if (s === 'distancia' && hay(suyos, 'area')) p += 3
        if (s === 'area' && suyos.length >= 3) p += 2
        return Math.max(0.2, p)
      }
      const pesos = sellos.map(peso)
      let tirada = rand() * pesos.reduce((a, b) => a + b, 0)
      let elegido = 0
      for (let i = 0; i < pesos.length; i++) {
        tirada -= pesos[i]!
        if (tirada <= 0) {
          elegido = i
          break
        }
      }
      const slot = posibles[elegido]!
      const sello = sellos[elegido]!
      // Sale en su mitad: el tanque y el asesino delante; los frágiles (distancia, área, apoyo), detrás.
      const lado = bot.side === 1 ? -1 : 1
      const delante = sello === 'tanque' || sello === 'asesino'
      const detras = sello === 'distancia' || sello === 'apoyo' || sello === 'area'
      // Los de detrás van por el carril de su tanque (si tiene), para que los cubra.
      const tanque = mios.find((u) => u.sello === 'tanque')
      const x = detras && tanque ? tanque.x + (rand() - 0.5) * 2 : (rand() - 0.5) * 9
      const z = lado * (delante ? 3 + rand() * 5 : detras ? 10 + rand() * 7 : 4 + rand() * 14)
      // Casi siempre "medio" o "bien"; alguna vez perfecto.
      const accuracy = 0.4 + rand() * 0.45
      // De torre, cerca de casa: los tanques, los controles, los de distancia y los de apoyo, a menudo.
      const defensiva = sello === 'tanque' || sello === 'control' || sello === 'distancia' || sello === 'apoyo'
      const torresYa = mios.filter((u) => u.torre).length
      const torre = torresYa < 2 && rand() < (defensiva ? 0.3 : 0.05)
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
    M.hypot(target.x - position.x, target.z - position.z) / Math.max(1, weapon.shot.speed)
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
