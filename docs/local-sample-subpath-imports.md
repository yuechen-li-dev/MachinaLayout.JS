# Local Sample Subpath Imports

Nested samples inside this repo can author real package-style imports such as:

```ts
import { matchKind } from "machinalayout/match";
import { A } from "machinalayout/async";
import { D } from "machinalayout/diagnostics";
```

That is easy after publish, but awkward before publish because nested sample packages do not automatically resolve the root package's built subpath exports during local dogfooding.

M34l standardizes one first-party repo workflow for that case.

## Workflow

1. Build the root package first.
2. Run the sample harness for the nested sample.
3. Build or run the sample normally.

Example:

```sh
npm run build
node tools/prepare-sample-subpath-imports.mjs samples/toolkit-pipeline
cd samples/toolkit-pipeline
npm run build
```

## What The Harness Does

`tools/prepare-sample-subpath-imports.mjs` reads the root package's real `exports` map and generates a lightweight local bridge package at:

```txt
samples/<sample>/node_modules/machinalayout/
```

Each generated bridge file re-exports the corresponding built root file from `dist`, so nested samples resolve the same public subpaths they will use after publish.

The generated local package is:

- deterministic
- idempotent
- derived from the real root `package.json` exports
- local repo tooling only, not published package surface

## Commands

Prepare one sample:

```sh
node tools/prepare-sample-subpath-imports.mjs samples/toolkit-pipeline
```

Prepare multiple samples:

```sh
node tools/prepare-sample-subpath-imports.mjs samples/toolkit-pipeline samples/style-dogfood
```

If root `dist` is missing, the tool fails clearly and asks you to run `npm run build` from the repo root first.

## Adding A New Nested Sample

For a Node-style nested sample that imports `machinalayout/*` subpaths:

1. Keep package-style imports in sample source.
2. Add a build step that runs `node ../../tools/prepare-sample-subpath-imports.mjs .` before sample compilation or execution.
3. Build the root package before building the sample.

If the sample compiles multi-file ESM output with extensionless relative imports, reuse the shared `patchGeneratedJsImports()` helper exported from `tools/prepare-sample-subpath-imports.mjs` before executing the generated files.

## Generated Files

- `samples/<sample>/node_modules/machinalayout/` is generated local bridge output and stays ignored through the repo-wide `node_modules/` rule.
- `samples/toolkit-pipeline/.generated/` is generated sample build output and is ignored.
- Checked-in sample artifacts such as `samples/toolkit-pipeline/dist/report.json` and `samples/toolkit-pipeline/dist/report.txt` remain intentional sample outputs.

## Troubleshooting

`Root dist not found`

Run `npm run build` from the repo root first.

`Sample path not found`

Pass the sample directory path relative to the repo root or an absolute path.

Sample runtime fails on extensionless relative imports

Patch the generated JS with `patchGeneratedJsImports()` before importing the emitted entry file.
