import type {
  MachinaStyleLayer,
  MachinaStyleDiagnostic,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleTokens,
} from "./types";
import { isMachinaStyleSlot } from "./authoring";

const TOKEN_GROUPS = ["color", "space", "radius", "font", "shadow"] as const;
type TokenGroup = (typeof TOKEN_GROUPS)[number];

function pushError(
  diagnostics: MachinaStyleDiagnostic[],
  code: string,
  message: string,
  path?: string,
): void {
  diagnostics.push({ severity: "error", code, message, path });
}

function isTokenRef(value: unknown): value is string {
  return typeof value === "string" && TOKEN_GROUPS.some((group) => value.startsWith(`${group}.`));
}

function tokenExists(tokens: MachinaStyleTokens | undefined, ref: string): boolean {
  const [group, ...keyParts] = ref.split(".");
  if (!TOKEN_GROUPS.includes(group as TokenGroup)) {
    return false;
  }
  const key = keyParts.join(".");
  const groupTokens = tokens?.[group as TokenGroup] as Record<string, unknown> | undefined;
  return !!groupTokens && Object.hasOwn(groupTokens, key);
}

function checkTokenRef(
  diagnostics: MachinaStyleDiagnostic[],
  tokens: MachinaStyleTokens | undefined,
  value: unknown,
  path: string,
): void {
  if (isTokenRef(value) && !tokenExists(tokens, value)) {
    pushError(
      diagnostics,
      "UnknownTokenRef",
      `Unknown MachinaStyle token reference "${value}".`,
      path,
    );
  }
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
      checkStyleValue(diagnostics, tokens, value, `${path}.${groupName}.${propertyName}`);
    }
  }
}

function validateLayerSlot(
  diagnostics: MachinaStyleDiagnostic[],
  value: unknown,
  path: string,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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
): void {
  const unwrapped = validateLayerSlot(diagnostics, value, path);
  checkNonNegativeNumber(diagnostics, code, unwrapped, path);
}

export function validateMachinaStyleLayer(layer: MachinaStyleLayer): MachinaStyleDiagnostic[] {
  const diagnostics: MachinaStyleDiagnostic[] = [];

  const opacity = validateLayerSlot(diagnostics, layer.surface?.opacity, "layer.surface.opacity");
  if (typeof opacity === "number" && (opacity < 0 || opacity > 1)) {
    pushError(
      diagnostics,
      "InvalidOpacity",
      "MachinaStyle surface opacity must be between 0 and 1.",
      "layer.surface.opacity",
    );
  }

  validateLayerNumber(diagnostics, "NegativeRadius", layer.surface?.radius, "layer.surface.radius");
  validateLayerNumber(
    diagnostics,
    "NegativeBorderWidth",
    layer.border?.width,
    "layer.border.width",
  );

  for (const [groupName, groupValue] of Object.entries(layer)) {
    if (!groupValue || typeof groupValue !== "object") {
      continue;
    }
    for (const [propertyName, value] of Object.entries(groupValue)) {
      validateLayerSlot(diagnostics, value, `layer.${groupName}.${propertyName}`);
    }
  }

  return diagnostics;
}

export function validateMachinaStyleSheet(sheet: MachinaStyleSheet): MachinaStyleDiagnostic[] {
  const diagnostics: MachinaStyleDiagnostic[] = [];
  validateTokens(diagnostics, sheet.tokens);

  for (const [className, record] of Object.entries(sheet.classes)) {
    if (className.trim().length === 0) {
      pushError(
        diagnostics,
        "EmptyClassName",
        "MachinaStyle class names must be non-empty.",
        "classes",
      );
      continue;
    }
    if (/\s/.test(className)) {
      pushError(
        diagnostics,
        "InvalidClassName",
        `MachinaStyle class name "${className}" must not contain whitespace.`,
        `classes.${className}`,
      );
    }
    validateStyleRecord(diagnostics, sheet.tokens, record, `classes.${className}`);
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
