import type { AsyncTaskTraceEvent } from "./types";

export function formatAsyncTaskTraceEvent(event: AsyncTaskTraceEvent): string {
  const message = event.message ? `: ${event.message}` : "";
  return `${event.taskId}#${event.runId} ${event.kind} @ ${event.at}${message}`;
}

export function formatAsyncTaskTrace(trace: readonly AsyncTaskTraceEvent[]): string {
  if (trace.length === 0) {
    return "No async task trace.";
  }
  return trace.map(formatAsyncTaskTraceEvent).join("\n");
}
