import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

/**
 * Red de seguridad para las vistas 3D. Si el dispositivo no puede crear el lienzo (WebGL
 * desactivado, memoria justa, contexto perdido al girar el movil) se pierde solo esa vista:
 * el resto de la pantalla, con sus mandos, sigue funcionando en vez de quedarse en blanco.
 */
export class SafeCanvas extends Component<
  { children: ReactNode; note?: string; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('Vista 3D no disponible:', error.message, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      if (this.props.fallback !== undefined) return this.props.fallback
      // Sin nota no se pinta nada: sirve para los lienzos que trabajan en segundo plano.
      if (this.props.note === '') return null
      return (
        <div className="flex h-full min-h-[120px] w-full items-center justify-center rounded-2xl border border-amber-900/40 bg-black/30 p-3 text-center text-[13px] leading-snug text-amber-200/70">
          {this.props.note ?? 'Vista 3D no disponible en este dispositivo'}
        </div>
      )
    }
    return this.props.children
  }
}
