import { describe, expect, it } from "vitest";
import {
  DRAFTING_COORDINATES,
  IMAGE_COORDINATES,
  SCREEN_COORDINATES,
  authoringPointToRenderPoint,
  getCoordinateProfile,
  renderPointToAuthoringPoint,
  visualDirectionDelta,
} from "../../apps/machina-canvas/src/coordinateProfiles";
import { executeCanvasTerminalCommand } from "../../apps/machina-canvas/src/canvasCommandsTerminal";
import { applyCanvasCommands } from "../../apps/machina-canvas/src/sceneCommands";
import type { CanvasDocument, SpriteSidecarObject } from "../../apps/machina-canvas/src/sceneModel";
import {
  createMechanicalDraftingScene,
  createSpriteSheetScene,
} from "../../apps/machina-canvas/src/sceneTemplates";
import {
  createArcFromCenterRadius,
  createArcFromThreePoints,
} from "../../apps/machina-canvas/src/arcGeometry";

function getSpriteSidecar(document: CanvasDocument): SpriteSidecarObject {
  const sidecar = Object.values(document.objects).find(
    (object): object is SpriteSidecarObject => object.kind === "spriteSidecar",
  );
  if (!sidecar) throw new Error("Expected sprite sidecar.");
  return sidecar;
}

function selectFirstSpriteFrame(document: CanvasDocument): CanvasDocument {
  const sidecar = getSpriteSidecar(document);
  return applyCanvasCommands(document, [
    { kind: "select", id: sidecar.id },
    { kind: "selectSpriteFrame", sidecarId: sidecar.id, frameId: sidecar.spec.frames[0].id },
  ]).document;
}

function getSelectedFrameY(document: CanvasDocument): number {
  const sidecar = getSpriteSidecar(document);
  const frame = sidecar.spec.frames.find(
    (candidate) => candidate.id === sidecar.spec.selectedFrameId,
  );
  if (!frame) throw new Error("Expected selected sprite frame.");
  return frame.y;
}

describe("MachinaCanvas coordinate profiles", () => {
  it("defines screen coordinates as y-down from top-left", () => {
    expect(SCREEN_COORDINATES).toMatchObject({ id: "screen", yAxis: "down", origin: "topLeft" });
  });

  it("defines image coordinates as y-down from image top-left", () => {
    expect(IMAGE_COORDINATES).toMatchObject({ id: "image", yAxis: "down", origin: "imageTopLeft" });
  });

  it("defines drafting coordinates as y-up from bottom-left", () => {
    expect(DRAFTING_COORDINATES).toMatchObject({
      id: "drafting",
      yAxis: "up",
      origin: "bottomLeft",
    });
  });

  it("flips y when converting drafting authoring points to render points", () => {
    expect(
      authoringPointToRenderPoint({
        point: [12, 30],
        profile: DRAFTING_COORDINATES,
        viewportHeight: 100,
      }),
    ).toEqual([12, 70]);
  });

  it("flips y when converting drafting render points to authoring points", () => {
    expect(
      renderPointToAuthoringPoint({
        point: [12, 70],
        profile: DRAFTING_COORDINATES,
        viewportHeight: 100,
      }),
    ).toEqual([12, 30]);
  });

  it("does not flip screen coordinates", () => {
    expect(
      authoringPointToRenderPoint({
        point: [12, 30],
        profile: SCREEN_COORDINATES,
        viewportHeight: 100,
      }),
    ).toEqual([12, 30]);
    expect(
      renderPointToAuthoringPoint({
        point: [12, 30],
        profile: SCREEN_COORDINATES,
        viewportHeight: 100,
      }),
    ).toEqual([12, 30]);
  });

  it("returns a visually upward delta for y-down profiles", () => {
    expect(
      visualDirectionDelta({ direction: "up", amount: 4, profile: IMAGE_COORDINATES }),
    ).toEqual([0, -4]);
  });

  it("returns a visually upward authoring-space delta for y-up profiles", () => {
    expect(
      visualDirectionDelta({ direction: "up", amount: 4, profile: DRAFTING_COORDINATES }),
    ).toEqual([0, 4]);
  });

  it("uses drafting coordinates for mechanical mode scenes", () => {
    expect(getCoordinateProfile(createMechanicalDraftingScene().coordinateProfileId)).toBe(
      DRAFTING_COORDINATES,
    );
  });

  it("uses image coordinates for sprite mode scenes", () => {
    expect(getCoordinateProfile(createSpriteSheetScene().coordinateProfileId)).toBe(
      IMAGE_COORDINATES,
    );
  });

  it("sprite nudge up moves y negatively in image coordinates", () => {
    const document = selectFirstSpriteFrame(createSpriteSheetScene());
    const sidecar = getSpriteSidecar(document);
    const frame = sidecar.spec.frames[0];
    const [dx, dy] = visualDirectionDelta({
      direction: "up",
      amount: 1,
      profile: getCoordinateProfile(document.coordinateProfileId),
    });
    const next = applyCanvasCommands(document, [
      { kind: "nudgeSpriteFrame", sidecarId: sidecar.id, frameId: frame.id, dx, dy },
    ]).document;

    expect(getSelectedFrameY(next)).toBe(frame.y - 1);
  });

  it("sprite nudge down moves y positively in image coordinates", () => {
    const document = selectFirstSpriteFrame(createSpriteSheetScene());
    const sidecar = getSpriteSidecar(document);
    const frame = sidecar.spec.frames[0];
    const [dx, dy] = visualDirectionDelta({
      direction: "down",
      amount: 1,
      profile: getCoordinateProfile(document.coordinateProfileId),
    });
    const next = applyCanvasCommands(document, [
      { kind: "nudgeSpriteFrame", sidecarId: sidecar.id, frameId: frame.id, dx, dy },
    ]).document;

    expect(getSelectedFrameY(next)).toBe(frame.y + 1);
  });

  it("terminal nudge-frame up uses visual direction semantics", () => {
    const document = selectFirstSpriteFrame(createSpriteSheetScene());
    const before = getSelectedFrameY(document);
    const result = executeCanvasTerminalCommand("nudge-frame up 1", { document });
    const next = result.commands
      ? applyCanvasCommands(document, result.commands).document
      : document;

    expect(result.logEntry?.kind).toBe("success");
    expect(getSelectedFrameY(next)).toBe(before - 1);
  });

  it("arc helpers remain render-space helpers while drafting callers can transform points first", () => {
    const draftingStart = [10, 90] as const;
    const draftingThrough = [20, 80] as const;
    const draftingEnd = [30, 90] as const;
    const renderArc = createArcFromThreePoints({
      start: authoringPointToRenderPoint({
        point: draftingStart,
        profile: DRAFTING_COORDINATES,
        viewportHeight: 100,
      }),
      through: authoringPointToRenderPoint({
        point: draftingThrough,
        profile: DRAFTING_COORDINATES,
        viewportHeight: 100,
      }),
      end: authoringPointToRenderPoint({
        point: draftingEnd,
        profile: DRAFTING_COORDINATES,
        viewportHeight: 100,
      }),
    });
    const nativeRenderArc = createArcFromCenterRadius({
      center: [20, 20],
      radius: 10,
      startAngleDeg: 180,
      endAngleDeg: 0,
      sweep: "counterclockwise",
    });

    expect(renderArc.kind).toBe("ok");
    expect(nativeRenderArc.kind).toBe("ok");
  });
});
