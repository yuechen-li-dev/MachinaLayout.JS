import { composeMachinaStyles, isMachinaStyleSlot } from "./authoring";
import {
  MACHINA_TOKEN_GROUPS,
  isMachinaTokenReference,
  parseMachinaTokenReference,
  readTokenValue,
  tokenReferenceToCssVar,
  tokenVariableName,
} from "./tokens";
import type {
  MachinaTabularStyleSheet,
  MachinaResponsiveProfile,
  MachinaResponsiveStyle,
  MachinaResponsiveVariant,
  MachinaStatefulStyle,
  MachinaBorderStyle,
  MachinaBoxStyle,
  MachinaEffectStyle,
  MachinaFontToken,
  MachinaFontWeight,
  MachinaStyleLayer,
  MachinaStyleRecord,
  MachinaStyleSheet,
  MachinaStyleTokens,
  MachinaSurfaceStyle,
  MachinaTextStyle,
  SerializeMachinaStyleOptions,
  StyleRuleRecord,
  StyleTokenRecord,
} from "./types";
import { DEFAULT_MACHINA_RESPONSIVE_PROFILE } from "./types";

type CssDeclaration = readonly [property: string, value: string];
const RESPONSIVE_VARIANTS: readonly MachinaResponsiveVariant[] = ["desktop", "tablet", "phone"];

function lowerLength(value: number | string | object): string {
  if (typeof value === "number") {
    return `${value}px`;
  }

  const tokenVar = tokenReferenceToCssVar(value);
  if (tokenVar) {
    return tokenVar;
  }

  if (typeof value === "string") {
    return value;
  }

  if (isMachinaTokenReference(value)) {
    throw new Error("Cannot lower MachinaStyle token object in this length context.");
  }

  return String(value);
}

function lowerValue(value: number | string | object): string {
  if (typeof value === "number") {
    return String(value);
  }

  const tokenVar = tokenReferenceToCssVar(value);
  if (tokenVar) {
    return tokenVar;
  }

  if (typeof value === "string") {
    return value;
  }

  if (isMachinaTokenReference(value)) {
    throw new Error("Cannot lower MachinaStyle token object in this value context.");
  }

  return String(value);
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
  value: number | string | object | undefined,
): void {
  if (value !== undefined) {
    declarations.push([property, lowerLength(value)]);
  }
}

function pushValue(
  declarations: CssDeclaration[],
  property: string,
  value: number | string | object | undefined,
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
    declarations.push([tokenVariableName("font", `${key}-family`), token.family]);
  }
  if (token.size !== undefined) {
    declarations.push([tokenVariableName("font", `${key}-size`), lowerLength(token.size)]);
  }
  if (token.lineHeight !== undefined) {
    declarations.push([
      tokenVariableName("font", `${key}-line-height`),
      lowerValue(token.lineHeight),
    ]);
  }
  if (token.weight !== undefined) {
    declarations.push([tokenVariableName("font", `${key}-weight`), lowerFontWeight(token.weight)]);
  }
  if (token.letterSpacing !== undefined) {
    declarations.push([
      tokenVariableName("font", `${key}-letter-spacing`),
      lowerLength(token.letterSpacing),
    ]);
  }
}

function tokenDeclarations(tokens: MachinaStyleTokens | undefined): CssDeclaration[] {
  if (!tokens) {
    return [];
  }

  const declarations: CssDeclaration[] = [];
  for (const group of MACHINA_TOKEN_GROUPS) {
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

function tabularTokenDeclarationsForTheme(
  tokenRecords: readonly StyleTokenRecord[],
  theme: string,
): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const tokenRecord of tokenRecords) {
    const value = tokenRecord.values[theme];
    if (value !== undefined) {
      declarations.push([`--${toKebabName(tokenRecord.token)}`, value]);
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

function pushFontTokenDeclarations(
  declarations: CssDeclaration[],
  fontTokenKey: string,
  token: MachinaFontToken,
): void {
  if (token.family !== undefined) {
    declarations.push([
      "font-family",
      `var(${tokenVariableName("font", `${fontTokenKey}-family`)})`,
    ]);
  }
  if (token.size !== undefined) {
    declarations.push(["font-size", `var(${tokenVariableName("font", `${fontTokenKey}-size`)})`]);
  }
  if (token.lineHeight !== undefined) {
    declarations.push([
      "line-height",
      `var(${tokenVariableName("font", `${fontTokenKey}-line-height`)})`,
    ]);
  }
  if (token.weight !== undefined) {
    declarations.push([
      "font-weight",
      `var(${tokenVariableName("font", `${fontTokenKey}-weight`)})`,
    ]);
  }
  if (token.letterSpacing !== undefined) {
    declarations.push([
      "letter-spacing",
      `var(${tokenVariableName("font", `${fontTokenKey}-letter-spacing`)})`,
    ]);
  }
}

function textDeclarations(
  text: MachinaTextStyle | undefined,
  tokens: MachinaStyleTokens | undefined,
): CssDeclaration[] {
  if (!text) {
    return [];
  }

  const declarations: CssDeclaration[] = [];
  pushValue(declarations, "color", text.color);

  const fontRef = parseMachinaTokenReference(text.font);
  if (fontRef && fontRef.group === "font") {
    const fontToken = readTokenValue(tokens, text.font);
    if (fontToken && typeof fontToken === "object" && !Array.isArray(fontToken)) {
      pushFontTokenDeclarations(declarations, fontRef.key, fontToken as MachinaFontToken);
    }
  } else if (text.font !== undefined) {
    pushValue(declarations, "font-family", text.font);
  }

  pushValue(declarations, "font-family", text.family);
  pushLength(declarations, "font-size", text.size);
  pushValue(declarations, "line-height", text.lineHeight);
  if (text.weight !== undefined) {
    declarations.push(["font-weight", lowerFontWeight(text.weight)]);
  }
  pushLength(declarations, "letter-spacing", text.letterSpacing);
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

function styleDeclarations(
  record: MachinaStyleRecord,
  tokens: MachinaStyleTokens | undefined,
): CssDeclaration[] {
  return [
    ...boxDeclarations(record.box),
    ...surfaceDeclarations(record.surface),
    ...textDeclarations(record.text, tokens),
    ...borderDeclarations(record.border),
    ...effectDeclarations(record.effect),
  ];
}

function stateLayerToCssRecord(
  stateful: MachinaStatefulStyle,
  stateName: string,
): MachinaStyleRecord {
  const stateLayer = stateful.states[stateName];
  const stateOverrides = composeMachinaStyles(stateLayer);
  if (stateLayer.surface?.fill && isMachinaStyleSlot(stateLayer.surface.fill)) {
    // no-op: composeMachinaStyles already normalized supported set/plain values
  }
  return stateOverrides;
}

function layerToCssRecord(layer: MachinaStyleLayer): MachinaStyleRecord {
  return composeMachinaStyles(layer);
}

function assertValidResponsiveProfile(profile: MachinaResponsiveProfile): void {
  const entries = [
    ["phoneMaxWidth", profile.phoneMaxWidth],
    ["tabletMinWidth", profile.tabletMinWidth],
    ["tabletMaxWidth", profile.tabletMaxWidth],
    ["desktopMinWidth", profile.desktopMinWidth],
  ] as const;
  for (const [key, value] of entries) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`MachinaStyle responsiveProfile.${key} must be a positive number.`);
    }
  }
  if (profile.phoneMaxWidth >= profile.tabletMinWidth) {
    throw new Error(
      "MachinaStyle responsiveProfile.phoneMaxWidth must be less than tabletMinWidth.",
    );
  }
  if (profile.tabletMaxWidth >= profile.desktopMinWidth) {
    throw new Error(
      "MachinaStyle responsiveProfile.tabletMaxWidth must be less than desktopMinWidth.",
    );
  }
}

function mediaQueryForVariant(
  variant: MachinaResponsiveVariant,
  profile: MachinaResponsiveProfile,
): string {
  if (variant === "desktop") {
    return `(min-width: ${profile.desktopMinWidth}px)`;
  }
  if (variant === "tablet") {
    return `(min-width: ${profile.tabletMinWidth}px) and (max-width: ${profile.tabletMaxWidth}px)`;
  }
  return `(max-width: ${profile.phoneMaxWidth}px)`;
}

function serializeMediaRule(
  mediaQuery: string,
  selector: string,
  declarations: readonly CssDeclaration[],
): string {
  const rule = serializeRule(selector, declarations)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return [`@media ${mediaQuery} {`, rule, "}"].join("\n");
}

function assertNoUnresolvedStyleSlots(value: unknown, path: string): void {
  if (isMachinaStyleSlot(value)) {
    throw new Error(
      `Cannot serialize unresolved MachinaStyleSlot at ${path}. Call S.compose/S.over first.`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    assertNoUnresolvedStyleSlots(nestedValue, `${path}.${key}`);
  }
}

function assertNoUnsupportedStateUnsets(value: unknown, path: string): void {
  if (isMachinaStyleSlot(value) && value.kind === "unset") {
    throw new Error(
      `Cannot serialize MachinaStyle state layer with S.unset at ${path}. CSS data-state selectors cannot remove base declarations safely yet.`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    assertNoUnsupportedStateUnsets(nestedValue, `${path}.${key}`);
  }
}

function assertNoUnsupportedResponsiveUnsets(value: unknown, path: string): void {
  if (isMachinaStyleSlot(value) && value.kind === "unset") {
    throw new Error(
      `Cannot serialize MachinaStyle responsive layer with S.unset at ${path}. CSS media queries cannot remove base declarations safely yet.`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    assertNoUnsupportedResponsiveUnsets(nestedValue, `${path}.${key}`);
  }
}

function serializeRule(selector: string, declarations: readonly CssDeclaration[]): string {
  const lines = [`${selector} {`];
  for (const [property, value] of declarations) {
    lines.push(`  ${property}: ${value};`);
  }
  lines.push("}");
  return lines.join("\n");
}

function selectorWithState(selector: string, state: string | undefined): string {
  return state === undefined ? selector : `${selector}[data-state~="${state}"]`;
}

function knownResponsiveVariant(value: string): value is MachinaResponsiveVariant {
  return RESPONSIVE_VARIANTS.includes(value as MachinaResponsiveVariant);
}

function tabularRuleGroupKey(rule: StyleRuleRecord): string {
  return [rule.selector, rule.state ?? "", rule.breakpoint ?? ""].join("\u0000");
}

function serializeTabularRuleRecords(
  ruleRecords: readonly StyleRuleRecord[],
  responsiveProfile: MachinaResponsiveProfile,
): string[] {
  const orderedKeys: string[] = [];
  const declarationsByKey = new Map<string, CssDeclaration[]>();
  const rulesByKey = new Map<string, StyleRuleRecord>();

  for (const rule of ruleRecords) {
    const key = tabularRuleGroupKey(rule);
    if (!declarationsByKey.has(key)) {
      orderedKeys.push(key);
      declarationsByKey.set(key, []);
      rulesByKey.set(key, rule);
    }
    declarationsByKey.get(key)!.push([rule.property, rule.value]);
  }

  const blocks: string[] = [];
  for (const key of orderedKeys) {
    const rule = rulesByKey.get(key)!;
    const selector = selectorWithState(rule.selector, rule.state);
    const declarations = declarationsByKey.get(key)!;
    if (rule.breakpoint !== undefined && knownResponsiveVariant(rule.breakpoint)) {
      blocks.push(
        serializeMediaRule(
          mediaQueryForVariant(rule.breakpoint, responsiveProfile),
          selector,
          declarations,
        ),
      );
      continue;
    }
    blocks.push(serializeRule(selector, declarations));
  }

  return blocks;
}

function serializeTabularStyleSheet(
  tabular: MachinaTabularStyleSheet | undefined,
  responsiveProfile: MachinaResponsiveProfile,
): string[] {
  if (!tabular) {
    return [];
  }

  const blocks: string[] = [];
  const tokenRecords = tabular.tokenRecords ?? [];
  const defaultTheme = tabular.defaultTheme;

  if (tokenRecords.length > 0 && defaultTheme !== undefined) {
    const rootDeclarations = tabularTokenDeclarationsForTheme(tokenRecords, defaultTheme);
    if (rootDeclarations.length > 0) {
      blocks.push(serializeRule(":root", rootDeclarations));
    }

    const seenThemes = new Set<string>();
    for (const tokenRecord of tokenRecords) {
      for (const theme of Object.keys(tokenRecord.values)) {
        if (theme === defaultTheme || seenThemes.has(theme)) {
          continue;
        }
        seenThemes.add(theme);
        const declarations = tabularTokenDeclarationsForTheme(tokenRecords, theme);
        if (declarations.length > 0) {
          blocks.push(serializeRule(`.${theme}`, declarations));
        }
      }
    }
  }

  if ((tabular.ruleRecords?.length ?? 0) > 0) {
    blocks.push(...serializeTabularRuleRecords(tabular.ruleRecords!, responsiveProfile));
  }

  return blocks;
}

function toKebabName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[.\s_]+/g, "-")
    .toLowerCase();
}

export function serializeMachinaStyleSheet(
  sheet: MachinaStyleSheet,
  options: SerializeMachinaStyleOptions = {},
): string {
  const includeHeader = options.includeHeader ?? true;
  const responsiveProfile = options.responsiveProfile ?? DEFAULT_MACHINA_RESPONSIVE_PROFILE;
  assertValidResponsiveProfile(responsiveProfile);
  const blocks: string[] = [];
  if (includeHeader) {
    blocks.push("/* Generated by MachinaStyle. Edit style.ts, not this CSS. */");
    blocks.push(
      "/* biome-ignore-all lint/suspicious/noDuplicateProperties: Font token expansion intentionally emits base declarations before explicit overrides. */",
    );
  }

  const tokens = tokenDeclarations(sheet.tokens);
  if (tokens.length > 0) {
    blocks.push(serializeRule(":root", tokens));
  }

  blocks.push(...serializeTabularStyleSheet(sheet.tabular, responsiveProfile));

  for (const className of Object.keys(sheet.classes).sort()) {
    assertNoUnresolvedStyleSlots(sheet.classes[className], `classes.${className}`);
    const declarations = styleDeclarations(sheet.classes[className], sheet.tokens);
    blocks.push(serializeRule(`.${className}`, declarations));
  }

  for (const key of Object.keys(sheet.stateful ?? {}).sort()) {
    const stateful = sheet.stateful![key];
    assertNoUnresolvedStyleSlots(stateful.base, `stateful.${key}.base`);
    blocks.push(
      serializeRule(`.${stateful.className}`, styleDeclarations(stateful.base, sheet.tokens)),
    );

    for (const stateName of Object.keys(stateful.states).sort()) {
      assertNoUnsupportedStateUnsets(
        stateful.states[stateName],
        `stateful.${key}.states.${stateName}`,
      );
      const declarations = styleDeclarations(
        stateLayerToCssRecord(stateful, stateName),
        sheet.tokens,
      );
      blocks.push(
        serializeRule(`.${stateful.className}[data-state~="${stateName}"]`, declarations),
      );
    }
  }

  for (const key of Object.keys(sheet.responsive ?? {}).sort()) {
    const responsive: MachinaResponsiveStyle = sheet.responsive![key];
    assertNoUnresolvedStyleSlots(responsive.base, `responsive.${key}.base`);
    blocks.push(
      serializeRule(`.${responsive.className}`, styleDeclarations(responsive.base, sheet.tokens)),
    );

    for (const variant of RESPONSIVE_VARIANTS) {
      const variantLayer = responsive.variants[variant];
      if (!variantLayer) {
        continue;
      }
      assertNoUnsupportedResponsiveUnsets(variantLayer, `responsive.${key}.variants.${variant}`);
      const declarations = styleDeclarations(layerToCssRecord(variantLayer), sheet.tokens);
      blocks.push(
        serializeMediaRule(
          mediaQueryForVariant(variant, responsiveProfile),
          `.${responsive.className}`,
          declarations,
        ),
      );
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
