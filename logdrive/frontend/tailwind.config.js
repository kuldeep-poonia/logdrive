/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'neon-green': '#39ff14',
        'neon-yellow': '#ffea00',
        'neon-red': '#ff3300',
        'neon-cyan': '#00ffff',
      },
    },
  },
  plugins: [],
};