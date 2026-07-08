# MachinaCanvas Phase Closeout — M40

## Status

MachinaCanvas is no longer just a lightweight demo surface inside MachinaLayout.JS. By the end of M40 it is a substantial AGPL app/product codebase with its own workflows, sidecar dialects, review artifacts, and dogfood exercises. This pass closes the phase instead of expanding it.

M40 closeout goals:

- stabilize current work
- remove incidental runtime noise
- verify MIT package vs AGPL app boundaries
- leave a practical map for the next Codex/ChatGPT instance

## What MachinaCanvas is now

MachinaCanvas is an LLM-friendly 2D scene editor and artifact/workflow surface built with React/Vite on top of MachinaLayout.JS. It is not the published library package. It is product/app code that happens to live in the same repository for now.

The canonical editable source remains scene/document state plus sidecars and workflow outputs. SVG and PNG artifacts are review/render outputs, not the authoring truth.

## Major completed capabilities

### M37

- Sprite sidecars as structured authoring/runtime metadata.
- TinyTown TOML and SpriteForge parsing for real sprite-atlas dogfood.
- Sprite frame editor with direct frame rect editing and selection focus.
- In-app command terminal for editor commands and scriptable/manual exercise.
- Audit report generation for sprite review and alpha-aware diagnostics.
- Focus overlay modes for selected-frame inspection.
- Export cart for choosing runtime/review/source artifacts.
- Layer ownership panel showing sidecar attachment relationships.

### M38

- Guide sidecars as authoring IR.
- Guide regions, datums, alignment marks, and dimensions.
- Region-bounded sprite editing plus clamp/constrain workflow.
- Datum snapping for selected frame anchors.
- Guide-to-sprite compile boundary with runtime sprite TOML kept separate.
- Runtime stackframes as compact sprite metadata.
- Workflow API for TypeScript automation over records/artifacts instead of UI macros.

### M39

- Mechanical annotation layer over existing geometry.
- Drafting workflow on top of the existing scene model rather than a separate CAD kernel.
- A4 landscape sheet conventions and annotation records.
- Exercise 354 dogfood pipeline.
- Filled topology-first mechanical rendering with void-aware profile output.

### M40

- General guide/blockout sidecars beyond sprite-only workflows.
- Arc helpers for drafting-oriented path construction.
- Guide overlay verification fixture/review artifacts.
- Arc orientation regression hardening.
- Coordinate profile semantics and Y-axis hardening for commands/helpers.

## Architecture map

### Scene/document

The scene/document is the canonical editable canvas state. It owns objects, layers, selections, metadata, and export/runtime relationships.

### Sidecars

Sidecars are attached semantic overlays or companion artifacts rather than ad hoc hidden editor state.

- `guide.toml`: red construction mask / authoring guide IR
- `blockout.toml`: green spatial feature/component mask
- `sprite.toml`: runtime sprite/frame target

### Guide-to-sprite compiler

Guide sidecars are authoring IR. Runtime sprite TOML is a lowered target. Regions, datums, dimensions, and alignment marks do not belong in runtime sprite outputs.

### Workflow API

Workflows are TypeScript automation over records, sidecars, manifests, audits, and artifact generation. They are not browser click macros.

### Export cart

The export cart is a checkout surface for selected source/review/runtime artifacts. It keeps checkpointing separate from external deliverables.

### Mechanical annotations

Mechanical annotations are semantic drafting records for dimensions, notes, datums, title blocks, BOM/revision tables, and related sheet metadata layered over ordinary scene geometry.

### Coordinate profiles

Coordinate profiles describe authoring semantics over the still-SVG-oriented render space:

- screen/image: +X right, +Y down
- drafting: +X right, +Y up

Renderer/export remain SVG/React oriented in this phase. Full mechanical geometry conversion to a native y-up internal model is not complete. Arc helpers operate in render/SVG space unless a wrapper transforms coordinates first.

## Sidecar model

Sidecars are explicit authoring/runtime boundaries:

- guide sidecars are visible authoring masks
- blockout sidecars are visible spatial decomposition masks
- sprite sidecars are runtime-facing frame metadata
- sketch overlays remain image reasoning sidecars

This keeps semantic overlays inspectable and exportable without inventing a new subsystem per workflow.

## Workflow model

Current workflow design is artifact-oriented:

- load or synthesize source scene records
- attach sidecars
- compile or lower when needed
- emit reports, rendered assets, and handoff bundles

Important rule: automate records and artifacts, not UI choreography.

## Mechanical drafting status

Mechanical drafting is now real enough to dogfood:

- existing geometry can be annotated semantically
- A4 landscape sheets exist
- Exercise 354 and the M40c guide/blockout pass regenerate stable artifacts
- filled topology-first output works for current exercises

Still deferred:

- no CAD kernel
- no general solver
- no PDF export
- no DXF/DWG
- no full y-up internal geometry rewrite

## Sprite/TinyTown status

Sprite sidecars, guide-side authoring, compile boundaries, audit outputs, and TinyTown artifact generation are all established. The Dominatus/Godot integration target remains downstream in the Dominatus repository, not inside this package.

## Guide/blockout status

Guide and blockout sidecars are now general authoring IR rather than sprite-only concepts. Overlay review, attachment visibility, export inclusion, and dogfood artifacts exist. Blockout lowering is still workflow-specific and not yet a generalized lowering pipeline.

## Coordinate profile status

Coordinate profile metadata and helper logic now distinguish visual commands from raw SVG coordinate direction. This hardens authoring semantics without claiming a complete internal coordinate-system conversion.

## Export/artifact status

Artifacts are intentionally split across source, runtime, and review outputs:

- scene/document exports
- sidecar TOML outputs
- rendered SVG/PNG review assets
- workflow reports/process notes
- export-cart bundle manifests

The renderer/export stack is still SVG-first.

## Known caveats

- Vite large chunk warning remains in the app build.
- Guide overlay verification currently has checked-in fixture/review evidence; full live-app screenshot capture remains a manual review path.
- Guide non-linear dimension coverage may still be incomplete compared with future drafting ambitions.
- Mechanical y-up semantics are metadata/helper level in this phase, not a full internal geometry conversion.
- Arc helpers are local construction helpers, not a parametric solver.
- Line-circle and circle-circle tangency solving remain deferred.
- PDF export is deferred.
- DXF/DWG export is deferred.
- Image-to-CAD extraction is not implemented.
- General blockout lowering is not implemented.
- MachinaCanvas likely needs a future repo/package split before serious productization.
- Dominatus TinyTown integration lives in the Dominatus repo, not this npm package.

## Deferred work

- code splitting / build chunk reduction
- more complete guide dimension coverage
- richer blockout review UX
- print/PDF review flow
- more formal mechanical lowering contracts
- persistence/project packaging story

## Suggested future milestones

### Short-term hardening

- app code splitting / Vite chunk warning
- live-app fixture loading UX
- guide non-linear dimension rendering
- blockout visibility review UX
- better artifact manifest browser

### MachinaCanvas productization

- split into separate repo/package/app
- keep AGPL app-level licensing explicit
- add persistence/project-file conventions
- decide packaged desktop/web app story
- polish import/export workflow UX

### mCAD future

- formal drafting guide/blockout lowering
- y-up drafting wrappers or deeper geometry conversion
- better tangent helpers
- PDF export
- print review flow
- annotation collision avoidance

### Sprite/TinyTown future

- Godot loader polish
- sprite animation preview
- sidecar editor UX polish
- stackframe editing polish

### General MachinaLayout.JS return path

- extract reusable primitives back into the MIT library
- keep product-only code out of the MIT npm package
- identify which helpers belong in the core library vs the app

## License/package boundary

Intended boundary:

- MachinaLayout.JS library/toolbox: MIT
- MachinaCanvas app/product: AGPL-3.0-or-later via `apps/machina-canvas/LICENSE`

Current package boundary:

- root npm package is allowlist-based via `package.json#files`
- intended publish contents are `dist/`, root docs, `README.md`, and `LICENSE`
- `apps/machina-canvas/src` and app artifacts are not intended npm payload

Dry-run findings from this closeout:

- `npm pack --dry-run` produced `machinalayout-0.6.0.tgz`
- dry-run entry count: 148 files
- unpacked size: 1,162,589 bytes
- contents were limited to root MIT package material (`dist/**`, root `docs/**`, `README.md`, `LICENSE`, `package.json`)
- confirmed absent from pack output: `apps/machina-canvas/src/**`, `apps/machina-canvas/artifacts/**`, `apps/machina-canvas/fixtures/**`, `test/**`, and other app-only AGPL source paths

## Verification

Verification commands for this closeout:

```bash
npm run format
npm run format:check
npm run lint
npm test
npm run build
cd apps/machina-canvas && npm run build
npm pack --dry-run
npm pack --dry-run --json
npm run canvas:mechanical-exercise-354
npm run canvas:mechanical-exercise-354-blockout
npm run canvas:guide-overlay-fixture
```

Result summary from this closeout:

- `npm run format`: passed
- `npm run format:check`: passed
- `npm run lint`: passed
- `npm test`: passed (`152` test files, `1604` tests)
- `npm run build`: passed
- `cd apps/machina-canvas && npm run build`: passed with the existing Vite large-chunk warning
- `npm pack --dry-run`: passed
- `npm pack --dry-run --json`: passed
- `npm run canvas:mechanical-exercise-354`: passed
- `npm run canvas:mechanical-exercise-354-blockout`: passed
- `npm run canvas:guide-overlay-fixture`: passed
- `npm run canvas:mechanical-exercise-m40c`: also passed as an extra stable M40 dogfood check

Sample matrix, if a broader manual repo confidence pass is desired:

```txt
control-room
music-player
dispatch-counter
codex-product-page
style-dogfood
static-tabs
static-accordion
static-timeline
static-dispatch
static-http
toolkit-pipeline
```

Notes:

- the repo does not expose one single manual sample-matrix runner, so the standalone sample apps were not all re-run individually in this pass
- `npm test` already covered the checked test matrix, including sample-related coverage such as toolkit pipeline, static HTML lowering, and style dogfood paths

## Handoff notes for next ChatGPT/Codex

What not to touch casually:

- `apps/machina-canvas/src/sceneModel.ts`
- `apps/machina-canvas/src/sceneDocument.ts`
- `apps/machina-canvas/src/canvasExport.ts`
- `apps/machina-canvas/src/App.tsx`
- sidecar parsers/serializers and export bundle layout
- artifact filenames used by tests and dogfood scripts

Current successful verification commands:

- use the commands listed in the Verification section of this document
- root dogfood entry points live in the top-level `package.json`
- treat the Vite large-chunk warning as known debt, not a release blocker for this checkpoint

Where docs live:

- app overview: `apps/machina-canvas/README.md`
- phase closeout: `apps/machina-canvas/docs/phase-closeout-m40.md`
- export format: `docs/machina-canvas-export-format.md`
- related canvas/tool docs: `docs/machina-canvas-*.md`

Where artifacts live:

- checked-in dogfood and review artifacts: `apps/machina-canvas/artifacts/`
- editable/export fixtures: `apps/machina-canvas/fixtures/`

What is AGPL/product vs MIT/library:

- `apps/machina-canvas/**` is app/product territory unless something is clearly a shared library primitive
- published npm package at repo root is the MIT MachinaLayout.JS toolbox
- do not let AGPL app source drift into root package publish contents

Current best next tasks:

- return focus to MachinaLayout.JS core library work
- only touch MachinaCanvas for bug fixes, packaging/license hygiene, or deliberate productization work
- if MachinaCanvas grows again, consider repo/package split before adding major new systems

Current danger areas:

- coordinate semantics can look correct in helpers while still being inconsistent across render/authoring assumptions
- artifact filenames are part of tests and docs
- the app is large enough that casual refactors in `App.tsx` or export code can create broad regressions
- packaging/license boundaries must stay explicit whenever publish settings change
- local dev servers may keep `.codex-temp` and `vite-dev*.log` files open; they are ignore-covered local noise, not source artifacts
