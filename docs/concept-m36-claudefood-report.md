# M36 typed concepts: implementation + Claudefood report

Goal: make `machinalayout/concept` solve real TypeScript-generics pain (mine as an LLM writing TS), not duplicate TS. In practice that means one declaration for a shape, short and fixable errors, and runtime facts that TypeScript can't express.

## What shipped

| Feature | Pain it targets |
|---|---|
| `T.Infer<typeof C>`; `T.template` input derived from `requires` | Runtime concept and TS type declared twice and drifting |
| `T.implements<Type>()(concept)` | Drift between a concept and a hand-written type that must stay |
| `T.union`, `T.oneOf`, nested concepts, `T.array(el)`, `T.custom` | Old concepts couldn't model real Machina records |
| Refinements: `finite`, `int`, `min`/`max`, `nonEmpty`, NaN rejected by default, `brand` | Things `number` can't say; px/ui coordinate mixing |
| `closed` concepts + did-you-mean | Invented properties (`paddingX`), the most common LLM mistake |
| Diagnostics: indexed paths, discriminant routing, origin concept, `fix` op | 40-line structural TS errors, and "fixing" the wrong layer |
| `T.is` / `T.assert` narrow types | Validated values still needed casts |
| `T.overload` (refinement-ordered dispatch) | Hand-written `if ("radius" in x)` chains; first-match bugs |
| `T.registry` (`capabilities`, `accepting`) | "What can I do with this value?" meant grepping the codebase |
| `T.example` / `T.counterexamples` / `T.explain` | Invented fixtures that were subtly wrong |

New files: `src/concept/{infer,structure,overload,registry,fixtures}.ts`. `validate.ts` and `authoring.ts` were rewritten.

## Decisions worth reviewing

1. **Concepts are constraints.** A `ConceptDefinition` can be used directly as a field (`frame: FrameSpecC`). This makes nesting free, without a separate `T.shape`.
2. **Refinement is structural, not nominal.** Overload ordering uses "every value of A satisfies B", computed from constraints (literal ⊂ enum ⊂ string, `min: 0..1` ⊂ unbounded, closed ⊂ open). It doesn't use `composedFrom`, so independently declared concepts still order correctly. It's conservative: `custom` only refines itself.
3. **Ambiguity is an error, never first-wins.** `AmbiguousOverload` tells you to add the composed template. Equivalent concepts in one overload set throw `DuplicateOverload` at construction, because one of them could never be chosen.
4. **NaN is rejected by default** (`allowNaN` opts out). Silent NaN is the classic layout bug, and the repo already bans silent correctness masking.
5. **`compose` throws on conflicting sources** unless the field is overridden locally. Previously the last source silently won.
6. **Brands are compile-time only.** `T.is(UiPoint, pxValue)` is true at runtime. A runtime unit tag belongs in the data (`{unit: "px"}`), which Machina already does.
7. **The `implements` error is encoded in property names.** TypeScript truncates big types but prints missing property names in full, so the error ends with `"differs: x", "missing in concept: height"`. This is a deliberate hack, and the most useful single trick in the change.
8. **Not a Zod clone, still:** no coercion, transforms, defaults or parsing. Values are accepted or diagnosed. I updated the "What it is not" list in the docs because two of its lines (no inference, no nesting) are now false.
9. **Superseded type helpers removed** (follow-up commit). `HasField`/`All`/`Satisfies`/… were aliases for `{ [K]: V }`, `&` and the identity; `T.Infer` replaces their only real job. Their one good idea, compile-time assertions in tests, already lives in `machinalayout/comptime`, so two table tests now import `Assert`/`Equal` from there.
10. **`ConceptRecord` merged into `ConceptDefinition`** (follow-up commit). Labels and other presentation hints are now `FieldMeta` on any constraint (`T.string({ label })`, `T.meta(c, {...})`). Metadata is ignored by validation, inference and refinement, so a table-lowered concept and an equivalent code-authored one count as equivalent for overloads. `T.conceptFromTable` returns one `ConceptDefinition`; `Form.fieldsFromConcept` projects any concept. The labels default to the field name. Nested, array and union fields report `UnsupportedConceptFormField`. `DuplicateConceptFormField` is gone because field names are now object keys. Form diagnostic paths changed from `concepts[i].x` to `fields.<name>.x`.

## Claudefood findings

I modeled Machina's real `LayoutRow` / `FrameSpec` / `ArrangeSpec` / `UiLength` (`test/concept/concept-claudefood-layout.test.ts`) and pinned each with `T.implements` or `T.Equal`. The whole model matched the hand-written types on the first pass, and negative cases fail as expected.

What I found:

- **Bug in this repo:** `samples/toolkit-pipeline` had `ValidOrder.status: OrderStatus` while its concept said `status: T.string()`. Typed templates flagged it on the first `tsc`. The type is now derived from the concept, and the hand-written `T.All<[...]>` is gone.
- **Bug in my design (fixed):** a typo on an optional field of a closed concept (`paddingX`) disappeared completely. The did-you-mean hint used up the key, which suppressed the closed-concept error, and the union discarded warnings from the branch that matched. Both are fixed and covered by a snapshot.
- **Friction (fixed):** the first `implements` error showed only `conceptDoesNotMatchType`, with the details truncated away. That led to decision 7.
- **Friction (fixed):** `Infer<ConceptDefinition>` (the wide, un-narrowed type) recursed forever in generic code. `Infer` now stops at wide types.
- **Tooling bug (worked around):** tsup's d.ts bundler turned `namespace T { type Infer = InferTypes.Infer }` into a self-reference. The namespace now aliases `InferConcept`. Worth knowing for other namespace re-exports.
- **Kept as-is:** I removed the sample's `totalCents min: 0` because "negative total" is deliberately a domain-policy diagnostic there. Concept refinements shouldn't absorb business rules.

## Breaking changes

- `T.template` with a `run` parameter that doesn't match the concept is now a compile error. That's the intent.
- Numbers reject NaN. An `undefined` field counts as missing.
- Diagnostic message text changed (shorter, includes type and origin). One sample test expectation was updated.
- `T.compose` throws on conflicting sources.

## Failing tests (diagnosed and fixed)

The three failures that predated this work were environment and repo problems, not code bugs:

- `static-html-http` and `toolkit-pipeline` compare against checked-in `dist/` artifacts, but `.gitignore` excluded `dist/` for those two samples (the other static samples are whitelisted). The files were never committed, so the tests could only pass on the machine that generated them. Fix: whitelist them and commit freshly generated output.
- `machina-style-dogfood` runs `npm run build` inside the sample, which needs `@vitejs/plugin-react` and `tsx` from the sample's own lockfile, but nothing installs it. Fix: add both to root devDependencies (`@vitejs/plugin-react@4`, compatible with the root's vite 5), so a root `npm ci` is enough.

## Verification

- `tsc --noEmit`: clean. Biome: clean on touched files.
- Vitest: 1193 passed, 0 failed.
- New tests: `concept-claudefood-layout`, `concept-overload-registry`, plus rewritten table-lowering and form-projection tests for the merged model. The fixture generator verifies itself against the validator.
- Type-check cost: about 14% more instantiations repo-wide (153k → 175k), +0.16s, mostly from the `LayoutRow` dogfood.

## Not done / next

- Table-lowered concepts are runtime values, so `T.Infer` on them is `Record<string, unknown>`. Typed inference for tables would need literal-typed table columns flowing into `conceptFromTable`'s return type.
- Overload dispatch validates every candidate (O(n × validation)). Fine at authoring and tool boundaries; it would need discriminant indexing for hot paths.
- No recursive (self-referential) concepts.
- `T.registry` + `T.explain` would make a natural Oblivion card.
