import { cloneLook, isLook } from '../dollParams'
import { gameCards } from '../cards/store'
import type { ClaseId } from '../cards/model'
import type { Punto } from './animacionDibujada'
import {
  abrirSobre,
  addDeck,
  borrarAnimacion,
  cobrarObjetivo,
  comprar,
  createPlayer,
  deleteDeck,
  deletePlayer,
  getPlayer,
  guardarAnimacion,
  loTienes,
  ponerAnimacion,
  ponerPinta,
  players,
  saveDeckAt,
  setActiveDeck,
  updatePlayer,
} from './players'
import type { Deck, Player } from './players'
import type { PremioObjetivo } from './objetivos'
import { loQueFalta } from './tienda'

/**
 * **Lo que se puede hacer con tu personaje fuera de la partida**: comprar en la Sastrería, abrir
 * sobres, cobrar encargos, arreglar las barajas, crear o borrar personajes…
 *
 * Cada cosa es una **acción** con sus datos. Con servidor, la acción se manda y la hace **el
 * servidor** (con estas mismas reglas), así nadie se puede dar nada que no le toca; sin servidor
 * (`npm run dev`), se hace aquí mismo. El que la pide recibe lo que haya salido.
 */
export type Accion =
  | { tipo: 'crear'; nombre: string; avatar: string; clase: ClaseId }
  | { tipo: 'borrar'; id: string }
  | { tipo: 'perfil'; nombre?: string; avatar?: string }
  /** Compra lo que falte de una pinta y se la pone. */
  | { tipo: 'vestir'; look: unknown }
  | { tipo: 'guardarAnimacion'; nombre: string; puntos: Punto[] }
  | { tipo: 'ponerAnimacion'; id: string | null }
  | { tipo: 'borrarAnimacion'; id: string }
  | { tipo: 'abrirSobre' }
  | { tipo: 'cobrar'; objetivo: string }
  | { tipo: 'guardarBaraja'; indice: number; baraja: Deck }
  | { tipo: 'barajaPuesta'; indice: number }
  | { tipo: 'nuevaBaraja' }
  | { tipo: 'borrarBaraja'; indice: number }

/** Lo que devuelve cada acción: un error en cristiano, o lo que haya salido. */
export interface Hecho {
  error?: string
  /** El personaje nuevo (al crear). */
  id?: string
  /** Las cartas del sobre, en el orden en que se enseñan. */
  cartas?: string[]
  /** Lo que daba el encargo cobrado. */
  premio?: PremioObjetivo
}

/** Cuántos personajes caben en una cuenta. */
export const MAX_PERSONAJES = 3

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const entero = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : -1)
const lista = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : [])

function limpiarBaraja(bruta: unknown, player: Player): Deck {
  const b = (bruta && typeof bruta === 'object' ? bruta : {}) as Partial<Deck>
  // Solo cartas que de verdad son tuyas.
  const tuya = (id: string) => player.unlocked.includes(id)
  return { name: texto(b.name, 24) || 'Baraja', battle: lista(b.battle, 10).filter(tuya), weapons: lista(b.weapons, 4).filter(tuya) }
}

/**
 * Hace una acción sobre los jugadores del juego (en el servidor, sobre los de la cuenta).
 * `cuentaId` es la cuenta de los personajes que se creen.
 */
export function ejecutarAccion(accion: Accion, cuentaId?: string): Hecho {
  switch (accion.tipo) {
    case 'crear': {
      if (players().filter((p) => p.cuentaId === cuentaId).length >= MAX_PERSONAJES) return { error: `Caben ${MAX_PERSONAJES} personajes por cuenta` }
      const clase: ClaseId = accion.clase === 'indios' || accion.clase === 'vikingos' ? accion.clase : 'vaqueros'
      const nuevo = createPlayer(texto(accion.nombre, 24), texto(accion.avatar, 60), clase, cuentaId)
      return { id: nuevo.id }
    }
    case 'borrar': {
      const error = deletePlayer(texto(accion.id, 60))
      return error ? { error } : {}
    }
    case 'perfil': {
      const cambios: Partial<Player> = {}
      const nombre = texto(accion.nombre, 24).trim()
      if (nombre) cambios.name = nombre
      // El retrato tiene que ser un muñeco del juego.
      if (accion.avatar && gameCards().some((card) => card.id === accion.avatar && card.kind === 'batalla')) cambios.avatar = accion.avatar
      updatePlayer(cambios)
      return {}
    }
    case 'vestir': {
      if (!isLook(accion.look)) return { error: 'Esa pinta no se entiende' }
      const look = cloneLook(accion.look)
      const player = getPlayer()
      for (const id of loQueFalta(look, []).filter((id) => !loTienes(player, id))) {
        const error = comprar(id)
        if (error) return { error }
      }
      const error = ponerPinta(look)
      return error ? { error } : {}
    }
    case 'guardarAnimacion': {
      const puntos = Array.isArray(accion.puntos)
        ? accion.puntos.filter((p): p is Punto => Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number').slice(0, 400)
        : []
      const error = guardarAnimacion(texto(accion.nombre, 24), puntos)
      return error ? { error } : {}
    }
    case 'ponerAnimacion':
      ponerAnimacion(typeof accion.id === 'string' ? accion.id : null)
      return {}
    case 'borrarAnimacion':
      borrarAnimacion(texto(accion.id, 60))
      return {}
    case 'abrirSobre': {
      const cartas = abrirSobre().map((card) => card.id)
      return cartas.length > 0 ? { cartas } : { error: 'No te quedan sobres' }
    }
    case 'cobrar': {
      const premio = cobrarObjetivo(texto(accion.objetivo, 40))
      return premio ? { premio } : { error: 'Ese encargo no está para cobrar' }
    }
    case 'guardarBaraja': {
      const indice = entero(accion.indice)
      if (!getPlayer().decks[indice]) return { error: 'Esa baraja no existe' }
      saveDeckAt(indice, limpiarBaraja(accion.baraja, getPlayer()))
      return {}
    }
    case 'barajaPuesta': {
      const error = setActiveDeck(entero(accion.indice))
      return error ? { error } : {}
    }
    case 'nuevaBaraja': {
      const error = addDeck()
      return error ? { error } : {}
    }
    case 'borrarBaraja':
      deleteDeck(entero(accion.indice))
      return {}
    default:
      return { error: 'Esa acción no existe' }
  }
}
