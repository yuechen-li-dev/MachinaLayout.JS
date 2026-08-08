# TSPack DVT — MachinaLayout.JS M44a

## Purpose

M44a is a shadow-only dogfood pass for TSPack `v0.1.7`. It models the current
MachinaLayout.JS package as a multi-target library, exercises implemented
read-only functionality, and records gaps without replacing npm, tsup,
`package-lock.json`, or the existing scripts.

## Repository versions/status

| Repository | Revision/status at start | Resulting changes |
| --- | --- | --- |
| MachinaLayout.JS | `machinalayout@0.6.1`; clean | `manifest.tsx`, this report |
| TSPack | `v0.1.7`; pre-existing `M cmd/tspack/doctor_command.go` | none |

The TSPack working-tree modification predates this pass and was not inspected,
edited, staged, or used as part of the result.

## Current MachinaLayout package topology

`package.json` is the publish source of truth. Its `exports` map has 28
runtime/type entrypoints (plus `./package.json` metadata). `tsup.config.ts`
has matching entries. The root export deliberately re-exports React and
React-text APIs for 0.x compatibility; it is therefore not framework-neutral.

The source tree otherwise has framework-neutral exported subpaths and six
framework adapter targets. `/app` is a separate private AGPL-3.0-or-later
MachinaCanvas consumer, installed from `file:..`; it is not an MIT package
target.

## Target inventory

All rows have a public `.d.ts` at the shown `types` path after `npm run build`.
`peer` lists the target allowance, not a claim that every peer is physically
imported by every target.

| Target | Export | Entry | Runtime / types | Allowed peers | Optional |
| --- | --- | --- | --- | --- | --- |
| root | `.` | `src/index.ts` | `dist/index.js` / `dist/index.d.ts` | react, react-dom | no |
| inspect | `./inspect` | `src/inspect/index.ts` | `dist/inspect/index.js` / `dist/inspect/index.d.ts` | — | no |
| handoff | `./handoff` | `src/handoff/index.ts` | `dist/handoff/index.js` / `dist/handoff/index.d.ts` | — | no |
| deus | `./deus` | `src/deus/index.ts` | `dist/deus/index.js` / `dist/deus/index.d.ts` | — | no |
| match | `./match` | `src/match/index.ts` | `dist/match/index.js` / `dist/match/index.d.ts` | — | no |
| capture | `./capture` | `src/capture/index.ts` | `dist/capture/index.js` / `dist/capture/index.d.ts` | — | no |
| async | `./async` | `src/async/index.ts` | `dist/async/index.js` / `dist/async/index.d.ts` | — | no |
| batch | `./batch` | `src/batch/index.ts` | `dist/batch/index.js` / `dist/batch/index.d.ts` | — | no |
| iter | `./iter` | `src/iter/index.ts` | `dist/iter/index.js` / `dist/iter/index.d.ts` | — | no |
| concept | `./concept` | `src/concept/index.ts` | `dist/concept/index.js` / `dist/concept/index.d.ts` | — | no |
| diagnostics | `./diagnostics` | `src/diagnostics/index.ts` | `dist/diagnostics/index.js` / `dist/diagnostics/index.d.ts` | — | no |
| table | `./table` | `src/table/index.ts` | `dist/table/index.js` / `dist/table/index.d.ts` | — | no |
| query | `./query` | `src/query/index.ts` | `dist/query/index.js` / `dist/query/index.d.ts` | — | no |
| form | `./form` | `src/form/index.ts` | `dist/form/index.js` / `dist/form/index.d.ts` | — | no |
| command | `./command` | `src/command/index.ts` | `dist/command/index.js` / `dist/command/index.d.ts` | — | no |
| comptime | `./comptime` | `src/comptime/index.ts` | `dist/comptime/index.js` / `dist/comptime/index.d.ts` | — | no |
| react | `./react` | `src/react/index.ts` | `dist/react/index.js` / `dist/react/index.d.ts` | react | no |
| text | `./text` | `src/text/index.ts` | `dist/text/index.js` / `dist/text/index.d.ts` | — | no |
| text-react | `./text/react` | `src/text/react/index.ts` | `dist/text/react/index.js` / `dist/text/react/index.d.ts` | react | no |
| react-native | `./react-native` | `src/react-native/index.ts` | `dist/react-native/index.js` / `dist/react-native/index.d.ts` | react, react-native | yes |
| vue | `./vue` | `src/vue/index.ts` | `dist/vue/index.js` / `dist/vue/index.d.ts` | vue | yes |
| text-react-native | `./text/react-native` | `src/text/react-native/index.ts` | `dist/text/react-native/index.js` / `dist/text/react-native/index.d.ts` | react, react-native | yes |
| text-vue | `./text/vue` | `src/text/vue/index.ts` | `dist/text/vue/index.js` / `dist/text/vue/index.d.ts` | vue | yes |
| dispatch | `./dispatch` | `src/dispatch/index.ts` | `dist/dispatch/index.js` / `dist/dispatch/index.d.ts` | — | no |
| atlas | `./atlas` | `src/atlas/index.ts` | `dist/atlas/index.js` / `dist/atlas/index.d.ts` | — | no |
| machina | `./machina` | `src/machina/index.ts` | `dist/machina/index.js` / `dist/machina/index.d.ts` | — | no |
| style | `./style` | `src/style/index.ts` | `dist/style/index.js` / `dist/style/index.d.ts` | — | no |
| static | `./static` | `src/static/index.ts` | `dist/static/index.js` / `dist/static/index.d.ts` | — | no |

`./package.json` is intentionally not a TSPack runtime target.

## Dependency classification

| Class | Dependencies | Notes |
| --- | --- | --- |
| peer | `react`, `react-dom` | Required by current package metadata. `react` is used by root/React targets; `react-dom` is retained on the root row to preserve current published metadata. |
| optional peer | `react-native`, `vue` | Scoped to their adapter and text-adapter targets. |
| tool/test | `@biomejs/biome`, Testing Library packages, `@types/*`, `@vue/test-utils`, `jsdom`, `react-test-renderer`, `tsup`, `typescript`, `vitest` | Not allowed as runtime target dependencies. |
| runtime | none | The root library has no `dependencies` or `optionalDependencies`. |

The four framework packages are also present in `devDependencies` as local test
providers. The first TSPack model represents them as peers, not duplicate tool
rows: its runtime boundary checker treats a package identity declared as a tool
as a tool even if a peer row also exists. This is documented as a modeling gap,
not hidden by an inaccurate duplicate declaration.

## TSPack manifest

[`manifest.tsx`](../manifest.tsx) uses the current AST-only `tspack/manifest`
API. It records all public runtime/type targets, package/version/license,
target-scoped peers, tools, explicit adapter boundary rules, and the current
publish intent:

- include: `dist/**`, `docs/**`, `README.md`, `LICENSE`
- exclude: `src/**`, `test/**`, `samples/**`, `app/**`

No `ts-lock.toml` was generated. `tspack update --dry-run` failed before it
could plan a lock, and a non-dry-run update would not be appropriate during
this initial npm-shadow pass.

## Commands run

| Command | Result |
| --- | --- |
| `tspack migrate --check --scan-source` | Parsed package/lock evidence; inferred 29 targets, but scanned 295 files across embedded products/samples and reported 4 missing declarations. |
| `tspack adopt --report` | Read-only npm adoption report succeeded. |
| `tspack why react` | Read-only observed-npm explanation succeeded; without `ts-lock.toml` it did not report target scope. |
| `tspack check --json` | 0 errors; expected `TSPACK_CHECK_LOCKFILE_MISSING` warning. |
| `tspack check --explain src/react-native/MachinaReactNativeView.tsx` | Confirmed React and React Native allowed only for the RN target and React DOM/Vue denial rules applied. |
| `tspack pack --dry-run --package machinalayout` | Preview succeeded; warning discussed below. |
| `tspack update --dry-run --json` | Failed safely with three npm-alias resolution diagnostics; wrote nothing. |
| `tspack outdated --json` | Succeeded with missing-lock status and remote candidate metadata. |
| `npm run typecheck && npm run build` | Passed. |
| `npm pack --dry-run --json` | Passed; 151 entries, and no `app/**`, source, tests, samples, or `CHANGELOG.md`. |

## Successful checks

- Manifest frontend and IR parsing accepted the complete 28-target model.
- Runtime import scanning found no undeclared imports, peer-scope violations,
  tool-at-runtime imports, or explicit framework boundary violations.
- The RN explanation showed a reachable path from
  `src/react-native/index.ts` to `MachinaReactNativeView.tsx`, with `react`
  and `react-native` allowed and React DOM/Vue denied.
- The actual tsup build emitted every manifest-declared runtime and type
  output.
- The TSPack and npm pack previews both include `dist/**`, `docs/**`, README,
  LICENSE, and generated `package.json`; both exclude `/app`.

## MachinaLayout findings

### M44A-ML-1 — root is React-coupled by public compatibility export

- Severity: medium / architecture decision
- Target/path: `root`; `src/index.ts` re-exports `./react` and `./text/react`.
- Why: the root cannot satisfy a strict framework-neutral core rule, and its
  generated declaration graph imports React transitively.
- Possible fix: keep the documented 0.x compatibility behavior, or de-root
  React exports in a future breaking/package split milestone.
- Fixed in M44a: no; current architecture is deliberate.

### M44A-ML-2 — root scripts reference an excluded product directory

- Severity: low / package-workflow boundary
- Target/path: root `package.json` scripts `canvas:*` invoke `app/scripts/*`,
  while npm pack excludes `/app`.
- Why: this is not a runtime source import and the MIT artifact correctly
  excludes `/app`, but those published script names cannot work from an
  installed tarball.
- Possible fix: move product-only scripts to `/app/package.json`, or clearly
  mark them repository-maintainer scripts.
- Fixed in M44a: no; not necessary to model or exercise TSPack.

## TSPack gaps

## Gap: declaration walker cannot follow TypeScript-valid relative `.js` specifiers

### Scenario

The tsup declaration bundle imports local declaration chunks as, for example,
`./types-BfAFZGl4.js` from `dist/index.d.ts`; the matching file is
`types-BfAFZGl4.d.ts`.

### Expected

The type-surface walker should apply TypeScript-style declaration resolution
and continue to check framework/type leakage.

### Actual

With `publicTypeLeakage: "error"`, `tspack check --json` produced 50
`TSPACK_TYPE_UNRESOLVED_RELATIVE` errors, beginning at `dist/index.d.ts` and
covering 28 targets. All are unresolved local `.js` declaration specifiers;
the normal TypeScript build succeeds.

### Evidence

`npm run build` succeeds, while the strict TSPack run reports
`import=./types-BfAFZGl4.js`. The M44a manifest sets
`publicTypeLeakage: "ignore"` with an adjacent comment so source-boundary and
pack dogfood can continue without disguising the limitation.

### Proposed direction

Teach `resolveDTSRelative` to probe `.d.ts`/`.d.mts`/`.d.cts` after replacing a
relative `.js`/`.mjs`/`.cjs` suffix, matching TypeScript declaration module
resolution.

### Priority

high

## Gap: resolver cannot dry-run a current npm graph containing npm aliases

### Scenario

MachinaLayout's current npm lock includes alias-style transitive identities.

### Expected

`tspack update --dry-run` should resolve the manifest into a proposed
`ts-lock.toml` without mutation.

### Actual

The dry run stops with `TSPACK_RESOLVE_NPM_INVALID_RANGE` for
`string-width-cjs` / `npm:string-width@^4.2.0`, `strip-ansi-cjs` /
`npm:strip-ansi@^6.0.1`, and `wrap-ansi-cjs` / `npm:wrap-ansi@^7.0.0`.

### Evidence

`tspack update --root ... --dry-run --json` returned `ok: false`, zero lock
changes, and exactly those three diagnostics. No lockfile was written.

### Proposed direction

Represent npm alias sources in the resolver and lock identity, then add a
minimal fixture with an alias plus a normal package consumer.

### Priority

blocker

## Gap: migration source scan does not respect embedded product boundaries

### Scenario

The root contains an AGPL `/app` consumer and several independently packaged
samples; they are intentionally outside the MIT library package target set.

### Expected

Initial migration should either scan the package source roots only or accept
explicit scan roots/exclusions before classifying external imports.

### Actual

`tspack migrate --check --scan-source` scanned 295 files, observed 11 external
packages, and reported 4 missing declarations / 3 dev-runtime mismatches.
Those results combine the library with app/sample consumer code.

### Evidence

The adoption/migration command summary reports those counts. The final target
manifest's source boundary scan does not traverse `/app` and correctly passes.

### Proposed direction

Add migration `--include`/`--exclude` or package-root-aware source scanning,
defaulting to the package source/build roots when available.

### Priority

medium

## Gap: pack preview warns for a changelog npm does not pack

### Scenario

`CHANGELOG.md` exists in the repository but is absent from the current npm
tarball because it is outside `package.json.files`.

### Expected

TSPack should not warn when the declared shadow policy intentionally matches
the npm artifact's omission, or it should distinguish a general recommendation
from a parity problem.

### Actual

TSPack pack preview succeeds but emits `TSPACK_PACK_CHANGELOG_NOT_INCLUDED`.

### Evidence

`npm pack --dry-run --json` lists 151 files and no `CHANGELOG.md`; TSPack
prints the warning for the same modeled include policy.

### Proposed direction

Lower this to an opt-in advisory or add npm-parity comparison mode before
claiming it as a release warning.

### Priority

low

## False positives / false negatives

- False positive: the 50 strict type-surface failures are unresolved local
  declaration imports, not missing generated types or framework leaks.
- Unsupported / currently unassessed: generated declaration framework leakage
  cannot be evaluated until the `.js` declaration resolver works. Manual
  inspection confirms root types intentionally include React via its root
  compatibility exports; no Vue or React Native import was observed in
  `dist/index.d.ts`.
- No runtime boundary false positives or false negatives were observed in the
  declared target entry graphs.

## Package artifact comparison

The final `npm pack --dry-run --json` produced a 152-entry tarball (the extra
entry is this DVT report) containing every built export output, `docs/**`, README,
LICENSE, and `package.json`. It excluded `src/**`, `test/**`, `samples/**`,
`app/**`, and `CHANGELOG.md`.

TSPack dry-run selected the same broad file set and generated package metadata
from the manifest, but it does not yet prove byte-for-byte or metadata parity.
The changelog advisory above is the observed preview difference.

## Type-surface findings

`npm run build` emits all declared `.d.ts` entrypoints. Source-level type
boundary scanning successfully checks explicit type-only framework imports:
RN may use `react-native`; Vue may use `vue`; prohibited framework imports are
denied by adapter rules. The generated declaration walk is disabled solely for
the recorded `.js`-specifier gap, so M44a does not claim generated type-surface
parity.

## App/license boundary

- `/app/package.json` is private and AGPL-3.0-or-later.
- `/app` consumes public `machinalayout`, `machinalayout/machina`, and
  `machinalayout/react` imports through `file:..`.
- No root `src/**` import references `/app`.
- The npm tarball and the TSPack shadow policy exclude `/app/**`.
- `/app` remains outside the initial TSPack workspace model. Modeling it as a
  product consumer requires an explicit workspace/path-product decision, not a
  forced MIT package target.

## Recommended M44 follow-ups

1. M44b: decide whether root React compatibility exports and the root
   `canvas:*` scripts should remain package-level behavior.
2. M44c: add npm alias support to TSPack resolution/lock writing; then rerun
   this exact manifest and generate `ts-lock.toml` only after dry-run success.
3. M44d: make TSPack type-surface resolution understand relative JavaScript
   specifiers in declaration bundles and enable strict leakage checking here.
4. M44e: add a TSPack npm-parity comparison mode for pack contents/metadata,
   including changelog treatment.

## Verification

Completed during M44a:

```text
MachinaLayout.JS: npm run typecheck
MachinaLayout.JS: npm run build
MachinaLayout.JS: npm pack --dry-run --json
TSPack: go run ./cmd/tspack migrate --root <MachinaLayout> --check --scan-source
TSPack: go run ./cmd/tspack adopt --root <MachinaLayout> --report
TSPack: go run ./cmd/tspack check --root <MachinaLayout> --json
TSPack: go run ./cmd/tspack check --root <MachinaLayout> --explain src/react-native/MachinaReactNativeView.tsx
TSPack: go run ./cmd/tspack pack --root <MachinaLayout> --package machinalayout --dry-run
TSPack: go run ./cmd/tspack update --root <MachinaLayout> --dry-run --json
TSPack: go run ./cmd/tspack outdated --root <MachinaLayout> --json
TSPack manifest frontend: npm test
TSPack manifest frontend: npm run build
```

The TSPack update dry run is intentionally documented as a blocker; it did not
write a lockfile or change npm-managed state. The manifest frontend verification
passed (198 tests, 2 skipped; build passed). Both `go test ./...` and
`go test ./... -run '^$'` in the TSPack repository exceeded the 120-second
verification window without diagnostic output; the latter was terminated to
run the independent frontend verification. This is an environment/verification
blocker, not treated as a pass.
