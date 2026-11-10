import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ArtifactFs } from "../artifacts";

/** Node implementation of `ArtifactFs` (UTF-8, creates parent directories on write). */
export function nodeArtifactFs(): ArtifactFs {
  return {
    readText: async (filePath) => {
      try {
        return await readFile(filePath, "utf8");
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") {
          return undefined;
        }
        throw error;
      }
    },
    writeText: async (filePath, text) => {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, text, "utf8");
    },
    remove: async (filePath) => {
      await rm(filePath, { force: true });
    },
  };
}
