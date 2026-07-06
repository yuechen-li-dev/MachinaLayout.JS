import { describe, expect, it } from "vitest";
import {
  type ConceptFormDisabledResolver,
  type ConceptFormProjectionOptions,
  type ConceptFormValueMap,
  Form,
  fieldsFromConceptTable,
  fieldsFromConcepts,
  validateConceptFormProjection,
} from "../../src/form";
import type { ConceptRecord } from "../../src/concept";
import { T } from "../../src/concept";
import { Table, TableError } from "../../src/table";

function providerConcepts(): readonly ConceptRecord[] {
  return [
    {
      kind: "conceptRecord",
      concept: "displayName",
      type: "string",
      label: "Provider name",
      required: true,
      description: "Visible to patients.",
      placeholder: "Acme Care",
      testId: "provider-name-field",
    },
    {
      kind: "conceptRecord",
      concept: "slug",
      type: "string",
      label: "Public slug",
      required: true,
      changeKey: "providerSlug",
    },
    {
      kind: "conceptRecord",
      concept: "description",
      type: "string",
      label: "Short public description",
      required: false,
      controlHint: "textarea",
    },
  ];
}

function providerConceptsTable() {
  return Table.defineWithSchema({
    id: "providerConcepts",
    schema: T.conceptTableSchema(),
    columns: {
      concept: ["displayName", "slug", "description"] as const,
      type: ["string", "string", "string"] as const,
      label: ["Provider name", "Public slug", "Short public description"] as const,
      required: [true, true, false] as const,
      description: ["Visible to patients.", undefined, undefined] as const,
      diagnosticLabel: [undefined, undefined, undefined] as const,
      controlHint: [undefined, undefined, "textarea"] as const,
      valuePath: [undefined, undefined, undefined] as const,
      changeKey: [undefined, "providerSlug", undefined] as const,
      enumValues: [undefined, undefined, undefined] as const,
      literalValue: [undefined, undefined, undefined] as const,
      placeholder: ["Acme Care", undefined, undefined] as const,
      testId: ["provider-name-field", undefined, undefined] as const,
    },
  });
}

describe("concept form projection", () => {
  it("Form.fieldsFromConcepts projects concepts to field records", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())).toEqual([
      {
        kind: "formField",
        field: "displayName",
        label: "Provider name",
        control: "input",
        inputId: "field-displayName",
        value: undefined,
        changeKey: "displayName",
        disabled: false,
        placeholder: "Acme Care",
        description: "Visible to patients.",
        required: true,
        testId: "provider-name-field",
      },
      {
        kind: "formField",
        field: "slug",
        label: "Public slug",
        control: "input",
        inputId: "field-slug",
        value: undefined,
        changeKey: "providerSlug",
        disabled: false,
        required: true,
      },
      {
        kind: "formField",
        field: "description",
        label: "Short public description",
        control: "textarea",
        inputId: "field-description",
        value: undefined,
        changeKey: "description",
        disabled: false,
        required: false,
      },
    ]);
  });

  it("preserves concept order", () => {
    expect(Form.fieldsFromConcepts(providerConcepts()).map((field) => field.field)).toEqual([
      "displayName",
      "slug",
      "description",
    ]);
  });

  it("field equals the concept id", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.field).toBe("displayName");
  });

  it("label equals the concept label", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.label).toBe("Provider name");
  });

  it("required flows through", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.required).toBe(true);
  });

  it("description flows through", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.description).toBe(
      "Visible to patients.",
    );
  });

  it("placeholder flows through", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.placeholder).toBe("Acme Care");
  });

  it("testId flows through from concept", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.testId).toBe("provider-name-field");
  });

  it("changeKey uses concept.changeKey when present", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[1]?.changeKey).toBe("providerSlug");
  });

  it("changeKey falls back to concept id", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[0]?.changeKey).toBe("displayName");
  });

  it("values map supplies values by concept id", () => {
    const values: ConceptFormValueMap = {
      displayName: "Acme Care",
      slug: "acme-care",
    };

    expect(Form.fieldsFromConcepts(providerConcepts(), { values })[1]?.value).toBe("acme-care");
  });

  it("valueForConcept overrides the values map", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), {
      values: { slug: "acme-care" },
      valueForConcept: (concept) => (concept.concept === "slug" ? "override" : undefined),
    });

    expect(fields[1]?.value).toBe("override");
  });

  it("disabled boolean applies to all fields", () => {
    expect(
      Form.fieldsFromConcepts(providerConcepts(), { disabled: true }).every(
        (field) => field.disabled,
      ),
    ).toBe(true);
  });

  it("disabled function applies per concept", () => {
    const disabled: ConceptFormDisabledResolver = (concept) => concept.concept === "slug";
    const fields = Form.fieldsFromConcepts(providerConcepts(), { disabled });
    expect(fields.map((field) => field.disabled)).toEqual([false, true, false]);
  });

  it("disabledForConcept overrides disabled", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), {
      disabled: true,
      disabledForConcept: (concept) => concept.concept === "description",
    });

    expect(fields.map((field) => field.disabled)).toEqual([false, false, true]);
  });

  it('controlHint "textarea" maps to textarea', () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[2]?.control).toBe("textarea");
  });

  it("default control is input", () => {
    expect(Form.fieldsFromConcepts(providerConcepts())[1]?.control).toBe("input");
  });

  it("defaultControl option works", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), { defaultControl: "textarea" });
    expect(fields[1]?.control).toBe("textarea");
  });

  it("controlForConcept overrides controlHint", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), {
      controlForConcept: (concept) => (concept.concept === "description" ? "input" : undefined),
    });

    expect(fields[2]?.control).toBe("input");
  });

  it("inputIdPrefix generates deterministic ids", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), {
      inputIdPrefix: "setup-provider",
    });

    expect(fields.map((field) => field.inputId)).toEqual([
      "setup-provider-displayName",
      "setup-provider-slug",
      "setup-provider-description",
    ]);
  });

  it("testIdPrefix generates test ids when concept testId is absent", () => {
    const fields = Form.fieldsFromConcepts(providerConcepts(), {
      testIdPrefix: "setup-provider",
    });

    expect(fields.map((field) => field.testId)).toEqual([
      "provider-name-field",
      "setup-provider-slug",
      "setup-provider-description",
    ]);
  });

  it("unsupported controlHint reports InvalidConceptFormControl", () => {
    const diagnostics = Form.validateConceptFormProjection([
      {
        ...providerConcepts()[0],
        controlHint: "select",
      },
    ]);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptFormControl",
        row: 0,
        path: "concepts[0].controlHint",
      }),
    );
  });

  it("duplicate field reports DuplicateConceptFormField", () => {
    const diagnostics = Form.validateConceptFormProjection([
      providerConcepts()[0]!,
      {
        ...providerConcepts()[1]!,
        concept: "displayName",
      },
    ]);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConceptFormField",
        row: 1,
        path: "concepts[1].concept",
      }),
    );
  });

  it("duplicate inputId reports DuplicateConceptFormInputId", () => {
    const diagnostics = Form.validateConceptFormProjection([
      {
        ...providerConcepts()[0]!,
        concept: "Display Name",
      },
      {
        ...providerConcepts()[1]!,
        concept: "Display-Name",
      },
    ]);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConceptFormInputId",
        row: 1,
        path: "concepts[1].inputId",
      }),
    );
  });

  it("duplicate testId reports DuplicateConceptFormTestId", () => {
    const diagnostics = Form.validateConceptFormProjection([
      {
        ...providerConcepts()[0]!,
        testId: "duplicate-id",
      },
      {
        ...providerConcepts()[1]!,
        testId: "duplicate-id",
      },
    ]);

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConceptFormTestId",
        row: 1,
        path: "concepts[1].testId",
      }),
    );
  });

  it("value resolver throw reports ConceptFormValueResolverError", () => {
    const diagnostics = Form.validateConceptFormProjection(providerConcepts(), {
      valueForConcept: () => {
        throw new Error("value failed");
      },
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ConceptFormValueResolverError",
        row: 0,
        path: "concepts[0].value",
      }),
    );
  });

  it("disabled resolver throw reports ConceptFormDisabledResolverError", () => {
    const diagnostics = Form.validateConceptFormProjection(providerConcepts(), {
      disabled: () => {
        throw new Error("disabled failed");
      },
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ConceptFormDisabledResolverError",
        row: 0,
        path: "concepts[0].disabled",
      }),
    );
  });

  it("control resolver throw reports ConceptFormControlResolverError", () => {
    const diagnostics = Form.validateConceptFormProjection(providerConcepts(), {
      controlForConcept: () => {
        throw new Error("control failed");
      },
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "ConceptFormControlResolverError",
        row: 0,
        path: "concepts[0].control",
      }),
    );
  });

  it("validateConceptFormProjection returns diagnostics without throwing", () => {
    expect(() =>
      validateConceptFormProjection([
        {
          ...providerConcepts()[0]!,
          controlHint: "select",
        },
      ]),
    ).not.toThrow();
  });

  it("fieldsFromConcepts throws on error diagnostics", () => {
    expect(() =>
      fieldsFromConcepts([
        {
          ...providerConcepts()[0]!,
          controlHint: "select",
        },
      ]),
    ).toThrow(TableError);
  });

  it("Form.fieldsFromConceptTable composes concept lowering and projection", () => {
    expect(
      Form.fieldsFromConceptTable(providerConceptsTable(), {
        projection: {
          values: {
            displayName: "Acme Care",
            slug: "acme-care",
          },
          inputIdPrefix: "setup-provider",
        },
      }),
    ).toEqual([
      {
        kind: "formField",
        field: "displayName",
        label: "Provider name",
        control: "input",
        inputId: "setup-provider-displayName",
        value: "Acme Care",
        changeKey: "displayName",
        disabled: false,
        placeholder: "Acme Care",
        description: "Visible to patients.",
        required: true,
        testId: "provider-name-field",
      },
      {
        kind: "formField",
        field: "slug",
        label: "Public slug",
        control: "input",
        inputId: "setup-provider-slug",
        value: "acme-care",
        changeKey: "providerSlug",
        disabled: false,
        required: true,
      },
      {
        kind: "formField",
        field: "description",
        label: "Short public description",
        control: "textarea",
        inputId: "setup-provider-description",
        value: undefined,
        changeKey: "description",
        disabled: false,
        required: false,
      },
    ]);
  });

  it("invalid concept table still throws with concept diagnostics", () => {
    expect(() =>
      fieldsFromConceptTable(
        Table.define({
          id: "badConcepts",
          columns: {
            concept: ["displayName"],
            type: ["bad"],
            label: ["Provider name"],
            required: [true],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("projection diagnostics still work through fieldsFromConceptTable", () => {
    expect(() =>
      Form.fieldsFromConceptTable(providerConceptsTable(), {
        projection: {
          controlForConcept: () => "select" as unknown as "input",
        },
      }),
    ).toThrow(TableError);
  });

  it("exports the new projection helpers from the form subpath", () => {
    expect(Form.fieldsFromConcepts).toBe(fieldsFromConcepts);
    expect(Form.validateConceptFormProjection).toBe(validateConceptFormProjection);
    expect(Form.fieldsFromConceptTable).toBe(fieldsFromConceptTable);
  });

  it("exports the new option types", () => {
    const options: ConceptFormProjectionOptions = {
      values: { displayName: "Acme Care" },
      disabled: false,
      inputIdPrefix: "setup-provider",
      defaultControl: "input",
      testIdPrefix: "setup-provider",
    };
    void options;
    expect(true).toBe(true);
  });
});
