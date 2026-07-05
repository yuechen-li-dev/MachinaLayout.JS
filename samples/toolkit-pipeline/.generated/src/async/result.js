export function ok(value) {
    return {
        kind: "ok",
        value,
    };
}
export function err(error) {
    return {
        kind: "err",
        error,
    };
}
export function cancelled(reason) {
    return {
        kind: "cancelled",
        reason,
    };
}
export function timeout(timeoutMs) {
    return {
        kind: "timeout",
        timeoutMs,
    };
}
