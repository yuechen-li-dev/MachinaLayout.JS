import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src/", import.meta.url));

// Resolve `machinalayout/*` to source so tests (including ones that import
// samples) never run against a stale or missing `dist` build.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^machinalayout$/, replacement: `${src}index.ts` },
      { find: /^machinalayout\/(.+)$/, replacement: `${src}$1/index.ts` },
    ],
  },
});
