# MachinaAtlas

> Keep the file. Add the map.

MachinaAtlas is an optional app-composition map for large single-file or few-file apps. It gives humans and LLM agents stable landmarks without requiring file-based routing, generated files, or framework structure.

In 0.6.0, Atlas tables are project cartography authoring inside the typed table authoring and derivation substrate. They do not scan the filesystem, infer dependencies, or replace the existing Atlas runtime shape.

## What MachinaAtlas is

- A typed metadata table for app sections.
- Lightweight `@machina-section` source markers in comments.
- Pure string parsing and extraction helpers.
- A summary formatter for handoff packets and model context.

## What MachinaAtlas is not

MachinaAtlas is not routing, Next.js, Storybook, code generation, runtime JSX section tags, a filesystem scanner, or a requirement for small apps. It does not render pages or change application behavior.

## Preferred authoring pattern

```tsx
import { defineMachinaAtlas } from "machinalayout/atlas";

export const SchedulingAtlas = defineMachinaAtlas({
  app: "Scheduling",
  sections: [
    {
      key: "front-page",
      name: "Front Page",
      kind: "page",
      marker: "Front Page",
      route: "/apps/scheduling",
      fixture: "front-page",
      owns: ["FrontPageView", "HeroCard", "LandingCta"],
      uses: ["SchedulingShell", "PrimaryButton"],
      tags: ["scheduling", "public", "landing"],
    },
    {
      key: "provider-setup",
      name: "Provider Setup",
      kind: "page",
      marker: "Provider Setup",
      route: "/apps/scheduling/setup",
      fixture: "provider-setup",
      owns: ["ProviderSetupView", "ProviderProfileForm"],
      uses: ["SchedulingShell", "SetupSidebar"],
      tags: ["scheduling", "provider", "setup"],
    },
    {
      key: "shared-shell",
      name: "Shared Shell",
      kind: "shared",
      marker: "Shared Shell",
      owns: ["SchedulingShell", "SetupSidebar"],
      usedBy: ["front-page", "provider-setup", "public-booking"],
      tags: ["shared", "layout"],
    },
  ],
});
```

## Atlas tables

Atlas tables are project symbol tables.

Machina Atlas tables are an authoring surface for project cartography. They do not scan the filesystem or infer dependencies.

Tables are the assembly code of frontend. Atlas tables are the symbol table.

The existing object-array Atlas shape remains the runtime form:

```ts
import { defineMachinaAtlas } from "machinalayout/atlas";

export const SchedulingAtlas = defineMachinaAtlas({
  app: "Scheduling",
  sections: [
    {
      key: "setup",
      name: "Provider setup wizard",
      kind: "page",
      route: "/apps/scheduling/setup",
      fixture: "provider-setup",
      owns: ["ProviderSetupFlow", "ProviderSetupView"],
      uses: ["shared/format", "shared/liveContext"],
      usedBy: ["shared-shell"],
      tags: ["scheduling", "setup", "m0"],
      notes: "M0 deliverable.",
    },
    {
      key: "shared-format",
      name: "Shared formatters",
      kind: "shared",
      file: "shared/format.ts",
      owns: ["slotKey", "statusLabel"],
      usedBy: ["setup", "landing"],
      tags: ["shared", "pure"],
      notes: "Pure, no React.",
    },
  ],
});
```

The new table-authored bridge lets you author the same Atlas as a columnar table and then lower it into the existing runtime:

```ts
import { Atlas } from "machinalayout/atlas";
import { Table } from "machinalayout/table";

const schedulingAtlasTable = Table.defineWithSchema({
  id: "schedulingAtlas",
  schema: Atlas.sectionTableSchema(),
  columns: {
    key: ["setup", "shared-format", "shared-live-context"],
    name: [
      "Provider setup wizard",
      "Shared formatters",
      "Live-mode routing & admin gate",
    ],
    kind: ["page", "shared", "shared"],
    route: ["/apps/scheduling/setup", undefined, undefined],
    file: [undefined, "shared/format.ts", "shared/liveContext.ts"],
    fixture: ["provider-setup", undefined, undefined],
    owns: [
      ["ProviderSetupFlow", "ProviderSetupView"],
      ["slotKey", "statusLabel"],
      ["isFixtureMode", "loadLiveContext"],
    ],
    uses: [["shared/format", "shared/liveContext"], [], []],
    usedBy: [["shared-shell"], ["setup", "landing"], ["setup", "landing"]],
    tags: [
      ["scheduling", "setup", "m0"],
      ["shared", "pure"],
      ["shared", "live-mode"],
    ],
    notes: [
      "M0 deliverable.",
      "Pure, no React.",
      "Extracted specifically to avoid circular imports.",
    ],
  },
});

const sections = Atlas.sectionsFromTable(schedulingAtlasTable);

const atlas = Atlas.defineAtlasFromTable({
  app: "Scheduling",
  sections: schedulingAtlasTable,
});
```

Array cells stay arrays. `owns`, `uses`, `usedBy`, and `tags` are not stringified or collapsed into comma-separated text.

If you prefer named helpers instead of the namespace, the atlas subpath also exports `sectionTableSchema`, `sectionsFromTable`, `validateAtlasSectionTable`, `defineMachinaAtlasFromTable`, `defineAtlasFromTable`, and `describeAtlasSections`.

Use `validateAtlasSectionTable(table)` when you want diagnostics without throwing:

```txt
error DuplicateAtlasSectionKey at schedulingAtlas.key[4]
  Atlas section key "setup" already appears at row 0.

error InvalidAtlasSectionUses at schedulingAtlas.uses[2]
  Atlas section "shared-format" uses value must be an array of strings.
```

The bridge is intentionally narrow:

- tables author Atlas rows
- Atlas still owns the runtime/project-cartography model
- no filesystem scanning
- no TypeScript import parsing
- no inferred ownership
- no graph database
- no documentation generator
- no LLM agent framework

Then mark source sections in the same file:

```tsx
// @machina-section Front Page
function FrontPageView() {}

// @machina-section Provider Setup
function ProviderSetupView() {}

// @machina-section Shared Shell
function SchedulingShell() {}
```

## Marker syntax

Supported markers are line comments and single-line block comments:

```ts
// @machina-section Front Page
/* @machina-section Shared Shell */
```

The parser is line-based and not AST-aware. To avoid string-literal false positives, M27 only accepts markers on lines whose trimmed text starts with `//` or `/*`. A section starts at its marker line and ends before the next marker or at end of file.

## Extraction helpers

```ts
import { extractMachinaAtlasSection, extractMachinaSection, extractMachinaSections } from "machinalayout/atlas";

const sections = extractMachinaSections(sourceText);
const frontPage = extractMachinaSection(sourceText, "Front Page");
const viaAtlas = extractMachinaAtlasSection(sourceText, SchedulingAtlas, "front-page");
```

Extraction normalizes line endings to `\n` in returned section text.

## Formatting a summary for handoff

```ts
import { formatMachinaAtlasSummary } from "machinalayout/atlas";

const summary = formatMachinaAtlasSummary(SchedulingAtlas);
```

The summary includes app name, section count, ordered sections, and by default routes, fixtures, tags, symbols, and section relationships. Notes can be included with `includeNotes: true`.

## Relationship to existing features

- The screen catalog describes route, fixture, viewport, and task states.
- Atlas describes source/app composition and where code lives.
- A handoff bundle can include an Atlas summary or an extracted source section.

## Adoption guidance

Do not use MachinaAtlas for tiny one-page apps. Use it when a file intentionally contains multiple related pages, views, or components; when splitting files would reduce useful locality; or when LLMs and humans need stable landmarks for summary, extraction, handoff, and patching.

## Atlas as a living source map

MachinaAtlas is most useful when it stays honest as source changes. Treat it as a living source map for humans and LLM handoff: the Atlas declares which source sections exist, which symbols each section owns, and which section keys it depends on.

Validation keeps that map from silently rotting. It compares an Atlas with a caller-provided source string and checks source markers, ownership declarations, relation references, duplicate ownership, and optional used-symbol declarations.

## `M.section` and `M.atlas`

The authoring surface also exposes light Atlas builders from `machinalayout/machina`:

```ts
import { M } from "machinalayout/machina";

export const SchedulingAtlas = M.atlas({
  app: "Scheduling",
  sections: [
    M.section("provider-setup", {
      name: "Provider Setup",
      kind: "page",
      marker: "Provider Setup",
      owns: ["ProviderSetupView"],
      uses: ["shared-shell"],
      dependsOn: ["shared-shell"],
      tags: ["scheduling", "setup"],
    }),
  ],
});
```

These are convenience builders over the existing Atlas types. They do not replace `defineMachinaAtlas`, and final Atlas shape validation still happens through the Atlas implementation.

## Validation

```ts
import {
  formatMachinaAtlasValidationReport,
  validateMachinaAtlas,
} from "machinalayout/atlas";

const result = validateMachinaAtlas({
  atlas: SchedulingAtlas,
  sourceText,
  options: {
    requireSectionMarkers: true,
    checkOwns: true,
    checkUses: true,
    checkRelations: true,
  },
});

console.log(formatMachinaAtlasValidationReport(result));
```

By default, validation requires each Atlas section marker to exist, checks declared owned symbols in the extracted source section, checks `usedBy` and `dependsOn` relation keys, detects duplicate ownership, and uses identifier-aware symbol matching. `checkUses` is off by default because `uses` may mean either a section key or a symbol name; when enabled, entries matching section keys are treated as relations and other entries are checked as symbols.

## What validation checks

- Atlas section markers using `section.marker ?? section.name`.
- Optional unmapped source markers with `requireAtlasForEveryMarker: true`.
- Declared `owns` symbols inside their extracted source sections.
- Optional declared `uses` symbols with `checkUses: true`.
- `usedBy` and `dependsOn` entries that point to unknown section keys.
- Duplicate `owns` declarations across sections.

## What validation does not check

Validation is deliberately source-text based. It does not check actual TypeScript imports, alias resolution, barrel exports, JSX runtime semantics, cross-file dependency graphs, semantic ownership, or dead code.

It does not scan directories, read files from disk, parse TypeScript ASTs, generate code, modify source text, or implement routing.

## Recommended LLM handoff workflow

1. Define the Atlas with `defineMachinaAtlas` or the `M.section` / `M.atlas` builders.
2. Mark source sections with `// @machina-section Section Name`.
3. Run `validateMachinaAtlas` against the source text.
4. Extract the relevant section with the existing extraction helpers.
5. Include the Atlas summary and validation report in the handoff bundle so a human or model can see both the intended map and whether it matches the current source.
