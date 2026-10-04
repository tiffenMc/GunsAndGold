import { previewMusic } from '../battle/music'
import { Icono } from '../Icono'
import { sfx } from '../battle/sfx'
import { activarCartas3d, useCartas3d } from '../ajustes/cartas3d'
import { setVolume, useVolumes } from './volumes'
import { useEscalaPc } from '../escalaPc'
import { WesternGear } from './WesternGear'

/**
 * Los ajustes del juego, en un modal. De momento solo el sonido: los efectos y la musica de fondo,
 * cada uno con su barra, y al soltarla se oye una prueba con el volumen que acabas de poner.
 */
export function SettingsModal({
  onClose,
  onSalir,
  onTutorial,
}: {
  onClose: () => void
  onSalir: () => void
  /** Volver a ver el tutorial desde el principio. */
  onTutorial?: () => void
}) {
  const volumes = useVolumes()
  const escala = useEscalaPc()
  /** Cómo se ven las cartas (se guarda solo, en este dispositivo). */
  const en3d = useCartas3d()

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="panel-wood w-full max-w-sm space-y-4 p-5"
        style={escala > 1 ? { zoom: escala } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <WesternGear className="h-8 w-8" />
          <p className="font-west text-2xl leading-none text-amber-50">Ajustes</p>
        </div>

        {/* La cuenta: desde aquí también se sale */}
        <div className="rounded-xl border border-amber-900/50 bg-black/25 p-2.5">
          <p className="mb-2 text-[13px] uppercase tracking-[0.25em] text-amber-200/60">Cuenta</p>
          <button
            type="button"
            onClick={() => {
              onSalir()
              onClose()
            }}
            className="btn-ghost w-full border-rose-400/50 text-[14px] text-rose-100"
          >
            <Icono nombre="salir" /> Cerrar sesión
          </button>
          <p className="mt-1.5 text-[12px] leading-snug text-amber-200/60">
            Se sale de la cuenta en este dispositivo. Tus cartas, barajas y monedas se quedan guardadas para cuando
            vuelvas a entrar.
          </p>
        </div>

        {onTutorial && (
          <button
            type="button"
            onClick={() => {
              onClose()
              onTutorial()
            }}
            className="btn-ghost w-full text-[14px]"
          >
            <Icono nombre="tutorial" /> Ver el tutorial otra vez
          </button>
        )}

        {/* Las cartas: de dos formas y solo dos */}
        <div className="rounded-xl border border-amber-900/50 bg-black/25 p-2.5">
          <p className="mb-2 text-[13px] uppercase tracking-[0.25em] text-amber-200/60">Cómo se ven las cartas</p>
          <button
            type="button"
            onClick={() => {
              activarCartas3d(!en3d)
            }}
            className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2 text-left text-[14px] ${
              en3d ? 'border-amber-300 bg-amber-400/20 text-amber-50' : 'border-amber-900/60 bg-black/30 text-amber-200/80'
            }`}
          >
            <span>
              <b>Cartas en 3D</b>
              <span className="block text-[12px] leading-snug text-amber-200/60">
                {en3d ? 'Con su modelo 3D (puede ir más lento en móviles viejos)' : 'La carta de siempre, con su retrato y su marco'}
              </span>
            </span>
            <span className="ml-2 shrink-0 text-[18px]">{en3d ? '🔘' : '⚪'}</span>
          </button>
          <p className="mt-1.5 text-[12px] leading-snug text-amber-200/60">
            Se queda guardado en este dispositivo: siempre se verán así hasta que lo cambies.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[13px] uppercase tracking-[0.25em] text-amber-200/60">Sonido</p>
          <div className="space-y-2">
            <Barra
              label="Efectos de sonido"
              icono="🔫"
              valor={volumes.efectos}
              onChange={(valor) => setVolume('efectos', valor)}
              onSuelta={() => sfx.shot()}
            />
            <Barra
              label="Música de fondo"
              icono="🎵"
              valor={volumes.musica}
              onChange={(valor) => setVolume('musica', valor)}
              onSuelta={() => previewMusic()}
            />
          </div>
          <p className="mt-2 text-[12px] leading-snug text-amber-200/50">
            La música suena durante las partidas. Al soltar la barra oyes una prueba con el volumen que
            has puesto.
          </p>
        </div>

        <button type="button" onClick={onClose} className="btn-gold w-full">
          Cerrar
        </button>
      </div>
    </div>
  )
}

/** Una barra de volumen con su nombre, su icono y el tanto por ciento. */
function Barra({
  label,
  icono,
  valor,
  onChange,
  onSuelta,
}: {
  label: string
  icono: string
  valor: number
  onChange: (valor: number) => void
  /** Al soltar la barra: para oir como suena. */
  onSuelta: () => void
}) {
  const tanto = Math.round(valor * 100)
  return (
    <div className="rounded-xl border border-amber-900/50 bg-black/30 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] text-amber-50">
          <span aria-hidden="true">{icono}</span> {label}
        </span>
        <span className="font-mono text-[13px] text-amber-200/80">{tanto}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={tanto}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onSuelta}
        onKeyUp={onSuelta}
        className="slider-oeste mt-2 w-full"
        aria-label={label}
      />
    </div>
  )
}
