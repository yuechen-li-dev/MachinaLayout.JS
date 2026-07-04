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

export type StaticNode = StaticTabs | StaticAccordion | StaticTimeline;

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
