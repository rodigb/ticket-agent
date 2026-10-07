import type { Config } from 'tailwindcss';
import { tailwindColors } from './src/theme';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: tailwindColors,
    },
  },
} satisfies Config;