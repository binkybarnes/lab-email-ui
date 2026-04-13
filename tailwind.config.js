/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f7f8fa',
        surface: '#ffffff',
        accent: '#1d4ed8',
        'accent-hover': '#1e40af',
        border: '#e2e8f0',
        'border-hover': '#94a3b8',
        primary: '#0f172a',
        secondary: '#64748b',
        muted: '#94a3b8',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 4px rgba(15,23,42,0.06), 0 0 0 1px rgba(15,23,42,0.04)',
        'card-hover': '0 4px 16px rgba(15,23,42,0.10), 0 0 0 1px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
}
