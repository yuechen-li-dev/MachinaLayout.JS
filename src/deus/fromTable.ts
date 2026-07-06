import type { ColumnarTable, TableColumns, TableDiagnostic } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  DeusAction,
  DeusEvent,
  DeusPathInput,
  DeusStatePath,
  DeusTransitionRow,
} from "./types";

type TransitionEventFromColumn<
  TColumns extends TableColumns,
  TEventColumn extends string,
> = TEventColumn extends keyof TColumns ? Extract<TColumns[TEventColumn][number], string> : string;

export type DeusTransitionsFromTableOptions<
  TKeyColumn extends string = "key",
  TFromColumn extends string = "from",
  TEventColumn extends string = "event",
  TToColumn extends string = "to",
  TDoColumn extends string = "do",
> = {
  readonly keyColumn?: TKeyColumn;
  readonly fromColumn?: TFromColumn;
  readonly eventColumn?: TEventColumn;
  readonly toColumn?: TToColumn;
  readonly doColumn?: TDoColumn;
};

type ResolvedTransitionColumns = {
  readonly key: string;
  readonly from: string;
  readonly event: string;
  readonly to: string;
  readonly action: string;
};

function resolveColumns(
  options: DeusTransitionsFromTableOptions<string, string, string, string, string> | undefined,
): ResolvedTransitionColumns {
  return {
    key: options?.keyColumn ?? "key",
    from: options?.fromColumn ?? "from",
    event: options?.eventColumn ?? "event",
    to: options?.toColumn ?? "to",
    action: options?.doColumn ?? "do",
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

function validateRequiredColumn(
  table: ColumnarTable,
  column: string,
  code:
    | "MissingTransitionKeyColumn"
    | "MissingTransitionFromColumn"
    | "MissingTransitionEventColumn",
  message: string,
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
    diagnostics.push(
      createDiagnostic(table, {
        code,
        message,
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

function isValidPathSegment(segment: unknown): segment is string {
  return typeof segment === "string" && segment.length > 0 && segment.trim().length > 0;
}

function isValidStatePath(value: unknown): value is DeusStatePath {
  return Array.isArray(value) && value.length > 0 && value.every(isValidPathSegment);
}

function isValidPathString(value: string): boolean {
  const normalized = value.startsWith("/") ? value.slice(1) : value;
  if (normalized.length === 0) {
    return false;
  }

  return normalized.split("/").every((segment) => segment.length > 0 && segment.trim().length > 0);
}

function isTransitionTarget<TBoard, TEvent extends DeusEvent>(
  value: unknown,
): value is DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput) {
  if (typeof value === "function") {
    return true;
  }

  if (typeof value === "string") {
    return isValidPathString(value);
  }

  return isValidStatePath(value);
}

function copyStatePath(path: DeusStatePath): DeusStatePath {
  return [...path];
}

function copyTarget<TBoard, TEvent extends DeusEvent>(
  target: DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput),
): DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput) {
  return Array.isArray(target) ? copyStatePath(target) : target;
}

export function validateTransitionsTable(
  table: ColumnarTable,
  options?: DeusTransitionsFromTableOptions<string, string, string, string, string>,
): TableDiagnostic[] {
  const columns = resolveColumns(options);
  const diagnostics = [...validateTable(table)];

  const keyValues = validateRequiredColumn(
    table,
    columns.key,
    "MissingTransitionKeyColumn",
    `Transition key column "${columns.key}" does not exist in table "${table.id}".`,
    diagnostics,
  );
  const fromValues = validateRequiredColumn(
    table,
    columns.from,
    "MissingTransitionFromColumn",
    `Transition from column "${columns.from}" does not exist in table "${table.id}".`,
    diagnostics,
  );
  const eventValues = validateRequiredColumn(
    table,
    columns.event,
    "MissingTransitionEventColumn",
    `Transition event column "${columns.event}" does not exist in table "${table.id}".`,
    diagnostics,
  );
  const toValues = getOptionalColumn(table, columns.to);
  const actionValues = getOptionalColumn(table, columns.action);

  if (keyValues === undefined || fromValues === undefined || eventValues === undefined) {
    return diagnostics;
  }

  const seenKeys = new Map<string, number>();

  for (let row = 0; row < table.rowCount; row += 1) {
    const key = keyValues[row];
    if (typeof key !== "string" || key.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTransitionKey",
          message: "Transition key must be a non-empty string.",
          column: columns.key,
          row,
        }),
      );
    } else {
      const firstRow = seenKeys.get(key);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateTransitionKey",
            message: `Transition key ${JSON.stringify(key)} already appears at row ${firstRow}.`,
            column: columns.key,
            row,
          }),
        );
      } else {
        seenKeys.set(key, row);
      }
    }

    const from = fromValues[row];
    if (!isValidStatePath(from)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTransitionFrom",
          message: "Transition from must be a non-empty Deus state path.",
          column: columns.from,
          row,
        }),
      );
    }

    const event = eventValues[row];
    if (typeof event !== "string" || event.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTransitionEvent",
          message: "Transition event must be a non-empty string.",
          column: columns.event,
          row,
        }),
      );
    }

    const to = toValues?.[row];
    if (to !== undefined && !isTransitionTarget(to)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTransitionTo",
          message: "Transition to must be a Deus path, path string, function, or undefined.",
          column: columns.to,
          row,
        }),
      );
    }

    const action = actionValues?.[row];
    if (action !== undefined && typeof action !== "function") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTransitionAction",
          message: "Transition action must be a function when provided.",
          column: columns.action,
          row,
        }),
      );
    }
  }

  return diagnostics;
}

export function transitionsFromTable<
  TColumns extends TableColumns,
  TKeyColumn extends string = "key",
  TFromColumn extends string = "from",
  TEventColumn extends string = "event",
  TToColumn extends string = "to",
  TDoColumn extends string = "do",
  TBoard = unknown,
>(
  table: ColumnarTable<TColumns>,
  options?: DeusTransitionsFromTableOptions<
    TKeyColumn,
    TFromColumn,
    TEventColumn,
    TToColumn,
    TDoColumn
  >,
): readonly DeusTransitionRow<
  TBoard,
  { type: TransitionEventFromColumn<TColumns, TEventColumn> }
>[] {
  const diagnostics = validateTransitionsTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolveColumns(options);
  const keyValues = table.columns[columns.key] ?? [];
  const fromValues = table.columns[columns.from] ?? [];
  const eventValues = table.columns[columns.event] ?? [];
  const toValues = table.columns[columns.to];
  const actionValues = table.columns[columns.action];

  const transitions: Array<
    DeusTransitionRow<TBoard, { type: TransitionEventFromColumn<TColumns, TEventColumn> }>
  > = [];

  for (let row = 0; row < table.rowCount; row += 1) {
    const from = copyStatePath(fromValues[row] as DeusStatePath);
    const to = toValues?.[row] as
      | DeusPathInput
      | ((
          board: TBoard,
          event: { type: TransitionEventFromColumn<TColumns, TEventColumn> },
        ) => DeusPathInput)
      | undefined;
    const action = actionValues?.[row] as
      | DeusAction<TBoard, { type: TransitionEventFromColumn<TColumns, TEventColumn> }>
      | undefined;

    transitions.push({
      key: keyValues[row] as string,
      from,
      event: eventValues[row] as TransitionEventFromColumn<TColumns, TEventColumn>,
      ...(to === undefined ? {} : { to: copyTarget(to) }),
      ...(action === undefined ? {} : { do: action }),
    });
  }

  return transitions;
}
