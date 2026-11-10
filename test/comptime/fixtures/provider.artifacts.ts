import { CT } from "../../../src/comptime";
import { T } from "../../../src/concept";
import { Table } from "../../../src/table";

type TableJson = { id: string; columns: Record<string, readonly unknown[]> };

/** Concept tables are runtime data; baking one gives it exact static types. */
export const providerArtifacts = CT.artifacts({
  outDir: "test/comptime/fixtures/generated",
  artifacts: [
    CT.module(
      "provider.concept.ts",
      (ctx) => {
        const source = ctx.json("test/comptime/fixtures/provider-concepts.json") as TableJson;
        const columns = Object.fromEntries(
          Object.entries(source.columns).map(([name, values]) => [
            name,
            values.map((value) => (value === null ? undefined : value)),
          ]),
        );
        const concept = T.conceptFromTable(Table.define({ id: source.id, columns }), {
          id: "Provider",
        });
        return CT.ts.exportConst("Provider", concept, {
          satisfies: { type: "ConceptDefinition", from: "machinalayout/concept" },
          description: "Provider form concept, baked from provider-concepts.json.",
        });
      },
      { inputs: ["test/comptime/fixtures/provider-concepts.json"] },
    ),
  ],
});
