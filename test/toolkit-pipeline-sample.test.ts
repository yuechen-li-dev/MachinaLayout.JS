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
const sampleSourcePath = resolve(sampleRoot, "src/pipeline.ts");
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

  it("includes processed counts, invalid diagnostics, iterator, batch, and async summaries", async () => {
    const report = await runToolkitPipeline();

    expect(report.processedCount).toBe(3);
    expect(report.validCount).toBe(2);
    expect(report.invalidCount).toBe(1);
    expect(report.invalidOrders).toEqual([
      {
        id: "bad-order",
        diagnostics: ["MissingConceptField", "ORDER_NEGATIVE_TOTAL"],
        groupedDiagnostics: {
          concept: ["MissingConceptField"],
          "toolkit-pipeline": ["ORDER_NEGATIVE_TOTAL"],
        },
        sharedDiagnostics: [
          {
            severity: "error",
            code: "MissingConceptField",
            message: "Required concept field 'customerId' is missing.",
            path: "orders[2].customerId",
            source: "concept",
          },
          {
            severity: "error",
            code: "ORDER_NEGATIVE_TOTAL",
            message: "Order total must be non-negative.",
            path: "orders[2].totalCents",
            source: "toolkit-pipeline",
            details: ["value: -100"],
          },
        ],
        diagnosticsText:
          "error MissingConceptField at orders[2].customerId\n  source: concept\n  Required concept field 'customerId' is missing.\n\nerror ORDER_NEGATIVE_TOTAL at orders[2].totalCents\n  source: toolkit-pipeline\n  Order total must be non-negative.\n  - value: -100",
      },
    ]);
    expect(report.iterator.status).toBe("done");
    expect(report.iterator.yieldCount).toBe(3);
    expect(report.batch).toMatchObject({
      status: "succeeded",
      resultKind: "ok",
      inputCount: 2,
      concurrency: 2,
      completedCount: 2,
      traceCount: 9,
    });
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
      "formatMoneyFr",
      "formatDiagnostics",
      "formatReportRow",
    ]);
    expect(report.captureDescriptions[2]?.envKeys).toEqual([
      "includeSeverity",
      "includeSource",
      "includePath",
    ]);
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
    expect(text).toContain("error ORDER_NEGATIVE_TOTAL at orders[2].totalCents");
    expect(text).toContain("matchKind");
    expect(text).toContain("matchDiscriminated");
    expect(text).toContain("Batch:");
    expect(text).toContain("- result: ok");
    expect(text).toContain("B.task");
    expect(text).toContain("B.run");
  });

  it("includes both concept and domain diagnostics in the combined report", async () => {
    const report = await runToolkitPipeline();

    expect(report.invalidOrders[0]?.groupedDiagnostics).toEqual({
      concept: ["MissingConceptField"],
      "toolkit-pipeline": ["ORDER_NEGATIVE_TOTAL"],
    });
  });

  it("uses the shared formatter output for text diagnostics", async () => {
    const report = await runToolkitPipeline();
    const text = renderTextReport(report);

    expect(text).toContain("Combined diagnostics:");
    expect(text).toContain("source: concept");
    expect(text).toContain("source: toolkit-pipeline");
  });

  it("records controller lifecycle traces plus domain-specific task traces without duplicate started events", async () => {
    const report = await runToolkitPipeline();

    expect(report.asyncBoards).toEqual([
      {
        orderId: "order-001",
        status: "succeeded",
        statePath: ["succeeded"],
        traceKinds: ["created", "started", "domain", "resolved"],
      },
      {
        orderId: "order-002",
        status: "timedOut",
        statePath: ["timedOut"],
        traceKinds: ["created", "started", "domain", "timedOut"],
      },
    ]);
  });

  it("uses A.runSnapshot for one-shot async receipt collection", () => {
    const source = readFileSync(sampleSourcePath, "utf8");

    expect(source).toContain("A.runSnapshot(");
    expect(source).toContain("B.task");
    expect(source).toContain("B.run");
    expect(source).not.toContain("A.createController(enrichOrder");
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
