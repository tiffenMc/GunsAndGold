import type { BattleCard, Rarity } from '../cards/model'
import { createBattle, hacerTorre, spawnUnit, step } from './engine'
import type { Battle, Unit } from './engine'
import { estiloDe } from './estilos'
import { habilidadDe } from './habilidades'

/**
 * **El banco de pruebas del equilibrio.** Equilibrar 30 cartas con habilidades distintas a ojo es
 * imposible, asi que se juegan miles de peleas simuladas y se mira quien gana:
 *
 *  - **Duelos**: cada carta contra cada otra, uno contra uno, en varias posiciones.
 *  - **Escaramuzas**: tres contra tres al azar (las habilidades de grupo se lucen aqui).
 *  - **Torres**: cada carta plantada de torre aguantando oleadas de tres atacantes.
 *
 * El resultado se compara **con las de su misma rareza**: es normal que una divina gane mas que una
 * normal, lo que no puede ser es que una normal gane como una divina (o que una divina no gane).
 */

export interface FilaDeEquilibrio {
  id: string
  nombre: string
  rareza: Rarity
  ataque: string
  defensa: string
  /** % de duelos 1v1 ganados. */
  duelos: number
  /** % de escaramuzas 3v3 ganadas por el equipo en el que estaba. */
  grupo: number
  /** Lo que aguanta de torre: % de oleadas en las que sigue en pie. */
  torre: number
  /** Bajas medias que hace de torre por oleada. */
  bajasTorre: number
  /** La nota final y lo que se aparta de la media de su rareza (en puntos). */
  nota: number
  desvio: number
  /** Lo mismo, por separado: atacando (duelos y grupo) y de torre. */
  notaAtaque: number
  notaTorre: number
  desvioAtaque: number
  desvioTorre: number
  veredicto: 'rota' | 'fuerte' | 'bien' | 'floja' | 'inutil'
}

const DT = 1 / 20

/** Cuanto por encima (o por debajo) de la media de su clase tiene que quedar cada rareza. */
export const ESCALON_DE_RAREZA: Record<Rarity, number> = { normal: -9, especial: -2, epica: 6, divina: 13 }

function vivo(u: Unit) {
  return u.state !== 'muerto'
}

/** Una batalla vacia (con la mano bloqueada: aqui solo pelean las tropas que se ponen a mano). */
function campo(cards: BattleCard[], seed: number): Battle {
  const battle = createBattle({ decks: [cards, cards], seed })
  battle.lastPlayAt[0] = 1e9
  battle.lastPlayAt[1] = 1e9
  // Sin vagoneta que distraiga.
  battle.nextCartAt = 1e9
  return battle
}

/** Hasta que solo quede un bando (o se acabe el tiempo). Devuelve el bando ganador (o null si empate). */
function pelear(battle: Battle, a: Unit[], b: Unit[], maxS: number): 0 | 1 | null {
  for (let t = 0; t < maxS; t += DT) {
    step(battle, DT)
    // Los fuertes no cuentan: solo la pelea entre tropas.
    battle.forts[0].hp = battle.forts[0].maxHp
    battle.forts[1].hp = battle.forts[1].maxHp
    const va = a.some(vivo)
    const vb = b.some(vivo)
    if (!va || !vb) return va ? 0 : vb ? 1 : null
  }
  // Al acabar el tiempo gana quien conserve mas escudos (en proporcion).
  const resto = (l: Unit[]) => l.reduce((s, u) => s + (vivo(u) ? u.shields / u.maxShields : 0), 0)
  const ra = resto(a)
  const rb = resto(b)
  if (Math.abs(ra - rb) < 0.05) return null
  return ra > rb ? 0 : 1
}

function sorteo(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function simularEquilibrio(cartas: BattleCard[], opciones: { semillas?: number; escaramuzas?: number; oleadas?: number } = {}): FilaDeEquilibrio[] {
  const semillas = opciones.semillas ?? 4
  const escaramuzas = opciones.escaramuzas ?? 1600
  const oleadas = opciones.oleadas ?? 20
  const n = cartas.length
  const duelos = new Array(n).fill(0)
  const duelosJugados = new Array(n).fill(0)

  // --- Duelos 1v1: todos contra todos ---
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let s = 0; s < semillas; s++) {
        const battle = campo(cartas, 1000 + i * 97 + j * 13 + s)
        const dx = (s - (semillas - 1) / 2) * 1.5
        // Se alterna quien empieza abajo: el campo no es simetrico del todo.
        const [ladoI, ladoJ] = s % 2 === 0 ? ([0, 1] as const) : ([1, 0] as const)
        const ui = spawnUnit(battle, ladoI, cartas[i]!, { x: dx, z: ladoI === 0 ? 7 : -7 }, 'bien')
        const uj = spawnUnit(battle, ladoJ, cartas[j]!, { x: -dx, z: ladoJ === 0 ? 7 : -7 }, 'bien')
        const g = pelear(battle, ladoI === 0 ? [ui] : [uj], ladoI === 0 ? [uj] : [ui], 45)
        duelosJugados[i]++
        duelosJugados[j]++
        if (g === null) {
          duelos[i] += 0.5
          duelos[j] += 0.5
        } else {
          const ganaI = (g === 0) === (ladoI === 0)
          if (ganaI) duelos[i]++
          else duelos[j]++
        }
      }
    }
  }

  // --- Escaramuzas 3v3 al azar ---
  const grupo = new Array(n).fill(0)
  const grupoJugadas = new Array(n).fill(0)
  const rnd = sorteo(77)
  for (let k = 0; k < escaramuzas; k++) {
    const elegidas = new Set<number>()
    while (elegidas.size < 6) elegidas.add(Math.floor(rnd() * n))
    const lista = [...elegidas]
    const battle = campo(cartas, 5000 + k)
    const a = lista.slice(0, 3).map((c, x) => spawnUnit(battle, 0, cartas[c]!, { x: (x - 1) * 2.5, z: 8 + rnd() * 2 }, 'bien'))
    const b = lista.slice(3).map((c, x) => spawnUnit(battle, 1, cartas[c]!, { x: (x - 1) * 2.5, z: -8 - rnd() * 2 }, 'bien'))
    const g = pelear(battle, a, b, 60)
    for (const c of lista.slice(0, 3)) {
      grupoJugadas[c]++
      grupo[c] += g === 0 ? 1 : g === null ? 0.5 : 0
    }
    for (const c of lista.slice(3)) {
      grupoJugadas[c]++
      grupo[c] += g === 1 ? 1 : g === null ? 0.5 : 0
    }
  }

  // --- Torres contra oleadas de tres ---
  const torre = new Array(n).fill(0)
  const bajasTorre = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    for (let o = 0; o < oleadas; o++) {
      const battle = campo(cartas, 9000 + i * 31 + o)
      const t = spawnUnit(battle, 0, cartas[i]!, { x: 0, z: 12 }, 'bien')
      hacerTorre(battle, t)
      const atacantes = [0, 1, 2].map((x) => {
        const c = cartas[Math.floor(rnd() * n)]!
        return spawnUnit(battle, 1, c, { x: (x - 1) * 3, z: -2 - x }, 'bien')
      })
      pelear(battle, [t], atacantes, 50)
      if (vivo(t)) torre[i]++
      bajasTorre[i] += atacantes.filter((u) => !vivo(u)).length
    }
  }

  // --- Nota y comparacion con su rareza ---
  const filas: FilaDeEquilibrio[] = cartas.map((c, i) => {
    const h = habilidadDe(estiloDe(c))
    const d = (duelos[i] / Math.max(1, duelosJugados[i])) * 100
    const g = (grupo[i] / Math.max(1, grupoJugadas[i])) * 100
    const tr = (torre[i] / oleadas) * 100
    const bt = bajasTorre[i] / oleadas
    // La nota pesa mas el ataque (es lo que mas se juega) que la torre.
    // Las de apoyo (curar, cúpulas, estandartes, portales) no ganan duelos: se juzgan en grupo.
    const apoyo = ['cura', 'burbuja', 'estandarte', 'teleporte'].includes(h.mecanica)
    const notaAtaque = apoyo ? g : d * 0.55 + g * 0.45
    const notaTorre = tr * 0.6 + (bt / 3) * 100 * 0.4
    const nota = notaAtaque * 0.75 + notaTorre * 0.25
    return {
      notaAtaque: Math.round(notaAtaque),
      notaTorre: Math.round(notaTorre),
      desvioAtaque: 0,
      desvioTorre: 0,
      id: c.id,
      nombre: c.name,
      rareza: c.rarity ?? 'normal',
      ataque: h.nombre,
      defensa: h.torre?.nombre ?? '',
      duelos: Math.round(d),
      grupo: Math.round(g),
      torre: Math.round(tr),
      bajasTorre: Math.round(bt * 10) / 10,
      nota: Math.round(nota),
      desvio: 0,
      veredicto: 'bien' as const,
    }
  })
  // **El objetivo de cada rareza**: la media de la clase, y cada rareza un escalon por encima de la
  // anterior. Asi una divina siempre gana mas que una epica, y una epica mas que una especial.
  const mediaDe = (clave: 'nota' | 'notaAtaque' | 'notaTorre') => filas.reduce((s, f) => s + f[clave], 0) / Math.max(1, filas.length)
  const general = { nota: mediaDe('nota'), notaAtaque: mediaDe('notaAtaque'), notaTorre: mediaDe('notaTorre') }
  for (const rareza of ['normal', 'especial', 'epica', 'divina'] as Rarity[]) {
    const suyas = filas.filter((f) => f.rareza === rareza)
    const escalon = ESCALON_DE_RAREZA[rareza]
    const media = general.nota + escalon
    const mediaA = general.notaAtaque + escalon
    const mediaT = general.notaTorre + escalon
    for (const f of suyas) {
      f.desvioAtaque = Math.round(f.notaAtaque - mediaA)
      f.desvioTorre = Math.round(f.notaTorre - mediaT)
      f.desvio = Math.round(f.nota - media)
      f.veredicto = f.desvio >= 15 ? 'rota' : f.desvio >= 7 ? 'fuerte' : f.desvio <= -15 ? 'inutil' : f.desvio <= -7 ? 'floja' : 'bien'
    }
  }
  return filas
}

/** El informe, en una tabla para leer. */
export function informeDeEquilibrio(clase: string, filas: FilaDeEquilibrio[]): string {
  const icono = { rota: '🔴 ROTA', fuerte: '🟠 fuerte', bien: '🟢 bien', floja: '🔵 floja', inutil: '⚫ INÚTIL' }
  const orden: Rarity[] = ['normal', 'especial', 'epica', 'divina']
  const lineas = [
    `## ${clase}`,
    '',
    '| Carta | Rareza | Ataque | Defensa | Duelos 1v1 | Grupo 3v3 | Torre aguanta | Bajas de torre | Nota | vs su rareza | Veredicto |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ]
  const ordenadas = [...filas].sort((a, b) => orden.indexOf(a.rareza) - orden.indexOf(b.rareza) || b.nota - a.nota)
  for (const f of ordenadas) {
    lineas.push(
      `| ${f.nombre} | ${f.rareza} | ${f.ataque} | ${f.defensa} | ${f.duelos}% | ${f.grupo}% | ${f.torre}% | ${f.bajasTorre} | ${f.nota} | ${f.desvio > 0 ? '+' : ''}${f.desvio} | ${icono[f.veredicto]} |`,
    )
  }
  const media = (r: Rarity) => {
    const l = filas.filter((f) => f.rareza === r)
    return Math.round(l.reduce((s, f) => s + f.nota, 0) / Math.max(1, l.length))
  }
  lineas.push('', `Nota media por rareza: normal ${media('normal')} · especial ${media('especial')} · épica ${media('epica')} · divina ${media('divina')}`, '')
  return lineas.join('\n')
}

/**
 * **El ajuste automatico.** Simula, mira cuanto se aparta cada carta de las de su rareza y corrige
 * un poco: la que gana de mas pega menos y la que no gana pega mas. Si con la habilidad no basta
 * (las de apoyo apenas cambian un duelo), toca los escudos, pero poco. Varias vueltas hasta que se
 * quedan quietas.
 */
export function ajustarEquilibrio(
  cartas: BattleCard[],
  ajustes: Record<string, { poder?: number; torre?: number; escudos?: number; cadencia?: number }>,
  vueltas: number,
  avisar: (texto: string) => void = () => {},
  /** Los numeros de cada carta antes de cualquier ajuste (los ajustes son siempre sobre estos). */
  sinAjuste: Record<string, { shields: number; fireMs: number }> = {},
  /** Cartas de referencia: solo se les ajusta la habilidad, nunca los numeros. */
  fijas: string[] = [],
): FilaDeEquilibrio[] {
  const base = new Map(cartas.map((c) => [c.id, sinAjuste[c.id] ?? { shields: c.shields, fireMs: c.fireMs }]))
  let filas: FilaDeEquilibrio[] = []
  for (let v = 0; v < vueltas; v++) {
    // Las cartas con los escudos de este momento.
    const conEscudos = cartas.map((c) => ({
      ...c,
      shields: Math.max(2, Math.min(10, Math.round(base.get(c.id)!.shields * (ajustes[c.id]?.escudos ?? 1)))),
      fireMs: Math.round(base.get(c.id)!.fireMs * (ajustes[c.id]?.cadencia ?? 1)),
    }))
    filas = simularEquilibrio(conEscudos, { semillas: 4, escaramuzas: 1600, oleadas: 20 })
    const paso = 0.018 * (1 - v / (vueltas + 2))
    for (const f of filas) {
      const a = (ajustes[f.id] ??= {})
      const poder = a.poder ?? 1
      const nuevoPoder = Math.min(3, Math.max(0.35, poder * (1 - f.desvioAtaque * paso)))
      a.poder = Math.round(nuevoPoder * 100) / 100
      // Si la habilidad ya esta en el tope y sigue lejos, se tocan los escudos.
      const enTope = (nuevoPoder >= 2.95 && f.desvioAtaque < 0) || (nuevoPoder <= 0.36 && f.desvioAtaque > 0)
      // Lo que mas pesa en una pelea son los escudos y lo seguido que dispara: se tocan siempre un poco.
      if ((enTope || Math.abs(f.desvioAtaque) > 5) && !fijas.includes(f.id)) {
        const escudos = a.escudos ?? 1
        a.escudos = Math.round(Math.min(1.4, Math.max(0.6, escudos * (1 - f.desvioAtaque * paso * 0.6))) * 100) / 100
        const cadencia = a.cadencia ?? 1
        // Mas cadencia = espera mas entre tiros (la que gana de mas dispara menos seguido).
        a.cadencia = Math.round(Math.min(1.5, Math.max(0.7, cadencia * (1 + f.desvioAtaque * paso * 0.6))) * 100) / 100
      }
      const torre = a.torre ?? 1
      a.torre = Math.round(Math.min(3, Math.max(0.35, torre * (1 - f.desvioTorre * paso))) * 100) / 100
    }
    const lejos = filas.filter((f) => Math.abs(f.desvioAtaque) > 8 || Math.abs(f.desvioTorre) > 12).length
    avisar(`vuelta ${v + 1}: ${lejos} cartas aún lejos de su rareza`)
  }
  return filas
}
