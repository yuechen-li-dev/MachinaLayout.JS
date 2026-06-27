import { describe, expect, it } from "vitest";
import { defineMachinaAtlas, formatMachinaAtlasSummary } from "../../src/atlas";

const atlas = defineMachinaAtlas({
  app: "Scheduling",
  notes: "internal",
  sections: [
    {
      key: "front-page",
      name: "Front Page",
      kind: "page",
      route: "/apps/scheduling",
      fixture: "front-page",
      symbol: "FrontPageView",
      owns: ["FrontPageView"],
      uses: ["SchedulingShell"],
      tags: ["scheduling", "public"],
      notes: "landing",
    },
    { key: "shared-shell", name: "Shared Shell", kind: "shared", tags: ["shared"] },
  ],
});

describe("formatMachinaAtlasSummary", () => {
  it("includes app, count, default details, and deterministic ordering", () => {
    const summary = formatMachinaAtlasSummary(atlas);
    expect(summary).toContain("MachinaAtlas: Scheduling");
    expect(summary).toContain("Sections: 2");
    expect(summary).toContain("1. front-page — Front Page [page]");
    expect(summary).toContain("route: /apps/scheduling");
    expect(summary).toContain("fixture: front-page");
    expect(summary).toContain("tags: scheduling, public");
    expect(summary).not.toContain("notes: landing");
    expect(summary.indexOf("front-page")).toBeLessThan(summary.indexOf("shared-shell"));
  });

  it("can suppress optional details and include notes", () => {
    const summary = formatMachinaAtlasSummary(atlas, {
      includeRoutes: false,
      includeFixtures: false,
      includeTags: false,
      includeRelations: false,
      includeSymbols: false,
      includeNotes: true,
    });
    expect(summary).toContain("notes: landing");
    expect(summary).not.toContain("route:");
    expect(summary).not.toContain("fixture:");
    expect(summary).not.toContain("tags:");
    expect(summary).not.toContain("owns:");
    expect(summary).not.toContain("symbol:");
  });
});
