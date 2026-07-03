import type { ReferenceGridConfig } from "./referenceGrid";

export type CanvasUnit = "px";

export type CanvasDocument = {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: CanvasUnit;
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

export type CanvasObject = RectObject | EllipseObject | TextObject;

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
  fill?: string;
  stroke?: string;
  tags?: string[];
  notes?: string;
};

export type CanvasObjectKind = "rect" | "ellipse" | "text";

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
