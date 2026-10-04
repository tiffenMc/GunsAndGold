import { useSyncExternalStore } from 'react'

/**
 * Las **cuentas de este dispositivo**: usuario y contraseña, sin correo y sin confirmar nada. Es la
 * forma rápida de entrar en local mientras la nube (Supabase) está en pañales: si escribes un
 * usuario sin @, se crea aquí y entras al momento.
 *
 * La contraseña no se guarda tal cual: se guarda un resumen (un hash tonto). No es seguridad de
 * verdad —es un juego que corre en tu casa—, pero tampoco queda la clave escrita a la vista.
 */

interface CuentaLocal {
  usuario: string
  /** El resumen de la contraseña. */
  clave: string
  creada: number
}

interface Guardado {
  cuentas: Record<string, CuentaLocal>
  actual: string | null
}

const KEY = 'oeste-cuentas-v1'

/** Un resumen sencillo y suficiente para esto: no guardamos la contraseña tal cual. */
function resumen(clave: string): string {
  let h = 5381
  const texto = `duelo::${clave}`
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return `v1-${(h >>> 0).toString(36)}`
}

function normalizar(usuario: string): string {
  return usuario.trim().toLowerCase()
}

function leer(): Guardado {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { cuentas: {}, actual: null }
    const parsed = JSON.parse(raw) as Partial<Guardado>
    return {
      cuentas: parsed.cuentas && typeof parsed.cuentas === 'object' ? parsed.cuentas : {},
      actual: typeof parsed.actual === 'string' ? parsed.actual : null,
    }
  } catch {
    return { cuentas: {}, actual: null }
  }
}

let estado: Guardado = leer()
const oyentes = new Set<() => void>()

function persistir() {
  try {
    localStorage.setItem(KEY, JSON.stringify(estado))
  } catch {
    // Si no cabe, se queda en memoria.
  }
  for (const oyente of oyentes) oyente()
}

/** La cuenta con la que estás dentro ahora mismo (o null). */
export function cuentaActual(): CuentaLocal | null {
  if (!estado.actual) return null
  return estado.cuentas[estado.actual] ?? null
}

/** Alta rápida: usuario y contraseña. Devuelve el error en texto, o null si ha ido bien. */
export function crearCuentaLocal(usuario: string, clave: string): string | null {
  const id = normalizar(usuario)
  if (id.length < 3) return 'El usuario tiene que tener al menos 3 letras'
  if (clave.length < 4) return 'La contraseña tiene que tener al menos 4 letras'
  if (estado.cuentas[id]) return 'Ese usuario ya existe aquí: entra con su contraseña'
  estado = {
    cuentas: { ...estado.cuentas, [id]: { usuario: usuario.trim(), clave: resumen(clave), creada: Date.now() } },
    actual: id,
  }
  persistir()
  return null
}

/** Entrar con una cuenta de este dispositivo. */
export function entrarLocal(usuario: string, clave: string): string | null {
  const id = normalizar(usuario)
  const cuenta = estado.cuentas[id]
  if (!cuenta) return 'Ese usuario no está en este dispositivo: créalo'
  if (cuenta.clave !== resumen(clave)) return 'Esa contraseña no es la suya'
  estado = { ...estado, actual: id }
  persistir()
  return null
}

/** Salir. */
export function cerrarSesionLocal(): void {
  estado = { ...estado, actual: null }
  persistir()
}

/** Las cuentas que hay en este dispositivo (para enseñarlas o borrarlas). */
export function cuentasLocales(): CuentaLocal[] {
  return Object.values(estado.cuentas).sort((a, b) => b.creada - a.creada)
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

/** La cuenta actual, para pintarla. */
export function useCuentaLocal(): CuentaLocal | null {
  return useSyncExternalStore(suscribir, cuentaActual, cuentaActual)
}
