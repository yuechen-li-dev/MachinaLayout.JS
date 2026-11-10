import { conceptRefines } from "./structure";
import { type ConceptDiagnostic, ConceptError, type TemplateRecord } from "./types";
import {
  acceptsValue,
  formatConceptDiagnostics,
  isConceptValue,
  validateConceptValue,
} from "./validate";

type AnyTemplate = TemplateRecord<never, unknown>;

type InputOf<TTemplates extends readonly AnyTemplate[]> = TTemplates[number] extends infer TEach
  ? TEach extends TemplateRecord<infer TInput, unknown>
    ? TInput
    : never
  : never;

type OutputOf<TTemplates extends readonly AnyTemplate[]> = TTemplates[number] extends infer TEach
  ? TEach extends TemplateRecord<never, infer TOutput>
    ? TOutput
    : never
  : never;

export type OverloadResolution<TOutput> =
  | {
      readonly ok: true;
      readonly template: AnyTemplate;
      readonly run: () => TOutput;
    }
  | {
      readonly ok: false;
      readonly code: "NoMatchingOverload" | "AmbiguousOverload";
      readonly candidates: readonly string[];
      readonly diagnostics: readonly ConceptDiagnostic[];
    };

export type OverloadRecord<TInput, TOutput> = {
  readonly kind: "overload";
  readonly id: string;
  readonly description?: string;
  /** Templates ordered most-specific first. */
  readonly templates: readonly AnyTemplate[];
  /** Dispatch to the most specific template whose concept the value satisfies; throws otherwise. */
  readonly call: (value: TInput) => TOutput;
  /** Non-throwing dispatch for untrusted input. */
  readonly resolve: (value: unknown) => OverloadResolution<TOutput>;
  readonly describe: () => string;
};

function strictlyRefines(narrow: AnyTemplate, wide: AnyTemplate): boolean {
  return (
    conceptRefines(narrow.requires, wide.requires, acceptsValue) &&
    !conceptRefines(wide.requires, narrow.requires, acceptsValue)
  );
}

/**
 * Concept-based overload set (C++ partial-ordering style): the most specific
 * matching template wins, where "more specific" is structural refinement of
 * the required concepts. Two matching templates where neither refines the
 * other is an `AmbiguousOverload`, never a silent first-wins.
 */
export function overload<const TTemplates extends readonly AnyTemplate[]>(
  id: string,
  templates: TTemplates,
  options?: { readonly description?: string },
): OverloadRecord<InputOf<TTemplates>, OutputOf<TTemplates>> {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Overload id must be non-empty.");
  }
  if (templates.length === 0) {
    throw new Error(`Overload '${id}' needs at least one template.`);
  }

  const definitionErrors: ConceptDiagnostic[] = [];
  const ids = new Set<string>();
  for (const [index, entry] of templates.entries()) {
    if (ids.has(entry.id)) {
      definitionErrors.push({
        severity: "error",
        code: "DuplicateOverload",
        message: `template id '${entry.id}' appears twice`,
        path: `templates[${index}]`,
      });
    }
    ids.add(entry.id);
    for (const other of templates.slice(0, index)) {
      if (
        conceptRefines(entry.requires, other.requires, acceptsValue) &&
        conceptRefines(other.requires, entry.requires, acceptsValue)
      ) {
        definitionErrors.push({
          severity: "error",
          code: "DuplicateOverload",
          message: `'${entry.id}' and '${other.id}' require equivalent concepts (${entry.requires.id} ≡ ${other.requires.id}); one can never be chosen`,
          path: `templates[${index}]`,
        });
      }
    }
  }
  if (definitionErrors.length > 0) {
    throw new ConceptError(
      id,
      definitionErrors,
      `Overload '${id}' is invalid.\n${formatConceptDiagnostics(definitionErrors)}`,
    );
  }

  // Most specific first: count how many others each template strictly refines.
  const depth = new Map<AnyTemplate, number>(
    templates.map((entry) => [
      entry,
      templates.filter((other) => other !== entry && strictlyRefines(entry, other)).length,
    ]),
  );
  const ordered = [...templates].sort((left, right) => depth.get(right)! - depth.get(left)!);

  type TOutput = OutputOf<TTemplates>;

  const resolve = (value: unknown): OverloadResolution<TOutput> => {
    const matching = ordered.filter((entry) => isConceptValue(entry.requires, value));

    if (matching.length === 0) {
      const ranked = ordered
        .map((entry) => ({
          entry,
          errors: validateConceptValue(entry.requires, value).filter(
            (diagnostic) => diagnostic.severity === "error",
          ),
        }))
        .sort((left, right) => left.errors.length - right.errors.length);
      return {
        ok: false,
        code: "NoMatchingOverload",
        candidates: ranked.map(({ entry }) => entry.id),
        diagnostics: ranked.map(({ entry, errors }) => ({
          severity: "error" as const,
          code: "NoMatchingOverload",
          message: `${entry.id} (requires ${entry.requires.id}): ${errors
            .slice(0, 2)
            .map((diagnostic) => `${diagnostic.path || "<root>"} ${diagnostic.message}`)
            .join("; ")}${errors.length > 2 ? `; +${errors.length - 2} more` : ""}`,
          concept: entry.requires.id,
        })),
      };
    }

    const best = matching.filter(
      (entry) => !matching.some((other) => other !== entry && strictlyRefines(other, entry)),
    );
    if (best.length > 1) {
      const names = best.map((entry) => `${entry.id} (${entry.requires.id})`);
      return {
        ok: false,
        code: "AmbiguousOverload",
        candidates: best.map((entry) => entry.id),
        diagnostics: [
          {
            severity: "error",
            code: "AmbiguousOverload",
            message: `value satisfies ${names.join(" and ")}, and neither concept refines the other; add a template for their composition or narrow one concept`,
          },
        ],
      };
    }

    const chosen = best[0];
    return {
      ok: true,
      template: chosen,
      run: () => (chosen.run as (input: unknown) => TOutput)(value),
    };
  };

  return {
    kind: "overload",
    id,
    description: options?.description,
    templates: ordered,
    resolve,
    call: (value) => {
      const resolution = resolve(value);
      if (!resolution.ok) {
        throw new ConceptError(
          id,
          resolution.diagnostics,
          `Overload '${id}': ${resolution.code}.\n${formatConceptDiagnostics(resolution.diagnostics)}`,
        );
      }
      return resolution.run();
    },
    describe: () => {
      const lines = [`Overload: ${id}`];
      if (options?.description) {
        lines.push(`Description: ${options.description}`);
      }
      lines.push("Candidates (most specific first):");
      for (const entry of ordered) {
        const refines = ordered
          .filter((other) => other !== entry && strictlyRefines(entry, other))
          .map((other) => other.requires.id);
        lines.push(
          `- ${entry.id} requires ${entry.requires.id}${refines.length > 0 ? ` (refines ${refines.join(", ")})` : ""}`,
        );
      }
      return lines.join("\n");
    },
  };
}
