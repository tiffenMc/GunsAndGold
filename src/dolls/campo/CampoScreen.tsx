import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icono } from '../Icono'
import { ARQUETIPOS, arquetipoInfo } from '../cards/arquetipos'
import { RARITIES, rarityInfo, rarityOf } from '../cards/model'
import type { CardDef } from '../cards/model'
import { useGameCards } from '../cards/store'
import { GameCard } from '../deck/GameCard'
import { CardSheet } from '../deck/CardSheet'
import { CARACTERISTICAS, caracteristicaInfo } from '../game/caracteristicas'
import type { Caracteristica } from '../game/caracteristicas'
import { horaDeCambio, incursionesDeLaHora, puedePagar } from '../game/incursiones'
import type { Incursion } from '../game/incursiones'
import { arquetipoDe, progresoDe, usePlayer } from '../game/players'

/** La vuelta atrás, en papel. */
function Volver({ children, onAtras }: { children: string; onAtras: () => void }) {
  return (
    <header className="relative z-10 flex items-center gap-2 border-b-2 border-[#2a1a10] bg-[#241609]/95 px-3 py-2">
      <button
        type="button"
        onClick={onAtras}
        className="rounded-lg border-2 border-amber-300/40 bg-black/40 px-2.5 py-1 text-[15px] font-bold text-amber-100"
      >
        ‹ Salir
      </button>
      <p className="font-west text-xl leading-none text-amber-100">{children}</p>
    </header>
  )
}

/** Las seis características, en seis chapas: número gordo, barra y a entrenar. */
export function Entrenar({ onAtras, onJugar }: { onAtras: () => void; onJugar: (mision: Mision) => void }) {
  const player = usePlayer()
  return (
    <div className="fondo-oeste relative flex h-full flex-col overflow-hidden">
      <Volver onAtras={onAtras}>Mejorar características</Volver>
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <p className="papel mb-2 p-2.5 text-[14px] leading-snug text-[#2a1a10]">
          Cada batalla de práctica sube la propiedad que elijas entre un <b>30%</b> y un <b>100%</b>. Todas bajan solas
          con el tiempo (nunca del 1%). Esto <b>no cambia la batalla</b>: son la moneda para pagar las incursiones de
          carta.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {CARACTERISTICAS.map((item) => {
            const valor = player.caracteristicas[item.id]
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onJugar({ tipo: 'entreno', stat: item.id })}
                className="papel flex flex-col items-center gap-1 p-2.5 text-center active:scale-[0.97]"
                title={item.note}
              >
                <span className="text-[32px] leading-none" style={{ color: item.color }}><Icono nombre={item.id} /></span>
                <span className="font-west text-[15px] leading-none text-[#2a1a10]">{item.label}</span>
                <span className="font-west text-[30px] leading-none" style={{ color: item.color }}>
                  {Math.round(valor)}%
                </span>
                <span className="h-2 w-full overflow-hidden rounded-full border border-[#2a1a10]/50 bg-white/40">
                  <span className="block h-full rounded-full" style={{ width: `${valor}%`, background: item.color }} />
                </span>
                <span className="text-[12px] leading-snug text-[#5b3a1c]">{item.note}</span>
                <span className="boton mt-1 w-full px-1 py-1 text-[13px]"><Icono nombre="entrenar" /> Entrenar</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Lo que tienes de cada caracteristica, en chapas de colores (para pagar de un vistazo). */
function ChapasDeCaracteristicas() {
  const player = usePlayer()
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {CARACTERISTICAS.map((item) => {
        const valor = Math.round(player.caracteristicas[item.id])
        return (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-lg border border-black/50 bg-black/45 px-2 py-1"
            title={item.note}
          >
            <span className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${valor}%`, background: item.color }} />
            <p className="relative flex items-center justify-between gap-1 text-[12px] font-bold text-amber-50">
              <span className="truncate">
                <Icono nombre={item.id} style={{ color: item.color }} /> {item.label}
              </span>
              <span className="font-west text-[15px] leading-none" style={{ color: item.color }}>
                {valor}
              </span>
            </p>
          </div>
        )
      })}
    </div>
  )
}

/**
 * **El tablón del Antiguo Oeste.** Las cinco incursiones de la hora, como carteles de SE BUSCA
 * clavados en un tablón: la carta en grande, la mision, lo que cuesta (en verde lo que llegas y en
 * rojo lo que te falta) y lo que llevas de ella. Primero las que puedes pagar.
 */
export function Incursiones({
  cards,
  onAtras,
  onJugar,
  ahora,
}: {
  cards: ReturnType<typeof useGameCards>
  onAtras: () => void
  onJugar: (mision: Mision) => void
  ahora: number
}) {
  const player = usePlayer()
  // La carta que se está mirando en 3D (tocando la del cartel).
  const [vista, setVista] = useState<string | null>(null)
  // La hora entra por props y cambia cada segundo: asi las cinco se renuevan solas al pasar la hora.
  const incursiones = incursionesDeLaHora(ahora, player.clase)
  const enVista = vista ? cards.find((item) => item.id === vista) : undefined
  const queda = horaDeCambio(ahora) - ahora
  const pagables = incursiones.filter((inc) => puedePagar(player.caracteristicas, inc.coste)).length
  // Primero las que puedes pagar y no tienes; al final las que ya son tuyas.
  const orden = (inc: Incursion) =>
    (progresoDe(player, inc.cardId) >= 100 ? 2 : 0) + (puedePagar(player.caracteristicas, inc.coste) ? 0 : 1)
  const ordenadas = [...incursiones].sort((a, b) => orden(a) - orden(b))

  return (
    <div className="fondo-oeste relative flex h-full flex-col overflow-hidden">
      <Volver onAtras={onAtras}>El Antiguo Oeste</Volver>
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
        {/* La cabecera: el tablón, el reloj de la hora y lo que tienes para pagar */}
        <div className="tablon p-3">
          <div className="flex items-center gap-3">
            <RelojDeLaHora queda={queda} />
            <div className="min-w-0 flex-1">
              <p className="font-west text-[24px] leading-none text-amber-100" style={{ textShadow: '0 2px 0 #000' }}>
                Se buscan
              </p>
              <p className="mt-1 text-[13px] leading-snug text-amber-100/80">
                Cinco carteles por hora, los mismos para todos. Cumple la misión y te llevas un trozo de la carta.
              </p>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="sello border-black/60 bg-amber-400 text-amber-950">
                  <Icono nombre="partida" /> puedes entrar en {pagables} de {incursiones.length}
                </span>
                <span className="sello border-black/60 bg-black/50 text-amber-200">
                  <Icono nombre="reloj" /> nuevos en {espera(queda)}
                </span>
              </p>
            </div>
          </div>
          <div data-tuto="caracteristicas" className="mt-2.5">
            <ChapasDeCaracteristicas />
          </div>
        </div>

        {/* Los carteles */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ordenadas.map((incursion, n) => {
            const card = cards.find((item) => item.id === incursion.cardId)
            if (!card) return null
            return (
              <CartelDeIncursion
                key={incursion.id}
                incursion={incursion}
                card={card}
                torcido={n % 2 === 0 ? -1 : 1}
                onVer={() => setVista(card.id)}
                onJugar={() => onJugar({ tipo: 'incursion', incursion })}
              />
            )
          })}
        </div>

        {/* La carta en 3D: se abre tocando la del cartel y se gira con el dedo */}
        {enVista && (
          <CardSheet card={enVista} arquetipo={arquetipoDe(player, enVista.id)} onClose={() => setVista(null)} />
        )}

        <div className="papel mt-4 p-3 text-[13px] leading-snug text-[#2a1a10]">
          <p className="font-west text-[17px] leading-none">Cómo va</p>
          <ol className="mt-1.5 space-y-1">
            <li>
              <b>1.</b> Elige un cartel. Toca su carta para verla <b>en 3D</b>.
            </li>
            <li>
              <b>2.</b> Paga su precio en características al entrar (se paga aunque pierdas).
            </li>
            <li>
              <b>3.</b> Cumple la misión: te llevas entre un <b>1%</b> y un <b>100%</b> de la carta.
            </li>
            <li>
              <b>4.</b> Al llegar al <b>100%</b> la carta es tuya. ¿No te llega? <b>Entrena</b> en el desierto.
            </li>
          </ol>
        </div>

        <details className="papel mt-2 p-2.5">
          <summary className="font-west text-[15px] leading-none text-[#2a1a10]">ℹ️ Los cuatro tipos de tirador</summary>
          <div className="mt-1.5 space-y-1">
            {ARQUETIPOS.map((tipo) => (
              <p key={tipo.id} className="text-[13px] leading-snug">
                <span className="font-bold" style={{ color: tipo.color }}>
                  {tipo.label}
                </span>{' '}
                <span className="text-[#5b3a1c]">· {tipo.note}</span>
              </p>
            ))}
            <p className="text-[12px] leading-snug text-[#5b3a1c]/80">
              El tipo se sortea cuando consigues la carta por primera vez y ya no se cambia. El berserker sale uno de
              cada diez.
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}

/** El reloj de la hora: un anillo que se vacía hasta que cambian los carteles. */
function RelojDeLaHora({ queda }: { queda: number }) {
  const parte = Math.max(0, Math.min(1, queda / 3_600_000))
  const minutos = Math.ceil(queda / 60_000)
  return (
    <div
      className="relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(#fbbf24 ${parte * 360}deg, rgba(0,0,0,0.55) 0)` }}
    >
      <div className="grid h-[58px] w-[58px] place-items-center rounded-full border-2 border-black/60 bg-[#241609] text-center">
        <span className="font-west text-[22px] leading-none text-amber-200">{minutos}</span>
        <span className="-mt-3 text-[9px] font-bold uppercase tracking-wider text-amber-100/70">min</span>
      </div>
    </div>
  )
}

/** Un cartel de SE BUSCA: la carta, su mision, su precio y el boton de entrar. */
function CartelDeIncursion({
  incursion,
  card,
  torcido,
  onVer,
  onJugar,
}: {
  incursion: Incursion
  card: CardDef
  torcido: number
  onVer: () => void
  onJugar: () => void
}) {
  const player = usePlayer()
  const rareza = rarityOf(card)
  const raro = rarityInfo(rareza)
  const llevo = progresoDe(player, card.id)
  const tuya = llevo >= 100
  const llega = puedePagar(player.caracteristicas, incursion.coste)
  const grande = rareza === 'epica' || rareza === 'divina'

  return (
    <article
      className={`cartel-busca relative px-3 pb-3 pt-5 ${grande ? 'cartel-busca-grande' : ''}`}
      style={{ rotate: `${torcido * 0.8}deg`, '--cartel-color': raro.color } as CSSProperties}
    >
      {/* El clavo de arriba */}
      <span className="absolute left-1/2 top-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-700 shadow-[0_1px_2px_rgba(0,0,0,0.7)]" />

      <p className="text-center font-west text-[30px] leading-none tracking-[0.12em] text-[#2a1a10]">SE BUSCA</p>
      <p className="mt-0.5 text-center text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: raro.color }}>
        ✦ carta {nombreDeRareza(rareza)} ✦
      </p>

      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onVer} className="w-[42%] shrink-0 active:scale-95" title="Verla en 3D">
          <GameCard card={card} owned pill={null} />
          <span className="mt-1 block text-center text-[11px] font-bold uppercase tracking-wider text-[#5b3a1c]">
            <Icono nombre="cartas" /> ver en 3D
          </span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-west text-[20px] leading-[1.05] text-[#2a1a10]">{card.name}</p>

          {/* La mision */}
          <div className="mt-2 rounded-lg border-2 border-dashed border-[#2a1a10]/40 bg-[#2a1a10]/5 px-2 py-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7a2d0c]">La misión</p>
            <p className="text-[15px] font-bold leading-tight text-[#2a1a10]">
              <span className="text-lg">{incursion.reto.icon}</span> {incursion.reto.label}
            </p>
            <p className="text-[12px] leading-snug text-[#5b3a1c]">{incursion.reto.nota}</p>
          </div>

          {/* El precio */}
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#7a2d0c]">El precio</p>
          <div className="mt-0.5 space-y-1">
            {incursion.coste.map((parte) => {
              const info = caracteristicaInfo(parte.stat)
              const tienes = Math.round(player.caracteristicas[parte.stat])
              const ok = tienes >= parte.cantidad
              return (
                <div key={parte.stat} className="text-[13px] leading-none text-[#2a1a10]">
                  <p className="flex items-center justify-between gap-1">
                    <span className="truncate font-bold">
                      <Icono nombre={parte.stat} style={{ color: info.color }} /> {parte.cantidad} {info.label}
                    </span>
                    <span className={`shrink-0 text-[12px] font-black ${ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {ok ? '✔' : `faltan ${Math.ceil(parte.cantidad - tienes)}`}
                    </span>
                  </p>
                  {/* Lo que tienes contra lo que piden: la raya negra es el precio */}
                  <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-[#2a1a10]/15">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.min(100, tienes)}%`, background: ok ? '#16a34a' : '#e11d48' }}
                    />
                    <span className="absolute inset-y-0 w-[2px] bg-[#2a1a10]" style={{ left: `${Math.min(99, parte.cantidad)}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Lo que llevas de la carta */}
      {llevo > 0 && !tuya && (
        <div className="mt-2.5">
          <p className="flex justify-between text-[12px] font-bold text-[#5b3a1c]">
            <span>Llevas de la carta</span>
            <span>{Math.round(llevo)}%</span>
          </p>
          <div className="mt-0.5 h-2.5 overflow-hidden rounded-full border border-[#2a1a10]/50 bg-white/40">
            <div className="cartel-progreso h-full rounded-full" style={{ width: `${llevo}%`, background: raro.color }} />
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!llega}
        onClick={onJugar}
        className={`mt-2.5 w-full text-[15px] ${llega ? 'boton' : 'boton boton-fantasma opacity-60'}`}
      >
        {llega ? (
          <>
            <Icono nombre="partida" /> {tuya ? 'Ir otra vez' : 'Aceptar el encargo'}
          </>
        ) : (
          <>
            <Icono nombre="candado" /> Entrena para pagarlo
          </>
        )}
      </button>

      {/* Los sellos: ya es tuya o te falta para entrar */}
      {tuya && <span className="cartel-sello border-emerald-700 text-emerald-700">Capturada</span>}
      {!tuya && !llega && <span className="cartel-sello border-rose-700 text-rose-700">Sin fondos</span>}
    </article>
  )
}

/** Lo que se juega: una partida libre, un entrenamiento, una incursión o una de rango. */
export interface Mision {
  tipo: 'libre' | 'entreno' | 'incursion' | 'rango'
  stat?: Caracteristica
  incursion?: Incursion
}

/** "2 h 14 min" o "14 min" o "34 s". */
export function espera(ms: number): string {
  const segundos = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  if (horas > 0) return `${horas} h ${minutos} min`
  if (minutos > 0) return `${minutos} min`
  return `${segundos} s`
}

/** Cuantas cartas de cada rareza tienes (para la cabecera). */
export function resumenDeRarezas(unlocked: string[], cards: { id: string; rarity?: string }[]): string {
  return RARITIES.map((raro) => {
    const total = cards.filter((card) => card.rarity === raro.id).length
    const mias = cards.filter((card) => card.rarity === raro.id && unlocked.includes(card.id)).length
    return `${raro.label[0]} ${mias}/${total}`
  }).join(' · ')
}

/** El nombre del tipo de tirador, por si hace falta fuera. */
export function nombreDeTipo(id: string | undefined): string {
  return id ? arquetipoInfo(id as never).label : 'Sin tipo'
}

/** La rareza en singular, para escribir "carta épica" y no "carta épicas". */
function nombreDeRareza(raro: string): string {
  const nombres: Record<string, string> = { normal: 'normal', especial: 'especial', epica: 'épica', divina: 'divina' }
  return nombres[raro] ?? raro
}
