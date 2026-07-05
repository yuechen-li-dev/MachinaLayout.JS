export function formatIterTraceEvent(event) {
    const details = [];
    if (event.cursor !== undefined) {
        details.push("cursor");
    }
    if (event.yielded !== undefined) {
        details.push("yielded");
    }
    if (event.returnValue !== undefined) {
        details.push("returnValue");
    }
    if (event.error !== undefined) {
        details.push("error");
    }
    const message = event.message ? `: ${event.message}` : "";
    const suffix = details.length > 0 ? ` [${details.join(", ")}]` : "";
    return `${event.machineId}#${event.iteration} ${event.kind}${suffix}${message}`;
}
export function formatIterTrace(trace) {
    if (trace.length === 0) {
        return "No iter trace.";
    }
    return trace.map((event) => formatIterTraceEvent(event)).join("\n");
}
