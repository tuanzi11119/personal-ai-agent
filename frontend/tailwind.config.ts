import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1152px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        zone: {
          cs: "hsl(var(--zone-cs))",
          "cs-soft": "hsl(var(--zone-cs-soft))",
          teaching: "hsl(var(--zone-teaching))",
          "teaching-soft": "hsl(var(--zone-teaching-soft))",
        },
      },
      borderRadius: {
        lg: "8px",
        md: "8px",
        sm: "6px",
        xl: "12px",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "PingFang SC",
          "var(--font-noto)",
          "Noto Sans SC",
          "Microsoft YaHei",
          "WenQuanYi Micro Hei",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.7" }],
        sm: ["14px", { lineHeight: "1.7" }],
        base: ["16px", { lineHeight: "1.7" }],
        lg: ["20px", { lineHeight: "1.25" }],
        xl: ["24px", { lineHeight: "1.25" }],
        "2xl": ["32px", { lineHeight: "1.25" }],
        "3xl": ["48px", { lineHeight: "1.25" }],
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
      },
      keyframes: {
        "caret-blink": {
          "0%, 45%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "step-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(0.72)", opacity: "0.45" },
        },
      },
      animation: {
        "caret-blink": "caret-blink 1s steps(1) infinite",
        "step-pulse": "step-pulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
