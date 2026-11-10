/**
 * Building multi-line text without `const lines = []; if (x) lines.push(...)`.
 *
 * A `LinePart` is a line, an omitted line (`false`, `null`, `undefined`, or
 * `""` — so `cond && "text"` is safe), or a nested array of parts. Use
 * `Text.blank` for an intentional empty line.
 */
export type LinePart = string | false | null | undefined | typeof blank | readonly LinePart[];

/** An intentional empty line (plain `""` is treated as "omitted"). */
export const blank: unique symbol = Symbol("Text.blank");

function flatten(parts: readonly LinePart[], out: string[]): string[] {
  for (const part of parts) {
    if (part === blank) {
      out.push("");
    } else if (Array.isArray(part)) {
      flatten(part, out);
    } else if (typeof part === "string" && part !== "") {
      out.push(...part.split("\n"));
    }
  }
  return out;
}

/** Join parts into newline-separated text, skipping omitted parts. */
export function lines(...parts: readonly LinePart[]): string {
  return flatten(parts, []).join("\n");
}

/** Flatten parts to an array of lines (for callers that post-process). */
export function lineArray(...parts: readonly LinePart[]): string[] {
  return flatten(parts, []);
}

/** Indent every line of the given parts. */
export function indent(parts: LinePart, prefix = "  "): readonly string[] {
  return flatten([parts], []).map((line) => (line === "" ? line : `${prefix}${line}`));
}

/**
 * A header followed by its indented body. Omitted entirely when the body is
 * empty, unless `empty` gives a replacement line (e.g. `"Fields: none"`).
 */
export function block(
  header: string,
  body: LinePart,
  options: { readonly indent?: string; readonly empty?: string } = {},
): readonly string[] {
  const inner = flatten([body], []);
  if (inner.length === 0) {
    return options.empty ? [options.empty] : [];
  }
  return [header, ...indent(inner, options.indent)];
}

/**
 * A header followed by bulleted items (`- a`, `- b`). Same empty handling as `block`.
 * Multi-line items continue under the bullet.
 */
export function list(
  header: string,
  items: readonly LinePart[],
  options: { readonly bullet?: string; readonly empty?: string } = {},
): readonly string[] {
  const bullet = options.bullet ?? "- ";
  const pad = " ".repeat(bullet.length);
  const rendered = items.flatMap((item) => {
    const itemLines = flatten([item], []);
    return itemLines.map((line, index) => (index === 0 ? `${bullet}${line}` : `${pad}${line}`));
  });
  if (rendered.length === 0) {
    return options.empty ? [options.empty] : [];
  }
  return [header, ...rendered];
}
