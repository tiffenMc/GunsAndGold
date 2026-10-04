import { useState } from 'react'
import { claseInfo } from './clases'
import { levelOf } from './players'
import type { Player } from './players'

/** La palabra que hay que escribir para borrar un personaje: si la escribe, es que quiere borrarlo. */
export const PALABRA_DE_BORRADO = 'Delete'

/**
 * El aviso para **borrar un personaje**: se pierde todo (cartas, sobres, nivel y monedas), asi que
 * no basta con pulsar un boton: hay que escribir `Delete` en el cuadro y solo entonces se activa.
 */
export function BorrarPersonaje({
  personaje,
  onCancelar,
  onBorrar,
}: {
  personaje: Player
  onCancelar: () => void
  onBorrar: () => void
}) {
  const [texto, setTexto] = useState('')
  const info = claseInfo(personaje.clase)
  const listo = texto === PALABRA_DE_BORRADO

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
      <div className="panel w-full max-w-sm space-y-3 border-2 border-rose-500/70 p-5">
        <div className="text-center">
          <p className="text-4xl">⚠️</p>
          <p className="font-west text-2xl leading-none text-rose-100">¿Borrar a {personaje.name}?</p>
        </div>
        <div className="rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-[14px] leading-snug text-rose-50">
          <p>
            <b>
              {info.icon} {personaje.clase === 'todas' ? 'Todas las clases' : info.singular}
            </b>{' '}
            · nivel {levelOf(personaje).level}
          </p>
          <p className="mt-1">
            Se pierde <b>todo su progreso</b>: sus {personaje.unlocked.length} cartas, sus barajas, sus sobres, sus{' '}
            {personaje.monedas} monedas y sus {personaje.won} victorias. <b>No se puede deshacer.</b>
          </p>
        </div>
        <div>
          <p className="mb-1 text-[14px] text-amber-100">
            Para confirmar, escribe <b className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-rose-200">{PALABRA_DE_BORRADO}</b> aquí:
          </p>
          <input
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder={PALABRA_DE_BORRADO}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-rose-300/40 bg-black/50 px-3 py-2 font-mono text-lg text-amber-50 outline-none placeholder:text-amber-100/25 focus:border-rose-300"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className="btn-primary flex-1">
            No, me quedo
          </button>
          <button
            type="button"
            disabled={!listo}
            onClick={onBorrar}
            className={`flex-1 rounded-xl border-2 px-3 py-2 font-bold transition ${
              listo
                ? 'border-rose-300 bg-rose-600 text-white active:scale-95'
                : 'cursor-not-allowed border-rose-900/60 bg-rose-950/40 text-rose-200/40'
            }`}
          >
            Borrar para siempre
          </button>
        </div>
      </div>
    </div>
  )
}
