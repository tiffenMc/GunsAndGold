import { Hud, OrthographicCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Group } from 'three'
import type { CardDef } from '../cards/model'
import { CARD_W } from '../card3d/cardArt'
import { TrappedCard } from '../card3d/TrappedCard'
import type { HudLayout, Rect } from './layout'

export interface DragState {
  active: boolean
  kind: 'batalla' | 'arma' | 'dinamita'
  slot: number
  x: number
  y: number
  /** Punto del campo donde sueltas (mundo), no pixeles. */
  wx: number
  wz: number
  overField: boolean
}

export interface HandView {
  slots: { card: CardDef | null; drawKey: number; dimmed?: boolean }[]
  weapon: { card: CardDef | null; drawKey: number; ready: boolean }
  /** Carta premio: solo existe si te la has ganado. */
  bonus: { card: CardDef; charges: number; drawKey: number } | null
  /** Hueco cuya carta se esta dibujando (se queda levantada). */
  holding: number | null
}

function HandCard({
  card,
  rect,
  layout,
  drag,
  dragKind,
  slot,
  holding,
  drawKey,
  dimmed,
}: {
  card: CardDef
  rect: Rect
  layout: HudLayout
  drag: MutableRefObject<DragState>
  dragKind: 'batalla' | 'arma' | 'dinamita'
  slot: number
  holding: boolean
  drawKey: number
  dimmed: boolean
}) {
  const group = useRef<Group>(null)
  const spin = useRef<Group>(null)
  const born = useRef(performance.now())
  const vel = useRef({ x: 0, y: 0, px: 0, py: 0, ready: false })
  const unit = layout.card.w / CARD_W

  useFrame((_, dt) => {
    const g = group.current
    const r = spin.current
    if (!g || !r) return
    const d = drag.current
    const dragging = d.active && d.kind === dragKind && d.slot === slot
    const baseX = rect.x + rect.w / 2 - layout.width / 2
    const baseY = layout.height / 2 - (rect.y + rect.h / 2)
    let tx = baseX
    let ty = baseY
    let ts = 1
    if (dragging && dragKind === 'arma') {
      // El arma no viaja con el dedo: se queda en su hueco, levantada. Lo que se mueve es el arma
      // de verdad del campo, y asi nada tapa el pasillo del alcance.
      ty = baseY + layout.card.h * 0.12
      ts = 1.06
    } else if (dragging) {
      tx = d.x - layout.width / 2
      ty = layout.height / 2 - d.y + (d.overField ? layout.card.h * 0.45 : 0)
      ts = d.overField ? 0.5 : 1.08
    } else if (holding) {
      ty = baseY + layout.card.h * 0.18
      ts = 1.04
    }
    // Entra cayendo desde arriba al robarla: el muñeco de dentro lo nota.
    const age = (performance.now() - born.current) / 1000
    if (age < 0.45) ty += (1 - age / 0.45) ** 2 * layout.card.h * 0.9

    const follow = dragging ? 1 - Math.exp(-dt * 28) : 1 - Math.exp(-dt * 12)
    g.position.x += (tx - g.position.x) * follow
    g.position.y += (ty - g.position.y) * follow
    const s = g.scale.x / unit
    g.scale.setScalar((s + (ts - s) * Math.min(1, dt * 12)) * unit)

    const v = vel.current
    if (!v.ready) {
      v.px = g.position.x
      v.py = g.position.y
      v.ready = true
    }
    const vx = (g.position.x - v.px) / Math.max(dt, 1 / 240)
    const vy = (g.position.y - v.py) / Math.max(dt, 1 / 240)
    v.px = g.position.x
    v.py = g.position.y
    v.x += (vx - v.x) * Math.min(1, dt * 10)
    v.y += (vy - v.y) * Math.min(1, dt * 10)
    // Se inclina hacia donde la mueves, como si la llevaras en la mano.
    r.rotation.z = Math.max(-0.7, Math.min(0.7, -v.x * 0.0011))
    r.rotation.x = -0.22 + Math.max(-0.5, Math.min(0.5, -v.y * 0.0008))
    r.rotation.y = Math.max(-0.5, Math.min(0.5, v.x * 0.0006))
  })

  const initialX = rect.x + rect.w / 2 - layout.width / 2
  const initialY = layout.height / 2 - (rect.y + rect.h / 2)
  return (
    <group ref={group} position={[initialX, initialY + layout.card.h, 0]} scale={unit}>
      <group ref={spin}>
        <TrappedCard key={drawKey} card={card} glow={holding ? 1 : 0} dimmed={dimmed} lite />
      </group>
    </group>
  )
}

export function HandHud({
  layout,
  view,
  drag,
}: {
  layout: HudLayout
  view: HandView
  drag: MutableRefObject<DragState>
}) {
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 600]} zoom={1} near={1} far={2000} />
      <ambientLight intensity={0.9} color="#ffe9c8" />
      <directionalLight position={[120, 260, 500]} intensity={2.2} color="#fff1d4" />
      <directionalLight position={[-300, -100, 300]} intensity={0.6} color="#ff9d5c" />
      {/* Bandeja de la mano: madera oscura, y el hueco del arma en azul (defensa) */}
      <mesh position={[0, -layout.height / 2 + (layout.height - layout.handTop) / 2, -300]}>
        <planeGeometry args={[layout.width, layout.height - layout.handTop]} />
        <meshBasicMaterial color="#1f1209" transparent opacity={0.82} toneMapped={false} />
      </mesh>
      {[...layout.slots, layout.weapon, ...(layout.bonus ? [layout.bonus] : [])].map((rect, index) => (
        <mesh
          key={index}
          position={[rect.x + rect.w / 2 - layout.width / 2, layout.height / 2 - (rect.y + rect.h / 2), -250]}
        >
          <planeGeometry args={[rect.w + 6, rect.h + 6]} />
          <meshBasicMaterial
            color={index === 4 ? '#7a350e' : index === 3 ? '#0c4a6e' : '#3a2211'}
            transparent
            opacity={index >= 3 ? 0.85 : 0.7}
            toneMapped={false}
          />
        </mesh>
      ))}
      {view.slots.map((slot, index) =>
        slot.card ? (
          <HandCard
            key={`s${index}-${slot.drawKey}`}
            card={slot.card}
            rect={layout.slots[index]!}
            layout={layout}
            drag={drag}
            dragKind="batalla"
            slot={index}
            holding={view.holding === index}
            drawKey={slot.drawKey}
            dimmed={slot.dimmed ?? false}
          />
        ) : null,
      )}
      {view.weapon.card && (
        <HandCard
          key={`w-${view.weapon.drawKey}`}
          card={view.weapon.card}
          rect={layout.weapon}
          layout={layout}
          drag={drag}
          dragKind="arma"
          slot={0}
          holding={false}
          drawKey={view.weapon.drawKey}
          dimmed={!view.weapon.ready}
        />
      )}
      {view.bonus && layout.bonus && (
        <HandCard
          key={`b-${view.bonus.drawKey}`}
          card={view.bonus.card}
          rect={layout.bonus}
          layout={layout}
          drag={drag}
          dragKind="dinamita"
          slot={0}
          holding={false}
          drawKey={view.bonus.drawKey}
          dimmed={false}
        />
      )}
    </Hud>
  )
}
