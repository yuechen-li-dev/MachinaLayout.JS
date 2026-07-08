import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createArcFromCenterRadius, createArcFromThreePoints } from "../src/arcGeometry";
import { serializeCanvasRenderSvg } from "../src/canvasExport";
import { createCanvasUnitSystem } from "../src/canvasUnits";
import {
  createDefaultMechanicalSheetMetadata,
  createMechanicalAnnotationSet,
  createMechanicalAnnotationSidecarObject,
} from "../src/mechanicalAnnotations";
import { getMechanicalA4LandscapeLayout } from "../src/mechanicalSheet";
import type { CanvasDocument, CanvasObject } from "../src/sceneModel";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const artifactsDir = join(repoRoot, "apps", "machina-canvas", "artifacts");
const biomeBin = join(repoRoot, "node_modules", "@biomejs", "biome", "bin", "biome");
const inkscapeBin = "C:\\Program Files\\Inkscape\\bin\\inkscape.com";
const uploadedReferencePaths = [
  "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-13e1c2f2-8707-4284-b901-569443fbf15f.png",
  "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-06299214-52fe-4b72-9e11-698c8e6659a3.png",
  "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-2f27c841-8a61-41fd-aaa2-f5bb28241957.png",
] as const;

export const MECHANICAL_EXERCISE_354_ARTIFACT_PATHS = {
  reference: join(artifactsDir, "reference-mechanical-exercise-354.png"),
  scene: join(artifactsDir, "mechanical-exercise-354.mcanvas.json"),
  svg: join(artifactsDir, "mechanical-exercise-354.render.svg"),
  preview: join(artifactsDir, "mechanical-exercise-354.preview.png"),
  report: join(artifactsDir, "mechanical-exercise-354.dogfood-report.md"),
  arcRegressionReport: join(artifactsDir, "arc-orientation-regression-report.md"),
  arcFixtureSvg: join(artifactsDir, "arc-orientation-fixture.svg"),
  arcFixturePreview: join(artifactsDir, "arc-orientation-fixture.png"),
} as const;

type PathInput = {
  readonly id: string;
  readonly name: string;
  readonly d: string;
  readonly strokeWidth?: number;
  readonly strokeDasharray?: string;
  readonly fill?: string;
  readonly fillRule?: "nonzero" | "evenodd";
  readonly stroke?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
};

function requireArcPath(
  path: ReturnType<typeof createArcFromCenterRadius>["path"],
  error?: string,
) {
  if (!path) {
    throw new Error(error ?? "Arc helper did not return a path.");
  }
  return path;
}

function arcSegment(path: string): string {
  return path.replace(/^M [^A]+ A /, "A ");
}

function createPathObject(input: PathInput): Extract<CanvasObject, { kind: "path" }> {
  return {
    id: input.id,
    name: input.name,
    kind: "path",
    layerId: input.tags?.includes("construction") ? "construction" : "geometry",
    visible: true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    fill: input.fill ?? "transparent",
    stroke: input.stroke ?? (input.tags?.includes("construction") ? "#7f8896" : "#1c2430"),
    strokeWidth: input.strokeWidth ?? 0.55,
    strokeDasharray: input.strokeDasharray,
    fillRule: input.fillRule,
    d: input.d,
    tags: input.tags ? [...input.tags] : undefined,
    notes: input.notes,
  };
}

function createEllipseObject(input: {
  readonly id: string;
  readonly name: string;
  readonly cx: number;
  readonly cy: number;
  readonly diameter: number;
  readonly tags?: readonly string[];
}): Extract<CanvasObject, { kind: "ellipse" }> {
  return {
    id: input.id,
    name: input.name,
    kind: "ellipse",
    layerId: "geometry",
    visible: true,
    x: input.cx - input.diameter / 2,
    y: input.cy - input.diameter / 2,
    width: input.diameter,
    height: input.diameter,
    fill: "transparent",
    stroke: "#1c2430",
    tags: input.tags ? [...input.tags] : undefined,
  };
}

function centerline(
  id: string,
  name: string,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  return createPathObject({
    id,
    name,
    d: `M ${from[0]} ${from[1]} L ${to[0]} ${to[1]}`,
    strokeWidth: 0.25,
    strokeDasharray: "8 4 2 4",
    tags: ["construction", "centerline"],
  });
}

function createClosedCirclePath(cx: number, cy: number, radius: number): string {
  const upperArc = createArcFromCenterRadius({
    center: [cx, cy],
    radius,
    startAngleDeg: 180,
    endAngleDeg: 0,
    sweep: "clockwise",
  });
  const lowerArc = createArcFromCenterRadius({
    center: [cx, cy],
    radius,
    startAngleDeg: 0,
    endAngleDeg: 180,
    sweep: "clockwise",
  });
  if (upperArc.kind !== "ok" || lowerArc.kind !== "ok") {
    throw new Error(upperArc.error ?? lowerArc.error ?? "Failed to create circle path.");
  }
  return `${upperArc.path} ${arcSegment(requireArcPath(lowerArc.path))} Z`;
}

const rightArmArc = createArcFromCenterRadius({
  center: [204, 78],
  radius: 20,
  startAngleDeg: 90,
  endAngleDeg: -90,
  // Right arm end cap should bulge outward to the right side of its center.
  sweep: "counterclockwise",
});
const neckArc = createArcFromThreePoints({
  start: [126, 58],
  through: [111, 58],
  end: [98, 51],
});
if (rightArmArc.kind !== "ok" || neckArc.kind !== "ok") {
  throw new Error(rightArmArc.error ?? neckArc.error ?? "Exercise 354 arc generation failed.");
}

const outerProfilePath = [
  "M 74 38",
  "C 52 38 35 56 35 78",
  "C 35 95 45 107 58 114",
  "C 69 120 71 133 63 145",
  "C 56 156 63 167 76 164",
  "C 103 161 132 151 148 126",
  "C 155 105 160 98 172 98",
  "L 204 98",
  arcSegment(requireArcPath(rightArmArc.path)),
  "L 126 58",
  arcSegment(requireArcPath(neckArc.path)),
  "C 94 43 85 38 74 38",
  "Z",
].join(" ");

const innerHoleVoidPath = createClosedCirclePath(74, 78, 20);
const lowerHoleVoidPath = createClosedCirclePath(86, 144, 7);
const upperHoleVoidPath = createClosedCirclePath(126, 132, 7);
const slotVoidPath = (() => {
  const rightArc = createArcFromCenterRadius({
    center: [202, 78],
    radius: 10,
    startAngleDeg: -90,
    endAngleDeg: 90,
    // Slot right cap bulges outward to the right.
    sweep: "clockwise",
  });
  const leftArc = createArcFromCenterRadius({
    center: [159, 78],
    radius: 10,
    startAngleDeg: 90,
    endAngleDeg: 270,
    // Slot left cap bulges outward to the left.
    sweep: "clockwise",
  });
  if (rightArc.kind !== "ok" || leftArc.kind !== "ok") {
    throw new Error(rightArc.error ?? leftArc.error ?? "Failed to create slot path.");
  }
  return `M 159 68 L 202 68 ${arcSegment(requireArcPath(rightArc.path))} L 159 88 ${arcSegment(requireArcPath(leftArc.path))} Z`;
})();

export function createMechanicalExercise354Scene(): CanvasDocument {
  const layout = getMechanicalA4LandscapeLayout();
  const bodyProfile = createPathObject({
    id: "exercise-354-filled-body-profile",
    name: "Filled body profile with semantic voids",
    d: [
      outerProfilePath,
      innerHoleVoidPath,
      lowerHoleVoidPath,
      upperHoleVoidPath,
      slotVoidPath,
    ].join(" "),
    fill: "#68bfe9",
    fillRule: "evenodd",
    stroke: "none",
    strokeWidth: 0,
    tags: ["mechanical-body-profile", "filled-profile"],
    notes:
      "M39f topology-first rendering: one filled material profile with even-odd void subpaths for holes and the rounded slot.",
  });
  const outerProfile = createPathObject({
    id: "exercise-354-outer-profile",
    name: "Approximate outer profile",
    d: outerProfilePath,
    fill: "transparent",
    notes:
      "Dogfood approximation of the reference profile using SVG-like path geometry, not solved CAD constraints.",
  });
  const boss = {
    ...createEllipseObject({
      id: "exercise-354-boss-reference",
      name: "Large left boss reference circle",
      cx: 74,
      cy: 78,
      diameter: 64,
      tags: ["reference-boss"],
    }),
    visible: false,
    notes:
      "Reference-only boss circle retained as source geometry; the visible outer boss boundary is carried by the filled profile and outline path.",
  };
  const innerHole = createEllipseObject({
    id: "exercise-354-inner-hole",
    name: "Inner circular hole",
    cx: 74,
    cy: 78,
    diameter: 40,
    tags: ["mechanical-void"],
  });
  const slot = createPathObject({
    id: "exercise-354-rounded-slot",
    name: "Rounded slot",
    d: slotVoidPath,
    fill: "transparent",
    tags: ["mechanical-void"],
    notes:
      "Rounded slot authored as ordinary path geometry and punched from the filled body profile as an even-odd void.",
  });
  const lowerHole = createEllipseObject({
    id: "exercise-354-lower-hole",
    name: "Lower small hole",
    cx: 86,
    cy: 144,
    diameter: 14,
    tags: ["mechanical-void"],
  });
  const upperHole = createEllipseObject({
    id: "exercise-354-upper-hole",
    name: "Upper small hole",
    cx: 126,
    cy: 132,
    diameter: 14,
    tags: ["mechanical-void"],
  });
  const construction = [
    centerline("exercise-354-boss-centerline-x", "Boss horizontal centerline", [26, 78], [214, 78]),
    centerline("exercise-354-boss-centerline-y", "Boss vertical centerline", [74, 20], [74, 176]),
    centerline("exercise-354-slot-centerline", "Slot centerline", [145, 78], [216, 78]),
    centerline(
      "exercise-354-small-hole-axis",
      "Small hole construction axis",
      [75, 148],
      [137, 128],
    ),
    centerline(
      "exercise-354-angle-leg-a",
      "Angle dimension construction leg A",
      [74, 166],
      [74, 151],
    ),
    centerline(
      "exercise-354-angle-leg-b",
      "Angle dimension construction leg B",
      [74, 166],
      [122, 132],
    ),
  ];
  const sheet = {
    ...createDefaultMechanicalSheetMetadata(),
    scale: "Fit to A4",
    drawingNumber: "M39D-354",
    title: "2D Exercise 354",
    revision: "A",
  };
  const annotations = createMechanicalAnnotationSet({
    id: "exercise-354-annotations",
    units: "mm",
    scale: sheet.scale,
    sheet,
    dimensions: [
      {
        id: "overall-top-100",
        kind: "linear",
        axis: "horizontal",
        from: [74, 38],
        to: [204, 38],
        offset: 22,
        label: "100",
      },
      {
        id: "slot-length-30",
        kind: "linear",
        axis: "horizontal",
        from: [170, 68],
        to: [204, 68],
        offset: 17,
        label: "30",
      },
      {
        id: "left-height-62",
        kind: "linear",
        axis: "vertical",
        from: [35, 78],
        to: [63, 145],
        offset: -20,
        label: "62",
        labelOffset: -2,
      },
      {
        id: "bottom-offset-10",
        kind: "linear",
        axis: "horizontal",
        from: [74, 166],
        to: [86, 164],
        offset: -14,
        label: "10",
        labelOffset: -8,
      },
      {
        id: "small-hole-spacing",
        kind: "aligned",
        from: [86, 144],
        to: [126, 132],
        offset: 12,
        label: "42",
        labelOffset: 5,
      },
      {
        id: "angle-35",
        kind: "angle",
        center: [74, 166],
        from: [74, 151],
        to: [122, 132],
        label: "35°",
        radius: 42,
        labelOffset: 10,
      },
      {
        id: "boss-radius-32",
        kind: "radius",
        center: [74, 78],
        radius: 32,
        label: "R32",
        leaderAngle: -135,
        leaderLength: 16,
        labelOffset: [-3, -2],
      },
      {
        id: "inner-radius-20",
        kind: "radius",
        center: [74, 78],
        radius: 20,
        label: "R20",
        leaderAngle: 120,
        leaderLength: 10,
        labelOffset: [-3, 3],
      },
      {
        id: "neck-radius-30",
        kind: "radius",
        center: [126, 38],
        radius: 30,
        label: "R30",
        leaderAngle: 108,
        leaderLength: 13,
        labelOffset: [-3, -1],
      },
      {
        id: "right-radius-20",
        kind: "radius",
        center: [204, 78],
        radius: 20,
        label: "R20",
        leaderAngle: -48,
        leaderLength: 13,
        labelOffset: [3, -1],
      },
      {
        id: "slot-radius-8",
        kind: "radius",
        center: [202, 78],
        radius: 8,
        label: "R8",
        leaderAngle: 45,
        leaderLength: 14,
        labelOffset: [3, 4],
      },
      {
        id: "lower-hole-radius-7",
        kind: "radius",
        center: [86, 144],
        radius: 7,
        label: "R7",
        leaderAngle: -75,
        leaderLength: 17,
        labelOffset: [2, -2],
      },
      {
        id: "upper-hole-radius-7",
        kind: "radius",
        center: [126, 132],
        radius: 7,
        label: "R7",
        leaderAngle: -80,
        leaderLength: 15,
        labelOffset: [2, -2],
      },
      {
        id: "inside-radius-15",
        kind: "radius",
        center: [170, 123],
        radius: 15,
        label: "R15",
        leaderAngle: -135,
        leaderLength: 12,
        labelOffset: [-3, -1],
      },
      {
        id: "bottom-radius-72",
        kind: "radius",
        center: [74, 166],
        radius: 72,
        label: "R72",
        leaderAngle: -32,
        leaderLength: 8,
        labelOffset: [3, 4],
      },
    ],
    notes: [
      {
        id: "source-note",
        kind: "note",
        at: [218, 38],
        text: "2D EXERCISES",
      },
      {
        id: "exercise-number",
        kind: "note",
        at: [221, 52],
        text: "354",
      },
    ],
    datums: [],
    blocks: [
      {
        id: "exercise-354-title-block",
        kind: "titleBlock",
        x: 197,
        y: 165,
        width: 90,
        height: 35,
        fields: {
          Title: sheet.title,
          Drawing: sheet.drawingNumber,
          Rev: sheet.revision,
          Scale: sheet.scale,
          Units: sheet.units,
        },
      },
    ],
  });
  const sidecar = createMechanicalAnnotationSidecarObject({
    id: "exercise-354-mechanical-annotations",
    name: "Exercise 354 mechanical annotations",
    layerId: "annotations",
    visible: true,
    x: 0,
    y: 0,
    width: layout.widthMm,
    height: layout.heightMm,
    annotations,
  });
  const objects = [
    bodyProfile,
    outerProfile,
    boss,
    innerHole,
    slot,
    lowerHole,
    upperHole,
    ...construction,
    sidecar,
  ];

  return {
    id: "mechanical-exercise-354",
    name: "2D Exercise 354",
    width: layout.widthMm,
    height: layout.heightMm,
    unit: "mm",
    unitSystem: createCanvasUnitSystem("mm"),
    referenceGrid: {
      columns: 6,
      rows: 4,
      columnStart: "A",
      rowStart: 1,
      showBorder: false,
      showLines: false,
      showLabels: false,
    },
    layers: [
      {
        id: "geometry",
        name: "Part geometry",
        visible: true,
        objectIds: [
          bodyProfile.id,
          outerProfile.id,
          boss.id,
          innerHole.id,
          slot.id,
          lowerHole.id,
          upperHole.id,
        ],
      },
      {
        id: "construction",
        name: "Centerlines and construction",
        visible: true,
        objectIds: construction.map((object) => object.id),
      },
      {
        id: "annotations",
        name: "Mechanical Drafting",
        visible: true,
        objectIds: [sidecar.id],
      },
    ],
    layerGroups: [
      {
        id: "mechanical-exercise-354-dogfood",
        title: "Mechanical Exercise 354 Dogfood",
        description:
          "Approximate reference recreation using MachinaCanvas geometry plus semantic mechanical annotations.",
        objectIds: objects.map((object) => object.id),
      },
    ],
    objects: Object.fromEntries(objects.map((object) => [object.id, object])),
    selectedObjectId: sidecar.id,
  };
}

export function createMechanicalExercise354DogfoodReport(): string {
  return `# Mechanical Exercise 354 Dogfood Report

## Source

The source is the uploaded 2D mechanical exercise reference image, preserved as \`apps/machina-canvas/artifacts/reference-mechanical-exercise-354.png\` when available. The drawing was manually approximated; no computer vision, raster tracing, or automatic image-to-CAD conversion was used.

## Generated artifacts

- \`apps/machina-canvas/artifacts/mechanical-exercise-354.mcanvas.json\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354.render.svg\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354.preview.png\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354.dogfood-report.md\`

## What worked

Existing ellipse geometry represented the circular holes cleanly, while the left boss is now carried by the filled body profile and outline path instead of a separate visible reference circle. The generic path scene object covered the complex outer profile, centerlines, and rounded slot while staying within the SVG-like MachinaCanvas substrate. The mechanical sidecar represented horizontal, vertical, aligned, radius, and angular dimensions, and the A4 landscape sheet/title block rendered directly in SVG.

M39f adds a filled profile interpretation that makes the material body readable before annotations are inspected. The main part body is now one \`mechanical-body-profile\` path with \`fillRule: "evenodd"\`; the inner circular hole, the two small holes, and the rounded slot are authored as void subpaths in that profile and also kept as visible outline geometry tagged \`mechanical-void\`. centerlines worked as ordinary dashed path geometry on a construction layer. radius callouts, including \`R20\` and \`R32\`, now use explicit leader angles so they sit around the part instead of stacking to the right. The angular dimension label \`35°\` renders on a larger bottom arc. The rounded slot is represented as one path object rather than a new CAD-only primitive. A4 fitting uses the existing 297 mm by 210 mm sheet with 10 mm margins, and Inkscape rasterizes the canonical SVG into a preview PNG for review.

M40b now generates the right-arm outer arc, the neck transition cue, the rounded slot caps, and the circular void subpaths with reusable local arc helpers instead of handwritten arc strings. The scene still lowers those results into ordinary path geometry, so export and review stay on the existing SVG-like substrate.

## What was approximated

The outer profile is a hand-authored cubic/arc approximation derived from the visible reference, not an exact reconstruction. Several radius centers are approximate and are used mainly to exercise semantic annotation records. The neck transition and lower sweep still rely on local judgement rather than exact tangent-chain construction. The small exercise number box is represented as notes rather than a dedicated reference-image title stamp. The scale is marked \`Fit to A4\` because the source image proportions were fit to the printable area.

## Friction found

M39d revealed that annotation defaults were the root cause of the "pile of detached stuff" look: every radius callout used an east-facing leader, vertical dimensions could become diagonal when their endpoints had different x coordinates, angular dimensions had a fixed radius, and text had no white backplate to separate it from construction geometry. M39e also found two exporter-level composition bugs: the mechanical sheet frame was rendered after geometry with a white fill, which could occlude the part, and \`fill="transparent"\` was not portable through Inkscape rasterization. The sheet composition also needed a clearer review artifact than SVG alone.

M39f found a more basic mCAD readability issue: line-only drafting made the topology ambiguous for LLM-native inspection. Holes, slots, construction lines, radius leaders, and body edges all competed as strokes. The root cause was that mechanical mode had no semantic material profile layer; it only had outlines plus annotations. The filled pass also exposed a concrete geometry flaw in the first approximation: the rounded slot touched the top arm edge, creating a zero-thickness, unmanufacturable wall.

## Fixes made in M39d

M39d added a small SVG-like path scene primitive with stroke width and dash pattern metadata. SVG/TOML export and the live app preview now render path objects. Mechanical dimension rendering gained arrow markers and rotated aligned-dimension labels for better readability in this exercise.

## Fixes made in M39e

M39e added reusable per-annotation placement hints for radius leader angle/length, angle radius/label offset, and linear/aligned label offsets. Linear dimensions now keep horizontal and vertical witness-line geometry axis-aligned. Dimension labels render with white backplates. The sheet frame no longer paints over scene geometry, and SVG export normalizes transparent fills to \`none\` for Inkscape compatibility. Exercise 354 now places callouts around the part instead of using one default leader direction, and the workflow writes \`mechanical-exercise-354.preview.png\` by rasterizing the SVG with Inkscape.

## Fixes made in M39f

M39f makes mechanical mode profile-first by default. Path scene objects now support a portable \`fillRule\` field, which exports as SVG \`fill-rule\` and serializes into object TOML. The Exercise 354 generator creates a filled blue body/profile region first, punches holes and the obround slot with even-odd void subpaths, then renders visible outlines, centerlines, dimensions, leaders, labels, and the title block above it. The right arm profile was adjusted so the slot is centered vertically in solid material with wall thickness above and below instead of collapsing into a 0 mm edge. The default mechanical drafting template now starts with a filled profile body as well, while preserving ordinary geometry objects for annotation references.

## Deferred gaps

PDF was intentionally deferred because M39f still treats SVG as the canonical vector artifact and preview PNG as review output. Automatic image-to-CAD conversion, arbitrary boolean solving, constraint solving, DXF/DWG, arbitrary plotter/page profiles, parametric sketching, collision avoidance, and exact radius tangent solving remain out of scope. M40b keeps tangency local and arc-only; it does not solve the whole profile or move referenced entities. Future work should consider automatic leader collision checks, smarter text-side selection, first-class centerline style presets, and a small UI control for switching between filled profile and outline-only review if users need that comparison.

## Verification

The generator writes the scene JSON, rendered SVG, preview PNG, and this dogfood report through \`npm run canvas:mechanical-exercise-354\`. Tests assert A4 landscape metadata, existing scene geometry records, a filled topology-first body profile, semantic void outlines, mechanical annotation sidecar content, key labels such as \`100\`, \`30\`, \`R20\`, \`R32\`, and \`35°\`, required report sections, label backplates, placement metadata, preview path metadata, and explicit deferred PDF coverage.
`;
}

export function createArcOrientationRegressionReport(): string {
  return `# Arc Orientation Regression Report

## What broke

M40b replaced several handwritten Exercise 354 arc strings with reusable arc helpers. The generated SVG paths could then select the opposite side of a chord: right-arm arcs bent inward, rounded slot caps faced the wrong way, and circular void halves could choose the wrong semicircle.

## Root cause

The helpers emitted SVG arc \`sweepFlag\` as if \`clockwise\` meant SVG/canvas visual clockwise, but their internal sweep delta and three-point inclusion logic treated increasing \`atan2\` as counterclockwise. In SVG/canvas coordinates, +x points right and +y points down, so increasing the angle moves visually clockwise.

## Helpers fixed

- \`createArcFromThreePoints\` now chooses the sweep that actually contains the through point in SVG/canvas y-down coordinates.
- \`createArcFromCenterRadius\` and \`createArcFromCenterStartEnd\` now compute large-arc selection with the same visual sweep convention used by SVG lowering.
- \`createTangentArcBetweenLines\` now maps local cross-product orientation into the corrected visual sweep convention.
- \`sampleArcResult\` provides a numeric regression check for midpoint and side-of-arc assertions.

## Exercise 354 impact

- Rounded slot caps now bulge outward: the right cap to the right and the left cap to the left.
- The right-arm end arc now bulges outward instead of cutting inward.
- Circular void subpaths now use upper and lower semicircle sweeps explicitly.
- The blockout lower arc cue continues to lower through its intended guide-side point.

## Coordinate convention

MachinaCanvas arc helpers use SVG/canvas coordinates: +x right, +y down.

ArcSweep values describe visual clockwise/counterclockwise motion in that y-down coordinate system.

## Visual evidence

- \`apps/machina-canvas/artifacts/mechanical-exercise-354.render.svg\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354.preview.png\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354-blockout.render.svg\`
- \`apps/machina-canvas/artifacts/mechanical-exercise-354-blockout.preview.png\`
- \`apps/machina-canvas/artifacts/arc-orientation-fixture.svg\`
- \`apps/machina-canvas/artifacts/arc-orientation-fixture.png\`

## Remaining caveats

Exercise 354 remains a hand-authored approximation rather than solved CAD. Unsupported tangent-reference combinations still return explicit errors instead of guessing.
`;
}

function createArcOrientationFixtureSvg(): string {
  const fixtures = [
    {
      id: "clockwise-quarter",
      label: "clockwise quarter",
      labelAt: [48, 92],
      arc: createArcFromCenterRadius({
        center: [45, 45],
        radius: 25,
        startAngleDeg: 0,
        endAngleDeg: 90,
        sweep: "clockwise",
      }),
    },
    {
      id: "counterclockwise-quarter",
      label: "counterclockwise quarter",
      labelAt: [135, 92],
      arc: createArcFromCenterRadius({
        center: [125, 45],
        radius: 25,
        startAngleDeg: 0,
        endAngleDeg: -90,
        sweep: "counterclockwise",
      }),
    },
    {
      id: "upper-semicircle",
      label: "upper semicircle",
      labelAt: [230, 92],
      arc: createArcFromCenterRadius({
        center: [215, 55],
        radius: 30,
        startAngleDeg: 180,
        endAngleDeg: 0,
        sweep: "clockwise",
      }),
    },
    {
      id: "lower-semicircle",
      label: "lower semicircle",
      labelAt: [330, 92],
      arc: createArcFromCenterRadius({
        center: [305, 55],
        radius: 30,
        startAngleDeg: 0,
        endAngleDeg: 180,
        sweep: "clockwise",
      }),
    },
    {
      id: "slot-right-cap",
      label: "slot right cap",
      labelAt: [255, 210],
      arc: createArcFromCenterRadius({
        center: [235, 145],
        radius: 25,
        startAngleDeg: -90,
        endAngleDeg: 90,
        sweep: "clockwise",
      }),
    },
    {
      id: "slot-left-cap",
      label: "slot left cap",
      labelAt: [125, 210],
      arc: createArcFromCenterRadius({
        center: [145, 145],
        radius: 25,
        startAngleDeg: 90,
        endAngleDeg: 270,
        sweep: "clockwise",
      }),
    },
  ] as const;
  for (const fixture of fixtures) {
    if (fixture.arc.kind !== "ok") {
      throw new Error(fixture.arc.error ?? `Failed to create ${fixture.id}.`);
    }
  }
  const pathLines = fixtures.map(
    (fixture) =>
      `  <path id="${fixture.id}" d="${fixture.arc.path}" fill="none" stroke="#1c2430" stroke-width="2.5" />`,
  );
  const labelLines = fixtures.map((fixture) => {
    return `  <text x="${fixture.labelAt[0]}" y="${fixture.labelAt[1]}" text-anchor="middle" font-family="Arial, sans-serif" font-size="9" fill="#1c2430">${fixture.label}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="225" viewBox="0 0 390 225">
  <rect x="0" y="0" width="390" height="225" fill="#ffffff" />
  <text x="12" y="18" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#1c2430">MachinaCanvas arc orientation fixture (+x right, +y down)</text>
  <path d="M 145 120 L 235 120 M 235 170 L 145 170" fill="none" stroke="#9aa4b2" stroke-width="1.5" stroke-dasharray="4 3" />
${pathLines.join("\n")}
${labelLines.join("\n")}
</svg>
`;
}

function renderPng(svgPath: string, pngPath: string, width: number, height: number) {
  const previewResult = spawnSync(
    inkscapeBin,
    [
      svgPath,
      "--export-type=png",
      `--export-filename=${pngPath}`,
      `--export-width=${width}`,
      `--export-height=${height}`,
      "--export-background=#ffffff",
      "--export-background-opacity=1",
    ],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );
  if (previewResult.status !== 0) {
    const stderr = previewResult.stderr?.toString().trim();
    const message = previewResult.error?.message ?? stderr;
    throw new Error(message || `Inkscape could not rasterize ${pngPath}.`);
  }
}

export function writeMechanicalExercise354Artifacts(): readonly string[] {
  mkdirSync(artifactsDir, { recursive: true });
  const uploadedReferencePath = uploadedReferencePaths.find((path) => existsSync(path));
  if (uploadedReferencePath) {
    copyFileSync(uploadedReferencePath, MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.reference);
  }
  const scene = createMechanicalExercise354Scene();
  const sceneJson = `${JSON.stringify(scene, null, 2)}\n`;
  const svg = serializeCanvasRenderSvg(scene);
  const report = createMechanicalExercise354DogfoodReport();
  const arcReport = createArcOrientationRegressionReport();
  const arcFixture = createArcOrientationFixtureSvg();
  writeFileSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.scene, sceneJson, "utf8");
  writeFileSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.svg, svg, "utf8");
  writeFileSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.report, report, "utf8");
  writeFileSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcRegressionReport, arcReport, "utf8");
  writeFileSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcFixtureSvg, arcFixture, "utf8");
  renderPng(
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.svg,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.preview,
    1485,
    1050,
  );
  renderPng(
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcFixtureSvg,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcFixturePreview,
    720,
    380,
  );
  const formatResult = spawnSync(
    process.execPath,
    [biomeBin, "format", "--write", MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.scene],
    {
      cwd: repoRoot,
      stdio: "pipe",
    },
  );
  if (formatResult.status !== 0) {
    const stderr = formatResult.stderr?.toString().trim();
    const message = formatResult.error?.message ?? stderr;
    throw new Error(message || "Biome could not format the Exercise 354 scene JSON.");
  }
  return [
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.scene,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.svg,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.preview,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.report,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcRegressionReport,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcFixtureSvg,
    MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.arcFixturePreview,
  ];
}

if (
  (process.argv[1] && resolve(process.argv[1]) === __filename) ||
  process.env.npm_lifecycle_event === "canvas:mechanical-exercise-354"
) {
  const outputs = writeMechanicalExercise354Artifacts();
  console.log("Mechanical Exercise 354 dogfood artifacts generated:");
  for (const output of outputs) {
    console.log(`- ${output}`);
  }
  if (existsSync(MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.reference)) {
    console.log(`- ${MECHANICAL_EXERCISE_354_ARTIFACT_PATHS.reference}`);
  }
}
