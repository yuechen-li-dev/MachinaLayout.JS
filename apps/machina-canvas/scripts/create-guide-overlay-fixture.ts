import { deflateSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCanvasRenderSvg } from "../src/canvasExport";
import { createCanvasUnitSystem } from "../src/canvasUnits";
import {
  createGuideSidecarObject,
  parseGuideSidecarToml,
  stringifyGuideSidecarToml,
} from "../src/guideSidecar";
import { buildCanvasLayerTree } from "../src/layerTree";
import type { CanvasDocument, ImageObject } from "../src/sceneModel";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../../..");
const artifactsDir = join(repoRoot, "apps", "machina-canvas", "artifacts");
const inkscapeBin = "C:\\Program Files\\Inkscape\\bin\\inkscape.com";

export const GUIDE_OVERLAY_FIXTURE_IDS = {
  imageId: "guide-overlay-reference-image",
  guideId: "guide-overlay-fixture",
  layerId: "guide-overlay-fixture-layer",
} as const;

export const GUIDE_OVERLAY_FIXTURE_PATHS = {
  reference: join(artifactsDir, "guide-overlay-reference.png"),
  guideToml: join(artifactsDir, "guide-overlay-fixture.guide.toml"),
  scene: join(artifactsDir, "guide-overlay-fixture.mcanvas.json"),
  svg: join(artifactsDir, "guide-overlay-fixture.render.svg"),
  preview: join(artifactsDir, "guide-overlay-fixture.preview.png"),
  report: join(artifactsDir, "guide-overlay-fixture-report.md"),
  reviewHtml: join(artifactsDir, "guide-overlay-review.html"),
  liveReview: join(artifactsDir, "guide-overlay-live-review.png"),
} as const;

export const GUIDE_OVERLAY_FIXTURE_TOML = `[guide]
id = "guide-overlay-fixture"
target = "guide-overlay-reference-image"
units = "px"
description = "Deterministic M40d guide overlay verification fixture."

[[regions]]
id = "overall-bounds"
kind = "bounds"
x = 20
y = 20
width = 260
height = 160
description = "Overall bounds"

[regions.grid]
cell_width = 65
cell_height = 40
columns = 4
rows = 4

[[datums]]
id = "center-x"
kind = "vertical"
x = 150
label = "Center X"
region = "overall-bounds"

[[datums]]
id = "center-y"
kind = "horizontal"
y = 100
label = "Center Y"
region = "overall-bounds"

[[datums]]
id = "origin-point"
kind = "point"
x = 20
y = 20
label = "Origin point"
region = "overall-bounds"

[[dimensions]]
id = "width-260"
kind = "linear"
from = [20, 20]
to = [280, 20]
label = "260 px"
units = "px"
region = "overall-bounds"

[[alignment_marks]]
id = "origin-mark"
kind = "point"
target = "guide-overlay-reference-image"
x = 20
y = 20
label = "Origin"
region = "overall-bounds"
`;

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writeReferencePng(path: string): void {
  const width = 300;
  const height = 200;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = 1 + x * 4;
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      const grid = x % 50 === 0 || y % 50 === 0;
      const cross = x === 150 || y === 100;
      const tone = border ? 155 : cross ? 185 : grid ? 210 : 238;
      row[offset] = tone;
      row[offset + 1] = tone;
      row[offset + 2] = tone;
      row[offset + 3] = 255;
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

export function createGuideOverlayFixtureDocument(): CanvasDocument {
  const image: ImageObject = {
    id: GUIDE_OVERLAY_FIXTURE_IDS.imageId,
    name: "Guide overlay reference",
    kind: "image",
    layerId: GUIDE_OVERLAY_FIXTURE_IDS.layerId,
    visible: true,
    x: 40,
    y: 40,
    width: 600,
    height: 400,
    src: "guide-overlay-reference.png",
    intrinsicWidth: 300,
    intrinsicHeight: 200,
    fit: "fill",
  };
  const guideObject = {
    ...createGuideSidecarObject(image, parseGuideSidecarToml(GUIDE_OVERLAY_FIXTURE_TOML), {
      id: GUIDE_OVERLAY_FIXTURE_IDS.guideId,
      name: "guide-overlay-fixture.guide.toml",
      layerId: GUIDE_OVERLAY_FIXTURE_IDS.layerId,
    }),
    opacity: 0.82,
    showLabels: true,
  };

  return {
    id: "guide-overlay-fixture",
    name: "M40d Guide Overlay Fixture",
    width: 680,
    height: 480,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      {
        id: GUIDE_OVERLAY_FIXTURE_IDS.layerId,
        name: "Reference Image With Guide",
        visible: true,
        objectIds: [image.id, guideObject.id],
      },
    ],
    objects: {
      [image.id]: image,
      [guideObject.id]: guideObject,
    },
    selectedObjectId: guideObject.id,
  };
}

function createReviewHtml(document: CanvasDocument, renderSvg: string): string {
  const guide = document.objects[GUIDE_OVERLAY_FIXTURE_IDS.guideId];
  if (guide?.kind !== "guideSidecar") throw new Error("Guide fixture sidecar is missing.");
  const titledRenderSvg = renderSvg.replace(
    "<svg ",
    '<svg role="img" aria-label="Guide overlay fixture render" ',
  );
  const accessibleRenderSvg = titledRenderSvg.replace(
    ">",
    "><title>Guide overlay fixture render</title>",
  );
  const layerTree = buildCanvasLayerTree(document);
  const layerTreeJson = JSON.stringify(layerTree, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>M40d Guide Overlay Review</title>
  <style>
    body { margin: 0; font: 14px/1.4 Arial, sans-serif; color: #231f20; background: #f4f2ee; }
    .review { display: grid; grid-template-columns: 280px 1fr 280px; min-height: 100vh; }
    aside { padding: 18px; background: #ffffff; border-right: 1px solid #d8d2ca; }
    aside:last-child { border-right: 0; border-left: 1px solid #d8d2ca; }
    h1, h2 { margin: 0 0 12px; }
    h1 { font-size: 18px; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
    .stage { display: grid; place-items: center; padding: 22px; }
    .sheet { background: white; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18); }
    .tree { font-size: 12px; white-space: pre-wrap; }
    .image-row { margin: 10px 0 0; padding: 10px; border: 1px solid #d8d2ca; }
    .guide-row { margin: 8px 0 0 18px; padding: 10px; border-left: 4px solid #e94d1a; background: #fff6f1; }
    dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 10px; margin: 0; }
    dt { font-weight: 700; }
    dd { margin: 0; }
  </style>
</head>
<body>
  <main class="review">
    <aside>
      <h1>M40d guide overlay</h1>
      <h2>Layer tree</h2>
      <div class="image-row">IMG guide-overlay-reference.png</div>
      <div class="guide-row">GUIDE guide-overlay-fixture.guide.toml<br />Construction mask · visible · 1 regions · 3 datums · 1 dimensions · 1 marks</div>
      <h2 style="margin-top: 18px;">Structural tree</h2>
      <div class="tree">${layerTreeJson}</div>
    </aside>
    <section class="stage">
      <div class="sheet">${accessibleRenderSvg}</div>
    </section>
    <aside>
      <h2>Inspector</h2>
      <dl>
        <dt>Attached owner</dt><dd>${GUIDE_OVERLAY_FIXTURE_IDS.imageId}</dd>
        <dt>Guide id</dt><dd>${GUIDE_OVERLAY_FIXTURE_IDS.guideId}</dd>
        <dt>Visible</dt><dd>${guide.visible ? "yes" : "no"}</dd>
        <dt>Opacity</dt><dd>${guide.opacity ?? 0.9}</dd>
        <dt>Regions</dt><dd>${guide.guide.regions.length}</dd>
        <dt>Datums</dt><dd>${guide.guide.datums.length}</dd>
        <dt>Dimensions</dt><dd>${guide.guide.dimensions.length}</dd>
        <dt>Alignment marks</dt><dd>${guide.guide.alignmentMarks.length}</dd>
      </dl>
    </aside>
  </main>
</body>
</html>
`;
}

function createReport(document: CanvasDocument, renderSvg: string): string {
  const guide = document.objects[GUIDE_OVERLAY_FIXTURE_IDS.guideId];
  if (guide?.kind !== "guideSidecar") throw new Error("Guide fixture sidecar is missing.");
  const exportIncludesGuide = renderSvg.includes("canvas-guide-overlay");
  return `# M40d guide overlay fixture report

## Attachment

- Image id: \`${GUIDE_OVERLAY_FIXTURE_IDS.imageId}\`
- Guide sidecar id: \`${GUIDE_OVERLAY_FIXTURE_IDS.guideId}\`
- Attachment target id: \`${guide.targetId ?? "unattached"}\`

## Counts

- Regions: ${guide.guide.regions.length}
- Datums: ${guide.guide.datums.length}
- Dimensions: ${guide.guide.dimensions.length}
- Alignment marks: ${guide.guide.alignmentMarks.length}

## Export

- Export included guide overlay: ${exportIncludesGuide ? "yes" : "no"}
- Guide opacity: ${guide.opacity ?? 0.9}
- Coordinate behavior: guide coordinates are owner-image relative and scaled from image intrinsic pixels into the displayed image rectangle.

## Review artifacts

- Render SVG: \`apps/machina-canvas/artifacts/guide-overlay-fixture.render.svg\`
- Preview PNG: \`apps/machina-canvas/artifacts/guide-overlay-fixture.preview.png\`
- Browser review page: \`apps/machina-canvas/artifacts/guide-overlay-review.html\`
- Screenshot evidence target: \`apps/machina-canvas/artifacts/guide-overlay-live-review.png\`
`;
}

function rasterizePreview(): void {
  if (!existsSync(inkscapeBin)) return;
  const result = spawnSync(
    inkscapeBin,
    [
      GUIDE_OVERLAY_FIXTURE_PATHS.svg,
      "--export-type=png",
      `--export-filename=${GUIDE_OVERLAY_FIXTURE_PATHS.preview}`,
      "--export-width=1360",
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    const message = result.error?.message ?? result.stderr?.trim();
    throw new Error(message || "Inkscape could not rasterize guide overlay preview PNG.");
  }
}

export function createGuideOverlayFixtureArtifacts(): CanvasDocument {
  mkdirSync(artifactsDir, { recursive: true });
  writeReferencePng(GUIDE_OVERLAY_FIXTURE_PATHS.reference);
  const document = createGuideOverlayFixtureDocument();
  const guide = document.objects[GUIDE_OVERLAY_FIXTURE_IDS.guideId];
  if (guide?.kind !== "guideSidecar") throw new Error("Guide fixture sidecar is missing.");
  const renderSvg = serializeCanvasRenderSvg(document);

  writeFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.guideToml, stringifyGuideSidecarToml(guide.guide));
  writeFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.scene, `${JSON.stringify(document, null, 2)}\n`);
  writeFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.svg, renderSvg);
  writeFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.report, createReport(document, renderSvg));
  writeFileSync(GUIDE_OVERLAY_FIXTURE_PATHS.reviewHtml, createReviewHtml(document, renderSvg));
  rasterizePreview();
  if (!existsSync(GUIDE_OVERLAY_FIXTURE_PATHS.preview)) {
    writeReferencePng(GUIDE_OVERLAY_FIXTURE_PATHS.preview);
  }
  return document;
}

if (process.env.VITEST !== "true") {
  createGuideOverlayFixtureArtifacts();
  console.log(`Wrote ${GUIDE_OVERLAY_FIXTURE_PATHS.scene}`);
  console.log(`Wrote ${GUIDE_OVERLAY_FIXTURE_PATHS.svg}`);
  console.log(`Wrote ${GUIDE_OVERLAY_FIXTURE_PATHS.preview}`);
  console.log(`Wrote ${GUIDE_OVERLAY_FIXTURE_PATHS.report}`);
}
