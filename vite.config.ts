import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { salaRelay } from './vite.sala'

export default defineConfig({
  // Las salas para jugar con un amigo (el servidor de desarrollo hace de cartero).
  plugins: [react(), salaRelay()],
  // Escucha en la red local: asi el enlace de la sala llega al amigo por wifi.
  server: {
    host: true,
    // Acepta tambien dominios de tunel (cloudflared/ngrok) al probar desde fuera.
    allowedHosts: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Paginas: el Duelo en el Oeste y su admin.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
