/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'media', // Enable media query based dark mode for Tailwind
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'], // Reverted to Inter
        // mono: ['var(--font-geist-mono)', 'monospace'], // Geist Mono can be kept if also configured in layout.tsx
      },
      colors: {
        // Example: define primary and neutral colors if needed later
        // 'primary': {
        //   DEFAULT: '#4f46e5', // indigo-600
        //   'hover': '#4338ca', // indigo-700
        // },
        // 'neutral-bg': 'var(--background)', // For Tailwind utilities
        // 'neutral-text': 'var(--foreground)',
      }
    },
  },
  plugins: [],
}