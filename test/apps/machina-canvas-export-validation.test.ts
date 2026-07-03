import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  type CanvasExportBundle,
  type CanvasExportFile,
} from "../../apps/machina-canvas/src/canvasExport";
import {
  formatCanvasExportValidationReport,
  validateCanvasExportBundle,
  type CanvasExportValidationDiagnosticCode,
} from "../../apps/machina-canvas/src/canvasExportValidation";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

const document: CanvasDocument = {
  id: "validation-demo",
  name: "Validation Demo",
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
      objectIds: ["bg"],
    },
    {
      id: "foreground",
      name: "Foreground",
      visible: true,
      objectIds: ["headline", "badge"],
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
      fill: "#ffffff",
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
      text: "Validate me",
      fontSize: 24,
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
    },
  },
};

function createBundle(): CanvasExportBundle {
  return createCanvasExportBundle(document);
}

function withoutFile(bundle: CanvasExportBundle, path: string): CanvasExportBundle {
  return {
    ...bundle,
    files: bundle.files.filter((file) => file.path !== path),
  };
}

function replaceFile(
  bundle: CanvasExportBundle,
  path: string,
  update: (file: CanvasExportFile) => CanvasExportFile,
): CanvasExportBundle {
  return {
    ...bundle,
    files: bundle.files.map((file) => (file.path === path ? update(file) : file)),
  };
}

function withFile(bundle: CanvasExportBundle, file: CanvasExportFile): CanvasExportBundle {
  return {
    ...bundle,
    files: [...bundle.files, file],
  };
}

function getCodes(bundle: CanvasExportBundle): CanvasExportValidationDiagnosticCode[] {
  return validateCanvasExportBundle(bundle).diagnostics.map((diagnostic) => diagnostic.code);
}

describe("MachinaCanvas export validation", () => {
  it("passes a valid generated bundle", () => {
    const result = validateCanvasExportBundle(createBundle());

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("accepts document.json with reference grid metadata", () => {
    const bundle = createBundle();
    const documentJson = bundle.files.find((file) => file.path === "document.json")?.text ?? "";

    expect(documentJson).toContain('"referenceGrid"');
    expect(validateCanvasExportBundle(bundle).ok).toBe(true);
  });

  it("fails an empty bundle", () => {
    const result = validateCanvasExportBundle({ rootName: "empty.mcanvas", files: [] });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("EmptyExportBundle");
  });

  it("fails when document.json is missing", () => {
    const result = validateCanvasExportBundle(withoutFile(createBundle(), "document.json"));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "MissingRequiredFile", path: "document.json" }),
    );
  });

  it("fails when document.json is invalid JSON", () => {
    const bundle = replaceFile(createBundle(), "document.json", (file) => ({
      ...file,
      text: "{",
    }));

    expect(getCodes(bundle)).toContain("InvalidDocumentJson");
  });

  it("reports missing layer assets", () => {
    const result = validateCanvasExportBundle(
      withoutFile(createBundle(), "layers/foreground.toml"),
    );

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingLayerAsset",
        path: "layers/foreground.toml",
        layerId: "foreground",
      }),
    );
  });

  it("reports missing object assets", () => {
    const result = validateCanvasExportBundle(withoutFile(createBundle(), "objects/headline.toml"));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingObjectAsset",
        path: "objects/headline.toml",
        objectId: "headline",
      }),
    );
  });

  it("reports unknown layer object ids", () => {
    const bundle = replaceFile(createBundle(), "document.json", (file) => {
      const index = JSON.parse(file.text) as {
        layers: Array<{ id: string; objectIds: string[] }>;
      };
      index.layers[0].objectIds.push("ghost");
      return { ...file, text: JSON.stringify(index, null, 2) };
    });

    const result = validateCanvasExportBundle(bundle);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "UnknownLayerObject",
        objectId: "ghost",
        layerId: "background",
      }),
    );
  });

  it("warns about unknown object TOML assets", () => {
    const result = validateCanvasExportBundle(
      withFile(createBundle(), {
        path: "objects/ghost.toml",
        mimeType: "text/plain",
        text: 'id = "ghost"\n',
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "UnknownObjectAsset",
        path: "objects/ghost.toml",
      }),
    );
  });

  it("warns when render.svg is missing an object id", () => {
    const bundle = replaceFile(createBundle(), "render.svg", (file) => ({
      ...file,
      text: file.text.replace('data-canvas-object-id="headline"', ""),
    }));
    const result = validateCanvasExportBundle(bundle);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "warning",
        code: "MissingRenderObject",
        objectId: "headline",
      }),
    );
  });

  it("reports missing handoff.toml", () => {
    const result = validateCanvasExportBundle(withoutFile(createBundle(), "handoff.toml"));

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "MissingHandoff", path: "handoff.toml" }),
    );
  });

  it("reports invalid selected object references in handoff.toml", () => {
    const bundle = replaceFile(createBundle(), "handoff.toml", (file) => ({
      ...file,
      text: file.text.replace('object_id = "headline"', 'object_id = "ghost"'),
    }));
    const result = validateCanvasExportBundle(bundle);

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "InvalidHandoffReference",
        objectId: "ghost",
        path: "handoff.toml",
      }),
    );
  });

  it("reports missing command recipes when commands are expected", () => {
    const result = validateCanvasExportBundle(createBundle(), { expectedCommands: true });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "MissingCommandRecipe",
        path: "commands/session-commands.toml",
      }),
    );
  });

  it("formats an ok report", () => {
    expect(formatCanvasExportValidationReport({ ok: true, diagnostics: [] })).toBe(
      "Canvas export validation: ok\nDiagnostics: 0",
    );
  });

  it("formats a diagnostic report", () => {
    const report = formatCanvasExportValidationReport({
      ok: false,
      diagnostics: [
        {
          severity: "error",
          code: "MissingObjectAsset",
          path: "objects/logo.toml",
          objectId: "logo",
          message: "Object logo references missing asset objects/logo.toml.",
        },
        {
          severity: "warning",
          code: "MissingRenderObject",
          objectId: "product-highlight",
          message: "render.svg does not contain data-canvas-object-id for product-highlight.",
        },
      ],
    });

    expect(report).toContain("Canvas export validation: failed");
    expect(report).toContain("Diagnostics: 2");
    expect(report).toContain("1. error MissingObjectAsset");
    expect(report).toContain("   path: objects/logo.toml");
    expect(report).toContain("   object: logo");
    expect(report).toContain("2. warning MissingRenderObject");
  });

  it("does not mutate the bundle", () => {
    const bundle = createBundle();
    const before = JSON.stringify(bundle);

    validateCanvasExportBundle(bundle);

    expect(JSON.stringify(bundle)).toBe(before);
  });
});
