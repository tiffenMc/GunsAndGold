import { useState } from 'react'
import type { ReactNode } from 'react'
import { arquetipoInfo } from '../cards/arquetipos'
import type { Arquetipo } from '../cards/arquetipos'
import type { CardDef } from '../cards/model'
import { rarityInfo, rarityOf } from '../cards/model'
import { Exhibicion } from '../battle/Exhibicion'
import { Galeria } from '../battle/Galeria'
import { CardViewer } from '../card3d/CardViewer'
import { SafeCanvas } from '../SafeCanvas'
import { CardStats } from './CardTile'

type Vista = 'carta' | 'probar'

/**
 * La ficha de una carta. A la izquierda (arriba en el movil) hay dos vistas que se cambian con una
 * pestana:
 *  - **Carta**: la carta 3D de siempre, con su muñeco o su arma dentro de la vitrina (se gira, se
 *    voltea y se sacude).
 *  - **Probar**: el campo de pruebas, con zoom (el arma la disparas tu; el vaquero sale a pelear).
 * A la derecha, su nombre, su rareza y todas sus estadisticas. Quien la abre decide que botones
 * van debajo: meterla en la baraja, sacarla, cerrar…
 */
export function CardSheet({
  card,
  locked = false,
  arquetipo,
  nivel = 0,
  onClose,
  children,
}: {
  card: CardDef
  /** Sin desbloquear: solo el candado, nada de la carta. */
  locked?: boolean
  /** El tipo de tirador que le toco a tu copia (se sortea al conseguirla). */
  arquetipo?: Arquetipo
  /** El nivel que llevas (1-10). */
  nivel?: number
  onClose: () => void
  /** Los botones de abajo. */
  children?: ReactNode
}) {
  const rarity = rarityInfo(rarityOf(card))
  const [vista, setVista] = useState<Vista>('carta')
  /** En «Verlo pelear»: como atacante o plantada de torre. */
  const [comoTorre, setComoTorre] = useState(false)
  const pestana = (id: Vista, texto: string) => (
    <button
      type="button"
      onClick={() => setVista(id)}
      className={`flex-1 rounded-lg border-2 px-3 py-2 text-[15px] font-bold uppercase tracking-wider transition active:scale-95 ${
        vista === id ? 'border-amber-300 bg-amber-400 text-amber-950' : 'border-amber-900/60 bg-black/40 text-amber-100/80'
      }`}
    >
      {texto}
    </button>
  )
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 md:items-center md:p-6" onClick={onClose}>
      <div
        className="max-h-[94%] w-full max-w-[1000px] overflow-y-auto overscroll-contain rounded-t-3xl border-2 bg-[#1b1108] p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.6)] md:rounded-3xl md:p-4"
        style={{ borderColor: rarity.color }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cerrar, arriba y a mano: no hay que buscar nada */}
        <div className="sticky -top-3 z-20 -mx-3 mb-2 flex items-center justify-between gap-2 border-b border-amber-900/40 bg-[#1b1108]/95 px-3 py-2 md:-top-4 md:-mx-4 md:px-4">
          <span className="truncate font-west text-[18px] leading-none text-amber-100">{card.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border-2 border-amber-300/50 bg-black/40 px-3 py-1.5 text-[14px] font-bold text-amber-100 active:scale-95"
          >
            ✕ Cerrar
          </button>
        </div>
        {locked ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-5xl">🔒</span>
            <p className="font-west text-xl text-zinc-200">Todavía no la tienes</p>
            <p className="max-w-[300px] text-[14px] leading-snug text-zinc-400">
              Sigue en el cartel de "Se busca". Cada partida que ganes desbloquea una de las que te
              faltan.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {pestana('carta', '🃏 Carta')}
                {pestana('probar', card.kind === 'arma' ? '🎯 Probar el arma' : '🎯 Verlo pelear')}
              </div>
              <SafeCanvas note="La vista 3D no está disponible en este dispositivo.">
                {vista === 'carta' ? (
                  <CardViewer
                    card={card}
                    sacudir={card.kind === 'batalla'}
                    className="h-[56vh] max-h-[640px] min-h-[340px] w-full rounded-2xl border border-amber-900/50 bg-[#24150a]"
                  />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {card.kind === 'batalla' && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {([false, true] as const).map((torre) => (
                          <button
                            key={String(torre)}
                            type="button"
                            onClick={() => setComoTorre(torre)}
                            className={`rounded-lg border-2 px-2 py-1.5 text-[14px] font-bold active:scale-95 ${
                              comoTorre === torre
                                ? torre
                                  ? 'border-slate-200 bg-slate-500/40 text-white'
                                  : 'border-amber-200 bg-amber-500/40 text-white'
                                : 'border-amber-900/50 bg-black/30 text-amber-100/70'
                            }`}
                          >
                            {torre ? '🏰 Como torre (defiende)' : '⚔️ Como atacante'}
                          </button>
                        ))}
                      </div>
                    )}
                    {card.kind === 'batalla' ? (
                      // El muñeco: su exhibición de cine (oleadas, cámara lenta…).
                      <Exhibicion
                        key={`${card.id}-${comoTorre ? 'torre' : 'ataque'}`}
                        card={card}
                        torre={comoTorre}
                        className="h-[52vh] max-h-[600px] min-h-[320px] w-full"
                      />
                    ) : (
                      <Galeria key={card.id} card={card} className="h-[52vh] max-h-[600px] min-h-[320px] w-full" />
                    )}
                  </div>
                )}
              </SafeCanvas>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-west text-3xl leading-none text-amber-50">{card.name}</p>
                <span
                  className="rounded-full px-2 py-0.5 text-[13px] font-bold uppercase tracking-wider"
                  style={{ background: `${rarity.color}33`, color: rarity.color }}
                >
                  {rarity.label}
                </span>
              </div>
              {arquetipo && (
                <p className="rounded-lg border border-amber-900/40 bg-black/30 px-2 py-1 text-[14px] leading-snug">
                  <b style={{ color: arquetipoInfo(arquetipo).color }}>{arquetipoInfo(arquetipo).label}</b>
                  <span className="text-amber-200/70"> · {arquetipoInfo(arquetipo).note}</span>
                  {nivel > 0 && <span className="text-amber-200/70"> · Nivel {nivel} (solo cambia el aspecto)</span>}
                </p>
              )}
              <CardStats card={card} torre={comoTorre} onTorre={setComoTorre} />
              {children}
            </div>
          </div>
        )}
        {locked && children}
      </div>
    </div>
  )
}
