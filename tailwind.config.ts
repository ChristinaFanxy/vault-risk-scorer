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
          DEFAULT: '#A98B76',
          light: '#BFA28C',
          cream: '#F3E4C9',
          olive: '#BABF94',
          bg: '#1a1610',
          card: '#2a231c',
          border: '#3d3229',
        },
      },
    },
  },
  plugins: [],
}

export default config
