export type StaticMachineId = string;

export type StaticContent =
  | string
  | {
      kind: "html";
      html: string;
    };

export type StaticTabsItem = {
  id: StaticMachineId;
  label: string;
  content: StaticContent;
};

export type StaticTabs = {
  kind: "tabs";
  id: StaticMachineId;
  initial: StaticMachineId;
  tabs: readonly StaticTabsItem[];
};

export type StaticAccordionItem = {
  id: StaticMachineId;
  label: string;
  content: StaticContent;
  defaultOpen?: boolean;
};

export type StaticAccordion = {
  kind: "accordion";
  id: StaticMachineId;
  allowMultiple: boolean;
  items: readonly StaticAccordionItem[];
};

export type StaticTimelineStep = {
  id: StaticMachineId;
  label: string;
  body: StaticContent;
  accent?: string;
};

export type StaticTimeline = {
  kind: "timeline";
  id: StaticMachineId;
  title?: string;
  durationMs: number;
  loop: boolean;
  steps: readonly StaticTimelineStep[];
};

export type StaticDispatchAction = {
  id: StaticMachineId;
  label: string;
  to: StaticMachineId;
};

export type StaticDispatchState = {
  title: string;
  body?: StaticContent;
  actions?: readonly StaticDispatchAction[];
};

export type StaticDispatch = {
  kind: "dispatch";
  id: StaticMachineId;
  initial: StaticMachineId;
  states: Record<string, StaticDispatchState>;
};

export type StaticHttpMethod = "GET" | "POST";

export type StaticHttpTarget = "self" | "blank";

export type StaticHttpFieldKind =
  | "text"
  | "email"
  | "number"
  | "password"
  | "search"
  | "url"
  | "tel"
  | "textarea"
  | "select"
  | "hidden"
  | "checkbox"
  | "radio";

export type StaticHttpFieldOption = {
  value: string;
  label: string;
};

export type StaticHttpField = {
  id: string;
  name?: string;
  label?: string;
  kind: StaticHttpFieldKind;
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  pattern?: string;
  autocomplete?: string;
  options?: readonly StaticHttpFieldOption[];
};

export type StaticHttpAction = {
  kind: "httpAction";
  id: string;
  method: StaticHttpMethod;
  action: string;
  title?: string;
  description?: StaticContent;
  target?: StaticHttpTarget;
  submitLabel?: string;
  fields: readonly StaticHttpField[];
};

export type StaticHttpLink = {
  kind: "httpLink";
  id: string;
  href: string;
  label: string;
  target?: StaticHttpTarget;
};

export type StaticNode =
  | StaticTabs
  | StaticAccordion
  | StaticTimeline
  | StaticDispatch
  | StaticHttpAction
  | StaticHttpLink;

export type StaticPage = {
  kind: "page";
  title: string;
  body: readonly StaticNode[];
};

export type StaticArtifactFile = {
  path: string;
  text: string;
  contentType: string;
};

export type StaticHtmlArtifact = {
  files: readonly StaticArtifactFile[];
};
