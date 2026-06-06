import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paytm: {
          cyan: "#00baf2",
          "cyan-dark": "#009fd6",
          navy: "#002970",
          "navy-light": "#20336b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
