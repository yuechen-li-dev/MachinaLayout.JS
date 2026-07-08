import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createGuideOverlayFixtureArtifacts,
  createGuideOverlayFixtureDocument,
  GUIDE_OVERLAY_FIXTURE_IDS,
  GUIDE_OVERLAY_FIXTURE_PATHS,
  GUIDE_OVERLAY_FIXTURE_TOML,
} from "../../apps/machina-canvas/scripts/create-guide-overlay-fixture";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import { parseGuideSidecarToml } from "../../apps/machina-canvas/src/guideSidecar";
import { buildCanvasLayerTree } from "../../apps/machina-canvas/src/layerTree";
import { applyCanvasCommand } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";

function fixtureGuide(document: CanvasDocument) {
  const object = document.objects[GUIDE_OVERLAY_FIXTURE_IDS.guideId];
  if (object.kind !== "guideSidecar") {
    throw new Error("Expected guide overlay fixture sidecar.");
  }
  return object;
}

describe("MachinaCanvas M40d guide overlay verification", () => {
  it("parses the guide overlay fixture TOML with required reviewable features", () => {
    const guide = parseGuideSidecarToml(GUIDE_OVERLAY_FIXTURE_TOML);

    expect(guide.regions.length).toBeGreaterThanOrEqual(1);
    expect(guide.datums.map((datum) => datum.kind)).toEqual(
      expect.arrayContaining(["horizontal", "vertical", "point"]),
    );
    expect(guide.dimensions.length).toBeGreaterThanOrEqual(1);
    expect(guide.alignmentMarks.length).toBeGreaterThanOrEqual(1);
  });

  it("attaches the guide sidecar to the reference image and preserves the attachment in scene JSON", () => {
    const document = createGuideOverlayFixtureDocument();
    const guide = fixtureGuide(document);
    const serialized = JSON.stringify(document);

    expect(guide.targetId).toBe(GUIDE_OVERLAY_FIXTURE_IDS.imageId);
    expect(guide.guide.target).toBe(GUIDE_OVERLAY_FIXTURE_IDS.imageId);
    expect(serialized).toContain(`"targetId":"${GUIDE_OVERLAY_FIXTURE_IDS.imageId}"`);
  });

  it("nests the guide under the owner image in the layer tree with construction mask summary", () => {
    const tree = buildCanvasLayerTree(createGuideOverlayFixtureDocument());
    const group = tree.find((item) => item.id === `group:${GUIDE_OVERLAY_FIXTURE_IDS.layerId}`);
    const image = group?.children?.find(
      (item) => item.objectId === GUIDE_OVERLAY_FIXTURE_IDS.imageId,
    );
    const guide = image?.children?.find(
      (item) => item.objectId === GUIDE_OVERLAY_FIXTURE_IDS.guideId,
    );

    expect(guide?.relation).toBe("guideSidecar");
    expect(guide?.subtitle).toContain("Construction mask");
    expect(guide?.subtitle).toContain("1 dimensions");
    expect(guide?.subtitle).toContain("1 marks");
  });

  it("renders visible guides and hides invisible guides", () => {
    const document = createGuideOverlayFixtureDocument();
    const visibleSvg = serializeCanvasRenderSvg(document);
    const hidden = applyCanvasCommand(document, {
      kind: "setGuideSidecarVisible",
      guideId: GUIDE_OVERLAY_FIXTURE_IDS.guideId,
      visible: false,
    }).document;
    const hiddenSvg = serializeCanvasRenderSvg(hidden);

    expect(visibleSvg).toContain("canvas-guide-overlay");
    expect(hiddenSvg).not.toContain("canvas-guide-overlay");
  });

  it("applies guide opacity to exported markup", () => {
    const document = createGuideOverlayFixtureDocument();
    const guide = fixtureGuide(document);
    const svg = serializeCanvasRenderSvg(document);

    expect(guide.opacity).toBe(0.82);
    expect(svg).toContain('opacity="0.82"');
  });

  it("exports visible region, datum, dimension, and alignment mark markup and labels", () => {
    const svg = serializeCanvasRenderSvg(createGuideOverlayFixtureDocument());

    expect(svg).toContain("canvas-guide-region");
    expect(svg).toContain("overall-bounds");
    expect(svg).toContain("canvas-guide-datum");
    expect(svg).toContain("Center X");
    expect(svg).toContain("Center Y");
    expect(svg).toContain("Origin point");
    expect(svg).toContain("canvas-guide-dimension");
    expect(svg).toContain("260 px");
    expect(svg).toContain("canvas-guide-mark");
    expect(svg).toContain("Origin");
    expect(svg).toContain("#e94d1a");
    expect(svg).toContain("#d9480f");
    expect(svg).toContain("#ff7a00");
  });

  it("maps guide coordinates relative to the owner image intrinsic coordinate system", () => {
    const svg = serializeCanvasRenderSvg(createGuideOverlayFixtureDocument());

    expect(svg).toContain('data-canvas-guide-region-id="overall-bounds" x="80" y="80"');
    expect(svg).toContain('width="520" height="320"');
    expect(svg).toContain('class="canvas-guide-datum" x1="340" y1="40" x2="340" y2="440"');
    expect(svg).toContain('class="canvas-guide-datum" x1="40" y1="240" x2="640" y2="240"');
    expect(svg).toContain('class="canvas-guide-dimension" x1="80" y1="80" x2="600" y2="80"');
  });

  it("writes fixture artifacts and report with counts, attachment, and export status", () => {
    createGuideOverlayFixtureArtifacts();

    const scene = readFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.scene, "utf8");
    const report = readFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.report, "utf8");
    const guideToml = readFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.guideToml, "utf8");
    const renderSvg = readFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.svg, "utf8");

    expect(guideToml).toContain("[[regions]]");
    expect(scene).toContain(`"id": "${GUIDE_OVERLAY_FIXTURE_IDS.guideId}"`);
    expect(scene).toContain(`"targetId": "${GUIDE_OVERLAY_FIXTURE_IDS.imageId}"`);
    expect(renderSvg).toContain("canvas-guide-overlay");
    expect(report).toContain(`Image id: \`${GUIDE_OVERLAY_FIXTURE_IDS.imageId}\``);
    expect(report).toContain(`Guide sidecar id: \`${GUIDE_OVERLAY_FIXTURE_IDS.guideId}\``);
    expect(report).toContain("Regions: 1");
    expect(report).toContain("Datums: 3");
    expect(report).toContain("Dimensions: 1");
    expect(report).toContain("Alignment marks: 1");
    expect(report).toContain("Export included guide overlay: yes");
  });
});
