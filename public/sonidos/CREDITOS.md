# Créditos del sonido

## `partida.mp3`

La canción que suena de fondo en las partidas. Para cambiarla, deja tu canción con ese mismo nombre.

## `cartas/*.wav`

Las **frases** que suelta cada carta al entrar al campo, una por carta. Salen del **Voiceover Pack**
de [Kenney](https://kenney.nl/assets/voiceover-pack), publicado como **CC0** (dominio público, sin
atribución obligatoria, pero se agradece).

## `armas/*.wav` y `batalla/*.wav`

El **disparo de cada arma** y los sonidos sueltos de la batalla (**la bala** de las tropas y el
**rebote** contra el escudo de la vagoneta). Salen de dos recopilatorios **CC0**: el
`25-CC0-bang-sfx` y los sonidos de armas de
[Warfork](https://github.com/lavenderdotpet/CC0-Public-Domain-Sounds) (Warfork es un juego libre con
sus sonidos en CC0).

Todo se cocina con `node scripts/sonidos.mjs`, que recorta el silencio, empareja el volumen, pasa a
mono y deja WAV (suena en cualquier navegador; los `.ogg` originales no los lee Safari). Los ficheros
de partida están en `desacargas/` (fuera del repo).

Para cambiar cualquier sonido basta con dejar un WAV con el nombre que toca: `vaquero.wav`,
`enterrador.wav`, `humo.wav` en `cartas/`, o `revolver.wav`, `escopeta.wav`… en `armas/`. Si falta
alguno, entra la versión sintetizada de `src/dolls/battle/voices.ts` (para las cartas) o el disparo
de siempre (para las armas).
