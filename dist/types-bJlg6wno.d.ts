import { a as Rect } from './types-CYgsjDai.js';

type MachinaDomSummaryNode = {
    nodeId?: string;
    view?: string;
    slot?: string;
    debugLabel?: string;
    layer?: string;
    tagName: string;
    role?: string;
    ariaLabel?: string;
    textExcerpt?: string;
    rect: Rect;
    children: MachinaDomSummaryNode[];
};
type MachinaDomSummary = {
    schemaVersion: 1;
    rootSelector?: string;
    generatedAt?: string;
    nodes: MachinaDomSummaryNode[];
};
type SummarizeMachinaDomOptions = {
    root?: ParentNode | Element | Document;
    selector?: string;
    includeTextExcerpt?: boolean;
    includeA11y?: boolean;
    maxTextLength?: number;
    includeEmptyNodes?: boolean;
    generatedAt?: string;
};

export type { MachinaDomSummary as M, SummarizeMachinaDomOptions as S, MachinaDomSummaryNode as a };
