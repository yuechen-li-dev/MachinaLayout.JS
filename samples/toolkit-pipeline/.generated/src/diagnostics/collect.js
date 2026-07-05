const severityRank = {
    error: 0,
    warning: 1,
    info: 2,
};
function compareStrings(left, right) {
    return (left ?? "").localeCompare(right ?? "");
}
export function collect(...groups) {
    const diagnostics = [];
    for (const group of groups) {
        if (group === undefined) {
            continue;
        }
        diagnostics.push(...group);
    }
    return diagnostics;
}
export function hasErrors(diagnostics) {
    return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
export function hasWarnings(diagnostics) {
    return diagnostics.some((diagnostic) => diagnostic.severity === "warning");
}
export function sort(diagnostics) {
    return [...diagnostics].sort((left, right) => {
        const severityDifference = severityRank[left.severity] - severityRank[right.severity];
        if (severityDifference !== 0) {
            return severityDifference;
        }
        return (compareStrings(left.source, right.source) ||
            compareStrings(left.path, right.path) ||
            left.code.localeCompare(right.code) ||
            left.message.localeCompare(right.message));
    });
}
export function groupBySource(diagnostics) {
    const groups = {};
    for (const diagnostic of diagnostics) {
        const source = diagnostic.source ?? "(unknown)";
        groups[source] ??= [];
        groups[source].push(diagnostic);
    }
    return groups;
}
