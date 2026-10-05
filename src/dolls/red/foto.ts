import type { BattleCard, CardDef } from '../cards/model'
import type { Battle, BattleEvent, Unit } from '../battle/engine'
import { ESTILOS, estiloDe } from '../battle/estilos'
import { habilidadDe } from '../battle/habilidades'

/**
 * **La foto de la partida.** El anfitrion lleva la partida de verdad y, varias veces por segundo,
 * le manda al invitado como va. El invitado no simula nada: pone la foto en su campo y lo pinta.
 *
 * La foto va **dada la vuelta** (en espejo): asi el invitado se ve abajo, como en una partida
 * normal, y el anfitrion arriba. Se le da la vuelta a todo: posiciones, direcciones y bandos.
 */

/** Lo que se le cambia de signo (posiciones y direcciones en el suelo). */
const COORDENADAS = new Set(['x', 'z', 'dx', 'dz', 'tx', 'tz', 'ox', 'oz', 'lx', 'lz'])
/** Los angulos en el suelo: girados media vuelta. */
const ANGULOS = new Set(['heading', 'ang', 'dir', 'orb', 'a0'])
/** Lo que es "de que bando". */
const BANDOS = new Set(['side', 'winner'])
/** Listas de dos (una por bando): se intercambian. */
const POR_BANDO = new Set(['forts', 'hands', 'stunUntil', 'lastPlayAt', 'racha', 'rachaHasta', 'kills', 'muertes'])

/** Da la vuelta a cualquier cosa de la partida (la foto entera o un aviso suelto). */
export function espejo<T>(valor: T, clave = ''): T {
  if (Array.isArray(valor)) {
    const lista = valor.map((v) => espejo(v))
    return (POR_BANDO.has(clave) && lista.length === 2 ? [lista[1], lista[0]] : lista) as T
  }
  if (valor && typeof valor === 'object') {
    const salida: Record<string, unknown> = {}
    const objeto = valor as Record<string, unknown>
    // La dinamita de cada bando va como { 0: n, 1: n }.
    if (clave === 'dynamiteAmmo') return { 0: objeto[1], 1: objeto[0] } as T
    for (const k of Object.keys(objeto)) salida[k] = espejo(objeto[k], k)
    return salida as T
  }
  if (typeof valor === 'number') {
    if (COORDENADAS.has(clave)) return -valor as T
    if (ANGULOS.has(clave)) return (valor + Math.PI) as T
    if (BANDOS.has(clave)) return (1 - valor) as T
  }
  return valor
}

/** La foto de como va la partida (solo lo que hace falta para pintarla). */
export function tomarFoto(battle: Battle, eventos: BattleEvent[]): unknown {
  return {
    time: battle.time,
    paceIndex: battle.paceIndex,
    over: battle.over,
    clima: battle.clima,
    cart: battle.cart,
    dynamiteAmmo: battle.dynamiteAmmo,
    stunUntil: battle.stunUntil,
    rerollAt: battle.rerollAt,
    lastPlayAt: battle.lastPlayAt,
    racha: battle.racha,
    rachaHasta: battle.rachaHasta,
    kills: battle.kills,
    forts: battle.forts,
    hands: battle.hands.map((mano) => ({ slots: mano.slots, weapon: mano.weapon })),
    smokes: battle.smokes,
    tunnels: battle.tunnels,
    campos: battle.campos,
    efectos: battle.efectos,
    sucesos: battle.sucesos,
    // Las cartas no viajan: solo su id (el invitado tiene el mismo catalogo).
    units: battle.units.map((u) => ({ ...u, card: undefined, estilo: undefined, habilidad: undefined, cardId: u.card.id })),
    shots: battle.shots.map((s) => ({ ...s, estilo: undefined, estiloId: s.estilo.id })),
    bullets: battle.bullets.map((b) => ({ ...b, hit: undefined })),
    eventos,
  }
}

type FotoUnidad = Omit<Unit, 'card' | 'estilo' | 'habilidad'> & { cardId: string }

/**
 * Pone la foto en la partida del invitado. Las tropas y los efectos **se actualizan en su sitio**
 * (no se cambian por otros): la escena los tiene enganchados y asi no parpadean.
 */
export function aplicarFoto(battle: Battle, fotoCruda: unknown, buscarCarta: (id: string) => CardDef | undefined) {
  const foto = fotoCruda as Record<string, unknown> & {
    units: FotoUnidad[]
    efectos: Battle['efectos']
    shots: (Omit<Battle['shots'][number], 'estilo'> & { estiloId: string })[]
    bullets: Battle['bullets']
    hands: { slots: Battle['hands'][0]['slots']; weapon: Battle['hands'][0]['weapon'] }[]
    eventos: BattleEvent[]
  }
  battle.time = foto.time as number
  battle.paceIndex = foto.paceIndex as number
  battle.over = foto.over as Battle['over']
  battle.cart = foto.cart as Battle['cart']
  battle.dynamiteAmmo = foto.dynamiteAmmo as Battle['dynamiteAmmo']
  battle.stunUntil = foto.stunUntil as Battle['stunUntil']
  battle.rerollAt = foto.rerollAt as number
  battle.lastPlayAt = foto.lastPlayAt as Battle['lastPlayAt']
  battle.racha = foto.racha as Battle['racha']
  battle.rachaHasta = foto.rachaHasta as Battle['rachaHasta']
  battle.kills = foto.kills as Battle['kills']
  battle.smokes = foto.smokes as Battle['smokes']
  battle.tunnels = foto.tunnels as Battle['tunnels']
  battle.campos = foto.campos as Battle['campos']
  battle.sucesos = (foto.sucesos as Battle['sucesos']) ?? []
  const fuertes = foto.forts as Battle['forts']
  Object.assign(battle.forts[0], fuertes[0])
  Object.assign(battle.forts[1], fuertes[1])
  foto.hands.forEach((mano, i) => {
    battle.hands[i as 0 | 1].slots = mano.slots
    battle.hands[i as 0 | 1].weapon = mano.weapon
    // Que la mano sepa que cartas son (por si alguna no estaba en esta partida).
    for (const id of [...mano.slots.map((s) => s.cardId), mano.weapon.cardId]) {
      if (id && !battle.cards.has(id)) {
        const carta = buscarCarta(id)
        if (carta) battle.cards.set(id, carta)
      }
    }
  })

  // Tropas: las que ya estaban se actualizan; las nuevas se crean con su carta; las que no estan, fuera.
  const antes = new Map(battle.units.map((u) => [u.id, u]))
  const tropas: Unit[] = []
  for (const f of foto.units) {
    const { cardId, ...resto } = f
    const ya = antes.get(f.id)
    if (ya) {
      tropas.push(Object.assign(ya, resto))
      continue
    }
    const card = (buscarCarta(cardId) ?? battle.cards.get(cardId)) as BattleCard | undefined
    // Una carta que no se conoce no rompe la foto entera: esa tropa no se pinta y ya.
    if (!card) continue
    const estilo = estiloDe(card)
    tropas.push({ ...resto, card, estilo, habilidad: habilidadDe(estilo) } as Unit)
  }
  battle.units = tropas

  // Efectos de las habilidades: igual, actualizados en su sitio.
  const efectosAntes = new Map(battle.efectos.map((e) => [e.id, e]))
  battle.efectos = foto.efectos.map((e) => {
    const ya = efectosAntes.get(e.id)
    return ya ? Object.assign(ya, e) : e
  })

  battle.shots = foto.shots.map((s) => ({ ...s, estilo: ESTILOS[s.estiloId] ?? ESTILOS.clasico! }))
  battle.bullets = foto.bullets.map((b) => ({ ...b, hit: new Set<number>() }))
  // Los avisos (tiros, golpes, explosiones…) para que se vean y se oigan igual.
  battle.events.push(...foto.eventos)
}
