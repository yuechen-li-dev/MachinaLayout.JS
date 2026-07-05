export class ConceptError extends Error {
    conceptId;
    diagnostics;
    constructor(conceptId, diagnostics) {
        super(`Concept '${conceptId}' validation failed.`);
        this.name = "ConceptError";
        this.conceptId = conceptId;
        this.diagnostics = diagnostics;
    }
}
