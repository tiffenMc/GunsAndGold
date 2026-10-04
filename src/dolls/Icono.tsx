import type { CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import {
  GiBullseye,
  GiCardPlay,
  GiCardRandom,
  GiCardboardBoxClosed,
  GiCheckMark,
  GiClapperboard,
  GiCog,
  GiCowboyBoot,
  GiCrossedPistols,
  GiCycle,
  GiDesert,
  GiDynamite,
  GiExitDoor,
  GiFastForwardButton,
  GiFlame,
  GiGraduateCap,
  GiHeartPlus,
  GiHourglass,
  GiKey,
  GiLaurelsTrophy,
  GiLightBulb,
  GiLightningStorm,
  GiMuscleUp,
  GiMusicalNotes,
  GiPadlock,
  GiPerson,
  GiPointing,
  GiPresent,
  GiRevolver,
  GiRunningShoe,
  GiSaloon,
  GiShakingHands,
  GiCheckedShield,
  GiCactus,
  GiStarMedal,
  GiStoneTower,
  GiTargeted,
  GiTwoCoins,
  GiWantedReward,
  GiWesternHat,
  GiSoundOn,
} from 'react-icons/gi'

/**
 * **Los iconos del juego**, todos del mismo paquete (Game Icons, game-icons.net, CC BY 3.0) para
 * que se vean de una pieza. Se piden por su nombre: cambiar uno es cambiarlo aquí y ya está.
 */
const ICONOS = {
  pueblo: GiSaloon,
  cartas: GiCardRandom,
  baraja: GiCardPlay,
  desierto: GiDesert,
  ajustes: GiCog,
  monedas: GiTwoCoins,
  partida: GiCrossedPistols,
  amigos: GiShakingHands,
  codigo: GiKey,
  sobre: GiCardboardBoxClosed,
  regalo: GiPresent,
  incursion: GiCactus,
  entrenar: GiMuscleUp,
  arma: GiRevolver,
  novato: GiCowboyBoot,
  ganar: GiLaurelsTrophy,
  jugar: GiClapperboard,
  racha: GiFlame,
  reloj: GiHourglass,
  candado: GiPadlock,
  reroll: GiCycle,
  punteria: GiBullseye,
  precision: GiTargeted,
  vida: GiHeartPlus,
  cansancio: GiRunningShoe,
  reflejos: GiLightningStorm,
  temple: GiCheckedShield,
  se_busca: GiWantedReward,
  vaquero: GiWesternHat,
  tutorial: GiGraduateCap,
  salir: GiExitDoor,
  sonido: GiSoundOn,
  musica: GiMusicalNotes,
  personaje: GiPerson,
  torre: GiStoneTower,
  dinamita: GiDynamite,
  omitir: GiFastForwardButton,
  idea: GiLightBulb,
  dedo: GiPointing,
  hecho: GiCheckMark,
  medalla: GiStarMedal,
} satisfies Record<string, IconType>

export type NombreDeIcono = keyof typeof ICONOS

export function Icono({
  nombre,
  className = '',
  size = '1.15em',
  style,
}: {
  nombre: NombreDeIcono
  className?: string
  size?: number | string
  style?: CSSProperties
}) {
  const Componente = ICONOS[nombre]
  return <Componente aria-hidden className={`inline-block shrink-0 align-[-0.18em] ${className}`} size={size} style={style} />
}
