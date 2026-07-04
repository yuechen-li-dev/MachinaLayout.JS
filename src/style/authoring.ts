import type { MachinaStyleRecord, MachinaStyleSheet, MachinaStyleTokens } from "./types";

type PlainRecord = Record<string, unknown>;

function cloneDefinedObject<T extends PlainRecord>(input: T): T {
  const output: PlainRecord = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = cloneDefinedObject(value as PlainRecord);
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

function mergeDefinedObject<T extends PlainRecord>(
  base: T | undefined,
  patch: T | undefined,
): T | undefined {
  if (!base && !patch) {
    return undefined;
  }
  const output: PlainRecord = base ? cloneDefinedObject(base) : {};
  if (!patch) {
    return output as T;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = mergeDefinedObject(
        output[key] as PlainRecord | undefined,
        value as PlainRecord,
      );
      continue;
    }
    output[key] = value;
  }
  return output as T;
}

export function tokens(input: MachinaStyleTokens): MachinaStyleTokens {
  return cloneDefinedObject(input);
}

export function style(record: MachinaStyleRecord): MachinaStyleRecord {
  return cloneDefinedObject(record);
}

export function withStyle(base: MachinaStyleRecord, patch: MachinaStyleRecord): MachinaStyleRecord {
  return {
    box: mergeDefinedObject(base.box, patch.box),
    surface: mergeDefinedObject(base.surface, patch.surface),
    text: mergeDefinedObject(base.text, patch.text),
    border: mergeDefinedObject(base.border, patch.border),
    effect: mergeDefinedObject(base.effect, patch.effect),
  };
}

export function sheet(input: MachinaStyleSheet): MachinaStyleSheet {
  const classes: Record<string, MachinaStyleRecord> = {};
  for (const [className, record] of Object.entries(input.classes)) {
    if (className.trim().length === 0) {
      throw new Error("MachinaStyle class names must be non-empty.");
    }
    classes[className] = style(record);
  }
  return {
    tokens: input.tokens ? tokens(input.tokens) : undefined,
    classes,
  };
}

export const S = {
  tokens,
  style,
  with: withStyle,
  merge: withStyle,
  sheet,
} as const;
