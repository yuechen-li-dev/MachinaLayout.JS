import {
  S,
  serializeMachinaStyleSheet,
  validateMachinaStyleLayer,
  validateMachinaStyleSheet,
} from "machinalayout/style";

export const tokens = S.tokens({
  color: {
    border: "#c7cdd8",
    danger: "#c62828",
    field: "#ffffff",
    muted: "#5f6978",
    onDanger: "#ffffff",
    onPrimary: "#ffffff",
    onSuccess: "#0f2f1d",
    onWarning: "#3a2600",
    page: "#f5f7fb",
    primary: "#2457d6",
    success: "#8ee6a6",
    surface: "#ffffff",
    surfaceRaised: "#fdfefe",
    text: "#18202c",
    warning: "#ffd166",
    warningSurface: "#fff4cf",
  },
  space: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 20,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    round: 999,
  },
  font: {
    ui: {
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      size: 16,
      lineHeight: 1.5,
      weight: "normal",
    },
  },
  shadow: {
    elevated: "0 18px 45px rgba(24, 32, 44, 0.16)",
  },
});

const basePanel = S.style({
  box: {
    display: "block",
    padding: "space.lg",
    marginBottom: "space.lg",
  },
  surface: {
    fill: "color.surface",
    radius: "radius.lg",
  },
  text: {
    color: "color.text",
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
    lineHeight: 1.5,
  },
});

const borderedLayer = S.layer({
  border: {
    color: "color.border",
    width: 1,
    style: "solid",
  },
});

const page = S.with(basePanel, {
  box: {
    minHeight: "100vh",
    padding: "space.xl",
  },
  surface: {
    fill: "color.page",
    radius: 0,
  },
});

const header = S.style({
  box: {
    display: "block",
    marginBottom: "space.xl",
    maxWidth: 760,
  },
  text: {
    color: "color.text",
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
});

const title = S.style({
  box: {
    margin: 0,
    marginBottom: "space.sm",
  },
  text: {
    color: "color.text",
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
    size: 42,
    lineHeight: 1.1,
    weight: "bold",
  },
});

const sectionTitle = S.style({
  box: {
    margin: 0,
    marginBottom: "space.md",
  },
  text: {
    color: "color.text",
    size: 18,
    lineHeight: 1.25,
    weight: "semibold",
  },
});

const bodyText = S.style({
  box: {
    margin: 0,
  },
  text: {
    color: "color.muted",
    lineHeight: 1.5,
  },
});

const primaryLayer = S.layer({
  surface: {
    fill: "color.primary",
  },
  text: {
    color: "color.onPrimary",
  },
});

const ghostLayer = S.layer({
  surface: {
    fill: S.unset(),
  },
  border: {
    color: "color.primary",
  },
  text: {
    color: "color.primary",
  },
});

const compactLayer = S.layer({
  surface: {
    radius: S.inherit(),
  },
  box: {
    paddingX: "space.sm",
    paddingY: "space.xs",
  },
});

const dangerLayer = S.layer({
  surface: {
    fill: S.set("color.danger"),
  },
  text: {
    color: S.set("color.onDanger"),
  },
});

const disabledLayer = S.layer({
  surface: {
    opacity: 0.55,
  },
  text: {
    color: "color.muted",
  },
});

const baseButton = S.style({
  box: {
    display: "inlineBlock",
    paddingX: "space.md",
    paddingY: "space.sm",
    marginRight: "space.sm",
    marginBottom: "space.sm",
  },
  surface: {
    fill: "color.surface",
    radius: "radius.md",
  },
  border: {
    width: 1,
    color: "color.border",
    style: "solid",
  },
  text: {
    color: "color.text",
    family: "Inter, ui-sans-serif, system-ui, sans-serif",
    lineHeight: 1.25,
    weight: "semibold",
  },
});

const baseBadge = S.style({
  box: {
    display: "inlineBlock",
    paddingX: "space.sm",
    paddingY: "space.xs",
    marginRight: "space.sm",
    marginBottom: "space.sm",
  },
  surface: {
    fill: "color.surfaceRaised",
    radius: "radius.round",
  },
  border: {
    width: 1,
    color: "color.border",
    style: "solid",
  },
  text: {
    color: "color.text",
    size: 13,
    lineHeight: 1.2,
    weight: "semibold",
  },
});

const successLayer = S.layer({
  surface: {
    fill: "color.success",
  },
  border: {
    color: "color.success",
  },
  text: {
    color: "color.onSuccess",
  },
});

const warningLayer = S.layer({
  surface: {
    fill: S.set("color.warning"),
  },
  border: {
    color: S.set("color.warning"),
  },
  text: {
    color: S.set("color.onWarning"),
  },
});

const elevatedLayer = S.layer({
  surface: {
    fill: "color.surfaceRaised",
  },
  effect: {
    shadow: "shadow.elevated",
  },
});

const warningCardLayer = S.layer({
  surface: {
    fill: S.set("color.warningSurface"),
  },
  border: {
    color: S.set("color.warning"),
  },
});

const swatch = S.style({
  box: {
    display: "inlineBlock",
    width: 34,
    height: 34,
    marginRight: "space.sm",
  },
  surface: {
    fill: "color.surface",
    radius: "radius.sm",
  },
  border: {
    width: 1,
    color: "color.border",
    style: "solid",
  },
});

const fillPrimaryLayer = S.layer({ surface: { fill: "color.primary" } });
const fillDangerLayer = S.layer({ surface: { fill: "color.danger" } });
const fillWarningLayer = S.layer({ surface: { fill: "color.warning" } });
const fillSuccessLayer = S.layer({ surface: { fill: "color.success" } });

export const diagnosticProbeLayer = S.layer({
  surface: {
    opacity: S.set(2),
    radius: S.set(-1),
  },
});

export const diagnosticProbeDiagnostics = validateMachinaStyleLayer(diagnosticProbeLayer);

export const sheet = S.sheet({
  tokens,
  classes: {
    alertInfo: S.compose(basePanel, borderedLayer, {
      surface: {
        fill: "color.warningSurface",
        radius: "radius.md",
      },
      text: {
        color: "color.onWarning",
        weight: "semibold",
      },
    }),
    badgeDanger: S.compose(baseBadge, dangerLayer),
    badgeNeutral: baseBadge,
    badgeSuccess: S.compose(baseBadge, successLayer),
    badgeWarning: S.compose(baseBadge, warningLayer),
    bodyText,
    buttonBase: baseButton,
    buttonCompactPrimary: S.compose(baseButton, primaryLayer, compactLayer),
    buttonDanger: S.compose(baseButton, dangerLayer),
    buttonDisabled: S.compose(baseButton, disabledLayer),
    buttonGhost: S.compose(baseButton, ghostLayer),
    buttonPrimary: S.compose(baseButton, primaryLayer),
    buttonRow: S.style({
      box: {
        display: "block",
      },
    }),
    cardBase: S.compose(basePanel, borderedLayer),
    cardElevated: S.compose(basePanel, borderedLayer, elevatedLayer),
    cardGrid: S.style({
      box: {
        display: "grid",
        gap: "space.lg",
        marginBottom: "space.lg",
      },
    }),
    cardWarning: S.compose(basePanel, borderedLayer, warningCardLayer),
    eyebrow: S.style({
      box: {
        margin: 0,
        marginBottom: "space.sm",
      },
      text: {
        color: "color.primary",
        size: 13,
        weight: "bold",
        transform: "uppercase",
      },
    }),
    field: S.compose(basePanel, borderedLayer, {
      box: {
        padding: "space.md",
        marginBottom: "space.lg",
      },
      surface: {
        fill: "color.field",
        radius: "radius.md",
      },
      text: {
        color: "color.muted",
        family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      },
    }),
    header,
    matrix: S.compose(basePanel, borderedLayer),
    matrixLabel: S.style({
      box: {
        display: "inlineBlock",
        width: 120,
      },
      text: {
        color: "color.muted",
        weight: "semibold",
      },
    }),
    matrixRow: S.style({
      box: {
        display: "block",
        paddingY: "space.sm",
      },
    }),
    mutedText: S.style({
      text: {
        color: "color.muted",
        size: 14,
      },
    }),
    page,
    panel: S.compose(basePanel, borderedLayer),
    sectionTitle,
    subtitle: S.with(bodyText, {
      text: {
        size: 18,
      },
    }),
    swatchDanger: S.compose(swatch, fillDangerLayer),
    swatchPrimary: S.compose(swatch, fillPrimaryLayer),
    swatchSuccess: S.compose(swatch, fillSuccessLayer),
    swatchWarning: S.compose(swatch, fillWarningLayer),
    title,
    tokenItem: S.style({
      box: {
        display: "inlineBlock",
        marginRight: "space.lg",
        marginBottom: "space.sm",
      },
      text: {
        color: "color.text",
      },
    }),
    tokenRow: S.style({
      box: {
        display: "block",
      },
    }),
  },
});

export const sheetDiagnostics = validateMachinaStyleSheet(sheet);
export const css = serializeMachinaStyleSheet(sheet);
