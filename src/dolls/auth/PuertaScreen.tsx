import { useEffect, useState } from 'react'
import { hayServidor } from '../../lib/servidor'
import { useAuth } from '../../hooks/useAuth'
import { crearCuenta, entrar } from './cuentasLocales'
import { Logo } from '../Logo'

/**
 * La puerta del juego: aquí se entra.
 *
 * Lo más rápido: **usuario y contraseña** y ya está, sin correo ni confirmaciones (la cuenta vive
 * en el servidor del juego, y si no lo hay, en este dispositivo). Si escribes un **correo** (con @), entonces se usa la cuenta de la nube
 * (con su correo de confirmación), y también está el botón de **Google**.
 */
export function PuertaScreen({ onInvitado }: { onInvitado?: () => void }) {
  const auth = useAuth()
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [yendo, setYendo] = useState(false)
  /** Si las cuentas viven en el servidor (el juego publicado) o en este dispositivo. */
  const [conServidor, setConServidor] = useState(false)
  useEffect(() => {
    void hayServidor().then(setConServidor)
  }, [])

  const esCorreo = usuario.includes('@')

  const enviar = async () => {
    if (yendo) return
    setAviso(null)

    if (!esCorreo) {
      // Usuario y contraseña, sin más (en el servidor si lo hay; si no, en este dispositivo).
      setYendo(true)
      const error = modo === 'entrar' ? await entrar(usuario, pass) : await crearCuenta(usuario, pass)
      setYendo(false)
      setAviso(error)
      return
    }

    if (pass.length < 6) {
      setAviso('Con correo, la contraseña necesita 6 letras o más')
      return
    }
    setYendo(true)
    const error = modo === 'entrar' ? await auth.signInWithEmail(usuario, pass) : await auth.signUpWithEmail(usuario, pass)
    setYendo(false)
    if (error) setAviso(error)
    else if (modo === 'crear') setAviso('Cuenta creada: mira el correo para confirmarla y vuelve.')
  }

  return (
    <div className="fondo-oeste relative flex h-full flex-col items-center justify-center gap-3 overflow-y-auto px-5 py-6">
      <div className="relative z-10 w-full max-w-[360px] text-center">
        <Logo ancho="min(310px, 76vw)" rayos />
        <p className="relative -mt-1 text-[13px] font-bold uppercase tracking-[0.35em] text-amber-100" style={{ textShadow: '0 2px 6px #000' }}>Cartas, polvo y plomo</p>
      </div>

      <div className="papel sobre-entra relative z-10 w-full max-w-[360px] p-4">
        <p className="text-center font-west text-[20px] leading-none">SE BUSCA</p>
        <p className="mt-1 text-center text-[13px] text-[#5b3a1c]">
          {modo === 'entrar' ? 'Entra y sigue tu partida' : 'Ponte un usuario y una contraseña y ya estás dentro'}
        </p>

        <div className="mt-3 space-y-2">
          <input
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
            placeholder="Tu usuario (o tu correo)"
            autoComplete="username"
            className="w-full rounded-xl border-2 border-[#5b3a1c]/60 bg-white/70 px-3 py-2 text-[14px] text-[#2a1a10] outline-none placeholder:text-[#5b3a1c]/50 focus:border-[#2a1a10]"
          />
          <input
            value={pass}
            onChange={(event) => setPass(event.target.value)}
            placeholder={esCorreo ? 'Contraseña (6 letras o más)' : 'Contraseña'}
            type="password"
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void enviar()
            }}
            className="w-full rounded-xl border-2 border-[#5b3a1c]/60 bg-white/70 px-3 py-2 text-[14px] text-[#2a1a10] outline-none placeholder:text-[#5b3a1c]/50 focus:border-[#2a1a10]"
          />
        </div>

        <p className="mt-1.5 text-[12px] leading-snug text-[#5b3a1c]/80">
          {esCorreo
            ? 'Con correo se usa la cuenta de la nube (te pedirá confirmarlo).'
            : conServidor
              ? 'Sin arroba y sin correos: entra con tu usuario desde cualquier móvil y sigues donde lo dejaste.'
              : 'Sin arroba: la cuenta se queda en este dispositivo, sin correos ni historias.'}
        </p>

        {aviso && <p className="mt-2 rounded-lg bg-[#2a1a10]/10 px-2 py-1 text-[13px] text-[#5b3a1c]">{aviso}</p>}

        <button type="button" onClick={() => void enviar()} disabled={yendo} className="boton mt-3 w-full">
          {yendo ? 'Abriendo…' : modo === 'entrar' ? '🔑 Entrar' : '🤠 Crear cuenta'}
        </button>

        <div className="my-3 flex items-center gap-2 text-[12px] uppercase tracking-[0.3em] text-[#5b3a1c]/60">
          <span className="h-px flex-1 bg-[#5b3a1c]/30" />o<span className="h-px flex-1 bg-[#5b3a1c]/30" />
        </div>

        <button
          type="button"
          onClick={() => void auth.signInWithGoogle()}
          className="boton boton-fantasma w-full border-[#2a1a10]/40 bg-white/70 text-[#2a1a10]"
        >
          <span className="text-[16px]">🅶</span> Entrar con Google
        </button>

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'entrar' ? 'crear' : 'entrar')
            setAviso(null)
          }}
          className="mt-3 w-full text-center text-[13px] underline decoration-dotted text-[#5b3a1c]"
        >
          {modo === 'entrar' ? 'No tengo cuenta: quiero registrarme' : 'Ya tengo cuenta: quiero entrar'}
        </button>
      </div>

      {/* Solo en desarrollo: para poder mirar el juego sin montar nada. */}
      {onInvitado && (
        <button
          type="button"
          onClick={onInvitado}
          className="relative z-10 text-[13px] underline decoration-dotted text-amber-100/80"
        >
          Seguir como invitado (solo para probar)
        </button>
      )}
    </div>
  )
}
