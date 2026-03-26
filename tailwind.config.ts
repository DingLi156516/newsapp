import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  // content — tells Tailwind which source files to scan for class names at
  // build time. Any Tailwind class that doesn't appear in these files gets
  // stripped from the production CSS bundle, keeping it small. Java analogy:
  // classpath scanning — only classes found on the classpath are loaded.
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // extend — adds new values to the default Tailwind theme without replacing
    // the built-in ones. Omitting `extend` and writing keys directly would
    // wipe out all defaults (e.g., all built-in colors). Using `extend` is
    // like adding a new method to a class rather than @Override-ing existing
    // behaviour.
    extend: {
      fontFamily: {
        serif: ['DM Serif Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: '#0A0A0A',
      },
      borderRadius: {
        glass: '24px',
      },
      animation: {
        shimmer: 'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [
    // plugin(fn) — registers custom CSS utility classes that behave exactly
    // like built-in Tailwind utilities (tree-shaken, responsive variants, etc).
    // Java analogy: plugging a custom processor into a framework via its
    // extension point rather than editing framework source.
    plugin(function ({ addUtilities }) {
      addUtilities({
        // --- Glassmorphism utilities ---
        // These three classes produce the "frosted glass" card surfaces used
        // throughout the UI. The effect has two parts:
        //   1. backdrop-filter: blur() — blurs whatever is *behind* the element
        //      (the page content, other cards). This only works when the
        //      element's background is semi-transparent (rgba with alpha < 1).
        //   2. background-color with low alpha — lets the blurred background
        //      show through while tinting it dark.
        // -webkit-backdrop-filter is the same property for Safari; Safari
        // requires the vendor prefix even though other browsers don't.
        '.glass': {
          'backdrop-filter': 'blur(20px)',
          '-webkit-backdrop-filter': 'blur(20px)',
          'background-color': 'rgba(26, 26, 26, 0.4)',
          'border': '0.5px solid rgba(255, 255, 255, 0.08)',
          'border-radius': '24px',
        },
        '.glass-sm': {
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
          'background-color': 'rgba(26, 26, 26, 0.5)',
          'border': '0.5px solid rgba(255, 255, 255, 0.08)',
          'border-radius': '12px',
        },
        '.glass-pill': {
          'backdrop-filter': 'blur(16px)',
          '-webkit-backdrop-filter': 'blur(16px)',
          'background-color': 'rgba(26, 26, 26, 0.6)',
          'border': '0.5px solid rgba(255, 255, 255, 0.1)',
          'border-radius': '9999px', // large radius collapses to a pill/capsule shape
        },

        // --- Bias spectrum texture classes ---
        // Each political category gets a distinct visual texture so users can
        // identify bias at a glance. The pattern choices intentionally vary:
        // dense stripes → far positions, sparse stripes → lean positions,
        // dots → lean-left, solid fill → center and right.
        //
        // repeating-linear-gradient creates the diagonal stripe pattern:
        //   -45deg             — stripe angle
        //   rgba(...) 0–2px    — the visible stripe band (2px wide)
        //   transparent 2–Npx  — the transparent gap between stripes
        // Wider gaps (10px vs 6px) mean sparser, lighter-looking textures.
        '.spectrum-far-left': {
          'background-color': 'rgba(255, 255, 255, 0.85)',
        },
        '.spectrum-left': {
          'background-color': 'rgba(255, 255, 255, 0.65)',
        },
        '.spectrum-lean-left': {
          'background-color': 'rgba(255, 255, 255, 0.45)',
        },
        '.spectrum-center': {
          'background-color': 'rgba(255, 255, 255, 0.20)',
        },
        '.spectrum-lean-right': {
          'background-color': 'rgba(255, 255, 255, 0.12)',
        },
        '.spectrum-right': {
          'background-color': 'rgba(255, 255, 255, 0.06)',
        },
        '.spectrum-far-right': {
          'background-color': 'rgba(255, 255, 255, 0.03)',
        },
        '.spectrum-track': {
          'background-color': 'rgba(255, 255, 255, 0.10)',
          'border-radius': '9999px',
          'padding': '3px',
        },

        '.mesh-gradient': {
          background:
            'radial-gradient(ellipse at center, #0D0D0D 0%, #000000 100%)',
        },

        // .scrollbar-hide — hides the scrollbar visually while keeping scroll
        // functionality intact. Requires two separate properties because
        // browsers have diverged on this:
        //   -ms-overflow-style: none  — Internet Explorer and legacy Edge
        //   scrollbar-width: none     — Firefox standard property
        // Chrome/Safari hide the scrollbar via a CSS pseudo-element
        // (::-webkit-scrollbar) defined in globals.css.
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
      })
    }),
  ],
}

export default config
