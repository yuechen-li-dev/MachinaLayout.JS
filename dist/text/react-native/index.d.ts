import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { M as MachinaTextSpec, a as MachinaTextSource, b as MachinaTextDocument } from '../../types-C4poVJpR.js';

type MachinaNativeTextViewProps = {
    text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
    style?: StyleProp<TextStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    linkStyle?: StyleProp<TextStyle>;
    codeStyle?: StyleProp<TextStyle>;
    onLinkPress?: (href: string) => void;
    showDiagnostics?: boolean;
};
declare function MachinaNativeTextView(props: MachinaNativeTextViewProps): React.ReactElement;

export { MachinaNativeTextView, type MachinaNativeTextViewProps };
