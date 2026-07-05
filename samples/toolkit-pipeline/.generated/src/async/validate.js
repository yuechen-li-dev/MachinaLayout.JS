function pushDiagnostic(diagnostics, severity, code, message, path) {
    diagnostics.push({ severity, code, message, path });
}
export function validateAsyncTask(task) {
    const diagnostics = [];
    if (typeof task.id !== "string" || task.id.trim().length === 0) {
        pushDiagnostic(diagnostics, "error", "InvalidAsyncTaskId", "Async task id must be a non-empty string.", "id");
    }
    if (typeof task.run !== "function") {
        pushDiagnostic(diagnostics, "error", "InvalidAsyncTaskRun", "Async task run must be a function.", "run");
    }
    if (task.timeoutMs !== undefined && (!Number.isFinite(task.timeoutMs) || task.timeoutMs <= 0)) {
        pushDiagnostic(diagnostics, "error", "InvalidAsyncTaskTimeout", "Async task timeoutMs must be a positive finite number when provided.", "timeoutMs");
    }
    if (task.description !== undefined && typeof task.description !== "string") {
        pushDiagnostic(diagnostics, "error", "InvalidAsyncTaskDescription", "Async task description must be a string when provided.", "description");
    }
    return diagnostics;
}
export function formatAsyncTaskDiagnostics(diagnostics) {
    if (diagnostics.length === 0) {
        return "No async task diagnostics.";
    }
    return diagnostics
        .map((diagnostic) => {
        const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
        return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
        .join("\n");
}
