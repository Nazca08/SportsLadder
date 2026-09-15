import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Tests import application modules, and those use the "@/..." alias that
 * tsconfig sets up for Next. Vitest does not read tsconfig paths, so without
 * this any test touching a file that imports "@/lib/..." fails to load.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
