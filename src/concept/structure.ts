import type { ConceptDefinition, ConceptFieldConstraint } from "./types";

/** Non-concept constraint form: a nested concept is treated as `object(shape)`. */
export type NormalizedConstraint = Exclude<ConceptFieldConstraint, ConceptDefinition>;

export function isConceptDefinition(value: unknown): value is ConceptDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "concept" &&
    typeof (value as { fields?: unknown }).fields === "object"
  );
}

export function normalizeConstraint(constraint: ConceptFieldConstraint): NormalizedConstraint {
  if (isConceptDefinition(constraint)) {
    return { kind: "object", shape: constraint };
  }
  return constraint;
}

export function isOptional(constraint: ConceptFieldConstraint): boolean {
  return !isConceptDefinition(constraint) && constraint.optional === true;
}

/** Short human/LLM-readable type text: `number(finite, >=0)`, `"px" | "ui"`, `Rect`. */
export function describeConstraintType(input: ConceptFieldConstraint): string {
  if (isConceptDefinition(input)) {
    return input.id;
  }
  const constraint = input;
  switch (constraint.kind) {
    case "string": {
      const flags = [
        constraint.nonEmpty ? "nonEmpty" : undefined,
        constraint.brand ? `brand ${constraint.brand}` : undefined,
      ].filter(Boolean);
      return flags.length > 0 ? `string(${flags.join(", ")})` : "string";
    }
    case "number": {
      const flags = [
        constraint.int ? "int" : undefined,
        constraint.finite ? "finite" : undefined,
        constraint.min !== undefined ? `>=${constraint.min}` : undefined,
        constraint.max !== undefined ? `<=${constraint.max}` : undefined,
        constraint.allowNaN ? "NaN ok" : undefined,
        constraint.brand ? `brand ${constraint.brand}` : undefined,
      ].filter(Boolean);
      return flags.length > 0 ? `number(${flags.join(", ")})` : "number";
    }
    case "boolean":
      return "boolean";
    case "function":
      return "function";
    case "object":
      return constraint.shape ? constraint.shape.id : "object";
    case "array": {
      const element = constraint.element ? describeConstraintType(constraint.element) : "unknown";
      const min = constraint.minLength !== undefined ? `, minLength ${constraint.minLength}` : "";
      return `array<${element}${min}>`;
    }
    case "literal":
      return JSON.stringify(constraint.value);
    case "enum":
      return constraint.values.map((value) => JSON.stringify(value)).join(" | ");
    case "union":
      return constraint.options.map((option) => describeConstraintType(option)).join(" | ");
    case "custom":
      return `custom(${constraint.name})`;
  }
}

/**
 * Structural refinement: `true` when every value accepted by `narrow` is also
 * accepted by `wide` (narrow ⊆ wide). Conservative — returns `false` when it
 * cannot prove the relation. Open (non-closed) concepts are treated the way
 * TypeScript treats object types: extra keys are ignored.
 */
export function constraintRefines(
  narrowInput: ConceptFieldConstraint,
  wideInput: ConceptFieldConstraint,
  accepts: (constraint: ConceptFieldConstraint, value: unknown) => boolean,
): boolean {
  if (isOptional(narrowInput) && !isOptional(wideInput)) {
    return false;
  }
  const narrow = normalizeConstraint(narrowInput);
  const wide = normalizeConstraint(wideInput);

  if (narrow.kind === "union") {
    return narrow.options.every((option) =>
      constraintRefines(stripOptional(option), wideInput, accepts),
    );
  }
  if (narrow.kind === "literal") {
    return accepts(stripOptional(wideInput), narrow.value);
  }
  if (narrow.kind === "enum") {
    return narrow.values.every((value) => accepts(stripOptional(wideInput), value));
  }
  if (wide.kind === "union") {
    return wide.options.some((option) =>
      constraintRefines(stripOptional(narrowInput), option, accepts),
    );
  }

  switch (wide.kind) {
    case "string":
      return (
        narrow.kind === "string" &&
        (!wide.nonEmpty || narrow.nonEmpty === true) &&
        (wide.brand === undefined || narrow.brand === wide.brand)
      );
    case "number":
      return (
        narrow.kind === "number" &&
        (!wide.finite || narrow.finite === true) &&
        (!wide.int || narrow.int === true) &&
        (wide.min === undefined || (narrow.min !== undefined && narrow.min >= wide.min)) &&
        (wide.max === undefined || (narrow.max !== undefined && narrow.max <= wide.max)) &&
        (wide.allowNaN === true || narrow.allowNaN !== true) &&
        (wide.brand === undefined || narrow.brand === wide.brand)
      );
    case "boolean":
      return narrow.kind === "boolean";
    case "function":
      return narrow.kind === "function";
    case "object":
      if (narrow.kind !== "object") {
        return false;
      }
      if (!wide.shape) {
        return true;
      }
      return narrow.shape !== undefined && conceptRefines(narrow.shape, wide.shape, accepts);
    case "array":
      if (narrow.kind !== "array") {
        return false;
      }
      if (wide.minLength !== undefined && (narrow.minLength ?? 0) < wide.minLength) {
        return false;
      }
      if (!wide.element) {
        return true;
      }
      return (
        narrow.element !== undefined && constraintRefines(narrow.element, wide.element, accepts)
      );
    case "custom":
      return narrow.kind === "custom" && narrow.check === wide.check;
    case "literal":
    case "enum":
      // Only literal/enum/union narrows reach here; they were handled above.
      return false;
  }
}

function stripOptional(constraint: ConceptFieldConstraint): ConceptFieldConstraint {
  if (isConceptDefinition(constraint) || !constraint.optional) {
    return constraint;
  }
  return { ...constraint, optional: false } as ConceptFieldConstraint;
}

/** Every value satisfying `narrow` also satisfies `wide`. */
export function conceptRefines(
  narrow: ConceptDefinition,
  wide: ConceptDefinition,
  accepts: (constraint: ConceptFieldConstraint, value: unknown) => boolean,
): boolean {
  if (narrow === wide) {
    return true;
  }
  if (wide.closed) {
    if (!narrow.closed) {
      return false;
    }
    for (const fieldName of Object.keys(narrow.fields)) {
      if (!(fieldName in wide.fields)) {
        return false;
      }
    }
  }
  for (const [fieldName, wideConstraint] of Object.entries(wide.fields)) {
    const narrowConstraint = narrow.fields[fieldName];
    if (narrowConstraint === undefined) {
      if (!isOptional(wideConstraint)) {
        return false;
      }
      continue;
    }
    if (!constraintRefines(narrowConstraint, wideConstraint, accepts)) {
      return false;
    }
  }
  return true;
}

export function constraintsEquivalent(
  left: ConceptFieldConstraint,
  right: ConceptFieldConstraint,
  accepts: (constraint: ConceptFieldConstraint, value: unknown) => boolean,
): boolean {
  return constraintRefines(left, right, accepts) && constraintRefines(right, left, accepts);
}

/** Levenshtein distance, capped for speed on short identifiers. */
export function editDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length];
}

/** Closest candidate within a small edit budget, or a case-insensitive / prefix match. */
export function closestName(name: string, candidates: Iterable<string>): string | undefined {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  const lowered = name.toLowerCase();
  for (const candidate of candidates) {
    const candidateLowered = candidate.toLowerCase();
    let score = editDistance(lowered, candidateLowered);
    if (
      Math.min(lowered.length, candidateLowered.length) >= 3 &&
      (candidateLowered.startsWith(lowered) ||
        lowered.startsWith(candidateLowered) ||
        lowered.includes(candidateLowered))
    ) {
      score = Math.min(score, 1);
    }
    const budget = Math.max(
      1,
      Math.min(3, Math.floor(Math.max(name.length, candidate.length) / 3)),
    );
    if (score <= budget && score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
