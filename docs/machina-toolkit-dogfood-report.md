# Machina Toolkit Dogfood Report

M34h dogfooded the new utility subpaths together in [`samples/toolkit-pipeline`](../samples/toolkit-pipeline), a backend-style order validation, formatting, iteration, enrichment, and report-generation sample that emits checked-in `report.json` and `report.txt` artifacts.

## What Worked Well

- `matchKind` feels good across real payload unions. Validation results, iterator collect results, async task results, and report events all read cleanly with one matching style.
- `T.concept`, `T.validate`, `T.assert`, `T.template`, and `T.runTemplate` are strong for readable runtime contracts. The invalid order produced clear diagnostics immediately.
- `C.task` improves closure readability when the environment matters. The money formatter, diagnostic formatter, and row formatter all benefitted from visible env records and inspectable descriptions.
- `I.machine` and the visible iterator board are useful for backend-ish batch work where cursor and trace are part of the story, not hidden implementation detail.
- `CT.tuple`, `TupleValues`, `KindValues`, and compile-time assertions were easy to apply in real constants and union checks without turning the sample into type-golf.

## What Felt Awkward

- `C.withEnv` keeps the original task id, which is correct mechanically but awkward in descriptions. The sample's alternate-locale formatter still describes itself as `formatMoney`, so report output cannot distinguish variants without extra manual naming.
- `AsyncTask` is workable but a bit verbose for lightweight fake persistence. The task env, result helpers, controller setup, and trace plumbing add ceremony quickly.
- `AsyncTaskResult` works with `matchKind`, but the controller trace currently duplicates a task-authored `started` event beside the controller's own `started` event. The sample report shows that duplication clearly.
- `IterMachine` is useful here, but it is heavier than a plain loop for a one-pass batch. It pays off only because the sample explicitly wants cursor, board, and trace visibility.
- Concept validation and numeric policy validation still live in two different layers. That boundary is honest, but authors need to decide where concept diagnostics stop and domain-policy diagnostics begin.

## Bugs Or Edge Cases Found

- Backend/sample package ergonomics are rough when dogfooding subpath imports from inside this repo without a published install. The sample needed local bridge files plus a generated-JS import-fix step to run cleanly as a nested package.
- `C.withEnv` producing the same task id for all variants creates ambiguous report output. This is probably a docs/naming ergonomics issue more than a hard bug, but it showed up immediately in a realistic sample.
- The async trace surface makes it easy to record semantically duplicated lifecycle events. That is not a runtime failure, but it is easy to produce noisier traces than intended.

## What Should Be Fixed Next

- Add docs for backend-ish Node samples that use the utility subpaths together, not only isolated API snippets.
- Clarify the intended naming story for `C.withEnv` variants. Either recommend wrapping them in a new `C.task` with a new id, or provide a small first-party helper for rebinding env plus id.
- Tighten async trace guidance so task-authored trace events complement controller lifecycle events instead of duplicating them.
- Add one docs example that combines concepts, capture tasks, iterator machines, and async tasks in a single pipeline, because that is where ergonomics questions actually surface.

## What Should Wait

- Do not expand concepts into a general policy-validation framework yet. The split between concept diagnostics and domain diagnostics was manageable in this sample.
- Do not add orchestration, retries, or workflow features to `machinalayout/async` yet. The current friction is mostly verbosity and docs clarity, not a missing scheduler.
- Do not turn `machinalayout/iter` into a streaming abstraction. The existing explicit-machine surface is enough for batch/report workflows.
- Do not add compile-time derivation from runtime concepts in M34h. Naming runtime concepts beside TypeScript aliases was acceptable for this sample.

## M34i Follow-up

- Added `C.rebind` for named env variants.
- Updated `toolkit-pipeline` to use named formatter variants.
- Clarified async trace ownership.
- Updated sample traces to avoid duplicate lifecycle events.

## M34j Follow-up

- Added `A.runSnapshot` to reduce one-shot controller ceremony without hiding the lifecycle receipt.
- Updated `toolkit-pipeline` to use `A.runSnapshot` for async result plus board/trace collection.

## M34k Follow-up

- Added `machinalayout/diagnostics` as a small shared diagnostics helper surface.
- Updated `toolkit-pipeline` to keep concept diagnostics and domain-policy diagnostics separate, but report them together through one shared shape.
- Kept concepts focused on shape and capability validation rather than expanding them into general business-policy validation.
