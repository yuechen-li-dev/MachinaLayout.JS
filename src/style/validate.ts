import { isMachinaStyleSlot } from "./authoring";
import {
  describeMachinaTokenReference,
  isMachinaTokenGroup,
  looksLikeMachinaTokenReference,
  parseMachinaTokenReference,
  tokenExists,
} from "./tokens";
import type {
  MachinaStatefulStyle,
  MachinaStyleDiagnostic,
  MachinaStyleLayer,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleTokens,
} from "./types";

const MACHINA_STATE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

function pushError(
  diagnostics: MachinaStyleDiagnostic[],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ severity: "error", code, message, path });
}

function checkNonNegativeNumber(
  diagnostics: MachinaStyleDiagnostic[],
  code: string,
  value: unknown,
  path: string,
): void {
  if (typeof value === "number" && value < 0) {
    pushError(diagnostics, code, `Expected non-negative number at ${path}.`, path);
  }
}

function hasOwnValue(value: object, key: string): boolean {
  return Object.hasOwn(value, key);
}

function checkUnresolvedStyleSlot(
  diagnostics: MachinaStyleDiagnostic[],
  value: unknown,
  path: string,
): boolean {
  if (!isMachinaStyleSlot(value)) {
    return false;
  }
  pushError(
    diagnostics,
    "UnresolvedStyleSlot",
    `Unresolved MachinaStyleSlot at ${path}. Call S.compose/S.over first.`,
    path,
  );
  return true;
}

function checkTokenReferenceShape(
  diagnostics: MachinaStyleDiagnostic[],
  value: unknown,
  path: string,
): void {
  if (!looksLikeMachinaTokenReference(value)) {
    return;
  }

  if (!isMachinaTokenGroup(value.group)) {
    pushError(
      diagnostics,
      "InvalidTokenReference",
      `MachinaStyle token reference at ${path} must use a known group; received "${String(value.group)}".`,
      path,
    );
  }

  if (typeof value.key !== "string" || value.key.trim().length === 0) {
    pushError(
      diagnostics,
      "InvalidTokenReference",
      `MachinaStyle token reference at ${path} must include a non-empty key.`,
      path,
    );
  }
}

function checkTokenRef(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  value: unknown,
  path: string,
): void {
  checkTokenReferenceShape(diagnostics, value, path);

  const parsed = parseMachinaTokenReference(value);
  if (!parsed) {
    return;
  }

  if (!isMachinaTokenGroup(parsed.group) || parsed.key.trim().length === 0) {
    return;
  }

  if (!tokenExists(tokens, value)) {
    pushError(
      diagnostics,
      "UnknownTokenReference",
      `Unknown MachinaStyle token reference ${describeMachinaTokenReference(value)} at ${path} (group: "${parsed.group}", key: "${parsed.key}").`,
      path,
    );
  }
}

function checkFontTokenRef(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  value: unknown,
  path: string,
): void {
  const parsed = parseMachinaTokenReference(value);
  if (!parsed) {
    return;
  }

  if (!isMachinaTokenGroup(parsed.group) || parsed.key.trim().length === 0) {
    return;
  }

  if (parsed.group !== "font") {
    pushError(
      diagnostics,
      "InvalidFontTokenReference",
      `MachinaStyle text.font at ${path} must reference a font token; received group "${parsed.group}" with key "${parsed.key}".`,
      path,
    );
    return;
  }

  if (!tokenExists(tokens, value)) {
    pushError(
      diagnostics,
      "UnknownTokenReference",
      `Unknown MachinaStyle token reference ${describeMachinaTokenReference(value)} at ${path} (group: "${parsed.group}", key: "${parsed.key}").`,
      path,
    );
  }
}

function checkStyleValue(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  value: unknown,
  path: string,
): void {
  if (!checkUnresolvedStyleSlot(diagnostics, value, path)) {
    checkTokenRef(diagnostics, tokens, value, path);
  }
}

function validateTokens(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
): void {
  if (!tokens) {
    return;
  }
  for (const [key, value] of Object.entries(tokens.space ?? {})) {
    checkNonNegativeNumber(diagnostics, "NegativeSpaceToken", value, `tokens.space.${key}`);
  }
  for (const [key, value] of Object.entries(tokens.radius ?? {})) {
    checkNonNegativeNumber(diagnostics, "NegativeRadiusToken", value, `tokens.radius.${key}`);
  }
}

function validateStyleRecord(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  record: MachinaStyleRecord,
  path: string,
): void {
  if (
    record.surface?.opacity !== undefined &&
    (record.surface.opacity < 0 || record.surface.opacity > 1)
  ) {
    pushError(
      diagnostics,
      "InvalidOpacity",
      "MachinaStyle surface opacity must be between 0 and 1.",
      `${path}.surface.opacity`,
    );
  }
  checkNonNegativeNumber(
    diagnostics,
    "NegativeRadius",
    record.surface?.radius,
    `${path}.surface.radius`,
  );
  checkNonNegativeNumber(
    diagnostics,
    "NegativeBorderWidth",
    record.border?.width,
    `${path}.border.width`,
  );

  for (const [groupName, groupValue] of Object.entries(record)) {
    if (!groupValue || typeof groupValue !== "object") {
      continue;
    }
    for (const [propertyName, value] of Object.entries(groupValue)) {
      if (groupName === "text" && propertyName === "font") {
        continue;
      }
      checkStyleValue(diagnostics, tokens, value, `${path}.${groupName}.${propertyName}`);
    }
  }

  if (record.text?.font !== undefined) {
    checkFontTokenRef(diagnostics, tokens, record.text.font, `${path}.text.font`);
  }
}

function validateClassName(
  diagnostics: MachinaStyleDiagnostic[],
  className: string,
  path: string,
): void {
  if (className.trim().length === 0) {
    pushError(diagnostics, "EmptyClassName", "MachinaStyle class names must be non-empty.", path);
    return;
  }
  if (/\s/.test(className)) {
    pushError(
      diagnostics,
      "InvalidClassName",
      `MachinaStyle class name "${className}" must not contain whitespace.`,
      path,
    );
  }
}

function validateStateName(
  diagnostics: MachinaStyleDiagnostic[],
  stateName: string,
  path: string,
): void {
  if (stateName.trim().length === 0 || !MACHINA_STATE_NAME_PATTERN.test(stateName)) {
    pushError(
      diagnostics,
      "InvalidStateName",
      `MachinaStyle state name "${stateName}" must match /^[a-zA-Z][a-zA-Z0-9_-]*$/.`,
      path,
    );
  }
}

function validateLayerSlot(
  diagnostics: MachinaStyleDiagnostic[],
  value: unknown,
  path: string,
  options: {
    allowUnset?: boolean;
  } = {},
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  if (looksLikeMachinaTokenReference(value)) {
    checkTokenReferenceShape(diagnostics, value, path);
    return value;
  }

  if (!hasOwnValue(value, "kind")) {
    return value;
  }

  const slot = value as { kind?: unknown; value?: unknown };
  if (slot.kind !== "set" && slot.kind !== "inherit" && slot.kind !== "unset") {
    pushError(diagnostics, "InvalidStyleSlot", `Invalid MachinaStyleSlot kind at ${path}.`, path);
    return undefined;
  }

  if (slot.kind === "unset" && options.allowUnset === false) {
    pushError(
      diagnostics,
      "UnsupportedStateUnset",
      `MachinaStyle state layers do not support S.unset at ${path} because CSS data-state selectors cannot remove base declarations safely yet.`,
      path,
    );
  }

  if (slot.kind === "set") {
    if (
      !hasOwnValue(slot, "value") ||
      slot.value === undefined ||
      (typeof slot.value === "object" && !slot.value)
    ) {
      pushError(
        diagnostics,
        "InvalidStyleSlot",
        `MachinaStyle set slot at ${path} must include a value.`,
        path,
      );
      return undefined;
    }
    checkTokenReferenceShape(diagnostics, slot.value, path);
    return slot.value;
  }

  if (hasOwnValue(slot, "value")) {
    pushError(
      diagnostics,
      "InvalidStyleSlot",
      `MachinaStyle ${slot.kind} slot at ${path} must not include a value.`,
      path,
    );
  }
  return undefined;
}

function validateLayerNumber(
  diagnostics: MachinaStyleDiagnostic[],
  code: string,
  value: unknown,
  path: string,
  options: {
    allowUnset?: boolean;
  } = {},
): void {
  const unwrapped = validateLayerSlot(diagnostics, value, path, options);
  checkNonNegativeNumber(diagnostics, code, unwrapped, path);
}

export function validateMachinaStyleLayer(layer: MachinaStyleLayer): MachinaStyleDiagnostic[] {
  return validateMachinaStyleLayerInternal(layer, {
    allowUnset: true,
    pathPrefix: "layer",
  });
}

function validateMachinaStyleLayerInternal(
  layer: MachinaStyleLayer,
  options: {
    allowUnset: boolean;
    pathPrefix: string;
  },
): MachinaStyleDiagnostic[] {
  const diagnostics: MachinaStyleDiagnostic[] = [];
  const { allowUnset, pathPrefix } = options;

  const opacity = validateLayerSlot(
    diagnostics,
    layer.surface?.opacity,
    `${pathPrefix}.surface.opacity`,
    { allowUnset },
  );
  if (typeof opacity === "number" && (opacity < 0 || opacity > 1)) {
    pushError(
      diagnostics,
      "InvalidOpacity",
      "MachinaStyle surface opacity must be between 0 and 1.",
      `${pathPrefix}.surface.opacity`,
    );
  }

  validateLayerNumber(
    diagnostics,
    "NegativeRadius",
    layer.surface?.radius,
    `${pathPrefix}.surface.radius`,
    { allowUnset },
  );
  validateLayerNumber(
    diagnostics,
    "NegativeBorderWidth",
    layer.border?.width,
    `${pathPrefix}.border.width`,
    { allowUnset },
  );

  for (const [groupName, groupValue] of Object.entries(layer)) {
    if (!groupValue || typeof groupValue !== "object") {
      continue;
    }
    for (const [propertyName, value] of Object.entries(groupValue)) {
      validateLayerSlot(diagnostics, value, `${pathPrefix}.${groupName}.${propertyName}`, {
        allowUnset,
      });
    }
  }

  return diagnostics;
}

function validateStatefulStyle(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  key: string,
  stateful: MachinaStatefulStyle,
): void {
  if (key.trim().length === 0) {
    pushError(
      diagnostics,
      "InvalidStatefulStyle",
      "MachinaStyle stateful registry keys must be non-empty.",
      "stateful",
    );
  }
  validateClassName(diagnostics, stateful.className, `stateful.${key}.className`);
  validateStyleRecord(diagnostics, tokens, stateful.base, `stateful.${key}.base`);

  for (const [stateName, layer] of Object.entries(stateful.states)) {
    validateStateName(diagnostics, stateName, `stateful.${key}.states.${stateName}`);
    diagnostics.push(
      ...validateMachinaStyleLayerInternal(layer, {
        allowUnset: false,
        pathPrefix: `stateful.${key}.states.${stateName}`,
      }),
    );

    for (const [groupName, groupValue] of Object.entries(layer)) {
      if (!groupValue || typeof groupValue !== "object") {
        continue;
      }
      for (const [propertyName, rawValue] of Object.entries(groupValue)) {
        const value =
          isMachinaStyleSlot(rawValue) && rawValue.kind === "set" ? rawValue.value : rawValue;
        if (groupName === "text" && propertyName === "font") {
          checkFontTokenRef(
            diagnostics,
            tokens,
            value,
            `stateful.${key}.states.${stateName}.${groupName}.${propertyName}`,
          );
          continue;
        }
        if (!isMachinaStyleSlot(rawValue) || rawValue.kind === "set") {
          checkTokenRef(
            diagnostics,
            tokens,
            value,
            `stateful.${key}.states.${stateName}.${groupName}.${propertyName}`,
          );
        }
      }
    }
  }
}

export function validateMachinaStyleSheet(sheet: MachinaStyleSheet): MachinaStyleDiagnostic[] {
  const diagnostics: MachinaStyleDiagnostic[] = [];
  validateTokens(diagnostics, sheet.tokens);

  for (const [className, record] of Object.entries(sheet.classes)) {
    validateClassName(diagnostics, className, `classes.${className}`);
    validateStyleRecord(diagnostics, sheet.tokens, record, `classes.${className}`);
  }

  for (const key of Object.keys(sheet.stateful ?? {})) {
    if (Object.hasOwn(sheet.classes, key)) {
      pushError(
        diagnostics,
        "DuplicateClassKey",
        `MachinaStyle class key "${key}" exists in both classes and stateful.`,
        `stateful.${key}`,
      );
    }
    validateStatefulStyle(diagnostics, sheet.tokens, key, sheet.stateful![key]);
  }

  return diagnostics;
}

export function formatMachinaStyleDiagnostics(
  diagnostics: readonly MachinaStyleDiagnostic[],
): string {
  return diagnostics
    .map((diagnostic) => {
      const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
      return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
    .join("\n");
}
