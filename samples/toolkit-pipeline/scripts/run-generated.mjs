import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  patchGeneratedJsImports,
  prepareSampleSubpathImports,
} from "../../../tools/prepare-sample-subpath-imports.mjs";

const sampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedRoot = path.join(sampleRoot, ".generated");
await prepareSampleSubpathImports([sampleRoot], { cwd: sampleRoot });
await patchGeneratedJsImports(generatedRoot);

const { runToolkitPipeline } = await import(
  pathToFileURL(path.join(generatedRoot, "pipeline.js")).href
);
const { renderReportArtifacts } = await import(
  pathToFileURL(path.join(generatedRoot, "report.js")).href
);

const report = await runToolkitPipeline();
const distRoot = path.join(sampleRoot, "dist");
await mkdir(distRoot, { recursive: true });

for (const artifact of renderReportArtifacts(report)) {
  await writeFile(path.join(distRoot, artifact.path), artifact.content, "utf8");
}
