# MachinaCanvas Repository Graduation

## Current package boundary

`/app` is a private AGPL-3.0-or-later package for MachinaCanvas. It contains the app source, tests, scripts/workflows, docs, fixtures, public assets, and intentionally retained dogfood artifacts.

## Dependency on MachinaLayout.JS

The app depends on the root MIT MachinaLayout.JS package with a local `file:..` dependency while it lives in this monorepo. App code may use public MachinaLayout.JS package exports. The root library must not depend on MachinaCanvas.

## Files contained in `/app`

- `src/` — application/editor source.
- `test/` — MachinaCanvas unit, workflow, UI, guide, blockout, sprite, and mechanical tests.
- `scripts/` — dogfood artifact and workflow generators.
- `docs/` — app-owned closeout and graduation documentation.
- `fixtures/` — editable/export fixtures.
- `artifacts/` — intentionally retained dogfood/review artifacts.
- `public/` — app public assets.
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `LICENSE`, `README.md` — app package metadata and config.

## Files intentionally remaining in the root repository

The MIT library remains in `/src`, `/test`, `/docs`, `/samples`, `/dist`, `README.md`, `package.json`, and root build/test config. Root docs may link to `/app`, but `/app` is not part of the npm package payload.

## Steps to move `/app` into a new repository

1. Copy `/app` into the new repository.
2. Optionally move the contents of `/app` to the new repository root.
3. Update the `machinalayout` dependency from `file:..` to the desired npm, git, or workspace source.
4. Update package name, repository metadata, lockfile, and CI badges if needed.
5. Install dependencies.
6. Run tests and build.
7. Regenerate and verify dogfood artifacts.
8. Add new CI for app test/build/artifact checks.
9. Preserve the AGPL license and product boundary.

## Package-name/import updates likely required after moving

- Replace the monorepo-local `file:..` dependency with a published or git dependency.
- If contents move from `/app` to the new repo root, no source relative imports should need path changes because source/tests/scripts already reference app-local `src` and `scripts` paths.
- Update documentation links that currently refer to `/app` as a subdirectory.

## CI/build/test commands

Recommended checks after graduation:

```bash
npm run format:check
npm run lint
npm test
npm run build
npm run artifacts:mechanical-354
npm run artifacts:mechanical-354-blockout
npm run artifacts:guide-overlay
```

## License boundary

MachinaCanvas remains AGPL-3.0-or-later. MachinaLayout.JS remains MIT. Do not copy root library implementation into the app; depend on the package instead.

## Known caveats

Current monorepo development uses a local `file:..` dependency on the root package and root-level convenience scripts that delegate into `/app`. Those are the only expected monorepo assumptions to replace during repository graduation.
