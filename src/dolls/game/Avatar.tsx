import { gameCards } from '../cards/store'
import { usePortrait } from '../card3d/portraits'
import type { CardDef } from '../cards/model'

/** Tu retrato: el muñeco de la carta que elijas, en su cartel. */
export function Avatar({ card, size = 96 }: { card: CardDef | undefined; size?: number }) {
  const portrait = usePortrait(card ?? gameCards()[0]!)
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-lg border-2 border-[#5a3a1e] bg-gradient-to-b from-[#f3e2b8] to-[#d8bd86]"
      style={{ width: size, height: size * 1.15 }}
    >
      {portrait ? (
        <img src={portrait} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-4xl">🤠</span>
      )}
    </div>
  )
}
