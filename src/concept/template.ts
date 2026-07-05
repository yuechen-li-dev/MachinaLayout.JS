import { assertConceptValue } from "./validate";
import type { ConceptDefinition, TemplateRecord } from "./types";

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

export function template<TInput, TOutput>(input: {
  id: string;
  requires: ConceptDefinition;
  run: (input: TInput) => TOutput;
  description?: string;
}): TemplateRecord<TInput, TOutput> {
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

export function runTemplate<TInput, TOutput>(
  record: TemplateRecord<TInput, TOutput>,
  input: TInput,
): TOutput {
  assertConceptValue(record.requires, input);
  return record.run(input);
}
