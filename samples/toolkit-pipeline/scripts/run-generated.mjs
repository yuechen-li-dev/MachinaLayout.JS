import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedRoot = path.join(sampleRoot, ".generated");
const generatedSampleRoot = path.join(generatedRoot, "samples", "toolkit-pipeline", "src");

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

const { runToolkitPipeline } = await import(
  pathToFileURL(path.join(generatedSampleRoot, "pipeline.js")).href
);
const { renderReportArtifacts } = await import(
  pathToFileURL(path.join(generatedSampleRoot, "report.js")).href
);

const report = await runToolkitPipeline();
const distRoot = path.join(sampleRoot, "dist");
await mkdir(distRoot, { recursive: true });

for (const artifact of renderReportArtifacts(report)) {
  await writeFile(path.join(distRoot, artifact.path), artifact.content, "utf8");
}
