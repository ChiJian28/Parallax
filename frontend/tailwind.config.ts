import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        parallax: {
          bg: 'var(--parallax-bg)',
          fg: 'var(--parallax-fg)',
          'fg-muted': 'var(--parallax-fg-muted)',
          accent: 'var(--parallax-accent)',
          'accent-alt': 'var(--parallax-accent-alt)',
          'accent-blue': 'var(--parallax-accent-blue)',
          panel: 'var(--parallax-panel)',
          border: 'var(--parallax-border)',
          'border-glass': 'var(--parallax-border-glass)',
          'border-subtle': 'var(--parallax-border-subtle)',
          glass: 'var(--parallax-glass-bg)',
          terminal: 'var(--parallax-terminal-bg)',
          'terminal-fg': 'var(--parallax-terminal-fg)',
        },
        mantle: {
          mint: '#00FFCC',
          'mint-alt': '#02E2B1',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        'geist-mono': ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      backdropBlur: {
        glass: '12px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'pulse-mint': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 204, 0)' },
          '50%': { boxShadow: '0 0 20px 2px rgba(0, 255, 204, 0.35)' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        'pulse-mint': 'pulse-mint 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
};

export default config;
