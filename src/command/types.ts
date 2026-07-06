import type { TableSchema } from "../table/types";

export type CommandId = string;

export type CommandRecord = {
  readonly kind: "command";
  readonly command: CommandId;
  readonly label: string;
  readonly busyLabel?: string;
  readonly doneLabel?: string;
  readonly testId?: string;
  readonly disabled: boolean;
  readonly busy: boolean;
  readonly done: boolean;
  readonly description?: string;
  readonly variant?: string;
};

export type CommandTableDescription = {
  readonly kind: "commandTableDescription";
  readonly tableId: string;
  readonly commandCount: number;
  readonly busyCount: number;
  readonly doneCount: number;
  readonly disabledCount: number;
};

export type CommandsFromTableOptions = {
  readonly commandColumn?: string;
  readonly labelColumn?: string;
  readonly busyLabelColumn?: string;
  readonly doneLabelColumn?: string;
  readonly testIdColumn?: string;
  readonly disabledColumn?: string;
  readonly busyColumn?: string;
  readonly doneColumn?: string;
  readonly descriptionColumn?: string;
  readonly variantColumn?: string;
};

export type CommandTableSchema = TableSchema<{
  readonly command: { readonly kind: "string"; readonly optional?: boolean };
  readonly label: { readonly kind: "string"; readonly optional?: boolean };
  readonly busyLabel: { readonly kind: "string"; readonly optional: true };
  readonly doneLabel: { readonly kind: "string"; readonly optional: true };
  readonly testId: { readonly kind: "string"; readonly optional: true };
  readonly disabled: { readonly kind: "boolean"; readonly optional?: boolean };
  readonly busy: { readonly kind: "boolean"; readonly optional?: boolean };
  readonly done: { readonly kind: "boolean"; readonly optional?: boolean };
  readonly description: { readonly kind: "string"; readonly optional: true };
  readonly variant: { readonly kind: "string"; readonly optional: true };
}>;
