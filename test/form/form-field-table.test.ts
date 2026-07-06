import { describe, expect, it } from "vitest";
import * as root from "../../src/index";
import {
  Form,
  describeFields,
  fieldSchema,
  fieldsFromTable,
  validateFieldTable,
  type FormFieldControl,
  type FormFieldRecord,
} from "../../src/form";
import { Table, TableError } from "../../src/table";

function providerFieldsTable() {
  return Table.define({
    id: "providerFields",
    columns: {
      field: ["displayName", "slug", "description"] as const,
      label: ["Provider name", "Public slug", "Short public description"] as const,
      control: ["input", "input", "textarea"] as const,
      inputId: [
        "setup-provider-name",
        "setup-provider-slug",
        "setup-provider-description",
      ] as const,
      value: ["Acme Care", "acme-care", "Friendly neighborhood care"] as const,
      changeKey: ["displayName", "slug", "description"] as const,
      disabled: [false, true, false] as const,
      placeholder: ["Visible to patients", undefined, "One sentence"] as const,
      description: [undefined, "Used in public URLs", undefined] as const,
      required: [true, true, false] as const,
      testId: ["provider-name-field", "provider-slug-field", "provider-description-field"] as const,
    },
  });
}

describe("form field tables", () => {
  it("Form.fieldSchema returns a table schema", () => {
    expect(Form.fieldSchema()).toEqual({
      kind: "tableSchema",
      columns: {
        field: { kind: "string" },
        label: { kind: "string" },
        control: { kind: "enum", values: ["input", "textarea"] },
        inputId: { kind: "string" },
        value: { kind: "unknown" },
        changeKey: { kind: "string" },
        disabled: { kind: "boolean" },
        placeholder: { kind: "string", optional: true },
        description: { kind: "string", optional: true },
        required: { kind: "boolean", optional: true },
        testId: { kind: "string", optional: true },
      },
    });
  });

  it("Form.fieldsFromTable lowers a columnar table to records", () => {
    expect(Form.fieldsFromTable(providerFieldsTable())).toEqual([
      {
        kind: "formField",
        field: "displayName",
        label: "Provider name",
        control: "input",
        inputId: "setup-provider-name",
        value: "Acme Care",
        changeKey: "displayName",
        disabled: false,
        placeholder: "Visible to patients",
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
        changeKey: "slug",
        disabled: true,
        description: "Used in public URLs",
        required: true,
        testId: "provider-slug-field",
      },
      {
        kind: "formField",
        field: "description",
        label: "Short public description",
        control: "textarea",
        inputId: "setup-provider-description",
        value: "Friendly neighborhood care",
        changeKey: "description",
        disabled: false,
        placeholder: "One sentence",
        required: false,
        testId: "provider-description-field",
      },
    ]);
  });

  it("works with schema tables", () => {
    const authored = Table.defineWithSchema({
      id: "providerFields",
      schema: Form.fieldSchema(),
      columns: providerFieldsTable().columns,
    });

    const fields = Form.fieldsFromTable(authored);
    expect(fields[0]?.field).toBe("displayName");
  });

  it("preserves row order", () => {
    const fields = Form.fieldsFromTable(providerFieldsTable());
    expect(fields.map((field) => field.field)).toEqual(["displayName", "slug", "description"]);
  });

  it("supports input controls", () => {
    const [first] = Form.fieldsFromTable(providerFieldsTable());
    expect(first?.control).toBe("input");
  });

  it("supports textarea controls", () => {
    const fields = Form.fieldsFromTable(providerFieldsTable());
    expect(fields[2]?.control).toBe("textarea");
  });

  it("flows optional placeholder description required and testId columns through", () => {
    const fields = Form.fieldsFromTable(providerFieldsTable());
    expect(fields[0]).toMatchObject({
      placeholder: "Visible to patients",
      required: true,
      testId: "provider-name-field",
    });
    expect(fields[1]).toMatchObject({
      description: "Used in public URLs",
    });
  });

  it("Form.describeFields returns count and distinct controls", () => {
    expect(
      Form.describeFields(Form.fieldsFromTable(providerFieldsTable()), "providerFields"),
    ).toEqual({
      kind: "formFieldTableDescription",
      tableId: "providerFields",
      fieldCount: 3,
      controls: ["input", "textarea"],
    });
  });

  it("reports missing required columns", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          field: ["displayName"],
          label: ["Provider name"],
          control: ["input"],
          inputId: ["setup-provider-name"],
          changeKey: ["displayName"],
          disabled: [false],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingFormFieldColumn",
        tableId: "providerFields",
        column: "value",
        path: "providerFields.value",
      }),
    );
  });

  it("reports an invalid field name", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          field: [" ", "slug", "description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldName",
        column: "field",
        row: 0,
        path: "providerFields.field[0]",
      }),
    );
  });

  it("reports an invalid label", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          label: ["", "Public slug", "Short public description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldLabel",
        column: "label",
        row: 0,
      }),
    );
  });

  it("reports an invalid control", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          control: ["input", "select", "textarea"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldControl",
        column: "control",
        row: 1,
        path: "providerFields.control[1]",
      }),
    );
  });

  it("reports an invalid inputId", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          inputId: ["setup-provider-name", "", "setup-provider-description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldInputId",
        column: "inputId",
        row: 1,
      }),
    );
  });

  it("reports an invalid changeKey", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          changeKey: ["displayName", null, "description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldChangeKey",
        column: "changeKey",
        row: 1,
      }),
    );
  });

  it("reports an invalid disabled value", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          disabled: [false, "yes", false],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidFormFieldDisabled",
        column: "disabled",
        row: 1,
      }),
    );
  });

  it("reports invalid optional placeholder description required and testId values", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          placeholder: [7, undefined, "One sentence"],
          description: [undefined, false, undefined],
          required: [true, "yes", false],
          testId: ["provider-name-field", {}, "provider-description-field"],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidFormFieldPlaceholder",
          column: "placeholder",
          row: 0,
        }),
        expect.objectContaining({
          code: "InvalidFormFieldDescription",
          column: "description",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidFormFieldRequired",
          column: "required",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidFormFieldTestId",
          column: "testId",
          row: 1,
        }),
      ]),
    );
  });

  it("reports duplicate field names", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          field: ["displayName", "displayName", "description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateFormField",
        column: "field",
        row: 1,
        message: 'Form field "displayName" already appears at row 0.',
      }),
    );
  });

  it("reports duplicate input ids", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          inputId: ["setup-provider-name", "setup-provider-name", "setup-provider-description"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateFormFieldInputId",
        column: "inputId",
        row: 1,
        message: 'Input id "setup-provider-name" already appears at row 0.',
      }),
    );
  });

  it("diagnostics include table id column row and path", () => {
    const diagnostics = Form.validateFieldTable(
      Table.define({
        id: "providerFields",
        columns: {
          ...providerFieldsTable().columns,
          control: ["input", "radio", "textarea"],
        },
      }),
    );

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "InvalidFormFieldControl",
      message: 'Form field control must be "input" or "textarea".',
      tableId: "providerFields",
      column: "control",
      row: 1,
      path: "providerFields.control[1]",
    });
  });

  it("Form.fieldsFromTable throws TableError on invalid tables", () => {
    expect(() =>
      Form.fieldsFromTable(
        Table.define({
          id: "providerFields",
          columns: {
            ...providerFieldsTable().columns,
            control: ["input", "select", "textarea"],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("Form.validateFieldTable returns diagnostics without throwing", () => {
    expect(() =>
      Form.validateFieldTable(
        Table.define({
          id: "providerFields",
          columns: {
            ...providerFieldsTable().columns,
            field: ["", "slug", "description"],
          },
        }),
      ),
    ).not.toThrow();
  });
});

describe("form exports and typing", () => {
  it("exports the form namespace only from the form subpath", () => {
    expect(Form.fieldSchema).toBeTypeOf("function");
    expect(Form.fieldsFromTable).toBeTypeOf("function");
    expect(Form.validateFieldTable).toBeTypeOf("function");
    expect(Form.describeFields).toBeTypeOf("function");
    expect("Form" in root).toBe(false);
  });

  it("exports named helpers", () => {
    expect(fieldSchema).toBeTypeOf("function");
    expect(fieldsFromTable).toBeTypeOf("function");
    expect(validateFieldTable).toBeTypeOf("function");
    expect(describeFields).toBeTypeOf("function");
  });

  it("keeps the control union narrow", () => {
    const control: FormFieldControl = "input";
    const field: FormFieldRecord = {
      kind: "formField",
      field: "displayName",
      label: "Provider name",
      control,
      inputId: "setup-provider-name",
      value: "Acme Care",
      changeKey: "displayName",
      disabled: false,
    };
    void field;

    // biome-ignore lint/correctness/noConstantCondition: compile-time type assertion block
    if (false) {
      const invalidControl: FormFieldControl = "input";
      void invalidControl;
      // @ts-expect-error control must stay narrow
      const nope: FormFieldControl = "select";
      void nope;
    }

    expect(control).toBe("input");
  });
});
