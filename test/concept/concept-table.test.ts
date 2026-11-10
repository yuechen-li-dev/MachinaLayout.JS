import { describe, expect, it } from "vitest";
import type { ConceptFromTableOptions, ConceptPrimitiveKind } from "../../src/concept";
import {
  acceptsValue,
  conceptFromTable,
  conceptRefines,
  conceptTableSchema,
  T,
  validateConceptTable,
} from "../../src/concept";
import * as root from "../../src/index";
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

  it("T.conceptFromTable lowers a columnar table to one concept definition", () => {
    const concept = T.conceptFromTable(providerConceptsTable());
    expect(concept.kind).toBe("concept");
    expect(concept.id).toBe("providerConcepts");
    expect(concept.fields.displayName).toEqual({
      kind: "string",
      label: "Provider name",
      diagnosticLabel: "provider name",
      controlHint: "input",
      valuePath: "draft.provider.displayName",
      changeKey: "displayName",
      testId: "setup-provider-name",
    });
    expect(concept.fields.contactEmail).toMatchObject({ kind: "string", optional: true });
    expect(concept.fields.slug).toMatchObject({ description: "Public URL-safe identifier." });
  });

  it("lowered concepts validate values like authored ones", () => {
    const concept = T.conceptFromTable(providerConceptsTable());
    expect(T.validate(concept, { displayName: "Acme", slug: "acme", timeZoneId: "UTC" })).toEqual(
      [],
    );
    expect(T.validate(concept, { displayName: "Acme", slug: 3 }).map((d) => d.code)).toEqual([
      "InvalidConceptFieldType",
      "MissingConceptField",
    ]);
  });

  it("accepts id, description, and closed options", () => {
    const concept = T.conceptFromTable(providerConceptsTable(), {
      id: "Provider",
      description: "Provider setup form.",
      closed: true,
    });
    expect(concept).toMatchObject({
      id: "Provider",
      description: "Provider setup form.",
      closed: true,
    });
  });

  it("works with schema-authored tables", () => {
    const authored = Table.defineWithSchema({
      id: "providerConcepts",
      schema: T.conceptTableSchema(),
      columns: providerConceptsTable().columns,
    });

    expect(Object.keys(T.conceptFromTable(authored).fields)[0]).toBe("displayName");
  });

  it("preserves row order as field order", () => {
    const concept = T.conceptFromTable(providerConceptsTable());
    expect(T.fieldsOf(concept).map((field) => field.name)).toEqual([
      "displayName",
      "slug",
      "timeZoneId",
      "contactEmail",
      "description",
    ]);
  });

  it("supports string number boolean and unknown concepts", () => {
    const concept = T.conceptFromTable(
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

    expect(T.fieldsOf(concept).map((field) => [field.name, field.required])).toEqual([
      ["title", true],
      ["capacity", false],
      ["published", true],
      ["opaqueBlob", false],
    ]);
    expect(Object.values(concept.fields).map((field) => (field as { kind: string }).kind)).toEqual([
      "string",
      "number",
      "boolean",
      "unknown",
    ]);
    expect(T.validate(concept, { title: "t", published: true, opaqueBlob: [1] })).toEqual([]);
  });

  it("supports enum with enumValues", () => {
    const concept = T.conceptFromTable(
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

    expect(concept.fields.status).toEqual({
      kind: "enum",
      values: ["draft", "published", "archived"],
      label: "Status",
    });
    expect(T.validate(concept, { status: "publshed" })[0]?.fix).toEqual({
      op: "replace",
      path: "status",
      expected: '"published"',
    });
  });

  it("supports literal with literalValue", () => {
    const concept = T.conceptFromTable(
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

    expect(concept.fields.shapeKind).toEqual({
      kind: "literal",
      value: "provider",
      label: "Shape kind",
    });
  });

  it("optional metadata fields flow through as field metadata", () => {
    const concept = T.conceptFromTable(
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

    expect(T.fieldsOf(concept)).toEqual([
      {
        name: "notes",
        concept: "metadataConcepts",
        constraint: concept.fields.notes,
        required: false,
        meta: {
          label: "Notes",
          description: "Visible helper copy",
          diagnosticLabel: "notes",
          controlHint: "textarea",
          valuePath: "draft.notes",
          changeKey: "notes",
          placeholder: "Type notes",
          testId: "notes-field",
        },
      },
    ]);
  });

  it("metadata does not affect refinement", () => {
    const lowered = T.conceptFromTable(providerConceptsTable());
    const authored = T.concept({
      id: "Authored",
      fields: {
        displayName: T.string(),
        slug: T.string(),
        timeZoneId: T.string(),
        contactEmail: T.optional(T.string()),
        description: T.optional(T.string()),
      },
    });
    expect(conceptRefines(lowered, authored, acceptsValue)).toBe(true);
    expect(conceptRefines(authored, lowered, acceptsValue)).toBe(true);
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

  it("T.conceptFromTable throws TableError on invalid table", () => {
    expect(() =>
      T.conceptFromTable(
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
    expect(T.conceptFromTable).toBeTypeOf("function");
    expect(T.validateConceptTable).toBeTypeOf("function");
    expect("T" in root).toBe(false);
  });

  it("exports named helpers", () => {
    expect(conceptTableSchema).toBeTypeOf("function");
    expect(conceptFromTable).toBeTypeOf("function");
    expect(validateConceptTable).toBeTypeOf("function");
  });

  it("table type vocabulary stays narrow", () => {
    const options: ConceptFromTableOptions = {
      conceptColumn: "concept",
      typeColumn: "type",
    };
    const primitiveKind: ConceptPrimitiveKind = "enum";
    void options;

    // biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
    if (false) {
      const stillNarrow: ConceptPrimitiveKind = "literal";
      void stillNarrow;
      // @ts-expect-error concept primitive kinds must stay narrow
      const nope: ConceptPrimitiveKind = "object";
      void nope;
    }

    expect(primitiveKind).toBe("enum");
  });
});
