import { useEffect, useState } from 'react'
import { nombreDeRival } from '../battle/taunts'

/**
 * **Pruebas**: el sitio donde se ensayan formas nuevas de jugar antes de decidir si se quedan. Por
 * ahora tiene una: la **Batalla ÉPICA**, por turnos, sobre un tablero (a lo Warhammer).
 */
export function PruebasScreen({ onVolver, onEmpezar }: { onVolver: () => void; onEmpezar: (rival: string) => void }) {
  const [estado, setEstado] = useState<'menu' | 'buscando' | 'encontrado'>('menu')
  const [rival, setRival] = useState('')
  const [puntos, setPuntos] = useState(0)

  useEffect(() => {
    if (estado !== 'buscando') return
    const nombre = nombreDeRival()
    const pinta = window.setInterval(() => setPuntos((p) => (p + 1) % 4), 380)
    const encuentra = window.setTimeout(() => {
      setRival(nombre)
      setEstado('encontrado')
    }, 2300)
    return () => {
      window.clearInterval(pinta)
      window.clearTimeout(encuentra)
    }
  }, [estado])

  useEffect(() => {
    if (estado !== 'encontrado') return
    const id = window.setTimeout(() => onEmpezar(rival), 1500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, rival])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-amber-900/50 bg-[#1b1108] px-3 py-2">
        <button type="button" onClick={onVolver} className="rounded-lg border border-amber-300/40 px-2.5 py-1.5 text-[14px] text-amber-100">
          ← Pueblo
        </button>
        <div className="flex-1">
          <p className="font-west text-xl leading-none text-amber-100">🧪 Pruebas</p>
          <p className="text-[13px] text-amber-200/60">Formas nuevas de jugar, para ensayar</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="panel-wood space-y-3 p-4">
          <div className="flex items-center gap-3">
            <span className="text-5xl">♟️</span>
            <div>
              <p className="font-west text-[28px] leading-none text-amber-50">Batalla ÉPICA</p>
              <p className="mt-0.5 text-[14px] font-bold text-amber-300">Por turnos, sobre un tablero</p>
            </div>
          </div>

          <ul className="space-y-1.5 text-[14px] leading-snug text-amber-100/90">
            <li>
              📋 <b>Despliegue:</b> colocas tus 4 soldados en tus dos filas de salida, a la vez que el rival y en secreto.
            </li>
            <li>
              ⚔ <b>3 acciones por turno:</b> moverte, atacar o usar la habilidad de la carta. Cada soldado, un movimiento y un ataque. (Quien abre la partida empieza con 2.)
            </li>
            <li>
              🛡 <b>Cobertura</b> (la mitad de daño), <b>flanqueo</b> (dos amigos pegados al blanco: +50 %) y rocas que tapan la vista.
            </li>
            <li>
              🃏 Cada acción puede ser sacar un <b>refuerzo</b>, siempre con 4 vivos como máximo.
            </li>
            <li>
              🏆 Gana quien tumba el fuerte rival, o quien va por delante tras <b>7 rondas</b> (unos 5 minutos).
            </li>
          </ul>

          {estado === 'menu' && (
            <button
              type="button"
              onClick={() => setEstado('buscando')}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-amber-200/80 bg-gradient-to-b from-amber-400 to-amber-700 px-4 py-4 font-west text-[24px] leading-none text-amber-950 shadow-[0_0_26px_rgba(224,180,99,0.45)] active:scale-[0.98]"
            >
              🔍 Buscar partida
            </button>
          )}
          {estado === 'buscando' && (
            <div className="rounded-2xl border-2 border-amber-300/50 bg-black/40 px-4 py-5 text-center">
              <p className="animate-pulse font-west text-[22px] leading-none text-amber-100">Buscando rival{'.'.repeat(puntos)}</p>
              <p className="mt-1 text-[13px] text-amber-200/60">Tu baraja, sobre el tablero</p>
            </div>
          )}
          {estado === 'encontrado' && (
            <div className="rounded-2xl border-2 border-emerald-300/60 bg-emerald-500/10 px-4 py-5 text-center">
              <p className="text-[13px] uppercase tracking-[0.2em] text-emerald-200/80">¡Rival encontrado!</p>
              <p className="mt-1 font-west text-[26px] leading-none text-amber-50">{rival}</p>
              <p className="mt-1 text-[13px] text-amber-200/60">Preparando el tablero…</p>
            </div>
          )}
          <p className="text-center text-[12px] leading-snug text-amber-200/50">
            Modo de prueba: no da ni quita monedas. El rival es un bot por ahora.
          </p>
        </div>
      </div>
    </div>
  )
}
