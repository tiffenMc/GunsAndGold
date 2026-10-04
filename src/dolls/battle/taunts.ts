import { BUILTIN_BATTLE } from '../cards/catalog'
import { claseDe } from '../cards/model'
/**
 * Lo que suelta cada carta al salir al campo: una pulla de cómic, en español del Oeste y con mala
 * idea, siempre hacia el rival. Cada carta tiene varias y nunca repite la última que dijo, para que
 * no suene a disco rayado.
 *
 * Van **cortísimas** a propósito (dos o tres palabras, como un "¡a por él!"): el bocadillo se lee de
 * un vistazo y no tapa la partida.
 */

export const PULLAS: Record<string, string[]> = {
  vaquero: ['¡A por él!', '¡Yii-jaa, cerdo!', '¡Menudo cobarde!', '¡Rata!'],
  sheriff: ['¡Alto, sinvergüenza!', '¡A la celda!', '¡Te detengo!', '¡Cerdo con placa!'],
  forajido: ['¡Ni te vi!', '¡Largo de aquí!', '¡Cara de rata!', '¡Ladrón!'],
  pistolera: ['¡Feo!', '¡No me silbes!', '¡Mocoso!', '¡A otro perro!'],
  minero: ['¡Fuego, cerdo!', '¡Bum!', '¡A la mina!', '¡Te pico!'],
  cazador: ['¡Quieto!', '¡Caza mayor!', '¡Te tengo!', '¡Cerdo salvaje!'],
  tahur: ['¡Voy ganando!', '¡Farolero!', '¡Tramposo!', '¡Paga o calla!'],
  predicador: ['¡Pecador!', '¡Al infierno!', '¡Dios te ve!', '¡Arrepiéntete!'],
  bandolero: ['¡Anda ya!', '¡A la tumba!', '¡Qué feo eres!', '¡Muérete!'],
  rastreador: ['¡Te olí!', '¡Corre, conejo!', '¡No escapas!', '¡Ya te vi!'],
  herrero: ['¡Al yunque!', '¡Chatarra!', '¡Menudo hierro!', '¡Te forjo!'],
  diligenciero: ['¡Arre!', '¡Fuera del camino!', '¡Atrás, cerdo!', '¡Sube o corre!'],
  enterrador: ['¡Al hoyo!', '¡Cruz de pino!', '¡Descansa ya!', '¡Te entierro!'],
  ranger: ['¡Rata!', '¡A la horca!', '¡Sonríe, cerdo!', '¡Hay recompensa!'],
  humo: ['¡Ciego!', '¡Nada ves!', '¡A tientas!'],
  rayo: ['¡Zap!', '¡Trueno!', '¡Cielo bravo!'],
  tunel: ['¡Sorpresa!', '¡Adiós!', '¡Por aquí!'],

  // ── Las del catálogo nuevo ───────────────────────────────────────────────
  'el-novato': ['¡A por él!', '¡Yo primero!', '¡Rata!', '¡Temblando estás!'],
  'la-jirafa': ['¡Desde arriba!', '¡Enano!', '¡Te veo todo!', '¡Al hoyo!'],
  'el-feo': ['¡Cierra la boca!', '¡Cerdo!', '¡Ni te miro!', '¡Qué asco!'],
  'el-pistolas': ['¡Rápido!', '¡Ni me viste!', '¡Pum, rata!', '¡Fuera!'],
  'el-tartamudo': ['¡Te… te… pillo!', '¡Es… espera!', '¡Co… corre!', '¡Ya verás!'],
  'don-siesta': ['¡Qué pereza!', '¡Largo!', '¡No molestes!', '¡A dormir!'],
  'la-cunada': ['¡Cuñado!', '¡Qué caradura!', '¡A la calle!', '¡Cerdo!'],
  'el-bocazas': ['¡Cállate ya!', '¡Mucho hablas!', '¡Al hoyo!', '¡Rata!'],
  'la-panza': ['¡Aquí no pasas!', '¡Aparta!', '¡Zopenco!', '¡A empujones!'],
  'el-tuerto': ['¡A la diana!', '¡Te tengo!', '¡No fallo!', '¡Adiós!'],
  'dona-regano': ['¡Sinvergüenza!', '¡A fregar!', '¡Maleducado!', '¡Corre!'],
  'el-flaquillo': ['¡Zas, zas!', '¡Cerdo!', '¡Ligero!', '¡Ni me rozas!'],
  'la-sorda': ['¡¿Qué?!', '¡Habla alto!', '¡Al hoyo!', '¡Bum!'],
  'el-cantinero': ['¡Cierra al salir!', '¡Borrachín!', '¡Fuera!', '¡Se acabó!'],
  'pepe-cortito': ['¡Bajito pero malo!', '¡Rata!', '¡Corre!', '¡Pum!'],
  'el-manco': ['¡Con una basta!', '¡Cerdo!', '¡Al hoyo!', '¡Ni te vi!'],
  'el-dormilon': ['¡Despierta!', '¡Bostezo!', '¡A la tumba!', '¡Zzz!'],
  'la-chismosa': ['¡Lo sé todo!', '¡Cotilla!', '¡Te vi!', '¡Rata!'],
  'el-tabernero': ['¡La cuenta!', '¡Fuera de aquí!', '¡Cochino!', '¡A pagar!'],
  'el-cojo': ['¡Cojito pero bravo!', '¡Rata!', '¡Al hoyo!', '¡Corre!'],
  'la-bigotes': ['¡Feo!', '¡Cerdo!', '¡Ni te miro!', '¡A la sartén!'],
  'el-zurrado': ['¡Te zurro!', '¡Menudo trasto!', '¡Rata!', '¡Toma!'],
  'el-aprendiz': ['¡Estoy aprendiendo!', '¡Uy!', '¡Perdón!', '¡Voy!'],
  'la-grunona': ['¡Gruñe y dispara!', '¡Cerdo!', '¡Qué asco!', '¡Fuera!'],
  'la-ladrona': ['¡Es mío!', '¡Gracias!', '¡Rata!', '¡Ni me viste!'],
  'la-pitonisa': ['¡Lo veo!', '¡Mal fario!', '¡Pobre de ti!', '¡Al hoyo!'],
  'el-cura-del-pueblo': ['¡Pecador!', '¡Al infierno!', '¡Dios te ve!', '¡Arrepiéntete!'],
  'la-bailarina': ['¡Mira esto!', '¡A bailar!', '¡Rata!', '¡Gira!'],
  'el-domador': ['¡So, caballo!', '¡Domado!', '¡Cerdo!', '¡Corre!'],
  'la-vendedora-de-pocimas': ['¡Prueba esto!', '¡Veneno!', '¡Pobre!', '¡Adiós!'],
  'el-indiano': ['¡Mi oro!', '¡Cerdo!', '¡Fuera!', '¡Rata!'],
  'la-condesa': ['¡Qué vulgar!', '¡Largo!', '¡Adiós!', '¡Pobre diablo!'],
  'el-aristocrata': ['¡Qué ordinariez!', '¡Retírate!', '¡Cerdo!', '¡Adiós!'],
  'la-contrastaca': ['¡Aquí no pasas!', '¡Aparta!', '¡Cerdo!', '¡Zopenco!'],
  'el-soldado-renegado': ['¡Fuego!', '¡Rata!', '¡A la tumba!', '¡Cerdo!'],
  'la-monja-pistolera': ['¡Perdóname!', '¡Al hoyo!', '¡Cerdo!', '¡Dios perdona!'],
  'el-vidente': ['¡Lo vi!', '¡Mal fario!', '¡Te veo!', '¡Adiós!'],
  'la-serrana': ['¡Por aquí no!', '¡Cerdo!', '¡Largo!', '¡Al hoyo!'],
  'el-barbero': ['¡A afeitar!', '¡Sorpresa!', '¡Rata!', '¡Adiós!'],
  gordoflow: ['¡Gordo pero bravo!', '¡Aparta!', '¡Cerdo!', '¡No me mueves!'],
  'el-siete-dedos': ['¡Te faltan dedos!', '¡Rata!', '¡Al hoyo!', '¡Zas!'],
  'la-serpiente': ['¡Sssss!', '¡Muerde!', '¡Cerdo!', '¡Adiós!'],
  'el-coloso': ['¡Aquí no pasas!', '¡Enano!', '¡Rata!', '¡Aparta!'],
  'el-cazarrecompensas': ['¡Hay recompensa!', '¡Sonríe!', '¡Rata!', '¡Cerdo!'],
  'la-reina-del-saloon': ['¡Fuera!', '¡Cerdo!', '¡Largo!', '¡Adiós!'],
  'el-oso-pardo': ['¡Grrr!', '¡Te como!', '¡Cerdo!', '¡Rata!'],
  'la-maestra-de-esgrima': ['¡En garde!', '¡Rata!', '¡Adiós!', '¡Cerdo!'],
  'el-cuervo': ['¡Caw!', '¡Al hoyo!', '¡Cerdo!', '¡Adiós!'],
  'la-muerte': ['¡Te toca!', '¡Descansa!', '¡Al hoyo!', '¡Ven!'],
  'el-santo-pistolero': ['¡Milagro!', '¡Al hoyo!', '¡Cerdo!', '¡Adiós!'],
  'la-leyenda-del-rio': ['¡Soy leyenda!', '¡Rata!', '¡Al hoyo!', '¡Cerdo!'],
  'el-dinamitero-loco': ['¡BOOM!', '¡Mecha corta!', '¡Corre, rata!', '¡Qué bonito!'],
  'el-espantapajaros': ['¡Buu!', '¡No me viste!', '¡Cuervos!', '¡Rata!'],
  'el-tormento': ['¡Ta-ta-ta-ta!', '¡Plomo!', '¡A todos!', '¡Cerdo!'],

  // ── Las armas nuevas ─────────────────────────────────────────────────────
  'canon-del-desierto': ['¡BOOM!', '¡Adiós, cerdo!', '¡Al hoyo!'],
  derringer: ['¡Sorpresa!', '¡Pum!', '¡Ni te vi!'],
  trabuco: ['¡Achús!', '¡Traquido!', '¡Fuera!'],
  postas: ['¡A perdigonazos!', '¡Corre!', '¡Rata!'],
  repeticion: ['¡Ta-ta-ta!', '¡Al hoyo!', '¡Cerdo!'],
}

// ── Indios y vikingos: pullas por clase, repartidas por carta (cada una con las suyas) ──────────

const PULLAS_DE_CLASE: Record<'indios' | 'vikingos', string[]> = {
  indios: [
    '¡Por mis ancestros!',
    '¡Woooo!',
    '¡Tierra sagrada!',
    '¡Cae, intruso!',
    '¡Los espíritus lo ven!',
    '¡Tu fin!',
    '¡Viento y flecha!',
    '¡Lárgate!',
  ],
  vikingos: [
    '¡Por Odín!',
    '¡Valhalla!',
    '¡Skål!',
    '¡A la gloria!',
    '¡Hacha y fuego!',
    '¡Cae, cobarde!',
    '¡Sangre y hierro!',
    '¡Thor me ve!',
  ],
}

/** Cuatro pullas de la clase, distintas para cada carta (se reparten por el nombre). */
for (const carta of BUILTIN_BATTLE) {
  const clase = claseDe(carta)
  if (clase === 'vaqueros' || PULLAS[carta.id]) continue
  const lista = PULLAS_DE_CLASE[clase]
  let h = 7
  for (let i = 0; i < carta.id.length; i++) h = (h * 31 + carta.id.charCodeAt(i)) % 9973
  PULLAS[carta.id] = [0, 2, 3, 5].map((salto) => lista[(h + salto) % lista.length]!)
}

/** Los motes que puede llevar el rival en el cartel de "VS" del principio de la partida. */
const NOMBRES_RIVAL = [
  'El Cuervo',
  'Manco Jim',
  'Cara de Hacha',
  'El Tuerto Salas',
  'Tres Dedos',
  'El Lagarto',
  'Sangre Fría',
  'Coyote Blanco',
  'Diente de Oro',
  'Barba de Alambre',
  'La Sombra',
  'El Ahorcado',
]

/** Un nombre de rival al azar para la partida. */
export function nombreDeRival(): string {
  return NOMBRES_RIVAL[Math.floor(Math.random() * NOMBRES_RIVAL.length)] ?? 'El Forastero'
}

/** La ultima que dijo cada carta, para no repetirla dos veces seguidas. */
const ultima = new Map<string, number>()

/** Una pulla de esa carta, sin repetir la anterior. `null` si no tiene. */
export function pullaDe(cardId: string): string | null {
  const lista = PULLAS[cardId]
  if (!lista || lista.length === 0) return null
  const antes = ultima.get(cardId)
  let indice = Math.floor(Math.random() * lista.length)
  if (lista.length > 1 && indice === antes) indice = (indice + 1) % lista.length
  ultima.set(cardId, indice)
  return lista[indice]!
}
