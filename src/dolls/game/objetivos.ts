/**
 * Las **recompensas diarias**: tres encargos al día y nada más (que no sea un trabajo). Unas veces
 * pagan con un **sobre** y otras con **monedas**, y se van apuntando solos según juegas.
 */

export type PremioObjetivo = { tipo: 'sobre' } | { tipo: 'monedas'; cantidad: number }

export interface Objetivo {
  id: string
  icono: string
  label: string
  /** Lo que hay que hacer. */
  meta: number
  /** Con qué se apunta. */
  que: 'ganar' | 'jugar'
  premio: PremioObjetivo
}

/**
 * Los encargos del dia: **uno de cada clase** (uno de ganar, uno de jugar y uno de racha), con los
 * numeros cambiando cada dia. Y entre los tres se sacan **dos sobres** y monedas, que es lo que
 * tiene sentido: no tres encargos de ganar partidas que se cumplen unos a otros sin querer.
 */
const DE_GANAR: Objetivo[] = [
  { id: 'gana2', icono: '🏆', label: 'Gana 2 partidas', meta: 2, que: 'ganar', premio: { tipo: 'sobre' } },
  { id: 'gana3', icono: '🏆', label: 'Gana 3 partidas', meta: 3, que: 'ganar', premio: { tipo: 'sobre' } },
  { id: 'gana4', icono: '🏆', label: 'Gana 4 partidas', meta: 4, que: 'ganar', premio: { tipo: 'sobre' } },
]

const DE_JUGAR: Objetivo[] = [
  { id: 'juega4', icono: '🎬', label: 'Juega 4 partidas', meta: 4, que: 'jugar', premio: { tipo: 'monedas', cantidad: 30 } },
  { id: 'juega6', icono: '🎬', label: 'Juega 6 partidas', meta: 6, que: 'jugar', premio: { tipo: 'monedas', cantidad: 40 } },
  { id: 'juega8', icono: '🎬', label: 'Juega 8 partidas', meta: 8, que: 'jugar', premio: { tipo: 'monedas', cantidad: 50 } },
]

const DE_RACHA: Objetivo[] = [
  { id: 'racha2', icono: '🔥', label: 'Gana 2 seguidas', meta: 2, que: 'ganar', premio: { tipo: 'sobre' } },
  { id: 'racha3', icono: '🔥', label: 'Gana 3 seguidas', meta: 3, que: 'ganar', premio: { tipo: 'sobre' } },
]

/**
 * El día de hoy **en hora española**: los encargos cambian a las **00:00 de España**, para todos a
 * la vez, juegues desde donde juegues.
 */
export function diaDeHoy(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora)
  const coge = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  return `${coge('year')}-${coge('month')}-${coge('day')}`
}

/** Lo que queda para las 00:00 de España (cuando cambian los encargos). */
export function hastaElCambio(ahora: Date | number = new Date()): number {
  const fecha = typeof ahora === 'number' ? new Date(ahora) : ahora
  const partes = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(fecha)
  const coge = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value ?? 0)
  const horas = coge('hour') % 24
  const minutos = coge('minute')
  const segundos = coge('second')
  return ((23 - horas) * 3600 + (59 - minutos) * 60 + (59 - segundos)) * 1000 + (1000 - fecha.getMilliseconds())
}

/** Los tres encargos del día: los mismos todo el día y para todos (2 sobres y monedas). */
export function objetivosDelDia(dia: string): Objetivo[] {
  // Con la fecha se saca un número para ir cambiando los encargos cada día.
  let semilla = 0
  for (let i = 0; i < dia.length; i++) semilla = (semilla * 31 + dia.charCodeAt(i)) % 100000
  const siguientes = (): number => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648
    return semilla
  }
  return [
    DE_GANAR[siguientes() % DE_GANAR.length]!,
    DE_JUGAR[siguientes() % DE_JUGAR.length]!,
    DE_RACHA[siguientes() % DE_RACHA.length]!,
  ]
}

/** Lo que llevas de un encargo. */
export interface EstadoObjetivo {
  id: string
  hechos: number
  reclamado: boolean
  dia: string
}

/** El estado de los encargos de hoy, puesto al día (si cambia el día, se empieza de cero). */
export function estadoDeHoy(guardados: EstadoObjetivo[], dia: string): EstadoObjetivo[] {
  const deHoy = guardados.filter((item) => item.dia === dia)
  return objetivosDelDia(dia).map(
    (objetivo) =>
      deHoy.find((item) => item.id === objetivo.id) ?? { id: objetivo.id, hechos: 0, reclamado: false, dia },
  )
}

/** Apunta una partida terminada en los encargos que toquen. */
export function apuntarPartida(guardados: EstadoObjetivo[], dia: string, gano: boolean, racha: number): EstadoObjetivo[] {
  const estado = estadoDeHoy(guardados, dia)
  return estado.map((item) => {
    if (item.reclamado) return item
    const objetivo = objetivosDelDia(dia).find((def) => def.id === item.id)
    if (!objetivo) return item
    const vale = objetivo.que === 'jugar' || (objetivo.id.startsWith('racha') ? racha >= objetivo.meta : gano)
    if (!vale) return item
    return { ...item, hechos: Math.min(objetivo.meta, item.hechos + 1) }
  })
}
