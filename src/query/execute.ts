import { Table, type ColumnarTable } from "../table";
import type { TableQueryExecuteOptions, TableQueryPlan } from "./types";
import { TableQueryError, validate } from "./validate";

export function execute<TTable extends ColumnarTable>(
  queryPlan: TableQueryPlan<TTable>,
  options?: TableQueryExecuteOptions,
): ColumnarTable {
  const diagnostics = validate(queryPlan);
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    throw new TableQueryError(diagnostics);
  }

  let table: ColumnarTable = queryPlan.source;

  queryPlan.operations.forEach((operation, index) => {
    const id = index === queryPlan.operations.length - 1 ? options?.id : undefined;

    switch (operation.kind) {
      case "select":
        table = Table.select(table, operation.columns, { id });
        break;
      case "where":
        table = Table.filter(table, operation.predicate, { id });
        break;
      case "filterRows":
        table = Table.filterRows(table, operation.predicate, { id });
        break;
      case "sortBy":
        table = Table.sortBy(table, operation.column, operation.direction, { id });
        break;
      case "take":
        table = Table.take(table, operation.count, { id });
        break;
      case "drop":
        table = Table.drop(table, operation.count, { id });
        break;
      case "renameColumns":
        table = Table.renameColumns(table, operation.rename, { id });
        break;
    }
  });

  return table;
}
