/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#16181d',
        surface: '#1e2128',
        panel: '#22262e',
        'panel-hover': '#272b34',
        accent: '#4d6dff',
        'accent-hover': '#3d5df0',
        border: '#363b47',
        'border-hover': '#52586a',
        primary: '#f8fafc',
        secondary: '#cbd5e1',
        muted: '#94a3b8',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        serif: ['"IBM Plex Serif"', 'serif'],
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '5px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
      },
      boxShadow: {
        panel: '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.25)',
        'panel-hover': '0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(77,109,255,0.3)',
      },
    },
  },
  plugins: [],
}
