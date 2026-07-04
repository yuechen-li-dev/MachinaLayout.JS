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
  | UiComponentObject;

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

export type CanvasObjectKind = "rect" | "ellipse" | "text" | "image" | "uiComponent";

export type CanvasUiPropValue =
  | string
  | number
  | boolean
  | null
  | readonly string[]
  | readonly number[];

export type CanvasImageRole = "image" | "alphaMap" | "mask";

export type CanvasBlendMode = "normal" | "multiply" | "screen" | "overlay";

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
