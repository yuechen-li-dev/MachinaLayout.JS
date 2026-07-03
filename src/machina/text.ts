import type {
  MachinaTextAlign,
  MachinaTextLeading,
  MachinaTextOverflow,
  MachinaTextSpec,
  MachinaTextVariant,
  MachinaTextVerticalAlign,
  MachinaTextWrap,
} from "../text/types";
import { MachinaAuthoringError } from "./errors";

export type TextOptions = {
  variant?: MachinaTextVariant;
  wrap?: MachinaTextWrap;
  overflow?: MachinaTextOverflow;
  align?: MachinaTextAlign;
  leading?: MachinaTextLeading;
  blockGap?: number;
  listGap?: number;
  valign?: MachinaTextVerticalAlign;
};

type MachinaTextBuilder = {
  (content: string, options?: TextOptions): MachinaTextSpec;
  plain(content: string, options?: TextOptions): MachinaTextSpec;
  mono(content: string, options?: TextOptions): MachinaTextSpec;
};

function validateText(content: string, options: TextOptions = {}): void {
  if (typeof content !== "string") {
    throw new MachinaAuthoringError("InvalidTextSpec", "Text content must be a string.");
  }
  for (const field of ["blockGap", "listGap"] as const) {
    if (options[field] !== undefined && !Number.isFinite(options[field])) {
      throw new MachinaAuthoringError("InvalidTextSpec", `${field} must be a finite number.`);
    }
  }
}

function makeText(
  sourceKind: "machina-text" | "plain",
  content: string,
  options: TextOptions = {},
): MachinaTextSpec {
  validateText(content, options);
  return { kind: "text", source: { kind: sourceKind, text: content }, ...options };
}

export const text: MachinaTextBuilder = Object.assign(
  (content: string, options?: TextOptions) => makeText("machina-text", content, options),
  {
    plain: (content: string, options?: TextOptions) => makeText("plain", content, options),
    mono: (content: string, options?: TextOptions) =>
      makeText("plain", content, { variant: "mono", ...options }),
  },
);
