import type { Infer } from "./infer";
import type { ConceptDefinition, TemplateRecord } from "./types";
import { assertConceptValue } from "./validate";

function assertTemplateId(id: string): void {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Template id must be non-empty.");
  }
}

function assertTemplateRun(run: unknown): asserts run is (input: unknown) => unknown {
  if (typeof run !== "function") {
    throw new Error("Template run must be a function.");
  }
}

function assertTemplateRequires(requires: unknown): asserts requires is ConceptDefinition {
  if (
    typeof requires !== "object" ||
    requires === null ||
    !("kind" in requires) ||
    (requires as { kind?: unknown }).kind !== "concept"
  ) {
    throw new Error("Template requires must be a concept definition.");
  }
}

/**
 * A function whose input type is derived from its required concept, so the
 * runtime contract and the parameter type cannot drift apart.
 */
export function template<const TConcept extends ConceptDefinition, TOutput>(input: {
  id: string;
  requires: TConcept;
  run: (input: Infer<TConcept>) => TOutput;
  description?: string;
}): TemplateRecord<Infer<TConcept>, TOutput> & { readonly requires: TConcept } {
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

/** Validates `input` against the template's concept, then runs it. */
export function runTemplate<TInput, TOutput>(
  record: TemplateRecord<TInput, TOutput>,
  input: TInput,
): TOutput {
  assertConceptValue(record.requires, input);
  return record.run(input);
}
