/**
 * Animacion por POSES y KEYFRAMES. Cada categoria tiene 5 variantes para elegir.
 *
 * Convencion de una pose, en GRADOS: [adelante, giro, lado]
 *  - adelante +: la pieza se va hacia delante (el pecho se inclina, el brazo sube al frente)
 *  - giro +:    gira sobre si misma (hacia su izquierda)
 *  - lado +:    se abre hacia su izquierda
 */

export type Triple = [number, number, number]

export interface Pose {
  /** Desplazamiento del muñeco entero: [lado, arriba, adelante]. */
  move?: Triple
  /** Giro del muñeco entero, en grados. */
  turn?: number
  bones?: Record<string, Triple>
}

export interface Key {
  t: number
  pose: Pose
}

/** Como se desmonta el muñeco al morir. */
export type BurstStyle = 'estallido' | 'derrumbe' | 'arriba' | 'mitades' | 'desarme'

export type MotionKind = 'quieto' | 'andar' | 'correr' | 'disparar' | 'impacto' | 'morir'

export interface Motion {
  id: string
  kind: MotionKind
  name: string
  hint: string
  loop: boolean
  length: number
  base?: Pose
  keys: Key[]
  /** Instantes del ciclo en que suelta el tiro. */
  firesAt?: number[]
  /** Solo en 'morir': como salen despedidas las piezas. */
  burst?: BurstStyle
}

export const BONE_NAMES = [
  'hips',
  'torso',
  'neck',
  'head',
  'shoulderL',
  'elbowL',
  'handL',
  'shoulderR',
  'elbowR',
  'handR',
  'hipL',
  'kneeL',
  'footL',
  'hipR',
  'kneeR',
  'footR',
] as const

const ZERO: Triple = [0, 0, 0]

const limbL = (fwd = 0, out = 0, twist = 0): Triple => [fwd, twist, -out]
const limbR = (fwd = 0, out = 0, twist = 0): Triple => [fwd, -twist, out]

const mirrorTriple = (t: Triple): Triple => [t[0], -t[1], -t[2]]

function mirrorName(name: string): string {
  if (name.endsWith('L')) return `${name.slice(0, -1)}R`
  if (name.endsWith('R')) return `${name.slice(0, -1)}L`
  return name
}

export function mirrorPose(pose: Pose): Pose {
  const bones: Record<string, Triple> = {}
  for (const [name, triple] of Object.entries(pose.bones ?? {})) {
    bones[mirrorName(name)] = mirrorTriple(triple)
  }
  const move = pose.move
  return {
    move: move ? ([-move[0], move[1], move[2]] as Triple) : undefined,
    turn: pose.turn === undefined ? undefined : -pose.turn,
    bones,
  }
}

// ---------------------------------------------------------------------------
// Pose de reposo (de pie, brazos colgando)
// ---------------------------------------------------------------------------

const REST_BONES: Record<string, Triple> = {
  shoulderL: limbL(2, 7, 0),
  elbowL: [12, 0, 0],
  shoulderR: limbR(2, 7, 0),
  elbowR: [12, 0, 0],
  hipL: limbL(0, 2, 0),
  hipR: limbR(0, 2, 0),
  kneeL: [4, 0, 0],
  kneeR: [4, 0, 0],
}

const REST: Pose = { bones: REST_BONES }

/** Pose de carta: de pie con la mano en el cinturon. */
export const POSE_CARTA: Pose = {
  turn: -12,
  bones: {
    ...REST_BONES,
    shoulderR: limbR(18, 26, 0),
    elbowR: [78, 0, 0],
    handR: [0, 0, -18],
    shoulderL: limbL(-6, 12, 0),
    elbowL: [26, 0, 0],
    torso: [2, -10, 0],
    head: [2, 14, 0],
    hips: [0, 8, 0],
    kneeL: [6, 0, 0],
    kneeR: [2, 0, 0],
  },
}

/** Quieto: respira y cambia el peso. Es lo que se ve mientras espera a disparar. */
const QUIETO: Motion = {
  id: 'quieto',
  kind: 'quieto',
  name: 'Quieto',
  hint: 'A la espera, respirando',
  loop: true,
  length: 4.4,
  base: REST,
  keys: [
    { t: 0, pose: { move: [0, 0, 0], bones: { head: [0, 0, 0], torso: [0, 0, 0] } } },
    {
      t: 1.3,
      pose: {
        move: [0.006, 0.012, 0],
        bones: {
          shoulderL: limbL(0, 9, 0),
          shoulderR: limbR(0, 9, 0),
          elbowL: [15, 0, 0],
          elbowR: [15, 0, 0],
          head: [0, -8, 0],
          torso: [1, 3, 0],
        },
      },
    },
    {
      t: 2.6,
      pose: {
        move: [-0.006, 0, 0],
        bones: {
          head: [3, 6, 0],
          torso: [0, -2, 2],
          shoulderL: limbL(4, 6, 0),
          shoulderR: limbR(4, 6, 0),
          kneeR: [8, 0, 0],
        },
      },
    },
    {
      t: 3.4,
      pose: {
        move: [0, 0.006, 0],
        bones: {
          head: [-2, -3, 0],
          torso: [1, 1, -1],
          elbowL: [18, 0, 0],
          shoulderR: limbR(-3, 10, 0),
        },
      },
    },
    { t: 4.4, pose: { move: [0, 0, 0], bones: { head: [0, 0, 0], torso: [0, 0, 0] } } },
  ],
}

// ---------------------------------------------------------------------------
// Ciclo de andar / correr, con parametros: de un motor salen las 10 variantes
// ---------------------------------------------------------------------------

interface CycleSpec {
  /** Apertura de la pierna de delante. */
  stride: number
  /** Cuanto levanta la rodilla al pasar. */
  lift: number
  /** Braceo. */
  arms: number
  /** Sube y baja del cuerpo. */
  bob: number
  /** Balanceo lateral del tronco. */
  sway: number
  /** Giro de cadera y hombros. */
  twist: number
  /** Inclinacion hacia delante. */
  lean: number
  /** Golpe al pisar. */
  stomp: number
  /** Duracion de media zancada. */
  half: number
}

function cycleHalf(s: CycleSpec): Key[] {
  return [
    {
      t: 0,
      pose: {
        move: [0, 0, 0],
        bones: {
          hipL: limbL(s.stride, 3, 0),
          kneeL: [4, 0, 0],
          footL: [-9, 0, 0],
          hipR: limbR(-s.stride * 0.9, 3, 0),
          kneeR: [15, 0, 0],
          footR: [16, 0, 0],
          shoulderL: limbL(-s.arms, 7, 0),
          elbowL: [14 + s.arms * 0.25, 0, 0],
          shoulderR: limbR(s.arms, 7, 0),
          elbowR: [20 + s.arms * 0.2, 0, 0],
          torso: [s.lean, s.twist, s.sway],
          hips: [0, -s.twist * 0.8, s.sway * 0.5],
          head: [0, -s.twist * 0.4, 0],
        },
      },
    },
    {
      t: s.half * 0.38,
      pose: {
        move: [0, -0.016 - s.bob * 0.6 - s.stomp * 0.02, 0],
        bones: {
          hipL: limbL(s.stride * 0.5, 3, 0),
          kneeL: [11 + s.stomp * 26, 0, 0],
          footL: [2, 0, 0],
          hipR: limbR(-s.stride * 0.3, 3, 0),
          kneeR: [26, 0, 0],
          footR: [6, 0, 0],
          shoulderL: limbL(-s.arms * 0.55, 7, 0),
          elbowL: [14, 0, 0],
          shoulderR: limbR(s.arms * 0.6, 7, 0),
          elbowR: [20, 0, 0],
          torso: [s.lean + 1, s.twist * 0.4, s.sway],
          hips: [0, -s.twist * 0.3, s.sway * 0.4],
        },
      },
    },
    {
      t: s.half * 0.74,
      pose: {
        move: [0, 0.01 + s.bob, 0],
        bones: {
          hipL: limbL(0, 2, 0),
          kneeL: [7, 0, 0],
          footL: [0, 0, 0],
          hipR: limbR(s.stride * 0.28, 3, 0),
          kneeR: [40 + s.lift, 0, 0],
          footR: [-6 - s.lift * 0.4, 0, 0],
          shoulderL: limbL(0, 7, 0),
          elbowL: [13, 0, 0],
          shoulderR: limbR(0, 7, 0),
          elbowR: [13, 0, 0],
          torso: [s.lean, 0, s.sway * 0.5],
          hips: [0, 0, s.sway * 0.3],
          head: [0, 0, 0],
        },
      },
    },
    {
      t: s.half * 0.9,
      pose: {
        move: [0, 0.002, 0],
        bones: {
          hipL: limbL(-s.stride * 0.45, 3, 0),
          kneeL: [6, 0, 0],
          footL: [8, 0, 0],
          hipR: limbR(s.stride * 0.7, 3, 0),
          kneeR: [20, 0, 0],
          footR: [-10, 0, 0],
          shoulderL: limbL(s.arms * 0.35, 7, 0),
          elbowL: [13, 0, 0],
          shoulderR: limbR(-s.arms * 0.4, 7, 0),
          elbowR: [15, 0, 0],
          torso: [s.lean, -s.twist * 0.6, -s.sway * 0.2],
          hips: [0, s.twist * 0.5, 0],
          head: [0, s.twist * 0.3, 0],
        },
      },
    },
  ]
}

function cycleMotion(
  id: string,
  kind: 'andar' | 'correr',
  name: string,
  hint: string,
  s: CycleSpec,
): Motion {
  const half = cycleHalf(s)
  return {
    id,
    kind,
    name,
    hint,
    loop: true,
    length: s.half * 2,
    keys: [
      ...half,
      ...half.map((key) => ({ t: key.t + s.half, pose: mirrorPose(key.pose) })),
      { t: s.half * 2, pose: half[0].pose },
    ],
  }
}

// ---------------------------------------------------------------------------
// ANDAR 1-5
// ---------------------------------------------------------------------------

const ANDAR: Motion[] = [
  cycleMotion('andar-1', 'andar', 'Andar 1 · Firme', 'Paso tranquilo y equilibrado', {
    stride: 24, lift: 22, arms: 28, bob: 0.012, sway: 0, twist: 4, lean: 2, stomp: 0.1, half: 0.56,
  }),
  cycleMotion('andar-2', 'andar', 'Andar 2 · Vaquero', 'Contoneo de cadera, pinta de pistolero', {
    stride: 21, lift: 20, arms: 20, bob: 0.01, sway: 0.1, twist: 9, lean: 1, stomp: 0.05, half: 0.62,
  }),
  cycleMotion('andar-3', 'andar', 'Andar 3 · Pesado', 'Pisotones, se deja caer el peso', {
    stride: 16, lift: 16, arms: 12, bob: 0.02, sway: 0.03, twist: 3, lean: 4, stomp: 0.7, half: 0.7,
  }),
  cycleMotion('andar-4', 'andar', 'Andar 4 · Apresurado', 'Paso corto y rapido, echado hacia delante', {
    stride: 30, lift: 30, arms: 44, bob: 0.014, sway: 0.02, twist: 6, lean: 7, stomp: 0.15, half: 0.44,
  }),
  cycleMotion('andar-5', 'andar', 'Andar 5 · Desgarbado', 'Brazos sueltos y hombros bailones', {
    stride: 27, lift: 34, arms: 36, bob: 0.018, sway: 0.15, twist: 15, lean: 0, stomp: 0.2, half: 0.52,
  }),
]

// ---------------------------------------------------------------------------
// CORRER 1-5
// ---------------------------------------------------------------------------

const CORRER: Motion[] = [
  cycleMotion('correr-1', 'correr', 'Correr 1 · Zancada', 'Carrera normal, zancada larga', {
    stride: 44, lift: 34, arms: 50, bob: 0.05, sway: 0.02, twist: 8, lean: 14, stomp: 0.1, half: 0.24,
  }),
  cycleMotion('correr-2', 'correr', 'Correr 2 · Bombeo', 'Brazos bombeando alto a cada zancada', {
    stride: 40, lift: 30, arms: 80, bob: 0.045, sway: 0.01, twist: 6, lean: 18, stomp: 0.1, half: 0.23,
  }),
  cycleMotion('correr-3', 'correr', 'Correr 3 · Sprint', 'Encorvado hacia delante, a por todas', {
    stride: 54, lift: 40, arms: 46, bob: 0.055, sway: 0.01, twist: 9, lean: 25, stomp: 0.05, half: 0.21,
  }),
  cycleMotion('correr-4', 'correr', 'Correr 4 · Pisotón', 'Pisa fuerte, se nota el golpe', {
    stride: 38, lift: 44, arms: 30, bob: 0.075, sway: 0.05, twist: 5, lean: 12, stomp: 0.9, half: 0.26,
  }),
  cycleMotion('correr-5', 'correr', 'Correr 5 · Galope', 'Bota el suelo, pinta de caballo', {
    stride: 56, lift: 26, arms: 42, bob: 0.095, sway: 0.07, twist: 13, lean: 16, stomp: 0.3, half: 0.22,
  }),
]

// ---------------------------------------------------------------------------
// DISPARAR 1-5
// ---------------------------------------------------------------------------

const DISPARAR: Motion[] = [
  {
    id: 'disparar-1',
    kind: 'disparar',
    name: 'Disparar 1 · Apuntado',
    hint: 'Levanta el brazo, apunta y suelta el tiro',
    loop: false,
    length: 1.25,
    firesAt: [0.24],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.18,
        pose: {
          bones: {
            shoulderR: limbR(78, 12, 0),
            elbowR: [12, 0, 0],
            handR: [0, 0, -6],
            shoulderL: limbL(-14, 16, 0),
            elbowL: [34, 0, 0],
            torso: [2, -16, 0],
            hips: [0, -8, 0],
            head: [0, -12, 0],
          },
        },
      },
      {
        t: 0.26,
        pose: {
          move: [0, 0, -0.03],
          bones: {
            shoulderR: limbR(66, 12, 0),
            elbowR: [34, 0, 0],
            shoulderL: limbL(-18, 18, 0),
            torso: [-6, -14, 0],
            head: [-4, -10, 0],
          },
        },
      },
      {
        t: 0.5,
        pose: { bones: { shoulderR: limbR(48, 14, 0), elbowR: [22, 0, 0], torso: [0, -8, 0] } },
      },
      { t: 0.8, pose: { bones: {} } },
      { t: 1.25, pose: { bones: {} } },
    ],
  },
  {
    id: 'disparar-2',
    kind: 'disparar',
    name: 'Disparar 2 · A la cadera',
    hint: 'Sin levantar el brazo: tiro rapido desde la cadera',
    loop: false,
    length: 1,
    firesAt: [0.18],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.14,
        pose: {
          bones: {
            shoulderR: limbR(26, 12, 0),
            elbowR: [64, 0, 0],
            handR: [0, 0, -14],
            torso: [4, -12, 0],
            hips: [0, -6, 0],
            head: [4, -8, 0],
            kneeL: [12, 0, 0],
            kneeR: [12, 0, 0],
          },
        },
      },
      {
        t: 0.2,
        pose: { move: [0, -0.02, -0.02], bones: { shoulderR: limbR(18, 12, 0), elbowR: [78, 0, 0], torso: [0, -10, 0] } },
      },
      { t: 0.5, pose: { bones: {} } },
      { t: 1, pose: { bones: {} } },
    ],
  },
  {
    id: 'disparar-3',
    kind: 'disparar',
    name: 'Disparar 3 · De lado',
    hint: 'Gira el cuerpo entero y dispara de perfil',
    loop: false,
    length: 1.4,
    firesAt: [0.3],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.24,
        pose: {
          turn: -34,
          bones: {
            shoulderR: limbR(82, 6, 0),
            elbowR: [16, 0, 0],
            shoulderL: limbL(24, 20, 0),
            elbowL: [64, 0, 0],
            torso: [2, -22, 0],
            hips: [0, -14, 0],
            head: [0, -26, 0],
          },
        },
      },
      {
        t: 0.34,
        pose: {
          turn: -34,
          move: [0, 0, -0.028],
          bones: {
            shoulderR: limbR(70, 6, 0),
            elbowR: [36, 0, 0],
            torso: [-5, -20, 0],
            head: [-4, -24, 0],
          },
        },
      },
      { t: 0.7, pose: { turn: -14, bones: { shoulderR: limbR(40, 14, 0), torso: [0, -8, 0] } } },
      { t: 1.1, pose: { bones: {} } },
      { t: 1.4, pose: { bones: {} } },
    ],
  },
  {
    id: 'disparar-4',
    kind: 'disparar',
    name: 'Disparar 4 · Rafaga',
    hint: 'Dos tiros seguidos sin bajar el brazo',
    loop: false,
    length: 1.5,
    firesAt: [0.22, 0.6],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.16,
        pose: {
          bones: {
            shoulderR: limbR(76, 12, 0),
            elbowR: [14, 0, 0],
            shoulderL: limbL(-10, 18, 0),
            elbowL: [40, 0, 0],
            torso: [2, -14, 0],
            hips: [0, -7, 0],
            head: [0, -10, 0],
          },
        },
      },
      {
        t: 0.24,
        pose: { move: [0, 0, -0.024], bones: { shoulderR: limbR(64, 12, 0), elbowR: [30, 0, 0], torso: [-4, -12, 0] } },
      },
      { t: 0.42, pose: { bones: { shoulderR: limbR(74, 12, 0), elbowR: [16, 0, 0], torso: [1, -13, 0] } } },
      {
        t: 0.62,
        pose: { move: [0, 0, -0.024], bones: { shoulderR: limbR(62, 12, 0), elbowR: [32, 0, 0], torso: [-4, -11, 0] } },
      },
      { t: 0.95, pose: { bones: { shoulderR: limbR(40, 14, 0), elbowR: [24, 0, 0] } } },
      { t: 1.2, pose: { bones: {} } },
      { t: 1.5, pose: { bones: {} } },
    ],
  },
  {
    id: 'disparar-5',
    kind: 'disparar',
    name: 'Disparar 5 · Rodilla en tierra',
    hint: 'Se arrodilla, dispara y se vuelve a levantar',
    loop: false,
    length: 1.9,
    firesAt: [0.75],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.35,
        pose: {
          move: [0, -0.16, 0],
          bones: {
            hipR: limbR(-40, 6, 0),
            kneeR: [110, 0, 0],
            footR: [34, 0, 0],
            hipL: limbL(52, 10, 0),
            kneeL: [66, 0, 0],
            footL: [-6, 0, 0],
            shoulderR: limbR(74, 14, 0),
            elbowR: [14, 0, 0],
            shoulderL: limbL(-24, 20, 0),
            elbowL: [52, 0, 0],
            torso: [10, -14, 0],
            head: [2, -10, 0],
          },
        },
      },
      {
        t: 0.8,
        pose: {
          move: [0, -0.15, -0.026],
          bones: {
            shoulderR: limbR(62, 14, 0),
            elbowR: [32, 0, 0],
            torso: [4, -12, 0],
            head: [-3, -9, 0],
          },
        },
      },
      {
        t: 1.2,
        pose: {
          move: [0, -0.1, 0],
          bones: { shoulderR: limbR(30, 14, 0), elbowR: [40, 0, 0], torso: [6, -6, 0] },
        },
      },
      {
        t: 1.6,
        pose: {
          move: [0, -0.03, 0],
          bones: { hipR: limbR(-8, 4, 0), kneeR: [26, 0, 0], hipL: limbL(10, 4, 0), kneeL: [20, 0, 0] },
        },
      },
      { t: 1.9, pose: { bones: {} } },
    ],
  },
]

// ---------------------------------------------------------------------------
// IMPACTADO DE BALA 1-5
// ---------------------------------------------------------------------------

const IMPACTO: Motion[] = [
  {
    id: 'impacto-1',
    kind: 'impacto',
    name: 'Impacto 1 · Tiron atras',
    hint: 'El golpe le tira el cuerpo hacia atras',
    loop: false,
    length: 0.55,
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.1,
        pose: {
          move: [0, -0.01, -0.05],
          bones: {
            torso: [-22, 0, 0],
            neck: [-10, 0, 0],
            head: [-24, 0, 0],
            shoulderL: limbL(-34, 26, 0),
            shoulderR: limbR(-34, 26, 0),
            elbowL: [40, 0, 0],
            elbowR: [40, 0, 0],
            kneeL: [18, 0, 0],
            kneeR: [18, 0, 0],
          },
        },
      },
      { t: 0.3, pose: { move: [0, 0, -0.012], bones: { torso: [-7, 0, 0], head: [-8, 0, 0] } } },
      { t: 0.55, pose: { bones: {} } },
    ],
  },
  {
    id: 'impacto-2',
    kind: 'impacto',
    name: 'Impacto 2 · Tambaleo',
    hint: 'Se le va el cuerpo de lado y da un paso',
    loop: false,
    length: 0.65,
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.12,
        pose: {
          move: [0.06, -0.01, 0],
          bones: {
            torso: [-4, 0, 20],
            hips: [0, 0, -8],
            head: [-6, -14, 14],
            shoulderL: limbL(-20, 44, 0),
            shoulderR: limbR(14, 18, 0),
            kneeL: [26, 0, 0],
            kneeR: [8, 0, 0],
          },
        },
      },
      {
        t: 0.32,
        pose: { move: [0.03, 0, 0], bones: { torso: [0, 0, 8], head: [0, -6, 4] } },
      },
      { t: 0.65, pose: { bones: {} } },
    ],
  },
  {
    id: 'impacto-3',
    kind: 'impacto',
    name: 'Impacto 3 · Giro',
    hint: 'El golpe le hace girar sobre si mismo',
    loop: false,
    length: 0.7,
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.14,
        pose: {
          turn: 30,
          bones: {
            torso: [-8, 24, 0],
            hips: [0, 16, 0],
            head: [-8, 30, 0],
            shoulderL: limbL(30, 30, 0),
            shoulderR: limbR(-24, 40, 0),
            elbowL: [56, 0, 0],
            kneeR: [20, 0, 0],
          },
        },
      },
      { t: 0.4, pose: { turn: 12, bones: { torso: [0, 10, 0], head: [0, 12, 0] } } },
      { t: 0.7, pose: { bones: {} } },
    ],
  },
  {
    id: 'impacto-4',
    kind: 'impacto',
    name: 'Impacto 4 · Encogida',
    hint: 'Se encorva y se protege el pecho',
    loop: false,
    length: 0.6,
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.12,
        pose: {
          move: [0, -0.05, -0.03],
          bones: {
            torso: [26, 0, 0],
            neck: [8, 0, 0],
            head: [26, 0, 0],
            shoulderL: limbL(46, 30, 0),
            shoulderR: limbR(46, 30, 0),
            elbowL: [96, 0, 0],
            elbowR: [96, 0, 0],
            hipL: limbL(14, 6, 0),
            hipR: limbR(14, 6, 0),
            kneeL: [34, 0, 0],
            kneeR: [34, 0, 0],
          },
        },
      },
      { t: 0.34, pose: { move: [0, -0.02, 0], bones: { torso: [10, 0, 0], elbowL: [50, 0, 0], elbowR: [50, 0, 0] } } },
      { t: 0.6, pose: { bones: {} } },
    ],
  },
  {
    id: 'impacto-5',
    kind: 'impacto',
    name: 'Impacto 5 · Salto',
    hint: 'El impacto le levanta los pies del suelo',
    loop: false,
    length: 0.7,
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.14,
        pose: {
          move: [0, 0.14, -0.06],
          bones: {
            torso: [-16, 0, 0],
            head: [-14, 0, 0],
            shoulderL: limbL(140, 30, 0),
            shoulderR: limbR(140, 30, 0),
            hipL: limbL(26, 8, 0),
            hipR: limbR(26, 8, 0),
            kneeL: [54, 0, 0],
            kneeR: [54, 0, 0],
            footL: [20, 0, 0],
            footR: [20, 0, 0],
          },
        },
      },
      {
        t: 0.4,
        pose: { move: [0, -0.06, 0], bones: { torso: [8, 0, 0], kneeL: [40, 0, 0], kneeR: [40, 0, 0] } },
      },
      { t: 0.7, pose: { bones: {} } },
    ],
  },
]

// ---------------------------------------------------------------------------
// MORIR 1-5: la sacudida previa y como se desmonta
// ---------------------------------------------------------------------------

const MORIR: Motion[] = [
  {
    id: 'morir-1',
    kind: 'morir',
    name: 'Morir 1 · Estallido',
    hint: 'Las piezas salen despedidas hacia todos lados',
    loop: false,
    length: 0.42,
    burst: 'estallido',
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.24,
        pose: {
          move: [0, 0.02, 0],
          bones: {
            torso: [-18, 0, 0],
            head: [-24, 0, 0],
            shoulderL: limbL(-40, 62, 0),
            shoulderR: limbR(-40, 62, 0),
            elbowL: [10, 0, 0],
            elbowR: [10, 0, 0],
            hipL: limbL(0, 16, 0),
            hipR: limbR(0, 16, 0),
            kneeL: [10, 0, 0],
            kneeR: [10, 0, 0],
          },
        },
      },
      { t: 0.42, pose: { move: [0, 0.03, 0], bones: { torso: [-24, 0, 0], head: [-30, 0, 0] } } },
    ],
  },
  {
    id: 'morir-2',
    kind: 'morir',
    name: 'Morir 2 · Derrumbe',
    hint: 'Se desmorona hacia delante en un monton',
    loop: false,
    length: 0.5,
    burst: 'derrumbe',
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.3,
        pose: {
          move: [0, -0.1, 0.02],
          bones: {
            torso: [40, 0, 0],
            neck: [14, 0, 0],
            head: [44, 0, 0],
            shoulderL: limbL(-16, 20, 0),
            shoulderR: limbR(-16, 20, 0),
            elbowL: [26, 0, 0],
            elbowR: [26, 0, 0],
            hipL: limbL(24, 8, 0),
            hipR: limbR(24, 8, 0),
            kneeL: [52, 0, 0],
            kneeR: [52, 0, 0],
          },
        },
      },
      { t: 0.5, pose: { move: [0, -0.16, 0.04], bones: { torso: [52, 0, 0], head: [56, 0, 0], kneeL: [64, 0, 0], kneeR: [64, 0, 0] } } },
    ],
  },
  {
    id: 'morir-3',
    kind: 'morir',
    name: 'Morir 3 · Hacia arriba',
    hint: 'Las piezas saltan hacia arriba antes de caer',
    loop: false,
    length: 0.38,
    burst: 'arriba',
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.2,
        pose: {
          move: [0, 0.05, 0],
          bones: {
            torso: [-30, 0, 0],
            neck: [-12, 0, 0],
            head: [-34, 0, 0],
            shoulderL: limbL(170, 18, 0),
            shoulderR: limbR(170, 18, 0),
            elbowL: [4, 0, 0],
            elbowR: [4, 0, 0],
          },
        },
      },
      { t: 0.38, pose: { move: [0, 0.08, 0], bones: { torso: [-36, 0, 0], head: [-40, 0, 0] } } },
    ],
  },
  {
    id: 'morir-4',
    kind: 'morir',
    name: 'Morir 4 · En dos mitades',
    hint: 'La mitad de arriba se va, la de abajo se queda',
    loop: false,
    length: 0.46,
    burst: 'mitades',
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.26,
        pose: {
          move: [0.02, -0.02, 0],
          bones: {
            torso: [0, 0, 34],
            hips: [0, 0, -14],
            head: [0, -20, 26],
            shoulderL: limbL(20, 50, 0),
            shoulderR: limbR(-26, 70, 0),
            kneeL: [18, 0, 0],
            kneeR: [30, 0, 0],
          },
        },
      },
      { t: 0.46, pose: { move: [0.04, -0.03, 0], bones: { torso: [0, 0, 40], hips: [0, 0, -18] } } },
    ],
  },
  {
    id: 'morir-5',
    kind: 'morir',
    name: 'Morir 5 · Desarme',
    hint: 'Se queda tieso y las piezas se van cayendo',
    loop: false,
    length: 0.55,
    burst: 'desarme',
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.28,
        pose: {
          bones: {
            torso: [-10, 0, 0],
            head: [-12, 0, 0],
            shoulderL: limbL(-10, 14, 0),
            shoulderR: limbR(-10, 14, 0),
            elbowL: [6, 0, 0],
            elbowR: [6, 0, 0],
            kneeL: [6, 0, 0],
            kneeR: [6, 0, 0],
          },
        },
      },
      { t: 0.55, pose: { move: [0, -0.02, 0], bones: { torso: [-14, 0, 0], head: [-16, 0, 0], kneeL: [14, 0, 0], kneeR: [14, 0, 0] } } },
    ],
  },
]

// ---------------------------------------------------------------------------
// GOLPES (vikingos, cuerpo a cuerpo) y FLECHAS (indios): otras formas de pegar que el tiro del vaquero
// ---------------------------------------------------------------------------

const GOLPES: Motion[] = [
  {
    id: 'golpe-1',
    kind: 'disparar',
    name: 'Golpe 1 · Hachazo',
    hint: 'Alza el hacha sobre la cabeza y la deja caer de lleno',
    loop: false,
    length: 1,
    firesAt: [0.36],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.22,
        pose: {
          bones: {
            shoulderR: limbR(170, 10, 0),
            elbowR: [35, 0, 0],
            shoulderL: limbL(-10, 16, 0),
            torso: [-10, -10, 0],
            head: [-6, 0, 0],
            hips: [0, -6, 0],
            kneeL: [10, 0, 0],
            kneeR: [10, 0, 0],
          },
        },
      },
      {
        t: 0.36,
        pose: {
          move: [0, -0.04, 0.16],
          bones: {
            shoulderR: limbR(25, 8, 0),
            elbowR: [14, 0, 0],
            shoulderL: limbL(-6, 14, 0),
            torso: [30, -8, 0],
            head: [12, 0, 0],
            kneeL: [22, 0, 0],
            kneeR: [8, 0, 0],
          },
        },
      },
      { t: 0.62, pose: { bones: { shoulderR: limbR(40, 8, 0), elbowR: [20, 0, 0], torso: [14, -4, 0] } } },
      { t: 1, pose: { bones: {} } },
    ],
  },
  {
    id: 'golpe-2',
    kind: 'disparar',
    name: 'Golpe 2 · Martillazo a dos manos',
    hint: 'Levanta el martillo con las dos manos y lo estrella contra el suelo',
    loop: false,
    length: 1.2,
    firesAt: [0.46],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.3,
        pose: {
          bones: {
            shoulderR: limbR(165, 6, 0),
            shoulderL: limbL(165, 6, 0),
            elbowR: [40, 0, 0],
            elbowL: [40, 0, 0],
            torso: [-18, 0, 0],
            head: [-10, 0, 0],
            kneeL: [16, 0, 0],
            kneeR: [16, 0, 0],
          },
        },
      },
      {
        t: 0.46,
        pose: {
          move: [0, -0.09, 0.2],
          bones: {
            shoulderR: limbR(12, 6, 0),
            shoulderL: limbL(12, 6, 0),
            elbowR: [10, 0, 0],
            elbowL: [10, 0, 0],
            torso: [38, 0, 0],
            head: [16, 0, 0],
            kneeL: [34, 0, 0],
            kneeR: [34, 0, 0],
          },
        },
      },
      { t: 0.8, pose: { bones: { shoulderR: limbR(30, 6, 0), shoulderL: limbL(30, 6, 0), torso: [20, 0, 0], kneeL: [20, 0, 0], kneeR: [20, 0, 0] } } },
      { t: 1.2, pose: { bones: {} } },
    ],
  },
  {
    id: 'golpe-3',
    kind: 'disparar',
    name: 'Golpe 3 · Barrido',
    hint: 'Gira el cuerpo entero y barre de un lado a otro con el arma',
    loop: false,
    length: 0.95,
    firesAt: [0.36],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.2,
        pose: {
          bones: {
            torso: [0, 55, 0],
            hips: [0, 30, 0],
            head: [0, 20, 0],
            shoulderR: limbR(95, 70, 0),
            elbowR: [10, 0, 0],
            shoulderL: limbL(-6, 20, 0),
            kneeL: [14, 0, 0],
            kneeR: [14, 0, 0],
          },
        },
      },
      {
        t: 0.36,
        pose: {
          move: [0, -0.03, 0.12],
          bones: {
            torso: [4, -60, 0],
            hips: [0, -30, 0],
            head: [0, -24, 0],
            shoulderR: limbR(90, 20, 0),
            elbowR: [8, 0, 0],
            kneeL: [22, 0, 0],
            kneeR: [10, 0, 0],
          },
        },
      },
      { t: 0.6, pose: { bones: { torso: [0, -24, 0], hips: [0, -10, 0], shoulderR: limbR(50, 14, 0) } } },
      { t: 0.95, pose: { bones: {} } },
    ],
  },
  {
    id: 'golpe-4',
    kind: 'disparar',
    name: 'Golpe 4 · Embestida con escudo',
    hint: 'Se tira de hombro con el escudo por delante y arrolla',
    loop: false,
    length: 0.9,
    firesAt: [0.3],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.18,
        pose: {
          bones: {
            torso: [-6, 0, 0],
            shoulderL: limbL(70, 30, 0),
            elbowL: [80, 0, 0],
            shoulderR: limbR(30, 14, 0),
            elbowR: [60, 0, 0],
            kneeL: [18, 0, 0],
            kneeR: [18, 0, 0],
          },
        },
      },
      {
        t: 0.3,
        pose: {
          move: [0, -0.03, 0.3],
          bones: {
            torso: [24, 0, 0],
            head: [8, 0, 0],
            shoulderL: limbL(95, 10, 0),
            elbowL: [20, 0, 0],
            shoulderR: limbR(60, 10, 0),
            elbowR: [50, 0, 0],
            kneeL: [26, 0, 0],
            kneeR: [6, 0, 0],
          },
        },
      },
      { t: 0.55, pose: { bones: { torso: [10, 0, 0], shoulderL: limbL(50, 12, 0) } } },
      { t: 0.9, pose: { bones: {} } },
    ],
  },
  {
    id: 'golpe-5',
    kind: 'disparar',
    name: 'Golpe 5 · Estocada',
    hint: 'Echa la lanza atras y la clava al frente de un paso',
    loop: false,
    length: 1,
    firesAt: [0.28],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.18,
        pose: {
          bones: {
            shoulderR: limbR(40, 6, 0),
            elbowR: [110, 0, 0],
            shoulderL: limbL(50, 20, 0),
            elbowL: [60, 0, 0],
            torso: [-4, -24, 0],
            hips: [0, -14, 0],
            kneeL: [14, 0, 0],
          },
        },
      },
      {
        t: 0.28,
        pose: {
          move: [0, -0.02, 0.22],
          bones: {
            shoulderR: limbR(85, 6, 0),
            elbowR: [6, 0, 0],
            shoulderL: limbL(70, 18, 0),
            elbowL: [30, 0, 0],
            torso: [10, 16, 0],
            hips: [0, 10, 0],
            kneeL: [28, 0, 0],
          },
        },
      },
      { t: 0.5, pose: { bones: { shoulderR: limbR(80, 6, 0), torso: [8, 10, 0], kneeL: [22, 0, 0] } } },
      { t: 1, pose: { bones: {} } },
    ],
  },
]

const FLECHAS: Motion[] = [
  {
    id: 'flecha-1',
    kind: 'disparar',
    name: 'Flecha 1 · Tensar el arco',
    hint: 'Alarga el brazo del arco, tira de la cuerda hasta la mejilla y suelta',
    loop: false,
    length: 1.3,
    firesAt: [0.5],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.2,
        pose: {
          bones: {
            shoulderL: limbL(84, 4, 0),
            elbowL: [4, 0, 0],
            shoulderR: limbR(60, 22, 0),
            elbowR: [120, 0, 0],
            torso: [0, -26, 0],
            hips: [0, -12, 0],
            head: [0, -14, 0],
          },
        },
      },
      { t: 0.42, pose: { bones: { shoulderL: limbL(86, 4, 0), shoulderR: limbR(62, 26, 0), elbowR: [132, 0, 0], torso: [0, -28, 0], hips: [0, -12, 0], head: [0, -16, 0] } } },
      { t: 0.5, pose: { bones: { shoulderL: limbL(84, 4, 0), shoulderR: limbR(55, 36, 0), elbowR: [70, 0, 0], torso: [0, -24, 0], hips: [0, -10, 0] } } },
      { t: 0.8, pose: { bones: { shoulderL: limbL(60, 6, 0), shoulderR: limbR(30, 14, 0), elbowR: [40, 0, 0], torso: [0, -10, 0] } } },
      { t: 1.3, pose: { bones: {} } },
    ],
  },
  {
    id: 'flecha-2',
    kind: 'disparar',
    name: 'Flecha 2 · Disparo alto',
    hint: 'Apunta al cielo para que la flecha caiga de arriba',
    loop: false,
    length: 1.3,
    firesAt: [0.5],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.22,
        pose: {
          bones: {
            shoulderL: limbL(125, 6, 0),
            elbowL: [4, 0, 0],
            shoulderR: limbR(98, 24, 0),
            elbowR: [125, 0, 0],
            torso: [-12, -20, 0],
            head: [-18, -10, 0],
            hips: [0, -10, 0],
            kneeL: [8, 0, 0],
          },
        },
      },
      { t: 0.5, pose: { bones: { shoulderL: limbL(122, 6, 0), shoulderR: limbR(92, 34, 0), elbowR: [72, 0, 0], torso: [-14, -18, 0], head: [-20, -8, 0] } } },
      { t: 0.85, pose: { bones: { shoulderL: limbL(70, 8, 0), shoulderR: limbR(40, 14, 0), torso: [-4, -8, 0] } } },
      { t: 1.3, pose: { bones: {} } },
    ],
  },
  {
    id: 'flecha-3',
    kind: 'disparar',
    name: 'Flecha 3 · De rodillas',
    hint: 'Se agacha sobre una rodilla para afinar la punteria',
    loop: false,
    length: 1.35,
    firesAt: [0.52],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.24,
        pose: {
          move: [0, -0.24, 0],
          bones: {
            shoulderL: limbL(86, 4, 0),
            elbowL: [4, 0, 0],
            shoulderR: limbR(60, 22, 0),
            elbowR: [122, 0, 0],
            torso: [6, -26, 0],
            hips: [0, -12, 0],
            head: [0, -14, 0],
            kneeL: [60, 0, 0],
            kneeR: [96, 0, 0],
            hipL: limbL(52, 2, 0),
            hipR: limbR(48, 2, 0),
          },
        },
      },
      { t: 0.52, pose: { move: [0, -0.24, 0], bones: { shoulderL: limbL(86, 4, 0), shoulderR: limbR(56, 36, 0), elbowR: [70, 0, 0], torso: [6, -24, 0], kneeL: [60, 0, 0], kneeR: [96, 0, 0], hipL: limbL(52, 2, 0), hipR: limbR(48, 2, 0) } } },
      { t: 0.95, pose: { bones: {} } },
      { t: 1.35, pose: { bones: {} } },
    ],
  },
  {
    id: 'flecha-4',
    kind: 'disparar',
    name: 'Flecha 4 · Tiro rápido',
    hint: 'Casi sin apuntar: tensa y suelta en un parpadeo',
    loop: false,
    length: 0.85,
    firesAt: [0.28],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.14,
        pose: {
          bones: {
            shoulderL: limbL(80, 4, 0),
            shoulderR: limbR(58, 22, 0),
            elbowR: [118, 0, 0],
            torso: [0, -22, 0],
            hips: [0, -10, 0],
            kneeL: [10, 0, 0],
            kneeR: [10, 0, 0],
          },
        },
      },
      { t: 0.28, pose: { bones: { shoulderL: limbL(80, 4, 0), shoulderR: limbR(50, 34, 0), elbowR: [64, 0, 0], torso: [0, -20, 0] } } },
      { t: 0.55, pose: { bones: { shoulderL: limbL(40, 6, 0), shoulderR: limbR(26, 12, 0), torso: [0, -6, 0] } } },
      { t: 0.85, pose: { bones: {} } },
    ],
  },
  {
    id: 'flecha-5',
    kind: 'disparar',
    name: 'Flecha 5 · Lanzamiento',
    hint: 'Echa el brazo atras y lanza la lanza o el hacha de un golpe',
    loop: false,
    length: 1.05,
    firesAt: [0.34],
    base: REST,
    keys: [
      { t: 0, pose: { bones: {} } },
      {
        t: 0.22,
        pose: {
          bones: {
            shoulderR: limbR(-42, 14, 0),
            elbowR: [100, 0, 0],
            shoulderL: limbL(70, 20, 0),
            elbowL: [20, 0, 0],
            torso: [-10, -30, 0],
            hips: [0, -18, 0],
            head: [0, -10, 0],
            kneeL: [14, 0, 0],
          },
        },
      },
      {
        t: 0.34,
        pose: {
          move: [0, -0.02, 0.08],
          bones: {
            shoulderR: limbR(150, 8, 0),
            elbowR: [10, 0, 0],
            shoulderL: limbL(20, 18, 0),
            torso: [22, 18, 0],
            hips: [0, 14, 0],
            head: [8, 8, 0],
            kneeL: [24, 0, 0],
          },
        },
      },
      { t: 0.62, pose: { bones: { shoulderR: limbR(80, 8, 0), torso: [10, 8, 0] } } },
      { t: 1.05, pose: { bones: {} } },
    ],
  },
]

export const MOTIONS: Motion[] = [QUIETO, ...ANDAR, ...CORRER, ...DISPARAR, ...GOLPES, ...FLECHAS, ...IMPACTO, ...MORIR]

/** Las categorias que se eligen en la ficha de la carta. */
export const KINDS: { kind: MotionKind; label: string; note: string }[] = [
  { kind: 'andar', label: 'Andar', note: 'Como se mueve al sacarlo y por la calle' },
  { kind: 'correr', label: 'Correr', note: 'Lo que hace cuando la partida se acelera' },
  { kind: 'disparar', label: 'Disparar', note: 'La pose con la que suelta el tiro' },
  { kind: 'impacto', label: 'Impactado de bala', note: 'La sacudida cuando le dan' },
  { kind: 'morir', label: 'Morir', note: 'Como se rompe en piezas al perder el escudo' },
]

export function variantsOf(kind: MotionKind): Motion[] {
  return MOTIONS.filter((motion) => motion.kind === kind)
}

export function motionById(id: string): Motion {
  return MOTIONS.find((motion) => motion.id === id) ?? QUIETO
}

/** Elige al azar una variante de una categoria, sin repetir la de ahora. */
export function pickVariant(kind: MotionKind, exceptId?: string): Motion {
  const pool = variantsOf(kind).filter((motion) => motion.id !== exceptId)
  const list = pool.length > 0 ? pool : variantsOf(kind)
  return list[Math.floor(Math.random() * list.length)]
}

// ---------------------------------------------------------------------------
// Motor: saca la pose de un instante y sabe mezclar dos movimientos
// ---------------------------------------------------------------------------

function values(pose: Pose | undefined, bone: string, fallback: Triple): Triple {
  if (!pose) return fallback
  return pose.bones?.[bone] ?? fallback
}

function lerpTriple(a: Triple, b: Triple, t: number): Triple {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function ease(t: number): number {
  return t * t * (3 - 2 * t)
}

export function samplePose(motion: Motion, time: number): Pose {
  const keys = motion.keys
  if (keys.length === 0) return motion.base ?? {}
  const length = motion.length
  const t = motion.loop ? ((time % length) + length) % length : Math.max(0, Math.min(time, length))

  let index = keys.length - 1
  for (let i = 0; i < keys.length - 1; i++) {
    if (t <= keys[i + 1].t) {
      index = i
      break
    }
  }

  const from = keys[index]
  const to = keys[Math.min(index + 1, keys.length - 1)]
  const span = to.t - from.t
  const raw = span <= 0.0001 ? 0 : (t - from.t) / span
  const f = ease(Math.max(0, Math.min(1, raw)))

  const bones: Record<string, Triple> = {}
  for (const bone of BONE_NAMES) {
    const rest = motion.base?.bones?.[bone] ?? ZERO
    bones[bone] = lerpTriple(values(from.pose, bone, rest), values(to.pose, bone, rest), f)
  }

  const moveFrom = from.pose.move ?? motion.base?.move ?? ZERO
  const moveTo = to.pose.move ?? motion.base?.move ?? ZERO
  const turnFrom = from.pose.turn ?? motion.base?.turn ?? 0
  const turnTo = to.pose.turn ?? motion.base?.turn ?? 0

  return {
    move: lerpTriple(moveFrom, moveTo, f),
    turn: turnFrom + (turnTo - turnFrom) * f,
    bones,
  }
}

/** Mezcla dos poses: sirve para pasar de andar a correr sin costuras. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const bones: Record<string, Triple> = {}
  for (const bone of BONE_NAMES) {
    bones[bone] = lerpTriple(a.bones?.[bone] ?? ZERO, b.bones?.[bone] ?? ZERO, t)
  }
  const moveA = a.move ?? ZERO
  const moveB = b.move ?? ZERO
  return {
    move: lerpTriple(moveA, moveB, t),
    turn: (a.turn ?? 0) + ((b.turn ?? 0) - (a.turn ?? 0)) * t,
    bones,
  }
}
