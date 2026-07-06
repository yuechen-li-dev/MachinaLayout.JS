import type { MachinaStyleTokens, MachinaTokenGroup, MachinaTokenReference } from "./types";

export const MACHINA_TOKEN_GROUPS = ["color", "space", "radius", "font", "shadow"] as const;

type TokenGroupName = (typeof MACHINA_TOKEN_GROUPS)[number];

type ParsedMachinaTokenReference = {
  group: string;
  key: string;
  source: "string" | "object";
};

export function isMachinaTokenGroup(value: unknown): value is MachinaTokenGroup {
  return typeof value === "string" && MACHINA_TOKEN_GROUPS.includes(value as TokenGroupName);
}

export function isMachinaTokenReference(value: unknown): value is MachinaTokenReference {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "token" &&
    isMachinaTokenGroup((value as { group?: unknown }).group) &&
    typeof (value as { key?: unknown }).key === "string"
  );
}

export function looksLikeMachinaTokenReference(value: unknown): value is {
  kind: "token";
  group: unknown;
  key: unknown;
} {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "token"
  );
}

export function parseMachinaTokenReference(
  value: unknown,
): ParsedMachinaTokenReference | undefined {
  if (typeof value === "string") {
    const match = /^([a-z]+)\.(.+)$/.exec(value);
    if (!match) {
      return undefined;
    }
    return {
      group: match[1],
      key: match[2],
      source: "string",
    };
  }

  if (looksLikeMachinaTokenReference(value)) {
    return {
      group: String(value.group ?? ""),
      key: typeof value.key === "string" ? value.key : String(value.key ?? ""),
      source: "object",
    };
  }

  return undefined;
}

export function createMachinaTokenReference(
  group: MachinaTokenGroup,
  key: string,
): MachinaTokenReference {
  if (!isMachinaTokenGroup(group)) {
    throw new Error(`Unknown MachinaStyle token group "${String(group)}".`);
  }
  if (key.trim().length === 0) {
    throw new Error("MachinaStyle token key must be non-empty.");
  }
  return Object.freeze({
    kind: "token",
    group,
    key,
  });
}

export function describeMachinaTokenReference(value: unknown): string {
  const parsed = parseMachinaTokenReference(value);
  if (!parsed) {
    return String(value);
  }
  if (parsed.source === "string") {
    return `"${parsed.group}.${parsed.key}"`;
  }
  return `{ kind: "token", group: "${parsed.group}", key: "${parsed.key}" }`;
}

export function tokenVariableName(group: string, key: string): string {
  return `--${toKebabName(group)}-${toKebabName(key)}`;
}

export function tokenReferenceToCssVar(value: unknown): string | undefined {
  const parsed = parseMachinaTokenReference(value);
  if (!parsed || !isMachinaTokenGroup(parsed.group) || parsed.key.length === 0) {
    return undefined;
  }
  return `var(${tokenVariableName(parsed.group, parsed.key)})`;
}

export function tokenExists(tokens: MachinaStyleTokens | undefined, value: unknown): boolean {
  const parsed = parseMachinaTokenReference(value);
  if (!parsed || !isMachinaTokenGroup(parsed.group) || parsed.key.length === 0) {
    return false;
  }
  const groupTokens = tokens?.[parsed.group] as Record<string, unknown> | undefined;
  return !!groupTokens && Object.getOwnPropertyDescriptor(groupTokens, parsed.key) !== undefined;
}

export function readTokenValue(
  tokens: MachinaStyleTokens | undefined,
  value: unknown,
): unknown | undefined {
  const parsed = parseMachinaTokenReference(value);
  if (!parsed || !isMachinaTokenGroup(parsed.group) || parsed.key.length === 0) {
    return undefined;
  }
  const groupTokens = tokens?.[parsed.group] as Record<string, unknown> | undefined;
  return groupTokens?.[parsed.key];
}

function toKebabName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[.\s_]+/g, "-")
    .toLowerCase();
}
