import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        serif: ['DMSerifDisplay'],
        sans: ['Inter'],
      },
      colors: {
        obsidian: '#0A0A0A',
        // Spectrum colors (monochrome opacity gradient)
        'spectrum-far-left': 'rgba(255, 255, 255, 0.85)',
        'spectrum-left': 'rgba(255, 255, 255, 0.65)',
        'spectrum-lean-left': 'rgba(255, 255, 255, 0.45)',
        'spectrum-center': 'rgba(255, 255, 255, 0.20)',
        'spectrum-lean-right': 'rgba(255, 255, 255, 0.12)',
        'spectrum-right': 'rgba(255, 255, 255, 0.06)',
        'spectrum-far-right': 'rgba(255, 255, 255, 0.03)',
        // Glass backgrounds
        'glass-bg': 'rgba(26, 26, 26, 0.4)',
        'glass-sm-bg': 'rgba(26, 26, 26, 0.5)',
        'glass-pill-bg': 'rgba(26, 26, 26, 0.6)',
        'glass-border': 'rgba(255, 255, 255, 0.08)',
        'glass-pill-border': 'rgba(255, 255, 255, 0.1)',
      },
      borderRadius: {
        glass: '24px',
      },
    },
  },
  plugins: [],
}

export default config
