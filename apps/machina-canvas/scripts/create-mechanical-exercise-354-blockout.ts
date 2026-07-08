import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createArcFromCenterRadius, createArcFromThreePoints } from "../src/arcGeometry";
import { stringifyBlockoutSidecarToml, type CanvasBlockoutSidecar } from "../src/blockoutSidecar";
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

const uploadedReferences = [
  {
    source:
      "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-f442c785-f91e-4935-ba54-221d333192bc.png",
    target: "reference-mechanical-exercise-354-filled.png",
  },
  {
    source:
      "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-18e8c656-110b-44bb-8d1e-330c1a5be626.png",
    target: "reference-mechanical-exercise-354-global-mask.png",
  },
  {
    source:
      "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-10ae75ef-c7a4-4d18-be75-2cd94d3c93a5.png",
    target: "reference-mechanical-exercise-354-feature-mask.png",
  },
  {
    source:
      "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-f95a6d41-b1b5-4296-b222-3278d5ae541f.png",
    target: "reference-mechanical-exercise-354-two-mask.png",
  },
] as const;

export const MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS = {
  globalSvg: join(artifactsDir, "mechanical-exercise-354-blockout-global.svg"),
  featuresSvg: join(artifactsDir, "mechanical-exercise-354-blockout-features.svg"),
  blockoutToml: join(artifactsDir, "mechanical-exercise-354.blockout.toml"),
  scene: join(artifactsDir, "mechanical-exercise-354-blockout.mcanvas.json"),
  svg: join(artifactsDir, "mechanical-exercise-354-blockout.render.svg"),
  preview: join(artifactsDir, "mechanical-exercise-354-blockout.preview.png"),
  processNotes: join(artifactsDir, "mechanical-exercise-354-blockout-process-notes.md"),
  methodPlan: join(artifactsDir, "mechanical-exercise-354-blockout-method-plan.md"),
} as const;

type Box = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role?: "solid" | "void" | "construction";
};

const globalBounds = {
  id: "exercise-354-global-bounding-box",
  label: "global bounding",
  kind: "bodyEnvelope",
  x: 35,
  y: 32,
  width: 188,
  height: 134,
  role: "construction",
} as const;

const featureBoxes = [
  {
    id: "exercise-354-feature-box-boss",
    label: "large boss blockout",
    kind: "boss",
    x: 35,
    y: 38,
    width: 78,
    height: 80,
    role: "solid",
  },
  {
    id: "exercise-354-feature-box-large-hole",
    label: "large hole blockout",
    kind: "hole",
    x: 54,
    y: 58,
    width: 40,
    height: 40,
    role: "void",
  },
  {
    id: "exercise-354-feature-box-right-arm",
    label: "right arm blockout",
    kind: "bodyRegion",
    x: 112,
    y: 58,
    width: 111,
    height: 40,
    role: "solid",
  },
  {
    id: "exercise-354-feature-box-slot",
    label: "slot blockout",
    kind: "slot",
    x: 159,
    y: 68,
    width: 54,
    height: 20,
    role: "void",
  },
  {
    id: "exercise-354-feature-box-lower-lobe",
    label: "lower lobe blockout",
    kind: "bodyRegion",
    x: 58,
    y: 98,
    width: 114,
    height: 68,
    role: "solid",
  },
  {
    id: "exercise-354-feature-box-left-small-hole",
    label: "small left hole blockout",
    kind: "hole",
    x: 79,
    y: 137,
    width: 14,
    height: 14,
    role: "void",
  },
  {
    id: "exercise-354-feature-box-right-small-hole",
    label: "small right hole blockout",
    kind: "hole",
    x: 119,
    y: 125,
    width: 14,
    height: 14,
    role: "void",
  },
  {
    id: "exercise-354-feature-box-inside-relief",
    label: "inside relief cue",
    kind: "transition",
    x: 156,
    y: 98,
    width: 18,
    height: 18,
    role: "construction",
  },
] satisfies readonly Box[];

function pathObject(input: {
  readonly id: string;
  readonly name: string;
  readonly d: string;
  readonly layerId?: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeDasharray?: string;
  readonly fillRule?: "nonzero" | "evenodd";
  readonly tags?: readonly string[];
  readonly notes?: string;
  readonly visible?: boolean;
}): Extract<CanvasObject, { kind: "path" }> {
  return {
    id: input.id,
    name: input.name,
    kind: "path",
    layerId: input.layerId ?? "geometry",
    visible: input.visible ?? true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    fill: input.fill ?? "transparent",
    stroke: input.stroke ?? "#1c2430",
    strokeWidth: input.strokeWidth ?? 0.55,
    strokeDasharray: input.strokeDasharray,
    fillRule: input.fillRule,
    d: input.d,
    tags: input.tags ? [...input.tags] : undefined,
    notes: input.notes,
  };
}

function ellipseObject(input: {
  readonly id: string;
  readonly name: string;
  readonly cx: number;
  readonly cy: number;
  readonly diameter: number;
  readonly layerId?: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly tags?: readonly string[];
  readonly notes?: string;
}): Extract<CanvasObject, { kind: "ellipse" }> {
  return {
    id: input.id,
    name: input.name,
    kind: "ellipse",
    layerId: input.layerId ?? "geometry",
    visible: true,
    x: input.cx - input.diameter / 2,
    y: input.cy - input.diameter / 2,
    width: input.diameter,
    height: input.diameter,
    fill: input.fill ?? "transparent",
    stroke: input.stroke ?? "#1c2430",
    tags: input.tags ? [...input.tags] : undefined,
    notes: input.notes,
  };
}

function rectPath(box: Box): string {
  return `M ${box.x} ${box.y} H ${box.x + box.width} V ${box.y + box.height} H ${box.x} Z`;
}

function guideBox(box: Box, stroke: string) {
  return pathObject({
    id: box.id,
    name: box.label,
    d: rectPath(box),
    layerId: "guides",
    fill: "transparent",
    stroke,
    strokeWidth: 0.5,
    tags: ["mechanical-guide", "feature-blockout", box.kind, box.role ?? "construction"],
    notes: `${box.label}: ${box.kind} ${box.role ?? "construction"} guide box lowered manually into final topology.`,
  });
}

function datumLine(input: {
  readonly id: string;
  readonly name: string;
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly layerId?: string;
  readonly stroke?: string;
  readonly tags?: readonly string[];
}) {
  return pathObject({
    id: input.id,
    name: input.name,
    d: `M ${input.from[0]} ${input.from[1]} L ${input.to[0]} ${input.to[1]}`,
    layerId: input.layerId ?? "guides",
    fill: "transparent",
    stroke: input.stroke ?? "#f04a24",
    strokeWidth: 0.35,
    strokeDasharray: "8 4 2 4",
    tags: ["mechanical-guide", "datum", ...(input.tags ?? [])],
  });
}

function centerMark(id: string, name: string, cx: number, cy: number, stroke = "#f04a24") {
  return pathObject({
    id,
    name,
    d: `M ${cx - 6} ${cy} L ${cx + 6} ${cy} M ${cx} ${cy - 6} L ${cx} ${cy + 6}`,
    layerId: "guides",
    fill: "transparent",
    stroke,
    strokeWidth: 0.35,
    tags: ["mechanical-guide", "center-mark"],
  });
}

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

function obroundPathFromBox(box: Box): string {
  const radius = box.height / 2;
  const left = box.x + radius;
  const right = box.x + box.width - radius;
  const top = box.y;
  const bottom = box.y + box.height;
  const rightArc = createArcFromCenterRadius({
    center: [right, top + radius],
    radius,
    startAngleDeg: -90,
    endAngleDeg: 90,
    // Obround right cap bulges outward to the right.
    sweep: "clockwise",
  });
  const leftArc = createArcFromCenterRadius({
    center: [left, top + radius],
    radius,
    startAngleDeg: 90,
    endAngleDeg: 270,
    // Obround left cap bulges outward to the left.
    sweep: "clockwise",
  });
  if (rightArc.kind !== "ok" || leftArc.kind !== "ok") {
    throw new Error(rightArc.error ?? leftArc.error ?? "Failed to create obround blockout path.");
  }
  return `M ${left} ${top} L ${right} ${top} ${arcSegment(requireArcPath(rightArc.path))} L ${left} ${bottom} ${arcSegment(requireArcPath(leftArc.path))} Z`;
}

function circlePathFromBox(box: Box): string {
  const radius = Math.min(box.width, box.height) / 2;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
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
    throw new Error(upperArc.error ?? lowerArc.error ?? "Failed to create circle blockout path.");
  }
  return `${upperArc.path} ${arcSegment(requireArcPath(lowerArc.path))} Z`;
}

function createGlobalGuideObjects() {
  const lowerArcCue = createArcFromThreePoints({
    start: [75, 152],
    through: [118, 142],
    end: [151, 114],
  });
  if (lowerArcCue.kind !== "ok") {
    throw new Error(lowerArcCue.error ?? "Failed to create lower arc cue.");
  }
  return [
    guideBox(globalBounds, "#f04a24"),
    datumLine({
      id: "exercise-354-global-datum-horizontal",
      name: "Main horizontal datum through bore and slot",
      from: [globalBounds.x, 78],
      to: [globalBounds.x + globalBounds.width, 78],
      tags: ["main-horizontal-datum"],
    }),
    datumLine({
      id: "exercise-354-global-datum-bore-vertical",
      name: "Main vertical datum through large bore",
      from: [74, globalBounds.y],
      to: [74, globalBounds.y + globalBounds.height],
      tags: ["main-vertical-datum"],
    }),
    datumLine({
      id: "exercise-354-global-datum-slot-left",
      name: "Slot left extent datum",
      from: [159, 60],
      to: [159, 96],
      tags: ["slot-extent-datum"],
    }),
    datumLine({
      id: "exercise-354-global-datum-slot-right",
      name: "Slot right extent datum",
      from: [213, 60],
      to: [213, 96],
      tags: ["slot-extent-datum"],
    }),
    datumLine({
      id: "exercise-354-global-datum-lower-extent",
      name: "Lower lobe extent datum",
      from: [58, 166],
      to: [172, 166],
      tags: ["lower-extent-datum"],
    }),
    pathObject({
      id: "exercise-354-global-lower-arc-cue",
      name: "Lower construction arc cue",
      d: requireArcPath(lowerArcCue.path),
      layerId: "guides",
      fill: "transparent",
      stroke: "#f04a24",
      strokeWidth: 0.45,
      strokeDasharray: "3 3",
      tags: ["mechanical-guide", "construction-curve", "lower-arc-cue"],
    }),
    centerMark("exercise-354-global-bore-center", "Large bore center mark", 74, 78),
    centerMark("exercise-354-global-left-small-hole-center", "Left small-hole center cue", 86, 144),
    centerMark(
      "exercise-354-global-right-small-hole-center",
      "Right small-hole center cue",
      126,
      132,
    ),
  ] as const;
}

function createFeatureGuideObjects() {
  return [
    ...featureBoxes.map((box) => guideBox(box, "#00d92f")),
    centerMark("exercise-354-feature-large-hole-center", "Large hole blockout center", 74, 78),
    centerMark("exercise-354-feature-slot-left-center", "Slot left radius center", 169, 78),
    centerMark("exercise-354-feature-slot-right-center", "Slot right radius center", 203, 78),
    centerMark("exercise-354-feature-left-small-hole-center", "Left small-hole center", 86, 144),
    centerMark("exercise-354-feature-right-small-hole-center", "Right small-hole center", 126, 132),
  ] as const;
}

const blockoutRightArmArc = createArcFromCenterRadius({
  center: [203, 78],
  radius: 20,
  startAngleDeg: 90,
  endAngleDeg: -90,
  // Right arm end cap should bulge outward to the right side of its center.
  sweep: "counterclockwise",
});
const blockoutNeckArc = createArcFromThreePoints({
  start: [126, 58],
  through: [112, 57],
  end: [98, 48],
});
if (blockoutRightArmArc.kind !== "ok" || blockoutNeckArc.kind !== "ok") {
  throw new Error(
    blockoutRightArmArc.error ??
      blockoutNeckArc.error ??
      "Exercise 354 blockout arc generation failed.",
  );
}

const outerProfilePath = [
  "M 74 38",
  "C 53 38 35 57 35 78",
  "C 35 94 44 108 58 118",
  "C 66 124 69 133 63 144",
  "C 56 157 62 166 76 166",
  "C 101 165 132 153 151 126",
  "C 157 116 158 107 170 98",
  "L 203 98",
  arcSegment(requireArcPath(blockoutRightArmArc.path)),
  "L 126 58",
  arcSegment(requireArcPath(blockoutNeckArc.path)),
  "C 92 41 84 38 74 38",
  "Z",
].join(" ");

const largeHoleBox = featureBoxes.find((box) => box.id === "exercise-354-feature-box-large-hole");
const slotBox = featureBoxes.find((box) => box.id === "exercise-354-feature-box-slot");
const leftSmallHoleBox = featureBoxes.find(
  (box) => box.id === "exercise-354-feature-box-left-small-hole",
);
const rightSmallHoleBox = featureBoxes.find(
  (box) => box.id === "exercise-354-feature-box-right-small-hole",
);

if (!largeHoleBox || !slotBox || !leftSmallHoleBox || !rightSmallHoleBox) {
  throw new Error("Exercise 354 blockout feature boxes are incomplete.");
}

const largeHoleVoidPath = circlePathFromBox(largeHoleBox);
const leftSmallHoleVoidPath = circlePathFromBox(leftSmallHoleBox);
const rightSmallHoleVoidPath = circlePathFromBox(rightSmallHoleBox);
const slotVoidPath = obroundPathFromBox(slotBox);

function createFinalGeometryObjects() {
  const bodyProfile = pathObject({
    id: "exercise-354-blockout-filled-body-profile",
    name: "Filled body profile lowered from blockout masks",
    d: [
      outerProfilePath,
      largeHoleVoidPath,
      leftSmallHoleVoidPath,
      rightSmallHoleVoidPath,
      slotVoidPath,
    ].join(" "),
    fill: "#68bfe9",
    fillRule: "evenodd",
    stroke: "none",
    strokeWidth: 0,
    tags: ["mechanical-body-profile", "filled-profile", "lowered-from-blockout"],
    notes:
      "M39g topology lowered from global bounds and feature blockouts; void subpaths come directly from feature boxes.",
  });
  return [
    bodyProfile,
    pathObject({
      id: "exercise-354-blockout-outer-profile",
      name: "Outer profile lowered from body blockouts",
      d: outerProfilePath,
      fill: "transparent",
      tags: ["mechanical-outline", "lowered-from-blockout"],
    }),
    ellipseObject({
      id: "exercise-354-blockout-large-hole",
      name: "Large hole lowered from feature box",
      cx: 74,
      cy: 78,
      diameter: 40,
      tags: ["mechanical-void", "lowered-from-blockout", "large-hole"],
    }),
    pathObject({
      id: "exercise-354-blockout-rounded-slot",
      name: "Rounded slot lowered from slot box",
      d: slotVoidPath,
      fill: "transparent",
      tags: ["mechanical-void", "lowered-from-blockout", "slot"],
    }),
    ellipseObject({
      id: "exercise-354-blockout-left-small-hole",
      name: "Left small hole lowered from feature box",
      cx: 86,
      cy: 144,
      diameter: 14,
      tags: ["mechanical-void", "lowered-from-blockout", "small-hole"],
    }),
    ellipseObject({
      id: "exercise-354-blockout-right-small-hole",
      name: "Right small hole lowered from feature box",
      cx: 126,
      cy: 132,
      diameter: 14,
      tags: ["mechanical-void", "lowered-from-blockout", "small-hole"],
    }),
  ] as const;
}

function createConstructionObjects() {
  return [
    datumLine({
      id: "exercise-354-blockout-bore-centerline-x",
      name: "Bore and slot horizontal centerline",
      from: [28, 78],
      to: [225, 78],
      layerId: "construction",
      stroke: "#7f8896",
      tags: ["centerline"],
    }),
    datumLine({
      id: "exercise-354-blockout-bore-centerline-y",
      name: "Large bore vertical centerline",
      from: [74, 28],
      to: [74, 176],
      layerId: "construction",
      stroke: "#7f8896",
      tags: ["centerline"],
    }),
    datumLine({
      id: "exercise-354-blockout-small-hole-axis",
      name: "Small-hole construction axis",
      from: [78, 147],
      to: [135, 129],
      layerId: "construction",
      stroke: "#7f8896",
      tags: ["centerline"],
    }),
    datumLine({
      id: "exercise-354-blockout-angle-leg-a",
      name: "Angle construction leg A",
      from: [74, 166],
      to: [74, 151],
      layerId: "construction",
      stroke: "#7f8896",
      tags: ["centerline"],
    }),
    datumLine({
      id: "exercise-354-blockout-angle-leg-b",
      name: "Angle construction leg B",
      from: [74, 166],
      to: [126, 132],
      layerId: "construction",
      stroke: "#7f8896",
      tags: ["centerline"],
    }),
  ] as const;
}

function createGuideSidecarObject(): Extract<CanvasObject, { kind: "guideSidecar" }> {
  return {
    id: "exercise-354-blockout-guide-sidecar",
    name: "Exercise 354 blockout guide records",
    kind: "guideSidecar",
    role: "guideSidecar",
    layerId: "guides",
    visible: false,
    locked: true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    guide: {
      kind: "canvasGuideSidecar",
      id: "exercise-354-blockout-guide",
      units: "mm",
      description:
        "M39g authored construction masks: global bounds/datums first, feature boxes second, final topology lowered manually.",
      regions: [globalBounds, ...featureBoxes].map((box) => ({
        id: box.id,
        kind: box.kind,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        description: `${box.label} (${box.role ?? "construction"})`,
      })),
      datums: [
        {
          id: "datum-horizontal-bore-slot",
          kind: "horizontal",
          y: 78,
          label: "Main horizontal datum through large bore and slot",
        },
        {
          id: "datum-vertical-bore",
          kind: "vertical",
          x: 74,
          label: "Main vertical datum through large bore",
        },
        { id: "datum-lower-extent", kind: "horizontal", y: 166, label: "Lower lobe extent" },
      ],
      dimensions: [
        { id: "guide-overall-100", kind: "linear", from: [74, 38], to: [203, 38], label: "100" },
        { id: "guide-slot-30", kind: "linear", from: [169, 68], to: [203, 68], label: "30" },
      ],
      alignmentMarks: [
        { id: "guide-bore-center", kind: "point", x: 74, y: 78, label: "bore center" },
        { id: "guide-left-small-hole", kind: "point", x: 86, y: 144, label: "small hole" },
        { id: "guide-right-small-hole", kind: "point", x: 126, y: 132, label: "small hole" },
      ],
    },
  };
}

function createExercise354BlockoutSidecar(): CanvasBlockoutSidecar {
  return {
    kind: "canvasBlockoutSidecar",
    id: "exercise-354-feature-blockout",
    name: "Exercise 354 feature blockout",
    description: "Green feature/component blockout mask",
    boxes: featureBoxes.map((box) => ({
      id: box.id,
      kind: box.kind,
      role: box.role,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      label: box.label,
    })),
    points: [
      { id: "boss-center", kind: "center", x: 74, y: 78, label: "Boss center" },
      { id: "left-small-hole-center", kind: "center", x: 86, y: 144, label: "Left hole" },
      { id: "right-small-hole-center", kind: "center", x: 126, y: 132, label: "Right hole" },
    ],
    curves: [
      {
        id: "lower-sweep-cue",
        kind: "arcCue",
        points: [
          [75, 152],
          [96, 149],
          [124, 139],
          [151, 114],
        ],
        role: "construction",
        label: "Lower sweep",
      },
    ],
  };
}

function createBlockoutSidecarObject(
  targetObjectId?: string,
): Extract<CanvasObject, { kind: "blockoutSidecar" }> {
  return {
    id: "exercise-354-blockout-sidecar",
    name: "exercise-354.blockout.toml",
    kind: "blockoutSidecar",
    role: "blockoutSidecar",
    layerId: "guides",
    visible: true,
    opacity: 0.65,
    showLabels: true,
    locked: true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    targetObjectId,
    blockout: createExercise354BlockoutSidecar(),
  };
}

function createMechanicalSidecar(title: string) {
  const layout = getMechanicalA4LandscapeLayout();
  const sheet = {
    ...createDefaultMechanicalSheetMetadata(),
    scale: "Fit to A4",
    drawingNumber: "M39G-354",
    title,
    revision: "G",
  };
  const annotations = createMechanicalAnnotationSet({
    id: "exercise-354-blockout-annotations",
    units: "mm",
    scale: sheet.scale,
    sheet,
    dimensions: [
      {
        id: "blockout-overall-top-100",
        kind: "linear",
        axis: "horizontal",
        from: [74, 38],
        to: [203, 38],
        offset: 22,
        label: "100",
      },
      {
        id: "blockout-slot-length-30",
        kind: "linear",
        axis: "horizontal",
        from: [169, 68],
        to: [203, 68],
        offset: 17,
        label: "30",
      },
      {
        id: "blockout-left-height-62",
        kind: "linear",
        axis: "vertical",
        from: [35, 78],
        to: [63, 144],
        offset: -20,
        label: "62",
        labelOffset: -2,
      },
      {
        id: "blockout-angle-35",
        kind: "angle",
        center: [74, 166],
        from: [74, 151],
        to: [126, 132],
        label: "35°",
        radius: 42,
        labelOffset: 10,
      },
      {
        id: "blockout-boss-radius-32",
        kind: "radius",
        center: [74, 78],
        radius: 32,
        label: "R32",
        leaderAngle: -135,
        leaderLength: 16,
        labelOffset: [-3, -2],
      },
      {
        id: "blockout-inner-radius-20",
        kind: "radius",
        center: [74, 78],
        radius: 20,
        label: "R20",
        leaderAngle: 120,
        leaderLength: 10,
        labelOffset: [-3, 3],
      },
      {
        id: "blockout-right-radius-20",
        kind: "radius",
        center: [203, 78],
        radius: 20,
        label: "R20",
        leaderAngle: -48,
        leaderLength: 13,
        labelOffset: [3, -1],
      },
      {
        id: "blockout-slot-radius-10",
        kind: "radius",
        center: [203, 78],
        radius: 10,
        label: "R10",
        leaderAngle: 45,
        leaderLength: 14,
        labelOffset: [3, 4],
      },
      {
        id: "blockout-left-small-hole-radius-7",
        kind: "radius",
        center: [86, 144],
        radius: 7,
        label: "R7",
        leaderAngle: -75,
        leaderLength: 17,
        labelOffset: [2, -2],
      },
      {
        id: "blockout-right-small-hole-radius-7",
        kind: "radius",
        center: [126, 132],
        radius: 7,
        label: "R7",
        leaderAngle: -80,
        leaderLength: 15,
        labelOffset: [2, -2],
      },
      {
        id: "blockout-inside-radius-15",
        kind: "radius",
        center: [170, 113],
        radius: 15,
        label: "R15",
        leaderAngle: -135,
        leaderLength: 12,
        labelOffset: [-3, -1],
      },
      {
        id: "blockout-bottom-radius-72",
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
      { id: "blockout-source-note", kind: "note", at: [218, 38], text: "2D EXERCISES" },
      { id: "blockout-exercise-number", kind: "note", at: [221, 52], text: "354" },
      { id: "blockout-method-note", kind: "note", at: [16, 188], text: "M39g blockout authored" },
    ],
    datums: [],
    blocks: [
      {
        id: "exercise-354-blockout-title-block",
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
  return createMechanicalAnnotationSidecarObject({
    id: "exercise-354-blockout-mechanical-annotations",
    name: "Exercise 354 blockout mechanical annotations",
    layerId: "annotations",
    visible: true,
    x: 0,
    y: 0,
    width: layout.widthMm,
    height: layout.heightMm,
    annotations,
  });
}

function createDocument(input: {
  readonly id: string;
  readonly name: string;
  readonly guideObjects: readonly CanvasObject[];
  readonly geometryObjects?: readonly CanvasObject[];
  readonly constructionObjects?: readonly CanvasObject[];
  readonly includeAnnotations?: boolean;
}): CanvasDocument {
  const layout = getMechanicalA4LandscapeLayout();
  const guideSidecar = createGuideSidecarObject();
  const annotations = input.includeAnnotations ? [createMechanicalSidecar(input.name)] : [];
  const blockoutSidecar =
    input.geometryObjects && input.geometryObjects.length > 0
      ? [createBlockoutSidecarObject(input.geometryObjects[0]?.id)]
      : [];
  const guideObjects = [...input.guideObjects, guideSidecar, ...blockoutSidecar];
  const geometryObjects = [...(input.geometryObjects ?? [])];
  const constructionObjects = [...(input.constructionObjects ?? [])];
  const objects = [...guideObjects, ...geometryObjects, ...constructionObjects, ...annotations];

  return {
    id: input.id,
    name: input.name,
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
        id: "guides",
        name: "Construction guides",
        visible: true,
        objectIds: guideObjects.map((object) => object.id),
      },
      {
        id: "geometry",
        name: "Part geometry",
        visible: geometryObjects.length > 0,
        objectIds: geometryObjects.map((object) => object.id),
      },
      {
        id: "construction",
        name: "Centerlines and construction",
        visible: constructionObjects.length > 0,
        objectIds: constructionObjects.map((object) => object.id),
      },
      {
        id: "annotations",
        name: "Mechanical Drafting",
        visible: annotations.length > 0,
        objectIds: annotations.map((object) => object.id),
      },
    ],
    layerGroups: [
      {
        id: "mechanical-exercise-354-blockout-dogfood",
        title: "Mechanical Exercise 354 Blockout Dogfood",
        description:
          "Global bounds and feature blockout guide masks lowered into filled body/void topology.",
        objectIds: objects.map((object) => object.id),
      },
    ],
    objects: Object.fromEntries(objects.map((object) => [object.id, object])),
    selectedObjectId: annotations[0]?.id ?? guideObjects[0]?.id,
  };
}

export function createMechanicalExercise354BlockoutGlobalScene(): CanvasDocument {
  return createDocument({
    id: "mechanical-exercise-354-blockout-global",
    name: "Exercise 354 Global Bounding Mask",
    guideObjects: createGlobalGuideObjects(),
  });
}

export function createMechanicalExercise354BlockoutFeatureScene(): CanvasDocument {
  return createDocument({
    id: "mechanical-exercise-354-blockout-features",
    name: "Exercise 354 Feature Blockout Mask",
    guideObjects: [...createGlobalGuideObjects(), ...createFeatureGuideObjects()],
  });
}

export function createMechanicalExercise354BlockoutScene(): CanvasDocument {
  return createDocument({
    id: "mechanical-exercise-354-blockout",
    name: "2D Exercise 354 Blockout",
    guideObjects: [...createGlobalGuideObjects(), ...createFeatureGuideObjects()],
    geometryObjects: createFinalGeometryObjects(),
    constructionObjects: createConstructionObjects(),
    includeAnnotations: true,
  });
}

export function createMechanicalExercise354BlockoutProcessNotes(): string {
  return `# Exercise 354 Blockout Process Notes

## What I tried

I retried Exercise 354 as a staged authoring pass instead of starting with the final contour. First I placed a red global bounding box and datums, then green feature blockout boxes for the boss, large hole, right arm, slot, lower body region, two small holes, and an inside relief cue. Only after those masks existed did I lower the boxes into a blue filled body profile with even-odd voids and semantic mechanical annotations.

## What the global mask clarified

The global bounding box helped because it gave the drawing a fixed envelope before I touched curves. The horizontal datum through the large bore and slot was the most useful line: it prevented the right arm and slot from drifting vertically. The vertical datum through the large bore gave the left boss a stable center, and the lower extent datum kept the lower lobe from becoming a loose freehand sweep.

## What the feature blockout clarified

Feature boxes helped more than I expected. The boss, large hole, right arm, slot, and two small-hole boxes made the important proportions visible as rectangles before any rounded geometry appeared. The slot fits inside its box, the holes fit their boxes, and the right arm respects its blockout. The lower lobe box was less exact, but it still made the lower body region feel planned instead of pasted on.

## How I lowered boxes into geometry

I lowered the large-hole and small-hole boxes into circular void paths. I lowered the slot box into an obround path by using the box height as the end radius. The right-arm box became a horizontal arm with a rounded right end. The large boss box guided the left circular mass, while the lower-lobe box and lower construction arc cue guided the bottom sweep. The lower arc cue, right-arm end, neck transition cue, slot caps, and circular voids now come from reusable local arc helpers and then lower into ordinary path geometry. The final material is one filled path with \`fillRule: "evenodd"\`, so the body and void topology are inspected before the dimension text.

## Where the method helped

The method reduced composition mistakes. In the previous freehand-ish pass, the final curve carried too much responsibility and the slot placement could collapse into a questionable wall thickness. With global datums and feature boxes, the bore, slot, right arm, and small holes stayed aligned. Filled topology also helped because the blue body immediately shows what is material and what is void.

## Where I still guessed

I still guessed tangent continuity around the neck between the boss and right arm, the exact radius centers for the lower outer sweep, and the concave transition near the right underside. The blockout tells me where the regions belong, but it does not solve exact tangency, radius construction, or the exercise's original drafting intent.

Manual judgement was still needed anywhere the reference implied tangency or a radius center without giving me a clean construction box.

## What MachinaCanvas should formalize later

MachinaCanvas should formalize guide and blockout sidecars instead of relying on generic path boxes plus notes. The useful primitives are not a CAD kernel; they are authoring scaffolds: global bounds, named datums, feature boxes with roles, construction centers, and optional construction curves. Those records should remain visible, inspectable, and lowerable into existing scene geometry.

## Suggested future schema

\`\`\`ts
type CanvasGuideSidecar = {
  kind: "canvasGuideSidecar";
  regions: GuideRegion[];
  datums: GuideDatum[];
  dimensions: GuideDimension[];
  alignmentMarks: GuideAlignmentMark[];
};

type CanvasBlockoutSidecar = {
  kind: "canvasBlockoutSidecar";
  boxes: CanvasBlockoutBox[];
  points: CanvasBlockoutPoint[];
  curves: CanvasBlockoutCurve[];
};
\`\`\`

This schema should be non-solving at first. It should make the scaffolding explicit and let future tools lower guides into ordinary path, ellipse, and annotation records.

## Deferred gaps

This pass did not add automatic image-to-CAD extraction, computer vision, raster tracing, a CAD kernel, boolean solver, parametric sketch solver, DXF/DWG export, PDF export, hidden-line removal, arbitrary page sizes, plotter profiles, or drafting-layout optimization. Tangent continuity in the lower sweep and neck region remains approximate rather than solved. The final geometry remains approximate, but the construction trail is now represented in the scene data and staged SVG artifacts.
`;
}

function copyReferenceArtifacts() {
  for (const reference of uploadedReferences) {
    if (existsSync(reference.source)) {
      copyFileSync(reference.source, join(artifactsDir, reference.target));
    }
  }
  const existingReference = join(artifactsDir, "reference-mechanical-exercise-354.png");
  if (existsSync(existingReference)) {
    copyFileSync(
      existingReference,
      join(artifactsDir, "reference-mechanical-exercise-354-original.png"),
    );
  }
}

function formatJson(path: string) {
  const formatResult = spawnSync(process.execPath, [biomeBin, "format", "--write", path], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  if (formatResult.status !== 0) {
    const stderr = formatResult.stderr?.toString().trim();
    const message = formatResult.error?.message ?? stderr;
    throw new Error(message || `Biome could not format ${path}.`);
  }
}

function renderPreviewPng() {
  const previewResult = spawnSync(
    inkscapeBin,
    [
      MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.svg,
      "--export-type=png",
      `--export-filename=${MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.preview}`,
      "--export-width=1485",
      "--export-height=1050",
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
    throw new Error(
      message || "Inkscape could not rasterize the Exercise 354 blockout preview PNG.",
    );
  }
}

export function writeMechanicalExercise354BlockoutArtifacts(): readonly string[] {
  mkdirSync(artifactsDir, { recursive: true });
  copyReferenceArtifacts();

  const globalScene = createMechanicalExercise354BlockoutGlobalScene();
  const featureScene = createMechanicalExercise354BlockoutFeatureScene();
  const finalScene = createMechanicalExercise354BlockoutScene();
  const processNotes = createMechanicalExercise354BlockoutProcessNotes();

  writeFileSync(
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.globalSvg,
    serializeCanvasRenderSvg(globalScene),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.featuresSvg,
    serializeCanvasRenderSvg(featureScene),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.blockoutToml,
    stringifyBlockoutSidecarToml(createExercise354BlockoutSidecar()),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.scene,
    `${JSON.stringify(finalScene, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.svg,
    serializeCanvasRenderSvg(finalScene),
    "utf8",
  );
  writeFileSync(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.processNotes, processNotes, "utf8");

  formatJson(MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.scene);
  renderPreviewPng();

  return [
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.globalSvg,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.featuresSvg,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.blockoutToml,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.scene,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.svg,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.preview,
    MECHANICAL_EXERCISE_354_BLOCKOUT_ARTIFACT_PATHS.processNotes,
  ];
}

if (
  (process.argv[1] && resolve(process.argv[1]) === __filename) ||
  process.env.npm_lifecycle_event === "canvas:mechanical-exercise-354-blockout"
) {
  const outputs = writeMechanicalExercise354BlockoutArtifacts();
  console.log("Mechanical Exercise 354 blockout artifacts generated:");
  for (const output of outputs) {
    console.log(`- ${output}`);
  }
}
