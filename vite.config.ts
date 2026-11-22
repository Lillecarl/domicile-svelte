import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

// Domicile's document has no <link> for a stylesheet, so components inject
// their own <style> instead of Vite extracting a CSS file.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: "src/index.ts",
      output: { entryFileNames: "shell.js" },
      preserveEntrySignatures: "exports-only",
    },
  },
  plugins: [svelte({ compilerOptions: { css: "injected" } })],
});
