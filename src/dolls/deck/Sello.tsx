import type { CardDef } from '../cards/model'
import { estiloDe } from '../battle/estilos'
import { SELLOS, selloDe } from '../battle/sellos'
import type { Sello } from '../battle/sellos'

/**
 * **El sello de una carta**, en pequeño (la chapa) y en grande (la ficha): siempre escrito y de su
 * color, sin iconos. Qué es, qué hace de soldado y de torre, contra quién es fuerte y débil, y su variante.
 */

/** La chapa del sello: su nombre escrito, sobre su color (como la franja de arriba de la carta). */
export function SelloChapa({ sello, tam = 'normal', apagada = false }: { sello: Sello; tam?: 'mini' | 'normal'; apagada?: boolean }) {
  const info = SELLOS[sello]
  const mini = tam === 'mini'
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md border-2 border-[#1a0d04] font-west uppercase leading-none text-white ${
        mini ? 'px-1.5 py-[3px] text-[11px]' : 'px-2.5 py-1 text-[14px]'
      }`}
      style={{ background: info.color, opacity: apagada ? 0.4 : 1, textShadow: '0 1px 0 #1a0d04, 1px 0 0 #1a0d04, -1px 0 0 #1a0d04' }}
    >
      <span className="truncate">{info.label}</span>
    </span>
  )
}

export function SelloGrande({ card, torre }: { card: CardDef; torre: boolean }) {
  if (card.kind !== 'batalla') return null
  const info = SELLOS[selloDe(card)]
  const estilo = estiloDe(card)
  return (
    <div className="rounded-xl border-2 p-2.5" style={{ borderColor: info.color, background: `${info.color}14` }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/55">Sello</p>
      <p
        className="mt-0.5 rounded-lg border-2 border-[#1a0d04] py-1 text-center font-west text-[24px] uppercase leading-none text-white"
        style={{ background: info.color, textShadow: '0 2px 0 #1a0d04, 1px 0 0 #1a0d04, -1px 0 0 #1a0d04' }}
      >
        {info.label}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-snug text-amber-100/90">{info.nota}</p>
      <ul className="mt-2 space-y-0.5 text-[12px] leading-snug text-amber-50/90">
        {(torre ? info.torre : info.soldado).map((linea) => (
          <li key={linea} className="flex gap-1.5">
            <span style={{ color: info.color }}>•</span>
            {linea}
          </li>
        ))}
      </ul>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] leading-snug">
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-emerald-100">
          <b className="block text-[10px] uppercase tracking-wider text-emerald-300">Fuerte</b>
          {info.fuerte}
        </p>
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-rose-100">
          <b className="block text-[10px] uppercase tracking-wider text-rose-300">Débil</b>
          {info.debil}
        </p>
      </div>
      <p className="mt-2 rounded-lg bg-black/30 px-2 py-1 text-[12px] leading-snug text-amber-100/85">
        <b className="text-amber-200">Su manera · {estilo.label}:</b> {estilo.nota}
      </p>
    </div>
  )
}
