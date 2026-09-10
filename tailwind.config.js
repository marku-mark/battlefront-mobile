/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#090b10",
        foreground: "#f8fafc",
        card: "#111318",
        "card-foreground": "#f8fafc",
        popover: "#111318",
        "popover-foreground": "#f8fafc",
        primary: "#b91c1c",
        "primary-foreground": "#f8fafc",
        secondary: "#1b1e24",
        "secondary-foreground": "#f8fafc",
        muted: "#1b1e24",
        "muted-foreground": "#9ca3af",
        accent: "#1b1e24",
        "accent-foreground": "#f8fafc",
        input: "#1b1e24",
        border: "#2a2e36",
        ring: "#ef1b1b",
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "8px",
      },
    },
  },
  plugins: [],
};
