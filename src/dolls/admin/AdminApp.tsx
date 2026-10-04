import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { lazy, Suspense, useMemo, useState } from 'react'
import { createBattle } from '../battle/engine'
import { Field } from '../battle/Field'
import { PortraitBaker } from '../card3d/portraits'
import { BUILTIN_CARDS } from '../cards/catalog'
import { gameCards, useGameCards } from '../cards/store'
import { FRAMELOOP } from '../debugClock'
import { Column, Loading } from '../OesteApp'
import { SafeCanvas } from '../SafeCanvas'
import { SCENARIOS } from '../scenes/scenarios'
import type { ScenarioDef } from '../scenes/scenarios'

const Creator = lazy(() => import('../creator/Creator').then((m) => ({ default: m.Creator })))
const BattleScreen = lazy(() => import('../battle/BattleScreen').then((m) => ({ default: m.BattleScreen })))
const WeaponLab = lazy(() => import('./WeaponLab').then((m) => ({ default: m.WeaponLab })))

type Tab = 'cartas' | 'escenarios' | 'armas'

/** Vista libre de un escenario: se puede girar y acercar. */
function ScenarioPreview({ scenario }: { scenario: ScenarioDef }) {
  const battle = useMemo(() => createBattle({ decks: [BUILTIN_CARDS, BUILTIN_CARDS], practice: true }), [])
  return (
    <Canvas frameloop={FRAMELOOP} dpr={[1, 1.75]} camera={{ position: [16, 18, 22], fov: 40 }}>
      <color attach="background" args={[scenario.sky]} />
      <fog attach="fog" args={[scenario.sky, scenario.fog[0] + 20, scenario.fog[1] + 40]} />
      <hemisphereLight args={[scenario.hemiSky, scenario.hemiGround, 0.9]} />
      <ambientLight intensity={0.35} color="#ffe9c8" />
      <directionalLight position={[8, 16, 10]} intensity={scenario.sunIntensity} color={scenario.sun} />
      <Field key={scenario.id} battle={battle} scenario={scenario} deploying={false} />
      <OrbitControls makeDefault target={[0, 0, -2]} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={70} />
    </Canvas>
  )
}

function ScenarioGallery() {
  const [selected, setSelected] = useState<ScenarioDef>(SCENARIOS[0]!)
  const [testing, setTesting] = useState<ScenarioDef | null>(null)

  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-3 pt-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">Los 5 escenarios</p>
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => setSelected(scenario)}
            className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${
              selected.id === scenario.id ? 'border-amber-300 bg-amber-400/15' : 'border-amber-900/50 bg-black/30'
            }`}
          >
            <span className="text-3xl">{scenario.icon}</span>
            <span>
              <span className="block font-west text-lg leading-none text-amber-50">{scenario.name}</span>
              <span className="text-[11px] text-amber-200/70">{scenario.note}</span>
            </span>
          </button>
        ))}
        <p className="pt-2 text-[11px] leading-snug text-amber-200/60">
          En el juego, cada partida rápida sale en uno al azar distinto del anterior.
        </p>
      </aside>
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-west text-2xl text-amber-50">
            {selected.icon} {selected.name}
          </p>
          <button type="button" onClick={() => setTesting(selected)} className="btn-gold ml-auto text-[12px]">
            ⚔️ Probar batalla aquí
          </button>
        </div>
        <div className="h-[52vh] min-h-[260px] overflow-hidden rounded-2xl border border-amber-900/50 lg:h-[70vh] lg:min-h-[420px]">
          <SafeCanvas note="La vista 3D del escenario no está disponible en este dispositivo.">
            <ScenarioPreview scenario={selected} />
          </SafeCanvas>
        </div>
        <p className="text-[11px] text-amber-200/60">Arrastra para girar la vista y usa la rueda para acercar.</p>
      </section>

      {testing && (
        <div className="fixed inset-0 z-50">
          <Column>
            <Suspense fallback={<Loading />}>
              <SafeCanvas
                note=""
                fallback={
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                    <p className="font-west text-xl text-amber-100">Este dispositivo no puede dibujar la batalla</p>
                    <button type="button" onClick={() => setTesting(null)} className="btn-gold">
                      Cerrar
                    </button>
                  </div>
                }
              >
                <BattleScreen scenario={testing} deck={gameCards()} botDeck={gameCards()} onExit={() => setTesting(null)} />
              </SafeCanvas>
            </Suspense>
          </Column>
        </div>
      )}
    </div>
  )
}

export function AdminApp() {
  const [tab, setTab] = useState<Tab>(() => {
    const wanted = new URLSearchParams(window.location.search).get('ir')
    return wanted === 'escenarios' || wanted === 'armas' ? wanted : 'cartas'
  })
  const inGame = useGameCards().length
  const tabs: { id: Tab; label: string }[] = [
    { id: 'cartas', label: '🃏 Cartas' },
    { id: 'escenarios', label: '🏜️ Escenarios' },
    { id: 'armas', label: '🧪 Pruebas' },
  ]
  return (
    <div className="min-h-[100dvh] w-full bg-[#0c0804] text-amber-50">
      <SafeCanvas note="">
        <PortraitBaker />
      </SafeCanvas>
      <nav className="safe-top flex flex-wrap items-center gap-2 border-b-2 border-rose-900/60 bg-[#2a0f0a] px-3 pb-2">
        <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[12px] font-black tracking-widest text-white">ADMIN</span>
        {/* En movil el titulo largo estorba: solo se ve en pantallas anchas. */}
        <span className="hidden font-west text-lg text-amber-100 sm:inline">Duelo en el Oeste</span>
        <div className="flex gap-1">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg border px-3 py-2 text-[12px] ${
                tab === item.id ? 'border-amber-300 bg-amber-300/20 text-amber-50' : 'border-amber-900/50 bg-black/30 text-amber-200/80'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="hidden text-[11px] text-amber-200/70 sm:ml-auto sm:inline">{inGame} cartas en el juego</span>
        <a href="./" className="ml-auto rounded-lg border border-emerald-300/50 bg-emerald-500/15 px-2.5 py-2 text-[12px] text-emerald-50 sm:ml-0">
          Ir al juego ↗
        </a>
      </nav>
      <Suspense fallback={<Loading />}>
        {tab === 'cartas' && <Creator />}
        {tab === 'escenarios' && <ScenarioGallery />}
        {tab === 'armas' && <WeaponLab />}
      </Suspense>
    </div>
  )
}
