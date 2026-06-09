import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Apple-style color system
        bg: {
          page: "#F5F5F7",
          card: "#FFFFFF",
          immersive: "#FAFBFC",
        },
        text: {
          primary: "#1D1D1F",
          secondary: "#6E6E73",
          tertiary: "#AEAEB2",
          inverse: "#FFFFFF",
        },
        brand: {
          blue: "#0071E3",
          blueHover: "#0066CC",
        },
        semantic: {
          success: "#34C759",
          warning: "#FF9500",
          danger: "#FF3B30",
        },
        highlight: {
          bg: "#FFF3CD",
          text: "#1D1D1F",
        },
        divider: "#E5E5EA",
      },
      fontSize: {
        "page-title": ["28px", { lineHeight: "1.3", fontWeight: "700" }],
        "section-title": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "card-title": ["17px", { lineHeight: "1.5", fontWeight: "500" }],
        body: ["15px", { lineHeight: "1.5", fontWeight: "400" }],
        caption: ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        label: ["11px", { lineHeight: "1.3", fontWeight: "500" }],
        "btn-text": ["17px", { lineHeight: "1.3", fontWeight: "600" }],
        "stat-number": ["56px", { lineHeight: "1.1", fontWeight: "700" }],
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
      borderRadius: {
        card: "16px",
        button: "12px",
        tag: "8px",
        sheet: "20px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.04)",
        button: "0 1px 3px rgba(0, 0, 0, 0.08)",
      },
      animation: {
        "slide-up": "slideUp 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
      },
      keyframes: {
        slideUp: {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
