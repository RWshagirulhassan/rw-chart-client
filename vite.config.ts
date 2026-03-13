import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8086",
        changeOrigin: true,
      },
      "/kite": {
        target: "http://localhost:8086",
        changeOrigin: true,
      },
      "/engine": {
        target: "http://localhost:8086",
        changeOrigin: true,
      },
      "/v1": {
        target: "http://localhost:8086",
        changeOrigin: true,
      },
      "/ticks": {
        target: "http://localhost:8086",
        changeOrigin: true,
        ws: true,
      },
      "/trading": {
        target: "http://localhost:8086",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
