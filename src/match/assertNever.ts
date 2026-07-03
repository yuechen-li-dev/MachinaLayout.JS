export function assertNever(
  value: never,
  message = "Unexpected value reached assertNever.",
): never {
  throw new Error(`${message} ${String(value)}`);
}
