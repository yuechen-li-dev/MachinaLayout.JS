import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runToolkitPipeline } from "../samples/toolkit-pipeline/src/pipeline";
import {
  artifactMap,
  renderReportArtifacts,
  renderTextReport,
} from "../samples/toolkit-pipeline/src/report";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleRoot = resolve(repoRoot, "samples/toolkit-pipeline");
const reportJsonPath = resolve(sampleRoot, "dist/report.json");
const reportTextPath = resolve(sampleRoot, "dist/report.txt");

describe("toolkit pipeline sample", () => {
  it("builds the sample package", () => {
    execSync("npm run build", {
      cwd: sampleRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        CI: "1",
      },
    });
  });

  it("keeps checked-in report artifacts in sync with the pipeline output", async () => {
    const report = await runToolkitPipeline();
    const artifacts = artifactMap(renderReportArtifacts(report));
    const checkedJson = readFileSync(reportJsonPath, "utf8");
    const checkedText = readFileSync(reportTextPath, "utf8");

    expect(artifacts["report.json"]).toBe(checkedJson);
    expect(artifacts["report.txt"]).toBe(checkedText);
    expect(renderTextReport(report)).toBe(checkedText);
  });

  it("includes processed counts, invalid diagnostics, iterator summary, and async summary", async () => {
    const report = await runToolkitPipeline();

    expect(report.processedCount).toBe(3);
    expect(report.validCount).toBe(2);
    expect(report.invalidCount).toBe(1);
    expect(report.invalidOrders).toEqual([
      {
        id: "bad-order",
        diagnostics: ["MissingConceptField", "NegativeTotalCents"],
        diagnosticsText:
          "[error] MissingConceptField at customerId: Required concept field 'customerId' is missing.; [error] NegativeTotalCents at totalCents: Order totals must not be negative for export.",
      },
    ]);
    expect(report.iterator.status).toBe("done");
    expect(report.iterator.yieldCount).toBe(3);
    expect(report.asyncCounts).toEqual({
      ok: 1,
      err: 0,
      cancelled: 0,
      timeout: 1,
    });
  });

  it("includes capture, concept, and template descriptions in the report payload", async () => {
    const report = await runToolkitPipeline();

    expect(report.captureDescriptions.map((entry) => entry.id)).toEqual([
      "formatMoney",
      "formatMoney",
      "formatDiagnostics",
      "formatReportRow",
    ]);
    expect(report.captureDescriptions[2]?.envKeys).toEqual(["includeSeverity"]);
    expect(report.conceptDescriptions[2]).toContain("Concept: PricedOrder");
    expect(report.templateDescriptions[0]).toContain("Template: summarizeOrder");
  });

  it("renders deterministic event summaries from discriminated payload unions", async () => {
    const reportA = await runToolkitPipeline();
    const reportB = await runToolkitPipeline();
    const text = renderTextReport(reportA);

    expect(reportA).toEqual(reportB);
    expect(text).toContain("accepted order-001");
    expect(text).toContain("timed out order-002: 15ms");
    expect(text).toContain("matchKind");
    expect(text).toContain("matchDiscriminated");
  });

  it("does not make external network calls", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    Object.assign(globalThis, { fetch: fetchSpy });

    try {
      await runToolkitPipeline();
    } finally {
      Object.assign(globalThis, { fetch: originalFetch });
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
