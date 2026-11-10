import { CT } from "machinalayout/comptime";
import { runToolkitPipeline } from "./pipeline.js";
import { renderReportArtifacts } from "./report.js";

async function reportFile(path: string): Promise<string> {
  const file = renderReportArtifacts(await runToolkitPipeline()).find(
    (candidate) => candidate.path === path,
  );
  if (!file) {
    throw new Error(`report has no ${path}`);
  }
  return file.content;
}

/** The checked-in report. Async generator: the whole pipeline runs under the determinism guard. */
export const artifacts = CT.artifacts({
  outDir: "dist",
  artifacts: [
    CT.text("report.json", () => reportFile("report.json")),
    CT.text("report.txt", () => reportFile("report.txt")),
  ],
});
