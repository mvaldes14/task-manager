/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // dark (Linear near-black)
        tn: {
          bg:      '#08090c',
          bg2:     '#050507',
          bg3:     '#0e0f13',
          surface: '#131419',
          border:  '#20222a',
          muted:   '#8a8f98',
          nav:     '#b4b9c2',
          fg:      '#e6e8eb',
          blue:    '#89b4fa',
          purple:  '#bb9af7',
          green:   '#9ece6a',
          teal:    '#73daca',
          amber:   '#e0af68',
          red:     '#f7768e',
          cyan:    '#7dcfff',
        },
        // light (Linear-clean)
        td: {
          bg:      '#f7f8fa',
          bg2:     '#eceef2',
          bg3:     '#f1f3f6',
          surface: '#ffffff',
          border:  '#e2e5ea',
          muted:   '#6b7280',
          nav:     '#4b5563',
          fg:      '#1a1d23',
          blue:    '#2e7de9',
          purple:  '#9854f1',
          green:   '#2f9e44',
          teal:    '#0d9488',
          amber:   '#d97706',
          red:     '#f52a65',
          cyan:    '#0891b2',
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
        'shimmer':  'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        slideUp:  { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        toastIn:  { from: { opacity: 0, transform: 'translateY(12px) scale(0.95)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
        shimmer:  { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(200%)' } },
      },
      // Elevation scale — Linear-style, pairs with hairline border on each surface.
      // Convention: default surfaces → border + e1 (near-flat card).
      //             menus / popovers / dropdowns → e2.
      //             modals / bottom sheets → e3.
      //             Never use shadow-xl / shadow-2xl after this PR.
      boxShadow: {
        e1: '0 1px 2px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.04)',
        e2: '0 4px 12px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.06)',
        e3: '0 12px 32px -4px rgba(0,0,0,0.60), 0 4px 10px rgba(0,0,0,0.30), 0 0 0 1px rgba(255,255,255,0.08)',
      },
      // Motion tokens — every interactive element picks one of these durations + easings.
      // Convention: hover/focus → duration-fast, entry animations → duration-base/slow.
      // Press feedback: active:scale-[0.97]. Hover lift only where it already exists.
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '320ms',
      },
      transitionTimingFunction: {
        // reuses the slide-up curve — smooth deceleration
        standard: 'cubic-bezier(0.32,0.72,0,1)',
        // reuses the toast curve — slight overshoot for interactive pop
        spring:   'cubic-bezier(0.34,1.56,0.64,1)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    },
  ],
}
