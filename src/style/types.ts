import type { ColumnarTable } from "../table/types";

export type MachinaFontWeight = "normal" | "medium" | "semibold" | "bold" | number;

export type MachinaFontToken = {
  family?: string;
  size?: number | string;
  lineHeight?: number | string;
  weight?: MachinaFontWeight;
  letterSpacing?: number | string;
};

export type MachinaTokenGroup = "color" | "space" | "radius" | "font" | "shadow";

export type MachinaTokenReference = {
  kind: "token";
  group: MachinaTokenGroup;
  key: string;
};

export type MachinaStyleTokens = {
  color?: Record<string, string>;
  space?: Record<string, number | string>;
  radius?: Record<string, number | string>;
  font?: Record<string, MachinaFontToken>;
  shadow?: Record<string, string>;
};

export type MachinaTokenRef = string | MachinaTokenReference;
export type MachinaTokenLength = number | string | MachinaTokenReference;
export type MachinaTokenValue = string | MachinaTokenReference;

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
  width?: MachinaTokenLength;
  height?: MachinaTokenLength;
  minWidth?: MachinaTokenLength;
  minHeight?: MachinaTokenLength;
  maxWidth?: MachinaTokenLength;
  maxHeight?: MachinaTokenLength;

  padding?: MachinaTokenLength;
  paddingX?: MachinaTokenLength;
  paddingY?: MachinaTokenLength;
  paddingTop?: MachinaTokenLength;
  paddingRight?: MachinaTokenLength;
  paddingBottom?: MachinaTokenLength;
  paddingLeft?: MachinaTokenLength;

  margin?: MachinaTokenLength;
  marginX?: MachinaTokenLength;
  marginY?: MachinaTokenLength;
  marginTop?: MachinaTokenLength;
  marginRight?: MachinaTokenLength;
  marginBottom?: MachinaTokenLength;
  marginLeft?: MachinaTokenLength;

  gap?: MachinaTokenLength;

  alignItems?: "start" | "center" | "end" | "stretch";
  justifyContent?: "start" | "center" | "end" | "spaceBetween" | "spaceAround" | "spaceEvenly";

  overflow?: "visible" | "hidden" | "auto" | "scroll";
};

export type MachinaSurfaceStyle = {
  fill?: MachinaTokenValue;
  radius?: MachinaTokenLength;
  opacity?: number;
};

export type MachinaTextStyle = {
  color?: MachinaTokenValue;
  font?: MachinaTokenRef;
  family?: MachinaTokenValue;
  size?: MachinaTokenLength;
  lineHeight?: MachinaTokenLength;
  weight?: MachinaFontWeight;
  letterSpacing?: MachinaTokenLength;
  align?: "left" | "center" | "right";
  transform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

export type MachinaBorderStyle = {
  color?: MachinaTokenValue;
  width?: MachinaTokenLength;
  style?: "solid" | "dashed" | "dotted" | "none";
};

export type MachinaEffectStyle = {
  shadow?: MachinaTokenValue;
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
  width?: MachinaStyleSlotInput<MachinaTokenLength>;
  height?: MachinaStyleSlotInput<MachinaTokenLength>;
  minWidth?: MachinaStyleSlotInput<MachinaTokenLength>;
  minHeight?: MachinaStyleSlotInput<MachinaTokenLength>;
  maxWidth?: MachinaStyleSlotInput<MachinaTokenLength>;
  maxHeight?: MachinaStyleSlotInput<MachinaTokenLength>;

  padding?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingX?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingY?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingTop?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingRight?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingBottom?: MachinaStyleSlotInput<MachinaTokenLength>;
  paddingLeft?: MachinaStyleSlotInput<MachinaTokenLength>;

  margin?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginX?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginY?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginTop?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginRight?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginBottom?: MachinaStyleSlotInput<MachinaTokenLength>;
  marginLeft?: MachinaStyleSlotInput<MachinaTokenLength>;

  gap?: MachinaStyleSlotInput<MachinaTokenLength>;

  alignItems?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["alignItems"]>>;
  justifyContent?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["justifyContent"]>>;

  overflow?: MachinaStyleSlotInput<NonNullable<MachinaBoxStyle["overflow"]>>;
};

export type MachinaSurfaceStyleLayer = {
  fill?: MachinaStyleSlotInput<MachinaTokenValue>;
  radius?: MachinaStyleSlotInput<MachinaTokenLength>;
  opacity?: MachinaStyleSlotInput<number>;
};

export type MachinaTextStyleLayer = {
  color?: MachinaStyleSlotInput<MachinaTokenValue>;
  font?: MachinaStyleSlotInput<MachinaTokenRef>;
  family?: MachinaStyleSlotInput<MachinaTokenValue>;
  size?: MachinaStyleSlotInput<MachinaTokenLength>;
  lineHeight?: MachinaStyleSlotInput<MachinaTokenLength>;
  weight?: MachinaStyleSlotInput<MachinaFontWeight>;
  letterSpacing?: MachinaStyleSlotInput<MachinaTokenLength>;
  align?: MachinaStyleSlotInput<NonNullable<MachinaTextStyle["align"]>>;
  transform?: MachinaStyleSlotInput<NonNullable<MachinaTextStyle["transform"]>>;
};

export type MachinaBorderStyleLayer = {
  color?: MachinaStyleSlotInput<MachinaTokenValue>;
  width?: MachinaStyleSlotInput<MachinaTokenLength>;
  style?: MachinaStyleSlotInput<NonNullable<MachinaBorderStyle["style"]>>;
};

export type MachinaEffectStyleLayer = {
  shadow?: MachinaStyleSlotInput<MachinaTokenValue>;
};

export type MachinaStyleLayer = {
  box?: MachinaBoxStyleLayer;
  surface?: MachinaSurfaceStyleLayer;
  text?: MachinaTextStyleLayer;
  border?: MachinaBorderStyleLayer;
  effect?: MachinaEffectStyleLayer;
};

export type MachinaStyleStateName = string;

export type MachinaStatefulStyle = {
  className: string;
  base: MachinaStyleRecord;
  states: Record<MachinaStyleStateName, MachinaStyleLayer>;
  description?: string;
};

export type MachinaResponsiveVariant = "desktop" | "tablet" | "phone";

export type MachinaResponsiveProfile = {
  phoneMaxWidth: number;
  tabletMinWidth: number;
  tabletMaxWidth: number;
  desktopMinWidth: number;
};

export const DEFAULT_MACHINA_RESPONSIVE_PROFILE: MachinaResponsiveProfile = {
  phoneMaxWidth: 639,
  tabletMinWidth: 640,
  tabletMaxWidth: 1023,
  desktopMinWidth: 1024,
};

export type MachinaResponsiveStyle = {
  className: string;
  base: MachinaStyleRecord;
  variants: Partial<Record<MachinaResponsiveVariant, MachinaStyleLayer>>;
  description?: string;
};

export type MachinaStyleSheet = {
  tokens?: MachinaStyleTokens;
  classes: Record<string, MachinaStyleRecord>;
  stateful?: Record<string, MachinaStatefulStyle>;
  responsive?: Record<string, MachinaResponsiveStyle>;
  tabular?: MachinaTabularStyleSheet;
};

export type SerializeMachinaStyleOptions = {
  includeHeader?: boolean;
  responsiveProfile?: MachinaResponsiveProfile;
};

export type MachinaStyleArtifact = {
  path: string;
  css: string;
};

export type MachinaStyleDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

export type StyleTokenRecord = {
  readonly kind: "styleToken";
  readonly token: string;
  readonly values: Readonly<Record<string, string>>;
  readonly description?: string;
};

export type StyleRuleRecord = {
  readonly kind: "styleRule";
  readonly selector: string;
  readonly property: string;
  readonly value: string;
  readonly state?: string;
  readonly breakpoint?: string;
  readonly description?: string;
};

export type StyleTokensFromTableOptions = {
  readonly tokenColumn?: string;
  readonly themeColumns?: readonly string[];
  readonly descriptionColumn?: string;
};

export type StyleRulesFromTableOptions = {
  readonly selectorColumn?: string;
  readonly propertyColumn?: string;
  readonly valueColumn?: string;
  readonly stateColumn?: string;
  readonly breakpointColumn?: string;
  readonly descriptionColumn?: string;
};

export type StyleSheetFromTablesOptions = {
  readonly id?: string;
  readonly tokens?: ColumnarTable;
  readonly rules?: ColumnarTable;
  readonly tokenOptions?: StyleTokensFromTableOptions;
  readonly ruleOptions?: StyleRulesFromTableOptions;
};

export type StyleTokenTableDescription = {
  readonly kind: "styleTokenTableDescription";
  readonly tableId: string;
  readonly tokenCount: number;
  readonly themes: readonly string[];
};

export type StyleRuleTableDescription = {
  readonly kind: "styleRuleTableDescription";
  readonly tableId: string;
  readonly ruleCount: number;
  readonly selectorCount: number;
  readonly propertyCount: number;
};

export type MachinaTabularStyleSheet = {
  readonly tokenRecords?: readonly StyleTokenRecord[];
  readonly ruleRecords?: readonly StyleRuleRecord[];
  readonly defaultTheme?: string;
};
