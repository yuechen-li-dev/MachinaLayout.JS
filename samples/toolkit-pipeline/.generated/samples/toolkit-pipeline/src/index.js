import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { matchDiscriminated } from "machinalayout/match";
import { artifactMap, renderReportArtifacts } from "./report.js";
import { runToolkitPipeline } from "./pipeline.js";
export async function generateToolkitPipelineArtifacts() {
    const report = await runToolkitPipeline();
    const artifacts = renderReportArtifacts(report);
    const mapped = artifactMap(artifacts);
    const sampleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const distRoot = resolve(sampleRoot, "dist");
    await mkdir(distRoot, { recursive: true });
    for (const artifact of artifacts) {
        const filePath = resolve(distRoot, artifact.path);
        await writeFile(filePath, matchDiscriminated(artifact, "type", {
            json: (value) => mapped[value.path],
            text: (value) => mapped[value.path],
        }), "utf8");
    }
    return {
        report,
        artifacts,
    };
}
await generateToolkitPipelineArtifacts();
