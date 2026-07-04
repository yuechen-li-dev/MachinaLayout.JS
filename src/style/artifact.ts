import { serializeMachinaStyleSheet } from "./serialize";
import type {
  MachinaStyleArtifact,
  MachinaStyleSheet,
  SerializeMachinaStyleOptions,
} from "./types";

export function createMachinaStyleArtifact(
  sheet: MachinaStyleSheet,
  options: {
    path?: string;
    includeHeader?: boolean;
    responsiveProfile?: SerializeMachinaStyleOptions["responsiveProfile"];
  } = {},
): MachinaStyleArtifact {
  const { path = "generated.css", includeHeader, responsiveProfile } = options;

  return {
    path,
    css: serializeMachinaStyleSheet(sheet, { includeHeader, responsiveProfile }),
  };
}

export function assertMachinaStyleArtifactText(
  sheet: MachinaStyleSheet,
  cssText: string,
  options: SerializeMachinaStyleOptions = {},
): {
  ok: boolean;
  expected: string;
  actual: string;
} {
  const expected = serializeMachinaStyleSheet(sheet, options);

  return {
    ok: expected === cssText,
    expected,
    actual: cssText,
  };
}
