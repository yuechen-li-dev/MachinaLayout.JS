export class MatchEnumError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "MatchEnumError";
        this.code = code;
    }
}
export function matchEnum(value, cases) {
    if (cases === null || typeof cases !== "object") {
        throw new MatchEnumError("InvalidEnumCases", "matchEnum cases must be an object.");
    }
    if (!Object.keys(cases).includes(String(value))) {
        throw new MatchEnumError("MissingEnumCase", `Missing enum case for ${String(value)}.`);
    }
    const handler = cases[value];
    if (typeof handler !== "function") {
        throw new MatchEnumError("InvalidEnumCases", `Enum case for ${String(value)} must be a function.`);
    }
    return handler();
}
