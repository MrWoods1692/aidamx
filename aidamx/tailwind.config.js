/** @type {import('@tailwindcss/postcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        border: 'var(--border-color)',
        card: 'var(--card-bg)',
        sidebar: 'var(--sidebar-bg)',
        input: 'var(--input-bg)',
        white: '#ffffff',
        black: '#000000',
        transparent: 'transparent',
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      backgroundColor: {
        primary: 'var(--primary)',
        app: 'var(--background)',
        card: 'var(--card-bg)',
        sidebar: 'var(--sidebar-bg)',
        input: 'var(--input-bg)',
        white: '#ffffff',
        black: '#000000',
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      textColor: {
        primary: 'var(--primary)',
        secondary: 'var(--text-secondary)',
        white: '#ffffff',
        black: '#000000',
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      borderColor: {
        gray: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        loadingProgress: {
          '0%': { width: '0%', backgroundPosition: '0 0' },
          '50%': { width: '50%', backgroundPosition: '100% 0' },
          '100%': { width: '100%', backgroundPosition: '0 0' }
        }
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideInLeft: 'slideInLeft 0.3s ease-in-out',
        slideOutLeft: 'slideOutLeft 0.3s ease-in-out',
        'loading-progress': 'loadingProgress 1.5s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}; 