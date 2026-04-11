/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e6f3fb',
          100: '#cce4f6',
          200: '#99c9ed',
          300: '#66aee4',
          400: '#3393db',
          500: '#0078d4',
          600: '#006cbf',
          700: '#005494',
          800: '#003d6e',
          900: '#002848',
        },
      },
    },
  },
  plugins: [],
}
