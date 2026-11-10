import { Text } from "../text/utilities";
import type { IterMachine, IterMachineDescription } from "./types";

function getEnvKeys(env: unknown): readonly string[] {
  if ((typeof env !== "object" || env === null) && typeof env !== "function") {
    return [];
  }

  return Object.keys(env);
}

export function describeIterMachine<TEnv, TCursor, TYield, TReturn, TError>(
  machine: IterMachine<TEnv, TCursor, TYield, TReturn, TError>,
): IterMachineDescription {
  return {
    kind: "iterMachine",
    id: machine.id,
    description: machine.description,
    envKeys: getEnvKeys(machine.env),
    hasStep: typeof machine.step === "function",
  };
}

export function formatIterMachineDescription(description: IterMachineDescription): string {
  return Text.lines(
    `Iter machine: ${description.id}`,
    description.description && `Description: ${description.description}`,
    Text.list("Environment keys:", description.envKeys, { empty: "Environment keys: none" }),
    `Has step: ${description.hasStep ? "yes" : "no"}`,
  );
}
