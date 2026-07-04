import type {
  MachinaStyleLayer,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleSlot,
  MachinaStyleTokens,
  MachinaTokenGroup,
} from "./types";
import { createMachinaTokenReference } from "./tokens";

type PlainRecord = Record<string, unknown>;
type StyleGroupName = keyof MachinaStyleRecord;

const STYLE_GROUPS = ["box", "surface", "text", "border", "effect"] as const;
const STYLE_FIELDS = {
  box: [
    "display",
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "padding",
    "paddingX",
    "paddingY",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "margin",
    "marginX",
    "marginY",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "gap",
    "alignItems",
    "justifyContent",
    "overflow",
  ],
  surface: ["fill", "radius", "opacity"],
  text: [
    "color",
    "font",
    "family",
    "size",
    "lineHeight",
    "weight",
    "letterSpacing",
    "align",
    "transform",
  ],
  border: ["color", "width", "style"],
  effect: ["shadow"],
} as const satisfies Record<StyleGroupName, readonly string[]>;

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

export function isMachinaStyleSlot<T>(value: unknown): value is MachinaStyleSlot<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return kind === "set" || kind === "inherit" || kind === "unset";
}

function assertNever(value: never): never {
  throw new Error(`Unhandled style slot kind: ${String(value)}`);
}

function assertSetValue(value: unknown): void {
  if (value === undefined) {
    throw new Error("MachinaStyle set slot value must not be undefined.");
  }
  if (typeof value === "object" && !value) {
    throw new Error("MachinaStyle set slot value must be defined.");
  }
}

export function setStyleSlot<T>(value: T): MachinaStyleSlot<T> {
  assertSetValue(value);
  return Object.freeze({ kind: "set", value }) as MachinaStyleSlot<T>;
}

export function inheritStyleSlot<T = unknown>(): MachinaStyleSlot<T> {
  return Object.freeze({ kind: "inherit" }) as MachinaStyleSlot<T>;
}

export function unsetStyleSlot<T = unknown>(): MachinaStyleSlot<T> {
  return Object.freeze({ kind: "unset" }) as MachinaStyleSlot<T>;
}

function normalizeLayerValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (isMachinaStyleSlot(value)) {
    switch (value.kind) {
      case "set":
        assertSetValue(value.value);
        return setStyleSlot(value.value);
      case "inherit":
        return inheritStyleSlot();
      case "unset":
        return unsetStyleSlot();
      default:
        return assertNever(value);
    }
  }
  return setStyleSlot(value);
}

export function layer(record: MachinaStyleLayer): MachinaStyleLayer {
  const output: PlainRecord = {};
  for (const group of STYLE_GROUPS) {
    const inputGroup = record[group] as PlainRecord | undefined;
    if (!inputGroup) {
      continue;
    }
    const outputGroup: PlainRecord = {};
    for (const field of STYLE_FIELDS[group]) {
      const value = inputGroup[field];
      const normalized = normalizeLayerValue(value);
      if (normalized !== undefined) {
        outputGroup[field] = normalized;
      }
    }
    if (Object.keys(outputGroup).length > 0) {
      output[group] = outputGroup;
    }
  }
  return output as MachinaStyleLayer;
}

function resolveSlotValue(slot: MachinaStyleSlot<unknown>, baseValue: unknown): unknown {
  switch (slot.kind) {
    case "set":
      return slot.value;
    case "inherit":
      return baseValue;
    case "unset":
      return undefined;
    default:
      return assertNever(slot);
  }
}

function resolveRecord(input: MachinaStyleLayer | MachinaStyleRecord): MachinaStyleRecord {
  const output: PlainRecord = {};
  for (const group of STYLE_GROUPS) {
    const inputGroup = input[group] as PlainRecord | undefined;
    if (!inputGroup) {
      continue;
    }
    const outputGroup: PlainRecord = {};
    for (const field of STYLE_FIELDS[group]) {
      const value = inputGroup[field];
      if (value === undefined) {
        continue;
      }
      const resolved = isMachinaStyleSlot(value)
        ? resolveSlotValue(value as MachinaStyleSlot<unknown>, undefined)
        : value;
      if (resolved !== undefined) {
        outputGroup[field] = cloneStyleValue(resolved);
      }
    }
    if (Object.keys(outputGroup).length > 0) {
      output[group] = outputGroup;
    }
  }
  return output as MachinaStyleRecord;
}

function cloneStyleValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return cloneDefinedObject(value as PlainRecord);
  }
  return value;
}

export function overMachinaStyle(
  top: MachinaStyleLayer | MachinaStyleRecord,
  base: MachinaStyleLayer | MachinaStyleRecord,
): MachinaStyleRecord {
  const resolvedBase = resolveRecord(base);
  const output = cloneDefinedObject(resolvedBase as PlainRecord);

  for (const group of STYLE_GROUPS) {
    const topGroup = top[group] as PlainRecord | undefined;
    if (!topGroup) {
      continue;
    }
    const baseGroup = resolvedBase[group] as PlainRecord | undefined;
    const outputGroup: PlainRecord = { ...((output[group] as PlainRecord | undefined) ?? {}) };
    for (const field of STYLE_FIELDS[group]) {
      const topValue = topGroup[field];
      if (topValue === undefined) {
        continue;
      }
      const baseValue = baseGroup?.[field];
      const resolved = isMachinaStyleSlot(topValue)
        ? resolveSlotValue(topValue as MachinaStyleSlot<unknown>, baseValue)
        : topValue;
      if (resolved === undefined) {
        delete outputGroup[field];
        continue;
      }
      outputGroup[field] = cloneStyleValue(resolved);
    }
    if (Object.keys(outputGroup).length > 0) {
      output[group] = outputGroup;
    } else {
      delete output[group];
    }
  }

  return output as MachinaStyleRecord;
}

export function composeMachinaStyles(
  ...layers: readonly (MachinaStyleLayer | MachinaStyleRecord)[]
): MachinaStyleRecord {
  return layers.reduce<MachinaStyleRecord>(
    (base, nextLayer) => overMachinaStyle(nextLayer, base),
    {},
  );
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

export function token(group: MachinaTokenGroup, key: string) {
  return createMachinaTokenReference(group, key);
}

export function createMachinaClassNames<TClasses extends Record<string, unknown>>(sheet: {
  classes: TClasses;
}): { readonly [K in keyof TClasses]: string } {
  const classNames = {} as { [K in keyof TClasses]: string };
  for (const className of Object.keys(sheet.classes)) {
    classNames[className as keyof TClasses] = className;
  }
  return Object.freeze(classNames);
}

export function classes<TClasses extends Record<string, unknown>>(sheet: {
  classes: TClasses;
}): { readonly [K in keyof TClasses]: string } {
  return createMachinaClassNames(sheet);
}

export const S = {
  tokens,
  token,
  style,
  set: setStyleSlot,
  inherit: inheritStyleSlot,
  unset: unsetStyleSlot,
  layer,
  over: overMachinaStyle,
  compose: composeMachinaStyles,
  with: withStyle,
  merge: withStyle,
  sheet,
  classes,
} as const;
