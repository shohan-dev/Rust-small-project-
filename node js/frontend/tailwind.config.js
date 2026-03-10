/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1a73e8',
        'primary-dark': '#1557b0',
        dark: {
          bg: '#202124',
          surface: '#292a2d',
          hover: '#3c4043',
          border: '#5f6368',
        },
      },
    },
  },
  plugins: [],
};
