import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#202124",
        leaf: "#256d4f",
        saffron: "#d39124",
        mist: "#f4f7f5"
      }
    }
  },
  plugins: []
};

export default config;
