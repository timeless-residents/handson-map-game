import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  base: '/handson-map-game/',
  plugins: [tailwindcss()],
});
