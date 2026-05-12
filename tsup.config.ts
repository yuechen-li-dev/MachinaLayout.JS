import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.ts",
    "text/index": "src/text/index.ts",
    "text/react/index": "src/text/react/index.ts",
    "text/react-native/index": "src/text/react-native/index.ts",
    "react-native/index": "src/react-native/index.ts",
    "vue/index": "src/vue/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: false,
  external: ["react", "react-dom", "react-native", "react/jsx-runtime", "vue"],
});
