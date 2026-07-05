function getEnvKeys(env) {
    if ((typeof env !== "object" || env === null) && typeof env !== "function") {
        return [];
    }
    return Object.keys(env);
}
export function describeAsyncTask(task) {
    return {
        kind: "asyncTask",
        id: task.id,
        description: task.description,
        envKeys: getEnvKeys(task.env),
        hasRun: typeof task.run === "function",
        timeoutMs: task.timeoutMs,
    };
}
export function formatAsyncTaskDescription(description) {
    const lines = [`Async task: ${description.id}`];
    if (description.description) {
        lines.push(`Description: ${description.description}`);
    }
    if (description.timeoutMs !== undefined) {
        lines.push(`Timeout: ${description.timeoutMs}ms`);
    }
    if (description.envKeys.length > 0) {
        lines.push("Environment keys:");
        for (const key of description.envKeys) {
            lines.push(`- ${key}`);
        }
    }
    else {
        lines.push("Environment keys: none");
    }
    return lines.join("\n");
}
