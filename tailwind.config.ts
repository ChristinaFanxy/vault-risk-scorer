import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#87B6BC',
          light: '#5c6b5e',
          cream: '#2d2a24',
          olive: '#B35656',
          bg: '#F6F09F',
          card: '#e8f0eb',
          border: '#b5c9ba',
        },
      },
    },
  },
  plugins: [],
}

export default config
