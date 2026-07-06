import { describe, expect, it } from "vitest";
import {
  Atlas,
  defineAtlasFromTable,
  defineMachinaAtlasFromTable,
  describeAtlasSections,
  sectionTableSchema,
  sectionsFromTable,
} from "../../src/atlas";
import { Table, TableError } from "../../src/table";

function schedulingAtlasTable() {
  return Table.define({
    id: "schedulingAtlas",
    columns: {
      key: ["setup", "shared-format", "shared-live-context"] as const,
      name: [
        "Provider setup wizard",
        "Shared formatters",
        "Live-mode routing & admin gate",
      ] as const,
      kind: ["page", "shared", "shared"] as const,
      route: ["/apps/scheduling/setup", undefined, undefined] as const,
      file: [undefined, "shared/format.ts", "shared/liveContext.ts"] as const,
      fixture: ["provider-setup", undefined, undefined] as const,
      owns: [
        ["ProviderSetupFlow", "ProviderSetupView"],
        ["slotKey", "statusLabel"],
        ["isFixtureMode", "loadLiveContext"],
      ] as const,
      uses: [["shared/format", "shared/liveContext"], [], []] as const,
      usedBy: [["shared-shell"], ["setup", "landing"], ["setup", "landing"]] as const,
      tags: [
        ["scheduling", "setup", "m0"],
        ["shared", "pure"],
        ["shared", "live-mode"],
      ] as const,
      notes: [
        "M0 deliverable.",
        "Pure, no React.",
        "Extracted specifically to avoid circular imports.",
      ] as const,
    },
  });
}

describe("atlas tables", () => {
  it("Atlas.sectionTableSchema returns a table schema", () => {
    expect(Atlas.sectionTableSchema()).toEqual({
      kind: "tableSchema",
      columns: {
        key: { kind: "string" },
        name: { kind: "string" },
        kind: {
          kind: "enum",
          values: [
            "app",
            "page",
            "screen",
            "view",
            "component",
            "layout",
            "behavior",
            "fixture",
            "data",
            "shared",
            "test",
            "other",
          ],
        },
        route: { kind: "string", optional: true },
        file: { kind: "string", optional: true },
        fixture: { kind: "string", optional: true },
        owns: { kind: "unknown", optional: true },
        uses: { kind: "unknown", optional: true },
        usedBy: { kind: "unknown", optional: true },
        tags: { kind: "unknown", optional: true },
        notes: { kind: "string", optional: true },
      },
    });
    expect(sectionTableSchema).toBeTypeOf("function");
  });

  it("Atlas.sectionsFromTable lowers a columnar table to sections", () => {
    expect(Atlas.sectionsFromTable(schedulingAtlasTable())).toEqual([
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
        uses: [],
        usedBy: ["setup", "landing"],
        tags: ["shared", "pure"],
        notes: "Pure, no React.",
      },
      {
        key: "shared-live-context",
        name: "Live-mode routing & admin gate",
        kind: "shared",
        file: "shared/liveContext.ts",
        owns: ["isFixtureMode", "loadLiveContext"],
        uses: [],
        usedBy: ["setup", "landing"],
        tags: ["shared", "live-mode"],
        notes: "Extracted specifically to avoid circular imports.",
      },
    ]);
  });

  it("works with schema table", () => {
    const authored = Table.defineWithSchema({
      id: "schedulingAtlas",
      schema: Atlas.sectionTableSchema(),
      columns: schedulingAtlasTable().columns,
    });

    const sections = Atlas.sectionsFromTable(authored);
    expect(sections[0]?.key).toBe("setup");
  });

  it("preserves row order", () => {
    const sections = Atlas.sectionsFromTable(schedulingAtlasTable());
    expect(sections.map((section) => section.key)).toEqual([
      "setup",
      "shared-format",
      "shared-live-context",
    ]);
  });

  it("optional route file fixture and notes flow through", () => {
    const sections = Atlas.sectionsFromTable(schedulingAtlasTable());
    expect(sections[0]).toMatchObject({
      route: "/apps/scheduling/setup",
      fixture: "provider-setup",
      notes: "M0 deliverable.",
    });
    expect(sections[1]).toMatchObject({
      file: "shared/format.ts",
      notes: "Pure, no React.",
    });
  });

  it("owns uses usedBy and tags array cells flow through as arrays", () => {
    const sections = Atlas.sectionsFromTable(schedulingAtlasTable());
    expect(sections[0]?.owns).toEqual(["ProviderSetupFlow", "ProviderSetupView"]);
    expect(Array.isArray(sections[0]?.owns)).toBe(true);
    expect(sections[0]?.uses).toEqual(["shared/format", "shared/liveContext"]);
    expect(Array.isArray(sections[1]?.uses)).toBe(true);
    expect(sections[1]?.usedBy).toEqual(["setup", "landing"]);
    expect(sections[2]?.tags).toEqual(["shared", "live-mode"]);
  });

  it("missing array columns default to empty arrays", () => {
    const sections = Atlas.sectionsFromTable(
      Table.define({
        id: "compactAtlas",
        columns: {
          key: ["front-page"],
          name: ["Front Page"],
          kind: ["page"],
        },
      }),
    );

    expect(sections).toEqual([
      {
        key: "front-page",
        name: "Front Page",
        kind: "page",
        owns: [],
        uses: [],
        usedBy: [],
        tags: [],
      },
    ]);
  });

  it("Atlas.defineFromTable returns the existing atlas shape", () => {
    const atlas = Atlas.defineAtlasFromTable({
      app: "Scheduling",
      sections: schedulingAtlasTable(),
      notes: "Atlas tables are project symbol tables.",
    });

    expect(atlas).toMatchObject({
      schemaVersion: 1,
      app: "Scheduling",
      notes: "Atlas tables are project symbol tables.",
    });
    expect(atlas.sections).toHaveLength(3);
  });

  it("named define helpers return the existing atlas shape", () => {
    const atlas = defineAtlasFromTable({
      app: "Scheduling",
      sections: schedulingAtlasTable(),
    });
    const sameAtlas = defineMachinaAtlasFromTable({
      app: "Scheduling",
      sections: schedulingAtlasTable(),
    });

    expect(atlas.sections).toEqual(sameAtlas.sections);
  });

  it("describeAtlasSections returns counts and kinds", () => {
    expect(
      describeAtlasSections(sectionsFromTable(schedulingAtlasTable()), "schedulingAtlas"),
    ).toEqual({
      kind: "atlasSectionTableDescription",
      tableId: "schedulingAtlas",
      sectionCount: 3,
      kinds: ["page", "shared"],
      tagCount: 6,
    });
  });

  it("missing key column reports MissingAtlasSectionColumn", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          name: ["Provider setup wizard"],
          kind: ["page"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingAtlasSectionColumn",
        tableId: "schedulingAtlas",
        column: "key",
        path: "schedulingAtlas.key",
      }),
    );
  });

  it("missing name and kind columns report diagnostics", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          key: ["setup"],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MissingAtlasSectionColumn",
          column: "name",
          path: "schedulingAtlas.name",
        }),
        expect.objectContaining({
          code: "MissingAtlasSectionColumn",
          column: "kind",
          path: "schedulingAtlas.kind",
        }),
      ]),
    );
  });

  it("invalid key reports diagnostic", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          key: ["", "shared-format", "shared-live-context"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidAtlasSectionKey",
        column: "key",
        row: 0,
        path: "schedulingAtlas.key[0]",
      }),
    );
  });

  it("invalid name reports diagnostic", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          name: ["Provider setup wizard", "", "Live-mode routing & admin gate"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidAtlasSectionName",
        column: "name",
        row: 1,
      }),
    );
  });

  it("invalid kind reports diagnostic", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          kind: ["page", "bad-kind", "shared"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidAtlasSectionKind",
        column: "kind",
        row: 1,
      }),
    );
  });

  it("invalid route file fixture and notes report diagnostics", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          route: [7, undefined, undefined],
          file: [undefined, false, "shared/liveContext.ts"],
          fixture: [{}, undefined, undefined],
          notes: ["M0 deliverable.", "Pure, no React.", 9],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidAtlasSectionRoute",
          column: "route",
          row: 0,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionFile",
          column: "file",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionFixture",
          column: "fixture",
          row: 0,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionNotes",
          column: "notes",
          row: 2,
        }),
      ]),
    );
  });

  it("invalid owns uses usedBy and tags report diagnostics", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          owns: [["ProviderSetupFlow"], "slotKey", ["isFixtureMode"]],
          uses: [["shared/format"], [1], []],
          usedBy: [["shared-shell"], ["setup"], [false]],
          tags: [["scheduling"], ["shared"], "live-mode"],
        },
      }),
    );

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "InvalidAtlasSectionOwns",
          column: "owns",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionUses",
          column: "uses",
          row: 1,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionUsedBy",
          column: "usedBy",
          row: 2,
        }),
        expect.objectContaining({
          code: "InvalidAtlasSectionTags",
          column: "tags",
          row: 2,
        }),
      ]),
    );
  });

  it("duplicate key reports diagnostic", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          key: ["setup", "setup", "shared-live-context"],
        },
      }),
    );

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "DuplicateAtlasSectionKey",
        column: "key",
        row: 1,
        message: 'Atlas section key "setup" already appears at row 0.',
      }),
    );
  });

  it("diagnostics include table id column row and path", () => {
    const diagnostics = Atlas.validateAtlasSectionTable(
      Table.define({
        id: "schedulingAtlas",
        columns: {
          ...schedulingAtlasTable().columns,
          uses: [["shared/format"], ["setup"], [1]],
        },
      }),
    );

    expect(diagnostics).toContainEqual({
      severity: "error",
      code: "InvalidAtlasSectionUses",
      message: 'Atlas section "shared-live-context" uses value must be an array of strings.',
      tableId: "schedulingAtlas",
      column: "uses",
      row: 2,
      path: "schedulingAtlas.uses[2]",
    });
  });

  it("Atlas.sectionsFromTable throws TableError on invalid table", () => {
    expect(() =>
      Atlas.sectionsFromTable(
        Table.define({
          id: "schedulingAtlas",
          columns: {
            ...schedulingAtlasTable().columns,
            name: ["Provider setup wizard", "", "Live-mode routing & admin gate"],
          },
        }),
      ),
    ).toThrow(TableError);
  });

  it("Atlas.validateAtlasSectionTable returns diagnostics without throwing", () => {
    expect(() =>
      Atlas.validateAtlasSectionTable(
        Table.define({
          id: "schedulingAtlas",
          columns: {
            ...schedulingAtlasTable().columns,
            key: ["setup", "setup", "shared-live-context"],
          },
        }),
      ),
    ).not.toThrow();
  });
});
