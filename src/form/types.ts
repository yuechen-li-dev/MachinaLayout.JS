import type { TableSchema } from "../table/types";

export type FormFieldControl = "input" | "textarea";

export type FormFieldValue = string | number | boolean | undefined | null;

export type FormFieldRecord = {
  readonly kind: "formField";
  readonly field: string;
  readonly label: string;
  readonly control: FormFieldControl;
  readonly inputId: string;
  readonly value: FormFieldValue;
  readonly changeKey: string;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly testId?: string;
};

export type FormFieldTableDescription = {
  readonly kind: "formFieldTableDescription";
  readonly tableId: string;
  readonly fieldCount: number;
  readonly controls: readonly FormFieldControl[];
};

export type FieldsFromTableOptions = {
  readonly fieldColumn?: string;
  readonly labelColumn?: string;
  readonly controlColumn?: string;
  readonly inputIdColumn?: string;
  readonly valueColumn?: string;
  readonly changeKeyColumn?: string;
  readonly disabledColumn?: string;
  readonly placeholderColumn?: string;
  readonly descriptionColumn?: string;
  readonly requiredColumn?: string;
  readonly testIdColumn?: string;
};

export type FormFieldTableSchema = TableSchema<{
  readonly field: { readonly kind: "string"; readonly optional?: boolean };
  readonly label: { readonly kind: "string"; readonly optional?: boolean };
  readonly control: {
    readonly kind: "enum";
    readonly values: readonly FormFieldControl[];
    readonly optional?: boolean;
  };
  readonly inputId: { readonly kind: "string"; readonly optional?: boolean };
  readonly value: { readonly kind: "unknown"; readonly optional?: boolean };
  readonly changeKey: { readonly kind: "string"; readonly optional?: boolean };
  readonly disabled: { readonly kind: "boolean"; readonly optional?: boolean };
  readonly placeholder: { readonly kind: "string"; readonly optional: true };
  readonly description: { readonly kind: "string"; readonly optional: true };
  readonly required: { readonly kind: "boolean"; readonly optional: true };
  readonly testId: { readonly kind: "string"; readonly optional: true };
}>;
