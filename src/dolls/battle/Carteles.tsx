import type { CardDef } from '../cards/model'
import { selloDe } from './sellos'
import { SelloChapa } from '../deck/Sello'

/**
 * **Lo que dice qué es cada carta en la batalla**: la chapa de su sello en cada carta de la mano
 * (en el campo no hay carteles: cada muñeco se reconoce por cómo se mueve y pega).
 */

/** La chapa de una carta de la mano: su sello, para saber por qué sacarla. */
export function ChapaDeLaMano({ card, left, top, width, apagada }: { card: CardDef; left: number; top: number; width: number; apagada: boolean }) {
  if (card.kind !== 'batalla') return null
  return (
    <div className="pointer-events-none absolute z-[12] flex justify-center" style={{ left, top, width }}>
      <SelloChapa sello={selloDe(card)} tam="mini" apagada={apagada} />
    </div>
  )
}
