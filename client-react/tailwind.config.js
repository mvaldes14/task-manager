/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // dark (Tokyo Night)
        tn: {
          bg:      '#1a1b26',
          bg2:     '#16161e',
          bg3:     '#1f2335',
          surface: '#24283b',
          border:  '#292e42',
          muted:   '#565f89',
          fg:      '#c0caf5',
          blue:    '#7aa2f7',
          purple:  '#bb9af7',
          green:   '#9ece6a',
          teal:    '#73daca',
          amber:   '#e0af68',
          red:     '#f7768e',
          cyan:    '#7dcfff',
        },
        // light (Tokyo Night Day)
        td: {
          bg:      '#e1e2e7',
          bg2:     '#d5d6db',
          bg3:     '#e9e9ec',
          surface: '#f0f0f3',
          border:  '#c8c9d0',
          muted:   '#6172b0',
          fg:      '#3760bf',
          blue:    '#2e7de9',
          purple:  '#9854f1',
          green:   '#587539',
          amber:   '#8c6c3e',
          red:     '#f52a65',
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
