import { ConceptError, } from "./types.js";
const CONSTRAINT_KINDS = new Set([
    "string",
    "number",
    "boolean",
    "function",
    "object",
    "array",
    "literal",
]);
function pushDiagnostic(diagnostics, severity, code, message, path) {
    diagnostics.push({ severity, code, message, path });
}
function isSafeFieldName(name) {
    return /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(name);
}
function isSupportedLiteralValue(value) {
    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function areConstraintsEquivalent(left, right) {
    if (left.kind !== right.kind) {
        return false;
    }
    if ((left.optional ?? false) !== (right.optional ?? false)) {
        return false;
    }
    if (left.kind === "literal" && right.kind === "literal") {
        return left.value === right.value;
    }
    return true;
}
function formatConstraint(constraint) {
    const optional = constraint.optional ? "?" : "";
    if (constraint.kind === "literal") {
        return `${JSON.stringify(constraint.value)}${optional}`;
    }
    return `${constraint.kind}${optional}`;
}
function validateConstraint(constraint, path, diagnostics) {
    if (!CONSTRAINT_KINDS.has(constraint.kind)) {
        pushDiagnostic(diagnostics, "error", "InvalidConceptConstraint", `Constraint kind '${String(constraint.kind)}' is not supported.`, path);
        return;
    }
    if (constraint.kind === "literal" && !isSupportedLiteralValue(constraint.value)) {
        pushDiagnostic(diagnostics, "error", "InvalidConceptConstraint", "Literal constraints must use string, number, or boolean values.", path);
    }
}
function validateConceptDefinitionInner(concept, diagnostics, visited) {
    if (visited.has(concept)) {
        pushDiagnostic(diagnostics, "error", "InvalidConceptConstraint", `Recursive concept composition is not supported for '${concept.id}'.`, "composedFrom");
        return;
    }
    visited.add(concept);
    if (typeof concept.id !== "string" || concept.id.trim().length === 0) {
        pushDiagnostic(diagnostics, "error", "InvalidConceptId", "Concept id must be a non-empty string.", "id");
    }
    if (typeof concept.fields !== "object" ||
        concept.fields === null ||
        Array.isArray(concept.fields)) {
        pushDiagnostic(diagnostics, "error", "InvalidConceptConstraint", "Concept fields must be a record of field constraints.", "fields");
    }
    else {
        for (const [fieldName, constraint] of Object.entries(concept.fields)) {
            if (fieldName.trim().length === 0 || !isSafeFieldName(fieldName)) {
                pushDiagnostic(diagnostics, "error", "InvalidConceptField", `Concept field '${fieldName}' is empty or not safe-ish.`, `fields.${fieldName}`);
            }
            validateConstraint(constraint, `fields.${fieldName}`, diagnostics);
        }
    }
    const composedFrom = concept.composedFrom ?? [];
    const seenFields = new Map();
    for (const sourceConcept of composedFrom) {
        validateConceptDefinitionInner(sourceConcept, diagnostics, visited);
        for (const [fieldName, constraint] of Object.entries(sourceConcept.fields)) {
            const seen = seenFields.get(fieldName);
            if (seen && !areConstraintsEquivalent(seen.constraint, constraint)) {
                pushDiagnostic(diagnostics, "error", "ConflictingConceptField", `Field '${fieldName}' conflicts between composed concepts '${seen.source}' and '${sourceConcept.id}' (${formatConstraint(seen.constraint)} vs ${formatConstraint(constraint)}).`, `fields.${fieldName}`);
            }
            else if (!seen) {
                seenFields.set(fieldName, { constraint, source: sourceConcept.id });
            }
        }
    }
    visited.delete(concept);
}
function hasField(value, fieldName) {
    return Object.hasOwn(value, fieldName);
}
function isObjectValue(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isConstraintSatisfied(constraint, value) {
    switch (constraint.kind) {
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number";
        case "boolean":
            return typeof value === "boolean";
        case "function":
            return typeof value === "function";
        case "object":
            return isObjectValue(value);
        case "array":
            return Array.isArray(value);
        case "literal":
            return value === constraint.value;
    }
}
export function validateConceptDefinition(concept) {
    const diagnostics = [];
    validateConceptDefinitionInner(concept, diagnostics, new Set());
    return diagnostics;
}
export function validateConceptValue(concept, value) {
    const diagnostics = validateConceptDefinition(concept);
    const record = (typeof value === "object" && value !== null) || typeof value === "function"
        ? value
        : undefined;
    for (const [fieldName, constraint] of Object.entries(concept.fields)) {
        if (!record || !hasField(record, fieldName)) {
            if (!constraint.optional) {
                pushDiagnostic(diagnostics, "error", "MissingConceptField", `Required concept field '${fieldName}' is missing.`, fieldName);
            }
            continue;
        }
        const fieldValue = record[fieldName];
        if (!isConstraintSatisfied(constraint, fieldValue)) {
            if (constraint.kind === "literal") {
                pushDiagnostic(diagnostics, "error", "InvalidConceptLiteral", `Field '${fieldName}' must equal ${JSON.stringify(constraint.value)}.`, fieldName);
            }
            else {
                pushDiagnostic(diagnostics, "error", "InvalidConceptFieldType", `Field '${fieldName}' must be ${constraint.kind}.`, fieldName);
            }
        }
    }
    return diagnostics;
}
export function assertConceptValue(concept, value) {
    const diagnostics = validateConceptValue(concept, value);
    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
        throw new ConceptError(concept.id, diagnostics);
    }
}
export function formatConceptDiagnostics(diagnostics) {
    if (diagnostics.length === 0) {
        return "No concept diagnostics.";
    }
    return diagnostics
        .map((diagnostic) => {
        const path = diagnostic.path ? ` at ${diagnostic.path}` : "";
        return `[${diagnostic.severity}] ${diagnostic.code}${path}: ${diagnostic.message}`;
    })
        .join("\n");
}
