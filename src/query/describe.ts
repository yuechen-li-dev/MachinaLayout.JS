import type { TableQueryOperation, TableQueryPlan, TableQueryPlanDescription } from "./types";

function operationSummary(operation: TableQueryOperation): string {
  switch (operation.kind) {
    case "select":
      return `select(${operation.columns.join(", ")})`;
    case "where":
      return "where(row)";
    case "filterRows":
      return "filterRows(getCell)";
    case "sortBy":
      return `sortBy(${operation.column} ${operation.direction})`;
    case "take":
      return `take(${operation.count})`;
    case "drop":
      return `drop(${operation.count})`;
    case "renameColumns":
      return `renameColumns(${Object.entries(operation.rename)
        .map(([source, target]) => `${source}->${target}`)
        .join(", ")})`;
  }
}

export function describePlan(plan: TableQueryPlan): TableQueryPlanDescription {
  return {
    kind: "tableQueryPlanDescription",
    id: plan.id,
    sourceTableId: plan.source.id,
    operationCount: plan.operations.length,
    operations: plan.operations.map((operation, index) => ({
      index,
      kind: operation.kind,
      summary: operationSummary(operation),
    })),
  };
}

export function formatPlan(plan: TableQueryPlan): string {
  return [
    `query ${plan.id} from ${plan.source.id}`,
    ...describePlan(plan).operations.map(
      (operation) => `  ${operation.index} ${operation.summary}`,
    ),
  ].join("\n");
}
