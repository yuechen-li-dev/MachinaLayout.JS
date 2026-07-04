import type { StaticContent, StaticPage, StaticTabs } from "./types";

export type StaticMachineDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
};

const SAFE_STATIC_ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

function diagnostic(
  severity: StaticMachineDiagnostic["severity"],
  code: string,
  message: string,
  path?: string,
): StaticMachineDiagnostic {
  return { severity, code, message, path };
}

export function isSafeStaticId(id: string): boolean {
  return SAFE_STATIC_ID_PATTERN.test(id);
}

function validateStaticContent(content: StaticContent, path: string): StaticMachineDiagnostic[] {
  if (typeof content === "string") {
    return [];
  }
  return [
    diagnostic(
      "warning",
      "UnsafeRawHtmlContent",
      "Raw HTML static content is inserted as trusted HTML and must already be sanitized.",
      path,
    ),
  ];
}

export function validateStaticTabs(tabs: StaticTabs, path = "tabs"): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  const seenTabIds = new Set<string>();
  const seenGeneratedInputIds = new Set<string>();

  if (!isSafeStaticId(tabs.id)) {
    diagnostics.push(
      diagnostic(
        "error",
        "InvalidStaticId",
        `Tabs id "${tabs.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
        `${path}.id`,
      ),
    );
  }

  if (tabs.tabs.length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyTabs", "Tabs must contain at least one item.", path),
    );
  }

  for (const [index, item] of tabs.tabs.entries()) {
    const itemPath = `${path}.tabs[${index}]`;
    if (!isSafeStaticId(item.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "InvalidStaticId",
          `Tab id "${item.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
          `${itemPath}.id`,
        ),
      );
    }
    if (seenTabIds.has(item.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "DuplicateStaticId",
          `Duplicate tab id "${item.id}".`,
          `${itemPath}.id`,
        ),
      );
    }
    seenTabIds.add(item.id);

    const generatedInputId = `${tabs.id}-${item.id}`;
    if (seenGeneratedInputIds.has(generatedInputId)) {
      diagnostics.push(
        diagnostic(
          "error",
          "DuplicateStaticId",
          `Duplicate generated input id "${generatedInputId}".`,
          `${itemPath}.id`,
        ),
      );
    }
    seenGeneratedInputIds.add(generatedInputId);

    if (item.label.trim().length === 0) {
      diagnostics.push(
        diagnostic("error", "EmptyLabel", "Tab label must be non-empty.", `${itemPath}.label`),
      );
    }
    diagnostics.push(...validateStaticContent(item.content, `${itemPath}.content`));
  }

  if (!seenTabIds.has(tabs.initial)) {
    diagnostics.push(
      diagnostic(
        "error",
        "MissingInitialState",
        `Initial tab "${tabs.initial}" must refer to an existing tab id.`,
        `${path}.initial`,
      ),
    );
  }

  return diagnostics;
}

export function validateStaticPage(page: StaticPage): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  if (page.title.trim().length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyTitle", "Static page title must be non-empty.", "title"),
    );
  }
  for (const [index, node] of page.body.entries()) {
    if (node.kind === "tabs") {
      diagnostics.push(...validateStaticTabs(node, `body[${index}]`));
    }
  }
  return diagnostics;
}

export function formatStaticMachineDiagnostics(
  diagnostics: readonly StaticMachineDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "No static machine diagnostics.";
  }
  return diagnostics
    .map((entry) => {
      const location = entry.path ? ` at ${entry.path}` : "";
      return `[${entry.severity}] ${entry.code}${location}: ${entry.message}`;
    })
    .join("\n");
}
