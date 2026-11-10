import { CT } from "machinalayout/comptime";
import { must } from "machinalayout/kit";
import { runToolkitPipeline } from "./pipeline.js";
import { renderReportArtifacts } from "./report.js";

async function reportFile(path: string): Promise<string> {
  const files = renderReportArtifacts(await runToolkitPipeline());
  return must(
    files.find((file) => file.path === path),
    `report has no ${path}`,
  ).content;
}

/** The checked-in report. Async generator: the whole pipeline runs under the determinism guard. */
export const artifacts = CT.artifacts({
  outDir: "dist",
  artifacts: [
    CT.text("report.json", () => reportFile("report.json")),
    CT.text("report.txt", () => reportFile("report.txt")),
  ],
});
