import { Table, type ColumnarTable, type TableSortDirection } from "../table";
import type { TableQueryDiagnostic, TableQueryOperation, TableQueryPlan } from "./types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTable(value: unknown): value is ColumnarTable {
  if (!isObject(value)) {
    return false;
  }

  return value.kind === "table" && isObject(value.columns) && typeof value.rowCount === "number";
}

function operationPath(planId: string | undefined, index: number, property?: string): string {
  const prefix = planId && planId.trim().length > 0 ? planId : "query";
  return `${prefix}.operations[${index}]${property ? `.${property}` : ""}`;
}

function createDiagnostic(
  planId: string | undefined,
  input: Omit<TableQueryDiagnostic, "severity" | "planId"> & {
    readonly severity?: TableQueryDiagnostic["severity"];
  },
): TableQueryDiagnostic {
  return {
    severity: input.severity ?? "error",
    planId,
    ...input,
  };
}

function hasColumn(columns: readonly string[] | undefined, column: string): boolean {
  return columns === undefined || columns.includes(column);
}

function validateSelect(
  planId: string | undefined,
  operation: TableQueryOperation,
  operationIndex: number,
  columns: readonly string[] | undefined,
  diagnostics: TableQueryDiagnostic[],
): readonly string[] | undefined {
  if (operation.kind !== "select") {
    return columns;
  }

  if (!Array.isArray(operation.columns) || operation.columns.length === 0) {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQuerySelectColumns",
        message: `Operation ${operationIndex} select must include at least one column.`,
        operationIndex,
        operationKind: operation.kind,
        path: operationPath(planId, operationIndex, "columns"),
      }),
    );
    return [];
  }

  const seen = new Set<string>();
  const nextColumns: string[] = [];

  operation.columns.forEach((column, columnIndex) => {
    const path = `${operationPath(planId, operationIndex, "columns")}[${columnIndex}]`;
    if (typeof column !== "string" || column.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "InvalidQuerySelectColumns",
          message: `Operation ${operationIndex} select column at index ${columnIndex} must be a non-empty string.`,
          operationIndex,
          operationKind: operation.kind,
          column,
          path,
        }),
      );
      return;
    }

    if (seen.has(column)) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "DuplicateQuerySelectColumn",
          message: `Operation ${operationIndex} select includes duplicate column "${column}".`,
          operationIndex,
          operationKind: operation.kind,
          column,
          path,
        }),
      );
      return;
    }

    if (!hasColumn(columns, column)) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "MissingQuerySelectColumn",
          message: `Operation ${operationIndex} select references missing column "${column}".`,
          operationIndex,
          operationKind: operation.kind,
          column,
          path,
        }),
      );
    }

    seen.add(column);
    nextColumns.push(column);
  });

  return nextColumns;
}

function validateRename(
  planId: string | undefined,
  operation: TableQueryOperation,
  operationIndex: number,
  columns: readonly string[] | undefined,
  diagnostics: TableQueryDiagnostic[],
): readonly string[] | undefined {
  if (operation.kind !== "renameColumns") {
    return columns;
  }

  if (!isObject(operation.rename)) {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQueryRenameTarget",
        message: `Operation ${operationIndex} renameColumns must receive a rename object.`,
        operationIndex,
        operationKind: operation.kind,
        path: operationPath(planId, operationIndex, "rename"),
      }),
    );
    return columns;
  }

  const rename = operation.rename;
  const nextColumns = columns?.map((column) => rename[column] ?? column);
  const seenTargets = new Set<string>();

  for (const [source, target] of Object.entries(rename)) {
    const path = `${operationPath(planId, operationIndex, "rename")}.${source}`;

    if (typeof source !== "string" || source.trim().length === 0 || !hasColumn(columns, source)) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "MissingQueryRenameColumn",
          message: `Operation ${operationIndex} renameColumns references missing column "${source}".`,
          operationIndex,
          operationKind: operation.kind,
          column: source,
          path,
        }),
      );
    }

    if (typeof target !== "string" || target.trim().length === 0) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "InvalidQueryRenameTarget",
          message: `Operation ${operationIndex} renameColumns target for "${source}" must be a non-empty string.`,
          operationIndex,
          operationKind: operation.kind,
          column: source,
          path,
        }),
      );
    }
  }

  for (const column of nextColumns ?? []) {
    if (seenTargets.has(column)) {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "DuplicateQueryRenameTarget",
          message: `Operation ${operationIndex} renameColumns would create duplicate column "${column}".`,
          operationIndex,
          operationKind: operation.kind,
          column,
          path: operationPath(planId, operationIndex, "rename"),
        }),
      );
      continue;
    }

    seenTargets.add(column);
  }

  return nextColumns;
}

function isSortDirection(value: unknown): value is TableSortDirection {
  return value === "asc" || value === "desc";
}

function asQueryOperation(operation: Record<string, unknown>): TableQueryOperation {
  return operation as unknown as TableQueryOperation;
}

export function validate(queryPlan: TableQueryPlan): TableQueryDiagnostic[] {
  const diagnostics: TableQueryDiagnostic[] = [];
  const planId = isObject(queryPlan) && typeof queryPlan.id === "string" ? queryPlan.id : undefined;

  if (!isObject(queryPlan) || queryPlan.kind !== "tableQueryPlan") {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQueryOperation",
        message: 'Query plan must be an object with kind "tableQueryPlan".',
      }),
    );
    return diagnostics;
  }

  if (typeof queryPlan.id !== "string" || queryPlan.id.trim().length === 0) {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQueryPlanId",
        message: "Query plan id must be a non-empty string.",
        path: "id",
      }),
    );
  }

  if (
    !isTable(queryPlan.source) ||
    Table.validate(queryPlan.source).some((d) => d.severity === "error")
  ) {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQuerySource",
        message: "Query plan source must be a valid ColumnarTable.",
        path: `${queryPlan.id}.source`,
      }),
    );
  }

  if (!Array.isArray(queryPlan.operations)) {
    diagnostics.push(
      createDiagnostic(planId, {
        code: "InvalidQueryOperation",
        message: "Query plan operations must be an array.",
        path: `${queryPlan.id}.operations`,
      }),
    );
    return diagnostics;
  }

  let columns: readonly string[] | undefined = isTable(queryPlan.source)
    ? Table.columnNames(queryPlan.source)
    : undefined;

  queryPlan.operations.forEach((operation, operationIndex) => {
    if (!isObject(operation) || typeof operation.kind !== "string") {
      diagnostics.push(
        createDiagnostic(planId, {
          code: "InvalidQueryOperation",
          message: `Operation ${operationIndex} must be a query operation record.`,
          operationIndex,
          path: operationPath(planId, operationIndex),
        }),
      );
      return;
    }

    const queryOperation = asQueryOperation(operation);

    switch (operation.kind) {
      case "select":
        columns = validateSelect(planId, queryOperation, operationIndex, columns, diagnostics);
        break;
      case "where":
      case "filterRows":
        if (typeof operation.predicate !== "function") {
          diagnostics.push(
            createDiagnostic(planId, {
              code: "InvalidQueryPredicate",
              message: `Operation ${operationIndex} ${operation.kind} predicate must be a function.`,
              operationIndex,
              operationKind: operation.kind,
              path: operationPath(planId, operationIndex, "predicate"),
            }),
          );
        }
        break;
      case "sortBy":
        if (typeof operation.column !== "string" || operation.column.trim().length === 0) {
          diagnostics.push(
            createDiagnostic(planId, {
              code: "MissingQuerySortColumn",
              message: `Operation ${operationIndex} sortBy must reference a non-empty column name.`,
              operationIndex,
              operationKind: operation.kind,
              path: operationPath(planId, operationIndex, "column"),
            }),
          );
        } else if (!hasColumn(columns, operation.column)) {
          diagnostics.push(
            createDiagnostic(planId, {
              code: "MissingQuerySortColumn",
              message: `Operation ${operationIndex} sortBy references missing column "${operation.column}".`,
              operationIndex,
              operationKind: operation.kind,
              column: operation.column,
              path: operationPath(planId, operationIndex, "column"),
            }),
          );
        }

        if (!isSortDirection(operation.direction)) {
          diagnostics.push(
            createDiagnostic(planId, {
              code: "InvalidQuerySortDirection",
              message: `Operation ${operationIndex} sortBy direction must be "asc" or "desc".`,
              operationIndex,
              operationKind: operation.kind,
              path: operationPath(planId, operationIndex, "direction"),
            }),
          );
        }
        break;
      case "take":
      case "drop":
        if (
          typeof operation.count !== "number" ||
          !Number.isInteger(operation.count) ||
          operation.count < 0
        ) {
          diagnostics.push(
            createDiagnostic(planId, {
              code: "InvalidQuerySliceCount",
              message: `Operation ${operationIndex} ${operation.kind} count must be a non-negative integer.`,
              operationIndex,
              operationKind: operation.kind,
              path: operationPath(planId, operationIndex, "count"),
            }),
          );
        }
        break;
      case "renameColumns":
        columns = validateRename(planId, queryOperation, operationIndex, columns, diagnostics);
        break;
      default:
        diagnostics.push(
          createDiagnostic(planId, {
            code: "InvalidQueryOperation",
            message: `Operation ${operationIndex} has unsupported kind "${operation.kind}".`,
            operationIndex,
            operationKind: operation.kind,
            path: operationPath(planId, operationIndex, "kind"),
          }),
        );
    }
  });

  return diagnostics;
}

export class TableQueryError extends Error {
  readonly diagnostics: readonly TableQueryDiagnostic[];

  constructor(diagnostics: readonly TableQueryDiagnostic[], message?: string) {
    super(message ?? formatQueryDiagnostics(diagnostics));
    this.name = "TableQueryError";
    this.diagnostics = [...diagnostics];
  }
}

export function formatQueryDiagnostics(diagnostics: readonly TableQueryDiagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const location = diagnostic.path ? ` at ${diagnostic.path}` : "";
      return `${diagnostic.severity} ${diagnostic.code}${location}\n  ${diagnostic.message}`;
    })
    .join("\n");
}
