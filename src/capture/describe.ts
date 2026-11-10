import { Text } from "../text/utilities";
import type { CaptureTask, CaptureTaskDescription } from "./types";

function getEnvKeys(env: unknown): readonly string[] {
  if ((typeof env !== "object" || env === null) && typeof env !== "function") {
    return [];
  }
  return Object.keys(env);
}

export function describeCaptureTask<TEnv, TInput, TOutput>(
  task: CaptureTask<TEnv, TInput, TOutput>,
): CaptureTaskDescription {
  return {
    kind: "task",
    id: task.id,
    description: task.description,
    envKeys: getEnvKeys(task.env),
    hasRun: typeof task.run === "function",
  };
}

export function formatCaptureTaskDescription(description: CaptureTaskDescription): string {
  return Text.lines(
    `Task: ${description.id}`,
    description.description && `Description: ${description.description}`,
    Text.list("Environment keys:", description.envKeys, { empty: "Environment keys: none" }),
  );
}
