import { infoDeSello } from '../battle/sellos'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, Quaternion, Vector3 } from 'three'
import type { CanvasTexture, Group, Mesh, MeshBasicMaterial } from 'three'
import { motionById } from '../animations'
import type { Pose, Triple } from '../animations'
import type { CardDef } from '../cards/model'
import { rarityInfo, rarityOf } from '../cards/model'
import { DollBody } from '../DollBody'
import type { PoseMix } from '../DollBody'
import { proportions } from '../dollParams'
import {
  CARD_DEPTH,
  CARD_H,
  CARD_W,
  WINDOW,
  frameInfo,
  glareTexture,
  makeBackdropTexture,
  makeFrameTexture,
} from './cardArt'
import { RAREZA_FX, RarityFx } from './RarityFx'
import { lying, stepTrap, upright } from './trapPhysics'
import type { BodySpec, Box, TrapState } from './trapPhysics'
import { WeaponModel } from './WeaponModel'

/** Gravedad dentro de la carta (en metros de carta): mas lenta que la real, como un juguete. */
const G = 5.2
const DOLL_H = 0.5
const WEAPON_LEN = 0.5
/** Lo grande que se ve el arma en su vitrina: casi de lado a lado, que es lo que se quiere mirar. */
const WEAPON_SHOW = 0.62

const BOX: Box = { x0: WINDOW.x0 + 0.004, x1: WINDOW.x1 - 0.004, y0: WINDOW.y0 + 0.004, y1: WINDOW.y1 - 0.004 }

const IDLE = motionById('quieto')

const limbL = (fwd: number, out: number, twist = 0): Triple => [fwd, twist, -out]
const limbR = (fwd: number, out: number, twist = 0): Triple => [fwd, -twist, out]

/** Pose de ir por el aire: brazos arriba y piernas abiertas, agitandose. */
function fallPose(clock: number, flail: number): Pose {
  const s = Math.sin(clock * 11) * 26 * flail
  const c = Math.cos(clock * 9) * 22 * flail
  return {
    bones: {
      shoulderL: limbL(120 + s, 55 + c * 0.5),
      shoulderR: limbR(120 - s, 55 - c * 0.5),
      elbowL: [35 + c, 0, 0],
      elbowR: [35 - c, 0, 0],
      hipL: limbL(28 + c, 22),
      hipR: limbR(-8 - c, 22),
      kneeL: [45 + s * 0.6, 0, 0],
      kneeR: [30 - s * 0.6, 0, 0],
      torso: [-8, 0, s * 0.2],
      head: [-14, 0, c * 0.3],
    },
  }
}

/** Tumbado y quieto: despatarrado. */
const RESTING: Pose = {
  bones: {
    shoulderL: limbL(40, 70),
    shoulderR: limbR(40, 70),
    elbowL: [30, 0, 0],
    elbowR: [30, 0, 0],
    hipL: limbL(10, 18),
    hipR: limbR(4, 14),
    kneeL: [20, 0, 0],
    kneeR: [8, 0, 0],
    head: [-6, 20, 0],
  },
}

/** Lo grande que sale el muñeco en primer plano (respecto a cuando cabe entero). */
const PRIMER_PLANO = 1.7

function dollSpec(card: Extract<CardDef, { kind: 'batalla' }>): { spec: BodySpec; scale: number } {
  const pr = proportions(card.look)
  const scale = DOLL_H / pr.H
  const c = DOLL_H * 0.5
  const footR = Math.max(0.03, pr.limbR * 1.6 * scale)
  const headR = Math.max(0.035, pr.headR * 1.1 * scale)
  return {
    scale,
    spec: {
      feet: c,
      inertia: (DOLL_H * DOLL_H) / 10,
      standable: true,
      probes: [
        { along: -c + footR, r: footR },
        { along: -c + pr.hipY * 0.5 * scale, r: pr.limbR * 1.3 * scale },
        { along: -c + (pr.hipY + pr.torsoH * 0.45) * scale, r: Math.max(pr.torsoW, pr.bellyR) * scale },
        { along: -c + (pr.hipY + pr.torsoH + pr.headUp) * scale, r: headR },
      ],
    },
  }
}

const WEAPON_SPEC: BodySpec = {
  feet: 0,
  inertia: (WEAPON_LEN * WEAPON_LEN) / 12,
  standable: false,
  probes: [
    { along: -WEAPON_LEN * 0.42, r: 0.05 },
    { along: 0, r: 0.05 },
    { along: WEAPON_LEN * 0.42, r: 0.05 },
  ],
}

let backTex: CanvasTexture | null = null
/** Dorso de la carta: cuero con una estrella de sheriff. */
function cardBackTexture(): CanvasTexture {
  if (backTex) return backTex
  const tex = makeBackdropTexture('#e0b463')
  const canvas = tex.image as HTMLCanvasElement
  const ctx = canvas.getContext('2d')!
  const w = canvas.width
  const h = canvas.height
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#6b3f1f')
  grad.addColorStop(1, '#2a1707')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#e0b463'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, w - 20, h - 20)
  ctx.fillStyle = '#e0b463'
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 62 : 26
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const x = w / 2 + Math.cos(a) * r
    const y = h / 2 + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  tex.needsUpdate = true
  backTex = tex
  return tex
}

export interface TrappedCardProps {
  card: CardDef
  /** 0-1: brillo del borde (seleccionada, arrastrando...). */
  glow?: number
  /** Apagada (por ejemplo, mientras recarga). */
  dimmed?: boolean
  /** Si cambia, le da un meneo al muñeco (al llegar la carta a la mano). */
  kick?: number
  /** Sin fisica: el muñeco se queda quieto (para fotos). */
  still?: boolean
  /** El muñeco de dentro con pocas mallas (la mano de la batalla lleva varias cartas a la vez). */
  lite?: boolean
  /**
   * **Primer plano**: el muñeco grande, de cintura para arriba y quieto, como una foto de su
   * cartel (la mano de la partida: así se reconoce cada carta de un vistazo).
   */
  primerPlano?: boolean
}

/**
 * La carta como vitrina 3D con el muñeco (o el arma) atrapado dentro. La carta calcula la
 * gravedad segun como este girada en el mundo y los empujones segun como se mueva, asi que
 * al inclinarla, voltearla o sacudirla, lo de dentro se cae y rueda de verdad.
 */
export function TrappedCard({ card, glow = 0, dimmed = false, kick = 0, still = false, lite = false, primerPlano = false }: TrappedCardProps) {
  const root = useRef<Group>(null)
  const body = useRef<Group>(null)
  const glareMesh = useRef<Mesh>(null)
  const glowMesh = useRef<Mesh>(null)
  const mix = useRef<PoseMix | null>(null)

  const rarity = rarityOf(card)
  const rarezaColor = rarityInfo(rarity).color
  const fuegos = RAREZA_FX[rarity]
  // La madera de la vitrina se tine de la rareza: asi el marco canta tambien de lado.
  const tintes = useMemo(() => {
    const color = new Color(rarezaColor)
    const wood = new Color('#3a2211').lerp(color, fuegos.tinte)
    const inner = new Color('#26160b').lerp(color, fuegos.tinte * 0.7)
    return { wood: `#${wood.getHexString()}`, inner: `#${inner.getHexString()}` }
  }, [rarezaColor, fuegos.tinte])
  const info = useMemo(() => frameInfo(card), [card])
  const frame = useMemo(() => makeFrameTexture(info), [info])
  // El fondo de dentro brilla del color de su sello (las armas, del suyo).
  const fondo = card.kind === 'batalla' ? infoDeSello(card).color : card.accent
  const backdrop = useMemo(() => makeBackdropTexture(fondo), [fondo])
  const glare = useMemo(() => {
    const tex = glareTexture().clone()
    tex.needsUpdate = true
    return tex
  }, [])
  useEffect(
    () => () => {
      frame.dispose()
      backdrop.dispose()
      glare.dispose()
    },
    [frame, backdrop, glare],
  )

  const doll = useMemo(() => (card.kind === 'batalla' ? dollSpec(card) : null), [card])
  const spec = doll ? doll.spec : WEAPON_SPEC
  const state = useRef<TrapState>(doll ? upright(spec, BOX) : lying(spec, BOX))
  const specKey =
    card.kind === 'batalla'
      ? JSON.stringify([card.look.height, card.look.fat, card.look.belly, card.look.headSize, card.look.legLength, card.look.hat, card.look.hatSize])
      : card.model
  useEffect(() => {
    state.current = doll ? upright(spec, BOX) : lying(spec, BOX)
    // Solo cuando cambia el cuerpo, no en cada retoque de color.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey])

  useEffect(() => {
    if (kick === 0) return
    const s = state.current
    s.vy += 1.6
    s.w += (Math.random() - 0.5) * 6
  }, [kick])

  const track = useRef({
    ready: false,
    pos: new Vector3(),
    vel: new Vector3(),
    acc: new Vector3(),
    q: new Quaternion(),
    scale: new Vector3(),
  })
  const tmp = useMemo(() => ({ p: new Vector3(), g: new Vector3(), a: new Vector3(), qi: new Quaternion() }), [])

  useFrame((_, rawDt) => {
    const group = root.current
    if (!group) return
    const dt = Math.min(1 / 30, Math.max(1 / 240, rawDt))
    const t = track.current
    group.updateWorldMatrix(true, false)
    group.matrixWorld.decompose(tmp.p, t.q, t.scale)
    const unit = Math.max(0.0001, t.scale.x)
    if (!t.ready) {
      t.pos.copy(tmp.p)
      t.ready = true
    }
    // Velocidad y aceleracion de la carta en el mundo, en metros de carta.
    const vel = tmp.a.copy(tmp.p).sub(t.pos).divideScalar(dt * unit)
    const acc = vel.clone().sub(t.vel).divideScalar(dt)
    // Si el navegador se ha atascado un momento, el salto no cuenta como sacudida.
    if (rawDt > 0.06) t.acc.set(0, 0, 0)
    else t.acc.lerp(acc, 0.35)
    t.vel.copy(vel)
    t.pos.copy(tmp.p)

    tmp.qi.copy(t.q).invert()
    const g = tmp.g.set(0, -G, 0).applyQuaternion(tmp.qi)
    const inertial = t.acc.clone().clampLength(0, 60).applyQuaternion(tmp.qi).multiplyScalar(-0.1)
    const gx = g.x + inertial.x
    const gy = g.y + inertial.y
    const grip = Math.abs(g.z) / G
    const push = Math.hypot(inertial.x, inertial.y)

    const s = state.current
    if (!still && !primerPlano) stepTrap(s, spec, BOX, gx, gy, grip * grip, push, dt)

    const b = body.current
    if (primerPlano && card.kind === 'batalla') {
      // De pie y quieto, con los pies por debajo de la ventana: se ve de cintura para arriba.
      if (b) {
        b.position.set(winCx, WINDOW.y0 - DOLL_H * PRIMER_PLANO * 0.24, 0)
        b.rotation.set(0, 0, 0)
      }
    } else if (card.kind === 'arma') {
      // El arma no rueda por el suelo: flota en el centro de la vitrina, grande, girando despacio
      // (se ve de lado y de frente) y con un balanceo suave. Nada de verla tumbada y pequeña.
      if (b) {
        const t = performance.now() / 1000
        b.position.set(winCx, winCy + Math.sin(t * 1.4) * 0.012, 0.02)
        b.rotation.set(0, Math.sin(t * 0.6) * 0.55, 0.32 + Math.sin(t * 0.9) * 0.05)
      }
    } else if (b) {
      const ux = -Math.sin(s.a)
      const uy = Math.cos(s.a)
      b.position.set(s.x - ux * spec.feet, s.y - uy * spec.feet, 0)
      b.rotation.set(0, 0, s.a)
    }

    if (doll) {
      const target = s.mode === 'pie' ? 0 : s.mode === 'levanta' ? 1 - s.up : 1
      const current = mix.current?.weight ?? 0
      const weight = current + (target - current) * Math.min(1, dt * 10)
      const moving = Math.min(1, s.flail + Math.abs(s.w) * 0.08)
      const pose = moving > 0.15 ? fallPose(s.clock, moving) : RESTING
      mix.current = { pose, weight }
    }

    // El reflejo del cristal corre al inclinar la carta.
    if (glareMesh.current) {
      glare.offset.set(-g.x * 0.08 + inertial.x * 0.01, g.z * 0.06)
    }
    if (glowMesh.current) {
      const material = glowMesh.current.material as MeshBasicMaterial
      // La carta cogida brilla mas, y las epicas y divinas sueltan su halo aunque esten quietas.
      const cogida = glow * (0.55 + Math.sin(performance.now() / 180) * 0.15)
      const suyo = fuegos.halo * (0.72 + Math.sin(performance.now() / 430) * 0.28)
      material.opacity = Math.max(cogida, dimmed ? 0 : suyo)
      glowMesh.current.visible = material.opacity > 0.01
    }
  })

  const winW = WINDOW.x1 - WINDOW.x0
  const winH = WINDOW.y1 - WINDOW.y0
  const winCx = (WINDOW.x0 + WINDOW.x1) / 2
  const winCy = (WINDOW.y0 + WINDOW.y1) / 2
  const d = CARD_DEPTH
  const sideW = CARD_W / 2 - WINDOW.x1
  const topH = CARD_H / 2 - WINDOW.y1
  const bottomH = CARD_H / 2 + WINDOW.y0
  const wood = dimmed ? '#1c120a' : tintes.wood
  const inner = dimmed ? '#120b06' : tintes.inner
  const emision = dimmed ? '#000000' : rarezaColor
  const intensidad = dimmed ? 0 : fuegos.emision

  return (
    <group ref={root}>
      {/* Marco de madera: cuatro largueros con todo el fondo de la vitrina */}
      <mesh position={[0, WINDOW.y1 + topH / 2, 0]}>
        <boxGeometry args={[CARD_W, topH, d]} />
        <meshStandardMaterial color={wood} roughness={0.85} emissive={emision} emissiveIntensity={intensidad} />
      </mesh>
      <mesh position={[0, WINDOW.y0 - bottomH / 2, 0]}>
        <boxGeometry args={[CARD_W, bottomH, d]} />
        <meshStandardMaterial color={wood} roughness={0.85} emissive={emision} emissiveIntensity={intensidad} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (WINDOW.x1 + sideW / 2), winCy, 0]}>
          <boxGeometry args={[sideW, winH, d]} />
          <meshStandardMaterial color={inner} roughness={0.9} emissive={emision} emissiveIntensity={intensidad * 0.6} />
        </mesh>
      ))}

      {/* Fondo de dentro: el desierto al atardecer */}
      <mesh position={[winCx, winCy, -d / 2 + 0.003]}>
        <planeGeometry args={[winW, winH]} />
        <meshBasicMaterial map={backdrop} color={dimmed ? '#555555' : '#ffffff'} toneMapped={false} />
      </mesh>
      {/* Dorso */}
      <mesh position={[0, 0, -d / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial map={cardBackTexture()} toneMapped={false} />
      </mesh>

      {/* Lo que esta atrapado dentro */}
      <group ref={body}>
        {card.kind === 'batalla' && doll ? (
          <DollBody
            look={card.look}
            motion={IDLE}
            playing={!still}
            scale={doll.scale * (primerPlano ? PRIMER_PLANO : 1)}
            mixRef={mix}
            lite={lite}
          />
        ) : card.kind === 'arma' ? (
          <group scale={WEAPON_SHOW}>
            <WeaponModel model={card.model} />
          </group>
        ) : null}
      </group>

      {/* Cristal con su reflejo */}
      <mesh position={[winCx, winCy, d / 2 - 0.004]}>
        <planeGeometry args={[winW, winH]} />
        <meshStandardMaterial color="#d8ecff" transparent opacity={0.08} roughness={0.05} metalness={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={glareMesh} position={[winCx, winCy, d / 2 - 0.002]}>
        <planeGeometry args={[winW, winH]} />
        <meshBasicMaterial map={glare} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Cara de la carta: marco pintado con la ventana recortada */}
      <mesh position={[0, 0, d / 2 + 0.001]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshBasicMaterial
          map={frame}
          transparent
          alphaTest={0.5}
          color={dimmed ? '#777777' : '#ffffff'}
          toneMapped={false}
        />
      </mesh>

      {/* Halo del color de la rareza: se enciende al cogerla y late solo en las epicas y divinas */}
      <mesh ref={glowMesh} position={[0, 0, -d / 2 - 0.01]} visible={false}>
        <planeGeometry args={[CARD_W + 0.14, CARD_H + 0.14]} />
        <meshBasicMaterial color={rarezaColor} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* Lo que echa esta rareza: chispas, aros, rayos, destellos… */}
      <RarityFx rarity={rarity} color={rarezaColor} dimmed={dimmed} />
    </group>
  )
}
