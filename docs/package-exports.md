# Package exports

MachinaLayout.JS publishes the MIT toolbox/library from the root package. The supported public imports are the `exports` entries in `package.json`; implementation paths under `src/` are not public API.

| Import | Purpose | Intended audience |
|--------|---------|-------------------|
| `machinalayout` | Core layout, resolving, geometry, text, and React view re-exports. | Most apps and examples. |
| `machinalayout/machina` | `M.*` authoring shorthand and lowering helpers. | Record-first layout authors and LLM-authored UI. |
| `machinalayout/react` | React renderer, error surface, and Deus hook. | React apps. |
| `machinalayout/react-native` | React Native renderer and Deus hook. | React Native apps. |
| `machinalayout/vue` | Vue renderer and Deus hook. | Vue apps. |
| `machinalayout/text` | Text records, parsing, formatting, and utilities. | Text pipelines. |
| `machinalayout/text/react` | React text renderer. | React text UI. |
| `machinalayout/text/react-native` | React Native text renderer. | Native text UI. |
| `machinalayout/text/vue` | Vue text renderer. | Vue text UI. |
| `machinalayout/table` | Table authoring, schemas, conversion, derivation, keyed tables, chunks. | Table-first data and authoring. |
| `machinalayout/query` | Query plans, builders, execution, iteration, chunk execution. | Columnar/table query flows. |
| `machinalayout/dispatch` | Dispatch tables and event dispatch helpers. | Declarative update routing. |
| `machinalayout/deus` | Deus state machines, utilities, table bridges, debug overlays. | Statechart-like behavior. |
| `machinalayout/match` | Exhaustive discriminated/enum matching helpers. | Type-safe branching. |
| `machinalayout/async` | Async task records, controller, trace, result, validation. | Async workflows. |
| `machinalayout/batch` | Batch task records, runner, trace, result, validation. | Concurrent batch work. |
| `machinalayout/iter` | Iterator records and controller helpers. | Explicit iteration flows. |
| `machinalayout/concept` | Concept definitions, templates, table projection. | Domain schema authoring. |
| `machinalayout/diagnostics` | Diagnostic authoring, collection, and formatting. | Validation/report surfaces. |
| `machinalayout/form` | Field definitions and concept-to-form projection. | Forms generated from concepts. |
| `machinalayout/command` | Command records and command batch types. | Command palettes/automation. |
| `machinalayout/comptime` | Literal, string, and guard helpers. | Type-level authoring ergonomics. |
| `machinalayout/style` | Style tokens, style rules, artifacts, validation, tabular styles. | Styling pipelines. |
| `machinalayout/static` | Static records, serialization, validation. | Static rendering/export flows. |
| `machinalayout/atlas` | Atlas sections, extraction, table bridge, validation. | Documentation/metadata extraction. |
| `machinalayout/inspect` | DOM summary inspection helpers. | Testing and handoff diagnostics. |
| `machinalayout/handoff` | Handoff bundle types and writer. | Design/development handoff. |
| `machinalayout/capture` | Explicit capture records and validation. | Capture descriptions. |
| `machinalayout/package.json` | Package metadata. | Tooling only. |

## Package and license boundary

- The root package is MIT licensed and its `files` allowlist contains `dist`, `README.md`, `LICENSE`, and `docs`.
- `/app` is MachinaCanvas, a private AGPL-3.0-or-later app/product package.
- `npm pack --dry-run --json` is used as the packaging proof: no `app/**` source, tests, docs, fixtures, artifacts, assets, or package metadata should appear in the MIT tarball.
