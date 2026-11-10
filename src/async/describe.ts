import { Text } from "../text/utilities";
import type { AsyncTask, AsyncTaskDescription } from "./types";

function getEnvKeys(env: unknown): readonly string[] {
  if ((typeof env !== "object" || env === null) && typeof env !== "function") {
    return [];
  }

  return Object.keys(env);
}

export function describeAsyncTask<TEnv, TInput, TOutput, TError>(
  task: AsyncTask<TEnv, TInput, TOutput, TError>,
): AsyncTaskDescription {
  return {
    kind: "asyncTask",
    id: task.id,
    description: task.description,
    envKeys: getEnvKeys(task.env),
    hasRun: typeof task.run === "function",
    timeoutMs: task.timeoutMs,
  };
}

export function formatAsyncTaskDescription(description: AsyncTaskDescription): string {
  return Text.lines(
    `Async task: ${description.id}`,
    description.description && `Description: ${description.description}`,
    description.timeoutMs !== undefined && `Timeout: ${description.timeoutMs}ms`,
    Text.list("Environment keys:", description.envKeys, { empty: "Environment keys: none" }),
  );
}
