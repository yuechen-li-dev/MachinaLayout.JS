import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasCommandsToml,
  serializeCanvasDocumentJson,
  serializeCanvasHandoffToml,
  serializeCanvasLayerToml,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasCommand } from "../../apps/machina-canvas/src/sceneCommands";
import type { GeometryDiagnostic } from "../../apps/machina-canvas/src/sceneGeometry";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "export-demo",
  name: "Export Demo",
  width: 320,
  height: 180,
  unit: "px",
  unitSystem: createCanvasUnitSystem("px"),
  selectedObjectId: "headline",
  layers: [
    {
      id: "background",
      name: "Background",
      visible: true,
      objectIds: ["bg", "hidden-object"],
    },
    {
      id: "foreground",
      name: "Foreground",
      visible: true,
      objectIds: ["headline", "badge"],
    },
    {
      id: "hidden-layer",
      name: "Hidden Layer",
      visible: false,
      objectIds: ["hidden-layer-object"],
    },
  ],
  objects: {
    bg: {
      id: "bg",
      name: "Background",
      kind: "rect",
      layerId: "background",
      visible: true,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      frame: { kind: "anchor", left: 0, top: 0, right: 0, bottom: 0 },
      fill: "#ffffff",
      stroke: "#dddddd",
      radius: 0,
      tags: ["surface"],
      notes: "Root panel.",
    },
    "hidden-object": {
      id: "hidden-object",
      name: "Hidden Object",
      kind: "rect",
      layerId: "background",
      visible: false,
      x: 12,
      y: 12,
      width: 20,
      height: 20,
      fill: "#ff0000",
    },
    headline: {
      id: "headline",
      name: "Headline",
      kind: "text",
      layerId: "foreground",
      visible: true,
      x: 24,
      y: 30,
      width: 140,
      height: 44,
      fill: "#111111",
      text: "Export me",
      fontSize: 24,
      fontWeight: 700,
      tags: ["copy", "hero"],
      notes: "Primary text.",
    },
    badge: {
      id: "badge",
      name: "Badge",
      kind: "ellipse",
      layerId: "foreground",
      visible: true,
      x: 200,
      y: 40,
      width: 64,
      height: 36,
      fill: "#eeeeff",
      stroke: "#111111",
    },
    "hidden-layer-object": {
      id: "hidden-layer-object",
      name: "Hidden Layer Object",
      kind: "ellipse",
      layerId: "hidden-layer",
      visible: true,
      x: 40,
      y: 40,
      width: 40,
      height: 40,
      fill: "#00ff00",
    },
    orphan: {
      id: "orphan",
      name: "Orphan",
      kind: "rect",
      layerId: "missing",
      visible: true,
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      fill: "#000000",
    },
  },
};

const commands: CanvasCommand[] = [
  { kind: "select", id: "headline" },
  { kind: "move", id: "headline", dx: 2, dy: 3 },
  { kind: "resize", id: "bg", width: 300, height: 160 },
  { kind: "setFill", id: "badge", fill: "#ff00ff" },
  { kind: "setStroke", id: "badge", stroke: "#00ffff" },
  { kind: "align", ids: ["bg", "headline"], axis: "left" },
  { kind: "distribute", ids: ["bg", "headline", "badge"], axis: "horizontal", gap: 12 },
  { kind: "moveToGrid", id: "headline", ref: "B2.c", anchor: "center" },
  { kind: "alignToGrid", ids: ["headline", "badge"], axis: "left", ref: "A1.w" },
  { kind: "resizeToGridSpan", id: "bg", span: "A1-C2" },
  {
    kind: "setFrame",
    id: "badge",
    frame: { kind: "anchor", right: 24, top: 40, width: 64, height: 36 },
  },
];

describe("MachinaCanvas export serializers", () => {
  it("serializes document.json as the bundle graph and asset index", () => {
    const serialized = serializeCanvasDocumentJson(document);
    const parsed = JSON.parse(serialized);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.document).toEqual({
      id: "export-demo",
      name: "Export Demo",
      width: 320,
      height: 180,
      unit: "px",
      unitSystem: {
        unit: "px",
        label: "px",
        unitsPerInch: 96,
        pixelsPerUnit: 1,
        precision: 0,
      },
      coordinateProfile: {
        id: "screen",
        label: "Screen coordinates",
        yAxis: "down",
        origin: "topLeft",
        description: "SVG/React-style render coordinates with +X right and +Y down.",
      },
    });
    expect(parsed.referenceGrid).toEqual({
      columns: 6,
      rows: 4,
      columnLabels: ["A", "B", "C", "D", "E", "F"],
      rowLabels: ["1", "2", "3", "4"],
    });
    expect(parsed.layers[0]).toEqual({
      id: "background",
      asset: "layers/background.toml",
      objectIds: ["bg", "hidden-object"],
    });
    expect(Object.keys(parsed.objects)).toEqual([
      "bg",
      "hidden-object",
      "headline",
      "badge",
      "hidden-layer-object",
      "orphan",
    ]);
    expect(parsed.objects.headline).toEqual({
      kind: "text",
      asset: "objects/headline.toml",
    });
  });

  it("serializes object TOML for rect, text, and ellipse objects", () => {
    const rectToml = serializeCanvasObjectToml(document.objects.bg);
    const textToml = serializeCanvasObjectToml(document.objects.headline);
    const ellipseToml = serializeCanvasObjectToml(document.objects.badge);

    expect(rectToml).toContain("[geometry]\nx = 0\ny = 0\nwidth = 320\nheight = 180");
    expect(rectToml).toContain(
      '[frame]\nkind = "anchor"\nleft = 0\nright = 0\ntop = 0\nbottom = 0',
    );
    expect(rectToml).toContain("[resolved]\nx = 0\ny = 0\nwidth = 320\nheight = 180");
    expect(textToml).toContain(
      '[frame]\nkind = "absolute"\nx = 24\ny = 30\nwidth = 140\nheight = 44',
    );
    expect(textToml).toContain("[resolved]\nx = 24\ny = 30\nwidth = 140\nheight = 44");
    expect(rectToml).toContain("[shape]\nradius = 0");
    expect(rectToml).toContain('[style]\nfill = "#ffffff"\nstroke = "#dddddd"');
    expect(rectToml).toContain('[metadata]\ntags = ["surface"]\nnotes = "Root panel."');
    expect(textToml).toContain('[text]\nvalue = "Export me"\nfont_size = 24\nfont_weight = 700');
    expect(textToml).toContain('tags = ["copy", "hero"]');
    expect(ellipseToml).toContain('kind = "ellipse"');
    expect(ellipseToml).toContain('[style]\nfill = "#eeeeff"\nstroke = "#111111"');
  });

  it("serializes layer TOML without duplicating object order", () => {
    const toml = serializeCanvasLayerToml(document.layers[0]);

    expect(toml).toContain('id = "background"');
    expect(toml).toContain('name = "Background"');
    expect(toml).toContain("visible = true");
    expect(toml).not.toContain("objectIds");
    expect(toml).not.toContain("bg");
  });

  it("serializes supported command recipes to TOML", () => {
    const toml = serializeCanvasCommandsToml("Test commands", commands, "All command kinds.");

    expect(toml).toContain('name = "Test commands"');
    expect(toml).toContain('description = "All command kinds."');
    expect(toml.match(/\[\[command\]\]/g)).toHaveLength(commands.length);
    expect(toml).toContain('kind = "select"\nid = "headline"');
    expect(toml).toContain('kind = "move"\nid = "headline"\ndx = 2\ndy = 3');
    expect(toml).toContain('kind = "resize"\nid = "bg"\nwidth = 300\nheight = 160');
    expect(toml).toContain('kind = "setFill"\nid = "badge"\nfill = "#ff00ff"');
    expect(toml).toContain('kind = "setStroke"\nid = "badge"\nstroke = "#00ffff"');
    expect(toml).toContain('kind = "align"\naxis = "left"\nids = ["bg", "headline"]');
    expect(toml).toContain(
      'kind = "distribute"\naxis = "horizontal"\nids = ["bg", "headline", "badge"]\ngap = 12',
    );
    expect(toml).toContain('kind = "moveToGrid"\nid = "headline"\nref = "B2.c"\nanchor = "center"');
    expect(toml).toContain(
      'kind = "alignToGrid"\naxis = "left"\nids = ["headline", "badge"]\nref = "A1.w"',
    );
    expect(toml).toContain('kind = "resizeToGridSpan"\nid = "bg"\nspan = "A1-C2"');
    expect(toml).toContain(
      'kind = "setFrame"\nid = "badge"\n\n[command.frame]\nkind = "anchor"\nright = 24\ntop = 40\nwidth = 64\nheight = 36',
    );
  });

  it("serializes handoff metadata with selection and diagnostics", () => {
    const diagnostics: GeometryDiagnostic[] = [
      {
        severity: "warning",
        code: "OutOfBounds",
        message: "Headline exceeds the artboard.",
        objectIds: ["headline"],
      },
      {
        severity: "info",
        code: "NearAlignment",
        message: "Headline aligns with Badge.",
        objectIds: ["headline", "badge"],
      },
    ];

    const toml = serializeCanvasHandoffToml(document, {
      selectedObjectId: "headline",
      summary: "A small export demo.",
      diagnostics,
    });

    expect(toml).toContain("schema_version = 1");
    expect(toml).toContain('[selected]\nobject_id = "headline"');
    expect(toml).toContain(
      '[unit_system]\nunit = "px"\nlabel = "px"\nunits_per_inch = 96\npixels_per_unit = 1\nprecision = 0',
    );
    expect(toml).toContain(
      '[reference_grid]\ncolumns = 6\nrows = 4\ncolumns_label = "A-F"\nrows_label = "1-4"',
    );
    expect(toml).toContain('[summary]\ntext = "A small export demo."');
    expect(toml).toContain("[validation]\nok = false\ndiagnostics = 2");
    expect(toml).toContain('object_id = "headline"');
    expect(toml).toContain('object_ids = ["headline", "badge"]');
  });

  it("serializes clean standalone SVG output", () => {
    const svg = serializeCanvasRenderSvg(document);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('data-canvas-object-id="headline"');
    expect(svg).toContain('data-canvas-kind="text"');
    expect(svg).toContain('data-canvas-name="Badge"');
    expect(svg).not.toContain('data-canvas-object-id="hidden-object"');
    expect(svg).not.toContain('data-canvas-object-id="hidden-layer-object"');
    expect(svg).not.toContain("selection-box");
    expect(svg).not.toContain("is-selected");
    expect(svg).not.toContain("reference-grid");
  });

  it("assembles a deterministic text-only export bundle without mutating the document", () => {
    const before = JSON.stringify(document);
    const bundle = createCanvasExportBundle(document, {
      commands,
      diagnostics: [],
      summary: "Bundle summary.",
    });

    expect(bundle.rootName).toBe("export-demo.mcanvas");
    expect(bundle.files.map((file) => file.path)).toEqual([
      "render.svg",
      "document.json",
      "handoff.toml",
      "layers/background.toml",
      "layers/foreground.toml",
      "layers/hidden-layer.toml",
      "objects/bg.toml",
      "objects/hidden-object.toml",
      "objects/headline.toml",
      "objects/badge.toml",
      "objects/hidden-layer-object.toml",
      "objects/orphan.toml",
      "commands/session-commands.toml",
    ]);
    expect(bundle.files.every((file) => typeof file.text === "string")).toBe(true);
    expect(bundle.files.find((file) => file.path === "render.svg")?.mimeType).toBe("image/svg+xml");
    expect(bundle.files.find((file) => file.path === "document.json")?.mimeType).toBe(
      "application/json",
    );
    expect(bundle.files.find((file) => file.path === "handoff.toml")?.mimeType).toBe("text/plain");
    expect(JSON.stringify(document)).toBe(before);
  });

  it("keeps document.json object assets aligned with bundle object files", () => {
    const bundle = createCanvasExportBundle(document);
    const index = JSON.parse(
      bundle.files.find((file) => file.path === "document.json")?.text ?? "",
    ) as {
      objects: Record<string, { asset: string }>;
    };
    const bundlePaths = new Set(bundle.files.map((file) => file.path));

    for (const object of Object.values(index.objects)) {
      expect(bundlePaths.has(object.asset)).toBe(true);
    }
  });
});
