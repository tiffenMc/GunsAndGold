import type { BattleCard } from '../cards/model'
import { estiloDe } from './estilos'
import type { Estilo } from './estilos'

/**
 * **El papel de cada carta en la pelea**: para qué la sacas. Es lo que se lee de un vistazo (en la
 * mano, en el cartel al sacarla y en el icono que lleva cada muñeco encima): el francotirador va a
 * por los de lejos, el de área revienta grupos, el tanque aguanta y atrae los tiros, la curandera
 * cura… Sale del estilo de la carta (que dice *cómo* pelea): aquí solo se agrupa y se dibuja.
 */

export type Papel =
  | 'tirador'
  | 'rafaga'
  | 'pesado'
  | 'area'
  | 'rebote'
  | 'perfora'
  | 'cuerpo'
  | 'tanque'
  | 'cura'
  | 'apoyo'
  | 'trampa'
  | 'bomba'
  | 'sigilo'
  | 'control'

export interface PapelInfo {
  id: Papel
  /** El nombre del papel. */
  label: string
  /** Y en una palabra (la chapa de la mano). */
  corto: string
  /** Para qué sirve: la razón para sacarla. */
  paraQue: string
  /** El color del icono (claro: el dibujo va en oscuro encima). */
  color: string
  /** El dibujo del icono: trazos de 24×24 (sirven igual para la página y para el lienzo). */
  trazos: { d: string; relleno?: boolean }[]
}

const CIRCULO = (cx: number, cy: number, r: number) => `M${cx + r} ${cy}a${r} ${r} 0 1 1 ${-2 * r} 0a${r} ${r} 0 1 1 ${2 * r} 0`

export const PAPELES: Record<Papel, PapelInfo> = {
  tirador: {
    id: 'tirador',
    label: 'Tirador',
    corto: 'Tirador',
    paraQue: 'Dispara a lo que tenga más cerca',
    color: '#cbd5e1',
    trazos: [{ d: CIRCULO(12, 12, 6.5) }, { d: 'M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5' }],
  },
  rafaga: {
    id: 'rafaga',
    label: 'Ráfaga',
    corto: 'Ráfaga',
    paraQue: 'Muchos tiros seguidos: tumba a uno enseguida',
    color: '#fbbf24',
    trazos: [{ d: 'M3 4.5h10l4 2-4 2H3zM3 10h12l4 2-4 2H3zM3 15.5h10l4 2-4 2H3z', relleno: true }],
  },
  pesado: {
    id: 'pesado',
    label: 'Pesado',
    corto: 'Pesado',
    paraQue: 'Pocos tiros pero gordos: contra los duros',
    color: '#e879f9',
    trazos: [{ d: 'M2.5 8h12.5l6.5 4-6.5 4H2.5z', relleno: true }, { d: 'M6.5 8v8' }],
  },
  area: {
    id: 'area',
    label: 'Área',
    corto: 'Área',
    paraQue: 'Revienta grupos: da a todos los de alrededor',
    color: '#fb923c',
    trazos: [
      {
        d: 'M12 1.5l2.3 5.6 5.4-2.6-2 5.7 5.3 2.3-5.6 1.7 2 5.7-5.5-2.9L12 22.5l-1.9-5.5-5.5 2.9 2-5.7-5.6-1.7 5.3-2.3-2-5.7 5.4 2.6z',
        relleno: true,
      },
    ],
  },
  rebote: {
    id: 'rebote',
    label: 'Rebote',
    corto: 'Rebote',
    paraQue: 'La bala salta de uno a otro: contra grupos sueltos',
    color: '#2dd4bf',
    trazos: [{ d: 'M3 19l5-8 5 6 7-11' }, { d: 'M15 6h5v5' }],
  },
  perfora: {
    id: 'perfora',
    label: 'Perforante',
    corto: 'Atraviesa',
    paraQue: 'Atraviesa a todos los de la fila',
    color: '#a78bfa',
    trazos: [{ d: 'M2 12h18M16 7.5l4.5 4.5-4.5 4.5' }, { d: 'M8 4v5M8 15v5M13 4v5M13 15v5' }],
  },
  cuerpo: {
    id: 'cuerpo',
    label: 'Cuerpo a cuerpo',
    corto: 'De cerca',
    paraQue: 'Corre a por ellos y pega de cerca',
    color: '#d6a36a',
    trazos: [{ d: 'M4 4l12 12M20 4L8 16' }, { d: 'M13.5 18.5l5-5M5.5 13.5l5 5M17 17l3 3M7 17l-3 3' }],
  },
  tanque: {
    id: 'tanque',
    label: 'Tanque',
    corto: 'Tanque',
    paraQue: 'Aguanta mucho y atrae los tiros: protege a los tuyos',
    color: '#94a3b8',
    trazos: [{ d: 'M12 2l8.5 3.2v6.3c0 5.4-3.6 9.3-8.5 10.9-4.9-1.6-8.5-5.5-8.5-10.9V5.2z', relleno: true }],
  },
  cura: {
    id: 'cura',
    label: 'Cura',
    corto: 'Cura',
    paraQue: 'Cura a los tuyos que tiene cerca',
    color: '#4ade80',
    trazos: [{ d: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', relleno: true }],
  },
  apoyo: {
    id: 'apoyo',
    label: 'Apoyo',
    corto: 'Apoyo',
    paraQue: 'Los tuyos de alrededor van más rápido o disparan antes',
    color: '#f472b6',
    trazos: [{ d: 'M5 22V2.5' }, { d: 'M5 3.5h13l-3.5 4.5 3.5 4.5H5z', relleno: true }],
  },
  trampa: {
    id: 'trampa',
    label: 'Trampa',
    corto: 'Trampa',
    paraQue: 'Deja el suelo malo: fuego, gas o cepos',
    color: '#a3e635',
    trazos: [
      { d: 'M12 2c1.2 4.2 6.5 6.3 6.5 12.3a6.5 6.5 0 0 1-13 0c0-3.2 1.9-5.3 3-7.3.2 3 1.2 4.3 2.3 5.3 1.1-3.3-.2-6.6 1.2-10.3z', relleno: true },
    ],
  },
  bomba: {
    id: 'bomba',
    label: 'Bomba',
    corto: 'Bomba',
    paraQue: 'Explota al llegar o al caer: contra grupos',
    color: '#fdba74',
    trazos: [{ d: CIRCULO(10, 15, 7), relleno: true }, { d: 'M14.5 9.5l3-3.5 2.5 1.5M20 3v1.5M22 5h-1.5' }],
  },
  sigilo: {
    id: 'sigilo',
    label: 'Sigilo',
    corto: 'Sigilo',
    paraQue: 'No lo ven hasta que dispara',
    color: '#a8a29e',
    trazos: [{ d: 'M2 12c3-5 6.5-7 10-7s7 2 10 7c-3 5-6.5 7-10 7S5 17 2 12z' }, { d: 'M4 20L20 4' }],
  },
  control: {
    id: 'control',
    label: 'Control',
    corto: 'Frena',
    paraQue: 'Frena, aturde o arrastra al rival',
    color: '#fde047',
    trazos: [{ d: 'M13.5 1.5L4 14h6.5l-1.5 8.5L19 10h-6.5z', relleno: true }],
  },
}

/** El papel de un estilo: lo más llamativo que hace. */
export function papelDelEstilo(estilo: Estilo): Papel {
  if (estilo.pacifico || estilo.pulso?.cura) return 'cura'
  if (estilo.aura) return 'apoyo'
  if (estilo.suicida || estilo.explota) return 'bomba'
  if (estilo.provoca || (estilo.blindaje && estilo.cuerpo === undefined)) return 'tanque'
  if (estilo.campo) return 'trampa'
  if (estilo.sigilo) return 'sigilo'
  if (estilo.pulso) return 'control'
  if (estilo.area) return 'area'
  if (estilo.rebota) return 'rebote'
  if (estilo.perfora) return 'perfora'
  if ((estilo.disparos ?? 1) >= 3) return 'rafaga'
  if ((estilo.golpe ?? 1) >= 2 || estilo.objetivo) return 'pesado'
  if (estilo.aturde || estilo.ralentiza || estilo.empuja) return 'control'
  if (estilo.cuerpo !== undefined) return estilo.blindaje ? 'tanque' : 'cuerpo'
  if ((estilo.disparos ?? 1) >= 2) return 'rafaga'
  return 'tirador'
}

export function papelDe(card: Pick<BattleCard, 'estilo'>): PapelInfo {
  return PAPELES[papelDelEstilo(estiloDe(card))]
}

/** El color del dibujo de los iconos (oscuro sobre el círculo claro). */
export const TINTA = '#1c1208'

/** Dibuja el icono de un papel en un lienzo: un círculo de su color, el aro del bando y el dibujo. */
export function pintarPapel(
  ctx: CanvasRenderingContext2D,
  info: PapelInfo,
  cx: number,
  cy: number,
  r: number,
  aro: string,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(6,10,16,0.9)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2)
  ctx.fillStyle = aro
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.68, 0, Math.PI * 2)
  ctx.fillStyle = info.color
  ctx.fill()
  const lado = r * 1.02
  ctx.translate(cx - lado / 2, cy - lado / 2)
  ctx.scale(lado / 24, lado / 24)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2.6
  ctx.strokeStyle = TINTA
  ctx.fillStyle = TINTA
  for (const t of info.trazos) {
    const p = new Path2D(t.d)
    if (t.relleno) ctx.fill(p)
    else ctx.stroke(p)
  }
  ctx.restore()
}
