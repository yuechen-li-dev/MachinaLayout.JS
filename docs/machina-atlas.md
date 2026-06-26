# MachinaAtlas

> Keep the file. Add the map.

MachinaAtlas is an optional app-composition map for large single-file or few-file apps. It gives humans and LLM agents stable landmarks without requiring file-based routing, generated files, or framework structure.

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
