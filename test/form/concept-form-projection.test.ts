import { describe, expect, it } from "vitest";
import { T } from "../../src/concept";
import {
  type ConceptFormDisabledResolver,
  type ConceptFormProjectionOptions,
  type ConceptFormValueMap,
  Form,
  fieldsFromConcept,
  fieldsFromConceptTable,
  validateConceptFormProjection,
} from "../../src/form";
import { Table, TableError } from "../../src/table";

const displayName = T.string({
  label: "Provider name",
  description: "Visible to patients.",
  placeholder: "Acme Care",
  testId: "provider-name-field",
});
const slug = T.string({ label: "Public slug", changeKey: "providerSlug" });
const description = T.optional(
  T.string({ label: "Short public description", controlHint: "textarea" }),
);

function providerConcepts() {
  return T.concept({ id: "Provider", fields: { displayName, slug, description } });
}

function conceptWith(fields: Parameters<typeof T.concept>[0]["fields"]) {
  return T.concept({ id: "Probe", fields });
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
  it("Form.fieldsFromConcept projects concepts to field records", () => {
    expect(Form.fieldsFromConcept(providerConcepts())).toEqual([
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
    expect(Form.fieldsFromConcept(providerConcepts()).map((field) => field.field)).toEqual([
      "displayName",
      "slug",
      "description",
    ]);
  });

  it("field equals the concept field name", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.field).toBe("displayName");
  });

  it("label equals the concept label", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.label).toBe("Provider name");
  });

  it("required flows through", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.required).toBe(true);
  });

  it("description flows through", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.description).toBe("Visible to patients.");
  });

  it("placeholder flows through", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.placeholder).toBe("Acme Care");
  });

  it("testId flows through from concept", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.testId).toBe("provider-name-field");
  });

  it("changeKey uses concept.changeKey when present", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[1]?.changeKey).toBe("providerSlug");
  });

  it("changeKey falls back to concept id", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[0]?.changeKey).toBe("displayName");
  });

  it("values map supplies values by field name", () => {
    const values: ConceptFormValueMap = {
      displayName: "Acme Care",
      slug: "acme-care",
    };

    expect(Form.fieldsFromConcept(providerConcepts(), { values })[1]?.value).toBe("acme-care");
  });

  it("valueForConcept overrides the values map", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), {
      values: { slug: "acme-care" },
      valueForConcept: (concept) => (concept.name === "slug" ? "override" : undefined),
    });

    expect(fields[1]?.value).toBe("override");
  });

  it("disabled boolean applies to all fields", () => {
    expect(
      Form.fieldsFromConcept(providerConcepts(), { disabled: true }).every(
        (field) => field.disabled,
      ),
    ).toBe(true);
  });

  it("disabled function applies per concept", () => {
    const disabled: ConceptFormDisabledResolver = (concept) => concept.name === "slug";
    const fields = Form.fieldsFromConcept(providerConcepts(), { disabled });
    expect(fields.map((field) => field.disabled)).toEqual([false, true, false]);
  });

  it("disabledForConcept overrides disabled", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), {
      disabled: true,
      disabledForConcept: (concept) => concept.name === "description",
    });

    expect(fields.map((field) => field.disabled)).toEqual([false, false, true]);
  });

  it('controlHint "textarea" maps to textarea', () => {
    expect(Form.fieldsFromConcept(providerConcepts())[2]?.control).toBe("textarea");
  });

  it("default control is input", () => {
    expect(Form.fieldsFromConcept(providerConcepts())[1]?.control).toBe("input");
  });

  it("defaultControl option works", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), { defaultControl: "textarea" });
    expect(fields[1]?.control).toBe("textarea");
  });

  it("controlForConcept overrides controlHint", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), {
      controlForConcept: (concept) => (concept.name === "description" ? "input" : undefined),
    });

    expect(fields[2]?.control).toBe("input");
  });

  it("inputIdPrefix generates deterministic ids", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), {
      inputIdPrefix: "setup-provider",
    });

    expect(fields.map((field) => field.inputId)).toEqual([
      "setup-provider-displayName",
      "setup-provider-slug",
      "setup-provider-description",
    ]);
  });

  it("testIdPrefix generates test ids when concept testId is absent", () => {
    const fields = Form.fieldsFromConcept(providerConcepts(), {
      testIdPrefix: "setup-provider",
    });

    expect(fields.map((field) => field.testId)).toEqual([
      "provider-name-field",
      "setup-provider-slug",
      "setup-provider-description",
    ]);
  });

  it("unsupported controlHint reports InvalidConceptFormControl", () => {
    const diagnostics = Form.validateConceptFormProjection(
      conceptWith({ displayName: { ...displayName, controlHint: "select" } }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidConceptFormControl",
        row: 0,
        path: "fields.displayName.controlHint",
      }),
    );
  });

  it("nested, array, and union fields report UnsupportedConceptFormField", () => {
    const diagnostics = Form.validateConceptFormProjection(
      conceptWith({
        name: T.string(),
        address: T.concept({ id: "Address", fields: { city: T.string() } }),
        tags: T.array(T.string()),
      }),
    );

    expect(diagnostics.map((d) => [d.code, d.path])).toEqual([
      ["UnsupportedConceptFormField", "fields.address.type"],
      ["UnsupportedConceptFormField", "fields.tags.type"],
    ]);
  });

  it("projects code-authored concepts, defaulting label to the field name", () => {
    const fields = Form.fieldsFromConcept(
      T.concept({
        id: "Login",
        fields: { email: T.string({ nonEmpty: true }), remember: T.optional(T.boolean()) },
      }),
    );

    expect(fields.map((field) => [field.field, field.label, field.required])).toEqual([
      ["email", "email", true],
      ["remember", "remember", false],
    ]);
  });

  it("T.meta attaches labels to constraints without options", () => {
    const fields = Form.fieldsFromConcept(
      conceptWith({
        status: T.meta(T.oneOf("draft", "live"), { label: "Status", controlHint: "input" }),
      }),
    );
    expect(fields[0]).toMatchObject({ field: "status", label: "Status", control: "input" });
  });

  it("empty label reports InvalidConceptLabel", () => {
    expect(
      Form.validateConceptFormProjection(conceptWith({ name: T.string({ label: " " }) })),
    ).toContainEqual(
      expect.objectContaining({ code: "InvalidConceptLabel", path: "fields.name.label" }),
    );
  });

  it("duplicate inputId reports DuplicateConceptFormInputId", () => {
    const diagnostics = Form.validateConceptFormProjection(
      conceptWith({ "Display Name": displayName, "Display-Name": slug }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConceptFormInputId",
        row: 1,
        path: "fields.Display-Name.inputId",
      }),
    );
  });

  it("duplicate testId reports DuplicateConceptFormTestId", () => {
    const diagnostics = Form.validateConceptFormProjection(
      conceptWith({
        displayName: { ...displayName, testId: "duplicate-id" },
        slug: { ...slug, testId: "duplicate-id" },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateConceptFormTestId",
        row: 1,
        path: "fields.slug.testId",
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
        path: "fields.displayName.value",
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
        path: "fields.displayName.disabled",
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
        path: "fields.displayName.control",
      }),
    );
  });

  it("validateConceptFormProjection returns diagnostics without throwing", () => {
    expect(() =>
      validateConceptFormProjection(
        conceptWith({ displayName: { ...displayName, controlHint: "select" } }),
      ),
    ).not.toThrow();
  });

  it("fieldsFromConcept throws on error diagnostics", () => {
    expect(() =>
      fieldsFromConcept(conceptWith({ displayName: { ...displayName, controlHint: "select" } })),
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
    expect(Form.fieldsFromConcept).toBe(fieldsFromConcept);
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
