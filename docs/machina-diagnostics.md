# Machina Diagnostics

`machinalayout/diagnostics` adds a small shared toolkit for creating, combining, sorting, grouping, and formatting diagnostics.

Core thesis:

> Diagnostics are data. Policy is a caller decision.

This subpath does not turn concepts, capture, async tasks, iterators, static lowering, style validation, or any other subsystem into a general policy-validation framework. It gives those surfaces a small common target shape when callers want to aggregate and report diagnostics consistently.

## What it exports

```ts
import { D, type DiagnosticResult, type MachinaDiagnostic } from "machinalayout/diagnostics";
```

`machinalayout/diagnostics` exports:

- `MachinaDiagnosticSeverity`
- `MachinaDiagnostic`
- `DiagnosticResult`
- `FormatDiagnosticsOptions`
- `error`, `warning`, `info`
- `ok`, `err`
- `collect`
- `hasErrors`, `hasWarnings`
- `sort`
- `groupBySource`
- `format`
- `from`
- `D`

## Shared diagnostic shape

```ts
type MachinaDiagnostic = {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly path?: string; // value path, file, table cell, or line:column
  readonly source?: string; // which module or check produced it
  readonly details?: readonly string[];
  readonly fix?: DiagnosticFix; // add / remove / rename / replace at a path
};
```

This is the one diagnostic shape. Every module's diagnostic type (`ConceptDiagnostic`, `TableDiagnostic`, `WorkflowDiagnostic`, `ArtifactDiagnostic`, `MachinaTextDiagnostic`, …) is `DiagnosticOf<ModuleExtras, ModuleCodes>`, the shared shape plus module-specific fields and a narrowed code union. They combine and format without adapters, and the module-specific fields survive:

```ts
const all = D.collect(T.validate(Order, value), tableDiagnostics, workflowDiagnostics);
// element type: ConceptDiagnostic | TableDiagnostic | WorkflowDiagnostic
```

Each module's `format*Diagnostics` is a view of `D.format` (same engine, same rendering of `fix` and `details`).

Keep the shape small: no spans, telemetry, logging, or exception hierarchy.

## Authoring diagnostics

```ts
const diagnostic = D.error({
  source: "toolkit-pipeline",
  path: "orders[2].totalCents",
  code: "ORDER_NEGATIVE_TOTAL",
  message: "Order total must be non-negative.",
  details: ["value: -100"],
});
```

`D.error`, `D.warning`, and `D.info` return fresh objects and reject empty `code` or `message` strings at runtime.

## Collecting, sorting, grouping, and formatting

```ts
const combined = D.sort(
  D.collect(conceptDiagnostics, domainDiagnostics),
);

const grouped = D.groupBySource(combined);
const text = D.format(combined);
```

Formatting is deterministic and readable. `style: "block"` (default):

```txt
error ORDER_NEGATIVE_TOTAL at orders[2].totalCents
  source: toolkit-pipeline
  Order total must be non-negative.
  - value: -100
```

`style: "line"` gives one line per diagnostic, with the fix inline and details indented below:

```txt
[error] MissingConceptField at orders[2].customerId: missing required string [fix: add orders[2].customerId: string]
```

Options: `includeSeverity`, `includeSource` (default on for `block`, off for `line`), `includePath`, `empty` (text for an empty list).

## Source and nesting

`D.from(diagnostics, { source })` fills in `source` where it's missing. It's lossless: fix hints, table cells and workflow steps are kept.

`D.within(prefix, diagnostics)` re-bases a nested check under a parent path, moving `path` *and* `fix.path` together:

```ts
const conceptDiagnostics = D.within(
  `orders[${index}]`,
  D.from(T.validate(OrderShape, order), { source: "concept" }),
);
// customerId -> orders[2].customerId, and the fix points there too
```

This keeps the boundary honest: concept validation can stay focused on shape and capability checks while callers decide how to combine those diagnostics with their own policy checks.

## Concept diagnostics vs domain diagnostics

Concept diagnostics answer questions like:

- Does this value have the required fields?
- Are those fields the right kinds?
- Does it satisfy the declared capability shape?

Domain diagnostics answer questions like:

- Is `totalCents` allowed to be negative here?
- Is this status permitted by a caller-specific workflow?
- Does a business rule allow this record to proceed?

Those are different layers. `machinalayout/diagnostics` is the shared report shape between them, not a policy engine that merges the layers conceptually.

## Combined example

```ts
const conceptDiagnostics = D.from(T.validate(OrderShape, order), {
  source: "concept",
});

function validateOrderPolicy(order: Order, index: number): MachinaDiagnostic[] {
  const diagnostics: MachinaDiagnostic[] = [];

  if (order.totalCents < 0) {
    diagnostics.push(
      D.error({
        source: "toolkit-pipeline",
        path: `orders[${index}].totalCents`,
        code: "ORDER_NEGATIVE_TOTAL",
        message: "Order total must be non-negative.",
        details: [`value: ${order.totalCents}`],
      }),
    );
  }

  return diagnostics;
}

const reportDiagnostics = D.sort(
  D.collect(conceptDiagnostics, validateOrderPolicy(order, index)),
);
```

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md).
