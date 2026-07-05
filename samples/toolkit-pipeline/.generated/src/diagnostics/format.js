export function format(diagnostics, options = {}) {
    if (diagnostics.length === 0) {
        return "No diagnostics.";
    }
    const includeSeverity = options.includeSeverity ?? true;
    const includeSource = options.includeSource ?? true;
    const includePath = options.includePath ?? true;
    return diagnostics
        .map((diagnostic) => {
        const headerParts = [
            includeSeverity ? diagnostic.severity : undefined,
            diagnostic.code,
            includePath && diagnostic.path ? `at ${diagnostic.path}` : undefined,
        ].filter((part) => part !== undefined);
        const lines = [headerParts.join(" ")];
        if (includeSource && diagnostic.source) {
            lines.push(`  source: ${diagnostic.source}`);
        }
        lines.push(`  ${diagnostic.message}`);
        for (const detail of diagnostic.details ?? []) {
            lines.push(`  - ${detail}`);
        }
        return lines.join("\n");
    })
        .join("\n\n");
}
