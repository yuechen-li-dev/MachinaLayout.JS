# MachinaQuery

MachinaQuery is an in-memory derivation-plan layer over ColumnarTable. It is not SQL and it is not a database.

M36 starts the queryable table runtime arc: tables are still ordinary `ColumnarTable` records, but query chains can now be represented as explicit plan records before they run.

The core idea is narrow:

- a query is a derivation plan
- the plan is inspectable before execution
- validation happens before row predicates run
- execution lowers through existing `Table` helpers
- output remains a canonical `ColumnarTable`

Current boundary:

- in-memory only
- no SQL
- no parser
- no joins
- no groupBy
- no aggregate
- no indexes
- no storage, chunks, buckets, or persistence

## Fluent API

```ts
import { Q } from "machinalayout/query";

const paid = Q.from(orders)
  .filterRows(({ getCell }) => getCell("status") === "paid")
  .select(["id", "customerId", "totalCents"] as const)
  .sortBy("totalCents", "desc")
  .take(100)
  .toTable({ id: "paidOrders" });
```

The fluent builder is immutable. Each method appends an operation record and returns a new builder. Nothing executes until `toTable()` or `Q.execute(plan)`.

## Plan Inspection

```ts
const plan = Q.from(orders)
  .select(["id"] as const)
  .toPlan();

console.log(Q.formatPlan(plan));
```

Example formatted output:

```txt
query orders.query from orders
  0 select(id)
```

`Q.describePlan(plan)` returns structured summary records for UI, docs, or debugging tools.

## Function-First Plans

```ts
const plan = Q.plan({
  id: "paidOrders.query",
  source: orders,
  operations: [
    { kind: "filterRows", predicate: ({ getCell }) => getCell("status") === "paid" },
    { kind: "select", columns: ["id", "customerId", "totalCents"] as const },
    { kind: "sortBy", column: "totalCents", direction: "desc" },
    { kind: "take", count: 100 },
  ],
});

const paid = Q.execute(plan, { id: "paidOrders" });
```

This creates the same explicit plan shape as the fluent API.

## Validation

```ts
const bad = Q.from(orders)
  .select(["id"] as const)
  .sortBy("totalCents")
  .toPlan();

const diagnostics = Q.validate(bad);
```

Validation tracks the available columns through `select` and `renameColumns`, so a sort after projection can be rejected before execution:

```txt
error MissingQuerySortColumn at orders.query.operations[1].column
  Operation 1 sortBy references missing column "totalCents".
```

Predicate bodies are not statically analyzed. MachinaQuery only verifies that predicate fields are functions.
