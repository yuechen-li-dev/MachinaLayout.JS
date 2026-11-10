import { counterexamples, example } from "./fixtures";
import { describeConstraintType, isConceptDefinition, isOptional } from "./structure";
import type {
  ConceptDefinition,
  ConceptDescription,
  ConceptFieldConstraint,
  ConceptPrimitiveKind,
  ConceptRecord,
  ConceptTableDescription,
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
  const lines = [`Concept: ${description.id}`];
  if (description.description) {
    lines.push(`Description: ${description.description}`);
  }
  if (description.composedFrom.length > 0) {
    lines.push("Composed from:");
    for (const source of description.composedFrom) {
      lines.push(`- ${source}`);
    }
  }
  if (description.fieldEntries.length > 0) {
    lines.push("Fields:");
    for (const field of description.fieldEntries) {
      lines.push(`- ${field}`);
    }
  } else {
    lines.push("Fields: none");
  }
  return lines.join("\n");
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
  const lines = [`Template: ${description.id}`];
  if (description.description) {
    lines.push(`Description: ${description.description}`);
  }
  lines.push("Requires:");
  for (const line of formatConceptDescription(description.requires).split("\n")) {
    lines.push(`  ${line}`);
  }
  return lines.join("\n");
}

export function describeConcepts(
  concepts: readonly ConceptRecord[],
  tableId = "",
): ConceptTableDescription {
  const types: ConceptPrimitiveKind[] = [];

  for (const concept of concepts) {
    if (!types.includes(concept.type)) {
      types.push(concept.type);
    }
  }

  return {
    kind: "conceptTableDescription",
    tableId,
    conceptCount: concepts.length,
    requiredCount: concepts.filter((concept) => concept.required).length,
    types,
  };
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
  const lines = [
    `Concept: ${concept.id}${concept.closed ? " (closed: unknown keys are errors)" : ""}`,
  ];
  if (concept.description) {
    lines.push(`Description: ${concept.description}`);
  }
  lines.push("Fields:");
  for (const [name, constraint] of Object.entries(concept.fields)) {
    const origin = concept.fieldOrigins?.[name];
    const fromText = origin && origin !== concept.id ? `  (from ${origin})` : "";
    lines.push(`- ${describeConstraint(name, constraint)}${fromText}`);
  }
  try {
    lines.push(`Example: ${safeJson(example(concept))}`);
    const checks = new Map<string, Set<string>>();
    for (const entry of counterexamples(concept)) {
      checks.set(entry.path, (checks.get(entry.path) ?? new Set()).add(entry.mutation));
    }
    lines.push("Rejects:");
    for (const [path, mutations] of checks) {
      lines.push(`- ${path}: ${[...mutations].join(", ")}`);
    }
  } catch (error) {
    lines.push(`Example: unavailable (${(error as Error).message.split("\n")[0]})`);
  }
  return lines.join("\n");
}
