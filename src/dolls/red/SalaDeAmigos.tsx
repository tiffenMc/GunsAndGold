import { useEffect, useRef, useState } from 'react'
import { Icono } from '../Icono'
import { abrirSala } from './sala'
import type { EstadoSala, Rol, Sala } from './sala'

/** Lo que hace falta para empezar la partida con el amigo. */
export interface PartidaConAmigo {
  sala: Sala
  rol: Rol
  /** Tu baraja, tal cual se la mandaste al amigo (la partida usa exactamente esta). */
  miMazo: string[]
  rival: { nombre: string; mazo: string[] }
  escenario: string
}

/** Un codigo de sala de 6 letras (sin las que se confunden: 0/O, 1/I). */
export function codigoNuevo(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let salida = ''
  for (let i = 0; i < 6; i++) salida += letras[Math.floor(Math.random() * letras.length)]
  return salida
}

/**
 * **La sala para jugar con un amigo.** Uno la crea (y le pasa el codigo y el enlace) y el otro entra
 * con el codigo. Al juntarse, se presentan (nombre y baraja) y arranca la partida: el que la creo
 * la lleva en su ordenador y el otro la ve y juega desde el suyo.
 */
export function SalaDeAmigos({
  modo,
  nombre,
  mazo,
  escenario,
  onCerrar,
  onEmpezar,
}: {
  modo: 'crear' | 'unirse'
  nombre: string
  mazo: string[]
  /** El escenario que pone el que crea la sala. */
  escenario: string
  onCerrar: () => void
  onEmpezar: (partida: PartidaConAmigo) => void
}) {
  const [codigo] = useState(codigoNuevo)
  const [entrada, setEntrada] = useState('')
  const [sala, setSala] = useState<Sala | null>(null)
  const [estado, setEstado] = useState<EstadoSala | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const empezada = useRef(false)
  const datos = useRef({ nombre, mazo, escenario, onEmpezar })
  datos.current = { nombre, mazo, escenario, onEmpezar }

  // El que crea la sala entra en ella al momento.
  useEffect(() => {
    if (modo === 'crear') setSala(abrirSala(codigo, 'anfitrion'))
  }, [modo, codigo])

  // Lo que pasa en la sala: quien entra y la presentacion.
  useEffect(() => {
    if (!sala) return
    setEstado(sala.estado())
    if (sala.estado() === 'juntos' && sala.rol === 'invitado') {
      sala.enviar({ tipo: 'hola', nombre: datos.current.nombre, mazo: datos.current.mazo })
    }
    const quitaVigia = sala.alCambiar((nuevo) => {
      setEstado(nuevo)
      // El invitado, al juntarse, se presenta.
      if (nuevo === 'juntos' && sala.rol === 'invitado') {
        sala.enviar({ tipo: 'hola', nombre: datos.current.nombre, mazo: datos.current.mazo })
      }
    })
    const quita = sala.alRecibir((m) => {
      if (empezada.current) return
      if (m.tipo === 'hola' && sala.rol === 'anfitrion') {
        // Se presenta el amigo: se le contesta y arranca.
        empezada.current = true
        sala.enviar({ tipo: 'empieza', nombre: datos.current.nombre, mazo: datos.current.mazo, escenario: datos.current.escenario })
        datos.current.onEmpezar({ sala, rol: 'anfitrion', miMazo: datos.current.mazo, rival: { nombre: m.nombre, mazo: m.mazo }, escenario: datos.current.escenario })
      }
      if (m.tipo === 'empieza' && sala.rol === 'invitado') {
        empezada.current = true
        datos.current.onEmpezar({ sala, rol: 'invitado', miMazo: datos.current.mazo, rival: { nombre: m.nombre, mazo: m.mazo }, escenario: m.escenario })
      }
    })
    return () => {
      quita()
      quitaVigia()
    }
  }, [sala])

  // Si se cierra el panel sin empezar, se sale de la sala.
  useEffect(
    () => () => {
      if (!empezada.current) sala?.cerrar()
    },
    [sala],
  )

  const enLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const enlace = window.location.origin

  const texto =
    estado === 'conectando'
      ? 'Conectando…'
      : estado === 'esperando'
        ? modo === 'crear'
          ? 'Esperando a que tu amigo entre…'
          : 'Esperando a que tu amigo abra la sala…'
        : estado === 'juntos'
          ? '¡Ya estáis los dos! Empezando…'
          : estado === 'cerrada'
            ? 'No se ha podido conectar. ¿Está encendido el juego del que crea la sala?'
            : null

  return (
    <div className="papel mt-3 p-3">
      <p className="text-center font-west text-[19px] leading-none">Partida con un amigo</p>

      {modo === 'crear' ? (
        <>
          <p className="mt-2 text-center text-[13px] text-[#5b3a1c]">
            Pásale <b>este enlace</b> y <b>este código</b> a tu amigo:
          </p>
          <div className="mt-1.5 rounded-lg border border-[#2a1a10]/30 bg-white/50 px-2 py-1.5 text-center text-[13px] font-bold break-all text-[#2a1a10]">
            {enlace}
          </div>
          <p className="mt-1.5 text-center font-west text-[38px] leading-none tracking-[0.3em] text-[#2a1a10]">{codigo}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`Juega conmigo a Guns and Gold: ${enlace}  ·  Código de sala: ${codigo}`)
              setAviso('Copiado: pégaselo a tu amigo')
            }}
            className="boton mt-2 w-full text-[14px]"
          >
            📋 Copiar enlace y código
          </button>
          {enLocal && (
            <p className="mt-2 rounded-lg bg-amber-500/25 px-2 py-1.5 text-center text-[12px] leading-snug text-[#3b2410]">
              ⚠️ Estás en <b>localhost</b>: ese enlace solo funciona en tu ordenador. Para que tu amigo entre desde su casa,
              arranca el juego con <b>npm run amigos</b> y abre el enlace que sale (el de <b>trycloudflare.com</b>).
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-center text-[13px] text-[#5b3a1c]">Mete el código que te ha pasado tu amigo:</p>
          <input
            value={entrada}
            disabled={Boolean(sala)}
            onChange={(evento) => setEntrada(evento.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            className="mt-2 w-full rounded-xl border-2 border-[#5b3a1c]/60 bg-white/70 px-3 py-2 text-center font-west text-[24px] tracking-[0.3em] text-[#2a1a10] outline-none placeholder:text-[#5b3a1c]/40"
          />
        </>
      )}

      {texto && (
        <p className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-[#2a1a10]/10 px-2 py-1.5 text-center text-[13px] font-bold text-[#3b2410]">
          {estado !== 'cerrada' && <Icono nombre="arma" className="animate-spin" style={{ animationDuration: '1.6s' }} />}
          {texto}
        </p>
      )}
      {aviso && <p className="mt-2 rounded-lg bg-[#2a1a10]/10 px-2 py-1 text-center text-[13px] text-[#5b3a1c]">{aviso}</p>}

      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCerrar} className="boton boton-fantasma flex-1 text-[14px]">
          Cerrar
        </button>
        {modo === 'unirse' && !sala && (
          <button
            type="button"
            onClick={() => {
              if (entrada.length !== 6) {
                setAviso('El código tiene 6 letras o números')
                return
              }
              setAviso(null)
              setSala(abrirSala(entrada, 'invitado'))
            }}
            className="boton flex-1 text-[14px]"
          >
            <Icono nombre="codigo" /> Entrar
          </button>
        )}
      </div>
    </div>
  )
}
