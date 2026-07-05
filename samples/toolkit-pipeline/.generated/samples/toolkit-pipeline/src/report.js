import { matchDiscriminated, matchKind } from "machinalayout/match";
import { asyncSummarySlug } from "./data.js";
function renderEventSummary(event) {
    return matchKind(event, {
        accepted: (value) => `accepted ${value.orderId}: ${value.summary}`,
        rejected: (value) => `rejected ${value.orderId}: ${value.reason}`,
        enriched: (value) => `enriched ${value.orderId}: ${value.risk} via ${value.route}`,
        timedOut: (value) => `timed out ${value.orderId}: ${value.timeoutMs}ms`,
    });
}
function renderEventCount(kind, counts) {
    return `${kind}: ${counts[kind]}`;
}
export function renderTextReport(report) {
    const lines = [
        "Machina Toolkit Pipeline Report",
        "",
        `Orders processed: ${report.processedCount}`,
        `Valid orders: ${report.validCount}`,
        `Invalid orders: ${report.invalidCount}`,
        "",
        "Concept diagnostics:",
        ...report.invalidOrders.map((order) => `- ${order.id}: ${order.diagnosticsText}`),
        "",
        "Iterator:",
        `- status: ${report.iterator.status}`,
        `- yield count: ${report.iterator.yieldCount}`,
        `- trace event count: ${report.iterator.traceCount}`,
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
        "- I.machine",
        "- T.concept",
        "- T.template",
        "- CT.tuple",
    ];
    return `${lines.join("\n")}\n`;
}
export function renderReportArtifacts(report) {
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
export function artifactMap(artifacts) {
    const pairs = artifacts.map((artifact) => matchDiscriminated(artifact, "type", {
        json: (value) => [value.path, value.content],
        text: (value) => [value.path, value.content],
    }));
    return Object.fromEntries(pairs);
}
