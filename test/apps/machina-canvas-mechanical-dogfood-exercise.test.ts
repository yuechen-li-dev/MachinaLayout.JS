import { describe, expect, it } from "vitest";
import { serializeCanvasRenderSvg } from "../../apps/machina-canvas/src/canvasExport";
import {
  createMechanicalExercise354DogfoodReport,
  createMechanicalExercise354Scene,
  MECHANICAL_EXERCISE_354_ARTIFACT_PATHS,
} from "../../apps/machina-canvas/scripts/create-mechanical-exercise-354";

const requiredReportSections = [
  "## Source",
  "## Generated artifacts",
  "## What worked",
  "## What was approximated",
  "## Friction found",
  "## Fixes made in M39d",
  "## Fixes made in M39e",
  "## Fixes made in M39f",
  "## Deferred gaps",
  "## Verification",
] as const;

function getExerciseSidecar() {
  const scene = createMechanicalExercise354Scene();
  const sidecar = scene.objects["exercise-354-mechanical-annotations"];
  if (sidecar.kind !== "mechanicalAnnotationSidecar") {
    throw new Error("Expected Exercise 354 mechanical annotation sidecar.");
  }
  return { scene, sidecar };
}

describe("MachinaCanvas mechanical dogfood Exercise 354", () => {
  it("creates an A4 landscape scene with existing scene geometry objects", () => {
    const { scene } = getExerciseSidecar();
    expect(scene.id).toBe("mechanical-exercise-354");
    expect(scene.width).toBe(297);
    expect(scene.height).toBe(210);
    expect(scene.unit).toBe("mm");

    const geometryKinds = Object.values(scene.objects)
      .filter((object) => object.layerId === "geometry")
      .map((object) => object.kind);
    expect(geometryKinds).toEqual(expect.arrayContaining(["path", "ellipse"]));
    expect(geometryKinds).not.toContain("cadKernel");
    expect(geometryKinds).not.toContain("constraintSketch");
  });

  it("authors the part topology as a filled body profile with semantic void outlines", () => {
    const { scene } = getExerciseSidecar();
    const bodyProfile = scene.objects["exercise-354-filled-body-profile"];
    expect(bodyProfile.kind).toBe("path");
    if (bodyProfile.kind !== "path") return;

    expect(bodyProfile.tags).toEqual(expect.arrayContaining(["mechanical-body-profile"]));
    expect(bodyProfile.fill).toBe("#68bfe9");
    expect(bodyProfile.fillRule).toBe("evenodd");
    expect(bodyProfile.stroke).toBe("none");

    const voidObjects = Object.values(scene.objects).filter((object) =>
      object.tags?.includes("mechanical-void"),
    );
    expect(voidObjects.map((object) => object.id)).toEqual(
      expect.arrayContaining([
        "exercise-354-inner-hole",
        "exercise-354-rounded-slot",
        "exercise-354-lower-hole",
        "exercise-354-upper-hole",
      ]),
    );
  });

  it("keeps the rounded slot inside solid material instead of collapsing to a zero wall", () => {
    const { scene } = getExerciseSidecar();
    const bodyProfile = scene.objects["exercise-354-filled-body-profile"];
    const slot = scene.objects["exercise-354-rounded-slot"];
    expect(bodyProfile.kind).toBe("path");
    expect(slot.kind).toBe("path");
    if (bodyProfile.kind !== "path" || slot.kind !== "path") return;

    expect(bodyProfile.d).toContain("L 204 98");
    expect(bodyProfile.d).toContain("L 126 58");
    expect(slot.d).toContain("M 159 68");
    expect(slot.d).toContain("L 202 68");
    expect(slot.d).toContain("L 159 88");
    expect(slot.d).not.toContain("M 159 58");
    expect(slot.d).not.toContain("L 159 98");
  });

  it("contains a mechanical sidecar with radius, angular, linear, and aligned dimensions", () => {
    const { sidecar } = getExerciseSidecar();
    expect(sidecar.annotations.sheet).toMatchObject({
      size: "A4",
      orientation: "landscape",
      units: "mm",
      title: "2D Exercise 354",
      drawingNumber: "M39D-354",
      revision: "A",
    });
    expect(sidecar.annotations.dimensions.some((dimension) => dimension.kind === "radius")).toBe(
      true,
    );
    expect(sidecar.annotations.dimensions.some((dimension) => dimension.kind === "angle")).toBe(
      true,
    );
    expect(sidecar.annotations.dimensions.some((dimension) => dimension.kind === "linear")).toBe(
      true,
    );
    expect(sidecar.annotations.dimensions.some((dimension) => dimension.kind === "aligned")).toBe(
      true,
    );
    expect(
      sidecar.annotations.dimensions.some(
        (dimension) => dimension.kind === "radius" && dimension.leaderAngle !== undefined,
      ),
    ).toBe(true);
    expect(
      sidecar.annotations.dimensions.some(
        (dimension) => dimension.kind === "angle" && dimension.radius !== undefined,
      ),
    ).toBe(true);
  });

  it("uses dashed path geometry for centerlines and construction lines", () => {
    const { scene } = getExerciseSidecar();
    const centerlines = Object.values(scene.objects).filter(
      (object) => object.kind === "path" && object.tags?.includes("centerline"),
    );
    expect(centerlines.length).toBeGreaterThanOrEqual(4);
    expect(
      centerlines.every((object) => object.kind === "path" && object.strokeDasharray === "8 4 2 4"),
    ).toBe(true);
  });

  it("exports an A4 SVG with part geometry, title block, and key dimension labels", () => {
    const svg = serializeCanvasRenderSvg(createMechanicalExercise354Scene());
    expect(svg).toContain('viewBox="0 0 297 210"');
    expect(svg).toContain('width="297mm"');
    expect(svg).toContain("canvas-mechanical-sheet-boundary");
    expect(svg).toContain('data-canvas-object-id="exercise-354-filled-body-profile"');
    expect(svg).toContain('fill="#68bfe9"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-outer-profile"');
    expect(svg).toContain('data-canvas-object-id="exercise-354-rounded-slot"');
    expect(svg).toContain('data-canvas-mechanical-id="exercise-354-title-block"');
    for (const label of ["100", "30", "R20", "R32", "35°"]) {
      expect(svg).toContain(label);
    }
    expect(svg).toContain('stroke-dasharray="8 4 2 4"');
    expect(svg).toContain('marker-end="url(#canvas-mechanical-arrow)"');
    expect(svg).toContain("canvas-mechanical-label-backplate");
  });

  it("dogfood report includes required sections, friction, and deferred PDF scope", () => {
    const report = createMechanicalExercise354DogfoodReport();
    for (const section of requiredReportSections) {
      expect(report).toContain(section);
    }
    expect(report).toContain("centerlines");
    expect(report).toContain("radius callouts");
    expect(report).toContain("angular dimension");
    expect(report).toContain("rounded slot");
    expect(report).toContain("A4 fitting");
    expect(report).toContain("title block");
    expect(report).toContain("PDF was intentionally deferred");
    expect(report).toContain("automatic image-to-CAD conversion");
    expect(report).toContain("M39e");
    expect(report).toContain("M39f");
    expect(report).toContain("filled profile");
    expect(report).toContain("topology-first");
    expect(report).toContain("void");
    expect(report).toContain("preview PNG");
    expect(report).toContain("Inkscape");
  });

  it("declares a preview PNG artifact path for milestone review", () => {
    expect(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.preview).toMatch(
      /mechanical-exercise-354\.preview\.png$/,
    );
  });

  it("does not introduce unsupported page-size or plotter scope", () => {
    const { scene, sidecar } = getExerciseSidecar();
    expect(sidecar.annotations.sheet?.size).toBe("A4");
    expect(sidecar.annotations.sheet?.orientation).toBe("landscape");
    expect(JSON.stringify(scene)).not.toMatch(/plotter|pageProfile|Custom/);
  });
});
