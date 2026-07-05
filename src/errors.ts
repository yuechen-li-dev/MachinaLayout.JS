export type MachinaLayoutErrorCode =
  | "EmptyRows"
  | "MissingRoot"
  | "MultipleRoots"
  | "DuplicateId"
  | "InvalidId"
  | "MissingParent"
  | "UnknownParent"
  | "SelfParent"
  | "Cycle"
  | "UnreachableNode"
  | "NonFiniteNumber"
  | "InvalidLengthUnit"
  | "InvalidZ"
  | "InvalidVariantCondition"
  | "NegativeSize"
  | "NegativeGap"
  | "NegativePadding"
  | "InvalidAnchorHorizontal"
  | "InvalidAnchorVertical"
  | "NegativeResolvedSize"
  | "FixedFrameWithoutArranger"
  | "FillFrameWithoutArranger"
  | "InvalidFillWeight"
  | "StackChildMustBeFixed"
  | "StackContentNegative"
  | "StackOverflow"
  | "ExpectedStackArrange"
  | "StackQueryInvalidRange"
  | "CellFrameWithoutGrid"
  | "GridChildMustBeCell"
  | "InvalidGridTrack"
  | "InvalidGridCell"
  | "GridContentNegative"
  | "GridOverflow"
  | "RootFrameNotRoot"
  | "RootFrameWithoutRoot"
  | "IncompatibleLayouts"
  | "GuideTargetNotFound"
  | "GuideSelfReference"
  | "GuideReferenceCycle"
  | "GuideInvalidEdgeForAxis"
  | "GuideTooManyReferencesPerAxis"
  | "InvalidGuideFrame"
  | "GuideTargetUnresolved"
  | "InvalidViewport"
  | "DuplicateViewportKey"
  | "UnknownViewportKey"
  | "InvalidScreen"
  | "DuplicateScreenKey"
  | "UnknownScreenKey";

export class MachinaLayoutError extends Error {
  readonly code: MachinaLayoutErrorCode;

  constructor(code: MachinaLayoutErrorCode, message: string) {
    super(message);
    this.name = "MachinaLayoutError";
    this.code = code;
  }
}

export type MachinaErrorDiagnostic = {
  code: string;
  name: string;
  message: string;
  details?: readonly string[];
  cause?: string;
  stack?: string;
};

type ErrorLikeRecord = Record<string, unknown>;

const DIAGNOSTIC_RESERVED_KEYS = new Set([
  "cause",
  "code",
  "details",
  "diagnostics",
  "message",
  "name",
  "stack",
]);

function isObjectRecord(value: unknown): value is ErrorLikeRecord {
  return typeof value === "object" && value !== null;
}

function safeToString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "[unstringifiable]";
  }
}

function safeJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return serialized ?? safeToString(value);
  } catch {
    return safeToString(value);
  }
}

function serializeDiagnosticValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return safeToString(value);
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  return safeJson(value);
}

function getStringProp(record: ErrorLikeRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function collectDiagnosticDetails(record: ErrorLikeRecord): readonly string[] | undefined {
  const details: string[] = [];
  const detailValue = record.details;
  if (Array.isArray(detailValue)) {
    for (const item of detailValue) {
      details.push(serializeDiagnosticValue(item));
    }
  } else if (detailValue !== undefined) {
    details.push(serializeDiagnosticValue(detailValue));
  }

  const diagnosticsValue = record.diagnostics;
  if (Array.isArray(diagnosticsValue)) {
    for (const item of diagnosticsValue) {
      details.push(serializeDiagnosticValue(item));
    }
  } else if (diagnosticsValue !== undefined) {
    details.push(serializeDiagnosticValue(diagnosticsValue));
  }

  for (const [key, value] of Object.entries(record)) {
    if (DIAGNOSTIC_RESERVED_KEYS.has(key) || value === undefined) continue;
    details.push(`${key}: ${serializeDiagnosticValue(value)}`);
  }

  return details.length > 0 ? details : undefined;
}

export function normalizeMachinaError(error: unknown): MachinaErrorDiagnostic {
  try {
    if (error instanceof Error) {
      const record = error as unknown as ErrorLikeRecord;
      const code =
        getStringProp(record, "code") ??
        (error.name.startsWith("Machina") ? error.name : "RuntimeError");
      const causeValue = record.cause;
      return {
        code,
        name: error.name || "Error",
        message: error.message || "Unknown error.",
        details: collectDiagnosticDetails(record),
        cause: causeValue === undefined ? undefined : serializeDiagnosticValue(causeValue),
        stack: typeof error.stack === "string" ? error.stack : undefined,
      };
    }

    if (isObjectRecord(error)) {
      const code = getStringProp(error, "code") ?? "RuntimeError";
      const name = getStringProp(error, "name") ?? "RuntimeError";
      const message =
        getStringProp(error, "message") ?? safeJson(error) ?? "Unknown runtime error.";
      const stack = getStringProp(error, "stack");
      const causeValue = error.cause;
      return {
        code,
        name,
        message,
        details: collectDiagnosticDetails(error),
        cause: causeValue === undefined ? undefined : serializeDiagnosticValue(causeValue),
        stack,
      };
    }

    return {
      code: "NonErrorThrow",
      name: "NonErrorThrow",
      message: safeToString(error),
    };
  } catch (normalizationFailure) {
    return {
      code: "ErrorNormalizationFailure",
      name: "ErrorNormalizationFailure",
      message: `Failed to normalize thrown value: ${safeToString(normalizationFailure)}`,
    };
  }
}
