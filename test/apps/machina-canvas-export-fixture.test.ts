import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type FixtureDocument = {
  schemaVersion: number;
  referenceGrid?: {
    columns: number;
    rows: number;
    columnLabels: string[];
    rowLabels: string[];
  };
  layers: {
    id: string;
    asset: string;
    objectIds: string[];
  }[];
  objects: Record<
    string,
    {
      kind: string;
      asset: string;
    }
  >;
};

const fixtureRoot = join(
  process.cwd(),
  "apps",
  "machina-canvas",
  "fixtures",
  "demo-poster.mcanvas",
);

function readFixtureDocument(): FixtureDocument {
  return JSON.parse(readFileSync(join(fixtureRoot, "document.json"), "utf8")) as FixtureDocument;
}

describe("MachinaCanvas export fixture", () => {
  it("keeps document.json references consistent with checked-in assets", () => {
    const document = readFixtureDocument();

    expect(document.schemaVersion).toBe(1);
    expect(document.referenceGrid).toEqual({
      columns: 6,
      rows: 4,
      columnLabels: ["A", "B", "C", "D", "E", "F"],
      rowLabels: ["1", "2", "3", "4"],
    });
    expect(existsSync(join(fixtureRoot, "handoff.toml"))).toBe(true);
    expect(existsSync(join(fixtureRoot, "render.svg"))).toBe(true);

    for (const layer of document.layers) {
      expect(existsSync(join(fixtureRoot, layer.asset))).toBe(true);

      for (const objectId of layer.objectIds) {
        expect(document.objects[objectId]).toBeDefined();
      }
    }

    for (const [objectId, object] of Object.entries(document.objects)) {
      expect(object.asset).toBe(
        object.kind === "sketchOverlay"
          ? `objects/${objectId}.sketch.toml`
          : `objects/${objectId}.toml`,
      );
      expect(existsSync(join(fixtureRoot, object.asset))).toBe(true);
      const objectToml = readFileSync(join(fixtureRoot, object.asset), "utf8");
      if (object.kind === "sketchOverlay") {
        expect(objectToml).toContain('dialect = "sketch"');
      } else {
        expect(objectToml).toContain("[frame]");
        expect(objectToml).toContain("[resolved]");
      }
    }

    const renderSvg = readFileSync(join(fixtureRoot, "render.svg"), "utf8");
    expect(renderSvg).toContain("data-canvas-object-id");
    expect(renderSvg).not.toContain("reference-grid");

    const handoffToml = readFileSync(join(fixtureRoot, "handoff.toml"), "utf8");
    expect(handoffToml).toContain("[reference_grid]");
    expect(handoffToml).toContain("[viewport]");
  });
});
