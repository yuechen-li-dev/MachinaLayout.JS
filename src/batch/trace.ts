import type { BatchTraceEvent } from "./types";

export function formatBatchTraceEvent(event: BatchTraceEvent): string {
  const index = event.index === undefined ? "" : `[${event.index}]`;
  const message = event.message ? `: ${event.message}` : "";
  return `${event.batchId}${index} ${event.kind} @ ${event.at}${message}`;
}

export function formatBatchTrace(trace: readonly BatchTraceEvent[]): string {
  if (trace.length === 0) {
    return "No batch trace.";
  }

  return trace.map(formatBatchTraceEvent).join("\n");
}
