function pushDiagnostic(diagnostics, severity, code, message, path) {
    diagnostics.push({ severity, code, message, path });
}
export function validateIterMachine(machine) {
    const diagnostics = [];
    if (machine.kind !== "iterMachine") {
        pushDiagnostic(diagnostics, "error", "InvalidIterMachineKind", 'Iter machine kind must be "iterMachine".', "kind");
    }
    if (typeof machine.id !== "string" || machine.id.trim().length === 0) {
        pushDiagnostic(diagnostics, "error", "InvalidIterMachineId", "Iter machine id must be a non-empty string.", "id");
    }
    if (typeof machine.step !== "function") {
        pushDiagnostic(diagnostics, "error", "InvalidIterMachineStep", "Iter machine step must be a function.", "step");
    }
    if (machine.description !== undefined && typeof machine.description !== "string") {
        pushDiagnostic(diagnostics, "error", "InvalidIterMachineDescription", "Iter machine description must be a string when provided.", "description");
    }
    return diagnostics;
}
export function formatIterDiagnostics(diagnostics) {
    if (diagnostics.length === 0) {
        return "No iter diagnostics.";
    }
    return diagnostics
        .map((diagnostic) => {
        const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
        return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
        .join("\n");
}
