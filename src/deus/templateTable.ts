import type { ColumnarTable, TableDiagnostic, TableRow } from "../table/types";
import { TableError, validateTable } from "../table/validate";
import type {
  DeusAction,
  DeusEvent,
  DeusPathInput,
  DeusStatePath,
  DeusTransitionRow,
} from "./types";

type TemplateBoard = Record<string, unknown>;
type TemplateEvent = DeusEvent & Record<string, unknown>;

export type DeusTransitionTemplate<TRow = TableRow<ColumnarTable>> = {
  readonly kind: "deusTransitionTemplate";
  readonly id: string;
  readonly requiredColumns: readonly string[];
  readonly expand: (
    row: TRow,
    context: {
      readonly rowIndex: number;
      readonly table: ColumnarTable;
    },
  ) => readonly DeusTransitionRow<TemplateBoard, TemplateEvent>[];
};

export type PendingResultTransitionTemplateOptions = {
  readonly entityColumn?: string;
  readonly pendingColumn?: string;
  readonly successEventColumn?: string;
  readonly failureEventColumn?: string;
  readonly successTargetColumn?: string;
  readonly successPayloadColumn?: string;
  readonly failurePayloadColumn?: string;
  readonly toColumn?: string;
  readonly successKeyColumn?: string;
  readonly failureKeyColumn?: string;
  readonly errorTarget?: string;
};

type PendingColumns = {
  readonly entity: string;
  readonly pending: string;
  readonly successEvent: string;
  readonly failureEvent: string;
  readonly successTarget: string;
  readonly successPayload: string;
  readonly failurePayload: string;
  readonly to: string;
  readonly successKey: string;
  readonly failureKey: string;
  readonly errorTarget: string;
};

type PendingExpansion = {
  readonly key: string;
  readonly transition: DeusTransitionRow<TemplateBoard, TemplateEvent>;
  readonly sourceColumn?: string;
  readonly row: number;
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

function isTransitionAction<TBoard, TEvent extends DeusEvent>(
  value: unknown,
): value is DeusAction<TBoard, TEvent> {
  return typeof value === "function";
}

function copyStatePath(path: DeusStatePath): DeusStatePath {
  return [...path];
}

function copyTarget<TBoard, TEvent extends DeusEvent>(
  target: DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput),
): DeusPathInput | ((board: TBoard, event: TEvent) => DeusPathInput) {
  return Array.isArray(target) ? copyStatePath(target) : target;
}

function getRow(table: ColumnarTable, rowIndex: number): TableRow<ColumnarTable> {
  const row: Record<string, unknown> = {};
  for (const [column, values] of Object.entries(table.columns)) {
    row[column] = values[rowIndex];
  }
  return row;
}

function validateExpandedTransition(
  table: ColumnarTable,
  rowIndex: number,
  transition: unknown,
): TableDiagnostic[] {
  if (typeof transition !== "object" || transition === null || Array.isArray(transition)) {
    return [
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Template expansion must return Deus transition row objects.",
        row: rowIndex,
      }),
    ];
  }

  const candidate = transition as Partial<DeusTransitionRow<TemplateBoard, TemplateEvent>>;
  const diagnostics: TableDiagnostic[] = [];

  if (typeof candidate.key !== "string" || candidate.key.trim().length === 0) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Expanded transition key must be a non-empty string.",
        row: rowIndex,
      }),
    );
  }

  if (!isValidStatePath(candidate.from)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Expanded transition from must be a non-empty Deus state path.",
        row: rowIndex,
      }),
    );
  }

  if (
    candidate.event !== undefined &&
    (typeof candidate.event !== "string" || candidate.event.trim().length === 0)
  ) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Expanded transition event must be a non-empty string when provided.",
        row: rowIndex,
      }),
    );
  }

  if (candidate.to !== undefined && !isTransitionTarget(candidate.to)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Expanded transition to must be a Deus path, path string, function, or undefined.",
        row: rowIndex,
      }),
    );
  }

  if (candidate.do !== undefined && !isTransitionAction(candidate.do)) {
    diagnostics.push(
      createDiagnostic(table, {
        code: "InvalidTemplateExpansion",
        message: "Expanded transition action must be a function when provided.",
        row: rowIndex,
      }),
    );
  }

  return diagnostics;
}

function validateRequiredTemplateColumns(
  table: ColumnarTable,
  requiredColumns: readonly string[],
): TableDiagnostic[] {
  const diagnostics: TableDiagnostic[] = [];

  for (const column of requiredColumns) {
    if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "MissingTemplateColumn",
          message: `Required template column "${column}" is missing.`,
          column,
        }),
      );
    }
  }

  return diagnostics;
}

function resolvePendingColumns(options?: PendingResultTransitionTemplateOptions): PendingColumns {
  return {
    entity: options?.entityColumn ?? "entity",
    pending: options?.pendingColumn ?? "pending",
    successEvent: options?.successEventColumn ?? "successEvent",
    failureEvent: options?.failureEventColumn ?? "failureEvent",
    successTarget: options?.successTargetColumn ?? "successTarget",
    successPayload: options?.successPayloadColumn ?? "successPayload",
    failurePayload: options?.failurePayloadColumn ?? "failurePayload",
    to: options?.toColumn ?? "to",
    successKey: options?.successKeyColumn ?? "successKey",
    failureKey: options?.failureKeyColumn ?? "failureKey",
    errorTarget: options?.errorTarget ?? "errorMessage",
  };
}

function buildDerivedKey(
  row: TableRow<ColumnarTable>,
  rowIndex: number,
  table: ColumnarTable,
  entityColumn: string,
  eventColumn: string,
): string {
  const entity = row[entityColumn];
  const event = row[eventColumn];
  if (typeof entity === "string" && entity.trim().length > 0 && typeof event === "string") {
    return `${entity}.${event}`;
  }
  return `${table.id}.${rowIndex}.${String(event)}`;
}

function createPendingResultAction(
  eventType: string,
  successTarget: string,
  successPayload: string,
  errorTarget: string,
): DeusAction<TemplateBoard, TemplateEvent> {
  return (board, event) => {
    if (event.type !== eventType) {
      return;
    }

    board[successTarget] = event[successPayload];
    board[errorTarget] = undefined;
  };
}

function createPendingResultFailureAction(
  eventType: string,
  failurePayload: string,
  errorTarget: string,
): DeusAction<TemplateBoard, TemplateEvent> {
  return (board, event) => {
    if (event.type !== eventType) {
      return;
    }

    board[errorTarget] = event[failurePayload];
  };
}

function buildPendingResultExpansions(
  table: ColumnarTable,
  rowIndex: number,
  row: TableRow<ColumnarTable>,
  columns: PendingColumns,
): readonly PendingExpansion[] {
  const pending = row[columns.pending] as DeusStatePath;
  const successEvent = row[columns.successEvent] as string;
  const failureEvent = row[columns.failureEvent] as string;
  const to = row[columns.to] as
    | DeusPathInput
    | ((board: TemplateBoard, event: TemplateEvent) => DeusPathInput);
  const successTarget = row[columns.successTarget] as string;
  const successPayload = row[columns.successPayload] as string;
  const failurePayload = row[columns.failurePayload] as string;
  const successKeyCell = row[columns.successKey];
  const failureKeyCell = row[columns.failureKey];

  const successKey =
    typeof successKeyCell === "string" && successKeyCell.trim().length > 0
      ? successKeyCell
      : buildDerivedKey(row, rowIndex, table, columns.entity, columns.successEvent);
  const failureKey =
    typeof failureKeyCell === "string" && failureKeyCell.trim().length > 0
      ? failureKeyCell
      : buildDerivedKey(row, rowIndex, table, columns.entity, columns.failureEvent);

  const successSourceColumn =
    getOptionalColumn(table, columns.successKey) !== undefined
      ? columns.successKey
      : getOptionalColumn(table, columns.entity) !== undefined
        ? columns.entity
        : columns.successEvent;
  const failureSourceColumn =
    getOptionalColumn(table, columns.failureKey) !== undefined
      ? columns.failureKey
      : getOptionalColumn(table, columns.entity) !== undefined
        ? columns.entity
        : columns.failureEvent;

  return [
    {
      key: successKey,
      sourceColumn: successSourceColumn,
      row: rowIndex,
      transition: {
        key: successKey,
        from: copyStatePath(pending),
        event: successEvent,
        to: copyTarget(to),
        do: createPendingResultAction(
          successEvent,
          successTarget,
          successPayload,
          columns.errorTarget,
        ),
      },
    },
    {
      key: failureKey,
      sourceColumn: failureSourceColumn,
      row: rowIndex,
      transition: {
        key: failureKey,
        from: copyStatePath(pending),
        event: failureEvent,
        to: copyTarget(to),
        do: createPendingResultFailureAction(failureEvent, failurePayload, columns.errorTarget),
      },
    },
  ];
}

export function validateTransitionTemplateTable(
  table: ColumnarTable,
  template: DeusTransitionTemplate,
): TableDiagnostic[] {
  const diagnostics = [
    ...validateTable(table),
    ...validateRequiredTemplateColumns(table, template.requiredColumns),
  ];
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return diagnostics;
  }

  const seenKeys = new Map<string, number>();

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = getRow(table, rowIndex);
    let expanded: readonly DeusTransitionRow<TemplateBoard, TemplateEvent>[];

    try {
      expanded = template.expand(row, { rowIndex, table });
    } catch (error) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "TemplateExpansionError",
          message: `Template "${template.id}" failed to expand row ${rowIndex}: ${error instanceof Error ? error.message : String(error)}.`,
          row: rowIndex,
        }),
      );
      continue;
    }

    if (!Array.isArray(expanded)) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateExpansion",
          message: `Template "${template.id}" must return an array of transition rows.`,
          row: rowIndex,
        }),
      );
      continue;
    }

    for (const transition of expanded) {
      diagnostics.push(...validateExpandedTransition(table, rowIndex, transition));
      if (typeof transition?.key === "string" && transition.key.trim().length > 0) {
        const firstRow = seenKeys.get(transition.key);
        if (firstRow !== undefined) {
          diagnostics.push(
            createDiagnostic(table, {
              code: "DuplicateTemplateTransitionKey",
              message: `Expanded transition key ${JSON.stringify(transition.key)} already exists.`,
              row: rowIndex,
            }),
          );
        } else {
          seenKeys.set(transition.key, rowIndex);
        }
      }
    }
  }

  return diagnostics;
}

export function transitionsFromTemplateTable<
  TBoard = TemplateBoard,
  TEvent extends DeusEvent = TemplateEvent,
>(
  table: ColumnarTable,
  template: DeusTransitionTemplate,
): readonly DeusTransitionRow<TBoard, TEvent>[] {
  const diagnostics = validateTransitionTemplateTable(table, template);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const transitions: DeusTransitionRow<TemplateBoard, TemplateEvent>[] = [];
  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    transitions.push(...template.expand(getRow(table, rowIndex), { rowIndex, table }));
  }
  return transitions as readonly DeusTransitionRow<TBoard, TEvent>[];
}

export function pendingResultTransitionTemplate(
  options?: PendingResultTransitionTemplateOptions,
): DeusTransitionTemplate {
  const columns = resolvePendingColumns(options);
  return {
    kind: "deusTransitionTemplate",
    id: "pendingResultTransitionTemplate",
    requiredColumns: [
      columns.pending,
      columns.successEvent,
      columns.failureEvent,
      columns.successTarget,
      columns.successPayload,
      columns.failurePayload,
      columns.to,
    ],
    expand: (row, context) =>
      buildPendingResultExpansions(context.table, context.rowIndex, row, columns).map(
        (entry) => entry.transition,
      ),
  };
}

export function validatePendingResultTransitionTable(
  table: ColumnarTable,
  options?: PendingResultTransitionTemplateOptions,
): TableDiagnostic[] {
  const columns = resolvePendingColumns(options);
  const diagnostics = [...validateTable(table)];

  const requiredColumns: Array<readonly [string, TableDiagnostic["code"], string]> = [
    [
      columns.pending,
      "MissingPendingStateColumn",
      `Required template column "${columns.pending}" is missing.`,
    ],
    [
      columns.successEvent,
      "MissingSuccessEventColumn",
      `Required template column "${columns.successEvent}" is missing.`,
    ],
    [
      columns.failureEvent,
      "MissingFailureEventColumn",
      `Required template column "${columns.failureEvent}" is missing.`,
    ],
    [
      columns.successTarget,
      "MissingSuccessTargetColumn",
      `Required template column "${columns.successTarget}" is missing.`,
    ],
    [
      columns.successPayload,
      "MissingSuccessPayloadColumn",
      `Required template column "${columns.successPayload}" is missing.`,
    ],
    [
      columns.failurePayload,
      "MissingFailurePayloadColumn",
      `Required template column "${columns.failurePayload}" is missing.`,
    ],
    [
      columns.to,
      "MissingTransitionToColumn",
      `Required template column "${columns.to}" is missing.`,
    ],
  ];

  for (const [column, code, message] of requiredColumns) {
    if (Object.getOwnPropertyDescriptor(table.columns, column) === undefined) {
      diagnostics.push(
        createDiagnostic(table, {
          code,
          message,
          column,
        }),
      );
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return diagnostics;
  }

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = getRow(table, rowIndex);
    const successEvent = row[columns.successEvent];
    const failureEvent = row[columns.failureEvent];
    const successTarget = row[columns.successTarget];
    const successPayload = row[columns.successPayload];
    const failurePayload = row[columns.failurePayload];

    if (!isValidStatePath(row[columns.pending])) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateState",
          message: "Pending state must be a non-empty Deus state path.",
          column: columns.pending,
          row: rowIndex,
        }),
      );
    }

    if (typeof successEvent !== "string" || successEvent.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateEvent",
          message: "Success event must be a non-empty string.",
          column: columns.successEvent,
          row: rowIndex,
        }),
      );
    }

    if (typeof failureEvent !== "string" || failureEvent.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateEvent",
          message: "Failure event must be a non-empty string.",
          column: columns.failureEvent,
          row: rowIndex,
        }),
      );
    }

    if (typeof successTarget !== "string" || successTarget.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateTargetField",
          message: "Success target field must be a non-empty string.",
          column: columns.successTarget,
          row: rowIndex,
        }),
      );
    }

    if (typeof successPayload !== "string" || successPayload.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplatePayloadField",
          message: "Success payload field must be a non-empty string.",
          column: columns.successPayload,
          row: rowIndex,
        }),
      );
    }

    if (typeof failurePayload !== "string" || failurePayload.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplatePayloadField",
          message: "Failure payload field must be a non-empty string.",
          column: columns.failurePayload,
          row: rowIndex,
        }),
      );
    }

    if (!isTransitionTarget(row[columns.to])) {
      diagnostics.push(
        createDiagnostic(table, {
          code: "InvalidTemplateState",
          message: "Transition to must be a Deus path, path string, or function.",
          column: columns.to,
          row: rowIndex,
        }),
      );
    }
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return diagnostics;
  }

  const seenKeys = new Map<string, number>();

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    const row = getRow(table, rowIndex);
    const expansions = buildPendingResultExpansions(table, rowIndex, row, columns);

    for (const expansion of expansions) {
      const firstRow = seenKeys.get(expansion.key);
      if (firstRow !== undefined) {
        diagnostics.push(
          createDiagnostic(table, {
            code: "DuplicateTemplateTransitionKey",
            message: `Expanded transition key ${JSON.stringify(expansion.key)} already exists.`,
            column: expansion.sourceColumn,
            row: expansion.row,
          }),
        );
      } else {
        seenKeys.set(expansion.key, rowIndex);
      }

      diagnostics.push(...validateExpandedTransition(table, rowIndex, expansion.transition));
    }
  }

  return diagnostics;
}

export function pendingResultTransitionsFromTable<
  TBoard = TemplateBoard,
  TEvent extends DeusEvent = TemplateEvent,
>(
  table: ColumnarTable,
  options?: PendingResultTransitionTemplateOptions,
): readonly DeusTransitionRow<TBoard, TEvent>[] {
  const diagnostics = validatePendingResultTransitionTable(table, options);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableError(diagnostics);
  }

  const columns = resolvePendingColumns(options);
  const transitions: DeusTransitionRow<TemplateBoard, TemplateEvent>[] = [];

  for (let rowIndex = 0; rowIndex < table.rowCount; rowIndex += 1) {
    transitions.push(
      ...buildPendingResultExpansions(table, rowIndex, getRow(table, rowIndex), columns).map(
        (entry) => entry.transition,
      ),
    );
  }

  return transitions as readonly DeusTransitionRow<TBoard, TEvent>[];
}
