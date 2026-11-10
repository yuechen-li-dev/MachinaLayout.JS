import { Text } from "../text/utilities";
import { counterexamples, example } from "./fixtures";
import { describeConstraintType, isConceptDefinition, isOptional } from "./structure";
import type {
  ConceptDefinition,
  ConceptDescription,
  ConceptFieldConstraint,
  TemplateDescription,
  TemplateRecord,
} from "./types";

function describeConstraint(name: string, constraint: ConceptFieldConstraint): string {
  const optional = isOptional(constraint) ? "?" : "";
  if (!isConceptDefinition(constraint) && constraint.kind === "literal") {
    return `${name}: literal(${JSON.stringify(constraint.value)})${optional}`;
  }
  return `${name}: ${describeConstraintType(constraint)}${optional}`;
}

export function describeConcept(concept: ConceptDefinition): ConceptDescription {
  const fieldNames = Object.keys(concept.fields);
  return {
    kind: "concept",
    id: concept.id,
    description: concept.description,
    fieldNames,
    composedFrom: (concept.composedFrom ?? []).map((source) => source.id),
    fieldEntries: fieldNames.map((fieldName) =>
      describeConstraint(fieldName, concept.fields[fieldName]),
    ),
    ...(concept.closed ? { closed: true } : {}),
  };
}

export function formatConceptDescription(description: ConceptDescription): string {
  return Text.lines(
    `Concept: ${description.id}`,
    description.description && `Description: ${description.description}`,
    Text.list("Composed from:", description.composedFrom),
    Text.list("Fields:", description.fieldEntries, { empty: "Fields: none" }),
  );
}

export function describeTemplate<TInput, TOutput>(
  template: TemplateRecord<TInput, TOutput>,
): TemplateDescription {
  return {
    kind: "template",
    id: template.id,
    description: template.description,
    requires: describeConcept(template.requires),
  };
}

export function formatTemplateDescription(description: TemplateDescription): string {
  return Text.lines(
    `Template: ${description.id}`,
    description.description && `Description: ${description.description}`,
    Text.block("Requires:", formatConceptDescription(description.requires)),
  );
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    typeof item === "function" ? "<function>" : Number.isNaN(item) ? "NaN" : item,
  );
}

/**
 * LLM/human-oriented explanation: field list (with origins), a minimal valid
 * example, and the failure modes the validator checks. Plain text, stable order.
 */
export function explainConcept(concept: ConceptDefinition): string {
  const fields = Object.entries(concept.fields).map(([name, constraint]) => {
    const origin = concept.fieldOrigins?.[name];
    const fromText = origin && origin !== concept.id ? `  (from ${origin})` : "";
    return `${describeConstraint(name, constraint)}${fromText}`;
  });
  let checks: readonly string[];
  try {
    const byPath = new Map<string, Set<string>>();
    for (const entry of counterexamples(concept)) {
      byPath.set(entry.path, (byPath.get(entry.path) ?? new Set()).add(entry.mutation));
    }
    checks = [
      `Example: ${safeJson(example(concept))}`,
      ...Text.list(
        "Rejects:",
        [...byPath].map(([path, mutations]) => `${path}: ${[...mutations].join(", ")}`),
      ),
    ];
  } catch (error) {
    checks = [`Example: unavailable (${(error as Error).message.split("\n")[0]})`];
  }
  return Text.lines(
    `Concept: ${concept.id}${concept.closed ? " (closed: unknown keys are errors)" : ""}`,
    concept.description && `Description: ${concept.description}`,
    Text.list("Fields:", fields),
    checks,
  );
}
