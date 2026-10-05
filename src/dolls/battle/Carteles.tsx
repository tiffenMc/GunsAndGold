import type { CardDef } from '../cards/model'
import { TINTA, papelDe } from './papeles'
import type { PapelInfo } from './papeles'

/**
 * **Lo que dice qué es cada carta en la batalla**: el icono de su papel y la chapa de cada carta
 * de la mano (en el campo no hay carteles: cada muñeco se reconoce por cómo se mueve y pega).
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
