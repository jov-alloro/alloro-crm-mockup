import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Spec §3.2: the deliverable is ONE self-contained dist/index.html that opens by
 * double-click from the file system, with no server.
 *
 * - `viteSingleFile` inlines every script and style into the one HTML file.
 * - `base: "./"` keeps any remaining URL relative, so file:// works.
 * - `assetsInlineLimit: Infinity` inlines every asset rather than emitting a
 *   sibling file the single HTML could not reach over file://.
 *
 * Acceptance A35 opens the built file with no server and expects ZERO network
 * requests of any kind. Nothing here may add a CDN font, an icon sheet, or a
 * source map fetched at runtime.
 */
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 4000,
    sourcemap: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
