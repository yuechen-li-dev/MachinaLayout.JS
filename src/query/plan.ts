import type { ColumnarTable } from "../table";
import type { TableQueryOperation, TableQueryPlan } from "./types";

function defaultQueryId(source: ColumnarTable): string {
  return `${source.id}.query`;
}

function cloneOperation(operation: TableQueryOperation): TableQueryOperation {
  switch (operation.kind) {
    case "select":
      return { kind: "select", columns: [...operation.columns] };
    case "where":
      return { kind: "where", predicate: operation.predicate };
    case "filterRows":
      return { kind: "filterRows", predicate: operation.predicate };
    case "sortBy":
      return { kind: "sortBy", column: operation.column, direction: operation.direction };
    case "take":
      return { kind: "take", count: operation.count };
    case "drop":
      return { kind: "drop", count: operation.count };
    case "renameColumns":
      return { kind: "renameColumns", rename: { ...operation.rename } };
  }
}

export function plan<TTable extends ColumnarTable>(input: {
  readonly id?: string;
  readonly source: TTable;
  readonly operations: readonly TableQueryOperation[];
}): TableQueryPlan<TTable> {
  return {
    kind: "tableQueryPlan",
    id: input.id ?? defaultQueryId(input.source),
    source: input.source,
    operations: input.operations.map(cloneOperation),
  };
}
