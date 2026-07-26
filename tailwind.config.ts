import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './composables/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#03060c',
          900: '#080e18',
          800: '#0c1420',
          700: '#121c2a',
        },
        cyan: {
          soft: '#6ec8e8',
          mist: '#8ab4c4',
        },
      },
      fontFamily: {
        display: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Noto Sans SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 20px 48px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
} satisfies Config
