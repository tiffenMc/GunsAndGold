import { useEffect, useState } from 'react'

/**
 * **La escala de PC**: en una pantalla grande los menús se veían diminutos (están pensados para el
 * móvil). Se agrandan enteros, en proporción al alto de la pantalla, como si se acercara la cámara.
 * En el móvil (o en ventanas pequeñas) no se toca nada.
 */
export function useEscalaPc(): number {
  const calcular = () => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return 1
    const porAlto = window.innerHeight / 780
    const porAncho = window.innerWidth / 1000
    return Math.max(1, Math.min(1.6, porAlto, porAncho))
  }
  const [escala, setEscala] = useState(calcular)
  useEffect(() => {
    const onResize = () => setEscala(calcular())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return escala
}
