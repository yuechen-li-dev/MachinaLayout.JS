# Everyday ergonomics: implementation + Claudefood report

Goal: reduce the TypeScript noise that libraries *can* fix, without adding the abstraction layers that cause most of it. The rule I set for myself was that every helper gets adopted across this repo's own code in the same PR, and ships only if that adoption deletes code or fixes bugs. Measured results are below, including where a helper failed that rule.

## What shipped

| Helper | Where | Replaces |
|---|---|---|
| `V.variants` | `machinalayout/variants` | union type + constructors + guards + `switch` + concept, declared separately |
| `withDefaults` | `machinalayout/kit` | `{ ...defaults, ...options }` (undefined-clobber bug) and `??` chains |
| `must`, `invariant` | `machinalayout/kit` | `if (!x) { throw new Error(...) }` guard clauses |
| `Text.lines` / `list` / `block` / `indent` / `blank` | `machinalayout/text` | `const lines = []; if (…) lines.push(…); return lines.join("\n")` |
| `resolveColumnNames`, `ColumnNames` | `machinalayout/table` | 7 modules each listing column keys three times (option, default, resolved type) |
| `validateConstraintValue` | `machinalayout/concept` | validating against a union/array constraint, not only a whole concept (needed by variants) |

## Measured adoption

Helper sources and tests total about 600 lines. Adoption across `src/` is **+362 / −485 (net −123) over 34 files**, plus −50 in the `LayoutRow` dogfood test and +4 in samples.

| Helper | Sites | Δ lines | Verdict |
|---|---|---|---|
| `Text.lines` | 13 formatters | +167 / −216 | passes; output byte-identical (snapshot tests) |
| `resolveColumnNames` | 7 modules | +105 / −155 | passes, but only after a second iteration (see findings) |
| `invariant` | 25 guard clauses | mostly 3 lines → 1 | passes |
| `V.variants` | `EffectOutcome` in workflow.ts; `FrameSpec` in the dogfood test | +24/−42; +27/−77 (82 → 30 lines) | passes; one declaration replaces type + concept |
| `withDefaults` | 2 | ~0 | **fails the line rule; kept because both sites were real bugs** |
| `must` | 6 (samples only) | +4 | **fails the line rule; kept for readability, weakest of the set** |

Across the repo, the helper code itself costs more lines than this adoption saves. The case for it is the per-call-site improvement for users, plus the bugs and duplication it removed here.

## Decisions worth reviewing

1. **Variant constructors live under `make`.** I proposed `Shape.circle(...)`, but a variant named `match`, `parse` or `validate` would collide with the API. `Shape.make.circle(...)` costs five characters and can't collide.
2. **Variant payloads are concept fields**, so one declaration also gives runtime validation and composes into other concepts with exact types. The cost is that unions over generic type parameters stay plain TS. I think that's the right boundary: those are rarely validated at runtime anyway.
3. **`Text.lines` omits `""`.** `cond && "text"` produces `""` for empty strings, and emitting that as a blank line would be a silent formatting bug. Intentional blanks use `Text.blank`. As a consequence, `Text.lines` is **not for data serializers** (CSV/Markdown rows, where empty lines are data). I left those two serializers alone on purpose.
4. **`must`/`invariant` throw `MachinaInvariantError` with a code.** Existing `MachinaLayoutError` throws were *not* converted, because callers may catch them by class or code, and changing that is a public behavior change. Converted guard clauses now throw a subclass of `Error` with a different `name`. No test depended on the old name.
5. **`withDefaults` returns only defaulted keys.** Merging everything would need much more type machinery for little gain; other options are read directly.

## Claudefood findings

- **Two real bugs fixed.** `formatMachinaAtlasSummary(atlas, { includeRoutes: undefined })` dropped routes even though the default is `true`. `validateMachinaAtlas` had the same spread pattern. Both were confirmed with a reproduction before fixing; a regression test was added.
- **My mechanical refactor introduced a bug, and the tests caught it.** Converting `if (entries.some(e => e.id === id)) throw` to `invariant` flipped the `===` *inside the callback* instead of negating the condition. I fixed it, then audited every converted line: all other negations are top-level. I converted only conditions that negate cleanly (a single comparison or a leading `!`) and left compound conditions alone rather than produce `!(a && !b)` noise.
- **`resolveColumnNames` failed its first measurement (+84 / −68).** The formatter puts the key array one per line, so replacing `key: options?.keyColumn ?? "key"` saved nothing. The real duplication was that each module listed the keys three times: option, default, and resolved type. Deriving the resolved type from a single `as const` key list turned it into +105 / −155 and made a mismatch impossible.
- **The concepts drift guard caught a typing gap in `variants`.** `Frame.constraint` was first typed as a generic union, so `LayoutRow.frame` inferred as `Record<string, unknown>`. `T.implements<LayoutRow>` reported `"differs: frame"`. The constraint is now typed with the exact variant concepts, and a test pins nested inference.
- **Gap closed while dogfooding.** `SerializedEffectError`'s optional `data` field was declared in the type but missing from the snapshot concept. Deriving both from one declaration fixed it.
- **Small behavior change in diagnostics formatting.** Multi-line diagnostic messages now indent every line (previously only the first), and an empty message no longer prints a blank indented line.
- **Formatter collateral reverted.** Running Biome's fixer touched about 50 unrelated files whose imports were already out of order on `main`. I reverted those to keep the diff reviewable; that cleanup belongs in its own commit if you want it.

## Verification

- `tsc --noEmit` is clean. Biome is clean on touched files; the `table/index.ts` import-order warning is the same as on `main`.
- Vitest: 1243 passed, 0 failed (17 new tests).
- All six samples rebuild with unchanged checked-in artifacts.

## Not done / next

- Item 5 from the design pass (one diagnostic shape across modules) is untouched and should be its own PR.
- A minimal `Result` (item 6) still isn't justified by anything found here.
- `must` is the weakest helper. If it never finds real call sites in user code, drop it.
