// Lo del juego que usa el servidor (las mismas reglas que en el móvil).
export { conJugadores, getPlayer } from '../src/dolls/game/players'
export { ejecutarAccion, MAX_PERSONAJES } from '../src/dolls/game/acciones'
export { abandonarEncargo, empezarEncargo, prepararPartida, problemaDelEncargo, terminarEncargo } from '../src/dolls/game/partidas'
export { fichaParaElServidor } from '../src/dolls/game/ranking'
export { Repeticion } from '../src/dolls/battle/simulacion'
