/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep space through atlantic — the whole site lives on this ramp.
        void: '#04091A',
        abyss: '#071229',
        deep: '#0B1B38',
        panel: '#0E2144',
        ridge: '#12294F',
        line: '#1C3A6B',
        haze: '#254E8C',
        // Signal blues
        beam: '#3B82F6',
        // Only for solid fills carrying white text. White on `beam` is 3.68:1,
        // which fails AA for the 14px semibold the primary button uses; this is
        // 6.70:1 and still unmistakably the same blue.
        beamdeep: '#1D4ED8',
        sky: '#60A5FA',
        ice: '#A5CDFF',
        cyan: '#38D9E8',
        // Accents that are deliberately NOT blue, so they can never be
        // mistaken for chrome: saves are amber, likes are rose.
        amber: '#F6A723',
        rose: '#FF6392',
        mint: '#34D399',
        // Type
        chalk: '#EAF2FF',
        mist: '#9FB6D6',
        // Raised from #61789B, which measured 4.13-4.41:1 against the panels it
        // actually sits on and so failed AA everywhere — and it carries the whole
        // secondary layer of every card: location, posted date, source, summary.
        // This is 5.95:1 on the darkest panel and still reads below `mist`.
        dim: '#7B93B9',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 28s linear infinite',
        float: 'float 7s ease-in-out infinite',
        sweep: 'sweep 3.2s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s ease-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-9px)' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.7)', opacity: '0.75' },
          '100%': { transform: 'scale(2.1)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
