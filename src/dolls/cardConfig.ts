/** Las animaciones que se eligen en la ficha de cada carta de batalla (5 variantes de cada). */
export const ANIM_KINDS = ['andar', 'correr', 'disparar', 'impacto', 'morir'] as const
export type AnimKind = (typeof ANIM_KINDS)[number]

export const ANIM_LABEL: Record<AnimKind, string> = {
  andar: 'Andar',
  correr: 'Correr',
  disparar: 'Disparar',
  impacto: 'Recibe un balazo',
  morir: 'Se rompe',
}

export const ANIM_NOTE: Record<AnimKind, string> = {
  andar: 'Como sale al campo y anda hacia la torre',
  correr: 'Desde el 1:30 la partida se acelera y pasan a correr',
  disparar: 'La pose con la que suelta el tiro',
  impacto: 'La sacudida cuando le quitan un escudo',
  morir: 'Como se desmonta en piezas al perder el ultimo escudo',
}

/** Un id de movimiento elegido por cada categoria. */
export type AnimSet = Record<AnimKind, string>
