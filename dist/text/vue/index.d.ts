import * as vue from 'vue';
import { PropType, StyleValue } from 'vue';
import { M as MachinaTextSpec, a as MachinaTextSource, b as MachinaTextDocument } from '../../types-C4poVJpR.js';

type MachinaVueTextViewProps = {
    text: MachinaTextSpec | MachinaTextSource | MachinaTextDocument | string;
    rootClass?: unknown;
    rootStyle?: StyleValue;
    linkTarget?: string;
    onLinkClick?: (href: string, event: MouseEvent) => void;
    showDiagnostics?: boolean;
    linkClass?: unknown;
    linkStyle?: StyleValue;
    codeClass?: unknown;
    codeStyle?: StyleValue;
};
declare const MachinaVueTextView: vue.DefineComponent<vue.ExtractPropTypes<{
    text: {
        type: PropType<MachinaVueTextViewProps["text"]>;
        required: true;
    };
    rootClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    rootStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    linkTarget: {
        type: StringConstructor;
        default: undefined;
    };
    onLinkClick: {
        type: PropType<MachinaVueTextViewProps["onLinkClick"]>;
        default: undefined;
    };
    showDiagnostics: {
        type: BooleanConstructor;
        default: boolean;
    };
    linkClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    linkStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    codeClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    codeStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
}>, () => vue.VNode<vue.RendererNode, vue.RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, {}, string, vue.PublicProps, Readonly<vue.ExtractPropTypes<{
    text: {
        type: PropType<MachinaVueTextViewProps["text"]>;
        required: true;
    };
    rootClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    rootStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    linkTarget: {
        type: StringConstructor;
        default: undefined;
    };
    onLinkClick: {
        type: PropType<MachinaVueTextViewProps["onLinkClick"]>;
        default: undefined;
    };
    showDiagnostics: {
        type: BooleanConstructor;
        default: boolean;
    };
    linkClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    linkStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
    codeClass: {
        type: PropType<unknown>;
        default: undefined;
    };
    codeStyle: {
        type: PropType<StyleValue>;
        default: undefined;
    };
}>> & Readonly<{}>, {
    onLinkClick: ((href: string, event: MouseEvent) => void) | undefined;
    rootClass: undefined;
    rootStyle: StyleValue;
    linkTarget: string;
    showDiagnostics: boolean;
    linkClass: undefined;
    linkStyle: StyleValue;
    codeClass: undefined;
    codeStyle: StyleValue;
}, {}, {}, {}, string, vue.ComponentProvideOptions, true, {}, any>;

export { MachinaVueTextView, type MachinaVueTextViewProps };
