import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createArcFromCenterRadius,
  createArcFromCenterStartEnd,
  createArcFromThreePoints,
  createTangentArcBetweenReferences,
  sampleArcResult,
  type ArcPathResult,
  type Point2,
} from "../../apps/machina-canvas/src/arcGeometry";
import { createMechanicalExercise354BlockoutScene } from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354-blockout";
import { createMechanicalExercise354Scene } from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354";

function expectOk(arc: ArcPathResult): asserts arc is ArcPathResult & { kind: "ok" } {
  expect(arc.kind).toBe("ok");
}

function expectPointClose(actual: Point2 | undefined, expected: Point2, precision = 4) {
  expect(actual).toBeDefined();
  expect(actual?.[0]).toBeCloseTo(expected[0], precision);
  expect(actual?.[1]).toBeCloseTo(expected[1], precision);
}

function expectArcMidpoint(arc: ArcPathResult, expected: Point2) {
  expectOk(arc);
  expectPointClose(sampleArcResult(arc, 0.5), expected);
}

function getPath(scene: ReturnType<typeof createMechanicalExercise354Scene>, id: string) {
  const object = scene.objects[id];
  expect(object.kind).toBe("path");
  if (object.kind !== "path") throw new Error(`${id} is not a path.`);
  return object.d;
}

describe("MachinaCanvas arc orientation regression", () => {
  it("documents SVG/canvas y-down arc conventions in the helper source", () => {
    const source = readFileSync("apps/machina-canvas/src/arcGeometry.ts", "utf8");
    expect(source).toContain("SVG/canvas coordinates");
    expect(source).toContain("+y points down");
    expect(source).toContain("ArcSweep values describe visual");
  });

  it("clockwise means visually clockwise in y-down coordinates", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: 90,
      sweep: "clockwise",
    });
    expectArcMidpoint(arc, [Math.SQRT1_2 * 10, Math.SQRT1_2 * 10]);
    expect(arc.path).toContain(" 0 0 1 ");
  });

  it("counterclockwise means visually counterclockwise in y-down coordinates", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: -90,
      sweep: "counterclockwise",
    });
    expectArcMidpoint(arc, [Math.SQRT1_2 * 10, -Math.SQRT1_2 * 10]);
    expect(arc.path).toContain(" 0 0 0 ");
  });

  it("three-point arc through an upper point samples on the upper side", () => {
    const arc = createArcFromThreePoints({
      start: [-10, 0],
      through: [0, -10],
      end: [10, 0],
    });
    expectArcMidpoint(arc, [0, -10]);
    expect(sampleArcResult(arc, 0.5)?.[1]).toBeLessThan(0);
  });

  it("three-point arc through a lower point samples on the lower side", () => {
    const arc = createArcFromThreePoints({
      start: [-10, 0],
      through: [0, 10],
      end: [10, 0],
    });
    expectArcMidpoint(arc, [0, 10]);
    expect(sampleArcResult(arc, 0.5)?.[1]).toBeGreaterThan(0);
  });

  it("three-point arcs support left and right through points", () => {
    expectArcMidpoint(
      createArcFromThreePoints({ start: [0, -10], through: [-10, 0], end: [0, 10] }),
      [-10, 0],
    );
    expectArcMidpoint(
      createArcFromThreePoints({ start: [0, -10], through: [10, 0], end: [0, 10] }),
      [10, 0],
    );
  });

  it("near-collinear three-point arcs are rejected", () => {
    expect(
      createArcFromThreePoints({
        start: [0, 0],
        through: [1, 0.00000001],
        end: [2, 0],
      }),
    ).toMatchObject({ kind: "err", error: "ArcPointsCollinear" });
  });

  it("center/radius upper semicircle is upper", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 180,
      endAngleDeg: 0,
      sweep: "clockwise",
    });
    expectArcMidpoint(arc, [0, -10]);
  });

  it("center/radius lower semicircle is lower", () => {
    const arc = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: 180,
      sweep: "clockwise",
    });
    expectArcMidpoint(arc, [0, 10]);
  });

  it("center/start/end crossing 0 degrees stays on the short side", () => {
    const arc = createArcFromCenterStartEnd({
      center: [0, 0],
      start: [10 * Math.cos((-10 * Math.PI) / 180), 10 * Math.sin((-10 * Math.PI) / 180)],
      end: [10 * Math.cos((10 * Math.PI) / 180), 10 * Math.sin((10 * Math.PI) / 180)],
      sweep: "clockwise",
    });
    expectArcMidpoint(arc, [10, 0]);
    expect(arc.largeArcFlag).toBe(0);
  });

  it("large and exact 180 degree arcs set flags deterministically", () => {
    const large = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: 270,
      sweep: "clockwise",
    });
    const half = createArcFromCenterRadius({
      center: [0, 0],
      radius: 10,
      startAngleDeg: 0,
      endAngleDeg: 180,
      sweep: "clockwise",
    });
    expectOk(large);
    expectOk(half);
    expect(large.largeArcFlag).toBe(1);
    expect(half.largeArcFlag).toBe(0);
  });

  it("slot left and right caps bulge outward when requested", () => {
    const rightCap = createArcFromCenterRadius({
      center: [20, 10],
      radius: 10,
      startAngleDeg: -90,
      endAngleDeg: 90,
      sweep: "clockwise",
    });
    const leftCap = createArcFromCenterRadius({
      center: [0, 10],
      radius: 10,
      startAngleDeg: 90,
      endAngleDeg: 270,
      sweep: "clockwise",
    });
    expectOk(rightCap);
    expectOk(leftCap);
    expect(sampleArcResult(rightCap, 0.5)?.[0]).toBeGreaterThan(20);
    expect(sampleArcResult(leftCap, 0.5)?.[0]).toBeLessThan(0);
  });

  it("rounded rectangle obround caps keep their outward sides", () => {
    expectArcMidpoint(
      createArcFromCenterRadius({
        center: [30, 10],
        radius: 10,
        startAngleDeg: -90,
        endAngleDeg: 90,
        sweep: "clockwise",
      }),
      [40, 10],
    );
    expectArcMidpoint(
      createArcFromCenterRadius({
        center: [10, 10],
        radius: 10,
        startAngleDeg: 90,
        endAngleDeg: 270,
        sweep: "clockwise",
      }),
      [0, 10],
    );
  });

  it("Exercise 354 slot void path uses outward caps", () => {
    const slot = getPath(createMechanicalExercise354Scene(), "exercise-354-rounded-slot");
    expect(slot).toContain("A 10 10 0 0 1 202 88");
    expect(slot).toContain("A 10 10 0 0 1 159 68");
  });

  it("Exercise 354 right arm end arc does not invert inward", () => {
    const outer = getPath(createMechanicalExercise354Scene(), "exercise-354-outer-profile");
    expect(outer).toContain("A 20 20 0 0 0 204 58");
  });

  it("blockout lower arc cue renders on the intended lower side", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const cue = getPath(scene, "exercise-354-global-lower-arc-cue");
    const arc = createArcFromThreePoints({
      start: [75, 152],
      through: [118, 142],
      end: [151, 114],
    });
    expect(cue).toContain(" A ");
    expectOk(arc);
    const midpoint = sampleArcResult(arc, 0.5);
    expect(midpoint?.[1]).toBeGreaterThan(133);
  });

  it("blockout slot and right arm arcs use outward orientation", () => {
    const scene = createMechanicalExercise354BlockoutScene();
    const slot = getPath(scene, "exercise-354-blockout-rounded-slot");
    const outer = getPath(scene, "exercise-354-blockout-outer-profile");
    expect(slot).toContain("A 10 10 0 0 1 203 88");
    expect(slot).toContain("A 10 10 0 0 1 169 68");
    expect(outer).toContain("A 20 20 0 0 0 203 58");
  });

  it("unsupported tangent cases still return explicit errors", () => {
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
});
