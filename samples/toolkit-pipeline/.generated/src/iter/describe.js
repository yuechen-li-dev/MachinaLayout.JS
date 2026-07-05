function getEnvKeys(env) {
    if ((typeof env !== "object" || env === null) && typeof env !== "function") {
        return [];
    }
    return Object.keys(env);
}
export function describeIterMachine(machine) {
    return {
        kind: "iterMachine",
        id: machine.id,
        description: machine.description,
        envKeys: getEnvKeys(machine.env),
        hasStep: typeof machine.step === "function",
    };
}
export function formatIterMachineDescription(description) {
    const lines = [`Iter machine: ${description.id}`];
    if (description.description) {
        lines.push(`Description: ${description.description}`);
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
    lines.push(`Has step: ${description.hasStep ? "yes" : "no"}`);
    return lines.join("\n");
}
