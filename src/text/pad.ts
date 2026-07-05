import { TextFormatError } from "./errors";

function assertValidPadLength(length: number): void {
  if (!Number.isFinite(length) || length < 0 || !Number.isInteger(length)) {
    throw new TextFormatError(
      "InvalidTextLength",
      "Text pad length must be a finite non-negative integer.",
    );
  }
}

function normalizeFill(fill: string | undefined): string {
  const normalized = fill ?? " ";
  if (normalized.length === 0) {
    throw new TextFormatError("InvalidTextFill", "Text pad fill must not be empty.");
  }
  return normalized;
}

function createFill(length: number, fill: string): string {
  return fill.repeat(Math.ceil(length / fill.length)).slice(0, length);
}

export function leftPad(value: string | number, length: number, fill?: string): string {
  const text = String(value);
  assertValidPadLength(length);
  const padFill = normalizeFill(fill);
  const missing = length - text.length;

  if (missing <= 0) {
    return text;
  }

  return `${createFill(missing, padFill)}${text}`;
}

export function rightPad(value: string | number, length: number, fill?: string): string {
  const text = String(value);
  assertValidPadLength(length);
  const padFill = normalizeFill(fill);
  const missing = length - text.length;

  if (missing <= 0) {
    return text;
  }

  return `${text}${createFill(missing, padFill)}`;
}

export function centerPad(value: string | number, length: number, fill?: string): string {
  const text = String(value);
  assertValidPadLength(length);
  const padFill = normalizeFill(fill);
  const missing = length - text.length;

  if (missing <= 0) {
    return text;
  }

  const leftLength = Math.floor(missing / 2);
  const rightLength = missing - leftLength;
  return `${createFill(leftLength, padFill)}${text}${createFill(rightLength, padFill)}`;
}
