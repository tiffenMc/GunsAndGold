import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '@/lib/supabase'

export interface AuthState {
  ready: boolean
  user: User | null
  cloudEnabled: boolean
  signInWithGoogle: () => Promise<void>
  /** Entrar con correo y contraseña. Devuelve el error en texto, o null si ha ido bien. */
  signInWithEmail: (email: string, password: string) => Promise<string | null>
  /** Crear la cuenta con correo y contraseña. */
  signUpWithEmail: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

/** Los errores de Supabase, en cristiano. */
function traducir(mensaje: string): string {
  if (/Invalid login credentials/i.test(mensaje)) return 'Ese correo y esa contraseña no cuadran'
  if (/already registered/i.test(mensaje)) return 'Ese correo ya tiene cuenta: entra en vez de registrarte'
  if (/Password should be/i.test(mensaje)) return 'La contraseña tiene que tener al menos 6 letras'
  if (/valid email/i.test(mensaje)) return 'Escribe un correo que exista'
  if (/Email not confirmed/i.test(mensaje)) return 'Te falta confirmar el correo: mira tu bandeja'
  return mensaje
}

export function useAuth(): AuthState {
  const [ready, setReady] = useState(!supabaseEnabled)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return 'La cuenta no está disponible en este servidor'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? traducir(error.message) : null
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return 'La cuenta no está disponible en este servidor'
    // El correo de confirmación tiene que volver AQUÍ, no a la dirección de por defecto de Supabase.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    return error ? traducir(error.message) : null
  }

  /**
   * Salir **siempre**: primero se olvida al usuario aquí (y la sesión guardada en este
   * dispositivo) y luego se avisa a la nube. Si la nube no contesta o da error, da igual: ya
   * estás fuera.
   */
  const signOut = async () => {
    setUser(null)
    if (!supabase) return
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // Sin red o sesión ya caducada: la sesión local ya está borrada.
    }
  }

  return {
    ready,
    user,
    cloudEnabled: supabaseEnabled,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }
}
