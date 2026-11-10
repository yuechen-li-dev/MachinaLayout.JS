# Compile-Time Helpers

`machinalayout/comptime` adds a small compile-time helper toolkit for proving useful facts before JavaScript runs.

Core thesis:

> If a fact can be known before JavaScript runs, make TypeScript prove it.

Another framing:

> Compile time should not mean arbitrary wizardry first.
> Compile time should mean useful facts proven before runtime.

This module is intentionally narrow.

## What it is

- Compile-time assertions.
- Small type-level extraction helpers.
- A practical string helper for kebab-case class and key derivation.
- Build-time artifact generation (`CT.artifacts`): evaluate pure functions ahead of time into checked-in files, including literal TypeScript modules whose types come out exact.

## What it is not

- Not macros.
- Not a Babel or TypeScript transformer.
- Not source rewriting.
- Not AST analysis.
- Not arbitrary compile-time execution: generators are declared, evaluated deterministically, and their outputs are verified.
- Not type-level partial evaluation. Computing values at build time and emitting literals gives exact types with readable errors; template-literal parsers and deep conditional types do not.
- Not a CLI. `CT.write` / `CT.check` are called from scripts and tests.

`"comptime"` is informal shorthand; this documentation uses "compile time."

## Import surface

```ts
import {
  CT,
  type Assert,
  type Equal,
  type Extends,
  type TupleValues,
  type KindValues,
  type KebabCase,
} from "machinalayout/comptime";
```

`machinalayout/comptime` exports:

- `CT.keys`
- `CT.artifacts`, `CT.text`, `CT.json`, `CT.module`, `CT.ts.exportConst`
- `CT.write`, `CT.check`, `CT.generate`, `CT.formatDiagnostics`, `CT.memoryFs`
- `nodeArtifactFs` from `machinalayout/comptime/node`
- `Assert`
- `Extends`
- `Equal`
- `Not`
- `And`
- `Or`
- `ValueOf`
- `KeysOf`
- `TupleValues`
- `DiscriminantValues`
- `KindValues`
- `KebabCase`
- `NonEmptyTuple`
- `IsNonEmptyTuple`

## Literal-preserving helpers

TypeScript's `as const`, `const` type parameters and `satisfies` now preserve literals directly; the former `CT.tuple` / `CT.object` wrappers were removed in their favor.

```ts
import type { TupleValues } from "machinalayout/comptime";

const modes = ["desktop", "tablet", "phone"] as const;
type Mode = TupleValues<typeof modes>;
```

`CT.keys(...)` remains: it returns string keys with a narrowed key type, which `Object.keys` does not.

```ts
const keys = CT.keys({ header: 1, footer: 2 });
// Array<"header" | "footer">
```

## Build-time artifacts

Some facts are only known by running code: a concept lowered from a table, a static page's HTML, a resolved layout, a report. `CT.artifacts` evaluates those once at build time into checked-in files. `CT.check` then proves that the files on disk are exactly what the generators produce now.

```ts
import { CT } from "machinalayout/comptime";
import { nodeArtifactFs } from "machinalayout/comptime/node";

export const artifacts = CT.artifacts({
  outDir: "src/generated",
  artifacts: [
    // Literal module: `T.Infer<typeof Provider>` is exact, unlike the runtime value.
    CT.module(
      "provider.concept.ts",
      (ctx) =>
        CT.ts.exportConst("Provider", T.conceptFromTable(tableFrom(ctx.json("data/provider.json"))), {
          satisfies: { type: "ConceptDefinition", from: "machinalayout/concept" },
        }),
      { inputs: ["data/provider.json"] },
    ),
    CT.text("index.html", () => serializeStaticPageHtml(page)),
    CT.json("layout.json", () => resolveRows(rows), { concept: ResolvedRows }),
  ],
});

// build script
await CT.write(artifacts, { fs: nodeArtifactFs(), root });

// the one "artifacts in sync" test
expect(await CT.check(artifacts, { fs: nodeArtifactFs(), root })).toEqual([]);
```

Rules that keep it safe:

- **`check` always re-evaluates everything.** Correctness never depends on a cache. Declared `inputs` are read before the generator runs; reading anything else through `ctx` is `UndeclaredInput`. Input hashes are recorded for provenance.
- **Deterministic or it fails.** While a generator runs, `Date.now()`, `new Date()` and `Math.random()` throw (`NondeterministicComptime`). Every artifact is also generated twice and compared, which catches leaks the guard can't see (module state, iteration order). Async generators are allowed: the guard stays active across awaits, so don't run `write`/`check` concurrently with unrelated code.
- **Generated files are owned.** `.machina-artifacts.json` in `outDir` records each artifact's content hash. `write` refuses to overwrite a file it doesn't own (`UnownedFile`) or one edited by hand (`HandEditedArtifact`), unless `force`. A file identical to the generator's output is adopted silently, and orphans the manifest owns are removed.
- **Formatters don't touch outputs.** Exclude every `outDir` from Biome/Prettier. If a formatter rewrites a generated file anyway, the diagnostic says so, because the difference is whitespace-only.
- **Outputs are plain data.** JSON and module values must be JSON-safe; functions, class instances and non-finite numbers get a diagnostic with a path. Key order is preserved (it's meaningful, e.g. concept field order).
- **Paths stay inside `outDir`/root** (no `..`, no absolute paths). An input that is itself a generated artifact is `ComptimeCycle`.
- **Text only.** Binary outputs and external tools (image encoders, Inkscape) stay imperative next to the registry.

`StaleArtifact` diagnostics include a compact `-old` / `+new` hunk.

## Compile-time assertions

These helpers keep tests and docs honest without adding runtime behavior:

```ts
type _modeCheck = Assert<
  Equal<TupleValues<typeof modes>, "desktop" | "tablet" | "phone">
>;
```

`Extends<TValue, TExpected>` is useful when checking assignability:

```ts
type _assignable = Assert<Extends<{ id: string }, { id: string }>>;
```

Boolean combinators stay simple:

- `Not<true>` becomes `false`
- `And<[true, true]>` becomes `true`
- `Or<[false, true]>` becomes `true`

## Union and literal extraction

Tuple and object helpers pair with extraction helpers:

```ts
type Mode = TupleValues<typeof modes>;
type Value = ValueOf<{ a: 1; b: 2 }>;
type Key = KeysOf<{ a: 1; b: 2 }>;
```

Discriminated unions are a common target:

```ts
type CanvasCommand =
  | { kind: "move"; dx: number; dy: number }
  | { kind: "erase"; id: string };

type CommandKind = KindValues<CanvasCommand>;
```

For a different discriminant key:

```ts
type ApiMessage =
  | { type: "ready"; payload: null }
  | { type: "error"; payload: string };

type MessageType = DiscriminantValues<ApiMessage, "type">;
```

## String helper

`KebabCase<T>` covers the common camel-case and Pascal-case cases:

```ts
type ClassName = KebabCase<"buttonPrimary">;
// "button-primary"
```

Examples:

- `KebabCase<"buttonPrimary">` -> `"button-primary"`
- `KebabCase<"ButtonPrimary">` -> `"button-primary"`
- `KebabCase<"button">` -> `"button"`

Acronym handling is intentionally simple in M34g.

## Tuple sanity helpers

`NonEmptyTuple<T>` narrows tuple shapes that must contain at least one item:

```ts
type AtLeastOne = NonEmptyTuple<[1, 2]>;
```

`IsNonEmptyTuple<T>` evaluates to `true` or `false` at compile time.

## Relationship to concepts

`machinalayout/concept` includes a few compile-time helpers for concept-oriented generic constraints.
`machinalayout/comptime` is the general compile-time helper toolkit.

Use `concept` when you want runtime concept records and validation.
Use `machinalayout/comptime` when you want useful facts proven before runtime.

See also: [`samples/toolkit-pipeline`](../samples/toolkit-pipeline) and the [Machina toolkit dogfood report](machina-toolkit-dogfood-report.md) for a real sample that uses `CT.tuple`, `TupleValues`, `KindValues`, `Assert`, `Equal`, and `KebabCase` together.
