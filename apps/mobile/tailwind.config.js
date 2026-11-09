/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#faf7f2', dark: '#16130f' },
        surface: { DEFAULT: '#ffffff', dark: '#201c17' },
        surface2: { DEFAULT: '#f3eee6', dark: '#2a251f' },
        ink: { DEFAULT: '#1d1a16', dark: '#f3ede4' },
        muted: { DEFAULT: '#6b645a', dark: '#a99f92' },
        line: { DEFAULT: '#e7e0d5', dark: '#3a332b' },
        brand: { DEFAULT: '#e2603a', dark: '#f07a52' },
        brandsoft: { DEFAULT: '#fbe4da', dark: '#3d2419' },
        ok: { DEFAULT: '#2f7d4f', dark: '#6fcf94' },
        oksoft: { DEFAULT: '#dff0e5', dark: '#1d3527' },
        warn: { DEFAULT: '#9a6400', dark: '#f2bd5c' },
        warnsoft: { DEFAULT: '#fbefd4', dark: '#3a2e14' },
        danger: { DEFAULT: '#b4372b', dark: '#f08070' },
      },
    },
  },
  plugins: [],
};
