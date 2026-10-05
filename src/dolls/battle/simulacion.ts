import type { CardDef } from '../cards/model'
import { createBot, stepBot } from './bot'
import type { Bot } from './bot'
import type { Clima } from './clima'
import { createBattle, fireBonusDynamite, fireWeapon, playCard, rerollWeapon, soltarTorre, step, useSpecial } from './engine'
import type { Battle, Side, Vec } from './engine'

/**
 * **La partida contra el bot, grabada para poder repetirla.**
 *
 * La partida avanza siempre a pasos fijos de 1/60 s (da igual lo rápido que vaya el móvil), el bot
 * piensa en cada paso, y cada cosa que haces se apunta con **el paso en el que la hiciste**. Con la
 * semilla del azar, los mazos y esa lista de jugadas, la partida sale **idéntica** cada vez que se
 * repite: así el servidor la vuelve a jugar entera y comprueba quién ganó de verdad, sin que tú
 * notes nada (tú juegas en tu móvil, al momento, como siempre).
 */

/** Lo que dura un paso de la partida, en segundos. */
export const PASO = 1 / 60
/** Lo más que puede durar una partida (5 min de reloj y un margen), en pasos. */
export const MAX_PASOS = Math.ceil((5 * 60 + 30) / PASO)

/** Lo que puede hacer un jugador en la partida (en las coordenadas de su bando). */
export type Jugada =
  | { a: 'carta'; slot: number; x: number; z: number; precision: number; torre: boolean }
  | { a: 'disparo'; posicion: number; destino?: Vec }
  | { a: 'especial'; destino: Vec }
  | { a: 'dinamita'; origen: number; destino: Vec }
  | { a: 'soltarTorre'; unitId: number }
  | { a: 'reroll' }

/** Una jugada apuntada: el paso en el que se hizo (`p`) y cuál fue (`j`). */
export interface JugadaGrabada {
  p: number
  j: Jugada
}

/** Hace una jugada en la partida. Devuelve si ha salido (una carta puede no poder salir, por ejemplo). */
export function aplicarJugada(battle: Battle, side: Side, j: Jugada): boolean {
  switch (j.a) {
    case 'carta':
      return Boolean(playCard(battle, side, j.slot, j.x, j.z, j.precision, j.torre))
    case 'disparo':
      return fireWeapon(battle, side, j.posicion, 0, j.destino)
    case 'especial':
      return useSpecial(battle, side, j.destino)
    case 'dinamita':
      return fireBonusDynamite(battle, side, j.origen, j.destino)
    case 'soltarTorre': {
      const unit = battle.units.find((u) => u.id === j.unitId)
      return Boolean(unit && unit.side === side) && soltarTorre(battle, j.unitId)
    }
    case 'reroll':
      return rerollWeapon(battle, side)
    default:
      return false
  }
}

/** Todo lo que hace falta para montar la partida (y para volver a montarla igual en el servidor). */
export interface Preparativos {
  /** Tu mazo (bando de abajo) y el del bot. */
  mazos: [CardDef[], CardDef[]]
  extras?: { alcanceArma?: number; vida?: number }
  semilla: number
  clima: Clima
}

/** Lo que se cuenta al acabar (para los retos de las incursiones y los premios). */
export interface Resumen {
  ganada: boolean
  segundos: number
  /** Tropas rivales tumbadas. */
  bajas: number
  /** Tropas tuyas perdidas. */
  perdidas: number
  /** Tu fuerte al acabar, en %. */
  fuerte: number
}

export class Simulacion {
  readonly battle: Battle
  readonly bot: Bot
  /** Los pasos que lleva la partida. */
  pasos = 0
  readonly jugadas: JugadaGrabada[] = []
  /** Lo que sobra de tiempo para el siguiente paso (los pasos son fijos). */
  private resto = 0

  constructor(prep: Preparativos) {
    this.battle = createBattle({ decks: prep.mazos, extras: prep.extras, seed: prep.semilla })
    this.battle.clima = prep.clima
    this.bot = createBot(1)
  }

  /** Un paso de la partida: piensa el bot (si no está callado) y se mueve todo 1/60 s. */
  paso(conBot = true): void {
    if (this.battle.over) return
    if (conBot) stepBot(this.battle, this.bot)
    step(this.battle, PASO)
    this.pasos++
  }

  /**
   * Avanza el tiempo que ha pasado (a pasos enteros: lo que sobra, para la vez siguiente). El bot
   * solo se calla en el tutorial (esas partidas no se repiten en el servidor).
   */
  avanzar(dt: number, conBot = true): void {
    this.resto += Math.min(0.25, Math.max(0, dt))
    while (this.resto >= PASO && !this.battle.over) {
      this.resto -= PASO
      this.paso(conBot)
    }
  }

  /** Haces una jugada: se aplica ya y se apunta con su paso. */
  jugar(j: Jugada): boolean {
    if (this.battle.over) return false
    this.jugadas.push({ p: this.pasos, j })
    return aplicarJugada(this.battle, 0, j)
  }

  resumen(): Resumen {
    const b = this.battle
    return {
      ganada: b.over?.winner === 0,
      segundos: b.time,
      bajas: b.muertes[1],
      perdidas: b.muertes[0],
      fuerte: (b.forts[0].hp / Math.max(1, b.forts[0].maxHp)) * 100,
    }
  }
}

/**
 * Vuelve a jugar una partida con sus jugadas apuntadas, de un tirón. Para el servidor (que la juega
 * a trozos) está `Repeticion`.
 */
export function repetir(prep: Preparativos, jugadas: readonly JugadaGrabada[]): Simulacion {
  const r = new Repeticion(prep, jugadas)
  while (!r.acabada()) r.seguir(MAX_PASOS)
  return r.sim
}

/**
 * **Una partida que se repite a trozos** (el servidor gratis solo deja unos milisegundos de cálculo
 * cada vez): `seguir(n)` juega hasta `n` pasos más y se queda donde iba.
 */
export class Repeticion {
  readonly sim: Simulacion
  private readonly jugadas: readonly JugadaGrabada[]
  private siguiente = 0

  constructor(prep: Preparativos, jugadas: readonly JugadaGrabada[]) {
    this.sim = new Simulacion(prep)
    // Por si llegan desordenadas: en el orden en que se hicieron.
    this.jugadas = [...jugadas].sort((a, b) => a.p - b.p)
  }

  acabada(): boolean {
    return Boolean(this.sim.battle.over) || this.sim.pasos >= MAX_PASOS
  }

  seguir(cuantos: number): void {
    const sim = this.sim
    for (let i = 0; i < cuantos && !this.acabada(); i++) {
      // Las jugadas que se hicieron justo antes de este paso.
      while (this.siguiente < this.jugadas.length && this.jugadas[this.siguiente]!.p <= sim.pasos) {
        const { j } = this.jugadas[this.siguiente]!
        this.siguiente++
        sim.jugadas.push({ p: sim.pasos, j })
        try {
          aplicarJugada(sim.battle, 0, j)
        } catch {
          // Una jugada imposible (que en el móvil no se puede hacer) no hace nada.
        }
      }
      sim.paso()
      // Nadie recoge los avisos de la partida: se tiran para no llenar la memoria.
      sim.battle.events.length = 0
    }
  }
}
