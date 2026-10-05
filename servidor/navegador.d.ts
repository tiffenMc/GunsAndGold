/**
 * En el servidor no hay navegador. Lo poco del juego que toca `localStorage` va dentro de un try
 * (y sin él, sigue en memoria), y lo de `window` solo lo usan las pantallas, que aquí no se montan.
 */
declare const localStorage: {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
  removeItem(clave: string): void
}
declare const window: {
  setInterval(fn: () => void, ms: number): number
  clearInterval(id: number): void
  setTimeout(fn: () => void, ms: number): number
  clearTimeout(id: number): void
}
