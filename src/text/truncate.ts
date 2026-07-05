import { TextFormatError } from "./errors";

export type TruncateOptions = {
  maxLength: number;
  ellipsis?: string;
};

export function truncate(value: string | number, options: TruncateOptions): string {
  const text = String(value);
  const { maxLength, ellipsis = "…" } = options;

  if (!Number.isFinite(maxLength) || maxLength <= 0 || !Number.isInteger(maxLength)) {
    throw new TextFormatError(
      "InvalidTruncateLength",
      "Text truncate maxLength must be a finite positive integer.",
    );
  }

  if (text.length <= maxLength) {
    return text;
  }

  if (ellipsis.length >= maxLength) {
    return ellipsis.slice(0, maxLength);
  }

  return `${text.slice(0, maxLength - ellipsis.length)}${ellipsis}`;
}
