# Duelo en el Oeste

Juego de cartas de vaqueros en 3D para móvil y PC, hecho con React + @react-three/fiber (Vite).
Se saca un soldado dibujando con el dedo el patrón de su carta; cada carta pelea a su manera
(minigun, rebote, área, cuerpo a cuerpo, médico…) y gana quien tumba el fuerte rival antes de los
5 minutos.

## Arrancar

```bash
npm install
npm run dev      # http://localhost:5173/  (si está ocupado, Vite te dice otro puerto)
```

- `/` — el juego (en `?manual` hay herramientas de depuración).

Con `npm run dev` no hay servidor: las cuentas y las partidas se quedan en el navegador. Para probar
con el servidor de verdad (cuentas, partidas guardadas, Los Más Buscados de todos y las salas con
amigos), `npm run servidor` (abre http://localhost:8787/).
- `/admin.html` — admin: cartas, armas y escenarios.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | servidor de desarrollo |
| `npm run build` | comprueba tipos y genera `dist/` |
| `npm test` | tests (motor de batalla, cartas, partidas de bots) |
| `npm run typecheck` | solo tipos (juego y servidor) |
| `npm run servidor` | el juego con su servidor, en local (Cloudflare `wrangler dev`) |
| `npm run deploy` | publica a mano en Cloudflare (normalmente lo hace solo al subir a GitHub) |

## Dónde está cada cosa (`src/dolls/`)

- `battle/` — motor de la batalla (`engine.ts`), estilos de combate (`estilos.ts`), ritmo (`economia.ts`), bot, pantalla y efectos.
- `cards/` — catálogo (50 muñecos + armas), modelo, patrones y almacén.
- `card3d/`, `dollParts.tsx`, `DollBody.tsx` — muñecos y cartas en 3D.
- `pueblo/` — el menú es un pueblo en 3D: tu vaquero anda donde tocas y entra en cada sitio (tablón, bar, saloon, sheriff y la diligencia al desierto). Los sitios y el decorado están en `lugares.ts`.
- `deck/`, `collection/`, `sobres/`, `campo/` — baraja, colección, sobres e incursiones (se abren desde los sitios del pueblo).
- `game/` — jugador, progreso, incursiones.
- `admin/` — herramientas de administración.

## El servidor (`servidor/`)

Va en Cloudflare: la web son los archivos de `dist/` y el servidor es `servidor/worker.ts` con dos
Durable Objects (con SQLite):

- `Pueblo` — las cuentas (usuario y contraseña, la contraseña resumida con PBKDF2), la partida de
  cada cuenta (sus personajes) y las fichas de Los Más Buscados. Rutas en `/api/…`.
- `Sala` — una sala por código para jugar con un amigo (WebSocket en `/sala`).

Lo que decide el servidor sin depender de Cloudflare está en `servidor/logica.ts` (con sus tests).
Ojo: de momento el juego le manda al servidor su partida tal cual, así que las monedas aún se
pueden falsear; para que no, las partidas tienen que jugarse en el servidor.

## Créditos

- Iconos: [Game Icons](https://game-icons.net) (Lorc, Delapouite y otros), licencia CC BY 3.0, vía `react-icons/gi`. Están todos en `src/dolls/Icono.tsx`.
