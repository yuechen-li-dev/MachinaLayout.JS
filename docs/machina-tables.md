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

MachinaTable is also the authoring surface for concept source rows:

- concepts are source
- tables organize concepts
- downstream systems can later project concepts into forms, layouts, docs, or render records

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

## Keyed tables

A key column turns a table into a lookup surface, but the table remains columnar.

`Table.keyBy` builds an explicit keyed artifact from an existing columnar table:

```ts
const orders = Table.defineWithSchema({
  id: "orders",
  schema: Table.schema({
    id: Table.string(),
    status: Table.enum(["new", "paid"] as const),
    totalCents: Table.number(),
  }),
  columns: {
    id: ["order-001", "order-002"],
    status: ["new", "paid"],
    totalCents: [1299, 4599],
  },
});

const ordersById = Table.keyBy(orders, "id");

const order = Table.requireLookup(ordersById, "order-001");
```

The keyed lookup is a derived artifact:

- the canonical table stays columnar
- the key column must exist
- key cells must be unique `string` or `number` values
- the index is explicit instead of hidden object mutation

Use `Table.lookup(keyed, key)` when a missing key is acceptable. It returns `undefined` when the key is absent.

Use `Table.requireLookup(keyed, key)` when the key must exist. It throws `TableError` with table diagnostics such as:

```txt
error MissingTableKey at orders.id
  Key "order-999" does not exist in table "orders" for column "id".
```

`Table.validateKey(table, "id")` runs the same checks without throwing, and `Table.describeKeyed(keyed)` returns a compact keyed artifact summary.

Current boundary:

- no joins
- no compound keys
- no query language
- no database layer

## Export and render helpers

`Table.toColumnarJson` preserves the canonical columnar table shape.

```ts
const json = Table.toColumnarJson(orders);
```

Expected shape:

```json
{
  "kind": "columnarTable",
  "id": "orders",
  "rowCount": 2,
  "columns": {
    "id": ["order-001", "order-002"],
    "status": ["new", "paid"]
  }
}
```

This is the canonical table JSON export:

- columns stay columns
- rowCount stays explicit
- table shape is preserved for docs, diagnostics, and artifacts

`Table.toJsonObjects` is the explicit consumer adapter:

```ts
const rows = Table.toJsonObjects(orders);
```

Use it when another consumer wants row objects. It is not canonical table JSON.

You can restore canonical tables with `Table.fromColumnarJson(json)`.

For readable source snippets, docs, and reports:

```ts
Table.toMarkdown(orders);
Table.preview(orders);
```

Example Markdown:

```md
| id | status | totalCents |
| --- | --- | --- |
| order-001 | new | 1299 |
| order-002 | paid | 4599 |
```

`Table.describe(table)` returns a compact table summary, and `Table.preview(table)` pairs that summary with a Markdown preview. `Table.toCsv(table)` is available for simple export when CSV is the target format.

## Deriving tables

MachinaTable can derive new tables without leaving the canonical columnar shape:

- derivation helpers return new columnar tables
- they do not mutate the input table
- they preserve table shape instead of degrading into row-object JSON
- canonical export remains columnar after derivation
- schema is preserved where supported

Available helpers:

- `Table.select(table, columns)`
- `Table.filter(table, predicate)`
- `Table.filterRows(table, predicate)`
- `Table.sortBy(table, column, direction?)`
- `Table.take(table, count)`
- `Table.drop(table, count)`
- `Table.renameColumns(table, rename)`

These are narrow table derivation helpers, not a query language:

- no SQL
- no joins
- no groupBy
- no aggregate
- no dataframe API

For inspectable in-memory query chains over these helpers, use `machinalayout/query`.
MachinaQuery stores a query as explicit derivation plan records, validates that plan,
then executes it through the same `Table.select`, `Table.filterRows`, `Table.sortBy`,
`Table.take`, `Table.drop`, and `Table.renameColumns` helpers.
Its M36b iterator runner exposes operation-level progress, board state, and trace events for
in-memory plans without adding storage, chunk scans, SQL, joins, or database semantics.

Use `Table.filterRows` when you want a columnar-friendly predicate that reads cells directly:

```ts
const paid = Table.filterRows(orders, ({ getCell }) => getCell("status") === "paid");
```

Use `Table.filter` when row-object convenience is more important than avoiding row projection:

```ts
const paidObjects = Table.filter(orders, (row) => row.status === "paid");
```

Projection keeps the table table-shaped:

```ts
const paidSummary = Table.select(paid, ["id", "totalCents"] as const);
```

Sorting reorders rows without mutating columns in place:

```ts
const topOrders = Table.take(
  Table.sortBy(orders, "totalCents", "desc"),
  10,
);
```

Rename remains columnar too:

```ts
const display = Table.renameColumns(orders, {
  totalCents: "total",
});
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

## Dispatch tables

MachinaTable can author rows for the existing MachinaDispatch runtime without replacing it.

```ts
import { Table } from "machinalayout/table";
import { defineDispatchTables, setDispatchTableFromTable } from "machinalayout/dispatch";

const routeActions = Table.define({
  id: "routeActions",
  columns: {
    event: ["nav.home", "nav.settings"],
    field: ["route", "route"],
    value: ["home", "settings"],
  },
});

const dispatch = defineDispatchTables({
  set: setDispatchTableFromTable(routeActions, {
    event: "event",
    field: "field",
    value: "value",
  }),
});
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- MachinaDispatch is still the runtime form.
- Failures point to table cells such as `routeActions.event[1]` or `routeActions.field[0]`.

## Atlas tables

MachinaTable can also author rows for the existing MachinaAtlas runtime without replacing it.

```ts
import { Atlas } from "machinalayout/atlas";
import { Table } from "machinalayout/table";

const schedulingAtlas = Table.defineWithSchema({
  id: "schedulingAtlas",
  schema: Atlas.sectionTableSchema(),
  columns: {
    key: ["setup", "shared-format"],
    name: ["Provider setup wizard", "Shared formatters"],
    kind: ["page", "shared"],
    route: ["/apps/scheduling/setup", undefined],
    file: [undefined, "shared/format.ts"],
    fixture: ["provider-setup", undefined],
    owns: [["ProviderSetupFlow"], ["slotKey", "statusLabel"]],
    uses: [["shared/format"], []],
    usedBy: [["shared-shell"], ["setup", "landing"]],
    tags: [["scheduling", "setup"], ["shared", "pure"]],
    notes: ["M0 deliverable.", "Pure, no React."],
  },
});

const atlas = Atlas.defineAtlasFromTable({
  app: "Scheduling",
  sections: schedulingAtlas,
});
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- MachinaAtlas is still the runtime/project-cartography owner.
- Array cells such as `owns`, `uses`, `usedBy`, and `tags` stay arrays.
- No file scanning or dependency inference is added.

## Form field tables

MachinaTable can also author form field definitions without turning Machina into a form framework.

```ts
import { Form } from "machinalayout/form";
import { Table } from "machinalayout/table";

const providerFields = Table.defineWithSchema({
  id: "providerFields",
  schema: Form.fieldSchema(),
  columns: {
    field: ["displayName", "slug", "description"],
    label: ["Provider name", "Public slug", "Short public description"],
    control: ["input", "input", "textarea"],
    inputId: [
      "setup-provider-name",
      "setup-provider-slug",
      "setup-provider-description",
    ],
    value: [draft.provider.displayName, draft.provider.slug, draft.provider.description],
    changeKey: ["displayName", "slug", "description"],
    disabled: [false, false, false],
    placeholder: [undefined, undefined, undefined],
    description: [undefined, undefined, undefined],
    required: [true, true, false],
    testId: [
      "setup-provider-name",
      "setup-provider-slug",
      "setup-provider-description",
    ],
  },
});

const fields = Form.fieldsFromTable(providerFields);
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- `machinalayout/form` is only a lowering bridge to explicit field records.
- Rendering stays in your UI layer.

MachinaForm does not manage form state. It makes field definitions table-shaped and validates them by cell.

## Projecting concepts into form fields

Concept tables can also feed the narrow concept-to-form projection bridge.

Concept-to-form projection does not manage form state. It maps concept records into field records using caller-supplied values and projection options.

```ts
import { Form } from "machinalayout/form";
import { T } from "machinalayout/concept";

const concepts = T.conceptsFromTable(providerConcepts);

const fields = Form.fieldsFromConcepts(concepts, {
  values: {
    displayName: draft.provider.displayName,
    slug: draft.provider.slug,
    timeZoneId: draft.provider.timeZoneId,
    contactEmail: draft.provider.contactEmail,
    description: draft.provider.description,
  },
  disabled: () => !onProviderFieldChange || !entities.provider,
  inputIdPrefix: "setup-provider",
  testIdPrefix: "setup-provider",
});
```

Or compose directly from the concept table:

```ts
const fields = Form.fieldsFromConceptTable(providerConcepts, {
  projection: {
    values,
    disabled: true,
  },
});
```

The boundary stays narrow:

- `machinalayout/table` authors the source table
- `machinalayout/concept` lowers it to semantic source records
- `machinalayout/form` projects it to field render records
- the app still owns rendering and state

## Concept tables

MachinaTable can also author concept source records without turning Machina into a form framework or validation clone.

```ts
import { T } from "machinalayout/concept";
import { Table } from "machinalayout/table";

const providerConcepts = Table.defineWithSchema({
  id: "providerConcepts",
  schema: T.conceptTableSchema(),
  columns: {
    concept: ["displayName", "slug", "status"],
    type: ["string", "string", "enum"],
    label: ["Provider name", "Public slug", "Status"],
    required: [true, true, true],
    description: [undefined, "Public URL-safe identifier.", undefined],
    diagnosticLabel: ["provider name", "provider slug", "status"],
    controlHint: ["input", "input", "select"],
    valuePath: [
      "draft.provider.displayName",
      "draft.provider.slug",
      "draft.provider.status",
    ],
    changeKey: ["displayName", "slug", "status"],
    enumValues: [undefined, undefined, ["draft", "live", "archived"]],
    literalValue: [undefined, undefined, undefined],
    placeholder: [undefined, undefined, undefined],
    testId: ["setup-provider-name", "setup-provider-slug", "setup-provider-status"],
  },
});

const concepts = T.conceptsFromTable(providerConcepts);
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- `machinalayout/concept` is a narrow lowering bridge to explicit source records.
- M35k does not render forms, place layouts, or generate third-party schemas.

Use `T.validateConceptTable(table)` when you want cell-oriented diagnostics without throwing.

Example diagnostic:

```txt
error MissingConceptEnumValues at providerConcepts.enumValues[2]
  Concept "status" has type "enum" but no enum values.
```

Concept tables are intentionally flat in M35k:

- no recursive concepts
- no nested object trees
- no arrays
- no schema generation layer

## Command tables

MachinaTable can also author command/button definitions without turning Machina into a command runtime.

```ts
import { Command } from "machinalayout/command";
import { Table } from "machinalayout/table";

const setupCommands = Table.defineWithSchema({
  id: "setupCommands",
  schema: Command.commandSchema(),
  columns: {
    command: ["provider", "resource", "service", "availability"],
    label: [
      "Create provider",
      "Create resource",
      "Create service",
      "Create availability",
    ],
    busyLabel: ["Creating...", "Creating...", "Creating...", "Creating..."],
    doneLabel: [
      "Provider created",
      "Resource created",
      "Service created",
      "Availability created",
    ],
    testId: [
      "setup-create-provider",
      "setup-create-resource",
      "setup-create-service",
      "setup-create-availability",
    ],
    disabled: [false, true, true, true],
    busy: [false, false, false, false],
    done: [false, false, false, false],
    description: [undefined, undefined, undefined, undefined],
    variant: [undefined, undefined, undefined, undefined],
  },
});

const commands = Command.commandsFromTable(setupCommands);
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- `machinalayout/command` is only a lowering bridge to explicit command records.
- Execution and rendering stay in your UI layer.

MachinaCommand does not execute commands. It makes command/button definitions table-shaped and validates them by cell.

## State transition tables

MachinaTable can also author rows for the existing DeusMachina runtime without replacing it.

```ts
import * as Deus from "machinalayout/deus";
import { Table } from "machinalayout/table";

const available = ["available"] as const;
const picker = ["picker"] as const;

const pickerTransitions = Table.defineWithSchema({
  id: "pickerTransitions",
  schema: Table.schema({
    key: Table.string(),
    from: Table.unknown(),
    event: Table.string(),
    to: Table.optional(Table.unknown()),
    do: Table.optional(Table.unknown()),
  }),
  columns: {
    key: [
      "openPicker",
      "keepCurrentTime",
      "picker.slotsLoaded",
      "picker.selectDate",
    ],
    from: [available, picker, picker, picker],
    event: ["openPicker", "keepCurrentTime", "slotsLoaded", "selectDate"],
    to: [picker, available, undefined, undefined],
    do: [
      undefined,
      undefined,
      (board, event) => {
        if (event.type !== "slotsLoaded") return;
        board.slots = event.slots;
      },
      (board, event) => {
        if (event.type !== "selectDate") return;
        board.selectedDateKey = event.dateKey;
        board.selectedSlotKey = undefined;
      },
    ],
  },
});

const machine = Deus.defineDeusMachine({
  initial: available,
  states: [{ path: available }, { path: picker }],
  transitions: Deus.transitionsFromTable(pickerTransitions),
});
```

This keeps the dependency direction clean:

- MachinaTable is the authoring and diagnostic surface.
- DeusMachina still owns runtime semantics and stepping.
- `Deus.transitionsFromTable(...)` is only a lowering bridge.
- Failures point to cells such as `pickerTransitions.key[3]` or `pickerTransitions.do[2]`.

Use `Deus.validateTransitionsTable(table)` when you want diagnostics without throwing. `Deus.transitionsFromTable(table)` throws `TableError` on invalid transition tables.

## Transition template tables

Concrete transition tables are for direct runtime rows: one source row becomes one transition.

Template tables are for repeated intent: one source row expands into a repeated transition family, then lowers into ordinary Deus transition rows. Diagnostics still point back to the original source row and cell.

The built-in pending-result template covers repeated pending-success-failure flows:

```ts
import * as Deus from "machinalayout/deus";
import { Table } from "machinalayout/table";

const idle = ["idle"] as const;
const providerPending = ["providerPending"] as const;
const resourcePending = ["resourcePending"] as const;
const servicePending = ["servicePending"] as const;
const availabilityPending = ["availabilityPending"] as const;

const pendingResults = Table.defineWithSchema({
  id: "pendingResults",
  schema: Table.schema({
    entity: Table.string(),
    pending: Table.unknown(),
    successEvent: Table.string(),
    failureEvent: Table.string(),
    successTarget: Table.string(),
    successPayload: Table.string(),
    failurePayload: Table.string(),
    to: Table.unknown(),
  }),
  columns: {
    entity: ["provider", "resource", "service", "availability"],
    pending: [providerPending, resourcePending, servicePending, availabilityPending],
    successEvent: [
      "providerCreated",
      "resourceCreated",
      "serviceCreated",
      "availabilityCreated",
    ],
    failureEvent: ["providerFailed", "resourceFailed", "serviceFailed", "availabilityFailed"],
    successTarget: ["provider", "resource", "service", "availabilityRule"],
    successPayload: ["provider", "resource", "service", "rule"],
    failurePayload: ["message", "message", "message", "message"],
    to: [idle, idle, idle, idle],
  },
});

const transitions = Deus.pendingResultTransitionsFromTable(pendingResults);
```

If you want the generic template bridge:

```ts
const template = Deus.pendingResultTransitionTemplate();
const transitions = Deus.transitionsFromTemplateTable(pendingResults, template);
```

This remains intentionally narrow:

- MachinaTable is still the authoring and diagnostic surface.
- DeusMachina still owns runtime semantics.
- Template tables are not a macro system, query engine, or code generation framework.

## Boundary

MachinaTable is not:

- a database
- SQL
- a dataframe clone
- a general-purpose schema validator
- a persistence layer
- a nested object schema system

M35b adds typed columns and schema validation while keeping columnar tables canonical.
