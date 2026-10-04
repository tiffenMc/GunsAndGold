import { useMemo, useState } from 'react'
import { Icono } from '../Icono'
import { movimientoDeDibujo } from '../game/animacionDibujada'
import { players, usePlayer } from '../game/players'
import { EN_LA_TARIMA, porcentajeDeVictorias, ranking } from '../game/ranking'
import type { FichaDeBuscado } from '../game/ranking'
import { PanelDeSitio } from './Zonas'
import { VistaDeMuneco } from './VistaDeMuneco'

/**
 * **Los Más Buscados por dentro**: el cartel grande del que tengas elegido (su muñeco tal cual va
 * vestido, haciendo su animación) con sus números, y la lista de los cinco de la tarima. Si tú no
 * estás entre ellos, abajo se ve en qué puesto vas.
 */

const MEDALLAS = ['#facc15', '#cbd5e1', '#d08b4f', '#a1887f', '#a1887f']

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-[#5a3a1e]/15 px-1 py-1.5 text-center">
      <p className="font-west text-[20px] leading-none text-[#3b2410]">{valor}</p>
      <p className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#6b4a2a]">{etiqueta}</p>
    </div>
  )
}

function Fila({ ficha, elegida, tuya, onClick }: { ficha: FichaDeBuscado; elegida: boolean; tuya: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border-2 px-2.5 py-2 text-left active:scale-[0.98] ${
        elegida ? 'border-amber-300 bg-amber-300/15' : 'border-amber-900/60 bg-black/30'
      }`}
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-black/60 font-west text-[18px] text-[#1a0f06]"
        style={{ background: MEDALLAS[ficha.puesto - 1] ?? '#6b4423' }}
      >
        {ficha.puesto}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-west text-[17px] leading-none text-amber-50">
          {ficha.nombre} {tuya && <span className="text-[12px] text-emerald-300">(tú)</span>}
        </span>
        <span className="mt-1 block text-[11.5px] font-bold leading-none" style={{ color: ficha.rango.color }}>
          {ficha.rango.icon} {ficha.rango.label}
        </span>
      </span>
      <span className="shrink-0 text-right font-west text-[16px] text-amber-200">
        {ficha.monedas} <Icono nombre="monedas" />
      </span>
    </button>
  )
}

export function BuscadosPanel({ onSalir, onJugar }: { onSalir: () => void; onJugar: () => void }) {
  const yo = usePlayer()
  const lista = useMemo(() => ranking(players()), [yo])
  const tarima = lista.slice(0, EN_LA_TARIMA)
  const mia = lista.find((ficha) => ficha.id === yo.id)
  const [elegida, setElegida] = useState<string | null>(tarima[0]?.id ?? null)
  const ficha = lista.find((f) => f.id === elegida) ?? tarima[0]
  const motion = useMemo(() => (ficha?.animacion ? movimientoDeDibujo(ficha.animacion, true) : null), [ficha?.animacion])

  return (
    <PanelDeSitio
      titulo="Los Más Buscados"
      lema="Los cinco mejores del Oeste: su cara está en todos los carteles"
      icono="ranking"
      color="#facc15"
      onSalir={onSalir}
      fondo="linear-gradient(180deg, #3a2a10 0%, #1a0f06 100%)"
      ancho={1000}
    >
      <div className="mx-auto h-full w-full max-w-[1000px] overflow-y-auto p-3 md:flex md:gap-4">
        {ficha ? (
          // El cartel grande del elegido.
          <section className="papel mx-auto w-full max-w-[400px] shrink-0 p-3 md:mx-0">
            <p className="text-center font-west text-[34px] leading-none">SE BUSCA</p>
            <p className="text-center text-[11px] font-bold tracking-[0.25em] text-[#7a2d0c]">VIVO O MUERTO · Nº{ficha.puesto}</p>
            <div className="mt-2 h-[260px] overflow-hidden rounded-xl border-2 border-[#2a1a10]">
              <VistaDeMuneco look={ficha.look} motion={motion} fondo="radial-gradient(ellipse at 50% 30%, #e9d3a0 0%, #b98f55 80%)" />
            </div>
            <p className="mt-2 text-center font-west text-[28px] leading-none">{ficha.nombre}</p>
            <p className="mt-1 text-center text-[13px] font-bold" style={{ color: ficha.rango.color, textShadow: '0 1px 0 #2a1a10' }}>
              {ficha.rango.icon} {ficha.rango.label}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Dato etiqueta="Monedas" valor={String(ficha.monedas)} />
              <Dato etiqueta="Partidas" valor={String(ficha.partidas)} />
              <Dato etiqueta="Victorias" valor={`${porcentajeDeVictorias(ficha)}%`} />
              <Dato etiqueta="Ganadas" valor={String(ficha.victorias)} />
              <Dato etiqueta="Mejor racha" valor={String(ficha.mejorRacha)} />
              <Dato etiqueta="Perdidas" valor={String(ficha.partidas - ficha.victorias)} />
            </div>
            {ficha.animacion && <p className="mt-2 text-center text-[12px] text-[#5b3a1c]">Su floritura: «{ficha.animacion.nombre}»</p>}
          </section>
        ) : (
          <section className="papel mx-auto w-full max-w-[400px] p-4 text-center md:mx-0">
            <p className="font-west text-[34px] leading-none">SE BUSCA</p>
            <p className="mt-3 font-west text-[22px]">¿Tú?</p>
            <p className="mt-2 text-[14px] leading-snug text-[#5b3a1c]">
              Aún no hay nadie en la tarima. Juega una partida de rango en El Fuerte (en el desierto) y tu vaquero será el primero en salir en los carteles.
            </p>
          </section>
        )}

        <section className="mt-3 min-w-0 flex-1 space-y-2 md:mt-0">
          <p className="font-west text-[18px] text-amber-100">La tarima de la plaza</p>
          {tarima.map((f) => (
            <Fila key={f.id} ficha={f} tuya={f.id === yo.id} elegida={f.id === ficha?.id} onClick={() => setElegida(f.id)} />
          ))}
          {Array.from({ length: EN_LA_TARIMA - tarima.length }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-amber-900/60 px-2.5 py-2 text-amber-100/50">
              <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-amber-900/60 font-west">{tarima.length + i + 1}</span>
              Sitio libre: se busca candidato
            </div>
          ))}

          <div className="rounded-xl border-2 border-amber-900/60 bg-black/35 p-3 text-[13px] text-amber-100/85">
            {yo.admin ? (
              <p>El ADMIN no sale en el ranking (lo tiene todo: no sería justo). Entra con un personaje para competir.</p>
            ) : mia && mia.puesto <= EN_LA_TARIMA ? (
              <p>
                ¡Estás en la tarima, en el puesto <b>{mia.puesto}</b>! Todo el que pase por la plaza verá tu vaquero.
              </p>
            ) : mia ? (
              <p>
                Vas el <b>{mia.puesto}º</b>. Te faltan <b>{Math.max(1, (tarima[EN_LA_TARIMA - 1]?.monedas ?? 0) - mia.monedas + 1)}</b> monedas para subir a la tarima.
              </p>
            ) : (
              <p>Aún no has jugado ninguna partida de rango. Juega una y entrarás en la lista.</p>
            )}
            <p className="mt-1.5 text-[12px] text-amber-200/60">
              Manda el rango (las monedas de las partidas de rango). Por ahora la lista es de los personajes de este dispositivo; cuando el juego
              tenga servidor, saldrán los mejores de todo el mundo.
            </p>
            {!yo.admin && (
              <button type="button" onClick={onJugar} className="boton mt-2 w-full text-[14px]">
                <Icono nombre="partida" /> Ir al Fuerte a jugar de rango
              </button>
            )}
          </div>
        </section>
      </div>
    </PanelDeSitio>
  )
}
