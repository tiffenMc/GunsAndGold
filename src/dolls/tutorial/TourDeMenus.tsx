import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Omitir } from './Omitir'
import { Bocadillo } from './Guia'
import { useEscalaPc } from '../escalaPc'
import type { Lugar, Zona } from '../pueblo/lugares'

/** Los sitios que el tutorial puede abrir él solo. */
export type PantallaDelTour = 'pueblo' | 'tablon' | 'saloon' | 'cartas' | 'baraja' | 'desierto' | 'incursiones' | 'entrenar' | 'rango'

/** Donde está ahora el jugador (para saber si ha cumplido la misión). */
export interface Donde {
  lugar: Lugar
  zona: Zona | null
}

/** El evento que suelta el pueblo cuando el vaquero echa a andar porque has tocado el suelo. */
export const EVENTO_ANDA = 'oeste:anda'

interface PasoDelTour {
  /** Lo que se abre al llegar a este paso (en las misiones, normalmente la calle). */
  pantalla?: PantallaDelTour
  /** El `data-tuto` de lo que se ilumina. */
  foco?: string
  titulo: string
  texto: ReactNode
  masInfo?: ReactNode
  /** La misión: se avanza haciéndola. */
  mision?: { texto: ReactNode; hecha: (donde: Donde, anduvo: boolean) => boolean; premio: string }
  siguiente?: string
}

/**
 * **El paseo por el pueblo** con Bigotes. Poco que leer y mucho que hacer: andar, ir al tablón, al
 * saloon, al bar y subir a la diligencia. Cada misión cumplida da una estrella.
 */
export const PASOS_DEL_TOUR: PasoDelTour[] = [
  {
    pantalla: 'pueblo',
    titulo: '¡Bienvenido, forastero!',
    texto: (
      <>
        <p>Soy <b>Bigotes</b>, el sheriff. En un par de minutos te enseño el pueblo…</p>
        <p>…y luego te reto a un <b>duelo</b>. ¿Hace? 🤠</p>
      </>
    ),
    siguiente: '¡Vamos!',
  },
  {
    titulo: 'Tu vaquero va donde toques',
    texto: <p>Toca cualquier sitio del suelo y allá que va. Si dejas el dedo pulsado, te sigue.</p>,
    masInfo: 'En el ordenador también puedes andar con las flechas o con WASD.',
    mision: { texto: 'Toca el suelo para andar', hecha: (_, anduvo) => anduvo, premio: '¡Buen paso!' },
  },
  {
    foco: 'atajo-tablon',
    titulo: 'Los atajos de abajo',
    texto: <p>¿Con prisa? Los botones de abajo te llevan <b>al instante</b> a cada sitio.</p>,
    mision: { texto: <>Toca <b>TABLÓN</b> abajo</>, hecha: (d) => d.zona === 'tablon', premio: '¡Ziuuum!' },
  },
  {
    pantalla: 'tablon',
    foco: 'ficha',
    titulo: '¡SE BUSCA… tú!',
    texto: (
      <p>
        Este cartel eres tú: tu nombre, tu bando y tu <b>rango</b>. Las 💰 <b>monedas</b> marcan lo alto que estás.
      </p>
    ),
    masInfo:
      'Las monedas solo se ganan (o se pierden) en las partidas de rango: se las quitas al rival. Así el rango dice de verdad lo bien que juegas.',
  },
  {
    pantalla: 'tablon',
    foco: 'encargos',
    titulo: 'Los encargos del día',
    texto: (
      <p>
        Cada día, <b>3 encargos</b>. Se cumplen solos jugando: pulsa <b>Reclamar</b> y te llevas monedas o un 📦 sobre.
      </p>
    ),
    masInfo: 'Cambian a las 00:00 de España. Pasarte cada día es la forma más fácil de conseguir cartas nuevas.',
  },
  {
    pantalla: 'pueblo',
    foco: 'atajo-saloon',
    titulo: '¿Echamos una partida?',
    texto: <p>En el saloon es donde se juega.</p>,
    mision: { texto: <>Ve al <b>SALOON</b></>, hecha: (d) => d.zona === 'saloon', premio: '¡Yija!' },
  },
  {
    pantalla: 'saloon',
    foco: 'rapida',
    titulo: 'Partida rápida',
    texto: (
      <p>
        Contra cualquiera y <b>sin perder nada</b>: lo mejor para practicar. Y si ganas, ¡a lo mejor cae una carta!
      </p>
    ),
    masInfo: 'Con amigos: creas una partida, te da un código de 6 letras y tu amigo lo mete en "Entrar con un código".',
  },
  {
    pantalla: 'pueblo',
    foco: 'atajo-bar',
    titulo: '¿Y con qué se juega?',
    texto: <p>Con tus cartas, que se guardan en el bar.</p>,
    mision: { texto: <>Ve al <b>BAR</b></>, hecha: (d) => d.zona === 'bar', premio: '¡Ronda gratis!' },
  },
  {
    pantalla: 'baraja',
    foco: 'bar-baraja',
    titulo: 'Tus cartas y tu baraja',
    texto: (
      <p>
        En <b>Mis cartas</b> ves todas (normal, especial, <b>épica</b> y <b>divina</b>). En <b>Baraja</b> eliges con
        cuáles juegas: <b>10 muñecos + 4 armas</b>.
      </p>
    ),
    masInfo: 'En la partida te salen al azar 3 muñecos y 1 arma de tu baraja. Con la baraja a medias no se puede jugar.',
  },
  {
    pantalla: 'pueblo',
    foco: 'atajo-diligencia',
    titulo: '¡Al desierto!',
    texto: <p>Al final de la calle sale la diligencia. Allí está lo que te hace más fuerte.</p>,
    mision: {
      texto: <>Sube a la <b>DILIGENCIA</b> (atajo Desierto)</>,
      hecha: (d) => d.lugar === 'desierto' && d.zona === null,
      premio: '¡Arre, caballo!',
    },
  },
  {
    pantalla: 'desierto',
    foco: 'atajos',
    titulo: 'El desierto',
    texto: (
      <>
        <p>🎯 <b>Campo de tiro</b>: entrena tus características.</p>
        <p>🌵 <b>Cañón</b>: 5 incursiones por hora, <b>las mismas para todos</b>. Ganas trozos de cartas.</p>
        <p>🏰 <b>El Fuerte</b>: partidas de rango, por monedas.</p>
      </>
    ),
    masInfo: 'El ciclo del juego: entrenas → pagas incursiones → consigues cartas → mejor baraja → subes de rango.',
  },
  {
    pantalla: 'desierto',
    foco: 'nav-ajustes',
    titulo: 'Ya conoces el Oeste',
    texto: (
      <p>
        Arriba, en ⚙️ <b>Ajustes</b>, tienes el sonido y este tutorial. Y ahora… <b>¡a batirse en duelo!</b>
      </p>
    ),
    siguiente: '¡Al duelo!',
  },
]

interface Caja {
  x: number
  y: number
  w: number
  h: number
}

/**
 * El paseo, encima del juego de verdad. En los pasos de leer, oscurece todo menos lo que se explica
 * y el juego no se toca; en las misiones el pueblo se deja tocar (para cumplirlas) y solo se
 * marca dónde.
 */
export function TourDeMenus({
  irA,
  donde,
  estrellas,
  onMision,
  onAcabado,
  onOmitir,
}: {
  irA: (pantalla: PantallaDelTour) => void
  donde: Donde
  estrellas: number
  /** Misión cumplida: suma la estrella y saca la celebración con este texto. */
  onMision: (premio: string) => void
  onAcabado: () => void
  onOmitir: () => void
}) {
  const [indice, setIndice] = useState(0)
  const escala = useEscalaPc()
  const paso = PASOS_DEL_TOUR[indice]!
  const capa = useRef<HTMLDivElement>(null)
  const [caja, setCaja] = useState<Caja | null>(null)
  const [anduvo, setAnduvo] = useState(false)

  // Al llegar a un paso, se abre su sitio (si lo tiene).
  useEffect(() => {
    if (paso.pantalla) irA(paso.pantalla)
    setAnduvo(false)
  }, [indice, paso.pantalla, irA])

  // ¿Ha echado a andar tocando el suelo?
  useEffect(() => {
    const anda = () => setAnduvo(true)
    window.addEventListener(EVENTO_ANDA, anda)
    return () => window.removeEventListener(EVENTO_ANDA, anda)
  }, [])

  // ¿Misión cumplida? Estrella, celebración y al siguiente.
  const cumplida = paso.mision ? paso.mision.hecha(donde, anduvo) : false
  useEffect(() => {
    if (!cumplida || !paso.mision) return
    onMision(paso.mision.premio)
    setIndice((i) => Math.min(PASOS_DEL_TOUR.length - 1, i + 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cumplida])

  // Busca lo que hay que iluminar (las pantallas se cargan a su ritmo: se mira cada poco).
  useLayoutEffect(() => {
    setCaja(null)
    if (!paso.foco) return
    let traido = false
    const medir = () => {
      const el = document.querySelector<HTMLElement>(`[data-tuto="${paso.foco}"]`)
      const base = capa.current?.getBoundingClientRect()
      if (!el || !base) return
      if (!traido) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        traido = true
      }
      const r = el.getBoundingClientRect()
      setCaja((antes) => {
        const nueva = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
        if (antes && Math.abs(antes.x - nueva.x) + Math.abs(antes.y - nueva.y) + Math.abs(antes.w - nueva.w) + Math.abs(antes.h - nueva.h) < 1)
          return antes
        return nueva
      })
    }
    medir()
    const id = window.setInterval(medir, 200)
    return () => window.clearInterval(id)
  }, [paso.foco, indice])

  const mision = Boolean(paso.mision)
  const alto = capa.current?.clientHeight ?? 800
  // El bocadillo va donde no tape: en las misiones, siempre arriba (abajo están los atajos).
  const arriba = mision || (caja ? caja.y + caja.h / 2 > alto * 0.5 : false)
  const margen = 6
  const siguiente = () => (indice + 1 < PASOS_DEL_TOUR.length ? setIndice(indice + 1) : onAcabado())

  return (
    <div
      ref={capa}
      className={`absolute inset-0 z-[80] ${mision ? 'pointer-events-none' : ''}`}
      onPointerDown={mision ? undefined : (event) => event.stopPropagation()}
    >
      {/* En los pasos de leer, oscuro alrededor de lo que se explica */}
      {!mision &&
        (caja ? (
          [
            { left: 0, top: 0, right: 0, height: Math.max(0, caja.y - margen) },
            { left: 0, top: caja.y + caja.h + margen, right: 0, bottom: 0 },
            { left: 0, top: caja.y - margen, width: Math.max(0, caja.x - margen), height: caja.h + margen * 2 },
            { left: caja.x + caja.w + margen, top: caja.y - margen, right: 0, height: caja.h + margen * 2 },
          ].map((estilo, i) => <div key={i} className="pointer-events-none absolute bg-[rgba(8,4,2,0.7)]" style={estilo} />)
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-[rgba(8,4,2,0.55)]" />
        ))}
      {caja && (
        <div
          className="tuto-anillo pointer-events-none absolute rounded-xl border-[3px] border-amber-300"
          style={{ left: caja.x - margen, top: caja.y - margen, width: caja.w + margen * 2, height: caja.h + margen * 2 }}
        />
      )}
      {/* En las misiones, un dedo que señala lo que hay que tocar */}
      {mision && caja && (
        <span
          className="guia-dedo pointer-events-none absolute text-[34px] drop-shadow-[0_3px_4px_rgba(0,0,0,0.7)]"
          style={{ left: caja.x + caja.w / 2 - 17, top: caja.y - 50 }}
        >
          👇
        </span>
      )}

      <div className="pointer-events-auto absolute right-2 top-2 z-10" style={escala > 1 ? { zoom: escala } : undefined}>
        <Omitir onOmitir={onOmitir} />
      </div>

      <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-3 ${arriba ? 'top-12' : 'bottom-3'}`}>
        <div className="flex w-full justify-center" style={escala > 1 ? { zoom: escala } : undefined}>
          <Bocadillo
            key={indice}
            capitulo={0}
            paso={indice}
            pasos={PASOS_DEL_TOUR.length}
            estrellas={estrellas}
            titulo={paso.titulo}
            masInfo={paso.masInfo}
            mision={paso.mision?.texto}
            // Hacia atrás solo entre pasos de leer (una misión ya hecha no se repite).
            onAtras={!mision && indice > 0 && !PASOS_DEL_TOUR[indice - 1]!.mision ? () => setIndice(indice - 1) : undefined}
            onSiguiente={mision ? undefined : siguiente}
            siguiente={paso.siguiente}
          >
            {paso.texto}
          </Bocadillo>
        </div>
      </div>
    </div>
  )
}
