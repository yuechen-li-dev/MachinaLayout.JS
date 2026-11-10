import type { OverloadRecord } from "./overload";
import { conceptRefines } from "./structure";
import type { ConceptDefinition, TemplateRecord } from "./types";
import { acceptsValue, isConceptValue } from "./validate";

type AnyTemplate = TemplateRecord<never, unknown>;
type AnyOverload = OverloadRecord<never, unknown>;

export type Capability = {
  readonly id: string;
  readonly kind: "template" | "overload";
  readonly requires: readonly string[];
  readonly description?: string;
};

export type ConceptRegistry = {
  readonly register: (...entries: readonly (AnyTemplate | AnyOverload)[]) => ConceptRegistry;
  /** Everything that would accept this concrete value, most specific requirement first. */
  readonly capabilities: (value: unknown) => readonly Capability[];
  /** Everything statically guaranteed to accept every value of `concept`. */
  readonly accepting: (concept: ConceptDefinition) => readonly Capability[];
  readonly entries: () => readonly Capability[];
  readonly describe: () => string;
};

function requirementsOf(entry: AnyTemplate | AnyOverload): readonly ConceptDefinition[] {
  return entry.kind === "template"
    ? [entry.requires]
    : entry.templates.map((template) => template.requires);
}

function toCapability(entry: AnyTemplate | AnyOverload): Capability {
  return {
    id: entry.id,
    kind: entry.kind,
    requires: requirementsOf(entry).map((concept) => concept.id),
    description: entry.description,
  };
}

/**
 * Explicit (non-global) index of templates and overloads by required concept,
 * answering "what can I do with this value / this concept?".
 */
export function registry(): ConceptRegistry {
  const entries: (AnyTemplate | AnyOverload)[] = [];

  const self: ConceptRegistry = {
    register: (...added) => {
      for (const entry of added) {
        if (entries.some((existing) => existing.id === entry.id)) {
          throw new Error(`Registry already has an entry with id '${entry.id}'.`);
        }
        entries.push(entry);
      }
      return self;
    },
    capabilities: (value) => {
      const matched = entries.flatMap((entry) => {
        const concept = requirementsOf(entry).find((required) => isConceptValue(required, value));
        return concept ? [{ entry, concept }] : [];
      });
      const rank = (concept: ConceptDefinition) =>
        matched.filter(
          (other) =>
            other.concept !== concept &&
            conceptRefines(concept, other.concept, acceptsValue) &&
            !conceptRefines(other.concept, concept, acceptsValue),
        ).length;
      return matched
        .map((item) => ({ ...item, rank: rank(item.concept) }))
        .sort((left, right) => right.rank - left.rank)
        .map(({ entry }) => toCapability(entry));
    },
    accepting: (concept) =>
      entries
        .filter((entry) =>
          entry.kind === "template"
            ? conceptRefines(concept, entry.requires, acceptsValue)
            : requirementsOf(entry).some((required) =>
                conceptRefines(concept, required, acceptsValue),
              ),
        )
        .map(toCapability),
    entries: () => entries.map(toCapability),
    describe: () =>
      entries.length === 0
        ? "Registry: empty"
        : [
            "Registry:",
            ...entries.map((entry) => {
              const capability = toCapability(entry);
              return `- ${capability.id} (${capability.kind}) requires ${capability.requires.join(" | ")}${capability.description ? ` — ${capability.description}` : ""}`;
            }),
          ].join("\n"),
  };
  return self;
}
