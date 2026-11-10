# Effect workflows: implementation + Claudefood report

The goal was to make `machinalayout/iter` fix real problems with TypeScript `yield`, not just exist alongside it. The three it targets:

1. `yield` responses are untyped.
2. Generators are tested through async mocks.
3. A generator in flight cannot be snapshotted or resumed.

Stacked on the typed-concepts PR (#66), because response checking and snapshot validation use concepts.

## What shipped

| Feature | Pain it targets |
|---|---|
| `I.effect` + `yield*` delegation | `const x = yield ...` is `any`; the response type now survives |
| `I.attempt`, `I.all` (typed tuple) | try/catch around every call; untyped parallel results |
| `I.drive` with typed `expect` / `expectAll` / `fail` | `vi.mock` + fake timers + `flushPromises` to test async control flow |
| Effect log + `I.resume` | generators can't be serialized, hydrated, or moved |
| `ReplayDivergence`, `InvalidReplayResponse` | resuming stale state after a code change silently does the wrong thing |
| Response concepts, JSON-safety checks | API contract drift found three steps later as a crash |
| `I.toMachine` | explicit-cursor `IterMachine`s are painful to hand-write; now generator code lowers to one |
| `I.once` / `I.seq` | second pass over a consumed generator silently yields nothing |

New files: `src/iter/{effects,workflow,sequences}.ts`.

## Decisions worth reviewing

1. **The state is the log, not the generator.** A snapshot is `{ workflowId, input, log }`, and resuming re-runs the generator against the log. This is the Temporal model: it needs determinism, and the engine verifies determinism rather than trusting it.
2. **Divergence messages distinguish the two causes.** A different effect means the code changed. The same effect with different arguments means nondeterminism leaked in, and the message says "make it an effect". I've debugged the second case blind before.
3. **Effect failures are data, delivered identically live and on replay.** Handler exceptions become a serialized `{ name, message, data }` that is logged and rethrown as `EffectError`. So a replayed failure is the same `EffectError` the live run saw, not "whatever the handler threw".
4. **Contract violations are effect errors, not crashes.** A response that fails its concept (or isn't JSON-safe) becomes `InvalidEffectResponse` / `UnserializableEffectResponse`. The workflow can handle it with `I.attempt`, and it's logged, so replay agrees. The concept check runs before the JSON check because its message is more specific (NaN → "not allowed" instead of "doesn't survive JSON").
5. **A missing handler is `invalid`, and nothing is logged.** It's a configuration problem, not an outcome. Once the handler exists, the same snapshot resumes cleanly.
6. **`I.drive` is synchronous and handler-free.** A test is a list of "expect X, respond Y" lines. Async behavior belongs to the drivers, not to the workflow under test.
7. **`I.toMachine` replays from the start on every step (O(n²)).** Simple and obviously correct; fine for authoring-scale logs. Caching the live session across steps is an easy optimization if it ever matters.
8. **Deliberately not built:** fibers, cancellation trees, racing, retries/backoff, time-sliced stepping. Retries are a few lines with `I.attempt` in a loop. Time slicing was optional, and nothing here needed it.

## Claudefood findings

`test/iter/workflow-claudefood.test.ts` is an order-fulfilment workflow: parallel lookups, reservation, a charge that can fail with compensation, logged time. It's tested through all four drivers. The `toolkit-pipeline` sample's async enrichment now runs as a workflow inside its existing `A.task`.

- **Friction (fixed):** `run.expect(reserveStock, ["o-1", 2])` inferred the args as `(string | number)[]` and failed against the effect's tuple. Fixed with `NoInfer<TArgs>`, which is exactly the generic-inference trap these tools are meant to remove.
- **Friction (fixed):** responding to an `I.all` step was untyped (`respond(...unknown[])`). Added `expectAll([defA, defB]).respond(a, b)`, typed as a tuple.
- **Friction (fixed):** `AnyEffectDefinition = EffectDefinition<never, unknown>` rejected real definitions, because `handle`'s parameter is doubly contravariant. It's now a minimal structural type.
- **Gap (fixed):** snapshot validation returned early on structural errors and hid invalid input. It now reports both. The concepts layer also collapsed a `outcome`/`outcomes` typo into one rename diagnostic. My test expected two diagnostics; the library was right.
- **Missing utility (added):** porting the sample, I reached for `formatWorkflowDiagnostics` before it existed.
- **Real behavior change (accepted):** in the sample, the async workflow adds microtask ticks per effect. Two concurrent batch items now complete in the opposite order in the batch trace. Results are identical; only the interleaving of concurrent work changed. The checked-in `report.json` was regenerated (one line).

## Verification

- `tsc --noEmit` clean; Biome clean on touched files.
- Vitest: 1211 passed, 0 failed (39 iter tests, 18 of them new workflow tests).
- Type-level tests use `@ts-expect-error` for wrong field access on responses, wrong `expect` response types, and wrong `expectAll` tuple types.

## Not done / next

- `I.toMachine` uses sync handlers only (because `IterMachine.step` is synchronous). An async counterpart would belong in `machinalayout/async`/Deus rather than here.
- No log compaction. Very long-running workflows would want "continue as new" (snapshot the return value, start a fresh log).
- Workflow versioning is diagnostic-only: divergence tells you the code changed but offers no migration path. A `I.version("v2")` branch-point effect (logged, so old snapshots replay the old branch) is the standard answer if it's needed.
