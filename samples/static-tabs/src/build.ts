import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CT } from "machinalayout/comptime";
import { nodeArtifactFs } from "machinalayout/comptime/node";
import { artifacts } from "./page.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const report = await CT.write(artifacts, { fs: nodeArtifactFs(), root });
if (report.diagnostics.length > 0) {
  throw new Error(CT.formatDiagnostics(report.diagnostics));
}
