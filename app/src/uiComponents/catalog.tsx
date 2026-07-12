import type { ComponentType } from "react";
import type { CanvasUiPropValue, UiComponentObject } from "../sceneModel";

export type CanvasUiPropDefinition = {
  readonly name: string;
  readonly label: string;
  readonly kind: "string" | "number" | "boolean" | "enum";
  readonly options?: readonly string[];
};

export type CanvasUiPreviewProps = {
  readonly object: UiComponentObject;
  readonly selected?: boolean;
};

export type CanvasUiTsxSnippet = {
  readonly imports: readonly string[];
  readonly jsx: string;
};

export type CanvasUiComponentDefinition = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly defaultProps: Record<string, CanvasUiPropValue>;
  readonly propSchema: readonly CanvasUiPropDefinition[];
  readonly preview: ComponentType<CanvasUiPreviewProps>;
  readonly export: (object: UiComponentObject) => CanvasUiTsxSnippet;
};

function stringProp(object: UiComponentObject, name: string, fallback = ""): string {
  const value = object.props[name];
  return typeof value === "string" ? value : fallback;
}

function booleanProp(object: UiComponentObject, name: string, fallback = false): boolean {
  const value = object.props[name];
  return typeof value === "boolean" ? value : fallback;
}

function enumProp(
  object: UiComponentObject,
  name: string,
  options: readonly string[],
  fallback: string,
): string {
  const value = stringProp(object, name, fallback);
  return options.includes(value) ? value : fallback;
}

function jsxText(value: string): string {
  return `{${JSON.stringify(value)}}`;
}

function jsxAttr(name: string, value: string | boolean | number | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "boolean") return value ? ` ${name}` : "";
  if (typeof value === "number") return ` ${name}={${value}}`;
  return ` ${name}=${JSON.stringify(value)}`;
}

const buttonVariants = ["primary", "secondary", "ghost"] as const;
const buttonSizes = ["sm", "md", "lg"] as const;
const cardTones = ["default", "elevated", "outline"] as const;
const badgeTones = ["neutral", "success", "warning", "danger"] as const;

function ButtonPreview({ object }: CanvasUiPreviewProps) {
  const variant = enumProp(object, "variant", buttonVariants, object.variant ?? "primary");
  const size = enumProp(object, "size", buttonSizes, "md");
  return (
    <div className="canvas-ui-preview-inner canvas-ui-center">
      <button
        className={`canvas-ui-button canvas-ui-button-${variant} canvas-ui-button-${size}`}
        type="button"
        disabled={booleanProp(object, "disabled")}
      >
        {stringProp(object, "children", "Button")}
      </button>
    </div>
  );
}

function CardPreview({ object }: CanvasUiPreviewProps) {
  const tone = enumProp(object, "tone", cardTones, object.variant ?? "default");
  return (
    <article className={`canvas-ui-card canvas-ui-card-${tone}`}>
      <strong>{stringProp(object, "title", "Card title")}</strong>
      <p>{stringProp(object, "body", "Card body copy.")}</p>
    </article>
  );
}

function InputPreview({ object }: CanvasUiPreviewProps) {
  return (
    <label className="canvas-ui-input-block">
      <span>{stringProp(object, "label", "Label")}</span>
      <input
        value=""
        placeholder={stringProp(object, "placeholder", "Placeholder")}
        disabled={booleanProp(object, "disabled")}
        readOnly
      />
    </label>
  );
}

function BadgePreview({ object }: CanvasUiPreviewProps) {
  const tone = enumProp(object, "tone", badgeTones, object.variant ?? "neutral");
  return (
    <div className="canvas-ui-preview-inner canvas-ui-center">
      <span className={`canvas-ui-badge canvas-ui-badge-${tone}`}>
        {stringProp(object, "children", "Badge")}
      </span>
    </div>
  );
}

function buttonExport(object: UiComponentObject): CanvasUiTsxSnippet {
  const variant = enumProp(object, "variant", buttonVariants, object.variant ?? "primary");
  const size = enumProp(object, "size", buttonSizes, "md");
  return {
    imports: [],
    jsx: `<button className=${JSON.stringify(`generated-button generated-button-${variant} generated-button-${size}`)}${jsxAttr("disabled", booleanProp(object, "disabled"))}>${jsxText(stringProp(object, "children", "Button"))}</button>`,
  };
}

function cardExport(object: UiComponentObject): CanvasUiTsxSnippet {
  const tone = enumProp(object, "tone", cardTones, object.variant ?? "default");
  return {
    imports: [],
    jsx: `<article className=${JSON.stringify(`generated-card generated-card-${tone}`)}><strong>${jsxText(stringProp(object, "title", "Card title"))}</strong><p>${jsxText(stringProp(object, "body", "Card body copy."))}</p></article>`,
  };
}

function inputExport(object: UiComponentObject): CanvasUiTsxSnippet {
  return {
    imports: [],
    jsx: `<label className="generated-field"><span>${jsxText(stringProp(object, "label", "Label"))}</span><input placeholder=${JSON.stringify(stringProp(object, "placeholder", "Placeholder"))}${jsxAttr("disabled", booleanProp(object, "disabled"))} readOnly /></label>`,
  };
}

function badgeExport(object: UiComponentObject): CanvasUiTsxSnippet {
  const tone = enumProp(object, "tone", badgeTones, object.variant ?? "neutral");
  return {
    imports: [],
    jsx: `<span className=${JSON.stringify(`generated-badge generated-badge-${tone}`)}>${jsxText(stringProp(object, "children", "Badge"))}</span>`,
  };
}

export function defineCanvasUiComponentCatalog(
  definitions: readonly CanvasUiComponentDefinition[],
): readonly CanvasUiComponentDefinition[] {
  const seen = new Set<string>();
  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      throw new Error(`Duplicate UI component id "${definition.id}".`);
    }
    seen.add(definition.id);
  }
  return definitions;
}

const catalog = defineCanvasUiComponentCatalog([
  {
    id: "Button",
    label: "Button",
    description: "Presentational call-to-action button.",
    defaultProps: { children: "Start building", variant: "primary", size: "md", disabled: false },
    propSchema: [
      { name: "children", label: "Children", kind: "string" },
      { name: "variant", label: "Variant", kind: "enum", options: buttonVariants },
      { name: "size", label: "Size", kind: "enum", options: buttonSizes },
      { name: "disabled", label: "Disabled", kind: "boolean" },
    ],
    preview: ButtonPreview,
    export: buttonExport,
  },
  {
    id: "Card",
    label: "Card",
    description: "Compact content card with title and body copy.",
    defaultProps: {
      title: "Canvas-native UI",
      body: "Structured components can lower to code.",
      tone: "elevated",
    },
    propSchema: [
      { name: "title", label: "Title", kind: "string" },
      { name: "body", label: "Body", kind: "string" },
      { name: "tone", label: "Tone", kind: "enum", options: cardTones },
    ],
    preview: CardPreview,
    export: cardExport,
  },
  {
    id: "Input",
    label: "Input",
    description: "Read-only field preview for generated form shells.",
    defaultProps: { label: "Email", placeholder: "you@example.com", disabled: false },
    propSchema: [
      { name: "label", label: "Label", kind: "string" },
      { name: "placeholder", label: "Placeholder", kind: "string" },
      { name: "disabled", label: "Disabled", kind: "boolean" },
    ],
    preview: InputPreview,
    export: inputExport,
  },
  {
    id: "Badge",
    label: "Badge",
    description: "Small semantic status badge.",
    defaultProps: { children: "Preview", tone: "neutral" },
    propSchema: [
      { name: "children", label: "Children", kind: "string" },
      { name: "tone", label: "Tone", kind: "enum", options: badgeTones },
    ],
    preview: BadgePreview,
    export: badgeExport,
  },
]);

export function listCanvasUiComponents(): readonly CanvasUiComponentDefinition[] {
  return catalog;
}

export function getCanvasUiComponentDefinition(id: string): CanvasUiComponentDefinition {
  const definition = catalog.find((component) => component.id === id);
  if (!definition) throw new Error(`Unknown UI component "${id}".`);
  return definition;
}
