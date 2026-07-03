# MachinaLayout 0.4 Release Checklist

Use this checklist for the 0.4.0 publish pass. Do not publish from a dirty tree, and do not bump the version until the release commit is ready.

## Release Intent

- 0.4 adds the official `machinalayout/machina` authoring surface.
- 0.4 keeps the MIR/root layout APIs unchanged.
- 0.4 is expected to be a minor bump from the 0.3.x line.
- No resolver, adapter, Deus, Atlas, inspect, handoff, dispatch, text, or screen-catalog behavior changes are required for release prep.

## Expected Package Subpaths

- `machinalayout`
- `machinalayout/machina`
- `machinalayout/atlas`
- `machinalayout/deus`
- `machinalayout/inspect`
- `machinalayout/handoff`
- `machinalayout/react`
- `machinalayout/react-native`
- `machinalayout/vue`
- `machinalayout/text`
- `machinalayout/text/react`
- `machinalayout/text/react-native`
- `machinalayout/text/vue`
- `machinalayout/dispatch`

## Verification Commands

```sh
npm run format
npm run format:check
npm run lint
npm test
npm run build
cd samples/control-room && npm run build
cd ../music-player && npm run build
cd ../dispatch-counter && npm run build
cd ../codex-product-page && npm run build
cd ../..
npm pack --dry-run
```

Also verify the Codex product-page sample uses the new authoring subpath:

```sh
rg -n 'from "machinalayout/machina"' samples/codex-product-page
```

Check that core authoring packages do not import framework adapters or Node built-ins:

```sh
rg -n 'from "(react|react-native|vue)|from "node:fs|from "node:path|require\("node:fs"|require\("node:path"' src/machina src/atlas
```

## External Consumer Smoke

Before publishing, pack the package and install it into a temporary project outside the repository. Type-check imports for the package root, `machinalayout/machina`, Atlas, Deus, inspect, handoff, and the React, React Native, and Vue adapter subpaths.

## Tarball Review

Run:

```sh
npm pack --dry-run
```

The tarball should include `dist`, `README.md`, `LICENSE`, `package.json`, and `docs`. It should not include `src`, `test`, `samples`, `*.tsbuildinfo`, generated `.tgz` files, local logs, or dependency folders.

## Publish Steps

```sh
npm version minor
npm publish
```

Do not run these commands during release-prep hygiene work.
