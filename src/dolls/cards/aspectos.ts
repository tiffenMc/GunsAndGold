import type { DollLook } from '../dollParams'

/**
 * **La cara y el cuerpo de cada muñeco.** Cada carta tiene su propia cabeza (ancha o estrecha, con
 * mucha o poca barbilla), sus ojos, su boca, su peinado, su sombrero, su ropa de encima y lo que
 * le da personalidad (cicatrices, pecas, puro…). Se montan encima de lo que ya trae la carta en
 * `catalog.ts` (colores, bigote, arma), asi que aqui solo esta lo que hace a cada uno distinto.
 *
 * Las pieles y los pelos se reparten a proposito: que en una fila de cartas no haya dos iguales.
 */

const PIEL = {
  palida: '#f6dcc3',
  clara: '#f1c27d',
  tostada: '#d99a6c',
  oliva: '#c68642',
  morena: '#8d5524',
  oscura: '#5c3a21',
  cenicienta: '#cfd8c8',
  quemada: '#e0937a',
  verdosa: '#9fc26b',
}

const PELO = {
  negro: '#111111',
  castano: '#4a2c17',
  caoba: '#7a3b1d',
  rubio: '#e8c170',
  rojo: '#b23a1a',
  blanco: '#ececec',
  gris: '#9a9a9a',
  zanahoria: '#d2691e',
}

export const ASPECTOS: Record<string, Partial<DollLook>> = {
  // ───────────────────────── NORMALES ─────────────────────────
  'EL VAQUERO': {
    skin: PIEL.clara, hair: PELO.castano, hairStyle: 'corto', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 1, jaw: 0.55, earSize: 1, noseSize: 1.1, outfit: 'chaleco', outfitColor: '#5a3a1a',
  },
  'EL NOVATO': {
    skin: PIEL.palida, hair: PELO.zanahoria, hairStyle: 'tupe', eyes: 'asustado', mouth: 'boquiabierto',
    headWidth: 0.95, jaw: 0.1, earSize: 1.9, noseSize: 0.8, eyeSize: 1.1, mustache: 0, mustacheStyle: 'ninguno',
    outfit: 'tirantes', outfitColor: '#7a3b1d', extras: ['pecas'], eyebrows: 1.2,
  },
  'LA JIRAFA': {
    skin: PIEL.tostada, hair: PELO.negro, hairStyle: 'coleta', eyes: 'normal', mouth: 'seria',
    headWidth: 0.82, jaw: 0.2, earSize: 0.8, noseSize: 1.5, mustache: 0, mustacheStyle: 'ninguno',
    outfit: 'bandolera', outfitColor: '#5a3a1a', eyebrows: 0.8, headSize: 0.85,
  },
  'EL FEO': {
    skin: PIEL.morena, hair: PELO.negro, hairStyle: 'calvo', eyes: 'furioso', mouth: 'dientes',
    headWidth: 1.25, jaw: 1, earSize: 0.6, noseSize: 2.1, eyebrows: 2.2, headSize: 1.25,
    outfit: 'chaleco', outfitColor: '#2a1a10', extras: ['cicatriz', 'parche'],
  },
  'EL PISTOLAS': {
    skin: PIEL.cenicienta, hair: PELO.negro, hairStyle: 'corto', eyes: 'siniestro', mouth: 'mueca',
    headWidth: 0.9, jaw: 0.5, earSize: 1, noseSize: 1.2, mustache: 0.8, mustacheStyle: 'lapiz',
    outfit: 'bandolera', outfitColor: '#1a1a1a', extras: ['pendiente'],
  },
  'EL TARTAMUDO': {
    skin: PIEL.quemada, hair: PELO.rubio, hairStyle: 'corto', eyes: 'asustado', mouth: 'mueca',
    headWidth: 1.05, jaw: 0.15, earSize: 1.4, noseSize: 1.3, eyeSize: 1.2, eyebrows: 1.8,
    outfit: 'tirantes', outfitColor: '#6b3a2a',
  },
  'DON SIESTA': {
    skin: PIEL.oliva, hair: PELO.negro, hairStyle: 'calvo', eyes: 'dormilon', mouth: 'boquiabierto',
    headWidth: 1.15, jaw: 0.3, earSize: 1.2, noseSize: 1.5, mustache: 1.9, mustacheStyle: 'fumanchu',
    outfit: 'liso', eyebrows: 0.6,
  },
  'LA CUÑADA': {
    skin: PIEL.palida, hair: PELO.rojo, hairStyle: 'melena', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 0.9, jaw: 0.1, earSize: 0.7, noseSize: 0.7, eyeSize: 1.35, eyebrows: 0.8, extras: ['pecas', 'pendiente'],
    outfit: 'abrigo', outfitColor: '#5a1f3a',
  },
  'EL BOCAZAS': {
    skin: PIEL.quemada, hair: PELO.caoba, hairStyle: 'corto', eyes: 'normal', mouth: 'dientes',
    headWidth: 1.3, jaw: 0.9, earSize: 1, noseSize: 1.2, outfit: 'rayas', outfitColor: '#f1e6c8',
    mustache: 1.4,
  },
  'LA PANZA': {
    skin: PIEL.tostada, hair: PELO.negro, hairStyle: 'calvo', eyes: 'dormilon', mouth: 'lengua',
    headWidth: 1.2, jaw: 0.1, earSize: 1, noseSize: 0.9, outfit: 'tirantes', outfitColor: '#2f3b52',
    hat: 'ninguno', mustache: 0, mustacheStyle: 'ninguno', beard: 0.6,
  },
  'EL TUERTO': {
    skin: PIEL.morena, hair: PELO.gris, hairStyle: 'corto', eyes: 'siniestro', mouth: 'seria',
    headWidth: 0.95, jaw: 0.8, earSize: 0.8, noseSize: 1.2, mustache: 1.3, mustacheStyle: 'fumanchu',
    outfit: 'abrigo', outfitColor: '#2f3b52', extras: ['parche', 'cicatriz'],
  },
  'DOÑA REGAÑO': {
    skin: PIEL.palida, hair: PELO.gris, hairStyle: 'tonsura', eyes: 'furioso', mouth: 'seria',
    headWidth: 0.88, jaw: 0.45, earSize: 1, noseSize: 1.6, eyebrows: 1.8, headSize: 0.95,
    outfit: 'abrigo', outfitColor: '#4a2f5a', extras: ['gafas'], hat: 'toca', hatColor: '#2f2038',
  },
  'EL FLAQUILLO': {
    skin: PIEL.clara, hair: PELO.negro, hairStyle: 'tupe', eyes: 'bizco', mouth: 'diente-oro',
    headWidth: 0.78, jaw: 0.35, earSize: 2.3, noseSize: 1.8, eyeSize: 1.15, mustache: 0.8, mustacheStyle: 'lapiz',
    hat: 'gorro', hatColor: '#7a2b2b', outfit: 'rayas', outfitColor: '#222222',
  },
  'LA SORDA': {
    skin: PIEL.tostada, hair: PELO.castano, hairStyle: 'trenzas', eyes: 'normal', mouth: 'seria',
    headWidth: 1, jaw: 0.3, earSize: 2.2, noseSize: 0.8, mustache: 0, mustacheStyle: 'ninguno',
    outfit: 'bandolera', outfitColor: '#4a3a2a', extras: ['pendiente'],
  },
  'EL CANTINERO': {
    skin: PIEL.quemada, hair: PELO.negro, hairStyle: 'calvo', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 1.2, jaw: 0.6, earSize: 1.3, noseSize: 1.7, hat: 'ninguno', outfit: 'chaleco', outfitColor: '#222222',
    mustache: 1.8, mustacheStyle: 'manillar',
  },
  'PEPE CORTITO': {
    skin: PIEL.oliva, hair: PELO.negro, hairStyle: 'melena', eyes: 'punto', mouth: 'dientes',
    headWidth: 1.15, jaw: 0.4, earSize: 1.1, noseSize: 1.2, headSize: 1.35, hat: 'bandana', hatColor: '#c0392b',
    mustache: 0.9, mustacheStyle: 'lapiz', outfit: 'chaleco', outfitColor: '#2a5a3a',
  },
  'EL MANCO': {
    skin: PIEL.morena, hair: PELO.negro, hairStyle: 'coleta', eyes: 'furioso', mouth: 'mueca',
    headWidth: 1, jaw: 0.7, earSize: 1, noseSize: 1.3, hat: 'bandana', hatColor: '#2f4a6b', mustache: 0,
    mustacheStyle: 'ninguno', beard: 0.7, outfit: 'bandolera', outfitColor: '#3a2a1a', extras: ['pendiente'],
  },
  'EL DORMILÓN': {
    skin: PIEL.palida, hair: PELO.rubio, hairStyle: 'corto', eyes: 'dormilon', mouth: 'boquiabierto',
    headWidth: 1.1, jaw: 0.2, earSize: 1.2, noseSize: 1.1, outfit: 'tirantes', outfitColor: '#444444',
    mustache: 0.6, mustacheStyle: 'lapiz',
  },
  'LA CHISMOSA': {
    skin: PIEL.clara, hair: PELO.zanahoria, hairStyle: 'melena', eyes: 'asustado', mouth: 'lengua',
    headWidth: 0.92, jaw: 0.1, earSize: 1.6, noseSize: 0.9, eyeSize: 1.15, mustache: 0, mustacheStyle: 'ninguno',
    outfit: 'chaleco', outfitColor: '#8a3d5e', extras: ['pecas'],
  },
  'EL TABERNERO': {
    skin: PIEL.tostada, hair: PELO.blanco, hairStyle: 'tonsura', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 1.3, jaw: 0.5, earSize: 1.1, noseSize: 2.2, hat: 'ninguno', outfit: 'tirantes', outfitColor: '#7a3b1d',
    mustache: 2, mustacheStyle: 'morsa',
  },
  'EL COJO': {
    skin: PIEL.morena, hair: PELO.gris, hairStyle: 'corto', eyes: 'furioso', mouth: 'mueca',
    headWidth: 0.95, jaw: 0.65, earSize: 1, noseSize: 1.4, hat: 'gorro', hatColor: '#3a3a2a', mustache: 0,
    mustacheStyle: 'ninguno', beard: 0.9, outfit: 'abrigo', outfitColor: '#4a3a2a', extras: ['cicatriz'],
  },
  'LA BIGOTES': {
    skin: PIEL.quemada, hair: PELO.negro, hairStyle: 'trenzas', eyes: 'siniestro', mouth: 'dientes',
    headWidth: 1.05, jaw: 0.6, earSize: 0.9, noseSize: 1, outfit: 'rayas', outfitColor: '#f1e6c8',
  },
  'EL ZURRADO': {
    skin: PIEL.oliva, hair: PELO.negro, hairStyle: 'calvo', eyes: 'bizco', mouth: 'lengua',
    headWidth: 1.2, jaw: 0.8, earSize: 0.7, noseSize: 2, hat: 'ninguno', outfit: 'liso', mustache: 0,
    mustacheStyle: 'ninguno', beard: 0.5, extras: ['cicatriz', 'parche'],
  },
  'LA GRUÑONA': {
    skin: PIEL.morena, hair: PELO.blanco, hairStyle: 'melena', eyes: 'furioso', mouth: 'seria',
    headWidth: 0.95, jaw: 0.55, earSize: 1.3, noseSize: 1.4, eyebrows: 2, outfit: 'chaleco', outfitColor: '#3a2a4a',
    extras: ['gafas'],
  },

  // ───────────────────────── ESPECIALES ─────────────────────────
  'LA LADRONA': {
    skin: PIEL.tostada, hair: PELO.negro, hairStyle: 'coleta', eyes: 'siniestro', mouth: 'sonrisa',
    headWidth: 0.88, jaw: 0.15, earSize: 0.7, noseSize: 0.7, eyeSize: 1.2, eyebrows: 0.9, hat: 'bandana',
    hatColor: '#1a1a22', outfit: 'bandolera', outfitColor: '#c0392b',
  },
  'EL ENTERRADOR': {
    skin: PIEL.cenicienta, hair: PELO.negro, hairStyle: 'calvo', eyes: 'dormilon', mouth: 'seria',
    headWidth: 0.82, jaw: 0.9, earSize: 1.8, noseSize: 1.9, eyebrows: 0.4, headSize: 1.05,
    outfit: 'abrigo', outfitColor: '#0e0e0e', mustache: 0, mustacheStyle: 'ninguno', beard: 0.4,
  },
  'LA PITONISA': {
    skin: PIEL.oliva, hair: PELO.negro, hairStyle: 'melena', eyes: 'siniestro', mouth: 'sonrisa',
    headWidth: 0.9, jaw: 0.2, earSize: 0.8, noseSize: 1.1, eyeSize: 1.3, hat: 'bandana', hatColor: '#6b2f7a',
    outfit: 'abrigo', outfitColor: '#3a1a4a', extras: ['pendiente', 'gafas'],
  },
  'EL CURA DEL PUEBLO': {
    skin: PIEL.palida, hair: PELO.gris, hairStyle: 'tonsura', eyes: 'asustado', mouth: 'sonrisa',
    headWidth: 1.05, jaw: 0.3, earSize: 1.3, noseSize: 1.2, hat: 'ninguno', outfit: 'abrigo', outfitColor: '#101010',
    mustache: 0, mustacheStyle: 'ninguno',
  },
  'LA BAILARINA': {
    skin: PIEL.clara, hair: PELO.rojo, hairStyle: 'coleta', eyes: 'normal', mouth: 'dientes',
    headWidth: 0.85, jaw: 0.1, earSize: 0.8, noseSize: 0.6, eyeSize: 1.5, eyebrows: 0.7, hat: 'pluma',
    hatColor: '#c14a6a', outfit: 'tirantes', outfitColor: '#f1c27d', extras: ['pendiente'],
  },
  'EL DOMADOR': {
    skin: PIEL.morena, hair: PELO.negro, hairStyle: 'tupe', eyes: 'furioso', mouth: 'dientes',
    headWidth: 1.25, jaw: 1, earSize: 0.8, noseSize: 1.3, mustache: 2, mustacheStyle: 'manillar',
    outfit: 'chaleco', outfitColor: '#b22222', extras: ['cicatriz'],
  },
  'LA VENDEDORA DE POCIMAS': {
    skin: PIEL.verdosa, hair: PELO.zanahoria, hairStyle: 'trenzas', eyes: 'asustado', mouth: 'lengua',
    headWidth: 1, jaw: 0.1, earSize: 1.2, noseSize: 1.8, eyeSize: 1.4, outfit: 'bandolera', outfitColor: '#2f6a4a',
    hat: 'gorro', hatColor: '#6a2f8a', extras: ['gafas'],
  },
  'EL INDIANO': {
    skin: PIEL.quemada, hair: PELO.blanco, hairStyle: 'corto', eyes: 'normal', mouth: 'diente-oro',
    headWidth: 1.1, jaw: 0.6, earSize: 1, noseSize: 1.3, mustache: 1.5, mustacheStyle: 'manillar',
    outfit: 'chaleco', outfitColor: '#8a6a2a',
  },
  'LA CONDESA': {
    skin: PIEL.palida, hair: PELO.blanco, hairStyle: 'melena', eyes: 'siniestro', mouth: 'sonrisa',
    headWidth: 0.85, jaw: 0.35, earSize: 0.6, noseSize: 0.9, eyeSize: 1.1, outfit: 'abrigo', outfitColor: '#5a1f3a',
    extras: ['pendiente', 'cicatriz'],
  },
  'EL ARISTÓCRATA': {
    skin: PIEL.palida, hair: PELO.rubio, hairStyle: 'corto', eyes: 'dormilon', mouth: 'mueca',
    headWidth: 0.88, jaw: 0.4, earSize: 1, noseSize: 1.7, eyebrows: 1.6, mustache: 1, mustacheStyle: 'lapiz',
    outfit: 'abrigo', outfitColor: '#2a2a5a', extras: ['gafas'],
  },
  'LA CONTRASTACA': {
    skin: PIEL.tostada, hair: PELO.caoba, hairStyle: 'trenzas', eyes: 'furioso', mouth: 'dientes',
    headWidth: 1.3, jaw: 0.8, earSize: 1, noseSize: 1.6, mustache: 0, mustacheStyle: 'ninguno',
    outfit: 'tirantes', outfitColor: '#5a3a1a', extras: ['pecas'],
  },
  'EL SOLDADO RENEGADO': {
    skin: PIEL.quemada, hair: PELO.castano, hairStyle: 'corto', eyes: 'furioso', mouth: 'seria',
    headWidth: 1.05, jaw: 1, earSize: 0.9, noseSize: 1.1, hat: 'kepi', hatColor: '#2a4a8a', hatSize: 1,
    outfit: 'bandolera', outfitColor: '#e8c14a', extras: ['cicatriz'], mustache: 0, mustacheStyle: 'ninguno', beard: 0.5,
  },
  'LA MONJA PISTOLERA': {
    skin: PIEL.palida, hair: PELO.castano, hairStyle: 'corto', eyes: 'siniestro', mouth: 'mueca',
    headWidth: 0.85, jaw: 0.15, earSize: 0.6, noseSize: 0.8, eyeSize: 1.2, hat: 'toca', hatColor: '#141414',
    outfit: 'bandolera', outfitColor: '#8a1c1c',
  },
  'EL VIDENTE': {
    skin: PIEL.cenicienta, hair: PELO.blanco, hairStyle: 'melena', eyes: 'punto', mouth: 'boquiabierto',
    headWidth: 0.9, jaw: 0.05, earSize: 1.6, noseSize: 1, hat: 'ninguno', outfit: 'abrigo', outfitColor: '#5a3f7a',
    mustache: 0, mustacheStyle: 'ninguno', beard: 1.5, extras: ['gafas'],
  },
  'LA SERRANA': {
    skin: PIEL.morena, hair: PELO.negro, hairStyle: 'trenzas', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 1.1, jaw: 0.4, earSize: 1.1, noseSize: 1.2, hat: 'pluma', hatColor: '#6b5a2f',
    outfit: 'chaleco', outfitColor: '#8a4a2b', mustache: 0, mustacheStyle: 'ninguno',
  },
  'EL BARBERO': {
    skin: PIEL.tostada, hair: PELO.negro, hairStyle: 'tupe', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 0.95, jaw: 0.5, earSize: 1, noseSize: 1.1, hat: 'ninguno', outfit: 'rayas', outfitColor: '#c0392b',
    mustache: 2, mustacheStyle: 'manillar',
  },

  // ───────────────────────── ÉPICAS ─────────────────────────
  GORDOFLOW: {
    // Un tonel con cara: la barriga justa para que se vea la cabeza (con 1.4 se la tragaba).
    fat: 2.0, belly: 0.3, headSize: 1.3, hatSize: 1.1,
    skin: PIEL.quemada, hair: PELO.negro, hairStyle: 'corto', eyes: 'asustado', mouth: 'dientes',
    headWidth: 1.3, jaw: 0.2, earSize: 1.4, noseSize: 1.6, eyeSize: 1.1, outfit: 'tirantes', outfitColor: '#f1e6c8',
    extras: ['pecas'],
  },
  'EL SIETE DEDOS': {
    skin: PIEL.cenicienta, hair: PELO.gris, hairStyle: 'corto', eyes: 'siniestro', mouth: 'mueca',
    headWidth: 0.88, jaw: 0.55, earSize: 1, noseSize: 1.4, outfit: 'bandolera', outfitColor: '#c0392b',
    mustache: 0.9, mustacheStyle: 'lapiz', extras: ['cicatriz'],
  },
  'LA SERPIENTE': {
    skin: PIEL.verdosa, hair: PELO.negro, hairStyle: 'coleta', eyes: 'siniestro', mouth: 'lengua',
    headWidth: 0.8, jaw: 0.3, earSize: 0.7, noseSize: 0.5, eyeSize: 1.3, eyebrows: 0.5, outfit: 'rayas',
    outfitColor: '#143a24', extras: ['pendiente'],
  },
  'EL COLOSO': {
    skin: PIEL.oscura, hair: PELO.negro, hairStyle: 'calvo', eyes: 'furioso', mouth: 'dientes',
    headWidth: 1.35, jaw: 1, earSize: 0.7, noseSize: 1.7, headSize: 0.85, eyebrows: 2.4, outfit: 'chaleco',
    outfitColor: '#2a1a10', mustache: 0, mustacheStyle: 'ninguno',
  },
  'EL CAZARRECOMPENSAS': {
    skin: PIEL.oliva, hair: PELO.negro, hairStyle: 'corto', eyes: 'siniestro', mouth: 'seria',
    headWidth: 1, jaw: 0.9, earSize: 1, noseSize: 1.3, mustache: 1.2, mustacheStyle: 'fumanchu',
    outfit: 'bandolera', outfitColor: '#3a2a1a', extras: ['cicatriz', 'puro'],
  },
  'LA REINA DEL SALOON': {
    skin: PIEL.clara, hair: PELO.rubio, hairStyle: 'melena', eyes: 'normal', mouth: 'diente-oro',
    headWidth: 0.9, jaw: 0.2, earSize: 0.8, noseSize: 0.7, eyeSize: 1.4, eyebrows: 0.7, hat: 'pluma',
    hatColor: '#a0225a', outfit: 'chaleco', outfitColor: '#e8c14a', extras: ['pendiente', 'pecas'],
  },
  'EL OSO PARDO': {
    skin: PIEL.morena, hair: PELO.caoba, hairStyle: 'melena', eyes: 'dormilon', mouth: 'dientes',
    headWidth: 1.35, jaw: 0.85, earSize: 0.6, noseSize: 2.4, headSize: 0.9, beard: 1.9, mustache: 0,
    mustacheStyle: 'ninguno', hat: 'gorro', hatColor: '#6b2f2f', outfit: 'chaleco', outfitColor: '#5a3a1a',
  },
  'LA MAESTRA DE ESGRIMA': {
    skin: PIEL.palida, hair: PELO.negro, hairStyle: 'coleta', eyes: 'furioso', mouth: 'sonrisa',
    headWidth: 0.82, jaw: 0.5, earSize: 0.6, noseSize: 0.8, eyebrows: 1.2, hat: 'ninguno', outfit: 'chaleco',
    outfitColor: '#e8e8e8', extras: ['cicatriz'],
  },

  // ───────────────────────── DIVINAS ─────────────────────────
  'EL CUERVO': {
    skin: PIEL.cenicienta, hair: PELO.negro, hairStyle: 'melena', eyes: 'siniestro', mouth: 'mueca',
    headWidth: 0.78, jaw: 0.6, earSize: 0.9, noseSize: 2.3, eyebrows: 1.8, outfit: 'abrigo', outfitColor: '#06060a',
    mustache: 1, mustacheStyle: 'fumanchu', extras: ['pendiente'],
  },
  'LA MUERTE': {
    skin: '#e9e9e9', hair: '#111111', hairStyle: 'calvo', eyes: 'punto', mouth: 'dientes',
    headWidth: 0.85, jaw: 1, earSize: 0.5, noseSize: 0.3, eyeSize: 1.7, eyebrows: 0, outfit: 'rayas', outfitColor: '#f4f4f4',
    mustache: 0, mustacheStyle: 'ninguno',
  },
  'EL SANTO PISTOLERO': {
    skin: PIEL.tostada, hair: PELO.blanco, hairStyle: 'tonsura', eyes: 'normal', mouth: 'sonrisa',
    headWidth: 1.05, jaw: 0.4, earSize: 1.2, noseSize: 1.2, hat: 'sombrero', outfit: 'chaleco',
    outfitColor: '#e8c14a', beard: 1.3, mustache: 0, mustacheStyle: 'ninguno',
  },
  'LA LEYENDA DEL RIO': {
    skin: PIEL.morena, hair: PELO.negro, hairStyle: 'trenzas', eyes: 'asustado', mouth: 'diente-oro',
    headWidth: 1, jaw: 0.6, earSize: 1, noseSize: 1.2, outfit: 'bandolera', outfitColor: '#2f7a8a',
    hat: 'pluma', hatColor: '#1f5a6b', extras: ['cicatriz', 'pendiente'], mustache: 0, mustacheStyle: 'ninguno',
  },
  // ───────────────────────── NUEVOS ─────────────────────────
  'EL DINAMITERO LOCO': {
    skin: PIEL.quemada, hair: PELO.rojo, hairStyle: 'tupe', eyes: 'furioso', mouth: 'dientes',
    headWidth: 1.1, jaw: 0.7, earSize: 1.2, noseSize: 1.3, eyebrows: 2, eyeSize: 1.4, outfit: 'bandolera',
    outfitColor: '#c0392b', extras: ['cicatriz'], mustache: 1.2, mustacheStyle: 'manillar',
  },
  'EL ESPANTAPÁJAROS': {
    skin: PIEL.cenicienta, hair: PELO.rubio, hairStyle: 'tupe', eyes: 'siniestro', mouth: 'mueca',
    headWidth: 0.85, jaw: 0.3, earSize: 1.1, noseSize: 0.6, eyeSize: 1.5, eyebrows: 1.4, outfit: 'rayas',
    outfitColor: '#6b5a2f', extras: ['cicatriz'], mustache: 0, mustacheStyle: 'ninguno',
  },
  'EL TORMENTO': {
    skin: PIEL.oscura, hair: PELO.blanco, hairStyle: 'calvo', eyes: 'furioso', mouth: 'diente-oro',
    headWidth: 1.2, jaw: 0.9, earSize: 0.8, noseSize: 1.5, eyebrows: 2.2, headSize: 1.1, outfit: 'bandolera',
    outfitColor: '#d4a017', beard: 1.4, mustache: 0, mustacheStyle: 'ninguno', extras: ['cicatriz', 'pendiente'],
  },
}
