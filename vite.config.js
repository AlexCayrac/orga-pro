import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Project root: index.html lives at repository root
  root: '.',

  // public/ is used only for static assets (copied as-is)
  publicDir: 'public',

  // Use relative base so built files work with file:// in Electron
  base: './',

  server: {
    port: 3001,
  },

  build: {
    // Output directory required by your constraint
    outDir: 'build',
    emptyOutDir: true,

    rollupOptions: {
      // Multiple HTML entrypoints: main index at repo root, others in public/
      input: {
        main: path.resolve(__dirname, 'index.html'),
        export: path.resolve(__dirname, 'public/export-window.html'),
        differences: path.resolve(__dirname, 'public/differences-window.html'),
      },
      output: {
        // Keep asset naming similar to CRA output for minimal Electron changes
        assetFileNames: '[name].[ext]',
        chunkFileNames: 'js/[name].js',
        entryFileNames: 'js/[name].js',
      },
    },
  },

  // Make sure aliasing is available
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  // Avoid surprises for libs expecting process.env
  define: {
    'process.env': {},
  },
});
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
