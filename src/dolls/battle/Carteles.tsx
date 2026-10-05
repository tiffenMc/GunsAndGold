import type { CardDef } from '../cards/model'
import { rarityInfo, rarityOf } from '../cards/model'
import { estiloDe } from './estilos'
import { TINTA, papelDe } from './papeles'
import type { PapelInfo } from './papeles'
import type { Side } from './engine'
import { SIDE_COLOR } from './Field'

/**
 * **Los carteles de la batalla** que dicen qué es cada carta: el icono de su papel, el aviso de la
 * carta que acaba de salir (la tuya y la del rival) y la chapa de cada carta de la mano.
 */

/** El icono de un papel: un círculo de su color con el dibujo en oscuro (y el aro del bando). */
export function IconoPapel({ papel, tam = 28, aro }: { papel: PapelInfo; tam?: number; aro?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="-4 -4 32 32" className="shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="15.2" fill="rgba(6,10,16,0.9)" />
      {aro && <circle cx="12" cy="12" r="13.4" fill={aro} />}
      <circle cx="12" cy="12" r={aro ? 10.8 : 13.4} fill={papel.color} />
      <g transform="translate(3.6 3.6) scale(0.7)" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {papel.trazos.map((t, i) => (
          <path key={i} d={t.d} fill={t.relleno ? TINTA : 'none'} stroke={t.relleno ? 'none' : TINTA} />
        ))}
      </g>
    </svg>
  )
}

export interface Anuncio {
  card: CardDef
  side: Side
  key: number
}

/**
 * El aviso de la carta que acaba de salir: su nombre, su papel y para qué sirve. El del rival sale
 * arriba (en rojo) y el tuyo encima de la mano (en azul): así se sabe siempre qué ha sacado cada uno.
 */
export function CartelDeCarta({ anuncio, top }: { anuncio: Anuncio; top: number }) {
  const { card, side } = anuncio
  if (card.kind !== 'batalla') return null
  const papel = papelDe(card)
  const estilo = estiloDe(card)
  const rareza = rarityOf(card)
  const color = SIDE_COLOR[side]
  const rival = side === 1
  return (
    <div
      key={anuncio.key}
      className={`pointer-events-none absolute z-[18] flex max-w-[78vw] animate-fade-in items-center gap-2 rounded-2xl border-2 bg-[#120a04]/90 py-1 pl-1 pr-3 shadow-lg ${rival ? 'left-2' : 'right-2'}`}
      style={{ top, borderColor: color, boxShadow: `0 0 16px ${color}66` }}
    >
      <IconoPapel papel={papel} tam={40} aro={color} />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="rounded px-1 text-[10px] font-black uppercase tracking-wider text-white" style={{ background: color }}>
            {rival ? 'Rival' : 'Tú'}
          </span>
          <span
            className="truncate font-west text-[15px] text-amber-50"
            style={{ color: rareza === 'normal' ? undefined : rarityInfo(rareza).color, textShadow: '0 1px 0 #1a0d04' }}
          >
            {card.name}
          </span>
        </div>
        <div className="truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: papel.color }}>
          {papel.label}
          {estilo.label.toLowerCase() !== card.name.toLowerCase() && estilo.label.toLowerCase() !== papel.label.toLowerCase() ? ` · ${estilo.label}` : ''}
        </div>
        <div className="truncate text-[11px] text-amber-100/85">{papel.paraQue}</div>
      </div>
    </div>
  )
}

/** La chapa de una carta de la mano: su papel, para saber por qué sacarla. */
export function ChapaDeLaMano({ card, left, top, width, apagada }: { card: CardDef; left: number; top: number; width: number; apagada: boolean }) {
  if (card.kind !== 'batalla') return null
  const papel = papelDe(card)
  return (
    <div className="pointer-events-none absolute z-[12] flex justify-center" style={{ left, top, width, opacity: apagada ? 0.55 : 1 }}>
      <span
        className="flex max-w-full items-center gap-1 rounded-full border bg-[#120a04]/90 py-[1px] pl-[1px] pr-1.5 text-[10px] font-black uppercase leading-none"
        style={{ borderColor: papel.color, color: papel.color }}
      >
        <IconoPapel papel={papel} tam={17} />
        <span className="truncate">{papel.corto}</span>
      </span>
    </div>
  )
}
