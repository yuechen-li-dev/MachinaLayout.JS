import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createArcFromCenterRadius, createArcFromThreePoints } from "../src/arcGeometry";
import { stringifyBlockoutSidecarToml, type CanvasBlockoutSidecar } from "../src/blockoutSidecar";
import { serializeCanvasRenderSvg } from "../src/canvasExport";
import { createCanvasUnitSystem } from "../src/canvasUnits";
import { stringifyGuideSidecarToml, type CanvasGuideSidecar } from "../src/guideSidecar";
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

const slug = "mechanical-exercise-m40c";
const referenceSource =
  "C:\\Users\\yuech\\AppData\\Local\\Temp\\codex-clipboard-eeeeadee-1c9b-4382-8bb8-b73e0069b5c9.png";

export const MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS = {
  reference: join(artifactsDir, "reference-mechanical-exercise-m40c.png"),
  guideSvg: join(artifactsDir, "mechanical-exercise-m40c-guide.render.svg"),
  blockoutSvg: join(artifactsDir, "mechanical-exercise-m40c-blockout.render.svg"),
  guideToml: join(artifactsDir, "mechanical-exercise-m40c.guide.toml"),
  blockoutToml: join(artifactsDir, "mechanical-exercise-m40c.blockout.toml"),
  scene: join(artifactsDir, "mechanical-exercise-m40c.mcanvas.json"),
  svg: join(artifactsDir, "mechanical-exercise-m40c.render.svg"),
  preview: join(artifactsDir, "mechanical-exercise-m40c.preview.png"),
  report: join(artifactsDir, "mechanical-exercise-m40c.dogfood-report.md"),
  processNotes: join(artifactsDir, "mechanical-exercise-m40c.process-notes.md"),
} as const;

type RegionBox = {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly role?: "solid" | "void" | "construction";
};

const centers = {
  top: [96, 32] as const,
  main: [96, 108] as const,
  right: [144, 92] as const,
  slot: [115, 166] as const,
};

const radii = {
  topOuter: 18,
  topInner: 9,
  mainOuter: 26,
  mainInner: 16,
  rightHole: 9,
  slotEnd: 12,
};

const guideRegions = [
  {
    id: "m40c-guide-overall-bounds",
    label: "overall body bounds",
    kind: "bodyEnvelope",
    x: 50,
    y: 14,
    width: 126,
    height: 176,
    role: "construction",
  },
  {
    id: "m40c-guide-top-head-region",
    label: "top head region",
    kind: "headRegion",
    x: 72,
    y: 14,
    width: 48,
    height: 38,
    role: "construction",
  },
  {
    id: "m40c-guide-center-boss-region",
    label: "center boss region",
    kind: "bossRegion",
    x: 66,
    y: 80,
    width: 60,
    height: 56,
    role: "construction",
  },
  {
    id: "m40c-guide-right-boss-region",
    label: "right boss region",
    kind: "bossRegion",
    x: 126,
    y: 70,
    width: 40,
    height: 44,
    role: "construction",
  },
  {
    id: "m40c-guide-slot-region",
    label: "lower slot region",
    kind: "slotRegion",
    x: 76,
    y: 144,
    width: 82,
    height: 44,
    role: "construction",
  },
] as const satisfies readonly RegionBox[];

const blockoutBoxes = [
  {
    id: "m40c-blockout-top-head",
    label: "top head blockout",
    kind: "bodyRegion",
    x: 72,
    y: 14,
    width: 48,
    height: 38,
    role: "solid",
  },
  {
    id: "m40c-blockout-top-hole",
    label: "top hole blockout",
    kind: "hole",
    x: 87,
    y: 23,
    width: 18,
    height: 18,
    role: "void",
  },
  {
    id: "m40c-blockout-main-boss",
    label: "main boss blockout",
    kind: "boss",
    x: 70,
    y: 82,
    width: 52,
    height: 52,
    role: "solid",
  },
  {
    id: "m40c-blockout-main-hole",
    label: "main hole blockout",
    kind: "hole",
    x: 80,
    y: 92,
    width: 32,
    height: 32,
    role: "void",
  },
  {
    id: "m40c-blockout-right-boss",
    label: "right boss blockout",
    kind: "boss",
    x: 126,
    y: 74,
    width: 36,
    height: 36,
    role: "solid",
  },
  {
    id: "m40c-blockout-right-hole",
    label: "right hole blockout",
    kind: "hole",
    x: 135,
    y: 83,
    width: 18,
    height: 18,
    role: "void",
  },
  {
    id: "m40c-blockout-lower-slot",
    label: "lower slot blockout",
    kind: "slot",
    x: 78,
    y: 146,
    width: 76,
    height: 40,
    role: "void",
  },
  {
    id: "m40c-blockout-lower-body",
    label: "lower outer profile blockout",
    kind: "bodyRegion",
    x: 56,
    y: 126,
    width: 118,
    height: 64,
    role: "solid",
  },
  {
    id: "m40c-blockout-right-neck",
    label: "right neck transition",
    kind: "transition",
    x: 120,
    y: 44,
    width: 48,
    height: 38,
    role: "construction",
  },
] as const satisfies readonly RegionBox[];

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

function deg(value: number) {
  return (value * 180) / Math.PI;
}

function rotatePoint(
  point: readonly [number, number],
  center: readonly [number, number],
  angleDeg: number,
): readonly [number, number] {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

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

function rectPath(box: RegionBox): string {
  return `M ${box.x} ${box.y} H ${box.x + box.width} V ${box.y + box.height} H ${box.x} Z`;
}

function guideBox(box: RegionBox, stroke: string) {
  return pathObject({
    id: box.id,
    name: box.label,
    d: rectPath(box),
    layerId: "guides",
    fill: "transparent",
    stroke,
    strokeWidth: 0.45,
    tags: ["construction-mask", box.kind, box.role ?? "construction"],
    notes: `${box.label} lowered from authored guide/blockout rectangles.`,
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
    stroke: input.stroke ?? "#ef5340",
    strokeWidth: 0.28,
    strokeDasharray: "8 4 2 4",
    tags: input.tags,
  });
}

function crosshair(
  id: string,
  name: string,
  center: readonly [number, number],
  size: number,
  stroke: string,
) {
  return pathObject({
    id,
    name,
    d: `M ${center[0] - size} ${center[1]} L ${center[0] + size} ${center[1]} M ${center[0]} ${center[1] - size} L ${center[0]} ${center[1] + size}`,
    layerId: "guides",
    fill: "transparent",
    stroke,
    strokeWidth: 0.3,
    tags: ["center-mark"],
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

function createObroundPath(input: {
  readonly center: readonly [number, number];
  readonly length: number;
  readonly radius: number;
  readonly angleDeg: number;
}): string {
  const angleRad = (input.angleDeg * Math.PI) / 180;
  const axis: readonly [number, number] = [Math.cos(angleRad), Math.sin(angleRad)];
  const normal: readonly [number, number] = [-axis[1], axis[0]];
  const capOffset = input.length / 2 - input.radius;
  const leftCenter: readonly [number, number] = [
    input.center[0] - axis[0] * capOffset,
    input.center[1] - axis[1] * capOffset,
  ];
  const rightCenter: readonly [number, number] = [
    input.center[0] + axis[0] * capOffset,
    input.center[1] + axis[1] * capOffset,
  ];
  const leftTop: readonly [number, number] = [
    leftCenter[0] + normal[0] * input.radius,
    leftCenter[1] + normal[1] * input.radius,
  ];
  const rightTop: readonly [number, number] = [
    rightCenter[0] + normal[0] * input.radius,
    rightCenter[1] + normal[1] * input.radius,
  ];
  const rightBottom: readonly [number, number] = [
    rightCenter[0] - normal[0] * input.radius,
    rightCenter[1] - normal[1] * input.radius,
  ];
  const leftBottom: readonly [number, number] = [
    leftCenter[0] - normal[0] * input.radius,
    leftCenter[1] - normal[1] * input.radius,
  ];
  const rightArc = createArcFromCenterRadius({
    center: rightCenter,
    radius: input.radius,
    startAngleDeg: deg(Math.atan2(rightTop[1] - rightCenter[1], rightTop[0] - rightCenter[0])),
    endAngleDeg: deg(Math.atan2(rightBottom[1] - rightCenter[1], rightBottom[0] - rightCenter[0])),
    sweep: "clockwise",
  });
  const leftArc = createArcFromCenterRadius({
    center: leftCenter,
    radius: input.radius,
    startAngleDeg: deg(Math.atan2(leftBottom[1] - leftCenter[1], leftBottom[0] - leftCenter[0])),
    endAngleDeg: deg(Math.atan2(leftTop[1] - leftCenter[1], leftTop[0] - leftCenter[0])),
    sweep: "clockwise",
  });
  if (rightArc.kind !== "ok" || leftArc.kind !== "ok") {
    throw new Error(rightArc.error ?? leftArc.error ?? "Failed to create obround path.");
  }
  return `M ${leftTop[0]} ${leftTop[1]} L ${rightTop[0]} ${rightTop[1]} ${arcSegment(requireArcPath(rightArc.path))} L ${leftBottom[0]} ${leftBottom[1]} ${arcSegment(requireArcPath(leftArc.path))} Z`;
}

const topGuideArc = createArcFromCenterRadius({
  center: centers.top,
  radius: radii.topOuter,
  startAngleDeg: 180,
  endAngleDeg: 0,
  sweep: "clockwise",
});
const lowerGuideArc = createArcFromThreePoints({
  start: [72, 180],
  through: [113, 188],
  end: [164, 167],
});
if (topGuideArc.kind !== "ok" || lowerGuideArc.kind !== "ok") {
  throw new Error(topGuideArc.error ?? lowerGuideArc.error ?? "M40c guide arc generation failed.");
}

const slotVoidPath = createObroundPath({
  center: centers.slot,
  length: 72,
  radius: radii.slotEnd,
  angleDeg: -20,
});

const topHoleVoidPath = createClosedCirclePath(centers.top[0], centers.top[1], radii.topInner);
const mainHoleVoidPath = createClosedCirclePath(centers.main[0], centers.main[1], radii.mainInner);
const rightHoleVoidPath = createClosedCirclePath(
  centers.right[0],
  centers.right[1],
  radii.rightHole,
);

const outerProfilePath = [
  `M ${centers.top[0] - radii.topOuter} ${centers.top[1]}`,
  arcSegment(requireArcPath(topGuideArc.path)),
  "C 114 44 120 58 122 72",
  "C 126 82 138 90 154 96",
  "C 167 100 168 115 156 125",
  "C 144 135 146 149 160 164",
  "C 168 172 166 183 154 186",
  "C 133 191 104 192 81 186",
  "C 64 181 58 169 63 156",
  "C 69 141 66 129 57 120",
  "C 49 111 48 98 54 86",
  "C 59 74 60 60 63 47",
  "C 66 36 72 32 78 32",
  "Z",
].join(" ");

function createGuideObjects() {
  return [
    ...guideRegions.map((box) => guideBox(box, "#ef5340")),
    datumLine({
      id: "m40c-guide-vertical-centerline",
      name: "Main vertical centerline",
      from: [centers.main[0], 10],
      to: [centers.main[0], 194],
      tags: ["datum", "centerline"],
    }),
    datumLine({
      id: "m40c-guide-main-horizontal",
      name: "Main bore horizontal datum",
      from: [34, centers.main[1]],
      to: [182, centers.main[1]],
      tags: ["datum"],
    }),
    datumLine({
      id: "m40c-guide-top-horizontal",
      name: "Top head datum",
      from: [56, centers.top[1]],
      to: [136, centers.top[1]],
      tags: ["datum"],
    }),
    datumLine({
      id: "m40c-guide-right-horizontal",
      name: "Right boss horizontal datum",
      from: [96, centers.right[1]],
      to: [172, centers.right[1]],
      tags: ["datum"],
    }),
    datumLine({
      id: "m40c-guide-slot-axis",
      name: "Slot center axis",
      from: rotatePoint([centers.slot[0] - 42, centers.slot[1]], centers.slot, -20),
      to: rotatePoint([centers.slot[0] + 42, centers.slot[1]], centers.slot, -20),
      tags: ["datum", "slot-axis"],
    }),
    pathObject({
      id: "m40c-guide-top-arc-cue",
      name: "Top head arc cue",
      d: requireArcPath(topGuideArc.path),
      layerId: "guides",
      fill: "transparent",
      stroke: "#ef5340",
      strokeWidth: 0.4,
      tags: ["guide-arc", "arc-cue"],
    }),
    pathObject({
      id: "m40c-guide-lower-arc-cue",
      name: "Lower sweep arc cue",
      d: requireArcPath(lowerGuideArc.path, "Lower guide arc cue failed."),
      layerId: "guides",
      fill: "transparent",
      stroke: "#ef5340",
      strokeWidth: 0.4,
      tags: ["guide-arc", "arc-cue"],
    }),
    crosshair("m40c-guide-top-center", "Top center", centers.top, 4, "#ef5340"),
    crosshair("m40c-guide-main-center", "Main bore center", centers.main, 5, "#ef5340"),
    crosshair("m40c-guide-right-center", "Right hole center", centers.right, 4, "#ef5340"),
    crosshair("m40c-guide-slot-center", "Slot center", centers.slot, 4, "#ef5340"),
  ] as const;
}

function createBlockoutGuideObjects() {
  return [
    ...blockoutBoxes.map((box) => guideBox(box, "#00d92f")),
    crosshair("m40c-blockout-top-center", "Top center", centers.top, 4, "#00d92f"),
    crosshair("m40c-blockout-main-center", "Main center", centers.main, 5, "#00d92f"),
    crosshair("m40c-blockout-right-center", "Right center", centers.right, 4, "#00d92f"),
    pathObject({
      id: "m40c-blockout-right-shoulder-cue",
      name: "Right shoulder curve cue",
      d: requireArcPath(
        createArcFromThreePoints({
          start: [122, 71],
          through: [140, 80],
          end: [160, 92],
        }).path,
        "Right shoulder curve cue failed.",
      ),
      layerId: "guides",
      fill: "transparent",
      stroke: "#00d92f",
      strokeWidth: 0.4,
      tags: ["blockout-cue", "arc-cue"],
    }),
    pathObject({
      id: "m40c-blockout-waist-cue",
      name: "Lower waist curve cue",
      d: requireArcPath(
        createArcFromThreePoints({
          start: [149, 124],
          through: [140, 139],
          end: [156, 164],
        }).path,
        "Waist curve cue failed.",
      ),
      layerId: "guides",
      fill: "transparent",
      stroke: "#00d92f",
      strokeWidth: 0.4,
      tags: ["blockout-cue", "arc-cue"],
    }),
  ] as const;
}

function createGuideSpec(): CanvasGuideSidecar {
  return {
    kind: "canvasGuideSidecar",
    id: "m40c-guide",
    units: "mm",
    description:
      "M40c construction guide pass with bounding mask, datums, feature centers, arc cues, and authoring dimensions before final drafting.",
    regions: guideRegions.map((region) => ({
      id: region.id,
      kind: region.kind,
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
      description: region.label,
    })),
    datums: [
      { id: "datum-vertical-centerline", kind: "vertical", x: centers.main[0], label: "Main CL" },
      {
        id: "datum-main-horizontal",
        kind: "horizontal",
        y: centers.main[1],
        label: "Main bore datum",
      },
      { id: "datum-top-horizontal", kind: "horizontal", y: centers.top[1], label: "Top datum" },
      {
        id: "datum-right-horizontal",
        kind: "horizontal",
        y: centers.right[1],
        label: "Right boss datum",
      },
      { id: "datum-top-center", kind: "point", x: centers.top[0], y: centers.top[1], label: "Top" },
      {
        id: "datum-main-center",
        kind: "point",
        x: centers.main[0],
        y: centers.main[1],
        label: "Main",
      },
      {
        id: "datum-right-center",
        kind: "point",
        x: centers.right[0],
        y: centers.right[1],
        label: "Right",
      },
      {
        id: "datum-slot-center",
        kind: "point",
        x: centers.slot[0],
        y: centers.slot[1],
        label: "Slot",
      },
    ],
    dimensions: [
      {
        id: "guide-vertical-176",
        kind: "linear",
        from: centers.top,
        to: centers.main,
        label: "176",
      },
      {
        id: "guide-vertical-120",
        kind: "linear",
        from: centers.main,
        to: centers.slot,
        label: "120",
      },
      {
        id: "guide-horizontal-96",
        kind: "linear",
        from: centers.main,
        to: [centers.right[0], centers.main[1]],
        label: "96",
      },
      {
        id: "guide-vertical-38",
        kind: "linear",
        from: [centers.right[0], centers.main[1]],
        to: centers.right,
        label: "38",
      },
      { id: "guide-main-outer", kind: "diameter", center: centers.main, label: "Ø88" },
      { id: "guide-main-inner", kind: "diameter", center: centers.main, label: "Ø56" },
    ],
    alignmentMarks: [
      { id: "mark-top", kind: "point", x: centers.top[0], y: centers.top[1], label: "Top center" },
      {
        id: "mark-main",
        kind: "point",
        x: centers.main[0],
        y: centers.main[1],
        label: "Main center",
      },
      {
        id: "mark-right",
        kind: "point",
        x: centers.right[0],
        y: centers.right[1],
        label: "Right center",
      },
      {
        id: "mark-slot",
        kind: "point",
        x: centers.slot[0],
        y: centers.slot[1],
        label: "Slot center",
      },
    ],
  };
}

function createBlockoutSpec(): CanvasBlockoutSidecar {
  return {
    kind: "canvasBlockoutSidecar",
    id: "m40c-blockout",
    name: "M40c feature blockout",
    description:
      "Green feature decomposition for top head, main boss, right boss, lower slot, lower body, and local transition cues.",
    boxes: blockoutBoxes.map((box) => ({
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
      { id: "top-center", kind: "center", x: centers.top[0], y: centers.top[1], label: "Top" },
      { id: "main-center", kind: "center", x: centers.main[0], y: centers.main[1], label: "Main" },
      {
        id: "right-center",
        kind: "center",
        x: centers.right[0],
        y: centers.right[1],
        label: "Right",
      },
      { id: "slot-center", kind: "center", x: centers.slot[0], y: centers.slot[1], label: "Slot" },
    ],
    curves: [
      {
        id: "top-cap-cue",
        kind: "arcCue",
        points: [
          [78, 32],
          [96, 14],
          [114, 32],
        ],
        role: "construction",
        label: "Top cap cue",
      },
      {
        id: "right-shoulder-cue",
        kind: "arcCue",
        points: [
          [122, 71],
          [140, 80],
          [160, 92],
        ],
        role: "construction",
        label: "Right shoulder cue",
      },
      {
        id: "lower-sweep-cue",
        kind: "arcCue",
        points: [
          [72, 180],
          [113, 188],
          [164, 167],
        ],
        role: "construction",
        label: "Lower sweep cue",
      },
      {
        id: "slot-axis-cue",
        kind: "centerline",
        points: [
          rotatePoint([centers.slot[0] - 36, centers.slot[1]], centers.slot, -20),
          rotatePoint([centers.slot[0] + 36, centers.slot[1]], centers.slot, -20),
        ],
        role: "construction",
        label: "Slot axis cue",
      },
    ],
  };
}

function createGuideSidecarObject(): Extract<CanvasObject, { kind: "guideSidecar" }> {
  return {
    id: "m40c-guide-sidecar",
    name: "mechanical-exercise-m40c.guide.toml",
    kind: "guideSidecar",
    role: "guideSidecar",
    layerId: "guides",
    visible: false,
    locked: true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    guide: createGuideSpec(),
  };
}

function createBlockoutSidecarObject(
  targetObjectId?: string,
): Extract<CanvasObject, { kind: "blockoutSidecar" }> {
  return {
    id: "m40c-blockout-sidecar",
    name: "mechanical-exercise-m40c.blockout.toml",
    kind: "blockoutSidecar",
    role: "blockoutSidecar",
    layerId: "guides",
    visible: true,
    opacity: 0.6,
    showLabels: true,
    locked: true,
    x: 0,
    y: 0,
    width: 297,
    height: 210,
    targetObjectId,
    blockout: createBlockoutSpec(),
  };
}

function createFinalGeometryObjects() {
  const bodyProfile = pathObject({
    id: "m40c-filled-body-profile",
    name: "Filled M40c body profile with punched voids",
    d: [outerProfilePath, topHoleVoidPath, mainHoleVoidPath, rightHoleVoidPath, slotVoidPath].join(
      " ",
    ),
    fill: "#68bfe9",
    fillRule: "evenodd",
    stroke: "none",
    strokeWidth: 0,
    tags: ["mechanical-body-profile", "filled-profile"],
    notes:
      "Filled topology-first profile used as the primary material interpretation for the M40c dogfood pass.",
  });
  return [
    bodyProfile,
    pathObject({
      id: "m40c-outer-profile",
      name: "Approximate outer profile",
      d: outerProfilePath,
      fill: "transparent",
      tags: ["outer-profile"],
      notes:
        "Hand-authored outer profile lowered from guide and blockout constraints. Tangency remains approximate.",
    }),
    ellipseObject({
      id: "m40c-top-hole",
      name: "Top hole",
      cx: centers.top[0],
      cy: centers.top[1],
      diameter: radii.topInner * 2,
      tags: ["mechanical-void"],
    }),
    ellipseObject({
      id: "m40c-main-hole",
      name: "Main hole",
      cx: centers.main[0],
      cy: centers.main[1],
      diameter: radii.mainInner * 2,
      tags: ["mechanical-void"],
    }),
    ellipseObject({
      id: "m40c-right-hole",
      name: "Right hole",
      cx: centers.right[0],
      cy: centers.right[1],
      diameter: radii.rightHole * 2,
      tags: ["mechanical-void"],
    }),
    pathObject({
      id: "m40c-slot",
      name: "Angled obround slot",
      d: slotVoidPath,
      fill: "transparent",
      tags: ["mechanical-void"],
      notes: "Slot authored as a rotated obround path via arc helpers for both end caps.",
    }),
  ] as const;
}

function centerline(
  id: string,
  name: string,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  return datumLine({
    id,
    name,
    from,
    to,
    layerId: "construction",
    stroke: "#7f8896",
    tags: ["construction", "centerline"],
  });
}

function createConstructionObjects() {
  return [
    centerline(
      "m40c-main-centerline-y",
      "Main vertical centerline",
      [centers.main[0], 10],
      [centers.main[0], 194],
    ),
    centerline(
      "m40c-main-centerline-x",
      "Main horizontal centerline",
      [38, centers.main[1]],
      [182, centers.main[1]],
    ),
    centerline(
      "m40c-top-centerline-x",
      "Top head centerline",
      [70, centers.top[1]],
      [124, centers.top[1]],
    ),
    centerline(
      "m40c-right-centerline-x",
      "Right boss centerline",
      [126, centers.right[1]],
      [164, centers.right[1]],
    ),
    centerline(
      "m40c-right-centerline-y",
      "Right boss centerline",
      [centers.right[0], 72],
      [centers.right[0], 112],
    ),
    centerline(
      "m40c-slot-centerline",
      "Slot centerline",
      rotatePoint([centers.slot[0] - 42, centers.slot[1]], centers.slot, -20),
      rotatePoint([centers.slot[0] + 42, centers.slot[1]], centers.slot, -20),
    ),
    centerline(
      "m40c-angle-leg-a",
      "Bottom angle leg A",
      [centers.main[0], 194],
      [centers.main[0], 176],
    ),
    centerline("m40c-angle-leg-b", "Bottom angle leg B", [centers.main[0], 194], [159, 165]),
  ] as const;
}

function createMechanicalSidecarObject() {
  const layout = getMechanicalA4LandscapeLayout();
  const sheet = {
    ...createDefaultMechanicalSheetMetadata(),
    scale: "Fit to A4",
    drawingNumber: "M40C-DOG-01",
    title: "M40c Guide/Blockout Dogfood",
    revision: "C",
  };
  const annotations = createMechanicalAnnotationSet({
    id: "m40c-mechanical-annotations",
    units: "mm",
    scale: sheet.scale,
    sheet,
    dimensions: [
      {
        id: "m40c-dim-176",
        kind: "linear",
        axis: "vertical",
        from: centers.top,
        to: centers.main,
        offset: -44,
        label: "176",
      },
      {
        id: "m40c-dim-120",
        kind: "linear",
        axis: "vertical",
        from: centers.main,
        to: centers.slot,
        offset: -32,
        label: "120",
      },
      {
        id: "m40c-dim-96",
        kind: "linear",
        axis: "horizontal",
        from: centers.main,
        to: [centers.right[0], centers.main[1]],
        offset: -16,
        label: "96",
      },
      {
        id: "m40c-dim-38",
        kind: "linear",
        axis: "vertical",
        from: [centers.right[0], centers.main[1]],
        to: centers.right,
        offset: 10,
        label: "38",
      },
      {
        id: "m40c-dim-main-outer",
        kind: "diameter",
        center: centers.main,
        diameter: radii.mainOuter * 2,
        leaderAngle: 155,
        leaderLength: 18,
        label: "Ø88",
        labelOffset: [-2, -2],
      },
      {
        id: "m40c-dim-main-inner",
        kind: "diameter",
        center: centers.main,
        diameter: radii.mainInner * 2,
        leaderAngle: 32,
        leaderLength: 18,
        label: "Ø56",
        labelOffset: [2, -2],
      },
      {
        id: "m40c-dim-top-outer",
        kind: "radius",
        center: centers.top,
        radius: radii.topOuter,
        leaderAngle: -55,
        leaderLength: 18,
        label: "R44",
        labelOffset: [3, -2],
      },
      {
        id: "m40c-dim-top-inner",
        kind: "radius",
        center: centers.top,
        radius: radii.topInner,
        leaderAngle: -140,
        leaderLength: 18,
        label: "R23",
        labelOffset: [-3, -2],
      },
      {
        id: "m40c-dim-right-shoulder",
        kind: "radius",
        center: [118, 54],
        radius: 44,
        leaderAngle: -26,
        leaderLength: 24,
        label: "R88",
        labelOffset: [2, -2],
      },
      {
        id: "m40c-dim-right-boss",
        kind: "radius",
        center: centers.right,
        radius: 17,
        leaderAngle: -30,
        leaderLength: 18,
        label: "R40",
        labelOffset: [3, -2],
      },
      {
        id: "m40c-dim-waist",
        kind: "radius",
        center: [151, 126],
        radius: 10,
        leaderAngle: 28,
        leaderLength: 16,
        label: "R18",
        labelOffset: [2, 3],
      },
      {
        id: "m40c-dim-lower-sweep",
        kind: "radius",
        center: [122, 160],
        radius: 24,
        leaderAngle: -8,
        leaderLength: 24,
        label: "R44",
        labelOffset: [3, -1],
      },
      {
        id: "m40c-dim-slot-end",
        kind: "radius",
        center: rotatePoint([centers.slot[0] + 24, centers.slot[1]], centers.slot, -20),
        radius: radii.slotEnd,
        leaderAngle: 12,
        leaderLength: 20,
        label: "R22",
        labelOffset: [3, 0],
      },
      {
        id: "m40c-dim-angle",
        kind: "angle",
        center: [centers.main[0], 194],
        from: [centers.main[0], 176],
        to: [159, 165],
        radius: 24,
        label: "40°",
        labelOffset: 8,
      },
    ],
    notes: [
      {
        id: "m40c-note-source",
        kind: "note",
        at: [198, 24],
        text: "Source: single reference image",
      },
      {
        id: "m40c-note-workflow",
        kind: "note",
        at: [18, 188],
        text: "M40c guide/blockout dogfood",
      },
      {
        id: "m40c-note-approx",
        kind: "note",
        at: [18, 196],
        text: "Approximate tangent chain; topology-first fill",
      },
    ],
    datums: [],
    blocks: [
      {
        id: "m40c-title-block",
        kind: "titleBlock",
        x: 195,
        y: 166,
        width: 92,
        height: 34,
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
    id: "m40c-mechanical-sidecar",
    name: "M40c mechanical annotations",
    layerId: "annotations",
    visible: true,
    x: 0,
    y: 0,
    width: layout.widthMm,
    height: layout.heightMm,
    annotations,
  });
}

function createScene(input: {
  readonly id: string;
  readonly name: string;
  readonly guideObjects: readonly CanvasObject[];
  readonly geometryObjects?: readonly CanvasObject[];
  readonly constructionObjects?: readonly CanvasObject[];
  readonly includeGuideSidecar?: boolean;
  readonly includeBlockoutSidecar?: boolean;
  readonly includeAnnotations?: boolean;
  readonly guidesLayerVisible?: boolean;
}) {
  const layout = getMechanicalA4LandscapeLayout();
  const guideObjects = [...input.guideObjects];
  if (input.includeGuideSidecar) {
    guideObjects.push(createGuideSidecarObject());
  }
  if (input.includeBlockoutSidecar) {
    guideObjects.push(createBlockoutSidecarObject(input.geometryObjects?.[0]?.id));
  }
  const geometryObjects = [...(input.geometryObjects ?? [])];
  const constructionObjects = [...(input.constructionObjects ?? [])];
  const annotations = input.includeAnnotations ? [createMechanicalSidecarObject()] : [];
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
        name: "Guide and blockout",
        visible: input.guidesLayerVisible ?? true,
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
        name: "Construction",
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
        id: "m40c-dogfood",
        title: "M40c Mechanical Dogfood",
        description:
          "Fresh mechanical exercise authored with explicit guide, blockout, and filled drafting passes.",
        objectIds: objects.map((object) => object.id),
      },
    ],
    objects: Object.fromEntries(objects.map((object) => [object.id, object])),
    selectedObjectId: annotations[0]?.id ?? guideObjects[0]?.id,
  } satisfies CanvasDocument;
}

export function createMechanicalExerciseM40cGuideScene(): CanvasDocument {
  return createScene({
    id: `${slug}-guide`,
    name: "M40c guide pass",
    guideObjects: createGuideObjects(),
    includeGuideSidecar: true,
  });
}

export function createMechanicalExerciseM40cBlockoutScene(): CanvasDocument {
  return createScene({
    id: `${slug}-blockout`,
    name: "M40c blockout pass",
    guideObjects: [...createGuideObjects(), ...createBlockoutGuideObjects()],
    includeGuideSidecar: true,
    includeBlockoutSidecar: true,
  });
}

export function createMechanicalExerciseM40cScene(): CanvasDocument {
  return createScene({
    id: slug,
    name: "M40c guide/blockout dogfood",
    guideObjects: [...createGuideObjects(), ...createBlockoutGuideObjects()],
    geometryObjects: createFinalGeometryObjects(),
    constructionObjects: createConstructionObjects(),
    includeGuideSidecar: true,
    includeBlockoutSidecar: true,
    includeAnnotations: true,
    guidesLayerVisible: false,
  });
}

export function createMechanicalExerciseM40cProcessNotes(): string {
  return `# M40c Process Notes

## Guide decisions

I anchored the part around one main vertical centerline, one large-bore horizontal datum, one top-head datum, and one right-boss datum. The guide regions are deliberately simple rectangles because the current guide schema is stronger for bounds and centers than for curved construction intent.

## Blockout decisions

I decomposed the part into top head, top hole, main boss, main hole, right boss, right hole, lower slot, lower outer body, and right neck transition boxes. The slot and lower sweep each keep their own curve cues because plain rectangles alone were not enough to preserve the visible rhythm of the source image.

## Assumptions

- The reference image was treated as visually authoritative but not metrically exact.
- The final profile was fit to the A4 dogfood sheet instead of preserving a strict 1:1 scale.
- The lower sweep, right waist, and top-to-right neck are approximate tangent chains rather than solved arcs.
- Filled topology was preferred over a line-only outline because it made hole and slot ownership much clearer during drafting.
`;
}

export function createMechanicalExerciseM40cDogfoodReport(): string {
  return `# M40c Mechanical Dogfood Report

## 1. What I inferred from the source image

The source reads as a vertically organized plate with four dominant feature groups: a small top head with a hole, a larger central boss and bore, a right-side boss and hole offset horizontally from the main center, and a lower angled obround slot inside a broader lower lobe. The right side is the least certain area because several labeled radii imply a tangent chain, but the raster image does not make those radius centers explicit. I therefore treated the radii as drafting intent cues instead of exact solved geometry.

## 2. How I constructed the guide layer

The guide pass starts with a red overall envelope, then adds major datum lines: main vertical centerline, main bore horizontal datum, top head datum, right boss datum, and the slot axis. I added point centers for the top hole, main bore, right hole, and slot center so the later blockout and annotation passes had explicit anchors. I also added a top arc cue and a lower sweep arc cue because the current guide schema handles rectangular regions and datum records cleanly, but curved construction still feels easier to express as lowered helper paths than as first-class guide entries.

Guide authoring felt awkward in two places. First, there is no dedicated curved-guide primitive in \`*.guide.toml\`, so I had to split the guide truth between sidecar records and ordinary path objects. Second, guide dimensions are semantically useful but placement-light, which means the authored guide data is good for machine-readable construction intent and weaker for direct visual review.

## 3. How I decomposed the part into blockouts

The blockout pass uses green feature boxes for the top head, top hole, main boss, main hole, right boss, right hole, lower slot, lower outer body, and a right-neck transition region. I kept the slot as its own void box rather than letting it hide inside the lower body blockout because that made the negative-space topology much easier to reason about. I added arc cues for the top cap, right shoulder, and lower sweep, plus a centerline cue for the slot axis.

Blockout authoring was more natural than guide authoring for this exercise, but it still had friction. The box schema works well for decomposition, yet local curve intent quickly spills beyond what a box can say. Arc helpers were sufficient for top-cap, slot-cap, and local shoulder cues, but they were not sufficient to declare an entire tangent chain in one place. Tangency and radius-center helpers were enough for local experimentation and not enough for a confident multi-radius contour authoring workflow.

## 4. Where fill helped clarify topology

The filled profile made the exercise substantially easier to read. Once the body was one blue even-odd profile, the top hole, main bore, right hole, and slot read immediately as voids instead of competing outline loops. That was especially helpful around the lower slot, where the material wall thickness is easier to judge in filled form than in line-only form.

Filled profile authoring felt mostly natural. The main friction was not the fill itself; it was keeping one approximate outer profile path believable while also preserving explicit outline geometry for annotations and inspection.

## 5. What went well with the current tools

The new workflow is materially better than the older direct-to-final pass. \`*.guide.toml\` and \`*.blockout.toml\` make the construction story visible. Filled body authoring is now the right default for mechanical dogfood because it clarifies topology immediately. Arc helpers are useful for circles, obround slot caps, and local cue arcs. Keeping annotations as semantic mechanical sidecars still works well once the geometry is in place.

## 6. What gaps and frictions remain

- Guide authoring is still awkward for curved construction because curve cues live more comfortably as ordinary paths than as first-class guide-sidecar records.
- Blockout authoring is still awkward for tangent-heavy profiles because boxes and a few arc cues do not express continuity intent very richly.
- Arc helpers are useful but still local. They help author pieces of the contour, not the whole chain.
- Tangency and radius-center helpers are not yet strong enough to feel like a coherent contour-authoring surface for this kind of part.
- Annotation placement is still too manual. The labels are much better than before, but the pass still requires hand-tuning leader angles, lengths, and offsets.
- Export/view workflow is functional but clumsy. The SVG-plus-Inkscape-preview pipeline works, yet it is still a script-time workflow rather than an especially smooth review loop.
- I still had to fight the tool in the transition between semantic guide/blockout intent and the final approximate contour. The awkwardness is not in storing records; it is in lowering them into a believable tangent chain.

## 7. What should likely be implemented next in MachinaCanvas mechanical mode

The next useful step is not a full CAD kernel. It is a stronger authoring bridge between blockout intent and local contour construction:

- first-class curved guide cues in \`*.guide.toml\`
- richer blockout curve semantics for tangent-chain intent
- lightweight radius-center and tangency visual helpers that remain local and explicit
- better annotation auto-placement defaults and collision avoidance
- an easier review loop for guide-only, blockout-only, and final-filled views without bouncing through separate script outputs

## Assumptions

- The dogfood pass intentionally fit the part to the existing A4 landscape review sheet.
- Several labeled radii were treated as drafting cues, not exact solved geometry.
- The lower right waist and lower sweep remain approximate.
- No automatic image-to-CAD extraction, solver, DXF output, or generalized CAD kernel work was added here.
`;
}

function copyReferenceArtifact() {
  if (existsSync(referenceSource)) {
    copyFileSync(referenceSource, MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.reference);
  }
}

function formatJson(path: string) {
  const result = spawnSync(process.execPath, [biomeBin, "format", "--write", path], {
    cwd: repoRoot,
    stdio: "pipe",
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const message = result.error?.message ?? stderr;
    throw new Error(message || `Biome could not format ${path}.`);
  }
}

function renderPreviewPng() {
  const result = spawnSync(
    inkscapeBin,
    [
      MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.svg,
      "--export-type=png",
      `--export-filename=${MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.preview}`,
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
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim();
    const message = result.error?.message ?? stderr;
    throw new Error(message || "Inkscape could not rasterize the M40c preview PNG.");
  }
}

export function writeMechanicalExerciseM40cArtifacts(): readonly string[] {
  mkdirSync(artifactsDir, { recursive: true });
  copyReferenceArtifact();

  const guideScene = createMechanicalExerciseM40cGuideScene();
  const blockoutScene = createMechanicalExerciseM40cBlockoutScene();
  const finalScene = createMechanicalExerciseM40cScene();

  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.guideSvg,
    serializeCanvasRenderSvg(guideScene),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.blockoutSvg,
    serializeCanvasRenderSvg(blockoutScene),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.guideToml,
    stringifyGuideSidecarToml(createGuideSpec()),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.blockoutToml,
    stringifyBlockoutSidecarToml(createBlockoutSpec()),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.scene,
    `${JSON.stringify(finalScene, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.svg,
    serializeCanvasRenderSvg(finalScene),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.report,
    createMechanicalExerciseM40cDogfoodReport(),
    "utf8",
  );
  writeFileSync(
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.processNotes,
    createMechanicalExerciseM40cProcessNotes(),
    "utf8",
  );

  formatJson(MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.scene);
  renderPreviewPng();

  return [
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.reference,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.guideSvg,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.blockoutSvg,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.guideToml,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.blockoutToml,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.scene,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.svg,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.preview,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.report,
    MECHANICAL_EXERCISE_M40C_ARTIFACT_PATHS.processNotes,
  ].filter((path) => existsSync(path));
}

if (
  (process.argv[1] && resolve(process.argv[1]) === __filename) ||
  process.env.npm_lifecycle_event === "canvas:mechanical-exercise-m40c"
) {
  const outputs = writeMechanicalExerciseM40cArtifacts();
  console.log("M40c mechanical dogfood artifacts generated:");
  for (const output of outputs) {
    console.log(`- ${output}`);
  }
}
