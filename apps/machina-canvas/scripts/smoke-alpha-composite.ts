import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCanvasRenderSvg } from "../src/canvasExport";
import { createCanvasUnitSystem } from "../src/canvasUnits";
import { createImageObjectFromAsset, type LoadedImageAsset } from "../src/imageAssets";
import {
  applyCanvasCommand,
  applyCanvasCommands,
  validateCanvasCommand,
  validateCanvasCommands,
  type CanvasCommand,
} from "../src/sceneCommands";
import type { CanvasDocument } from "../src/sceneModel";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const canvasRoot = join(scriptDir, "..");
const tmpRoot = join(canvasRoot, "tmp");
const outputRoot = join(tmpRoot, "alpha-smoke");
const rgbPath = join(outputRoot, "generated-potion-rgb.png");
const alphaPath = join(outputRoot, "generated-potion-alpha.png");
const svgPath = join(outputRoot, "render.svg");
const loweringHarnessPath = join(outputRoot, "lower.html");
const statusPath = join(outputRoot, "smoke-status.json");

function parsePngSize(bytes: Buffer): { width: number; height: number } {
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) {
    throw new Error("Expected a PNG image.");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

async function loadPngAsset(path: string, id: string, name: string): Promise<LoadedImageAsset> {
  const bytes = await readFile(path);
  const dimensions = parsePngSize(bytes);
  return {
    id,
    name,
    fileName: path.split(/[\\/]/).pop() ?? id,
    mimeType: "image/png",
    src: `data:image/png;base64,${bytes.toString("base64")}`,
    intrinsicWidth: dimensions.width,
    intrinsicHeight: dimensions.height,
  };
}

function createSmokeDocument(): CanvasDocument {
  return {
    id: "alpha-composite-smoke",
    name: "Alpha Composite Smoke",
    width: 1024,
    height: 1024,
    unit: "px",
    unitSystem: createCanvasUnitSystem("px"),
    layers: [
      {
        id: "main",
        name: "Main",
        visible: true,
        objectIds: [],
      },
    ],
    objects: {},
  };
}

function createLoweringHarness(svgText: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>MachinaCanvas alpha smoke lowering</title>
  </head>
  <body>
    <script>
      window.lowerMachinaSmoke = async function lowerMachinaSmoke() {
        const svgText = ${JSON.stringify(svgText)};
        const width = 1024;
        const height = 1024;
        const svgBlob = new Blob([svgText], { type: "image/svg+xml" });
        const url = URL.createObjectURL(svgBlob);
        try {
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error("SVG raster source could not be loaded."));
            image.src = url;
          });
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("2D canvas context is unavailable.");
          context.clearRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          const data = context.getImageData(0, 0, width, height).data;
          const alphaAt = (x, y) => data[(y * width + x) * 4 + 3];
          let partialAlpha = null;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0 && data[i] < 255) {
              partialAlpha = data[i];
              break;
            }
          }
          return {
            dataUrl: canvas.toDataURL("image/png"),
            width,
            height,
            samples: {
              topLeft: alphaAt(0, 0),
              topRight: alphaAt(width - 1, 0),
              bottomLeft: alphaAt(0, height - 1),
              center: alphaAt(Math.floor(width / 2), Math.floor(height / 2)),
              partialAlpha,
            },
          };
        } finally {
          URL.revokeObjectURL(url);
        }
      };
    </script>
  </body>
</html>
`;
}

await mkdir(outputRoot, { recursive: true });

const rgbAsset = await loadPngAsset(rgbPath, "generated-potion-rgb", "Generated potion RGB");
const alphaAsset = await loadPngAsset(
  alphaPath,
  "generated-potion-alpha",
  "Generated potion alpha",
);

let documentModel = createSmokeDocument();
const rgbObject = createImageObjectFromAsset(rgbAsset, {
  id: "generated-potion-rgb",
  layerId: "main",
  role: "image",
  document: documentModel,
});
const alphaObject = createImageObjectFromAsset(alphaAsset, {
  id: "generated-potion-alpha",
  layerId: "main",
  role: "alphaMap",
  document: documentModel,
});

const commands: CanvasCommand[] = [
  { kind: "addImageObject", object: rgbObject },
  { kind: "addImageObject", object: alphaObject },
  { kind: "attachAlphaMap", sourceId: "generated-potion-rgb", alphaId: "generated-potion-alpha" },
];

let validationDocument = documentModel;
const diagnostics = [];
for (const [index, command] of commands.entries()) {
  const validation = validateCanvasCommand(validationDocument, command, index);
  diagnostics.push(...validation.diagnostics);
  if (validation.ok) {
    validationDocument = applyCanvasCommand(validationDocument, command).document;
  }
}
const validation = validateCanvasCommands(documentModel, commands.slice(0, 2));
diagnostics.push(...validation.diagnostics);
if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
  throw new Error(JSON.stringify(diagnostics, null, 2));
}

const applied = applyCanvasCommands(documentModel, commands);
documentModel = applied.document;

const svgText = serializeCanvasRenderSvg(documentModel);
await writeFile(svgPath, svgText, "utf8");
await writeFile(loweringHarnessPath, createLoweringHarness(svgText), "utf8");

const source = documentModel.objects["generated-potion-rgb"];
const alphaMapId = source.kind === "image" ? source.alphaMapId : undefined;
const status = {
  imageObjectLoaded: documentModel.objects["generated-potion-rgb"]?.kind === "image",
  alphaMapObjectLoaded: documentModel.objects["generated-potion-alpha"]?.kind === "image",
  alphaMapIdAttached: alphaMapId === "generated-potion-alpha",
  svgContainsMask: svgText.includes("<mask"),
  svgContainsAlphaImage: svgText.includes(alphaAsset.src.slice(0, 48)),
  svgContainsMaskReference: svgText.includes('mask="url(#mask-generated-potion-rgb)"'),
  commandMessages: applied.results.map((result) => result.message),
  paths: {
    rgb: rgbPath,
    alpha: alphaPath,
    svg: svgPath,
    loweringHarness: loweringHarnessPath,
  },
};

await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
console.log(JSON.stringify(status, null, 2));
