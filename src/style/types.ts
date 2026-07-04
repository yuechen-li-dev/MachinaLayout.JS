export type MachinaFontWeight = "normal" | "medium" | "semibold" | "bold" | number;

export type MachinaFontToken = {
  family?: string;
  size?: number | string;
  lineHeight?: number | string;
  weight?: MachinaFontWeight;
  letterSpacing?: number | string;
};

export type MachinaStyleTokens = {
  color?: Record<string, string>;
  space?: Record<string, number | string>;
  radius?: Record<string, number | string>;
  font?: Record<string, MachinaFontToken>;
  shadow?: Record<string, string>;
};

export type MachinaTokenRef = string;

export type MachinaStyleSlot<T> =
  | {
      kind: "set";
      value: T;
    }
  | {
      kind: "inherit";
    }
  | {
      kind: "unset";
    };

export type MachinaStyleSlotInput<T> = T | MachinaStyleSlot<T>;

export type MachinaBoxStyle = {
  display?: "block" | "inlineBlock" | "flex" | "grid" | "none";
  width?: number | string;
  height?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
  maxWidth?: number | string;
  maxHeight?: number | string;

  padding?: number | string;
  paddingX?: number | string;
  paddingY?: number | string;
  paddingTop?: number | string;
  paddingRight?: number | string;
  paddingBottom?: number | string;
  paddingLeft?: number | string;

  margin?: number | string;
  marginX?: number | string;
  marginY?: number | string;
  marginTop?: number | string;
  marginRight?: number | string;
  marginBottom?: number | string;
  marginLeft?: number | string;

  gap?: number | string;

  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly";

  overflow?: "visible" | "hidden" | "auto" | "scroll";
};

export type MachinaSurfaceStyle = {
  fill?: string;
  radius?: number | string;
  opacity?: number;
};

export type MachinaTextStyle = {
  color?: string;
  font?: string;
  family?: string;
  size?: number | string;
  lineHeight?: number | string;
  weight?: MachinaFontWeight;
  align?: "left" | "center" | "right";
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

export type MachinaBorderStyle = {
  color?: string;
  width?: number | string;
  style?: "solid" | "dashed" | "dotted" | "none";
};

export type MachinaEffectStyle = {
  shadow?: string;
};

export type MachinaStyleRecord = {
  box?: MachinaBoxStyle;
  surface?: MachinaSurfaceStyle;
  text?: MachinaTextStyle;
  border?: MachinaBorderStyle;
  effect?: MachinaEffectStyle;
};

export type MachinaBoxStyleLayer = {
  display?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["display"]>>;
  width?: MachinaStyleSlotInput<number | string>;
  height?: MachinaStyleSlotInput<number | string>;
  minWidth?: MachinaStyleSlotInput<number | string>;
  minHeight?: MachinaStyleSlotInput<number | string>;
  maxWidth?: MachinaStyleSlotInput<number | string>;
  maxHeight?: MachinaStyleSlotInput<number | string>;

  padding?: MachinaStyleSlotInput<number | string>;
  paddingX?: MachinaStyleSlotInput<number | string>;
  paddingY?: MachinaStyleSlotInput<number | string>;
  paddingTop?: MachinaStyleSlotInput<number | string>;
  paddingRight?: MachinaStyleSlotInput<number | string>;
  paddingBottom?: MachinaStyleSlotInput<number | string>;
  paddingLeft?: MachinaStyleSlotInput<number | string>;

  margin?: MachinaStyleSlotInput<number | string>;
  marginX?: MachinaStyleSlotInput<number | string>;
  marginY?: MachinaStyleSlotInput<number | string>;
  marginTop?: MachinaStyleSlotInput<number | string>;
  marginRight?: MachinaStyleSlotInput<number | string>;
  marginBottom?: MachinaStyleSlotInput<number | string>;
  marginLeft?: MachinaStyleSlotInput<number | string>;

  gap?: MachinaStyleSlotInput<number | string>;

  alignItems?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["alignItems"]>>;
  justifyContent?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["justifyContent"]>>;

  overflow?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["overflow"]>>;
};

export type MachinaSurfaceStyleLayer = {
  fill?: MachinaStyleSlotInput<string>;
  radius?: MachinaStyleSlotInput<number | string>;
  opacity?: MachinaStyleSlotInput<number>;
};

export type MachinaTextStyleLayer = {
  color?: MachinaStyleSlotInput<string>;
  font?: MachinaStyleSlotInput<string>;
  family?: MachinaStyleSlotInput<string>;
  size?: MachinaStyleSlotInput<number | string>;
  lineHeight?: MachinaStyleSlotInput<number | string>;
  weight?: MachinaStyleSlotInput<MachinaFontWeight>;
  align?: MachinaStyleSlotInput<NonNullable<MachinaTextStyle["align"]>>;
  transform?: MachinaStyleSlotInput<NonNullable<MachinaTextStyle["transform"]>>;
};

export type MachinaBorderStyleLayer = {
  color?: MachinaStyleSlotInput<string>;
  width?: MachinaStyleSlotInput<number | string>;
  style?: MachinaStyleSlotInput<NonNullable<MachinaBorderStyle["style"]>>;
};

export type MachinaEffectStyleLayer = {
  shadow?: MachinaStyleSlotInput<string>;
};

export type MachinaStyleLayer = {
  box?: MachinaBoxStyleLayer;
  surface?: MachinaSurfaceStyleLayer;
  text?: MachinaTextStyleLayer;
  border?: MachinaBorderStyleLayer;
  effect?: MachinaEffectStyleLayer;
};

export type MachinaStyleSheet = {
  tokens?: MachinaStyleTokens;
  classes: Record<string, MachinaStyleRecord>;
};

export type SerializeMachinaStyleOptions = {
  includeHeader?: boolean;
};

export type MachinaStyleDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};
