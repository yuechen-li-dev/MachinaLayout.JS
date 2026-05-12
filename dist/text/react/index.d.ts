import React from 'react';
import { M as MachinaTextSpec, a as MachinaTextSource, b as MachinaTextDocument } from '../../types-C4poVJpR.js';

type MachinaTextViewProps = {
    text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
    className?: string;
    style?: React.CSSProperties;
    linkTarget?: React.HTMLAttributeAnchorTarget;
    onLinkClick?: (href: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
    showDiagnostics?: boolean;
};
declare function MachinaTextView(props: MachinaTextViewProps): React.JSX.Element;

export { MachinaTextView, type MachinaTextViewProps };
