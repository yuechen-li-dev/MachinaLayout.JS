export class MatchUnionError extends Error {
    discriminantKey;
    discriminantValue;
    availableCases;
    constructor(discriminantKey, discriminantValue, availableCases) {
        super(`No handler for discriminant ${discriminantKey}=${String(discriminantValue)}. Available cases: ${availableCases.join(", ")}.`);
        this.name = "MatchUnionError";
        this.discriminantKey = discriminantKey;
        this.discriminantValue = discriminantValue;
        this.availableCases = availableCases;
    }
}
function isMatchDiscriminant(value) {
    return typeof value === "string" || typeof value === "number" || typeof value === "symbol";
}
function availableCaseNames(cases) {
    return Reflect.ownKeys(cases).map((key) => String(key));
}
export function matchDiscriminated(value, discriminantKey, cases) {
    const caseNames = availableCaseNames(cases);
    const discriminantValue = value[discriminantKey];
    if (!isMatchDiscriminant(discriminantValue)) {
        throw new MatchUnionError(String(discriminantKey), discriminantValue, caseNames);
    }
    const handler = cases[discriminantValue];
    if (typeof handler !== "function") {
        throw new MatchUnionError(String(discriminantKey), discriminantValue, caseNames);
    }
    return handler(value);
}
export function matchKind(value, cases) {
    return matchDiscriminated(value, "kind", cases);
}
