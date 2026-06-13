import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "lib/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "e2e", ".next"],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/booking-engine/**/*.ts", "lib/pricing/**/*.ts"],
      exclude: [
        "lib/booking-engine/**/*.test.ts",
        "lib/booking-engine/fixtures.ts",
        "lib/pricing/**/*.test.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The real package throws outside a React Server environment; marked
      // lib/ modules have colocated tests, so stub it (F-086g).
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
