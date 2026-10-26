/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ton: {
          blue: '#0098EA',
          dark: '#0B111A',
          card: '#161F2E',
          border: '#243247'
        }
      }
    },
  },
  plugins: [],
}
