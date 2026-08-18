import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // engine/ is the pure fee math; lib/ holds the pure auth logic
    // (lib/roles.ts). Anything needing a DB or next/headers stays out
    // of the suite deliberately — those are E2E checkpoints.
    include: ["engine/**/*.test.ts", "lib/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
