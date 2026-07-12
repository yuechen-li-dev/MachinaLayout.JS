import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "machinalayout/match", replacement: resolve(repoRoot, "src/match/index.ts") },
      { find: "machinalayout/react", replacement: resolve(repoRoot, "src/react/index.ts") },
      { find: "machinalayout/machina", replacement: resolve(repoRoot, "src/machina/index.ts") },
      { find: "machinalayout", replacement: resolve(repoRoot, "src/index.ts") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  test: {
    environment: "jsdom",
    deps: {
      moduleDirectories: [resolve(repoRoot, "node_modules")],
    },
  },
});
