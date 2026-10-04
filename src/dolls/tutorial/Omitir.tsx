import { useEffect, useRef, useState } from 'react'
import { Icono } from '../Icono'

/** Lo que hay que dejar pulsado el boton para saltarse el tutorial. */
const MANTENER_MS = 1300

/**
 * **Omitir el tutorial**: no vale un toque (que se escapa sin querer), hay que **dejarlo pulsado**.
 * La barra se va llenando mientras aprietas; si sueltas antes, vuelve a cero.
 */
export function Omitir({ onOmitir }: { onOmitir: () => void }) {
  const [lleno, setLleno] = useState(0)
  const desde = useRef<number | null>(null)
  const raf = useRef(0)
  /** El que manda es el reloj (la barra va con los fotogramas, que pueden ir a saltos). */
  const reloj = useRef(0)
  const onOmitirRef = useRef(onOmitir)
  onOmitirRef.current = onOmitir

  const parar = () => {
    desde.current = null
    cancelAnimationFrame(raf.current)
    window.clearTimeout(reloj.current)
    setLleno(0)
  }
  const empezar = () => {
    desde.current = performance.now()
    reloj.current = window.setTimeout(() => {
      desde.current = null
      cancelAnimationFrame(raf.current)
      onOmitirRef.current()
    }, MANTENER_MS)
    const vuelta = () => {
      if (desde.current === null) return
      setLleno(Math.min(1, (performance.now() - desde.current) / MANTENER_MS))
      raf.current = requestAnimationFrame(vuelta)
    }
    raf.current = requestAnimationFrame(vuelta)
  }
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      window.clearTimeout(reloj.current)
    },
    [],
  )

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.stopPropagation()
        empezar()
      }}
      onPointerUp={parar}
      onPointerLeave={parar}
      onPointerCancel={parar}
      onContextMenu={(event) => event.preventDefault()}
      className="pointer-events-auto relative select-none overflow-hidden rounded-full border border-amber-200/40 bg-black/70 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider text-amber-100/90"
      style={{ touchAction: 'none', WebkitUserSelect: 'none' }}
    >
      <span className="absolute inset-y-0 left-0 bg-amber-400/45" style={{ width: `${lleno * 100}%` }} />
      <span className="relative"><Icono nombre="omitir" /> {lleno > 0 ? 'Sigue pulsando…' : 'Mantén pulsado para omitir'}</span>
    </button>
  )
}
