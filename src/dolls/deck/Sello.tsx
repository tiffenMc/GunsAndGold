import type { CardDef } from '../cards/model'
import { estiloDe } from '../battle/estilos'
import { SELLOS, selloDe } from '../battle/sellos'
import type { Sello } from '../battle/sellos'

/**
 * **El sello de una carta**, en pequeño (la chapa) y en grande (la ficha): qué es (tanque, asesino,
 * distancia…), qué hace de soldado y de torre, contra quién es fuerte y débil, y su variante.
 */

/** La chapa del sello: un círculo de su color con su dibujo y su nombre al lado. */
export function SelloChapa({ sello, tam = 'normal', apagada = false }: { sello: Sello; tam?: 'mini' | 'normal'; apagada?: boolean }) {
  const info = SELLOS[sello]
  const mini = tam === 'mini'
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border-2 bg-[#120a04]/92 font-black uppercase leading-none ${
        mini ? 'py-[1px] pl-[1px] pr-1.5 text-[10px]' : 'py-0.5 pl-0.5 pr-2.5 text-[12px] tracking-wide'
      }`}
      style={{ borderColor: info.color, color: info.color, opacity: apagada ? 0.55 : 1 }}
    >
      <span
        className={`grid shrink-0 place-items-center rounded-full ${mini ? 'h-[16px] w-[16px] text-[10px]' : 'h-6 w-6 text-[14px]'}`}
        style={{ background: `${info.color}33`, boxShadow: `inset 0 0 0 1.5px ${info.color}` }}
        aria-hidden
      >
        {info.icono}
      </span>
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
      <div className="flex items-center gap-2">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] text-[24px] shadow-[0_0_14px_rgba(0,0,0,0.5)]"
          style={{ borderColor: info.color, background: `${info.color}2a` }}
          aria-hidden
        >
          {info.icono}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-100/55">Sello</p>
          <p className="font-west text-[22px] leading-none" style={{ color: info.color }}>
            {info.label}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-amber-100/85">{info.nota}</p>
        </div>
      </div>
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
