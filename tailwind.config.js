/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#0b0a17',
        arcane: '#15132b',
        rune: '#8b5cf6',
        ember: '#f97316',
        leaf: '#22c55e',
        stone: '#a16207',
        tide: '#38bdf8',
        void: '#c084fc',
        night: '#1a0f08',
        sand: '#c08b4a',
        dirt: '#8f6234',
        wood: '#7a4a26',
        plank: '#a9713a',
        bark: '#422816',
        bone: '#e9dfc6',
        cactus: '#3f6b3a',
        west: '#e0b463',
        blueteam: '#38bdf8',
        redteam: '#ef4444',
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        west: ['"Rye"', '"Cinzel"', 'Georgia', 'serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(139, 92, 246, 0.45)',
        gold: '0 0 22px rgba(224, 180, 99, 0.45)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
        shake: 'shake 320ms ease-in-out',
      },
    },
  },
  plugins: [],
}
