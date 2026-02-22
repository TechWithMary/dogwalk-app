/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#13ec13', // Tu verde neón
          dark: '#0dbf0d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'], // Fuente moderna
      }
    },
  },
  plugins: [],
}