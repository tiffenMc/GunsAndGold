import { useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { BattleScreen } from '../battle/BattleScreen'
import type { EstadoDeGuia, GuiaDeBatalla } from '../battle/BattleScreen'
import { FIRE_LINE, spawnUnit } from '../battle/engine'
import type { BattleEvent } from '../battle/engine'
import type { Rect } from '../battle/layout'
import { QUALITIES, RARITIES, rarityOf } from '../cards/model'
import type { BattleCard, CardDef, QualityId, WeaponCard } from '../cards/model'
import { useGameCards } from '../cards/store'
import { cartasDeClase } from '../game/clases'
import { usePlayer } from '../game/players'
import { SCENARIOS } from '../scenes/scenarios'
import { SafeCanvas } from '../SafeCanvas'
import { Omitir } from './Omitir'
import { Bocadillo } from './Guia'

/**
 * Los pasos de la partida de ejemplo. Los de leer congelan la partida; los de hacer esperan a que
 * lo hagas tú (no hay botón de "Siguiente": se avanza haciéndolo, que es como se aprende).
 */
type PasoId = 'campo' | 'arrastra' | 'dibuja' | 'calidad' | 'arma' | 'torre' | 'reglas' | 'libre'

const ORDEN: PasoId[] = ['campo', 'arrastra', 'dibuja', 'calidad', 'arma', 'torre', 'reglas', 'libre']

/** Lo que le queda al fuerte rival cuando empieza la parte libre: para que se gane en un rato. */
const FUERTE_RIVAL_AL_SOLTAR = 0.3

/**
 * Una baraja facil para aprender: los muñecos mas sencillos de tu clase y armas de bala normal
 * (nada de humo, tuneles ni explosivos, que tienen sus propias reglas).
 */
function barajaDeEjemplo(cards: CardDef[], clase: string): { mia: CardDef[]; rival: CardDef[] } {
  const deClase = clase === 'todas' ? cards : cartasDeClase(cards, clase as Parameters<typeof cartasDeClase>[1])
  const pool = deClase.length > 0 ? deClase : cards
  const orden = (card: CardDef) => RARITIES.findIndex((r) => r.id === rarityOf(card))
  const munecos = pool.filter((c): c is BattleCard => c.kind === 'batalla').sort((a, b) => orden(a) - orden(b))
  const todasLasArmas = pool.filter((c): c is WeaponCard => c.kind === 'arma')
  const sencillas = todasLasArmas.filter((w) => !w.special && w.shot.mode !== 'explosivo')
  const armas = (sencillas.length >= 2 ? sencillas : todasLasArmas).slice(0, 4)
  const mia = [...munecos.slice(0, 10), ...armas]
  return { mia, rival: mia }
}

export function PartidaDeEjemplo({
  onAcabado,
  onOmitir,
  estrellas,
  onMision,
}: {
  onAcabado: () => void
  onOmitir: () => void
  /** Las estrellas de sheriff que lleva (para el bocadillo). */
  estrellas: number
  /** Misión cumplida: estrella y celebración. */
  onMision: (premio: string) => void
}) {
  const player = usePlayer()
  const cards = useGameCards()
  const barajas = useMemo(() => barajaDeEjemplo(cards, player.clase), [cards, player.clase])
  const escenario = SCENARIOS[0]!

  const [paso, setPaso] = useState<PasoId>('campo')
  const pasoRef = useRef(paso)
  pasoRef.current = paso
  const [estado, setEstado] = useState<EstadoDeGuia | null>(null)
  /** La calidad con la que salió tu primer soldado (para explicártela). */
  const [calidad, setCalidad] = useState<QualityId | null>(null)
  /** Tus soldados que ya se han visto: uno nuevo es que acaba de salir (sin depender del ritmo de los fotogramas). */
  const vistos = useRef(new Set<number>())
  /** Los usos del arma la última vez que se miró (para saber si has disparado). */
  const usosAntes = useRef<number | null>(null)
  /** Al rival le ponemos un blanco para el arma una sola vez. */
  const blancoPuesto = useRef(false)
  const [plegada, setPlegada] = useState(false)
  const [ganada, setGanada] = useState<boolean | null>(null)

  /** Cada misión da su estrella una sola vez (el disparo y la torre se notan por dos sitios). */
  const premiadas = useRef(new Set<string>())
  const onMisionRef = useRef(onMision)
  onMisionRef.current = onMision
  const premiar = useCallback((texto: string) => {
    if (premiadas.current.has(texto)) return
    premiadas.current.add(texto)
    onMisionRef.current(texto)
  }, [])

  const ir = useCallback((siguiente: PasoId) => {
    pasoRef.current = siguiente
    setPaso(siguiente)
    setPlegada(false)
  }, [])

  const onEventos = useCallback(
    (eventos: BattleEvent[]) => {
      for (const e of eventos) {
        const ahora = pasoRef.current
        if (e.type === 'weaponFired' && e.side === 0 && ahora === 'arma') {
          premiar('¡Pum! ¡Buen tiro!')
          ir('torre')
        }
        if (e.type === 'torre' && e.side === 0 && e.torre && ahora === 'torre') {
          premiar('¡Torre en pie!')
          ir('reglas')
        }
        if (e.type === 'over') {
          setGanada(e.winner === 0)
          if (e.winner === 0) premiar('¡Duelo ganado!')
        }
      }
    },
    [ir, premiar],
  )

  const onEstado = useCallback(
    (nuevo: EstadoDeGuia) => {
      const ahora = pasoRef.current
      const { battle } = nuevo
      // Mientras se explica, nadie tumba ningún fuerte: así nadie se queda a medias.
      if (ahora !== 'libre') {
        battle.forts[0].hp = battle.forts[0].maxHp
        battle.forts[1].hp = battle.forts[1].maxHp
      }
      // ¿Ha salido algún soldado tuyo nuevo? (playCard lo mete en el campo al momento)
      const nuevos = battle.units.filter((u) => u.side === 0 && !vistos.current.has(u.id))
      for (const u of nuevos) vistos.current.add(u.id)
      // Al levantar la carta, pasa a la explicación del dibujo; al acabar, a ver cómo ha salido.
      if (ahora === 'arrastra' && nuevo.dibujando) ir('dibuja')
      else if (ahora === 'dibuja' && !nuevo.dibujando) {
        const salido = nuevos[nuevos.length - 1]
        if (salido) {
          setCalidad(salido.quality)
          premiar('¡Soldado al campo!')
          ir('calidad')
        } else ir('arrastra') // Se canceló el dibujo: otra vez a arrastrar.
      }
      if (ahora === 'torre' && nuevos.some((u) => u.torre)) {
        premiar('¡Torre en pie!')
        ir('reglas')
      }
      // El arma: si le baja un uso, es que has disparado.
      const usos = battle.hands[0].weapon.uses
      if (ahora === 'arma' && usosAntes.current !== null && usos < usosAntes.current) {
        premiar('¡Pum! ¡Buen tiro!')
        ir('torre')
      }
      usosAntes.current = usos
      // Para probar el arma hace falta a quién disparar: sale un rival delante de tu raya.
      if (ahora === 'arma' && !blancoPuesto.current) {
        blancoPuesto.current = true
        const suyo = barajas.rival.find((c): c is BattleCard => c.kind === 'batalla')
        if (suyo) spawnUnit(battle, 1, suyo, { x: 0, z: FIRE_LINE - 9 }, 'medio')
      }
      setEstado(nuevo)
    },
    [barajas.rival, ir, premiar],
  )

  const soltar = () => {
    if (estado) estado.battle.forts[1].hp = estado.battle.forts[1].maxHp * FUERTE_RIVAL_AL_SOLTAR
    ir('libre')
  }

  // Lo que se congela y lo que se calla en cada paso.
  const deLeer = paso === 'campo' || paso === 'calidad' || paso === 'reglas'
  const guia: GuiaDeBatalla = { botQuieto: paso !== 'libre', pausa: deLeer, onEventos, onEstado }

  const layout = estado?.layout
  const indice = ORDEN.indexOf(paso)
  const calidadInfo = QUALITIES.find((q) => q.id === calidad)

  // Lo que se ilumina en la pantalla en cada paso (la mano, una carta, el arma…).
  let foco: Rect | null = null
  let dedo: { desde: Rect; hastaY: number } | null = null
  if (layout) {
    const mano: Rect = {
      x: layout.slots[0]!.x,
      y: layout.slots[0]!.y,
      w: layout.weapon.x + layout.weapon.w - layout.slots[0]!.x,
      h: layout.slots[0]!.h,
    }
    const campoMedio = (layout.field.top + layout.field.bottom) / 2
    if (paso === 'campo') foco = mano
    if (paso === 'arrastra') {
      foco = layout.slots[0]!
      dedo = { desde: layout.slots[0]!, hastaY: layout.field.bottom - (layout.field.bottom - campoMedio) * 0.55 }
    }
    if (paso === 'torre') {
      foco = layout.slots[1]!
      dedo = { desde: layout.slots[1]!, hastaY: layout.field.bottom - (layout.field.bottom - campoMedio) * 0.3 }
    }
    if (paso === 'arma') {
      foco = layout.weapon
      dedo = { desde: layout.weapon, hastaY: campoMedio + (layout.field.bottom - campoMedio) * 0.25 }
    }
    if (paso === 'reglas') foco = layout.reroll
  }

  let tarjeta: { titulo: string; texto: ReactNode; masInfo?: ReactNode; mision?: ReactNode; siguiente?: () => void; boton?: string } | null =
    null
  switch (paso) {
    case 'campo':
      tarjeta = {
        titulo: '¡Duelo de práctica!',
        texto: (
          <>
            <p>
              Abajo tu fuerte 🔵, arriba el mío 🔴. <b>Gana quien tumbe el fuerte del otro.</b>
            </p>
            <p>
              Tus cartas (iluminadas): <b>3 muñecos</b> que pelean solos y, aparte, <b>1 arma</b> que disparas tú.
            </p>
          </>
        ),
        masInfo:
          'El juego está congelado: no te ataco hasta que acabes. Cuando usas una carta, a los 2 segundos sale otra. Si pasan los 5 minutos, gana quien tenga más vida.',
        siguiente: () => ir('arrastra'),
        boton: '¡Entendido!',
      }
      break
    case 'arrastra':
      tarjeta = {
        titulo: 'Saca tu primer soldado',
        texto: <p>Arrastra la carta iluminada hacia arriba, a tu mitad del campo, y suelta.</p>,
        mision: 'Arrastra la carta al campo y suéltala',
      }
      break
    case 'dibuja':
      tarjeta = {
        titulo: '¡Dibuja su patrón!',
        texto: (
          <>
            <p>
              Empieza en el <b>punto que late</b> y sigue el camino <b>de un solo trazo</b>.
            </p>
            <p className="flex flex-wrap gap-1 text-[12px] font-bold">
              {QUALITIES.map((q) => (
                <span key={q.id} className="rounded px-1.5 py-0.5 text-[#1a0d04]" style={{ background: q.color }}>
                  {q.label} {Math.round(q.mult * 100)}%
                </span>
              ))}
            </p>
          </>
        ),
        masInfo: 'Cuanto mejor dibujes, más fuerte sale: con “¡Excelente!”, toda su fuerza; con “Mal”, solo un 35%. Es la habilidad del juego.',
        mision: 'Dibuja el patrón de abajo',
      }
      break
    case 'calidad':
      tarjeta = {
        titulo: calidadInfo ? `¡${calidadInfo.label}!` : '¡Soldado en el campo!',
        texto: (
          <>
            {calidadInfo && (
              <p>
                Ha salido con el <b style={{ color: calidadInfo.color }}>{Math.round(calidadInfo.mult * 100)}%</b> de su fuerza.{' '}
                {calidadInfo.mult < 1 ? 'Con práctica, ¡Excelente!' : '¡Toda su fuerza, así se hace!'}
              </p>
            )}
            <p>
              Ahora va <b>él solito</b> hacia mi fuerte y dispara a lo que tenga a tiro.
            </p>
          </>
        ),
        masInfo: 'Tú no mueves a los soldados: decides cuál, dónde y con qué calidad. Ahí está la estrategia.',
        siguiente: () => ir('arma'),
      }
      break
    case 'arma':
      tarjeta = {
        titulo: '¡Un bandido! Dispárale',
        texto: (
          <p>
            Arrastra tu <b>arma</b> hacia arriba, <b>pasada tu raya</b>, y suelta: la bala sale recta desde ahí.
          </p>
        ),
        masInfo: 'Cada arma tiene pocos usos (las bolitas de la carta); al gastarlos cambia sola por otra. Si sueltas sobre tu raya, no se gasta.',
        mision: 'Arrastra el arma pasada tu raya y suelta',
      }
      break
    case 'torre':
      tarjeta = {
        titulo: 'Planta una torre',
        texto: (
          <p>
            Arrastra otra carta y <b>deja el dedo quieto</b> hasta ver <b>🏰 TORRE</b>. Suelta y dibuja.
          </p>
        ),
        masInfo: 'La torre no avanza, pero aguanta mucho más y defiende tu fuerte. Tocándola dos veces sale al ataque.',
        mision: 'Mantén la carta quieta hasta ver 🏰 TORRE',
      }
      break
    case 'reglas':
      tarjeta = {
        titulo: 'Tres trucos de sheriff',
        texto: (
          <>
            <p>🤠 Hay un <b>límite de soldados</b> (lo ves junto a tu vida): empieza en 4 y sube a 6.</p>
            <p>🔄 <b>Reroll</b> (iluminado): cambia tu arma. Cada 30 s.</p>
            <p>🛒 Si cruza la <b>vagoneta</b>, rómpela: ¡5 dinamitas!</p>
          </>
        ),
        masInfo: 'Cada enemigo que tumbas te da racha: tus soldados corren más unos segundos.',
        siguiente: soltar,
        boton: '¡Que empiece el duelo!',
      }
      break
    case 'libre':
      tarjeta =
        ganada === null
          ? {
              titulo: '¡Ahora va en serio!',
              texto: (
                <p>
                  Ya juego yo también. Te dejo mi fuerte tocado: <b>¡túmbalo!</b>
                </p>
              ),
              masInfo: 'Mezcla soldados que ataquen con alguna torre que defienda, y guarda el arma para cuando me acerque.',
            }
          : null
      break
  }

  return (
    <div className="relative h-full w-full">
      <SafeCanvas
        note=""
        fallback={
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-west text-xl text-amber-100">Este dispositivo no puede dibujar la batalla</p>
            <button type="button" onClick={onAcabado} className="btn-gold">
              Seguir
            </button>
          </div>
        }
      >
        <BattleScreen
          scenario={escenario}
          deck={barajas.mia}
          botDeck={barajas.rival}
          etiqueta="Tutorial"
          guia={guia}
          onExit={onAcabado}
          resultado={
            <p className="text-[15px] leading-snug text-amber-100">
              {ganada
                ? '¡Me has tumbado, forastero! Ya sabes sacar soldados, disparar y plantar torres.'
                : '¡Te gané! Pero tranquilo: era para aprender. En la partida rápida practicas sin perder nada.'}
            </p>
          }
        />
      </SafeCanvas>

      {/* ---------- Lo que se ilumina ---------- */}
      {foco && estado?.listo && (
        <div
          className="tuto-anillo pointer-events-none absolute z-[45] rounded-xl border-[3px] border-amber-300"
          style={{ left: foco.x - 4, top: foco.y - 4, width: foco.w + 8, height: foco.h + 8 }}
        />
      )}
      {dedo && estado?.listo && !estado.arrastrando && !estado?.dibujando && (
        <span
          className="tuto-dedo pointer-events-none absolute z-[46] text-4xl"
          style={
            {
              left: dedo.desde.x + dedo.desde.w / 2 - 14,
              top: dedo.desde.y + dedo.desde.h / 2 - 10,
              '--tuto-dy': `${dedo.hastaY - (dedo.desde.y + dedo.desde.h / 2)}px`,
            } as CSSProperties
          }
        >
          👆
        </span>
      )}

      {/* ---------- La tarjeta del guía ---------- */}
      {tarjeta && estado?.listo && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-[50] flex flex-col items-center gap-1.5 px-2.5">
          {plegada ? (
            <button
              type="button"
              onClick={() => setPlegada(false)}
              className="papel pointer-events-auto px-3 py-1.5 text-[13px] font-bold text-[#2a1a10]"
            >
              🤠 {tarjeta.titulo} · ver
            </button>
          ) : (
            <div className="relative w-full max-w-[420px]">
              <Bocadillo
                key={paso}
                capitulo={1}
                paso={indice}
                pasos={ORDEN.length}
                estrellas={estrellas}
                titulo={tarjeta.titulo}
                masInfo={tarjeta.masInfo}
                mision={tarjeta.mision}
                onSiguiente={tarjeta.siguiente}
                siguiente={tarjeta.boton}
              >
                {tarjeta.texto}
              </Bocadillo>
              {/* En los pasos de hacer, la tarjeta se puede encoger para ver el campo entero */}
              {!deLeer && (
                <button
                  type="button"
                  onClick={() => setPlegada(true)}
                  className="pointer-events-auto absolute -bottom-3 right-4 rounded-full border-2 border-[#2a1a10] bg-amber-300 px-2.5 py-0.5 text-[12px] font-black text-[#2a1a10] shadow"
                  title="Encoger"
                >
                  ▲ ver el campo
                </button>
              )}
            </div>
          )}
          <Omitir onOmitir={onOmitir} />
        </div>
      )}

    </div>
  )
}
