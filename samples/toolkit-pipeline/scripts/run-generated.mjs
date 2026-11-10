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

const { artifacts } = await import(pathToFileURL(path.join(generatedRoot, "artifacts.js")).href);
const { CT } = await import("machinalayout/comptime");
const { nodeArtifactFs } = await import("machinalayout/comptime/node");

const report = await CT.write(artifacts, { fs: nodeArtifactFs(), root: sampleRoot });
if (report.diagnostics.length > 0) {
  throw new Error(CT.formatDiagnostics(report.diagnostics));
}
