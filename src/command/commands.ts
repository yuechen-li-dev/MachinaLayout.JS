import { Table } from "../table";
import type { ColumnarTable, TableDiagnostic } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  CommandRecord,
  CommandTableDescription,
  CommandTableSchema,
  CommandsFromTableOptions,
} from "./types";

type ResolvedCommandColumns = {
  readonly command: string;
  readonly label: string;
  readonly busyLabel: string;
  readonly doneLabel: string;
  readonly testId: string;
  readonly disabled: string;
  readonly busy: string;
  readonly done: string;
  readonly description: string;
  readonly variant: string;
};

function resolveColumns(options: CommandsFromTableOptions | undefined): ResolvedCommandColumns {
  return {
    command: options?.commandColumn ?? "command",
    label: options?.labelColumn ?? "label",
    busyLabel: options?.busyLabelColumn ?? "busyLabel",
    doneLabel: options?.doneLabelColumn ?? "doneLabel",
    testId: options?.testIdColumn ?? "testId",
    disabled: options?.disabledColumn ?? "disabled",
    busy: options?.busyColumn ?? "busy",
    done: options?.doneColumn ?? "done",
    description: options?.descriptionColumn ?? "description",
    variant: options?.variantColumn ?? "variant",
  };
}

function createDiagnostic(
  table: ColumnarTable,
  diagnostic: Omit<TableDiagnostic, "severity" | "tableId" | "path">,
): TableDiagnostic {
  const { column, row } = diagnostic;
  return {
    severity: "error",
    tableId: table.id,
    path:
      row !== undefined && column !== undefined
        ? `${table.id}.${column}[${row}]`
        : column !== undefined
          ? `${table.id}.${column}`
          : row !== undefined
            ? `${table.id}[${row}]`
            : table.id,
    ...diagnostic,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "MissingCommandColumn",
        message: `Command column "${column}" does not exist in table "${table.id}".`,
        column,
      }),
    );
    return undefined;
  }

  return table.columns[column];
}

function getOptionalColumn(table: ColumnarTable, column: string): readonly unknown[] | undefined {
  return Object.getOwnPropertyDescriptor(table.columns, column) !== undefined
    ? table.columns[column]
    : undefined;
}

function validateOptionalString(
  table: ColumnarTable,
  column: string,
  row: number,
  value: unknown,
  code:
    | "InvalidCommandBusyLabel"
    | "InvalidCommandDoneLabel"
    | "InvalidCommandTestId"
    | "InvalidCommandDescription"
    | "InvalidCommandVariant",
  message: string,
  diagnostics: TableDiagnostic[],
): void {
  if (value !== undefined && typeof value !== "string") {
    diagnostics.push(
      createDiagnostic(table, {
        code,
        message,
        column,
        row,
      }),
    );
  }
}

export function commandSchema(): CommandTableSchema {
  return Table.schema({
    command: Table.string(),
    label: Table.string(),
    busyLabel: Table.optional(Table.string()),
    doneLabel: Table.optional(Table.string()),
    testId: Table.optional(Table.string()),
    disabled: Table.boolean(),
    busy: Table.boolean(),
    done: Table.boolean(),
    description: Table.optional(Table.string()),
    variant: Table.optional(Table.string()),
  });
}

export function validateCommandTable(
  table: ColumnarTable,
  options?: CommandsFromTableOptions,
): TableDiagnostic[] {
  const columns = resolveColumns(options);
  const diagnostics = [...validateTable(table)];

  const commandValues = validateRequiredColumn(table, columns.command, diagnostics);
  const labelValues = validateRequiredColumn(table, columns.label, diagnostics);
  const disabledValues = validateRequiredColumn(table, columns.disabled, diagnostics);
  const busyValues = validateRequiredColumn(table, columns.busy, diagnostics);
  const doneValues = validateRequiredColumn(table, columns.done, diagnostics);

  const busyLabelValues = getOptionalColumn(table, columns.busyLabel);
  const doneLabelValues = getOptionalColumn(table, columns.doneLabel);
  const testIdValues = getOptionalColumn(table, columns.testId);
  const descriptionValues = getOptionalColumn(table, columns.description);
  const variantValues = getOptionalColumn(table, columns.variant);

  if (
    commandValues === undefined ||
    labelValues === undefined ||
    disabledValues === undefined ||
    busyValues === undefined ||
    doneValues === undefined
  ) {
    return diagnostics;
  }

  const seenCommands = new Map<string, number>();
  const seenTestIds = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const command = commandValues[row];
    if (!isNonEmptyString(command)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidCommandId",
          message: "Command id must be a non-empty string.",
          column: columns.command,
          row,
        }),
      );
    } else {
      const firstRow = seenCommands.get(command);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateCommand",
            message: `Command ${JSON.stringify(command)} already appears at row ${firstRow}.`,
            column: columns.command,
            row,
          }),
        );
      } else {
        seenCommands.set(command, row);
      }
    }

    const label = labelValues[row];
    if (!isNonEmptyString(label)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidCommandLabel",
          message: "Command label must be a non-empty string.",
          column: columns.label,
          row,
        }),
      );
    }

    const disabled = disabledValues[row];
    if (typeof disabled !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidCommandDisabled",
          message: "Command disabled must be a boolean.",
          column: columns.disabled,
          row,
        }),
      );
    }

    const busy = busyValues[row];
    if (typeof busy !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidCommandBusy",
          message: "Command busy must be a boolean.",
          column: columns.busy,
          row,
        }),
      );
    }

    const done = doneValues[row];
    if (typeof done !== "boolean") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidCommandDone",
          message: "Command done must be a boolean.",
          column: columns.done,
          row,
        }),
      );
    }

    validateOptionalString(
      table,
      columns.busyLabel,
      row,
      busyLabelValues?.[row],
      "InvalidCommandBusyLabel",
      "Command busyLabel must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.doneLabel,
      row,
      doneLabelValues?.[row],
      "InvalidCommandDoneLabel",
      "Command doneLabel must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.testId,
      row,
      testIdValues?.[row],
      "InvalidCommandTestId",
      "Command testId must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.description,
      row,
      descriptionValues?.[row],
      "InvalidCommandDescription",
      "Command description must be a string when provided.",
      diagnostics,
    );
    validateOptionalString(
      table,
      columns.variant,
      row,
      variantValues?.[row],
      "InvalidCommandVariant",
      "Command variant must be a string when provided.",
      diagnostics,
    );

    const testId = testIdValues?.[row];
    if (typeof testId === "string") {
      const firstRow = seenTestIds.get(testId);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateCommandTestId",
            message: `Test id ${JSON.stringify(testId)} already appears at row ${firstRow}.`,
            column: columns.testId,
            row,
          }),
        );
      } else {
        seenTestIds.set(testId, row);
      }
    }
  }

  return diagnostics;
}

export function commandsFromTable(
  table: ColumnarTable,
  options?: CommandsFromTableOptions,
): readonly CommandRecord[] {
  const diagnostics = validateCommandTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveColumns(options);
  const commandValues = table.columns[columns.command] ?? [];
  const labelValues = table.columns[columns.label] ?? [];
  const disabledValues = table.columns[columns.disabled] ?? [];
  const busyValues = table.columns[columns.busy] ?? [];
  const doneValues = table.columns[columns.done] ?? [];
  const busyLabelValues = table.columns[columns.busyLabel];
  const doneLabelValues = table.columns[columns.doneLabel];
  const testIdValues = table.columns[columns.testId];
  const descriptionValues = table.columns[columns.description];
  const variantValues = table.columns[columns.variant];

  const commands: CommandRecord[] = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    const command: CommandRecord = {
      kind: "command",
      command: commandValues[row] as string,
      label: labelValues[row] as string,
      disabled: disabledValues[row] as boolean,
      busy: busyValues[row] as boolean,
      done: doneValues[row] as boolean,
      ...(busyLabelValues?.[row] === undefined
        ? {}
        : { busyLabel: busyLabelValues[row] as string }),
      ...(doneLabelValues?.[row] === undefined
        ? {}
        : { doneLabel: doneLabelValues[row] as string }),
      ...(testIdValues?.[row] === undefined ? {} : { testId: testIdValues[row] as string }),
      ...(descriptionValues?.[row] === undefined
        ? {}
        : { description: descriptionValues[row] as string }),
      ...(variantValues?.[row] === undefined ? {} : { variant: variantValues[row] as string }),
    };
    commands.push(command);
  }

  return commands;
}

export function resolveCommandLabel(command: CommandRecord): string {
  if (command.busy) {
    return command.busyLabel ?? command.label;
  }

  if (command.done) {
    return command.doneLabel ?? command.label;
  }

  return command.label;
}

export function describeCommands(
  commands: readonly CommandRecord[],
  tableId = "",
): CommandTableDescription {
  return {
    kind: "commandTableDescription",
    tableId,
    commandCount: commands.length,
    busyCount: commands.filter((command) => command.busy).length,
    doneCount: commands.filter((command) => command.done).length,
    disabledCount: commands.filter((command) => command.disabled).length,
  };
}

export const Command = {
  commandSchema,
  commandsFromTable,
  validateCommandTable,
  describeCommands,
  resolveCommandLabel,
} as const;
