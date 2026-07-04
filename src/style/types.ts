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
