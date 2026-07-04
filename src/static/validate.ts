import type {
  StaticAccordion,
  StaticContent,
  StaticDispatch,
  StaticPage,
  StaticTabs,
  StaticTimeline,
} from "./types";

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

function isSafeCssCustomPropertyValue(value: string): boolean {
  return value.trim().length > 0 && !/[;{}<>]/.test(value);
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

export function validateStaticAccordion(
  accordion: StaticAccordion,
  path = "accordion",
): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  const seenItemIds = new Set<string>();
  const seenGeneratedInputIds = new Set<string>();
  let defaultOpenCount = 0;

  if (!isSafeStaticId(accordion.id)) {
    diagnostics.push(
      diagnostic(
        "error",
        "InvalidStaticId",
        `Accordion id "${accordion.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
        `${path}.id`,
      ),
    );
  }

  if (accordion.items.length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyAccordion", "Accordion must contain at least one item.", path),
    );
  }

  for (const [index, item] of accordion.items.entries()) {
    const itemPath = `${path}.items[${index}]`;
    if (!isSafeStaticId(item.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "InvalidStaticId",
          `Accordion item id "${item.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
          `${itemPath}.id`,
        ),
      );
    }
    if (seenItemIds.has(item.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "DuplicateStaticId",
          `Duplicate accordion item id "${item.id}".`,
          `${itemPath}.id`,
        ),
      );
    }
    seenItemIds.add(item.id);

    const generatedInputId = `${accordion.id}-${item.id}`;
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
        diagnostic(
          "error",
          "EmptyLabel",
          "Accordion item label must be non-empty.",
          `${itemPath}.label`,
        ),
      );
    }
    if (item.defaultOpen === true) {
      defaultOpenCount += 1;
    }
    diagnostics.push(...validateStaticContent(item.content, `${itemPath}.content`));
  }

  if (!accordion.allowMultiple && defaultOpenCount > 1) {
    diagnostics.push(
      diagnostic(
        "error",
        "MultipleDefaultOpenItems",
        "Single-open accordion mode can only have one defaultOpen item.",
        `${path}.items`,
      ),
    );
  }

  return diagnostics;
}

export function validateStaticTimeline(
  timeline: StaticTimeline,
  path = "timeline",
): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  const seenStepIds = new Set<string>();

  if (!isSafeStaticId(timeline.id)) {
    diagnostics.push(
      diagnostic(
        "error",
        "InvalidStaticId",
        `Timeline id "${timeline.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
        `${path}.id`,
      ),
    );
  }

  if (timeline.steps.length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyTimeline", "Timeline must contain at least one step.", path),
    );
  }

  if (!Number.isFinite(timeline.durationMs) || timeline.durationMs <= 0) {
    diagnostics.push(
      diagnostic(
        "error",
        "InvalidTimelineDuration",
        "Timeline durationMs must be a positive finite number.",
        `${path}.durationMs`,
      ),
    );
  }

  for (const [index, step] of timeline.steps.entries()) {
    const stepPath = `${path}.steps[${index}]`;
    if (!isSafeStaticId(step.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "InvalidStaticId",
          `Timeline step id "${step.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
          `${stepPath}.id`,
        ),
      );
    }
    if (seenStepIds.has(step.id)) {
      diagnostics.push(
        diagnostic(
          "error",
          "DuplicateStaticId",
          `Duplicate timeline step id "${step.id}".`,
          `${stepPath}.id`,
        ),
      );
    }
    seenStepIds.add(step.id);

    if (step.label.trim().length === 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "EmptyLabel",
          "Timeline step label must be non-empty.",
          `${stepPath}.label`,
        ),
      );
    }

    if (step.accent !== undefined && !isSafeCssCustomPropertyValue(step.accent)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "InvalidTimelineAccent",
          "Timeline step accent should be a non-empty CSS color token.",
          `${stepPath}.accent`,
        ),
      );
    }

    diagnostics.push(...validateStaticContent(step.body, `${stepPath}.body`));
  }

  return diagnostics;
}

function dispatchInputId(dispatch: StaticDispatch, stateId: string): string {
  return `${dispatch.id}-state-${stateId}`;
}

export function validateStaticDispatch(
  dispatch: StaticDispatch,
  path = "dispatch",
): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  const stateEntries = Object.entries(dispatch.states);
  const stateIds = new Set(stateEntries.map(([stateId]) => stateId));
  const seenGeneratedInputIds = new Set<string>();
  const reachableStateIds = new Set<string>();
  const pendingStateIds: string[] = [];

  if (!isSafeStaticId(dispatch.id)) {
    diagnostics.push(
      diagnostic(
        "error",
        "InvalidStaticId",
        `Dispatch id "${dispatch.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
        `${path}.id`,
      ),
    );
  }

  if (stateEntries.length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyDispatch", "Dispatch must contain at least one state.", path),
    );
  }

  if (!stateIds.has(dispatch.initial)) {
    diagnostics.push(
      diagnostic(
        "error",
        "MissingInitialState",
        `Initial dispatch state "${dispatch.initial}" must refer to an existing state id.`,
        `${path}.initial`,
      ),
    );
  } else {
    pendingStateIds.push(dispatch.initial);
    reachableStateIds.add(dispatch.initial);
  }

  for (const [stateId, state] of stateEntries) {
    const statePath = `${path}.states.${stateId}`;
    if (!isSafeStaticId(stateId)) {
      diagnostics.push(
        diagnostic(
          "error",
          "InvalidStaticId",
          `Dispatch state id "${stateId}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
          `${statePath}.id`,
        ),
      );
    }

    const generatedInputId = dispatchInputId(dispatch, stateId);
    if (seenGeneratedInputIds.has(generatedInputId)) {
      diagnostics.push(
        diagnostic(
          "error",
          "DuplicateStaticId",
          `Duplicate generated input id "${generatedInputId}".`,
          `${statePath}.id`,
        ),
      );
    }
    seenGeneratedInputIds.add(generatedInputId);

    if (state.title.trim().length === 0) {
      diagnostics.push(
        diagnostic(
          "error",
          "EmptyStateTitle",
          "Dispatch state title must be non-empty.",
          `${statePath}.title`,
        ),
      );
    }

    if (state.body !== undefined) {
      diagnostics.push(...validateStaticContent(state.body, `${statePath}.body`));
    }

    const seenActionIds = new Set<string>();
    for (const [actionIndex, action] of (state.actions ?? []).entries()) {
      const actionPath = `${statePath}.actions[${actionIndex}]`;
      if (!isSafeStaticId(action.id)) {
        diagnostics.push(
          diagnostic(
            "error",
            "InvalidStaticId",
            `Dispatch action id "${action.id}" must match /^[A-Za-z][A-Za-z0-9_-]*$/.`,
            `${actionPath}.id`,
          ),
        );
      }
      if (seenActionIds.has(action.id)) {
        diagnostics.push(
          diagnostic(
            "error",
            "DuplicateActionId",
            `Duplicate dispatch action id "${action.id}" within state "${stateId}".`,
            `${actionPath}.id`,
          ),
        );
      }
      seenActionIds.add(action.id);

      if (action.label.trim().length === 0) {
        diagnostics.push(
          diagnostic(
            "error",
            "EmptyActionLabel",
            "Dispatch action label must be non-empty.",
            `${actionPath}.label`,
          ),
        );
      }

      if (!stateIds.has(action.to)) {
        diagnostics.push(
          diagnostic(
            "error",
            "MissingActionTarget",
            `Dispatch action "${action.id}" targets missing state "${action.to}".`,
            `${actionPath}.to`,
          ),
        );
      }

      if ("kind" in action) {
        diagnostics.push(
          diagnostic(
            "error",
            "UnsupportedActionKind",
            "Static dispatch M32d only supports transition actions with id, label, and to.",
            actionPath,
          ),
        );
      }
    }
  }

  while (pendingStateIds.length > 0) {
    const stateId = pendingStateIds.shift();
    if (stateId === undefined) {
      continue;
    }
    for (const action of dispatch.states[stateId]?.actions ?? []) {
      if (stateIds.has(action.to) && !reachableStateIds.has(action.to)) {
        reachableStateIds.add(action.to);
        pendingStateIds.push(action.to);
      }
    }
  }

  for (const [stateId] of stateEntries) {
    if (!reachableStateIds.has(stateId) && stateIds.has(dispatch.initial)) {
      diagnostics.push(
        diagnostic(
          "warning",
          "UnreachableStaticState",
          `Dispatch state "${stateId}" is not reachable from initial state "${dispatch.initial}".`,
          `${path}.states.${stateId}`,
        ),
      );
    }
  }

  return diagnostics;
}

function collectGeneratedHtmlIds(node: StaticPage["body"][number]): string[] {
  if (node.kind === "tabs") {
    return [node.id, ...node.tabs.map((item) => `${node.id}-${item.id}`)];
  }
  if (node.kind === "accordion") {
    return [node.id, ...node.items.map((item) => `${node.id}-${item.id}`)];
  }
  if (node.kind === "timeline") {
    return [node.id];
  }
  if (node.kind === "dispatch") {
    return [node.id, ...Object.keys(node.states).map((stateId) => dispatchInputId(node, stateId))];
  }
  return [];
}

export function validateStaticPage(page: StaticPage): StaticMachineDiagnostic[] {
  const diagnostics: StaticMachineDiagnostic[] = [];
  const seenGeneratedInputIds = new Set<string>();
  if (page.title.trim().length === 0) {
    diagnostics.push(
      diagnostic("error", "EmptyTitle", "Static page title must be non-empty.", "title"),
    );
  }
  for (const [index, node] of page.body.entries()) {
    if (node.kind === "tabs") {
      diagnostics.push(...validateStaticTabs(node, `body[${index}]`));
    }
    if (node.kind === "accordion") {
      diagnostics.push(...validateStaticAccordion(node, `body[${index}]`));
    }
    if (node.kind === "timeline") {
      diagnostics.push(...validateStaticTimeline(node, `body[${index}]`));
    }
    if (node.kind === "dispatch") {
      diagnostics.push(...validateStaticDispatch(node, `body[${index}]`));
    }
    for (const generatedHtmlId of collectGeneratedHtmlIds(node)) {
      if (seenGeneratedInputIds.has(generatedHtmlId)) {
        diagnostics.push(
          diagnostic(
            "error",
            "DuplicateStaticId",
            `Duplicate generated HTML id "${generatedHtmlId}" across static page.`,
            `body[${index}]`,
          ),
        );
      }
      seenGeneratedInputIds.add(generatedHtmlId);
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
