/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{tsx,ts}',
    './components/**/*.{tsx,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

