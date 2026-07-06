import type { ReferenceGridConfig } from "./referenceGrid";

export type CanvasUnitName = "px" | "pt" | "mm" | "cm" | "in" | "cu";

export type CanvasUnitSystem = {
  unit: CanvasUnitName;
  label: string;
  unitsPerInch?: number;
  pixelsPerUnit: number;
  precision: number;
};

export type CanvasDocument = {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: CanvasUnitName;
  unitSystem: CanvasUnitSystem;
  layers: CanvasLayer[];
  objects: Record<string, CanvasObject>;
  selectedObjectId?: string;
  referenceGrid?: ReferenceGridConfig;
};

export type CanvasLayer = {
  id: string;
  name: string;
  visible: boolean;
  objectIds: string[];
};

export type CanvasObject =
  | RectObject
  | EllipseObject
  | TextObject
  | ImageObject
  | UiComponentObject
  | SketchOverlayObject
  | SpriteSidecarObject;

export type CanvasFrame =
  | CanvasAbsoluteFrame
  | CanvasAnchorFrame
  | CanvasReferenceGridFrame
  | CanvasReferenceGridSpanFrame;

export type CanvasAbsoluteFrame = {
  kind: "absolute";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CanvasAnchorFrame = {
  kind: "anchor";
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  width?: number;
  height?: number;
};

export type CanvasReferenceGridFrame = {
  kind: "referenceGrid";
  ref: string;
  anchor?: "topLeft" | "center" | "bottomRight";
  width: number;
  height: number;
};

export type CanvasReferenceGridSpanFrame = {
  kind: "referenceGridSpan";
  span: string;
};

export type CanvasObjectBase = {
  id: string;
  name: string;
  kind: CanvasObjectKind;
  layerId: string;
  visible: boolean;
  locked?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  frame?: CanvasFrame;
  fill?: string;
  stroke?: string;
  tags?: string[];
  notes?: string;
};

export type CanvasObjectKind =
  | "rect"
  | "ellipse"
  | "text"
  | "image"
  | "uiComponent"
  | "sketchOverlay"
  | "spriteSidecar";

export type CanvasUiPropValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[];

export type CanvasImageRole = "image" | "alphaMap" | "mask";

export type CanvasBlendMode = "normal" | "multiply" | "screen" | "overlay";

export type CanvasSketchRef =
  | {
      kind: "absolutePoint";
      x: number;
      y: number;
    }
  | {
      kind: "absoluteRect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      kind: "gridRef";
      ref: string;
    }
  | {
      kind: "gridSpan";
      span: string;
    }
  | {
      kind: "objectAnchor";
      objectId: string;
      anchor: "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";
    };

export type CanvasSketchBox = {
  kind: "box";
  id: string;
  label?: string;
  ref: CanvasSketchRef;
  stroke?: string;
  fill?: string;
};

export type CanvasSketchLine = {
  kind: "line";
  id: string;
  label?: string;
  from: CanvasSketchRef;
  to: CanvasSketchRef;
  stroke?: string;
};

export type CanvasSketchPoint = {
  kind: "point";
  id: string;
  label?: string;
  ref: CanvasSketchRef;
  stroke?: string;
  fill?: string;
};

export type CanvasSketchLabel = {
  kind: "label";
  id: string;
  text: string;
  ref: CanvasSketchRef;
};

export type CanvasSketchPrimitive =
  | CanvasSketchBox
  | CanvasSketchLine
  | CanvasSketchPoint
  | CanvasSketchLabel;

export type CanvasSketchSpec = {
  id: string;
  name: string;
  dialect: "sketch";
  targetId: string;
  primitives: readonly CanvasSketchPrimitive[];
};

export type CanvasSpriteOverlaySettings = {
  showBounds: boolean;
  showLabels: boolean;
  selectedOnly: boolean;
  showSubgrids: boolean;
  showExactFrames: boolean;
};

export type SpriteFrameSourceKind = "grid" | "exact" | "manual" | "unknown";

export type CanvasSpriteSubgridRegion = {
  kind: "spriteSubgridRegion";
  id: string;
  x: number;
  y: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  width: number;
  height: number;
  source?: "spriteforgeGrid" | "roughCutGrid" | "derived" | "manual";
  gridKind?: string;
  framePrefix?: string;
  frameStartIndex?: number;
  frameLabels?: readonly string[];
  pivot?: string;
};

export type CanvasSpriteGridSpec = CanvasSpriteSubgridRegion;

export type CanvasSpriteFrame = {
  id: string;
  label: string;
  spriteId?: string;
  animationId?: string;
  clipId?: string;
  kind?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row?: number;
  column?: number;
  source?: "grid" | "frame" | "inline";
  gridId?: string;
  sourceKind?: SpriteFrameSourceKind;
  sourceGridId?: string;
  sourceRow?: number;
  sourceColumn?: number;
  sourceFrameId?: string;
  pivot?: string;
};

export type CanvasSpriteAnimation = {
  id: string;
  spriteId: string;
  gridId?: string;
  row?: number;
  frameIds: readonly string[];
  fps?: number;
  loop?: boolean;
};

export type CanvasSpriteDiagnostics = {
  severity: "info" | "warning";
  code: string;
  message: string;
  frameIds?: readonly string[];
};

export type CanvasSpriteSpec = {
  id: string;
  name: string;
  dialect: "sprite" | "spriteforge";
  targetId: string;
  sourceName?: string;
  atlasImage?: string;
  atlasWidth?: number;
  atlasHeight?: number;
  grids: readonly CanvasSpriteGridSpec[];
  frames: readonly CanvasSpriteFrame[];
  animations: readonly CanvasSpriteAnimation[];
  diagnostics: readonly CanvasSpriteDiagnostics[];
  overlay: CanvasSpriteOverlaySettings;
  selectedFrameId?: string;
  rawToml?: string;
};

export type RectObject = CanvasObjectBase & {
  kind: "rect";
  radius?: number;
};

export type EllipseObject = CanvasObjectBase & {
  kind: "ellipse";
};

export type TextObject = CanvasObjectBase & {
  kind: "text";
  text: string;
  fontSize: number;
  fontWeight?: number | string;
};

export type ImageObject = CanvasObjectBase & {
  kind: "image";
  src: string;
  role?: CanvasImageRole;
  alphaMapId?: string;
  sketchOverlayId?: string;
  spriteSidecarId?: string;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
  opacity?: number;
  blendMode?: CanvasBlendMode;
  fit?: "fill" | "contain" | "cover";
};

export type UiComponentObject = CanvasObjectBase & {
  kind: "uiComponent";
  componentId: string;
  variant?: string;
  props: Record<string, CanvasUiPropValue>;
  exportName?: string;
};

export type SketchOverlayObject = CanvasObjectBase & {
  kind: "sketchOverlay";
  role?: "sketch";
  targetId: string;
  spec: CanvasSketchSpec;
};

export type SpriteSidecarObject = CanvasObjectBase & {
  kind: "spriteSidecar";
  role?: "spriteSidecar";
  targetId: string;
  spec: CanvasSpriteSpec;
};
