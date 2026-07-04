import type {
  MachinaBorderStyle,
  MachinaBoxStyle,
  MachinaEffectStyle,
  MachinaFontToken,
  MachinaFontWeight,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleTokens,
  MachinaSurfaceStyle,
  MachinaTextStyle,
  SerializeMachinaStyleOptions,
} from "./types";

const TOKEN_GROUPS = ["color", "space", "radius", "font", "shadow"] as const;
type TokenGroup = (typeof TOKEN_GROUPS)[number];

type CssDeclaration = readonly [property: string, value: string];

function toKebabName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function tokenVariableName(group: TokenGroup, key: string): string {
  return `--${group}-${toKebabName(key)}`;
}

function isTokenRef(value: string): boolean {
  return TOKEN_GROUPS.some((group) => value.startsWith(`${group}.`));
}

function tokenRefToVar(value: string): string {
  const [group, ...keyParts] = value.split(".");
  return `var(--${toKebabName(group)}-${toKebabName(keyParts.join("-"))})`;
}

function lowerLength(value: number | string): string {
  if (typeof value === "number") {
    return `${value}px`;
  }
  return isTokenRef(value) ? tokenRefToVar(value) : value;
}

function lowerValue(value: number | string): string {
  if (typeof value === "number") {
    return String(value);
  }
  return isTokenRef(value) ? tokenRefToVar(value) : value;
}

function lowerFontWeight(weight: MachinaFontWeight): string {
  if (typeof weight === "number") {
    return String(weight);
  }
  if (weight === "medium") {
    return "500";
  }
  if (weight === "semibold") {
    return "600";
  }
  if (weight === "bold") {
    return "700";
  }
  return "400";
}

function lowerDisplay(value: NonNullable<MachinaBoxStyle["display"]>): string {
  return value === "inlineBlock" ? "inline-block" : value;
}

function lowerAlignment(value: "start" | "center" | "end" | "stretch"): string {
  if (value === "start") {
    return "flex-start";
  }
  if (value === "end") {
    return "flex-end";
  }
  return value;
}

function lowerJustifyContent(value: NonNullable<MachinaBoxStyle["justifyContent"]>): string {
  if (value === "start") {
    return "flex-start";
  }
  if (value === "end") {
    return "flex-end";
  }
  if (value === "spaceBetween") {
    return "space-between";
  }
  if (value === "spaceAround") {
    return "space-around";
  }
  if (value === "spaceEvenly") {
    return "space-evenly";
  }
  return value;
}

function pushLength(
  declarations: CssDeclaration[],
  property: string,
  value: number | string | undefined,
): void {
  if (value !== undefined) {
    declarations.push([property, lowerLength(value)]);
  }
}

function pushValue(
  declarations: CssDeclaration[],
  property: string,
  value: number | string | undefined,
): void {
  if (value !== undefined) {
    declarations.push([property, lowerValue(value)]);
  }
}

function serializeFontToken(
  token: MachinaFontToken,
  declarations: CssDeclaration[],
  key: string,
): void {
  if (token.family !== undefined) {
    declarations.push([`--font-${toKebabName(key)}-family`, token.family]);
  }
  if (token.size !== undefined) {
    declarations.push([`--font-${toKebabName(key)}-size`, lowerLength(token.size)]);
  }
  if (token.lineHeight !== undefined) {
    declarations.push([`--font-${toKebabName(key)}-line-height`, lowerValue(token.lineHeight)]);
  }
  if (token.weight !== undefined) {
    declarations.push([`--font-${toKebabName(key)}-weight`, lowerFontWeight(token.weight)]);
  }
  if (token.letterSpacing !== undefined) {
    declarations.push([
      `--font-${toKebabName(key)}-letter-spacing`,
      lowerLength(token.letterSpacing),
    ]);
  }
}

function tokenDeclarations(tokens: MachinaStyleTokens | undefined): CssDeclaration[] {
  if (!tokens) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  for (const group of TOKEN_GROUPS) {
    const values = tokens[group];
    if (!values) {
      continue;
    }
    for (const key of Object.keys(values).sort()) {
      const value = values[key];
      if (value === undefined) {
        continue;
      }
      if (group === "font") {
        serializeFontToken(value as MachinaFontToken, declarations, key);
        continue;
      }
      declarations.push([
        tokenVariableName(group, key),
        group === "space" || group === "radius"
          ? lowerLength(value as number | string)
          : String(value),
      ]);
    }
  }
  return declarations;
}

function boxDeclarations(box: MachinaBoxStyle | undefined): CssDeclaration[] {
  if (!box) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  if (box.display !== undefined) {
    declarations.push(["display", lowerDisplay(box.display)]);
  }
  pushLength(declarations, "width", box.width);
  pushLength(declarations, "height", box.height);
  pushLength(declarations, "min-width", box.minWidth);
  pushLength(declarations, "min-height", box.minHeight);
  pushLength(declarations, "max-width", box.maxWidth);
  pushLength(declarations, "max-height", box.maxHeight);
  pushLength(declarations, "padding", box.padding);
  pushLength(declarations, "padding-left", box.paddingX);
  pushLength(declarations, "padding-right", box.paddingX);
  pushLength(declarations, "padding-top", box.paddingY);
  pushLength(declarations, "padding-bottom", box.paddingY);
  pushLength(declarations, "padding-top", box.paddingTop);
  pushLength(declarations, "padding-right", box.paddingRight);
  pushLength(declarations, "padding-bottom", box.paddingBottom);
  pushLength(declarations, "padding-left", box.paddingLeft);
  pushLength(declarations, "margin", box.margin);
  pushLength(declarations, "margin-left", box.marginX);
  pushLength(declarations, "margin-right", box.marginX);
  pushLength(declarations, "margin-top", box.marginY);
  pushLength(declarations, "margin-bottom", box.marginY);
  pushLength(declarations, "margin-top", box.marginTop);
  pushLength(declarations, "margin-right", box.marginRight);
  pushLength(declarations, "margin-bottom", box.marginBottom);
  pushLength(declarations, "margin-left", box.marginLeft);
  pushLength(declarations, "gap", box.gap);
  if (box.alignItems !== undefined) {
    declarations.push(["align-items", lowerAlignment(box.alignItems)]);
  }
  if (box.justifyContent !== undefined) {
    declarations.push(["justify-content", lowerJustifyContent(box.justifyContent)]);
  }
  if (box.overflow !== undefined) {
    declarations.push(["overflow", box.overflow]);
  }
  return declarations;
}

function surfaceDeclarations(surface: MachinaSurfaceStyle | undefined): CssDeclaration[] {
  if (!surface) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  pushValue(declarations, "background", surface.fill);
  pushLength(declarations, "border-radius", surface.radius);
  pushValue(declarations, "opacity", surface.opacity);
  return declarations;
}

function textDeclarations(text: MachinaTextStyle | undefined): CssDeclaration[] {
  if (!text) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  pushValue(declarations, "color", text.color);
  pushValue(declarations, "font-family", text.font);
  pushValue(declarations, "font-family", text.family);
  pushLength(declarations, "font-size", text.size);
  pushValue(declarations, "line-height", text.lineHeight);
  if (text.weight !== undefined) {
    declarations.push(["font-weight", lowerFontWeight(text.weight)]);
  }
  if (text.align !== undefined) {
    declarations.push(["text-align", text.align]);
  }
  if (text.transform !== undefined) {
    declarations.push(["text-transform", text.transform]);
  }
  return declarations;
}

function borderDeclarations(border: MachinaBorderStyle | undefined): CssDeclaration[] {
  if (!border) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  pushLength(declarations, "border-width", border.width);
  if (border.style !== undefined) {
    declarations.push(["border-style", border.style]);
  }
  pushValue(declarations, "border-color", border.color);
  return declarations;
}

function effectDeclarations(effect: MachinaEffectStyle | undefined): CssDeclaration[] {
  if (!effect) {
    return [];
  }
  const declarations: CssDeclaration[] = [];
  pushValue(declarations, "box-shadow", effect.shadow);
  return declarations;
}

function styleDeclarations(record: MachinaStyleRecord): CssDeclaration[] {
  return [
    ...boxDeclarations(record.box),
    ...surfaceDeclarations(record.surface),
    ...textDeclarations(record.text),
    ...borderDeclarations(record.border),
    ...effectDeclarations(record.effect),
  ];
}

function serializeRule(selector: string, declarations: readonly CssDeclaration[]): string {
  const lines = [`${selector} {`];
  for (const [property, value] of declarations) {
    lines.push(`  ${property}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

export function serializeMachinaStyleSheet(
  sheet: MachinaStyleSheet,
  options: SerializeMachinaStyleOptions = {},
): string {
  const includeHeader = options.includeHeader ?? true;
  const blocks: string[] = [];
  if (includeHeader) {
    blocks.push("/* Generated by MachinaStyle. Edit style.ts, not this CSS. */");
  }

  const tokens = tokenDeclarations(sheet.tokens);
  if (tokens.length > 0) {
    blocks.push(serializeRule(":root", tokens));
  }

  for (const className of Object.keys(sheet.classes).sort()) {
    const declarations = styleDeclarations(sheet.classes[className]);
    blocks.push(serializeRule(`.${className}`, declarations));
  }

  return `${blocks.join("\n\n")}\n`;
}
