# MachinaTable

`machinalayout/table` adds a very small table record toolkit for TypeScript.

It is intentionally narrow:

- columnar tables are the canonical form
- row arrays and object arrays are adapters
- diagnostics point to table cells
- there is no SQL, join layer, schema system, or dataframe API

MachinaTable uses columnar authoring as the default because table-shaped data should not repeat the same property names on every row.

## Mental model

Repeated object arrays in app code often hide table data:

```ts
const orders = [
  { id: "order-001", status: "new", totalCents: 1299 },
  { id: "order-002", status: "paid", totalCents: 4599 },
];
```

That is easy for row consumers, but awkward for table authoring because every row repeats the same field names.

MachinaTable flips the default:

- objects are how apps consume rows
- columns are how tables should be authored
- rows should look like rows
- columns should have names
- diagnostics should point to cells

## Columnar authoring

```ts
import { Table } from "machinalayout/table";

const orders = Table.define({
  id: "orders",
  columns: {
    id: ["order-001", "order-002", "order-003"],
    status: ["new", "paid", "cancelled"],
    totalCents: [1299, 4599, 0],
  },
});
```

`Table.define` validates the basic table shape and throws `TableError` if the structure is broken.

## Object row adapter

```ts
const rows = Table.toObjects(orders);
```

Result:

```ts
[
  { id: "order-001", status: "new", totalCents: 1299 },
  { id: "order-002", status: "paid", totalCents: 4599 },
  { id: "order-003", status: "cancelled", totalCents: 0 },
]
```

## Row array adapter

```ts
const fromRows = Table.fromRows({
  id: "orders",
  columns: ["id", "status", "totalCents"] as const,
  rows: [
    ["order-001", "new", 1299],
    ["order-002", "paid", 4599],
  ],
});
```

`Table.toRows(fromRows)` returns:

```ts
[
  ["order-001", "new", 1299],
  ["order-002", "paid", 4599],
]
```

## Object import

```ts
const fromObjects = Table.fromObjects({
  id: "orders",
  rows: [
    { id: "order-001", status: "new" },
    { id: "order-002", status: "paid" },
  ],
});
```

If `columns` is omitted, MachinaTable derives column order from `Object.keys` of the first row. Later rows must match that same shape exactly.

## Cell access

```ts
const status = Table.getCell(orders, 1, "status");
// "paid"
```

You can also read whole columns and whole rows:

```ts
const statusColumn = Table.getColumn(orders, "status");
const secondRow = Table.getRow(orders, 1);
```

## Validation and diagnostics

`Table.validate(table)` returns table diagnostics without throwing:

```ts
const diagnostics = Table.validate({
  kind: "table",
  id: "orders",
  columns: {
    id: ["order-001", "order-002"],
    status: ["new"],
  },
  rowCount: 2,
});
```

Formatting keeps diagnostics table-oriented:

```ts
Table.formatDiagnostics(diagnostics);
```

Example output:

```txt
error ColumnLengthMismatch at orders.status
  Column "status" has length 1 but expected 2.
```

## Boundary

MachinaTable is not:

- a database
- SQL
- a dataframe clone
- a schema validator
- a persistence layer

M35a is only table shape and conversion.
