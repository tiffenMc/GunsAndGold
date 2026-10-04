/**
 * **El logo de Guns and Gold**: entra de golpe, se queda flotando con un brillo dorado detrás y,
 * de vez en cuando, le pasa un destello. Con `rayos`, además giran despacio unos rayos de sol
 * detrás, como si el logo fuera el sol del atardecer del fondo.
 */
export function Logo({
  ancho = 300,
  className = '',
  rayos = false,
}: {
  ancho?: number | string
  className?: string
  rayos?: boolean
}) {
  return (
    <div className={`logo-gg relative mx-auto ${className}`} style={{ width: ancho, maxWidth: '100%' }}>
      {rayos && <div className="logo-gg-rayos pointer-events-none absolute -inset-[45%] rounded-full" />}
      {/* El resplandor del sol de detrás */}
      <div className="logo-gg-halo pointer-events-none absolute inset-[8%] rounded-full" />
      <img
        src={`${import.meta.env.BASE_URL}logo.webp`}
        alt="Guns and Gold"
        draggable={false}
        className="logo-gg-img relative block w-full select-none"
      />
    </div>
  )
}
