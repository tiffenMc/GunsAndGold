/**
 * `npm run amigos`: arranca el juego y le abre un **puente a internet** (un tunel gratis de
 * Cloudflare), para que un amigo pueda jugar contigo desde su casa sin subir nada a ningun sitio.
 *
 * Saca un enlace https://….trycloudflare.com: abrelo tú y pásaselo a tu amigo. Crea la sala en
 * "Partida con amigos" y dale el código. Mientras esta ventana siga abierta, el puente sigue abierto;
 * al cerrarla (Ctrl+C), se cierra.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'vite'
import cloudflared from 'cloudflared'

const servidor = await createServer({ server: { host: true } })
await servidor.listen()
const puerto = servidor.config.server.port ?? 5173
const direccion = servidor.resolvedUrls?.local?.[0] ?? `http://localhost:${puerto}/`
console.log(`\n  🤠 Juego arrancado en ${direccion}`)
console.log('  🌉 Abriendo el puente a internet…\n')

const tunel = spawn(cloudflared.bin, ['tunnel', '--no-autoupdate', '--url', direccion.replace(/\/$/, '')], { stdio: ['ignore', 'pipe', 'pipe'] })
let avisado = false
const leer = (datos) => {
  const texto = datos.toString()
  const enlace = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)
  if (enlace && !avisado) {
    avisado = true
    const linea = '═'.repeat(enlace[0].length + 4)
    console.log(`  ╔${linea}╗`)
    console.log(`  ║  ${enlace[0]}  ║`)
    console.log(`  ╚${linea}╝`)
    console.log('\n  1. Abre ese enlace (tú también, no el de localhost).')
    console.log('  2. Pásaselo a tu amigo.')
    console.log('  3. En el Pueblo: "Partida con amigos" → te da un código → pásaselo.')
    console.log('  4. Tu amigo: "Entrar con un código" → mete el código. ¡A jugar!\n')
    console.log('  (Tarda unos segundos en funcionar la primera vez. Ctrl+C para cerrar el puente.)\n')
  }
}
tunel.stdout.on('data', leer)
tunel.stderr.on('data', leer)
tunel.on('exit', (codigo) => {
  console.log(`\n  El puente se ha cerrado (${codigo}).`)
  process.exit(codigo ?? 0)
})
const cerrar = () => {
  tunel.kill()
  void servidor.close().then(() => process.exit(0))
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
