import { describe, expect, it } from "vitest";
import {
  createArcFromCenterRadius,
  createArcFromCenterStartEnd,
  createArcFromThreePoints,
  createArcPathObject,
  createTangentArcBetweenLines,
  createTangentArcBetweenReferences,
  findArcCentersFromChordRadius,
  sampleArcResult,
  type Point2,
} from "../../apps/machina-canvas/src/arcGeometry";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import { createCanvasUnitSystem } from "../../apps/machina-canvas/src/canvasUnits";
import type { CanvasDocument } from "../../apps/machina-canvas/src/sceneModel";
import {
  createMechanicalExercise354BlockoutProcessNotes,
  createMechanicalExercise354BlockoutScene,
} from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354-blockout";
import {
  createMechanicalExercise354DogfoodReport,
  createMechanicalExercise354Scene,
} from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354";

function expectPointClose(actual: Point2 | undefined, expected: Point2) {
  expect(actual).toBeDefined();
  expect(actual?.[0]).toBeCloseTo(expected[0], 4);
  expect(actual?.[1]).toBeCloseTo(expected[1], 4);
}

describe("MachinaCanvas arc geometry helpers", () => {
  it("creates arc from three non-collinear points", () => {
    const arc = createArcFromThreePoints({
      start: [1, 0],
      through: [Math.SQRT1_2, Math.SQRT1_2],
      end: [0, 1],
    });

    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expectPointClose(arc.center, [0, 0]);
    expect(arc.radius).toBeCloseTo(1, 4);
  });

  it("rejects collinear points", () => {
    expect(
      createArcFromThreePoints({
        start: [0, 0],
        through: [1, 0],
        end: [2, 0],
      }),
    ).toMatchObject({
      kind: "err",
      error: "ArcPointsCollinear",
    });
  });

  it("returns center and radius for three-point arcs", () => {
    const arc = createArcFromThreePoints({
      start: [0, -1],
      through: [1, 0],
      end: [0, 1],
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expectPointClose(arc.center, [0, 0]);
    expect(arc.radius).toBeCloseTo(1, 4);
  });

  it("returned path uses SVG arc command", () => {
    const arc = createArcFromThreePoints({
      start: [1, 0],
      through: [0, 1],
      end: [-1, 0],
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expect(arc.path).toContain(" A ");
  });

  it("sweep passes through the through point", () => {
    const arc = createArcFromThreePoints({
      start: [1, 0],
      through: [0, 1],
      end: [-1, 0],
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expect(arc.sweep).toBe("clockwise");
    expectPointClose(sampleArcResult(arc, 0.5), [0, 1]);
  });

  it("creates arc from center, radius, and angles", () => {
    const arc = createArcFromCenterRadius({
      center: [10, 10],
      radius: 5,
      startAngleDeg: 0,
      endAngleDeg: 90,
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expectPointClose(arc.start, [15, 10]);
    expectPointClose(arc.end, [10, 15]);
    expect(arc.path).toContain("A 5 5");
  });

  it("rejects invalid radius", () => {
    expect(
      createArcFromCenterRadius({
        center: [0, 0],
        radius: 0,
        startAngleDeg: 0,
        endAngleDeg: 90,
      }),
    ).toMatchObject({
      kind: "err",
      error: "InvalidArcRadius",
    });
  });

  it("handles clockwise arcs", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 90,
      endAngleDeg: -90,
      sweep: "clockwise",
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expect(arc.sweep).toBe("clockwise");
    expect(arc.path).toContain(" 0 0 1 ");
  });

  it("handles counterclockwise arcs", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: -90,
      endAngleDeg: 90,
      sweep: "counterclockwise",
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expect(arc.sweep).toBe("counterclockwise");
    expect(arc.path).toContain(" 0 0 0 ");
  });

  it("handles large-arc flag", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: 270,
      sweep: "clockwise",
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expect(arc.largeArcFlag).toBe(1);
    expect(arc.path).toContain(" 0 1 1 ");
  });

  it("chord/radius returns two centers", () => {
    const result = findArcCentersFromChordRadius({
      start: [0, 0],
      end: [4, 0],
      radius: 3,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.centers).toHaveLength(2);
    expect(result.centers?.[0][1]).not.toBe(result.centers?.[1][1]);
  });

  it("radius too small returns error", () => {
    expect(
      findArcCentersFromChordRadius({
        start: [0, 0],
        end: [10, 0],
        radius: 4,
      }),
    ).toMatchObject({
      kind: "err",
      error: "ArcRadiusTooSmallForChord",
    });
  });

  it("ordering is deterministic", () => {
    const result = findArcCentersFromChordRadius({
      start: [0, 0],
      end: [4, 0],
      radius: 3,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.centers?.[0][1]).toBeLessThan(result.centers?.[1][1] ?? Number.POSITIVE_INFINITY);
  });

  it("line-line tangent arc works if implemented", () => {
    const arc = createTangentArcBetweenLines({
      startReference: { kind: "line", from: [0, 0], to: [10, 0] },
      endReference: { kind: "line", from: [10, 0], to: [10, 10] },
      radius: 2,
      preferredCenter: [8, 2],
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    expectPointClose(arc.center, [8, 2]);
    expectPointClose(arc.start, [8, 0]);
    expectPointClose(arc.end, [10, 2]);
  });

  it("tangent helper does not mutate input references", () => {
    const startReference = { kind: "line" as const, from: [0, 0] as Point2, to: [10, 0] as Point2 };
    const endReference = { kind: "line" as const, from: [10, 0] as Point2, to: [10, 10] as Point2 };
    const before = JSON.stringify({ startReference, endReference });
    createTangentArcBetweenReferences({
      startReference,
      endReference,
      radius: 2,
      preferredCenter: [8, 2],
    });
    expect(JSON.stringify({ startReference, endReference })).toBe(before);
  });

  it("multiple solutions use preferredCenter or deterministic choice", () => {
    const preferred = createTangentArcBetweenReferences({
      startReference: { kind: "line", from: [0, 0], to: [10, 0] },
      endReference: { kind: "line", from: [10, 0], to: [10, 10] },
      radius: 2,
      preferredCenter: [12, -2],
    });
    const deterministic = createTangentArcBetweenReferences({
      startReference: { kind: "line", from: [0, 0], to: [10, 0] },
      endReference: { kind: "line", from: [10, 0], to: [10, 10] },
      radius: 2,
    });
    expect(preferred.kind).toBe("ok");
    expect(deterministic.kind).toBe("ok");
    if (preferred.kind !== "ok" || deterministic.kind !== "ok") return;
    expectPointClose(preferred.center, [12, -2]);
    expectPointClose(deterministic.center, [8, -2]);
  });

  it("no-solution case returns error", () => {
    expect(
      createTangentArcBetweenLines({
        startReference: { kind: "line", from: [0, 0], to: [10, 0] },
        endReference: { kind: "line", from: [0, 5], to: [10, 5] },
        radius: 2,
      }),
    ).toMatchObject({
      kind: "err",
      error: "NoTangentArcSolution",
    });
  });

  it("unsupported tangent case returns explicit error if deferred", () => {
    expect(
      createTangentArcBetweenReferences({
        startReference: { kind: "circle", center: [0, 0], radius: 10 },
        endReference: { kind: "line", from: [0, 0], to: [10, 0] },
        radius: 2,
      }),
    ).toMatchObject({
      kind: "err",
      error: "UnsupportedTangentReferenceCombination",
    });
  });

  it("arc helper can create existing path scene object", () => {
    const arc = createArcFromCenterStartEnd({
      center: [0, 0],
      start: [10, 0],
      end: [0, 10],
      sweep: "counterclockwise",
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    const object = createArcPathObject({
      id: "test-arc",
      name: "Test arc",
      arc,
    });
    expect(object.kind).toBe("path");
    expect(object.d).toContain(" A ");
  });

  it("SVG export includes arc path command", () => {
    const arc = createArcFromCenterRadius({
      center: [20, 20],
      radius: 10,
      startAngleDeg: 180,
      endAngleDeg: 270,
      sweep: "counterclockwise",
    });
    expect(arc.kind).toBe("ok");
    if (arc.kind !== "ok") return;
    const object = createArcPathObject({
      id: "export-arc",
      arc,
      stroke: "#000000",
    });
    const document: CanvasDocument = {
      id: "arc-export",
      name: "Arc export",
      width: 100,
      height: 100,
      unit: "px",
      unitSystem: createCanvasUnitSystem("px"),
      layers: [{ id: "geometry", name: "Geometry", visible: true, objectIds: [object.id] }],
      objects: { [object.id]: object },
    };
    const svg = serializeCanvasRenderSvg(document);
    expect(svg).toContain('data-canvas-object-id="export-arc"');
    expect(svg).toContain(" A ");
  });

  it("Exercise 354 generator uses arc helpers or includes helper-generated arc labels/report", () => {
    const scene = createMechanicalExercise354Scene();
    const report = createMechanicalExercise354DogfoodReport();
    const outerProfile = scene.objects["exercise-354-outer-profile"];
    expect(outerProfile.kind).toBe("path");
    if (outerProfile.kind !== "path") return;
    expect(outerProfile.d).toContain(" A ");
    expect(report).toContain("reusable local arc helpers");
  });

  it("existing guide/blockout/mechanical tests still pass through helper-backed output", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const notes = createMechanicalExercise354BlockoutProcessNotes();
    const body = scene.objects["exercise-354-blockout-filled-body-profile"];
    const lowerCue = scene.objects["exercise-354-global-lower-arc-cue"];
    expect(body.kind).toBe("path");
    expect(lowerCue.kind).toBe("path");
    if (body.kind !== "path" || lowerCue.kind !== "path") return;
    expect(body.d).toContain(" A ");
    expect(lowerCue.d).toContain(" A ");
    expect(notes).toContain("reusable local arc helpers");
  });
});
