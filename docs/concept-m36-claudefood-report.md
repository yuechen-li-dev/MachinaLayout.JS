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
9. **Legacy `T.HasField`/`All`/`Satisfies` kept, documented as legacy.** I'd delete them before 1.0. I didn't, to keep this change non-breaking for type-helper users.

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

## Verification

- `tsc --noEmit`: clean. Biome: clean on touched files.
- Vitest: 1188 passed, 3 failed. The 3 failures are the same ones as on `main` before this change: the `machina-style-dogfood` build, `static-html-http`, and `toolkit-pipeline` checked-in `dist/report.json`, which isn't in the repo. The toolkit sample file went from failing to load to 9/10 passing once the package is built.
- 23 new tests (`concept-claudefood-layout`, `concept-overload-registry`). The fixture generator verifies itself against the validator.
- Type-check cost: about 14% more instantiations repo-wide (153k → 175k), +0.16s, mostly from the `LayoutRow` dogfood.

## Not done / next

- `ConceptRecord` (concept tables → forms) is still a separate model from `ConceptDefinition`. Next step: lower `ConceptRecord[]` into a `ConceptDefinition` so tables get inference and overloads.
- Overload dispatch validates every candidate (O(n × validation)). Fine at authoring and tool boundaries; it would need discriminant indexing for hot paths.
- No recursive (self-referential) concepts.
- `T.registry` + `T.explain` would make a natural Oblivion card.
