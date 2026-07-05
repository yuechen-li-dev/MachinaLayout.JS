export function formatAsyncTaskTraceEvent(event) {
    const message = event.message ? `: ${event.message}` : "";
    return `${event.taskId}#${event.runId} ${event.kind} @ ${event.at}${message}`;
}
export function formatAsyncTaskTrace(trace) {
    if (trace.length === 0) {
        return "No async task trace.";
    }
    return trace.map(formatAsyncTaskTraceEvent).join("\n");
}
