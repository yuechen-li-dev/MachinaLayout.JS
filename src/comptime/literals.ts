import {
  artifacts,
  checkArtifacts,
  formatArtifactDiagnostics,
  generateArtifacts,
  json,
  memoryFs,
  module,
  text,
  writeArtifacts,
} from "./artifacts";
import { exportConst, toTsLiteral } from "./emit";

/** Typed `Object.keys` for literal objects. */
export function keys<const TObject extends Record<PropertyKey, unknown>>(
  value: TObject,
): Array<Extract<keyof TObject, string>> {
  return Object.keys(value) as Array<Extract<keyof TObject, string>>;
}

export const CT = {
  keys,
  artifacts,
  text,
  json,
  module,
  ts: { exportConst, literal: toTsLiteral },
  generate: generateArtifacts,
  check: checkArtifacts,
  write: writeArtifacts,
  formatDiagnostics: formatArtifactDiagnostics,
  memoryFs,
} as const;
