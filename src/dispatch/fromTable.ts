import type { ColumnarTable, TableColumns, TableDiagnostic } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  IncrementDispatchTable,
  PrefixIncrementDispatchTable,
  PrefixSetDispatchTable,
  SetDispatchTable,
  ToggleDispatchTable,
} from "./types";

type DispatchRow = {
  readonly keyColumn: string;
  readonly handlerColumns: readonly string[];
};

type DispatchTableResult<TDispatchTable, TKey extends string> = TDispatchTable & {
  readonly __dispatchKeyType__?: TKey;
};

export type DispatchKeyFromTable<
  TTable extends ColumnarTable,
  TKeyColumn extends keyof TTable["columns"] & string,
> = Extract<TTable["columns"][TKeyColumn][number], string>;

type DispatchKeyFromColumn<
  TColumns extends TableColumns,
  TKeyColumn extends string,
> = TKeyColumn extends keyof TColumns ? Extract<TColumns[TKeyColumn][number], string> : string;

export type SetDispatchTableFromTableOptions<
  TEventColumn extends string = string,
  TFieldColumn extends string = string,
  TValueColumn extends string = string,
> = {
  readonly event: TEventColumn;
  readonly field: TFieldColumn;
  readonly value: TValueColumn;
};

export type ToggleDispatchTableFromTableOptions<
  TEventColumn extends string = string,
  TFieldColumn extends string = string,
> = {
  readonly event: TEventColumn;
  readonly field: TFieldColumn;
};

export type IncrementDispatchTableFromTableOptions<
  TEventColumn extends string = string,
  TFieldColumn extends string = string,
  TByColumn extends string = string,
> = {
  readonly event: TEventColumn;
  readonly field: TFieldColumn;
  readonly by?: TByColumn;
};

export type PrefixSetDispatchTableFromTableOptions<
  TPrefixColumn extends string = string,
  TFieldColumn extends string = string,
  TAllowedSuffixesColumn extends string = string,
> = {
  readonly prefix: TPrefixColumn;
  readonly field: TFieldColumn;
  readonly allowedSuffixes?: TAllowedSuffixesColumn;
};

export type PrefixIncrementDispatchTableFromTableOptions<
  TPrefixColumn extends string = string,
  TFieldColumn extends string = string,
  TByColumn extends string = string,
  TAllowedSuffixesColumn extends string = string,
> = {
  readonly prefix: TPrefixColumn;
  readonly field: TFieldColumn;
  readonly by?: TByColumn;
  readonly allowedSuffixes?: TAllowedSuffixesColumn;
};

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

function assertNoDispatchDiagnostics(
  table: ColumnarTable,
  diagnostics: readonly TableDiagnostic[],
): void {
  if (diagnostics.length > 0) {
    throw new TableError(diagnostics);
  }

  const tableDiagnostics = validateTable(table);
  if (tableDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(tableDiagnostics);
  }
}

function getDispatchColumn(
  table: ColumnarTable,
  column: string,
  role: "key" | "handler",
  diagnostics: TableDiagnostic[],
): readonly unknown[] | undefined {
  if (!Object.hasOwn(table.columns, column)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: role === "key" ? "MissingDispatchKeyColumn" : "MissingDispatchHandlerColumn",
        message: `Dispatch ${role} column "${column}" does not exist in table "${table.id}".`,
        column,
      }),
    );
    return undefined;
  }

  return table.columns[column];
}

function validateStringKeys(
  table: ColumnarTable,
  column: string,
  values: readonly unknown[],
  diagnostics: TableDiagnostic[],
): string[] {
  const keys: string[] = [];
  const seen = new Map<string, number>();

  values.forEach((value, row) => {
    if (typeof value !== "string") {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidDispatchKey",
          message: `Dispatch key must be a string, but row ${row} received ${typeof value}.`,
          column,
          row,
        }),
      );
      return;
    }

    const firstRow = seen.get(value);
    if (firstRow !== undefined) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "DuplicateDispatchKey",
          message: `Dispatch key ${JSON.stringify(value)} already appears at row ${firstRow}.`,
          column,
          row,
        }),
      );
      return;
    }

    seen.set(value, row);
    keys.push(value);
  });

  return keys;
}

function validatePropertyKeys(
  table: ColumnarTable,
  column: string,
  values: readonly unknown[],
  diagnostics: TableDiagnostic[],
): PropertyKey[] {
  const keys: PropertyKey[] = [];

  values.forEach((value, row) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "symbol") {
      keys.push(value);
      return;
    }

    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidDispatchHandler",
        message: `Dispatch handler field must be a property key, but row ${row} received ${typeof value}.`,
        column,
        row,
      }),
    );
  });

  return keys;
}

function validateFiniteNumbers(
  table: ColumnarTable,
  column: string,
  values: readonly unknown[],
  diagnostics: TableDiagnostic[],
): number[] {
  const numbers: number[] = [];

  values.forEach((value, row) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      numbers.push(value);
      return;
    }

    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidDispatchHandler",
        message: `Dispatch handler number must be finite, but row ${row} received ${JSON.stringify(value)}.`,
        column,
        row,
      }),
    );
  });

  return numbers;
}

function validateAllowedSuffixes(
  table: ColumnarTable,
  column: string,
  values: readonly unknown[],
  diagnostics: TableDiagnostic[],
): Array<readonly string[] | undefined> {
  const suffixes: Array<readonly string[] | undefined> = [];

  values.forEach((value, row) => {
    if (value === undefined) {
      suffixes.push(undefined);
      return;
    }

    if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
      suffixes.push([...value]);
      return;
    }

    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidDispatchHandler",
        message: `Dispatch handler allowedSuffixes must be a string array or undefined, but row ${row} received ${JSON.stringify(value)}.`,
        column,
        row,
      }),
    );
  });

  return suffixes;
}

function collectColumns(
  table: ColumnarTable,
  shape: DispatchRow,
): {
  readonly keyValues?: readonly unknown[];
  readonly handlerValues: Record<string, readonly unknown[]>;
  readonly diagnostics: TableDiagnostic[];
} {
  const diagnostics: TableDiagnostic[] = [];
  const keyValues = getDispatchColumn(table, shape.keyColumn, "key", diagnostics);
  const handlerValues: Record<string, readonly unknown[]> = {};

  shape.handlerColumns.forEach((column) => {
    const values = getDispatchColumn(table, column, "handler", diagnostics);
    if (values !== undefined) {
      handlerValues[column] = values;
    }
  });

  return { keyValues, handlerValues, diagnostics };
}

export function setDispatchTableFromTable<
  TState,
  TColumns extends TableColumns,
  TEventColumn extends string,
>(
  table: ColumnarTable<TColumns>,
  options: SetDispatchTableFromTableOptions<TEventColumn, string, string>,
): DispatchTableResult<SetDispatchTable<TState>, DispatchKeyFromColumn<TColumns, TEventColumn>> {
  const collected = collectColumns(table, {
    keyColumn: options.event,
    handlerColumns: [options.field, options.value],
  });
  const { diagnostics, keyValues, handlerValues } = collected;
  if (keyValues === undefined) {
    assertNoDispatchDiagnostics(table, diagnostics);
  }

  const events = validateStringKeys(table, options.event, keyValues ?? [], diagnostics);
  const fields = validatePropertyKeys(
    table,
    options.field,
    handlerValues[options.field] ?? [],
    diagnostics,
  );
  const values = [...(handlerValues[options.value] ?? [])];
  assertNoDispatchDiagnostics(table, diagnostics);

  return {
    events,
    fields: fields as unknown as readonly (keyof TState)[],
    values,
  } as DispatchTableResult<SetDispatchTable<TState>, DispatchKeyFromColumn<TColumns, TEventColumn>>;
}

export function toggleDispatchTableFromTable<
  TState,
  TColumns extends TableColumns,
  TEventColumn extends string,
>(
  table: ColumnarTable<TColumns>,
  options: ToggleDispatchTableFromTableOptions<TEventColumn, string>,
): DispatchTableResult<ToggleDispatchTable<TState>, DispatchKeyFromColumn<TColumns, TEventColumn>> {
  const collected = collectColumns(table, {
    keyColumn: options.event,
    handlerColumns: [options.field],
  });
  const { diagnostics, keyValues, handlerValues } = collected;
  if (keyValues === undefined) {
    assertNoDispatchDiagnostics(table, diagnostics);
  }

  const events = validateStringKeys(table, options.event, keyValues ?? [], diagnostics);
  const fields = validatePropertyKeys(
    table,
    options.field,
    handlerValues[options.field] ?? [],
    diagnostics,
  );
  assertNoDispatchDiagnostics(table, diagnostics);

  return {
    events,
    fields: fields as unknown as readonly (keyof TState)[],
  } as DispatchTableResult<
    ToggleDispatchTable<TState>,
    DispatchKeyFromColumn<TColumns, TEventColumn>
  >;
}

export function incrementDispatchTableFromTable<
  TState,
  TColumns extends TableColumns,
  TEventColumn extends string,
>(
  table: ColumnarTable<TColumns>,
  options: IncrementDispatchTableFromTableOptions<TEventColumn, string, string>,
): DispatchTableResult<
  IncrementDispatchTable<TState>,
  DispatchKeyFromColumn<TColumns, TEventColumn>
> {
  const collected = collectColumns(table, {
    keyColumn: options.event,
    handlerColumns: options.by === undefined ? [options.field] : [options.field, options.by],
  });
  const { diagnostics, keyValues, handlerValues } = collected;
  if (keyValues === undefined) {
    assertNoDispatchDiagnostics(table, diagnostics);
  }

  const events = validateStringKeys(table, options.event, keyValues ?? [], diagnostics);
  const fields = validatePropertyKeys(
    table,
    options.field,
    handlerValues[options.field] ?? [],
    diagnostics,
  );
  const by =
    options.by === undefined
      ? undefined
      : validateFiniteNumbers(table, options.by, handlerValues[options.by] ?? [], diagnostics);
  assertNoDispatchDiagnostics(table, diagnostics);

  return {
    events,
    fields: fields as unknown as readonly (keyof TState)[],
    ...(by === undefined ? {} : { by }),
  } as DispatchTableResult<
    IncrementDispatchTable<TState>,
    DispatchKeyFromColumn<TColumns, TEventColumn>
  >;
}

export function prefixSetDispatchTableFromTable<
  TState,
  TColumns extends TableColumns,
  TPrefixColumn extends string,
>(
  table: ColumnarTable<TColumns>,
  options: PrefixSetDispatchTableFromTableOptions<TPrefixColumn, string, string>,
): DispatchTableResult<
  PrefixSetDispatchTable<TState>,
  DispatchKeyFromColumn<TColumns, TPrefixColumn>
> {
  const collected = collectColumns(table, {
    keyColumn: options.prefix,
    handlerColumns:
      options.allowedSuffixes === undefined
        ? [options.field]
        : [options.field, options.allowedSuffixes],
  });
  const { diagnostics, keyValues, handlerValues } = collected;
  if (keyValues === undefined) {
    assertNoDispatchDiagnostics(table, diagnostics);
  }

  const prefixes = validateStringKeys(table, options.prefix, keyValues ?? [], diagnostics);
  const fields = validatePropertyKeys(
    table,
    options.field,
    handlerValues[options.field] ?? [],
    diagnostics,
  );
  const allowedSuffixes =
    options.allowedSuffixes === undefined
      ? undefined
      : validateAllowedSuffixes(
          table,
          options.allowedSuffixes,
          handlerValues[options.allowedSuffixes] ?? [],
          diagnostics,
        );
  assertNoDispatchDiagnostics(table, diagnostics);

  return {
    prefixes,
    fields: fields as unknown as readonly (keyof TState)[],
    ...(allowedSuffixes === undefined ? {} : { allowedSuffixes }),
  } as DispatchTableResult<
    PrefixSetDispatchTable<TState>,
    DispatchKeyFromColumn<TColumns, TPrefixColumn>
  >;
}

export function prefixIncrementDispatchTableFromTable<
  TState,
  TColumns extends TableColumns,
  TPrefixColumn extends string,
>(
  table: ColumnarTable<TColumns>,
  options: PrefixIncrementDispatchTableFromTableOptions<TPrefixColumn, string, string, string>,
): DispatchTableResult<
  PrefixIncrementDispatchTable<TState>,
  DispatchKeyFromColumn<TColumns, TPrefixColumn>
> {
  const handlerColumns = [options.field] as string[];
  if (options.by !== undefined) handlerColumns.push(options.by);
  if (options.allowedSuffixes !== undefined) handlerColumns.push(options.allowedSuffixes);

  const collected = collectColumns(table, {
    keyColumn: options.prefix,
    handlerColumns,
  });
  const { diagnostics, keyValues, handlerValues } = collected;
  if (keyValues === undefined) {
    assertNoDispatchDiagnostics(table, diagnostics);
  }

  const prefixes = validateStringKeys(table, options.prefix, keyValues ?? [], diagnostics);
  const fields = validatePropertyKeys(
    table,
    options.field,
    handlerValues[options.field] ?? [],
    diagnostics,
  );
  const by =
    options.by === undefined
      ? undefined
      : validateFiniteNumbers(table, options.by, handlerValues[options.by] ?? [], diagnostics);
  const allowedSuffixes =
    options.allowedSuffixes === undefined
      ? undefined
      : validateAllowedSuffixes(
          table,
          options.allowedSuffixes,
          handlerValues[options.allowedSuffixes] ?? [],
          diagnostics,
        );
  assertNoDispatchDiagnostics(table, diagnostics);

  return {
    prefixes,
    fields: fields as unknown as readonly (keyof TState)[],
    ...(by === undefined ? {} : { by }),
    ...(allowedSuffixes === undefined ? {} : { allowedSuffixes }),
  } as DispatchTableResult<
    PrefixIncrementDispatchTable<TState>,
    DispatchKeyFromColumn<TColumns, TPrefixColumn>
  >;
}
