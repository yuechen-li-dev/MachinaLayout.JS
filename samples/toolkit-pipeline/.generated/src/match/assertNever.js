export function assertNever(value, message = "Unexpected value reached assertNever.") {
    throw new Error(`${message} ${String(value)}`);
}
