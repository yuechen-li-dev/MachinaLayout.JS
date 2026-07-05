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
  readonly path?: string;
  readonly source?: string;
  readonly details?: readonly string[];
};
```

Keep the shape small. M34k does not add spans, fixes, telemetry, logging, schema validation, or a new exception hierarchy.

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

Formatting is deterministic and readable:

```txt
error ORDER_NEGATIVE_TOTAL at orders[2].totalCents
  source: toolkit-pipeline
  Order total must be non-negative.
  - value: -100
```

## Converting subsystem diagnostics

Existing subsystems do not need an immediate internal rewrite. `D.from` converts compatible diagnostic arrays into the shared shape:

```ts
const conceptDiagnostics = D.from(T.validate(OrderShape, order), {
  source: "concept",
});
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
