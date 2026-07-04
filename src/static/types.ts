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

export type StaticNode = StaticTabs;

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
