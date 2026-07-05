function assertNonEmptyField(value, fieldName) {
    if (value.trim().length === 0) {
        throw new Error(`Machina diagnostic ${fieldName} must be non-empty.`);
    }
}
function createDiagnostic(severity, input) {
    assertNonEmptyField(input.code, "code");
    assertNonEmptyField(input.message, "message");
    return {
        severity,
        code: input.code,
        message: input.message,
        path: input.path,
        source: input.source,
        details: input.details ? [...input.details] : undefined,
    };
}
export function error(input) {
    return createDiagnostic("error", input);
}
export function warning(input) {
    return createDiagnostic("warning", input);
}
export function info(input) {
    return createDiagnostic("info", input);
}
export function ok(value, diagnostics = []) {
    return {
        kind: "ok",
        value,
        diagnostics: [...diagnostics],
    };
}
export function err(diagnostics) {
    return {
        kind: "err",
        diagnostics: [...diagnostics],
    };
}
export function from(diagnostics, defaults) {
    return diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        code: diagnostic.code,
        message: diagnostic.message,
        path: diagnostic.path,
        source: diagnostic.source ?? defaults?.source,
        details: diagnostic.details ? [...diagnostic.details] : undefined,
    }));
}
