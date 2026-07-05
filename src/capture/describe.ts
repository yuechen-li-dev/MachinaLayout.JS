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
  const lines = [`Task: ${description.id}`];
  if (description.description) {
    lines.push(`Description: ${description.description}`);
  }
  if (description.envKeys.length > 0) {
    lines.push("Environment keys:");
    for (const key of description.envKeys) {
      lines.push(`- ${key}`);
    }
  } else {
    lines.push("Environment keys: none");
  }
  return lines.join("\n");
}
