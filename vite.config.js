import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// vite config tailored for the Electron renderer process.  Output is
// written to `dist-renderer/` so it never conflicts with the primary
// `build/` directory used by the legacy CRA setup (or by other targets).

export default defineConfig({
  plugins: [react()],
  root: "src",
  base: "./",
  build: {
    outDir: "../dist-renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
  },
});
