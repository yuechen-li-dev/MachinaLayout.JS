import { describeConcept, describeTemplate } from "./describe";
import { runTemplate, template } from "./template";
import { assertConceptValue, validateConceptValue } from "./validate";
function cloneConstraint(constraint) {
    if (constraint.kind === "literal") {
        return {
            kind: "literal",
            value: constraint.value,
            optional: constraint.optional,
        };
    }
    return {
        kind: constraint.kind,
        optional: constraint.optional,
    };
}
function cloneFields(input) {
    const cloned = {};
    for (const [fieldName, constraint] of Object.entries(input ?? {})) {
        cloned[fieldName] = cloneConstraint(constraint);
    }
    return cloned;
}
function assertConceptId(id) {
    if (typeof id !== "string" || id.trim().length === 0) {
        throw new Error("Concept id must be non-empty.");
    }
}
export function string() {
    return { kind: "string" };
}
export function number() {
    return { kind: "number" };
}
export function boolean() {
    return { kind: "boolean" };
}
export function fn() {
    return { kind: "function" };
}
export function object() {
    return { kind: "object" };
}
export function array() {
    return { kind: "array" };
}
export function literal(value) {
    return {
        kind: "literal",
        value,
    };
}
export function optional(constraint) {
    return {
        ...cloneConstraint(constraint),
        optional: true,
    };
}
export function fields(input) {
    return cloneFields(input);
}
export function concept(input) {
    assertConceptId(input.id);
    return {
        kind: "concept",
        id: input.id,
        description: input.description,
        fields: cloneFields(input.fields),
    };
}
export function compose(input) {
    assertConceptId(input.id);
    const mergedFields = {};
    for (const source of input.concepts) {
        Object.assign(mergedFields, cloneFields(source.fields));
    }
    Object.assign(mergedFields, cloneFields(input.fields));
    return {
        kind: "concept",
        id: input.id,
        description: input.description,
        fields: mergedFields,
        composedFrom: [...input.concepts],
    };
}
export const T = {
    concept,
    compose,
    validate: validateConceptValue,
    assert: assertConceptValue,
    describe: describeConcept,
    template,
    runTemplate,
    describeTemplate,
    fields,
    string,
    number,
    boolean,
    fn,
    function: fn,
    object,
    array,
    literal,
    optional,
};
