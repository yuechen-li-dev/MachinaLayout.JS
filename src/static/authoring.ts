import type { StaticNode, StaticPage, StaticTabs, StaticTabsItem } from "./types";
import { formatStaticMachineDiagnostics, validateStaticPage, validateStaticTabs } from "./validate";

function assertNoStaticErrors(diagnostics: ReturnType<typeof validateStaticTabs>): void {
  const errors = diagnostics.filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(formatStaticMachineDiagnostics(errors));
  }
}

function cloneTabsItem(item: StaticTabsItem): StaticTabsItem {
  return {
    id: item.id,
    label: item.label,
    content:
      typeof item.content === "string"
        ? item.content
        : {
            kind: "html",
            html: item.content.html,
          },
  };
}

export function tabs(input: {
  id: string;
  initial: string;
  tabs: readonly StaticTabsItem[];
}): StaticTabs {
  const output: StaticTabs = {
    kind: "tabs",
    id: input.id,
    initial: input.initial,
    tabs: input.tabs.map(cloneTabsItem),
  };
  assertNoStaticErrors(validateStaticTabs(output));
  return output;
}

export function page(input: { title: string; body: readonly StaticNode[] }): StaticPage {
  const output: StaticPage = {
    kind: "page",
    title: input.title,
    body: input.body.map((node) => {
      if (node.kind === "tabs") {
        return tabs(node);
      }
      return node;
    }),
  };
  assertNoStaticErrors(validateStaticPage(output));
  return output;
}

export const staticPage = page;

export const H = {
  tabs,
  page,
  staticPage,
} as const;
