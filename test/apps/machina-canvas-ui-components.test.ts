import { describe, expect, it } from "vitest";
import {
  createCanvasExportBundle,
  serializeCanvasDocumentJson,
  serializeCanvasObjectToml,
  serializeCanvasRenderSvg,
} from "../../apps/machina-canvas/src/canvasExport";
import { initialSceneDocument } from "../../apps/machina-canvas/src/sceneDocument";
import {
  applyCanvasCommands,
  validateCanvasCommands,
} from "../../apps/machina-canvas/src/sceneCommands";
import { lowerCanvasDocumentToTsx } from "../../apps/machina-canvas/src/tsxExport";
import {
  defineCanvasUiComponentCatalog,
  getCanvasUiComponentDefinition,
  listCanvasUiComponents,
} from "../../apps/machina-canvas/src/uiComponents/catalog";

describe("MachinaCanvas UI component objects", () => {
  it("lists the built-in UI component catalog", () => {
    expect(listCanvasUiComponents().map((component) => component.id)).toEqual([
      "Button",
      "Card",
      "Input",
      "Badge",
    ]);
  });

  it("rejects duplicate component ids and unknown lookups", () => {
    const button = getCanvasUiComponentDefinition("Button");
    expect(() => defineCanvasUiComponentCatalog([button, button])).toThrow(
      'Duplicate UI component id "Button".',
    );
    expect(() => getCanvasUiComponentDefinition("Missing")).toThrow(
      'Unknown UI component "Missing".',
    );
  });

  it("includes a UI COMPONENTS layer in the demo document", () => {
    expect(initialSceneDocument.layers.some((layer) => layer.name === "UI COMPONENTS")).toBe(true);
    expect(
      Object.values(initialSceneDocument.objects).some((object) => object.kind === "uiComponent"),
    ).toBe(true);
  });

  it("validates and applies setUiProp immutably", () => {
    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "setUiProp",
        id: "missing",
        prop: "children",
        value: "Go",
      }).ok,
    ).toBe(false);
    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "setUiProp",
        id: "headline",
        prop: "children",
        value: "Go",
      }).diagnostics[0]?.code,
    ).toBe("InvalidObjectKind");
    expect(
      validateCanvasCommands(initialSceneDocument, {
        kind: "setUiProp",
        id: "ui-primary-cta",
        prop: "variant",
        value: "danger",
      }).diagnostics[0]?.code,
    ).toBe("InvalidUiPropValue");

    const result = applyCanvasCommands(initialSceneDocument, [
      {
        kind: "setUiProp",
        id: "ui-primary-cta",
        prop: "children",
        value: "Ship page",
      },
    ]);

    expect(initialSceneDocument.objects["ui-primary-cta"]).not.toBe(
      result.document.objects["ui-primary-cta"],
    );
    const nextObject = result.document.objects["ui-primary-cta"];
    expect(nextObject.kind).toBe("uiComponent");
    if (nextObject.kind === "uiComponent") {
      expect(nextObject.props.children).toBe("Ship page");
    }
  });

  it("exports UI component TOML, document JSON, and render SVG", () => {
    const object = initialSceneDocument.objects["ui-primary-cta"];
    expect(object.kind).toBe("uiComponent");
    const toml = serializeCanvasObjectToml(object);
    expect(toml).toContain('[component]\nid = "Button"');
    expect(toml).toContain("[props]");
    expect(toml).toContain('children = "Generate page"');

    const documentJson = serializeCanvasDocumentJson(initialSceneDocument);
    expect(documentJson).toContain('"kind": "uiComponent"');

    const svg = serializeCanvasRenderSvg(initialSceneDocument);
    expect(svg).toContain('data-canvas-object-id="ui-primary-cta"');
  });

  it("lowers the document to a safe MachinaLayout TSX page shell", () => {
    const result = lowerCanvasDocumentToTsx(initialSceneDocument);
    expect(result.path).toBe("generated-page.tsx");
    expect(result.text).toContain("MachinaReactView");
    expect(result.text).toContain('from "machinalayout/react"');
    expect(result.text).toContain('from "machinalayout/machina"');
    expect(result.text).toContain("generated-button");
    expect(result.text).toContain("generated-card");
    expect(result.text).toContain("generated-field");
    expect(result.text).toContain("generated-badge");
    expect(result.text).not.toContain("useEffect");
    expect(result.text).not.toContain("onClick");
    expect(result.text).not.toContain("fetch(");
  });

  it("adds generated-page.tsx and TSX metadata to export bundles", () => {
    const bundle = createCanvasExportBundle(initialSceneDocument, { tsxOptions: {} });
    expect(bundle.files.some((file) => file.path === "generated-page.tsx")).toBe(true);
    const handoff = bundle.files.find((file) => file.path === "handoff.toml")?.text ?? "";
    expect(handoff).toContain('tsx = "generated-page.tsx"');
    expect(handoff).toContain("[lowering.react]");
    expect(handoff).toContain("lossy = true");
  });
});
