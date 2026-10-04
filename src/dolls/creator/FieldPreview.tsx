import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { motionById, samplePose } from '../animations'
import type { BurstStyle } from '../animations'
import type { BattleCard } from '../cards/model'
import { DollBody, RangeRing, ShieldPips } from '../DollBody'
import { DollDebris } from '../DollDebris'
import { proportions } from '../dollParams'
import { TIERS, timeLabel, useTroopSim } from '../troopSim'
import { FRAMELOOP } from '../debugClock'

function Ground({ radius }: { radius: number }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
        <circleGeometry args={[radius, 56]} />
        <meshStandardMaterial color="#b98a55" roughness={0.98} />
      </mesh>
      <gridHelper args={[radius * 2.2, 14, '#8f6234', '#6b4423']} position={[0, 0.002, 0]} />
    </>
  )
}

/**
 * El muñeco en el campo, como en partida: anda (y corre desde el 1:30), se para, dispara cada
 * X segundos, recibe balazos y al perder el ultimo escudo se rompe en piezas.
 */
export function FieldPreview({ card, preview }: { card: BattleCard; preview: string | null }) {
  const sim = useTroopSim(card.fireMs, card.anims)
  const [wide, setWide] = useState(false)
  const [deathRun, setDeathRun] = useState(0)
  const [shields, setShields] = useState(card.shields)

  useEffect(() => setShields(card.shields), [card.shields])
  useEffect(() => {
    sim.setRunning(!preview)
  }, [preview, sim])

  const previewMotion = preview ? motionById(preview) : null
  const motion = previewMotion ?? sim.motion
  const speed = previewMotion ? 1 : sim.speed
  const death = motionById(card.anims.morir)
  const burst: BurstStyle = death.burst ?? 'estallido'
  const restPose = useMemo(() => samplePose(death, death.length), [death])
  const h = useMemo(() => proportions(card.look).H, [card.look])
  const nextTier = TIERS.find((tier) => tier.at > sim.clock)

  const span = wide ? Math.max(h * 1.7, card.range * 2.3) : h * 1.9
  const dist = span / (2 * Math.tan((34 * Math.PI) / 360))
  const target: [number, number, number] = [0, h * 0.5, 0]
  const camera = useMemo(
    () => ({ position: [0.42 * dist, h * 0.5 + 0.19 * dist, 0.87 * dist] as [number, number, number], fov: 34 }),
    // Solo al montar: luego manda el orbitado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wide],
  )

  const hit = () => {
    if (sim.phase !== 'vivo') return
    if (shields <= 1) {
      setShields(0)
      setDeathRun((v) => v + 1)
      sim.kill()
    } else {
      setShields((v) => v - 1)
      sim.hit()
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative h-[34vh] min-h-[210px] overflow-hidden rounded-2xl border border-amber-900/50 bg-[#1b1107] lg:h-[46vh] lg:min-h-[320px]">
        <Canvas frameloop={FRAMELOOP} key={wide ? 'w' : 'n'} dpr={[1, 2]} camera={camera}>
          <color attach="background" args={['#1b1107']} />
          <ambientLight intensity={0.55} color="#ffe9c8" />
          <hemisphereLight args={['#ffe3b8', '#3a2412', 0.7]} />
          <directionalLight position={[3, 6, 3]} intensity={2.3} color="#fff1d4" />
          <directionalLight position={[-3.4, 2.4, -2.6]} intensity={0.85} color="#ff9d5c" />
          <Ground radius={Math.max(2.2, Math.min(card.range + 0.6, 9))} />
          <RangeRing radius={card.range} />
          {sim.phase === 'roto' ? (
            <DollDebris
              key={`${card.anims.morir}-${deathRun}`}
              look={card.look}
              style={burst}
              pose={restPose}
            />
          ) : (
            <DollBody
              look={card.look}
              motion={motion}
              playing
              speed={speed}
              onDone={() => {
                if (previewMotion) return
                sim.onAnimationDone()
              }}
            />
          )}
          {sim.phase === 'vivo' && <ShieldPips count={shields} height={h} />}
          <OrbitControls makeDefault target={target} enablePan={false} maxPolarAngle={Math.PI / 1.92} minDistance={h * 0.6} maxDistance={h * 9} />
        </Canvas>
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/65 px-2.5 py-1.5 text-[11px] leading-tight text-amber-100/90">
          <p className="text-amber-200/80">
            {previewMotion ? `Probando: ${previewMotion.name}` : `${motionById(card.anims[sim.tier.gait]).name}`}
          </p>
          <p className="text-amber-200/60">
            {timeLabel(sim.clock)} · {sim.tier.label}
            {nextTier ? ` · luego ${timeLabel(nextTier.at)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWide((v) => !v)}
          className="absolute right-2 top-2 rounded-lg border border-sky-300/60 bg-sky-400/15 px-2 py-1 text-[11px] text-sky-50"
        >
          {wide ? 'De cerca' : 'Ver su alcance'}
        </button>
      </div>

      <div className="panel-wood space-y-2 p-2.5">
        <div className="flex flex-wrap gap-1">
          {TIERS.map((tier) => (
            <button
              key={tier.at}
              type="button"
              onClick={() => sim.setClock(tier.at)}
              className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                sim.tier.at === tier.at
                  ? 'border-amber-300 bg-amber-300/20 text-amber-50'
                  : 'border-amber-900/50 bg-black/30 text-amber-200/70'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={hit} className="btn-gold px-3 py-1.5 text-[12px]">
            ¡Balazo! (−1 escudo)
          </button>
          <button
            type="button"
            onClick={() => {
              setShields(card.shields)
              setDeathRun((v) => v + 1)
              sim.revive()
            }}
            className="rounded-lg border border-emerald-300/60 bg-emerald-400/15 px-3 py-1.5 text-[12px] text-emerald-50"
          >
            Revivir
          </button>
          <span className="text-[11px] text-amber-200/60">
            {sim.phase === 'roto'
              ? 'Roto en piezas'
              : sim.acting === 'disparar'
                ? 'Disparando'
                : sim.acting === 'impacto'
                  ? 'Le han dado'
                  : `Dispara cada ${(card.fireMs / 1000).toFixed(1)} s`}
          </span>
        </div>
      </div>
    </div>
  )
}
