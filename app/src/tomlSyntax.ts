import { parse, stringify } from "smol-toml";

export type ParsedTomlValue = unknown;

export function parseTomlDocument(source: string): ParsedTomlValue {
  return parse(source);
}

export function stringifyTomlDocument(value: unknown): string {
  return stringify(value as Record<string, unknown>);
}
