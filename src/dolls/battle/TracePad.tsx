import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { drawPatternGlyph } from '../card3d/cardArt'
import type { Pt } from '../cards/patterns'
import { PASILLO, distanciaAlCamino, traceAccuracy } from '../cards/patterns'
import { capturePointer } from '../debugClock'

/**
 * El cuadro donde dibujas el patron de la carta. La guia se dibuja sola despacio y se queda
 * marcada flojita; tu trazo encima. Al levantar el dedo, sale la carta con la calidad que toque.
 */
export function TracePad({
  points,
  color,
  title,
  size,
  onDone,
}: {
  points: Pt[]
  color: string
  title: string
  size: number
  onDone: (accuracy: number) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawn = useRef<Pt[]>([])
  const drawing = useRef(false)
  const finished = useRef(false)
  const started = useRef(performance.now())
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    started.current = performance.now()
    drawn.current = []
    finished.current = false
    let raf = 0
    const loop = () => {
      const el = canvas.current
      const ctx = el?.getContext('2d')
      if (el && ctx) {
        const dpr = window.devicePixelRatio || 1
        const w = Math.round(el.clientWidth * dpr)
        const h = Math.round(el.clientHeight * dpr)
        if (el.width !== w || el.height !== h) {
          el.width = w
          el.height = h
        }
        ctx.clearRect(0, 0, w, h)
        const reveal = Math.min(1, (performance.now() - started.current) / 700)
        const cut = Math.max(2, Math.ceil(points.length * reveal))
        const shown = reveal < 1 ? points.slice(0, cut) : points
        // El pasillo: un camino ancho y suave por donde hay que pasar (lo que cae dentro, cuenta perfecto).
        ctx.globalAlpha = 0.22
        drawPatternGlyph(ctx, shown, 0, 0, w, color, w * PASILLO * 2)
        ctx.globalAlpha = drawn.current.length > 1 ? 0.5 : 0.85
        drawPatternGlyph(ctx, shown, 0, 0, w, color, w * 0.025)
        ctx.globalAlpha = 1
        // Punto de salida, latiendo.
        const start = points[0]
        if (start && drawn.current.length === 0) {
          const pulse = 1 + Math.sin(performance.now() / 140) * 0.25
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 3 * dpr
          ctx.beginPath()
          ctx.arc(start.x * w, start.y * h, w * 0.06 * pulse, 0, Math.PI * 2)
          ctx.stroke()
        }
        if (drawn.current.length > 1) {
          // El trazo cambia de color segun vas: verde dentro del pasillo, ambar si te vas, rojo si te sales.
          const last = drawn.current[drawn.current.length - 1]!
          const error = distanciaAlCamino(points, last)
          const vivo = error <= PASILLO ? '#4ade80' : error <= PASILLO * 2 ? '#fbbf24' : '#f87171'
          drawPatternGlyph(ctx, drawn.current, 0, 0, w, vivo, w * 0.04)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [points, color])

  const toPt = (el: HTMLCanvasElement, cx: number, cy: number): Pt => {
    const rect = el.getBoundingClientRect()
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height }
  }

  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation()
    if (finished.current) return
    drawing.current = true
    drawn.current = [toPt(event.currentTarget, event.clientX, event.clientY)]
    capturePointer(event.currentTarget, event.pointerId)
  }

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation()
    if (!drawing.current) return
    const native = event.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const samples = native.getCoalescedEvents?.() ?? []
    for (const sample of samples.length > 0 ? samples : [native]) {
      const p = toPt(event.currentTarget, sample.clientX, sample.clientY)
      const last = drawn.current[drawn.current.length - 1]
      if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.004) continue
      drawn.current.push(p)
    }
  }

  const up = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation()
    if (!drawing.current || finished.current) return
    drawing.current = false
    // Un toque sin arrastrar no cuenta: se puede volver a intentar.
    if (drawn.current.length < 4) {
      drawn.current = []
      return
    }
    finished.current = true
    onDoneRef.current(traceAccuracy(points, drawn.current))
  }

  return (
    <div
      className="pointer-events-auto rounded-2xl border-2 border-amber-300/70 bg-[#2a1708]/85 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.7)] backdrop-blur-sm"
      style={{ width: size }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <p className="no-select pb-1 text-center font-west text-[15px] leading-none text-amber-100">
        {title}
      </p>
      <canvas
        ref={canvas}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="no-select block aspect-square w-full touch-none rounded-xl bg-black/35"
      />
    </div>
  )
}
