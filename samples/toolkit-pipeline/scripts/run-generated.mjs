import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedRoot = path.join(sampleRoot, ".generated");

async function listJsFiles(root) {
  const entries = await readdir(root);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry);
    const entryStat = await stat(fullPath);
    if (entryStat.isDirectory()) {
      files.push(...(await listJsFiles(fullPath)));
      continue;
    }

    if (entry.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function patchRelativeImports(sourceText) {
  return sourceText.replace(
    /((?:from|import)\s*["'])(\.\.?(?:\/[^"'.]+)+)(["'])/g,
    (_match, prefix, specifier, suffix) => `${prefix}${specifier}.js${suffix}`,
  );
}

for (const filePath of await listJsFiles(generatedRoot)) {
  const sourceText = await readFile(filePath, "utf8");
  const patched = patchRelativeImports(sourceText);
  if (patched !== sourceText) {
    await writeFile(filePath, patched, "utf8");
  }
}

await import(pathToFileURL(path.join(generatedRoot, "index.js")).href);
