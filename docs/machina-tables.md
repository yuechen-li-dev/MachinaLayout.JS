# MachinaTable

`machinalayout/table` adds a very small table record toolkit for TypeScript.

It is intentionally narrow:

- columnar tables are the canonical form
- row arrays and object arrays are adapters
- schemas validate columns and cells
- diagnostics point to table cells
- there is no SQL, join layer, nested schema system, or dataframe API

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
- schemas tell columns what they may contain

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

## Schemas and typed columns

Schemas stay table-shaped too:

```ts
const orderSchema = Table.schema({
  id: Table.string(),
  status: Table.enum(["new", "paid", "fulfilled", "cancelled"] as const),
  totalCents: Table.number(),
  note: Table.optional(Table.string()),
});

const orders = Table.defineWithSchema({
  id: "orders",
  schema: orderSchema,
  columns: {
    id: ["order-001"],
    status: ["paid"],
    totalCents: [1299],
    note: [undefined],
  },
});
```

Available column helpers:

- `Table.string()`
- `Table.number()`
- `Table.boolean()`
- `Table.literal(value)`
- `Table.enum(values)`
- `Table.unknown()`
- `Table.optional(schema)`
- `Table.schema(columns)`

Schemas validate cell values without coercion:

- strings stay strings
- numbers stay numbers
- booleans stay booleans
- optional columns may contain `undefined`
- `Table.unknown()` is the explicit escape hatch

MachinaTable does not parse, transform, or coerce values for you.

If you already have a plain columnar table, attach a schema afterward:

```ts
const typedOrders = Table.withSchema(
  Table.fromObjects({
    id: "orders",
    rows: [{ id: "order-001", status: "paid", totalCents: 1299, note: undefined }],
  }),
  orderSchema,
);
```

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

For schema tables, `Table.toObjects` and `Table.getRow` preserve practical TypeScript types such as enum unions and literal columns.

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

Schema diagnostics stay cell-oriented too:

```txt
error InvalidTableCell at orders.totalCents[2]
  Column "totalCents" expected number but received string.
```

## Boundary

MachinaTable is not:

- a database
- SQL
- a dataframe clone
- a general-purpose schema validator
- a persistence layer
- a nested object schema system

M35b adds typed columns and schema validation while keeping columnar tables canonical.
