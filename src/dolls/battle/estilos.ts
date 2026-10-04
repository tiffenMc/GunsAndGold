import type { BattleCard } from '../cards/model'

/**
 * **Los estilos de combate.** Cada carta de batalla pelea a su manera: una es una minigun que
 * vacia el cargador y tarda en recargar, otra dispara con rebote, otra lo deja todo en llamas,
 * otra va a pegar de cerca y otra solo cura. El estilo se suma a los numeros de la carta
 * (escudos, alcance, cadencia, velocidad): esos dicen *cuanto* y el estilo dice *como*.
 *
 * Todo lo que vale `undefined` es "no lo hace". Aqui no hay nada que dibujar: el motor lo lee.
 */
export interface Estilo {
  id: string
  label: string
  /** Una frase para la ficha de la carta. */
  nota: string
  /** Escudos que quita cada impacto (por defecto 1). */
  golpe?: number
  /** Disparos de cada ataque y lo que tardan entre si (ms). La rafaga vuelve a apuntar si `reapunta`. */
  disparos?: number
  separacionMs?: number
  reapunta?: boolean
  /** Ataques que caben en el tambor y lo que tarda en recargar (por defecto BALAS y RECARGA_S). */
  balas?: number
  recargaS?: number
  /** El impacto tambien da a los que estan a este radio del objetivo. */
  area?: number
  /** El disparo salta a otros enemigos cercanos, tantas veces como diga. */
  rebota?: number
  /** Atraviesa: da a todos los de la linea del disparo. */
  perfora?: boolean
  /** Va a por los enemigos cercanos y pega de cerca (radio al que los persigue). */
  cuerpo?: number
  /** No ataca a los soldados: solo ayuda (y le tira un poco al fuerte). */
  pacifico?: boolean
  /** Cada cierto tiempo, un pulso en area: cura a los suyos y/o frena a los rivales. */
  pulso?: { radio: number; cadaS: number; cura?: number; sobreEscudo?: boolean; ralentiza?: number; aturde?: number }
  /** Los aliados cercanos van mas rapido y/o disparan antes. */
  aura?: { radio: number; vel?: number; cadencia?: number }
  /** Los rivales que lo tienen a menos de este radio le disparan a el. */
  provoca?: number
  /** Lo que le hace al soldado al que acierta: aturdirlo, frenarlo (segundos) o empujarlo (m; negativo = lo arrastra hacia el). */
  aturde?: number
  ralentiza?: number
  empuja?: number
  /** Invisible para el rival hasta que dispara. */
  sigilo?: boolean
  /** Al caer, explota con este radio. Con `suicida`, ademas se lanza a por el rival y explota al llegar. */
  explota?: number
  suicida?: boolean
  /** Cuantos escudos mas quita cuanto mas herido esta (0 = nada). */
  furia?: number
  /** De cada tantos impactos recibidos, uno no cuenta. */
  blindaje?: number
  /** Deja en el suelo, donde acierta, un campo que da o frena a los rivales que lo pisan. */
  campo?: { radio: number; durS: number; cadaS: number; golpe: number; ralentiza?: number; color: string }
  /** Tamaño en el campo (1 = normal): los tanques salen mas grandes y los corredores mas pequeños, para reconocerlos de lejos. */
  tam?: number
  /** Cada tiro quita entre medio y tres escudos, segun la suerte. */
  azar?: boolean
  /** A quien le dispara de entre los que alcanza (por defecto, al mas cercano). */
  objetivo?: 'debil' | 'fuerte' | 'lejos'
}

const lista: Estilo[] = [
  { id: 'clasico', label: 'Pistolero', nota: 'Un tiro limpio cada vez. Sin trucos' },
  { id: 'doble', label: 'Doble tiro', nota: 'Dispara dos veces seguidas', disparos: 2, separacionMs: 170, balas: 4 },
  { id: 'rafaga', label: 'Ráfaga', nota: 'Tres tiros rápidos y a recargar', disparos: 3, separacionMs: 120, balas: 3 },
  { id: 'rafagaLarga', label: 'Ráfaga larga', nota: 'Cuatro tiros que no dan respiro', disparos: 4, separacionMs: 100, balas: 3 },
  {
    id: 'minigun', tam: 1.3,
    label: 'Minigun',
    nota: 'Vacía el cargador sobre todos los que ve… y tarda siglos en recargar',
    disparos: 40,
    separacionMs: 70,
    golpe: 0.25,
    reapunta: true,
    balas: 1,
    recargaS: 16,
  },
  { id: 'cerrojo', label: 'Cerrojo', nota: 'Un solo disparo que quita dos escudos. Lento', golpe: 2, balas: 4 },
  { id: 'francotirador', label: 'Francotirador', nota: 'Dispara al más lejano. Quita dos escudos', golpe: 2, objetivo: 'lejos', balas: 4 },
  { id: 'perdigones', label: 'Perdigones', nota: 'Los perdigones dan también a los que están cerca del blanco', area: 1.4 },
  { id: 'escopetazo', label: 'Escopetazo', nota: 'Cono ancho que además empuja', area: 2, empuja: 1.4 },
  { id: 'rebote', label: 'Rebote', nota: 'La bala rebota en otro enemigo cercano', rebota: 1 },
  { id: 'rebotaLargo', label: 'Rebote doble', nota: 'La bala salta de enemigo en enemigo hasta tres veces', rebota: 2 },
  { id: 'perfora', label: 'Perforante', nota: 'La bala atraviesa a todos los de la línea', perfora: true },
  { id: 'caza', label: 'Cazarrecompensas', nota: 'Va a por el soldado más duro. Quita dos escudos', golpe: 2, objetivo: 'fuerte', balas: 4 },
  { id: 'dinamitero', label: 'Dinamitero', nota: 'Lanza dinamita: explota en área y quita casi dos escudos', golpe: 1.75, area: 2, balas: 3 },
  { id: 'canon', tam: 1.2, label: 'Cañón', nota: 'Una bola lenta con una explosión enorme', golpe: 3, area: 3.4, balas: 2 },
  { id: 'cuerpo', label: 'Cuerpo a cuerpo', nota: 'Corre a por los enemigos cercanos y pega de cerca', cuerpo: 9 },
  { id: 'matón', tam: 1.15, label: 'Matón', nota: 'Va a por ellos y aguanta: ignora uno de cada tres golpes', cuerpo: 9, blindaje: 3 },
  { id: 'bailarina', tam: 0.9, label: 'Bailarina', nota: 'Muy rápida: se lanza a por quien esté lejos', cuerpo: 14, disparos: 2, separacionMs: 140, balas: 5 },
  { id: 'coloso', tam: 1.35, label: 'Coloso', nota: 'Pega de cerca y empuja a los rivales. Aguanta', cuerpo: 9, empuja: 2.6, aturde: 0.5, golpe: 2 },
  { id: 'furia', tam: 1.25, label: 'Furia', nota: 'Cuanto más herido, más fuerte pega', cuerpo: 10, furia: 2 },
  { id: 'estocada', tam: 1.05, label: 'Estocada', nota: 'Veloz: la estocada atraviesa a los rivales de la línea', cuerpo: 11, perfora: true },
  { id: 'kamikaze', tam: 0.8, label: 'Kamikaze', nota: 'Corre hacia el rival y explota al llegar', cuerpo: 12, suicida: true, explota: 2.2 },
  { id: 'barril', label: 'Barril andante', nota: 'Dispara normal, pero al caer explota', explota: 2.6 },
  { id: 'cebo', label: 'Cebo', nota: 'Grita y atrae los disparos de los rivales cercanos', provoca: 7 },
  { id: 'murallaCebo', tam: 1.25, label: 'Muralla', nota: 'Atrae los disparos y aguanta: ignora uno de cada tres', provoca: 6, blindaje: 3 },
  { id: 'blindado', tam: 1.2, label: 'Blindado', nota: 'Un tanque: ignora uno de cada tres golpes', blindaje: 3 },
  { id: 'regano', label: 'Regañina', nota: 'Sus tiros aturden al rival un instante', aturde: 0.8 },
  { id: 'cuchillos', label: 'Cuchillos', nota: 'Sus golpes frenan al rival durante unos segundos', ralentiza: 2.5, disparos: 2, separacionMs: 220, balas: 4 },
  { id: 'lazo', label: 'Lazo', nota: 'Su lazo arrastra al rival hacia él', empuja: -2.6 },
  { id: 'sigilo', tam: 0.95, label: 'Sigilo', nota: 'Invisible hasta que dispara', sigilo: true },
  {
    id: 'fuego',
    label: 'Molotov',
    nota: 'Deja el suelo en llamas: quema a quien lo pisa',
    campo: { radio: 2.2, durS: 6, cadaS: 1, golpe: 0.5, color: '#fb923c' },
    balas: 3,
  },
  {
    id: 'gas',
    label: 'Gas',
    nota: 'Una nube que va quitando escudos a quien entra',
    campo: { radio: 3, durS: 7, cadaS: 1.4, golpe: 0.5, color: '#a3e635' },
    balas: 3,
  },
  {
    id: 'cepos',
    label: 'Trampa de cepos',
    nota: 'Siembra cepos que frenan a quien los pisa',
    campo: { radio: 2, durS: 12, cadaS: 0.5, golpe: 0, ralentiza: 1.4, color: '#94a3b8' },
    balas: 3,
  },
  {
    id: 'circulo',
    label: 'Círculo de balas',
    nota: 'Crea un círculo que llena de balas a todos los que entran',
    campo: { radio: 2.6, durS: 5, cadaS: 0.45, golpe: 0.35, color: '#38bdf8' },
    balas: 2,
  },
  {
    id: 'medico', tam: 0.95,
    label: 'Médico',
    nota: 'No ataca: cura a los suyos en un área grande, con espera',
    pacifico: true,
    pulso: { radio: 6, cadaS: 6, cura: 1 },
  },
  {
    id: 'sanadora',
    label: 'Sanadora',
    nota: 'Cura a los suyos en un área enorme y a menudo',
    pacifico: true,
    pulso: { radio: 8, cadaS: 5, cura: 2 },
  },
  {
    id: 'escudera',
    label: 'Escudera',
    nota: 'Da un escudo extra a los suyos cercanos',
    pacifico: true,
    pulso: { radio: 5.5, cadaS: 7, cura: 1, sobreEscudo: true },
  },
  {
    id: 'predicador',
    label: 'Sermón',
    nota: 'Su sermón frena y aturde a los rivales cercanos',
    pulso: { radio: 6, cadaS: 8, ralentiza: 3, aturde: 0.6 },
  },
  { id: 'abanderado', label: 'Abanderado', nota: 'Los suyos cercanos caminan más rápido', aura: { radio: 5.5, vel: 0.3 } },
  { id: 'cantinero', label: 'Cantinero', nota: 'Los suyos cercanos disparan antes', aura: { radio: 5, cadencia: 0.3 } },
  { id: 'reina', tam: 1.1, label: 'Reina', nota: 'Los suyos van más rápido y disparan antes en un área grande', aura: { radio: 7.5, vel: 0.2, cadencia: 0.25 } },
  { id: 'poker', label: 'Suerte de tahúr', nota: 'Cada tiro quita entre medio y tres escudos, según la suerte', azar: true },
  { id: 'corredor', tam: 0.85, label: 'Corredor', nota: 'Corre muchísimo: llega el primero y dispara normal' },
  { id: 'tumba', label: 'Entierro', nota: 'Su explosión de tierra da en área y frena a los que pilla', area: 2.2, ralentiza: 1.5, balas: 3 },
  { id: 'duelista', label: 'Duelista', nota: 'Quita dos escudos y aturde al rival', golpe: 2, aturde: 0.6, balas: 4 },
  { id: 'tanque', tam: 1.35, label: 'Tanque', nota: 'Atrae los disparos y se ríe de los golpes: ignora uno de cada dos', provoca: 8, blindaje: 2 },
  { id: 'fusileria', label: 'Fusilería', nota: 'Seis disparos casi seguidos y a recargar', disparos: 6, separacionMs: 90, balas: 2 },
  {
    id: 'veneno',
    label: 'Veneno',
    nota: 'Sus balas frenan y dejan una nube que sigue quitando escudos',
    ralentiza: 3,
    campo: { radio: 1.7, durS: 4, cadaS: 1.2, golpe: 0.5, color: '#84cc16' },
    balas: 3,
  },
  { id: 'emboscada', label: 'Emboscada', nota: 'Invisible hasta que dispara; cuanto más herido, más pega', sigilo: true, furia: 2 },
  { id: 'cuervo', label: 'Cuervo', nota: 'Una bala que atraviesa y además salta dos veces', perfora: true, rebota: 2 },
  { id: 'santo', label: 'Santo', nota: 'Quita dos escudos y cura a los suyos cercanos', golpe: 2, pulso: { radio: 8, cadaS: 6, cura: 2 } },
  { id: 'legendario', label: 'Leyenda', nota: 'Bala perforante de largo alcance: tres escudos al blanco', golpe: 3, perfora: true, objetivo: 'lejos', balas: 3 },
]

/** Como se llama y que hace el estilo de una clase: el nombre y la frase, y lo que cambia respecto al base. */
interface Variante {
  label: string
  nota: string
  mod?: Partial<Estilo>
}

/**
 * **Vikingos: todos cuerpo a cuerpo.** Cada estilo vaquero tiene su version vikinga: no hay ni un
 * solo disparo, todo son golpes que llegan al instante (hachazos, martillazos, lanzazos…). Corren
 * mas, aguantan mas y pegan de cerca.
 */
const VIKINGOS: Record<string, Variante> = {
  clasico: { label: 'Hachazo', nota: 'Un hachazo limpio, sin trucos' },
  poker: { label: 'Dados de Odín', nota: 'Cada golpe quita entre medio y tres escudos, según la suerte' },
  francotirador: { label: 'Lancero', nota: 'Lanzazo de largo alcance: quita dos escudos', mod: { golpe: 2, objetivo: undefined } },
  matón: { label: 'Rompehuesos', nota: 'Aguanta: ignora uno de cada tres golpes' },
  doble: { label: 'Doble hacha', nota: 'Dos hachazos seguidos' },
  rafaga: { label: 'Tajo triple', nota: 'Tres tajos rápidos y a respirar' },
  perdigones: { label: 'Remolino', nota: 'Gira con el arma: da a todos los que tiene alrededor' },
  rebote: { label: 'Tajo encadenado', nota: 'El golpe salta al siguiente enemigo cercano' },
  cebo: { label: 'Cuerno de guerra', nota: 'Su cuerno atrae los golpes de los rivales cercanos' },
  blindado: { label: 'Muro de escudos', nota: 'Detrás de su escudo ignora uno de cada tres golpes' },
  cerrojo: { label: 'Jabalinazo', nota: 'Un solo golpe pesado que quita dos escudos', mod: { objetivo: undefined } },
  regano: { label: 'Escaldo gritón', nota: 'Sus golpes aturden al rival un instante' },
  corredor: { label: 'Esquiador del norte', nota: 'Corre muchísimo: llega el primero y pega' },
  escopetazo: { label: 'Martillazo de troll', nota: 'Su golpe sacude el suelo: da en área y empuja' },
  cantinero: { label: 'Hidromiel', nota: 'Los suyos cercanos pegan más rápido con su brindis' },
  kamikaze: { label: 'Fanático del fuego', nota: 'Se lanza contra el rival y explota al llegar' },
  cuchillos: { label: 'Cuchillada helada', nota: 'Cada corte frena al rival unos segundos' },
  cepos: { label: 'Trampero', nota: 'Su golpe clava cepos de hierro en el suelo' },
  abanderado: { label: 'Estandarte del dragón', nota: 'Los suyos cercanos corren más con su estandarte' },
  barril: { label: 'Barril de hidromiel', nota: 'Pega normal, pero al caer revienta el barril' },
  sigilo: { label: 'Niebla', nota: 'Invisible hasta que golpea' },
  tumba: { label: 'Cavatumbas', nota: 'Su pala levanta tierra: da en área y frena' },
  rebotaLargo: { label: 'Runa saltarina', nota: 'Su golpe salta de enemigo en enemigo hasta tres veces' },
  predicador: { label: 'Canto de guerra', nota: 'Su canto frena y aturde a los rivales cercanos' },
  bailarina: { label: 'Valquiria', nota: 'Veloz: se lanza a por quien esté lejos y golpea dos veces' },
  lazo: { label: 'Arpón', nota: 'Su arpón arrastra al rival hacia él' },
  medico: { label: 'Curandera', nota: 'No pelea: cura a los suyos con sus runas' },
  fuego: { label: 'Brea ardiente', nota: 'Su golpe deja brea en llamas que quema a quien la pisa' },
  rafagaLarga: { label: 'Furia de tajos', nota: 'Cuatro tajos que no dan respiro' },
  duelista: { label: 'Holmgang', nota: 'Quita dos escudos y aturde al rival' },
  murallaCebo: { label: 'Guardia del jarl', nota: 'Atrae los golpes y aguanta: ignora uno de cada tres' },
  perfora: { label: 'Lanza atravesadora', nota: 'La lanza atraviesa a todos los de la línea' },
  escudera: { label: 'Doncella del escudo', nota: 'No pelea: da un escudo extra a los suyos' },
  gas: { label: 'Niebla de Hel', nota: 'Su golpe deja una niebla que quita escudos poco a poco' },
  circulo: { label: 'Círculo de runas', nota: 'Su golpe crea un círculo de runas que daña a los que entran' },
  tanque: { label: 'Jarl', nota: 'Atrae los golpes y se ríe de ellos: ignora uno de cada dos' },
  fusileria: { label: 'Seis hachazos', nota: 'Seis hachazos casi seguidos y a recuperar el aliento' },
  veneno: { label: 'Colmillo de serpiente', nota: 'Sus golpes frenan y dejan una nube de veneno' },
  coloso: { label: 'Gigante', nota: 'Pega de cerca, empuja y aturde. Aguanta' },
  caza: { label: 'Cazador de dragones', nota: 'Va a por el soldado más duro. Quita dos escudos' },
  reina: { label: 'Reina del fiordo', nota: 'Los suyos van más rápido y pegan antes en un área grande' },
  furia: { label: 'Berserker', nota: 'Cuanto más herido, más fuerte pega' },
  estocada: { label: 'Maestra de la lanza', nota: 'Rapidísima: su lanza atraviesa a los rivales de la línea' },
  dinamitero: { label: 'Brea explosiva', nota: 'Su golpe revienta en área y quita casi dos escudos' },
  emboscada: { label: 'Draugr', nota: 'Invisible hasta que golpea; cuanto más herido, más pega' },
  cuervo: { label: 'Cuervo de Odín', nota: 'Un tajo que atraviesa y además salta dos veces' },
  canon: { label: 'Martillo de Thor', nota: 'Un martillazo con explosión enorme' },
  santo: { label: 'Frigg', nota: 'Quita dos escudos y cura a los suyos cercanos' },
  legendario: { label: 'Lanza de Odín', nota: 'Atraviesa a todos y quita tres escudos' },
  minigun: {
    label: 'Frenesí',
    nota: 'Una lluvia de hachazos sobre todos los que tiene cerca… y luego tarda en recuperarse',
    mod: { disparos: 12, separacionMs: 80, golpe: 0.5, reapunta: true, balas: 1, recargaS: 7 },
  },
}

/**
 * **Indios: todo son flechas** (y lanzas y hachas arrojadas). Cada flecha **marca** a su presa: la
 * presa marcada recibe un tercio mas de todos los indios durante unos segundos.
 */
const INDIOS: Record<string, Variante> = {
  clasico: { label: 'Flecha certera', nota: 'Una flecha limpia. Deja marcado al rival' },
  poker: { label: 'Huesos de la suerte', nota: 'Cada flecha quita entre medio y tres escudos, según la suerte' },
  francotirador: { label: 'Ojo de águila', nota: 'Flecha al más lejano: quita dos escudos' },
  matón: { label: 'Tomahawk', nota: 'Pega de cerca con el tomahawk y aguanta' },
  doble: { label: 'Dos flechas', nota: 'Dispara dos flechas seguidas' },
  rafaga: { label: 'Lluvia menuda', nota: 'Tres flechas rápidas' },
  perdigones: { label: 'Dardos', nota: 'Los dardos dan también a los que están cerca del blanco' },
  rebote: { label: 'Flecha saltarina', nota: 'La flecha rebota en otro enemigo cercano' },
  cebo: { label: 'Voz de trueno', nota: 'Su grito atrae los disparos de los rivales cercanos' },
  blindado: { label: 'Piel de roca', nota: 'Ignora uno de cada tres golpes' },
  cerrojo: { label: 'Flecha pesada', nota: 'Una sola flecha que quita dos escudos' },
  regano: { label: 'Abuela cuervo', nota: 'Sus flechas aturden al rival un instante' },
  corredor: { label: 'Viento veloz', nota: 'Corre muchísimo: llega el primero y dispara' },
  escopetazo: { label: 'Honda', nota: 'Una lluvia de piedras en cono que además empuja' },
  cantinero: { label: 'Tambor', nota: 'Los suyos cercanos disparan antes con su tambor' },
  kamikaze: { label: 'Guerrero de fuego', nota: 'Corre hacia el rival y estalla al llegar' },
  cuchillos: { label: 'Obsidiana', nota: 'Sus tajos frenan al rival durante unos segundos' },
  cepos: { label: 'Trampero', nota: 'Siembra trampas que frenan a quien las pisa' },
  abanderado: { label: 'Estandarte de plumas', nota: 'Los suyos cercanos caminan más rápido' },
  barril: { label: 'Calabaza', nota: 'Dispara normal, pero al caer revienta' },
  sigilo: { label: 'Sombra', nota: 'Invisible hasta que dispara' },
  tumba: { label: 'Danza de la tierra', nota: 'Su pisotón levanta polvo: da en área y frena' },
  rebotaLargo: { label: 'Flecha del espíritu', nota: 'La flecha salta de enemigo en enemigo hasta tres veces' },
  predicador: { label: 'Chamán', nota: 'Su cántico frena y aturde a los rivales cercanos' },
  bailarina: { label: 'Danzante del sol', nota: 'Muy rápida: se lanza a por quien esté lejos' },
  lazo: { label: 'Lazo', nota: 'Su lazo arrastra al rival hacia él' },
  medico: { label: 'Curandera', nota: 'No ataca: cura a los suyos en un área grande' },
  fuego: { label: 'Flechas de fuego', nota: 'Deja el suelo en llamas: quema a quien lo pisa' },
  rafagaLarga: { label: 'Tormenta de flechas', nota: 'Cuatro flechas que no dan respiro' },
  duelista: { label: 'Retador', nota: 'Quita dos escudos y aturde al rival' },
  murallaCebo: { label: 'Guardián del tótem', nota: 'Atrae los disparos y aguanta' },
  perfora: { label: 'Lanza del valle', nota: 'La lanza atraviesa a todos los de la línea' },
  escudera: { label: 'Madre del escudo', nota: 'No ataca: da un escudo extra a los suyos' },
  gas: { label: 'Humo sagrado', nota: 'Una nube de humo que quita escudos poco a poco' },
  circulo: { label: 'Círculo de guerra', nota: 'Crea un círculo de flechas que daña a los que entran' },
  tanque: { label: 'Gran búfalo', nota: 'Atrae los disparos y ignora uno de cada dos golpes' },
  fusileria: { label: 'Mil flechas', nota: 'Seis flechas casi seguidas y a recargar' },
  veneno: { label: 'Flecha de víbora', nota: 'Sus flechas frenan y dejan una nube de veneno' },
  coloso: { label: 'Gigante', nota: 'Pega de cerca, empuja y aturde' },
  caza: { label: 'Cazador de pieles', nota: 'Va a por el soldado más duro. Quita dos escudos' },
  reina: { label: 'Gran madre', nota: 'Los suyos van más rápido y disparan antes en un área grande' },
  furia: { label: 'Oso', nota: 'Cuanto más herido, más fuerte pega' },
  estocada: { label: 'Lanza danzante', nota: 'Veloz: su lanza atraviesa a los rivales de la línea' },
  dinamitero: { label: 'Flecha del cañón', nota: 'La flecha revienta en área y quita casi dos escudos' },
  emboscada: { label: 'Fantasma', nota: 'Invisible hasta que dispara; cuanto más herido, más pega' },
  cuervo: { label: 'Cuervo blanco', nota: 'Una flecha que atraviesa y además salta dos veces' },
  canon: { label: 'Espíritu del trueno', nota: 'Una flecha de trueno con explosión enorme' },
  santo: { label: 'Gran chamán', nota: 'Quita dos escudos y cura a los suyos cercanos' },
  legendario: { label: 'Arco del amanecer', nota: 'Flecha perforante de largo alcance: tres escudos al blanco' },
  minigun: { label: 'Mil flechas', nota: 'Vacía el carcaj sobre todos los que ve… y tarda en reponerlo' },
}

function derivado(prefijo: 'v' | 'i', base: Estilo, variante: Variante): Estilo {
  const estilo: Estilo = { ...base, ...(variante.mod ?? {}), id: `${prefijo}:${base.id}`, label: variante.label, nota: variante.nota }
  if (prefijo === 'v') {
    // Los vikingos pegan de cerca: no hay objetivo "el mas lejano" y todos van a por el rival (menos los de apoyo).
    if (estilo.objetivo === 'lejos') delete estilo.objetivo
    if (!estilo.pacifico && estilo.cuerpo === undefined) estilo.cuerpo = 12
    // Un golpe de cerca pega un poco mas que un tiro.
    if (!estilo.pacifico && !estilo.azar && !estilo.pulso) estilo.golpe = (estilo.golpe ?? 1) + 0.4
  }
  return estilo
}

export const ESTILOS: Record<string, Estilo> = Object.fromEntries(lista.map((estilo) => [estilo.id, estilo]))
for (const estilo of lista) {
  const vik = VIKINGOS[estilo.id]
  const ind = INDIOS[estilo.id]
  if (vik) ESTILOS[`v:${estilo.id}`] = derivado('v', estilo, vik)
  if (ind) ESTILOS[`i:${estilo.id}`] = derivado('i', estilo, ind)
}
export const ESTILO_LISTA: Estilo[] = lista

/** El estilo de una carta: el que tiene puesto, o el pistolero de siempre. */
export function estiloDe(card: Pick<BattleCard, 'estilo'>): Estilo {
  return (card.estilo ? ESTILOS[card.estilo] : undefined) ?? ESTILOS.clasico!
}

/** Que objeto grande lleva cada estilo en la espalda o el pecho: cambia la silueta y se reconoce de lejos. */
const PROP_DE: Record<string, 'medico' | 'bandera' | 'barril' | 'dinamita' | 'municion' | 'armadura'> = {
  medico: 'medico',
  sanadora: 'medico',
  escudera: 'medico',
  abanderado: 'bandera',
  reina: 'bandera',
  barril: 'barril',
  cantinero: 'barril',
  kamikaze: 'dinamita',
  dinamitero: 'dinamita',
  minigun: 'municion',
  fusileria: 'municion',
  tanque: 'armadura',
  blindado: 'armadura',
  murallaCebo: 'armadura',
  coloso: 'armadura',
  matón: 'armadura',
  furia: 'armadura',
}

export function propDe(estilo: Pick<Estilo, 'id'>) {
  return PROP_DE[estilo.id.replace(/^[vi]:/, '')]
}

/** Las dos caras de cada carta: lo que hace saliendo de soldado y lo que hace plantada de torre. */
export interface Personalidad {
  titulo: string
  /** Lo que hace, en una frase corta. */
  nota: string
  /** Los cambios, en puntos cortos (para la ficha). */
  puntos: string[]
}

export function personalidadAtacante(card: Pick<BattleCard, 'estilo'>): Personalidad {
  const estilo = estiloDe(card)
  return { titulo: estilo.label, nota: estilo.nota, puntos: ['Avanza hacia el fuerte rival'] }
}

/** Lo que hace la carta de **torre**: se planta, aguanta mas y defiende a su manera. */
export function personalidadTorre(card: Pick<BattleCard, 'estilo'>): Personalidad {
  const estilo = estiloDe(card)
  if (estilo.pulso || estilo.pacifico || estilo.aura) {
    return { titulo: 'Puesto de apoyo', nota: 'Ayuda a los suyos desde su sitio', puntos: ['No se mueve', '+60 % escudos', 'Su ayuda llega ×1,5 más lejos'] }
  }
  if (estilo.cuerpo !== undefined) {
    return { titulo: 'Guardián', nota: 'Para en seco a los que pasan', puntos: ['No se mueve', '+60 % escudos', 'Atrae y frena a quien pasa cerca'] }
  }
  return { titulo: 'Torre de tiro', nota: 'Dispara desde lejos sin moverse', puntos: ['No se mueve', '+60 % escudos', '+30 % alcance · dispara antes'] }
}
