/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        tn: {
          bg:      'var(--bg)',
          bg2:     'var(--bg2)',
          bg3:     'var(--bg3)',
          surface: 'var(--surface)',
          border:  'var(--border)',
          muted:   'var(--muted)',
          fg:      'var(--fg)',
          blue:    'var(--blue)',
          purple:  'var(--purple)',
          green:   'var(--green)',
          teal:    'var(--teal)',
          amber:   'var(--amber)',
          red:     'var(--red)',
          cyan:    'var(--cyan)',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'slide-up': 'slideUp 0.32s cubic-bezier(0.32,0.72,0,1)',
        'fade-in':  'fadeIn 0.18s ease',
        'toast-in': 'toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      },
      keyframes: {
        slideUp:  { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        toastIn:  { from: { opacity: 0, transform: 'translateY(12px) scale(0.95)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
      }
    },
  },
  plugins: [],
}
