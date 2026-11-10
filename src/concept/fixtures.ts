import type { Infer } from "./infer";
import { isConceptDefinition, isOptional, normalizeConstraint } from "./structure";
import { type ConceptDefinition, ConceptError, type ConceptFieldConstraint } from "./types";
import { acceptsValue, formatConceptDiagnostics, validateConceptValue } from "./validate";

export type ExampleOptions = {
  /** Also fill optional fields. Default: required fields only (the minimal valid value). */
  readonly includeOptional?: boolean;
};

function exampleFor(
  constraint: ConceptFieldConstraint,
  name: string,
  options: ExampleOptions,
): unknown {
  if (isConceptDefinition(constraint)) {
    return exampleOfConcept(constraint, options);
  }
  switch (constraint.kind) {
    case "string":
      return name.length > 0 ? name : "x";
    case "number": {
      let value = constraint.min ?? 0;
      if (constraint.max !== undefined && value > constraint.max) {
        value = constraint.max;
      }
      return constraint.int ? Math.ceil(value) : value;
    }
    case "boolean":
      return false;
    case "function":
      return () => undefined;
    case "object":
      return constraint.shape ? exampleOfConcept(constraint.shape, options) : {};
    case "array": {
      const count = constraint.minLength ?? 0;
      const element = constraint.element;
      return element
        ? Array.from({ length: count }, (_, index) =>
            exampleFor(element, `${name}${index}`, options),
          )
        : Array.from({ length: count }, () => null);
    }
    case "literal":
      return constraint.value;
    case "enum":
      return constraint.values[0];
    case "union": {
      for (const option of constraint.options) {
        try {
          const candidate = exampleFor(option, name, options);
          if (acceptsValue(option, candidate)) {
            return candidate;
          }
        } catch {
          // try the next branch
        }
      }
      throw new Error(`No union branch of '${name}' can produce an example.`);
    }
    case "custom":
      if (constraint.example === undefined) {
        throw new Error(
          `Custom constraint '${constraint.name}' needs an \`example\` for fixtures.`,
        );
      }
      return constraint.example;
  }
}

function exampleOfConcept(concept: ConceptDefinition, options: ExampleOptions) {
  const value: Record<string, unknown> = {};
  for (const [fieldName, constraint] of Object.entries(concept.fields)) {
    if (isOptional(constraint) && !options.includeOptional) {
      continue;
    }
    value[fieldName] = exampleFor(constraint, fieldName, options);
  }
  return value;
}

/** Deterministic valid value (self-checked against the validator). */
export function example<TConcept extends ConceptDefinition>(
  concept: TConcept,
  options: ExampleOptions = {},
): Infer<TConcept> {
  return checkedExample(concept, options) as Infer<TConcept>;
}

function checkedExample(
  concept: ConceptDefinition,
  options: ExampleOptions,
): Record<string, unknown> {
  const value = exampleOfConcept(concept, options);
  const diagnostics = validateConceptValue(concept, value).filter(
    (diagnostic) => diagnostic.severity === "error",
  );
  if (diagnostics.length > 0) {
    throw new ConceptError(
      concept.id,
      diagnostics,
      `Concept '${concept.id}' example is invalid (fixture/validator disagree).\n${formatConceptDiagnostics(diagnostics)}`,
    );
  }
  return value;
}

export type Counterexample = {
  readonly path: string;
  readonly mutation: string;
  readonly value: unknown;
  /** Diagnostic code the validator is guaranteed to report at `path`. */
  readonly expectedCode: string;
};

type Mutation = {
  readonly mutation: string;
  readonly apply: (current: unknown) => { readonly value: unknown } | "delete";
  readonly code: string;
};

function wrongKindValue(constraint: ConceptFieldConstraint): unknown {
  const normalized = normalizeConstraint(constraint);
  switch (normalized.kind) {
    case "string":
      return 1;
    case "number":
      return "1";
    case "boolean":
      return "true";
    case "array":
      return {};
    default:
      return 1;
  }
}

function mutationsFor(constraint: ConceptFieldConstraint, required: boolean): Mutation[] {
  const list: Mutation[] = [];
  if (required) {
    list.push({ mutation: "missing", apply: () => "delete", code: "MissingConceptField" });
  }
  const normalized = normalizeConstraint(constraint);
  switch (normalized.kind) {
    case "string":
    case "number":
    case "boolean":
    case "function":
    case "array":
    case "object":
      list.push({
        mutation: "wrongKind",
        apply: () => ({ value: wrongKindValue(constraint) }),
        code: "InvalidConceptFieldType",
      });
      break;
    case "literal":
      list.push({
        mutation: "wrongLiteral",
        apply: () => ({
          value: typeof normalized.value === "string" ? `${normalized.value}_x` : "__wrong__",
        }),
        code: "InvalidConceptLiteral",
      });
      break;
    case "enum":
      list.push({
        mutation: "notInEnum",
        apply: () => ({ value: "__not_in_enum__" }),
        code: "InvalidConceptEnum",
      });
      break;
    case "union":
      list.push({
        mutation: "noBranch",
        apply: () => ({ value: null }),
        code: "NoMatchingUnionBranch",
      });
      break;
    case "custom":
      break;
  }
  if (normalized.kind === "number") {
    if (!normalized.allowNaN) {
      list.push({
        mutation: "NaN",
        apply: () => ({ value: Number.NaN }),
        code: "InvalidConceptNumber",
      });
    }
    if (normalized.finite) {
      list.push({
        mutation: "infinite",
        apply: () => ({ value: Number.POSITIVE_INFINITY }),
        code: "InvalidConceptNumber",
      });
    }
    if (normalized.int) {
      list.push({
        mutation: "fractional",
        apply: (current) => ({ value: (typeof current === "number" ? current : 0) + 0.5 }),
        code: "InvalidConceptNumber",
      });
    }
    if (normalized.min !== undefined) {
      const min = normalized.min;
      list.push({
        mutation: "belowMin",
        apply: () => ({ value: min - 1 }),
        code: "InvalidConceptNumber",
      });
    }
    if (normalized.max !== undefined) {
      const max = normalized.max;
      list.push({
        mutation: "aboveMax",
        apply: () => ({ value: max + 1 }),
        code: "InvalidConceptNumber",
      });
    }
  }
  if (normalized.kind === "string" && normalized.nonEmpty) {
    list.push({ mutation: "empty", apply: () => ({ value: "" }), code: "InvalidConceptString" });
  }
  return list;
}

function cloneDeep<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneDeep(item)) as TValue;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneDeep(item)]),
    ) as TValue;
  }
  return value;
}

function collect(
  concept: ConceptDefinition,
  base: Record<string, unknown>,
  prefix: readonly string[],
  out: { path: readonly string[]; mutation: Mutation; closedExtra?: boolean }[],
): void {
  for (const [fieldName, constraint] of Object.entries(concept.fields)) {
    const path = [...prefix, fieldName];
    const required = !isOptional(constraint);
    if (!required && !(fieldName in base)) {
      continue;
    }
    for (const mutation of mutationsFor(constraint, required)) {
      out.push({ path, mutation });
    }
    const normalized = normalizeConstraint(constraint);
    const nested = base[fieldName];
    if (normalized.kind === "object" && normalized.shape && typeof nested === "object" && nested) {
      collect(normalized.shape, nested as Record<string, unknown>, path, out);
    }
  }
  if (concept.closed) {
    out.push({
      path: [...prefix, "__unexpected__"],
      mutation: {
        mutation: "unknownKey",
        apply: () => ({ value: true }),
        code: "UnknownConceptField",
      },
    });
  }
}

/**
 * One invalid value per (field, failure mode), each derived from the example
 * by a single mutation. Every entry is verified: the validator must report
 * `expectedCode` at `path`, otherwise this throws (generator/validator drift).
 */
export function counterexamples(concept: ConceptDefinition): readonly Counterexample[] {
  const base = checkedExample(concept, { includeOptional: true });
  const planned: { path: readonly string[]; mutation: Mutation }[] = [];
  collect(concept, base, [], planned);

  return planned.map(({ path, mutation }) => {
    const value = cloneDeep(base);
    let parent: Record<string, unknown> = value;
    for (const key of path.slice(0, -1)) {
      parent = parent[key] as Record<string, unknown>;
    }
    const leaf = path[path.length - 1];
    const applied = mutation.apply(parent[leaf]);
    if (applied === "delete") {
      delete parent[leaf];
    } else {
      parent[leaf] = applied.value;
    }

    const pathText = path.join(".");
    const diagnostics = validateConceptValue(concept, value);
    if (!diagnostics.some((d) => d.code === mutation.code && d.path === pathText)) {
      throw new ConceptError(
        concept.id,
        diagnostics,
        `Counterexample '${mutation.mutation}' at ${pathText} did not produce ${mutation.code}.\n${formatConceptDiagnostics(diagnostics)}`,
      );
    }
    return { path: pathText, mutation: mutation.mutation, value, expectedCode: mutation.code };
  });
}
