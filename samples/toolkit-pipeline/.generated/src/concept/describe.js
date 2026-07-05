function describeConstraint(name, constraint) {
    const optional = constraint.optional ? "?" : "";
    if (constraint.kind === "literal") {
        return `${name}: literal(${JSON.stringify(constraint.value)})${optional}`;
    }
    return `${name}: ${constraint.kind}${optional}`;
}
export function describeConcept(concept) {
    const fieldNames = Object.keys(concept.fields);
    return {
        kind: "concept",
        id: concept.id,
        description: concept.description,
        fieldNames,
        composedFrom: (concept.composedFrom ?? []).map((source) => source.id),
        fieldEntries: fieldNames.map((fieldName) => describeConstraint(fieldName, concept.fields[fieldName])),
    };
}
export function formatConceptDescription(description) {
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
    }
    else {
        lines.push("Fields: none");
    }
    return lines.join("\n");
}
export function describeTemplate(template) {
    return {
        kind: "template",
        id: template.id,
        description: template.description,
        requires: describeConcept(template.requires),
    };
}
export function formatTemplateDescription(description) {
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
