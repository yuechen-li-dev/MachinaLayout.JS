import type {
  MachinaResponsiveStyle,
  MachinaResponsiveVariant,
  MachinaStatefulStyle,
  MachinaStyleLayer,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleStateName,
  MachinaStyleSlot,
  MachinaStyleTokens,
  MachinaTokenGroup,
} from "./types";
import { matchKind } from "../match";
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

const RESPONSIVE_VARIANTS = ["desktop", "tablet", "phone"] as const;
const MACHINA_CLASS_NAME_PATTERN = /^[^\s]+$/;
const MACHINA_STATE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

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

function assertValidClassName(className: string): void {
  if (className.trim().length === 0) {
    throw new Error("MachinaStyle class names must be non-empty.");
  }
  if (!MACHINA_CLASS_NAME_PATTERN.test(className)) {
    throw new Error(`MachinaStyle class name "${className}" must not contain whitespace.`);
  }
}

function assertValidStateName(stateName: string): void {
  if (stateName.trim().length === 0) {
    throw new Error("MachinaStyle state names must be non-empty.");
  }
  if (!MACHINA_STATE_NAME_PATTERN.test(stateName)) {
    throw new Error(
      `MachinaStyle state name "${stateName}" must match /^[a-zA-Z][a-zA-Z0-9_-]*$/.`,
    );
  }
}

function assertValidResponsiveVariant(
  variant: string,
): asserts variant is MachinaResponsiveVariant {
  if (!(RESPONSIVE_VARIANTS as readonly string[]).includes(variant)) {
    throw new Error(
      `MachinaStyle responsive variant "${variant}" must be one of: desktop, tablet, phone.`,
    );
  }
}

export function isMachinaStyleSlot<T>(value: unknown): value is MachinaStyleSlot<T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return kind === "set" || kind === "inherit" || kind === "unset";
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
    return matchKind(value, {
      set: (slot) => {
        assertSetValue(slot.value);
        return setStyleSlot(slot.value);
      },
      inherit: () => inheritStyleSlot(),
      unset: () => unsetStyleSlot(),
    });
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
  return matchKind(slot, {
    set: (resolvedSlot) => resolvedSlot.value,
    inherit: () => baseValue,
    unset: () => undefined,
  });
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
    assertValidClassName(className);
    classes[className] = style(record);
  }
  const stateful: Record<string, MachinaStatefulStyle> = {};
  for (const [key, statefulStyle] of Object.entries(input.stateful ?? {})) {
    if (key.trim().length === 0) {
      throw new Error("MachinaStyle stateful registry keys must be non-empty.");
    }
    stateful[key] = createStatefulStyle(statefulStyle.className, statefulStyle);
  }
  const responsive: Record<string, MachinaResponsiveStyle> = {};
  for (const [key, responsiveStyle] of Object.entries(input.responsive ?? {})) {
    if (key.trim().length === 0) {
      throw new Error("MachinaStyle responsive registry keys must be non-empty.");
    }
    responsive[key] = createResponsiveStyle(responsiveStyle.className, responsiveStyle);
  }
  return {
    tokens: input.tokens ? tokens(input.tokens) : undefined,
    classes,
    stateful: Object.keys(stateful).length > 0 ? stateful : undefined,
    responsive: Object.keys(responsive).length > 0 ? responsive : undefined,
  };
}

export function createStatefulStyle(
  className: string,
  input: {
    base: MachinaStyleRecord;
    states: Record<MachinaStyleStateName, MachinaStyleLayer>;
    description?: string;
  },
): MachinaStatefulStyle {
  assertValidClassName(className);
  const states: Record<MachinaStyleStateName, MachinaStyleLayer> = {};
  for (const [stateName, stateLayer] of Object.entries(input.states)) {
    assertValidStateName(stateName);
    states[stateName] = layer(stateLayer);
  }
  return {
    className,
    base: style(input.base),
    states,
    description: input.description,
  };
}

export function resolveMachinaStateStyle(
  stateful: MachinaStatefulStyle,
  stateName: string,
): MachinaStyleRecord {
  assertValidStateName(stateName);
  const stateLayer = stateful.states[stateName];
  if (!stateLayer) {
    throw new Error(`Unknown MachinaStyle state "${stateName}" for class "${stateful.className}".`);
  }
  return composeMachinaStyles(stateful.base, stateLayer);
}

export function resolveMachinaStateStyles(
  stateful: MachinaStatefulStyle,
): Record<string, MachinaStyleRecord> {
  const resolved: Record<string, MachinaStyleRecord> = {};
  for (const stateName of Object.keys(stateful.states).sort()) {
    resolved[stateName] = resolveMachinaStateStyle(stateful, stateName);
  }
  return resolved;
}

export function createResponsiveStyle(
  className: string,
  input: {
    base: MachinaStyleRecord;
    variants: Partial<Record<MachinaResponsiveVariant, MachinaStyleLayer>>;
    description?: string;
  },
): MachinaResponsiveStyle {
  assertValidClassName(className);
  const variants: Partial<Record<MachinaResponsiveVariant, MachinaStyleLayer>> = {};
  for (const [variantName, variantLayer] of Object.entries(input.variants)) {
    assertValidResponsiveVariant(variantName);
    variants[variantName] = layer(variantLayer);
  }
  return {
    className,
    base: style(input.base),
    variants,
    description: input.description,
  };
}

export function resolveMachinaResponsiveStyle(
  responsive: MachinaResponsiveStyle,
  variant: MachinaResponsiveVariant,
): MachinaStyleRecord {
  assertValidResponsiveVariant(variant);
  const variantLayer = responsive.variants[variant];
  if (!variantLayer) {
    return style(responsive.base);
  }
  return composeMachinaStyles(responsive.base, variantLayer);
}

export function resolveMachinaResponsiveStyles(
  responsive: MachinaResponsiveStyle,
): Record<MachinaResponsiveVariant, MachinaStyleRecord> {
  return {
    desktop: resolveMachinaResponsiveStyle(responsive, "desktop"),
    tablet: resolveMachinaResponsiveStyle(responsive, "tablet"),
    phone: resolveMachinaResponsiveStyle(responsive, "phone"),
  };
}

export function token(group: MachinaTokenGroup, key: string) {
  return createMachinaTokenReference(group, key);
}

export function createMachinaClassNames<
  TClasses extends Record<string, unknown>,
  TStateful extends Record<string, MachinaStatefulStyle> | undefined = undefined,
  TResponsive extends Record<string, MachinaResponsiveStyle> | undefined = undefined,
>(sheet: {
  classes: TClasses;
  stateful?: TStateful;
  responsive?: TResponsive;
}): {
  readonly [K in
    | keyof TClasses
    | keyof NonNullable<TStateful>
    | keyof NonNullable<TResponsive>]: string;
} {
  const classNames = {} as {
    [K in keyof TClasses | keyof NonNullable<TStateful> | keyof NonNullable<TResponsive>]: string;
  };
  for (const className of Object.keys(sheet.classes)) {
    classNames[
      className as keyof TClasses | keyof NonNullable<TStateful> | keyof NonNullable<TResponsive>
    ] = className;
  }
  for (const key of Object.keys(sheet.stateful ?? {})) {
    if (Object.hasOwn(sheet.classes, key)) {
      throw new Error(`Duplicate MachinaStyle class key "${key}" exists in classes and stateful.`);
    }
    classNames[
      key as keyof TClasses | keyof NonNullable<TStateful> | keyof NonNullable<TResponsive>
    ] = (sheet.stateful as NonNullable<TStateful>)[key].className;
  }
  for (const key of Object.keys(sheet.responsive ?? {})) {
    if (Object.hasOwn(sheet.classes, key)) {
      throw new Error(
        `Duplicate MachinaStyle class key "${key}" exists in classes and responsive.`,
      );
    }
    if (Object.hasOwn(sheet.stateful ?? {}, key)) {
      throw new Error(
        `Duplicate MachinaStyle class key "${key}" exists in stateful and responsive.`,
      );
    }
    classNames[
      key as keyof TClasses | keyof NonNullable<TStateful> | keyof NonNullable<TResponsive>
    ] = (sheet.responsive as NonNullable<TResponsive>)[key].className;
  }
  return Object.freeze(classNames);
}

export function classes<
  TClasses extends Record<string, unknown>,
  TStateful extends Record<string, MachinaStatefulStyle> | undefined = undefined,
  TResponsive extends Record<string, MachinaResponsiveStyle> | undefined = undefined,
>(sheet: {
  classes: TClasses;
  stateful?: TStateful;
  responsive?: TResponsive;
}): {
  readonly [K in
    | keyof TClasses
    | keyof NonNullable<TStateful>
    | keyof NonNullable<TResponsive>]: string;
} {
  return createMachinaClassNames(sheet);
}

export function dataState(...states: readonly string[]): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const stateName of states) {
    assertValidStateName(stateName);
    if (seen.has(stateName)) {
      continue;
    }
    seen.add(stateName);
    ordered.push(stateName);
  }
  return ordered.join(" ");
}

export const S = {
  tokens,
  token,
  style,
  stateful: createStatefulStyle,
  responsive: createResponsiveStyle,
  set: setStyleSlot,
  inherit: inheritStyleSlot,
  unset: unsetStyleSlot,
  layer,
  over: overMachinaStyle,
  compose: composeMachinaStyles,
  resolveState: resolveMachinaStateStyle,
  resolveStates: resolveMachinaStateStyles,
  resolveResponsive: resolveMachinaResponsiveStyle,
  resolveResponsiveVariants: resolveMachinaResponsiveStyles,
  with: withStyle,
  merge: withStyle,
  sheet,
  classes,
  dataState,
} as const;
