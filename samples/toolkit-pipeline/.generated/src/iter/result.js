export function yieldValue(value, cursor) {
    return {
        kind: "yield",
        value,
        cursor,
    };
}
export { yieldValue as yield };
export function done(value) {
    return {
        kind: "done",
        value,
    };
}
export function fail(error) {
    return {
        kind: "fail",
        error,
    };
}
export function yieldedNext(value) {
    return {
        kind: "yield",
        value,
        done: false,
    };
}
export function doneNext(value) {
    return {
        kind: "done",
        value,
        done: true,
    };
}
export function failNext(error) {
    return {
        kind: "fail",
        error,
        done: true,
    };
}
