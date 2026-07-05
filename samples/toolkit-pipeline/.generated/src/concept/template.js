import { assertConceptValue } from "./validate.js";
function assertTemplateId(id) {
    if (typeof id !== "string" || id.trim().length === 0) {
        throw new Error("Template id must be non-empty.");
    }
}
function assertTemplateRun(run) {
    if (typeof run !== "function") {
        throw new Error("Template run must be a function.");
    }
}
function assertTemplateRequires(requires) {
    if (typeof requires !== "object" ||
        requires === null ||
        !("kind" in requires) ||
        requires.kind !== "concept") {
        throw new Error("Template requires must be a concept definition.");
    }
}
export function template(input) {
    assertTemplateId(input.id);
    assertTemplateRun(input.run);
    assertTemplateRequires(input.requires);
    return {
        kind: "template",
        id: input.id,
        requires: input.requires,
        run: input.run,
        description: input.description,
    };
}
export function runTemplate(record, input) {
    assertConceptValue(record.requires, input);
    return record.run(input);
}
