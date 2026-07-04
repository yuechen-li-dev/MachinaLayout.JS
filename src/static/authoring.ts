import type {
  StaticAccordion,
  StaticAccordionItem,
  StaticDispatch,
  StaticDispatchAction,
  StaticDispatchState,
  StaticNode,
  StaticPage,
  StaticTabs,
  StaticTabsItem,
  StaticTimeline,
  StaticTimelineStep,
} from "./types";
import {
  formatStaticMachineDiagnostics,
  validateStaticAccordion,
  validateStaticDispatch,
  validateStaticPage,
  validateStaticTabs,
  validateStaticTimeline,
} from "./validate";

function assertNoStaticErrors(diagnostics: ReturnType<typeof validateStaticPage>): void {
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

function cloneAccordionItem(item: StaticAccordionItem): StaticAccordionItem {
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
    defaultOpen: item.defaultOpen,
  };
}

function cloneTimelineStep(step: StaticTimelineStep): StaticTimelineStep {
  return {
    id: step.id,
    label: step.label,
    body:
      typeof step.body === "string"
        ? step.body
        : {
            kind: "html",
            html: step.body.html,
          },
    accent: step.accent,
  };
}

function cloneDispatchAction(action: StaticDispatchAction): StaticDispatchAction {
  return {
    id: action.id,
    label: action.label,
    to: action.to,
  };
}

function cloneDispatchState(state: StaticDispatchState): StaticDispatchState {
  return {
    title: state.title,
    body:
      state.body === undefined
        ? undefined
        : typeof state.body === "string"
          ? state.body
          : {
              kind: "html",
              html: state.body.html,
            },
    actions: state.actions?.map(cloneDispatchAction),
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

export function accordion(input: {
  id: string;
  allowMultiple?: boolean;
  items: readonly StaticAccordionItem[];
}): StaticAccordion {
  const output: StaticAccordion = {
    kind: "accordion",
    id: input.id,
    allowMultiple: input.allowMultiple ?? true,
    items: input.items.map(cloneAccordionItem),
  };
  assertNoStaticErrors(validateStaticAccordion(output));
  return output;
}

export function timeline(input: {
  id: string;
  title?: string;
  durationMs?: number;
  loop?: boolean;
  steps: readonly StaticTimelineStep[];
}): StaticTimeline {
  const output: StaticTimeline = {
    kind: "timeline",
    id: input.id,
    title: input.title,
    durationMs: input.durationMs ?? 8000,
    loop: input.loop ?? true,
    steps: input.steps.map(cloneTimelineStep),
  };
  assertNoStaticErrors(validateStaticTimeline(output));
  return output;
}

export function dispatch(input: {
  id: string;
  initial: string;
  states: Record<string, StaticDispatchState>;
}): StaticDispatch {
  const output: StaticDispatch = {
    kind: "dispatch",
    id: input.id,
    initial: input.initial,
    states: Object.fromEntries(
      Object.entries(input.states).map(([stateId, state]) => [stateId, cloneDispatchState(state)]),
    ),
  };
  assertNoStaticErrors(validateStaticDispatch(output));
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
      if (node.kind === "accordion") {
        return accordion(node);
      }
      if (node.kind === "timeline") {
        return timeline(node);
      }
      if (node.kind === "dispatch") {
        return dispatch(node);
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
  accordion,
  timeline,
  dispatch,
  page,
  staticPage,
} as const;
