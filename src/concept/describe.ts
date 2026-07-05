import type {
  ConceptDefinition,
  ConceptDescription,
  ConceptFieldConstraint,
  TemplateDescription,
  TemplateRecord,
} from "./types";

function describeConstraint(name: string, constraint: ConceptFieldConstraint): string {
  const optional = constraint.optional ? "?" : "";
  if (constraint.kind === "literal") {
    return `${name}: literal(${JSON.stringify(constraint.value)})${optional}`;
  }
  return `${name}: ${constraint.kind}${optional}`;
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
