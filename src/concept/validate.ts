import { format as formatDiagnostics } from "../diagnostics/format";
import type { DiagnosticFix } from "../diagnostics/types";
import type { Infer } from "./infer";
import {
  closestName,
  constraintsEquivalent,
  describeConstraintType,
  isConceptDefinition,
  isOptional,
  normalizeConstraint,
} from "./structure";
import {
  type ConceptDefinition,
  type ConceptDiagnostic,
  ConceptError,
  type ConceptFieldConstraint,
} from "./types";

const CONSTRAINT_KINDS = new Set([
  "string",
  "number",
  "boolean",
  "unknown",
  "function",
  "object",
  "array",
  "literal",
  "enum",
  "union",
  "custom",
  "concept",
]);

type Out = ConceptDiagnostic[];

function joinPath(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

function isSafeFieldName(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(name);
}

function isSupportedLiteralValue(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Compact description of a received value for diagnostics. */
export function describeReceived(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number") {
    return Number.isNaN(value) ? "NaN" : String(value);
  }
  if (typeof value === "string") {
    return value.length > 24 ? `${JSON.stringify(value.slice(0, 24))}…` : JSON.stringify(value);
  }
  if (typeof value === "boolean") return String(value);
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === "object") {
    const keys = Object.keys(value);
    const shown = keys.slice(0, 4).join(", ");
    return `{${shown}${keys.length > 4 ? ", …" : ""}}`;
  }
  return typeof value;
}

// ---------------------------------------------------------------------------
// Definition validation
// ---------------------------------------------------------------------------

function pushDefinition(out: Out, code: string, message: string, path?: string): void {
  out.push({ severity: "error", code, message, path });
}

function validateConstraintDefinition(
  constraint: ConceptFieldConstraint,
  path: string,
  out: Out,
  visited: Set<ConceptDefinition>,
): void {
  if (
    typeof constraint !== "object" ||
    constraint === null ||
    !CONSTRAINT_KINDS.has(constraint.kind)
  ) {
    pushDefinition(
      out,
      "InvalidConceptConstraint",
      `Constraint kind '${String((constraint as { kind?: unknown } | null)?.kind)}' is not supported.`,
      path,
    );
    return;
  }
  if (isConceptDefinition(constraint)) {
    validateConceptDefinitionInner(constraint, out, visited);
    return;
  }
  switch (constraint.kind) {
    case "literal":
      if (!isSupportedLiteralValue(constraint.value)) {
        pushDefinition(
          out,
          "InvalidConceptConstraint",
          "Literal constraints must use string, number, or boolean values.",
          path,
        );
      }
      return;
    case "enum":
      if (!Array.isArray(constraint.values) || constraint.values.length === 0) {
        pushDefinition(out, "InvalidConceptConstraint", "Enum needs at least one value.", path);
      }
      return;
    case "union":
      if (!Array.isArray(constraint.options) || constraint.options.length === 0) {
        pushDefinition(out, "InvalidConceptConstraint", "Union needs at least one option.", path);
        return;
      }
      constraint.options.forEach((option, index) => {
        validateConstraintDefinition(option, `${path}|${index}`, out, visited);
      });
      return;
    case "number":
      if (
        constraint.min !== undefined &&
        constraint.max !== undefined &&
        constraint.min > constraint.max
      ) {
        pushDefinition(out, "InvalidConceptConstraint", "Number min is greater than max.", path);
      }
      return;
    case "custom":
      if (typeof constraint.check !== "function" || !constraint.name) {
        pushDefinition(
          out,
          "InvalidConceptConstraint",
          "Custom constraints need a name and a check function.",
          path,
        );
      }
      return;
    case "object":
      if (constraint.shape) {
        validateConceptDefinitionInner(constraint.shape, out, visited);
      }
      return;
    case "array":
      if (constraint.element) {
        validateConstraintDefinition(constraint.element, `${path}[]`, out, visited);
      }
      return;
    default:
      return;
  }
}

function validateConceptDefinitionInner(
  concept: ConceptDefinition,
  out: Out,
  visited: Set<ConceptDefinition>,
): void {
  if (visited.has(concept)) {
    pushDefinition(
      out,
      "InvalidConceptConstraint",
      `Recursive concept composition is not supported for '${concept.id}'.`,
      "composedFrom",
    );
    return;
  }
  visited.add(concept);

  if (typeof concept.id !== "string" || concept.id.trim().length === 0) {
    pushDefinition(out, "InvalidConceptId", "Concept id must be a non-empty string.", "id");
  }

  if (
    typeof concept.fields !== "object" ||
    concept.fields === null ||
    Array.isArray(concept.fields)
  ) {
    pushDefinition(
      out,
      "InvalidConceptConstraint",
      "Concept fields must be a record of field constraints.",
      "fields",
    );
  } else {
    for (const [fieldName, constraint] of Object.entries(concept.fields)) {
      if (fieldName.trim().length === 0 || !isSafeFieldName(fieldName)) {
        pushDefinition(
          out,
          "InvalidConceptField",
          `Concept field '${fieldName}' is empty or not safe-ish.`,
          `fields.${fieldName}`,
        );
      }
      validateConstraintDefinition(constraint, `fields.${fieldName}`, out, visited);
    }
  }

  const seen = new Map<string, { constraint: ConceptFieldConstraint; source: string }>();
  for (const source of concept.composedFrom ?? []) {
    validateConceptDefinitionInner(source, out, visited);
    for (const [fieldName, constraint] of Object.entries(source.fields)) {
      const previous = seen.get(fieldName);
      if (previous && !constraintsEquivalent(previous.constraint, constraint, acceptsValue)) {
        pushDefinition(
          out,
          "ConflictingConceptField",
          `Field '${fieldName}' conflicts between composed concepts '${previous.source}' and '${source.id}' (${describeConstraintType(previous.constraint)} vs ${describeConstraintType(constraint)}).`,
          `fields.${fieldName}`,
        );
      } else if (!previous) {
        seen.set(fieldName, { constraint, source: source.id });
      }
    }
  }

  visited.delete(concept);
}

const definitionCache = new WeakMap<ConceptDefinition, readonly ConceptDiagnostic[]>();

export function validateConceptDefinition(concept: ConceptDefinition): ConceptDiagnostic[] {
  const cached = definitionCache.get(concept);
  if (cached) {
    return [...cached];
  }
  const out: Out = [];
  validateConceptDefinitionInner(concept, out, new Set<ConceptDefinition>());
  if (typeof concept === "object" && concept !== null) {
    definitionCache.set(concept, out);
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Value validation
// ---------------------------------------------------------------------------

function error(
  out: Out,
  code: string,
  path: string,
  message: string,
  extra: {
    readonly concept?: string;
    readonly expected?: string;
    readonly received?: string;
    readonly fix?: DiagnosticFix;
  } = {},
): void {
  out.push({ severity: "error", code, message, path, ...extra });
}

function checkConcept(concept: ConceptDefinition, value: unknown, path: string, out: Out): void {
  const record =
    isObjectValue(value) || typeof value === "function"
      ? (value as Record<string, unknown>)
      : undefined;

  if (!record) {
    error(
      out,
      value === undefined || value === null ? "MissingConceptValue" : "InvalidConceptFieldType",
      path,
      `expected ${concept.id} (object), received ${describeReceived(value)}`,
      { concept: concept.id, expected: concept.id, received: describeReceived(value) },
    );
    return;
  }

  const fieldNames = Object.keys(concept.fields);
  const unknownKeys = Object.keys(record).filter((key) => !(key in concept.fields));
  const consumed = new Set<string>();

  for (const fieldName of fieldNames) {
    const constraint = concept.fields[fieldName];
    const origin = concept.fieldOrigins?.[fieldName] ?? concept.id;
    const fieldPath = joinPath(path, fieldName);
    const fieldValue = record[fieldName];

    if (fieldValue === undefined) {
      const near = closestName(
        fieldName,
        unknownKeys.filter((key) => !consumed.has(key)),
      );
      if (isOptional(constraint)) {
        // Closed concepts report the key below as UnknownConceptField (with the
        // same suggestion); open concepts get a warning so the typo isn't silent.
        if (near !== undefined && !concept.closed) {
          consumed.add(near);
          out.push({
            severity: "warning",
            code: "SuspiciousConceptField",
            message: `unknown key '${near}' looks like optional field '${fieldName}'`,
            path: joinPath(path, near),
            concept: origin,
            fix: { op: "rename", path: joinPath(path, near), to: fieldName },
          });
        }
        continue;
      }
      if (near !== undefined) {
        consumed.add(near);
      }
      const type = describeConstraintType(constraint);
      const fromText = origin !== concept.id ? `, from ${origin}` : "";
      if (near !== undefined) {
        error(
          out,
          "MissingConceptField",
          fieldPath,
          `missing required ${type}${fromText}; found '${near}' — did you mean '${fieldName}'?`,
          {
            concept: origin,
            expected: type,
            fix: { op: "rename", path: joinPath(path, near), to: fieldName },
          },
        );
      } else {
        error(out, "MissingConceptField", fieldPath, `missing required ${type}${fromText}`, {
          concept: origin,
          expected: type,
          fix: { op: "add", path: fieldPath, expected: type },
        });
      }
      continue;
    }

    checkConstraint(constraint, fieldValue, fieldPath, origin, out);
  }

  if (concept.closed) {
    for (const key of unknownKeys) {
      if (consumed.has(key)) {
        continue;
      }
      const keyPath = joinPath(path, key);
      const near = closestName(key, fieldNames);
      error(
        out,
        "UnknownConceptField",
        keyPath,
        near !== undefined
          ? `unknown key on closed ${concept.id}; did you mean '${near}'?`
          : `unknown key on closed ${concept.id} (allowed: ${fieldNames.join(", ")})`,
        {
          concept: concept.id,
          received: describeReceived(record[key]),
          fix:
            near !== undefined
              ? { op: "rename", path: keyPath, to: near }
              : { op: "remove", path: keyPath },
        },
      );
    }
  }
}

function typeMismatch(
  out: Out,
  constraint: ConceptFieldConstraint,
  value: unknown,
  path: string,
  origin: string | undefined,
): void {
  const expected = describeConstraintType(constraint);
  const received = describeReceived(value);
  error(out, "InvalidConceptFieldType", path, `expected ${expected}, received ${received}`, {
    concept: origin,
    expected,
    received,
    fix: { op: "replace", path, expected },
  });
}

function literalFields(concept: ConceptDefinition): [string, unknown][] {
  return Object.entries(concept.fields).flatMap(([name, constraint]) =>
    !isConceptDefinition(constraint) && constraint.kind === "literal" && !constraint.optional
      ? [[name, constraint.value] as [string, unknown]]
      : [],
  );
}

function checkUnion(
  options: readonly ConceptFieldConstraint[],
  value: unknown,
  path: string,
  origin: string | undefined,
  out: Out,
  unionText: string,
): void {
  const trials = options.map((option) => {
    const trial: Out = [];
    checkConstraint(option, value, path, origin, trial);
    return trial;
  });
  const passing = trials.find((trial) => !trial.some((d) => d.severity === "error"));
  if (passing) {
    out.push(...passing); // keep warnings from the matching branch
    return;
  }

  if (isObjectValue(value)) {
    // Discriminated routing: report the one branch whose literal fields all match.
    const shaped = options
      .map((option, index) => ({ shape: normalizeConstraint(option), index }))
      .flatMap(({ shape, index }) =>
        shape.kind === "object" && shape.shape
          ? [{ concept: shape.shape, index, literals: literalFields(shape.shape) }]
          : [],
      );
    const matching = shaped.filter(
      (entry) =>
        entry.literals.length > 0 &&
        entry.literals.every(([name, literal]) => value[name] === literal),
    );
    if (matching.length === 1) {
      out.push(...trials[matching[0].index]);
      return;
    }

    // Shared discriminant key present but with an unknown value.
    const discriminants = new Map<string, unknown[]>();
    for (const entry of shaped) {
      for (const [name, literal] of entry.literals) {
        discriminants.set(name, [...(discriminants.get(name) ?? []), literal]);
      }
    }
    for (const [name, literals] of discriminants) {
      if (literals.length === shaped.length && shaped.length > 1 && name in value) {
        const received = value[name];
        const allowed = literals.map((literal) => JSON.stringify(literal)).join(" | ");
        const near =
          typeof received === "string"
            ? closestName(
                received,
                literals.filter((literal): literal is string => typeof literal === "string"),
              )
            : undefined;
        const discriminantPath = joinPath(path, name);
        error(
          out,
          "InvalidConceptDiscriminant",
          discriminantPath,
          `${describeReceived(received)} is not one of ${allowed}${near !== undefined ? `; did you mean ${JSON.stringify(near)}?` : ""}`,
          {
            concept: origin,
            expected: allowed,
            received: describeReceived(received),
            fix:
              near !== undefined
                ? { op: "replace", path: discriminantPath, expected: JSON.stringify(near) }
                : { op: "replace", path: discriminantPath, expected: allowed },
          },
        );
        return;
      }
    }
  }

  const received = describeReceived(value);
  error(out, "NoMatchingUnionBranch", path, `expected ${unionText}, received ${received}`, {
    concept: origin,
    expected: unionText,
    received,
    fix: { op: "replace", path, expected: unionText },
  });
}

function checkConstraint(
  input: ConceptFieldConstraint,
  value: unknown,
  path: string,
  origin: string | undefined,
  out: Out,
): void {
  if (isConceptDefinition(input)) {
    checkConcept(input, value, path, out);
    return;
  }
  const constraint = input;
  switch (constraint.kind) {
    case "string":
      if (typeof value !== "string") {
        typeMismatch(out, constraint, value, path, origin);
      } else if (constraint.nonEmpty && value.length === 0) {
        error(out, "InvalidConceptString", path, "expected a non-empty string", {
          concept: origin,
          expected: describeConstraintType(constraint),
          received: '""',
        });
      }
      return;
    case "number": {
      if (typeof value !== "number") {
        typeMismatch(out, constraint, value, path, origin);
        return;
      }
      const expected = describeConstraintType(constraint);
      const problem = Number.isNaN(value)
        ? constraint.allowNaN
          ? undefined
          : "NaN is not allowed"
        : constraint.finite && !Number.isFinite(value)
          ? `${value} is not finite`
          : constraint.int && !Number.isInteger(value)
            ? `${value} is not an integer`
            : constraint.min !== undefined && value < constraint.min
              ? `${value} is below min ${constraint.min}`
              : constraint.max !== undefined && value > constraint.max
                ? `${value} is above max ${constraint.max}`
                : undefined;
      if (problem !== undefined) {
        error(out, "InvalidConceptNumber", path, problem, {
          concept: origin,
          expected,
          received: describeReceived(value),
          fix: { op: "replace", path, expected },
        });
      }
      return;
    }
    case "unknown":
      return;
    case "boolean":
    case "function":
      if (typeof value !== constraint.kind) {
        typeMismatch(out, constraint, value, path, origin);
      }
      return;
    case "object":
      if (!isObjectValue(value)) {
        typeMismatch(out, constraint, value, path, origin);
      } else if (constraint.shape) {
        checkConcept(constraint.shape, value, path, out);
      }
      return;
    case "array":
      if (!Array.isArray(value)) {
        typeMismatch(out, constraint, value, path, origin);
        return;
      }
      if (constraint.minLength !== undefined && value.length < constraint.minLength) {
        error(
          out,
          "InvalidConceptArray",
          path,
          `expected at least ${constraint.minLength} items, received ${value.length}`,
          { concept: origin, expected: describeConstraintType(constraint) },
        );
      }
      if (constraint.element) {
        const element = constraint.element;
        value.forEach((item, index) => {
          checkConstraint(element, item, `${path}[${index}]`, origin, out);
        });
      }
      return;
    case "literal":
      if (value !== constraint.value) {
        const expected = JSON.stringify(constraint.value);
        error(
          out,
          "InvalidConceptLiteral",
          path,
          `expected ${expected}, received ${describeReceived(value)}`,
          {
            concept: origin,
            expected,
            received: describeReceived(value),
            fix: { op: "replace", path, expected },
          },
        );
      }
      return;
    case "enum":
      if (!constraint.values.includes(value as string | number | boolean)) {
        const expected = describeConstraintType(constraint);
        const near =
          typeof value === "string"
            ? closestName(
                value,
                constraint.values.filter((entry): entry is string => typeof entry === "string"),
              )
            : undefined;
        error(
          out,
          "InvalidConceptEnum",
          path,
          `${describeReceived(value)} is not one of ${expected}${near !== undefined ? `; did you mean ${JSON.stringify(near)}?` : ""}`,
          {
            concept: origin,
            expected,
            received: describeReceived(value),
            fix: {
              op: "replace",
              path,
              expected: near !== undefined ? JSON.stringify(near) : expected,
            },
          },
        );
      }
      return;
    case "union":
      checkUnion(constraint.options, value, path, origin, out, describeConstraintType(constraint));
      return;
    case "custom":
      if (!constraint.check(value)) {
        error(
          out,
          "InvalidConceptCustom",
          path,
          `failed ${constraint.name}, received ${describeReceived(value)}`,
          { concept: origin, expected: constraint.name, received: describeReceived(value) },
        );
      }
      return;
  }
}

/**
 * Diagnostics for a value against any constraint (a union, an array, a
 * nested concept), not only a whole concept. Paths are relative to the value.
 */
export function validateConstraintValue(
  constraint: ConceptFieldConstraint,
  value: unknown,
): ConceptDiagnostic[] {
  const out: Out = [];
  checkConstraint(constraint, value, "", undefined, out);
  return out;
}

/** `true` when `value` satisfies a single constraint (no definition checks). */
export function acceptsValue(constraint: ConceptFieldConstraint, value: unknown): boolean {
  const out: Out = [];
  checkConstraint(constraint, value, "", undefined, out);
  return !out.some((diagnostic) => diagnostic.severity === "error");
}

export function validateConceptValue(
  concept: ConceptDefinition,
  value: unknown,
): ConceptDiagnostic[] {
  const out = validateConceptDefinition(concept);
  checkConcept(concept, value, "", out);
  return out;
}

function hasErrors(diagnostics: readonly ConceptDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/** Type guard: `if (T.is(Rect, value)) value.width`. Warnings do not fail the guard. */
export function isConceptValue<TConcept extends ConceptDefinition>(
  concept: TConcept,
  value: unknown,
): value is Infer<TConcept> {
  return !hasErrors(validateConceptValue(concept, value));
}

export function assertConceptValue<TConcept extends ConceptDefinition>(
  concept: TConcept,
  value: unknown,
): asserts value is Infer<TConcept> {
  const diagnostics = validateConceptValue(concept, value);
  if (hasErrors(diagnostics)) {
    throw new ConceptError(
      concept.id,
      diagnostics,
      `Concept '${concept.id}' validation failed.\n${formatConceptDiagnostics(diagnostics)}`,
    );
  }
}

export function formatConceptDiagnostics(diagnostics: readonly ConceptDiagnostic[]): string {
  return formatDiagnostics(diagnostics, { style: "line", empty: "No concept diagnostics." });
}
