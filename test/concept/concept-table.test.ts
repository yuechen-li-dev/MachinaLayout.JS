import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  T,
  conceptTableSchema,
  conceptsFromTable,
  describeConcepts,
  validateConceptTable,
} from "../../src/concept";
import type {
  ConceptPrimitiveKind,
  ConceptRecord,
  ConceptsFromTableOptions,
} from "../../src/concept";
import { Table, TableError } from "../../src/table";

function providerConceptsTable() {
  return Table.define({
    id: "providerConcepts",
    columns: {
      concept: ["displayName", "slug", "timeZoneId", "contactEmail", "description"] as const,
      type: ["string", "string", "string", "string", "string"] as const,
      label: [
        "Provider name",
        "Public slug",
        "Timezone",
        "Contact email",
        "Short public description",
      ] as const,
      required: [true, true, true, false, false] as const,
      description: [
        undefined,
        "Public URL-safe identifier.",
        undefined,
        undefined,
        undefined,
      ] as const,
      diagnosticLabel: [
        "provider name",
        "provider slug",
        "timezone",
        "contact email",
        "description",
      ] as const,
      controlHint: ["input", "input", "input", "input", "textarea"] as const,
      valuePath: [
        "draft.provider.displayName",
        "draft.provider.slug",
        "draft.provider.timeZoneId",
        "draft.provider.contactEmail",
        "draft.provider.description",
      ] as const,
      changeKey: ["displayName", "slug", "timeZoneId", "contactEmail", "description"] as const,
      enumValues: [undefined, undefined, undefined, undefined, undefined] as const,
      literalValue: [undefined, undefined, undefined, undefined, undefined] as const,
      placeholder: [undefined, undefined, undefined, undefined, undefined] as const,
      testId: [
        "setup-provider-name",
        "setup-provider-slug",
        "setup-provider-timezone",
        "setup-provider-email",
        "setup-provider-description",
      ] as const,
    },
  });
}

describe("concept tables", () => {
  it("T.conceptTableSchema returns a table schema", () => {
    expect(T.conceptTableSchema()).toEqual({
      kind: "tableSchema",
      columns: {
        concept: { kind: "string" },
        type: {
          kind: "enum",
          values: ["string", "number", "boolean", "enum", "literal", "unknown"],
        },
        label: { kind: "string" },
        required: { kind: "boolean" },
        description: { kind: "string", optional: true },
        diagnosticLabel: { kind: "string", optional: true },
        controlHint: { kind: "string", optional: true },
        valuePath: { kind: "string", optional: true },
        changeKey: { kind: "string", optional: true },
        enumValues: { kind: "unknown", optional: true },
        literalValue: { kind: "unknown", optional: true },
        placeholder: { kind: "string", optional: true },
        testId: { kind: "string", optional: true },
      },
    });
  });

  it("T.conceptsFromTable lowers a columnar table to concept records", () => {
    expect(T.conceptsFromTable(providerConceptsTable())).toEqual([
      {
        kind: "conceptRecord",
        concept: "displayName",
        type: "string",
        label: "Provider name",
        required: true,
        diagnosticLabel: "provider name",
        controlHint: "input",
        valuePath: "draft.provider.displayName",
        changeKey: "displayName",
        testId: "setup-provider-name",
      },
      {
        kind: "conceptRecord",
        concept: "slug",
        type: "string",
        label: "Public slug",
        required: true,
        description: "Public URL-safe identifier.",
        diagnosticLabel: "provider slug",
        controlHint: "input",
        valuePath: "draft.provider.slug",
        changeKey: "slug",
        testId: "setup-provider-slug",
      },
      {
        kind: "conceptRecord",
        concept: "timeZoneId",
        type: "string",
        label: "Timezone",
        required: true,
        diagnosticLabel: "timezone",
        controlHint: "input",
        valuePath: "draft.provider.timeZoneId",
        changeKey: "timeZoneId",
        testId: "setup-provider-timezone",
      },
      {
        kind: "conceptRecord",
        concept: "contactEmail",
        type: "string",
        label: "Contact email",
        required: false,
        diagnosticLabel: "contact email",
        controlHint: "input",
        valuePath: "draft.provider.contactEmail",
        changeKey: "contactEmail",
        testId: "setup-provider-email",
      },
      {
        kind: "conceptRecord",
        concept: "description",
        type: "string",
        label: "Short public description",
        required: false,
        diagnosticLabel: "description",
        controlHint: "textarea",
        valuePath: "draft.provider.description",
        changeKey: "description",
        testId: "setup-provider-description",
      },
    ]);
  });

  it("works with schema tables", () => {
    const authored = Table.defineWithSchema({
      id: "providerConcepts",
      schema: T.conceptTableSchema(),
      columns: providerConceptsTable().columns,
    });

    const concepts = T.conceptsFromTable(authored);
    expect(concepts[0]?.concept).toBe("displayName");
  });

  it("preserves row order", () => {
    const concepts = T.conceptsFromTable(providerConceptsTable());
    expect(concepts.map((concept) => concept.concept)).toEqual([
      "displayName",
      "slug",
      "timeZoneId",
      "contactEmail",
      "description",
    ]);
  });

  it("supports string number boolean and unknown concepts", () => {
    const concepts = T.conceptsFromTable(
      Table.define({
        id: "primitiveConcepts",
        columns: {
          concept: ["title", "capacity", "published", "opaqueBlob"],
          type: ["string", "number", "boolean", "unknown"],
          label: ["Title", "Capacity", "Published", "Opaque blob"],
          required: [true, false, true, false],
        },
      }),
    );

    expect(concepts.map((concept) => concept.type)).toEqual([
      "string",
      "number",
      "boolean",
      "unknown",
    ]);
  });

  it("supports enum with enumValues", () => {
    const [status] = T.conceptsFromTable(
      Table.define({
        id: "statusConcepts",
        columns: {
          concept: ["status"],
          type: ["enum"],
          label: ["Status"],
          required: [true],
          enumValues: [["draft", "published", "archived"]],
        },
      }),
    );

    expect(status).toEqual({
      kind: "conceptRecord",
      concept: "status",
      type: "enum",
      label: "Status",
      required: true,
      enumValues: ["draft", "published", "archived"],
    });
  });

  it("supports literal with literalValue", () => {
    const [shape] = T.conceptsFromTable(
      Table.define({
        id: "shapeConcepts",
        columns: {
          concept: ["shapeKind"],
          type: ["literal"],
          label: ["Shape kind"],
          required: [true],
          literalValue: ["provider"],
        },
      }),
    );

    expect(shape).toEqual({
      kind: "conceptRecord",
      concept: "shapeKind",
      type: "literal",
      label: "Shape kind",
      required: true,
      literalValue: "provider",
    });
  });

  it("optional metadata fields flow through", () => {
    const [first] = T.conceptsFromTable(
      Table.define({
        id: "metadataConcepts",
        columns: {
          concept: ["notes"],
          type: ["string"],
          label: ["Notes"],
          required: [false],
          description: ["Visible helper copy"],
          diagnosticLabel: ["notes"],
          controlHint: ["textarea"],
          valuePath: ["draft.notes"],
          changeKey: ["notes"],
          placeholder: ["Type notes"],
          testId: ["notes-field"],
        },
      }),
    );

    expect(first).toEqual({
      kind: "conceptRecord",
      concept: "notes",
      type: "string",
      label: "Notes",
      required: false,
      description: "Visible helper copy",
      diagnosticLabel: "notes",
      controlHint: "textarea",
      valuePath: "draft.notes",
      changeKey: "notes",
      placeholder: "Type notes",
      testId: "notes-field",
    });
  });

  it("T.describeConcepts returns count requiredCount and distinct types", () => {
    expect(
      T.describeConcepts(
        [
          {
            kind: "conceptRecord",
            concept: "title",
            type: "string",
            label: "Title",
            required: true,
          },
          {
            kind: "conceptRecord",
            concept: "status",
            type: "enum",
            label: "Status",
            required: false,
            enumValues: ["draft", "live"],
          },
          {
            kind: "conceptRecord",
            concept: "slug",
            type: "string",
            label: "Slug",
            required: true,
          },
        ],
        "providerConcepts",
      ),
    ).toEqual({
      kind: "conceptTableDescription",
      tableId: "providerConcepts",
      conceptCount: 3,
      requiredCount: 2,
      types: ["string", "enum"],
    });
  });

  it("missing required concept column reports MissingConceptColumn", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          type: ["string"],
          label: ["Provider name"],
          required: [true],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingConceptColumn",
        tableId: "providerConcepts",
        column: "concept",
        path: "providerConcepts.concept",
      }),
    );
  });

  it("invalid concept id reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          concept: ["", "slug", "timeZoneId", "contactEmail", "description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptId",
        column: "concept",
        row: 0,
        path: "providerConcepts.concept[0]",
      }),
    );
  });

  it("invalid type reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          type: ["string", "select", "string", "string", "string"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptType",
        column: "type",
        row: 1,
      }),
    );
  });

  it("invalid label reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          label: ["Provider name", "", "Timezone", "Contact email", "Short public description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptLabel",
        column: "label",
        row: 1,
      }),
    );
  });

  it("invalid required reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          required: [true, "yes", true, false, false],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptRequired",
        column: "required",
        row: 1,
      }),
    );
  });

  it("invalid optional metadata reports diagnostics", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          description: [7, undefined, undefined, undefined, undefined],
          diagnosticLabel: [undefined, false, "timezone", "contact email", "description"],
          controlHint: ["input", "input", {}, "input", "textarea"],
          valuePath: [
            "draft.provider.displayName",
            "draft.provider.slug",
            17,
            "draft.provider.contactEmail",
            "draft.provider.description",
          ],
          changeKey: ["displayName", "slug", "timeZoneId", null, "description"],
          placeholder: [undefined, undefined, undefined, [], undefined],
          testId: [
            "setup-provider-name",
            "setup-provider-slug",
            {},
            "setup-provider-email",
            "setup-provider-description",
          ],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidConceptDescription",
          column: "description",
          row: 0,
        }),
        expect.objectContaining({
          code: "InvalidConceptDiagnosticLabel",
          column: "diagnosticLabel",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidConceptControlHint",
          column: "controlHint",
          row: 2,
        }),
        expect.objectContaining({ code: "InvalidConceptValuePath", column: "valuePath", row: 2 }),
        expect.objectContaining({ code: "InvalidConceptChangeKey", column: "changeKey", row: 3 }),
        expect.objectContaining({
          code: "InvalidConceptPlaceholder",
          column: "placeholder",
          row: 3,
        }),
        expect.objectContaining({ code: "InvalidConceptTestId", column: "testId", row: 2 }),
      ]),
    );
  });

  it("duplicate concept reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          concept: ["displayName", "slug", "slug", "contactEmail", "description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConcept",
        column: "concept",
        row: 2,
        message: 'Concept "slug" already appears at row 1.',
      }),
    );
  });

  it("enum concept missing enumValues reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["status"],
          type: ["enum"],
          label: ["Status"],
          required: [true],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingConceptEnumValues",
        column: "enumValues",
        row: 0,
      }),
    );
  });

  it("enum concept with invalid enumValues reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["status"],
          type: ["enum"],
          label: ["Status"],
          required: [true],
          enumValues: [[{}, "live"]],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptEnumValues",
        column: "enumValues",
        row: 0,
      }),
    );
  });

  it("non-enum concept with enumValues reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["title"],
          type: ["string"],
          label: ["Title"],
          required: [true],
          enumValues: [["draft", "live"]],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UnexpectedConceptEnumValues",
        column: "enumValues",
        row: 0,
      }),
    );
  });

  it("literal concept missing literalValue reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["kind"],
          type: ["literal"],
          label: ["Kind"],
          required: [true],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingConceptLiteralValue",
        column: "literalValue",
        row: 0,
      }),
    );
  });

  it("literal concept with invalid literalValue reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["kind"],
          type: ["literal"],
          label: ["Kind"],
          required: [true],
          literalValue: [[1, 2]],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptLiteralValue",
        column: "literalValue",
        row: 0,
      }),
    );
  });

  it("non-literal concept with literalValue reports diagnostic", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          concept: ["title"],
          type: ["string"],
          label: ["Title"],
          required: [true],
          literalValue: ["provider"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UnexpectedConceptLiteralValue",
        column: "literalValue",
        row: 0,
      }),
    );
  });

  it("diagnostics include table id column row and path", () => {
    const diagnostics = T.validateConceptTable(
      Table.define({
        id: "providerConcepts",
        columns: {
          ...providerConceptsTable().columns,
          type: ["string", "string", "invalid", "string", "string"],
        },
      }),
    );

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "InvalidConceptType",
      message: "Concept type must be one of string, number, boolean, enum, literal, unknown.",
      tableId: "providerConcepts",
      column: "type",
      row: 2,
      path: "providerConcepts.type[2]",
    });
  });

  it("T.conceptsFromTable throws TableError on invalid table", () => {
    expect(() =>
      T.conceptsFromTable(
        Table.define({
          id: "providerConcepts",
          columns: {
            ...providerConceptsTable().columns,
            type: ["string", "string", "bad", "string", "string"],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("T.validateConceptTable returns diagnostics without throwing", () => {
    expect(() =>
      T.validateConceptTable(
        Table.define({
          id: "providerConcepts",
          columns: {
            ...providerConceptsTable().columns,
            concept: ["displayName", "", "timeZoneId", "contactEmail", "description"],
          },
        }),
      ),
    ).not.toThrow();
  });
});

describe("concept table exports and typing", () => {
  it("exports concept table helpers from the concept subpath", () => {
    expect(T.conceptTableSchema).toBeTypeOf("function");
    expect(T.conceptsFromTable).toBeTypeOf("function");
    expect(T.validateConceptTable).toBeTypeOf("function");
    expect(T.describeConcepts).toBeTypeOf("function");
    expect("T" in root).toBe(false);
  });

  it("exports named helpers", () => {
    expect(conceptTableSchema).toBeTypeOf("function");
    expect(conceptsFromTable).toBeTypeOf("function");
    expect(validateConceptTable).toBeTypeOf("function");
    expect(describeConcepts).toBeTypeOf("function");
  });

  it("ConceptRecord has expected primitive kind union", () => {
    const options: ConceptsFromTableOptions = {
      conceptColumn: "concept",
      typeColumn: "type",
    };
    const primitiveKind: ConceptPrimitiveKind = "enum";
    const record: ConceptRecord = {
      kind: "conceptRecord",
      concept: "status",
      type: primitiveKind,
      label: "Status",
      required: true,
      enumValues: ["draft", "live"],
    };
    void options;

    // biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
    if (false) {
      const stillNarrow: ConceptPrimitiveKind = "literal";
      void stillNarrow;
      // @ts-expect-error concept primitive kinds must stay narrow
      const nope: ConceptPrimitiveKind = "object";
      void nope;
    }

    expect(record.type).toBe("enum");
  });
});
