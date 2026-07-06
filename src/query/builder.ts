import type { ColumnarTable, TableSortDirection } from "../table";
import { describePlan, formatPlan } from "./describe";
import { execute } from "./execute";
import { plan as createPlan } from "./plan";
import type {
  TableQueryBuilder,
  TableQueryCellPredicate,
  TableQueryExecuteOptions,
  TableQueryFromOptions,
  TableQueryOperation,
  TableQueryPlan,
  TableQueryRowPredicate,
} from "./types";
import { validate } from "./validate";

function createBuilder<TTable extends ColumnarTable>(
  queryPlan: TableQueryPlan<TTable>,
): TableQueryBuilder<TTable> {
  const append = (operation: TableQueryOperation): TableQueryBuilder<TTable> =>
    createBuilder(
      createPlan({
        id: queryPlan.id,
        source: queryPlan.source,
        operations: [...queryPlan.operations, operation],
      }),
    );

  return {
    kind: "tableQueryBuilder",
    plan: queryPlan,
    select: (columns) => append({ kind: "select", columns }),
    where: (predicate: TableQueryRowPredicate<TTable>) =>
      append({ kind: "where", predicate: predicate as TableQueryRowPredicate }),
    filterRows: (predicate: TableQueryCellPredicate<TTable>) =>
      append({ kind: "filterRows", predicate: predicate as TableQueryCellPredicate }),
    sortBy: (column: string, direction: TableSortDirection = "asc") =>
      append({ kind: "sortBy", column, direction }),
    take: (count: number) => append({ kind: "take", count }),
    drop: (count: number) => append({ kind: "drop", count }),
    renameColumns: (rename) => append({ kind: "renameColumns", rename }),
    toPlan: () =>
      createPlan({
        id: queryPlan.id,
        source: queryPlan.source,
        operations: queryPlan.operations,
      }),
    validate: () => validate(queryPlan),
    describe: () => describePlan(queryPlan),
    format: () => formatPlan(queryPlan),
    toTable: (options?: TableQueryExecuteOptions) => execute(queryPlan, options),
  };
}

export function from<TTable extends ColumnarTable>(
  table: TTable,
  options?: TableQueryFromOptions,
): TableQueryBuilder<TTable> {
  return createBuilder(
    createPlan({
      id: options?.id,
      source: table,
      operations: [],
    }),
  );
}
