import { D } from "machinalayout/diagnostics";
import { matchDiscriminated, matchKind } from "machinalayout/match";
import { asyncSummarySlug, type PipelineEventKind } from "./data.js";
import type { PipelineReport } from "./pipeline.js";

export type ReportArtifact =
  | {
      type: "json";
      path: "report.json";
      content: string;
    }
  | {
      type: "text";
      path: "report.txt";
      content: string;
    };

function renderEventSummary(event: PipelineReport["events"][number]): string {
  return matchKind(event, {
    accepted: (value) => `accepted ${value.orderId}: ${value.summary}`,
    rejected: (value) => `rejected ${value.orderId}: ${value.reason}`,
    enriched: (value) => `enriched ${value.orderId}: ${value.risk} via ${value.route}`,
    timedOut: (value) => `timed out ${value.orderId}: ${value.timeoutMs}ms`,
  });
}

function renderEventCount(kind: PipelineEventKind, counts: PipelineReport["eventCounts"]): string {
  return `${kind}: ${counts[kind]}`;
}

export function renderTextReport(report: PipelineReport): string {
  const invalidOrderLines =
    report.invalidOrders.length === 0
      ? ["- none"]
      : report.invalidOrders.flatMap((order) => [
          `- ${order.id}`,
          ...D.format(order.sharedDiagnostics)
            .split("\n")
            .map((line) => `  ${line}`),
        ]);

  const lines = [
    "Machina Toolkit Pipeline Report",
    "",
    `Orders processed: ${report.processedCount}`,
    `Valid orders: ${report.validCount}`,
    `Invalid orders: ${report.invalidCount}`,
    "",
    "Combined diagnostics:",
    ...invalidOrderLines,
    "",
    "Iterator:",
    `- status: ${report.iterator.status}`,
    `- yield count: ${report.iterator.yieldCount}`,
    `- trace event count: ${report.iterator.traceCount}`,
    "",
    "Batch:",
    `- status: ${report.batch.status}`,
    `- result: ${report.batch.resultKind}`,
    `- input count: ${report.batch.inputCount}`,
    `- concurrency: ${report.batch.concurrency}`,
    `- completed count: ${report.batch.completedCount}`,
    `- scheduler: ${report.batch.scheduler?.kind ?? "none"}`,
    `- scheduler workers: ${report.batch.scheduler?.workerCount ?? 0}`,
    `- scheduler max active: ${report.batch.scheduler?.maxActiveCount ?? 0}`,
    `- trace event count: ${report.batch.traceCount}`,
    "",
    "Async:",
    `- ok: ${report.asyncCounts.ok}`,
    `- err: ${report.asyncCounts.err}`,
    `- cancelled: ${report.asyncCounts.cancelled}`,
    `- timeout: ${report.asyncCounts.timeout}`,
    `- slug: ${asyncSummarySlug}`,
    "",
    "Events:",
    ...report.events.map((event) => `- ${renderEventSummary(event)}`),
    "",
    "Event counts:",
    `- ${renderEventCount("accepted", report.eventCounts)}`,
    `- ${renderEventCount("rejected", report.eventCounts)}`,
    `- ${renderEventCount("enriched", report.eventCounts)}`,
    `- ${renderEventCount("timedOut", report.eventCounts)}`,
    "",
    "Utilities exercised:",
    "- matchKind",
    "- matchDiscriminated",
    "- C.task",
    "- A.task",
    "- B.task",
    "- B.run",
    "- I.machine",
    "- T.concept",
    "- T.template",
    "- CT.tuple",
  ];

  return `${lines.join("\n")}\n`;
}

export function renderReportArtifacts(report: PipelineReport): readonly ReportArtifact[] {
  const json = JSON.stringify(report, null, 2);
  const text = renderTextReport(report);

  return [
    {
      type: "json",
      path: "report.json",
      content: json,
    },
    {
      type: "text",
      path: "report.txt",
      content: text,
    },
  ];
}

export function artifactMap(artifacts: readonly ReportArtifact[]): Record<string, string> {
  const pairs: ReadonlyArray<readonly [string, string]> = artifacts.map((artifact) =>
    matchDiscriminated(artifact, "type", {
      json: (value) => [value.path, value.content] as const,
      text: (value) => [value.path, value.content] as const,
    }),
  );

  return Object.fromEntries(pairs);
}
