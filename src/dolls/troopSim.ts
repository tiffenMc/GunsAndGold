import { useCallback, useEffect, useRef, useState } from 'react'
import { motionById } from './animations'
import type { Motion } from './animations'
import { RUN_AT, paceAt } from './battle/engine'
import type { AnimSet } from './cardConfig'

/**
 * Simula lo que hace la carta en partida:
 *  - Al sacarla anda. Cada 30 s la escalada la hace ir mas rapido, y desde el 1:30
 *    pasa de andar a correr (y sigue subiendo).
 *  - Plantada, se queda quieta y dispara cada `fireMs`.
 *  - Si le dan, hace la animacion de impacto y vuelve a lo suyo.
 *  - Al perder el ultimo escudo, hace la de morir y se rompe en piezas.
 */

export interface Tier {
  /** Segundo de partida en que entra este tramo. */
  at: number
  gait: 'andar' | 'correr'
  /** Multiplicador de la animacion. */
  speed: number
  label: string
}

/** Los tramos de la partida, sacados del mismo ritmo que usa la batalla. */
export const TIERS: Tier[] = [0, 30, 60, 90, 120, 150, 180].map((at) => {
  const pace = paceAt(at)
  return {
    at,
    gait: pace.gait,
    speed: pace.anim,
    label: `${timeLabel(at)} ${pace.gait === 'correr' ? (at === RUN_AT ? 'pasan a correr' : 'corren más') : at === 0 ? 'andando' : 'andan más rápido'}`,
  }
})

export function tierAt(clock: number): Tier {
  let found = TIERS[0]
  for (const tier of TIERS) {
    if (clock >= tier.at) found = tier
  }
  return found
}

export function timeLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export type Acting = 'quieto' | 'disparar' | 'impacto' | 'morir'
export type SimPhase = 'vivo' | 'muriendo' | 'roto'

export interface TroopSim {
  clock: number
  tier: Tier
  acting: Acting
  phase: SimPhase
  motion: Motion
  speed: number
  running: boolean
  timeScale: number
  onAnimationDone: () => void
  hit: () => void
  kill: () => void
  revive: () => void
  setClock: (seconds: number) => void
  setRunning: (value: boolean) => void
  setTimeScale: (value: number) => void
}

export function useTroopSim(fireMs: number, anims: AnimSet): TroopSim {
  const [clock, setClock] = useState(0)
  const [acting, setActing] = useState<Acting>('quieto')
  const [phase, setPhase] = useState<SimPhase>('vivo')
  const [running, setRunning] = useState(true)
  const [timeScale, setTimeScale] = useState(1)

  const clockRef = useRef(0)
  const waitRef = useRef(fireMs)
  const tickRef = useRef(0)

  const fireRef = useRef(fireMs)
  fireRef.current = fireMs
  const animsRef = useRef(anims)
  animsRef.current = anims
  const actingRef = useRef(acting)
  actingRef.current = acting
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const runningRef = useRef(running)
  runningRef.current = running
  const scaleRef = useRef(timeScale)
  scaleRef.current = timeScale

  useEffect(() => {
    const id = window.setInterval(() => {
      if (phaseRef.current !== 'vivo' || !runningRef.current) return
      const step = 0.05 * scaleRef.current
      clockRef.current += step
      // El reloj se refleja en pantalla 4 veces por segundo, no en cada tick.
      tickRef.current += 1
      if (tickRef.current % 5 === 0) setClock(clockRef.current)

      if (actingRef.current === 'disparar' || actingRef.current === 'impacto') return
      waitRef.current -= 0.05 * scaleRef.current
      if (waitRef.current <= 0) {
        waitRef.current = fireRef.current / 1000
        setActing('disparar')
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [])

  const tier = tierAt(clock)

  const motion =
    acting === 'morir'
      ? motionById(anims.morir)
      : acting === 'impacto'
        ? motionById(anims.impacto)
        : acting === 'disparar'
          ? motionById(anims.disparar)
          : motionById(anims[tier.gait])

  const onAnimationDone = useCallback(() => {
    if (actingRef.current === 'disparar' || actingRef.current === 'impacto') {
      setActing('quieto')
      waitRef.current = fireRef.current / 1000
    } else if (actingRef.current === 'morir') {
      setPhase('roto')
    }
  }, [])

  const hit = useCallback(() => {
    if (phaseRef.current !== 'vivo') return
    if (actingRef.current === 'morir') return
    setActing('impacto')
  }, [])

  const kill = useCallback(() => {
    if (phaseRef.current !== 'vivo') return
    setActing('morir')
    setPhase('muriendo')
  }, [])

  const revive = useCallback(() => {
    clockRef.current = 0
    waitRef.current = fireRef.current / 1000
    setClock(0)
    setActing('quieto')
    setPhase('vivo')
  }, [])

  const scrub = useCallback((seconds: number) => {
    clockRef.current = Math.max(0, seconds)
    setClock(clockRef.current)
  }, [])

  return {
    clock,
    tier,
    acting,
    phase,
    motion,
    // Las animaciones de un tiro se reproducen a velocidad normal: la escalada es para andar.
    speed: acting === 'quieto' ? tier.speed : 1,
    running,
    timeScale,
    onAnimationDone,
    hit,
    kill,
    revive,
    setClock: scrub,
    setRunning,
    setTimeScale,
  }
}
