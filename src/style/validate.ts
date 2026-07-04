import type {
  MachinaStyleDiagnostic,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleTokens,
} from "./types";

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
      checkTokenRef(diagnostics, tokens, value, `${path}.${groupName}.${propertyName}`);
    }
  }
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
