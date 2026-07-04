import {
  createMachinaStyleArtifact,
  S,
  validateMachinaStyleLayer,
  validateMachinaStyleSheet,
} from "../../../src/style";

const t = S.token;

export const tokens = S.tokens({
  color: {
    border: "#c7cdd8",
    danger: "#c62828",
    field: "#ffffff",
    info: "#dce8ff",
    muted: "#5f6978",
    onDanger: "#ffffff",
    onInfo: "#17336f",
    onPrimary: "#ffffff",
    onSuccess: "#0f2f1d",
    onWarning: "#3a2600",
    page: "#f5f7fb",
    primary: "#2457d6",
    primaryHover: "#2f64ea",
    primaryPressed: "#183ea0",
    selectedRing: "#90aefc",
    success: "#8ee6a6",
    surface: "#ffffff",
    surfaceRaised: "#fdfefe",
    text: "#18202c",
    textDisabled: "#7d8592",
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
    body: {
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      size: 15,
      lineHeight: 1.5,
      weight: "normal",
      letterSpacing: 0,
    },
    display: {
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      size: 42,
      lineHeight: 1.1,
      weight: "bold",
      letterSpacing: 0,
    },
    title: {
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      size: 28,
      lineHeight: 1.2,
      weight: "semibold",
      letterSpacing: 0,
    },
    ui: {
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      size: 16,
      lineHeight: 1.5,
      weight: "normal",
      letterSpacing: 0,
    },
  },
  shadow: {
    elevated: "0 18px 45px rgba(24, 32, 44, 0.16)",
  },
});

const basePanel = S.style({
  box: {
    display: "block",
    padding: t("space", "lg"),
    marginBottom: t("space", "lg"),
  },
  surface: {
    fill: t("color", "surface"),
    radius: t("radius", "lg"),
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
  },
});

const borderedLayer = S.layer({
  border: {
    color: t("color", "border"),
    width: 1,
    style: "solid",
  },
});

const page = S.with(basePanel, {
  box: {
    minHeight: "100vh",
    padding: t("space", "xl"),
  },
  surface: {
    fill: t("color", "page"),
    radius: 0,
  },
});

const header = S.style({
  box: {
    display: "block",
    marginBottom: t("space", "xl"),
    maxWidth: 760,
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
  },
});

const title = S.style({
  box: {
    margin: 0,
    marginBottom: t("space", "sm"),
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
    size: 42,
    lineHeight: 1.1,
    weight: "bold",
  },
});

const responsiveHero = S.responsive("responsiveHero", {
  description: "Layout-mode hero treatment lowered to fixed media queries.",
  base: S.with(header, {
    box: {
      paddingX: t("space", "lg"),
      paddingY: t("space", "lg"),
    },
  }),
  variants: {
    desktop: S.layer({
      box: {
        paddingX: t("space", "xl"),
      },
      text: {
        font: t("font", "display"),
      },
    }),
    tablet: S.layer({
      box: {
        paddingX: t("space", "lg"),
      },
      text: {
        font: t("font", "title"),
      },
    }),
    phone: S.layer({
      box: {
        paddingX: t("space", "md"),
      },
      text: {
        font: t("font", "body"),
      },
    }),
  },
});

const responsivePanel = S.responsive("responsivePanel", {
  base: S.compose(basePanel, borderedLayer),
  variants: {
    desktop: S.layer({
      box: {
        padding: t("space", "xl"),
      },
    }),
    tablet: S.layer({
      box: {
        padding: t("space", "lg"),
      },
    }),
    phone: S.layer({
      box: {
        padding: t("space", "md"),
      },
    }),
  },
});

const responsiveGrid = S.responsive("responsiveGrid", {
  base: S.style({
    box: {
      display: "grid",
      gap: t("space", "lg"),
      marginBottom: t("space", "lg"),
    },
  }),
  variants: {
    desktop: S.layer({
      box: {
        gap: t("space", "xl"),
      },
    }),
    tablet: S.layer({
      box: {
        gap: t("space", "lg"),
      },
    }),
    phone: S.layer({
      box: {
        display: "block",
        gap: S.inherit(),
      },
    }),
  },
});

const responsiveTokenGrid = S.responsive("responsiveTokenGrid", {
  base: S.style({
    box: {
      display: "block",
      paddingX: t("space", "sm"),
    },
  }),
  variants: {
    desktop: S.layer({
      box: {
        paddingX: t("space", "lg"),
      },
    }),
    tablet: S.layer({
      box: {
        paddingX: t("space", "md"),
      },
    }),
    phone: S.layer({
      box: {
        paddingX: t("space", "xs"),
      },
    }),
  },
});

const sectionTitle = S.style({
  box: {
    margin: 0,
    marginBottom: t("space", "md"),
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
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
    color: t("color", "muted"),
    font: t("font", "ui"),
    lineHeight: 1.5,
  },
});

const primaryLayer = S.layer({
  surface: {
    fill: t("color", "primary"),
  },
  text: {
    color: t("color", "onPrimary"),
  },
});

const ghostLayer = S.layer({
  surface: {
    fill: S.unset(),
  },
  border: {
    color: t("color", "primary"),
  },
  text: {
    color: t("color", "primary"),
  },
});

const compactLayer = S.layer({
  surface: {
    radius: S.inherit(),
  },
  box: {
    paddingX: t("space", "sm"),
    paddingY: t("space", "xs"),
  },
});

const dangerLayer = S.layer({
  surface: {
    fill: S.set(t("color", "danger")),
  },
  text: {
    color: S.set(t("color", "onDanger")),
  },
});

const disabledLayer = S.layer({
  surface: {
    opacity: 0.55,
  },
  text: {
    color: t("color", "muted"),
  },
});

const baseButton = S.style({
  box: {
    display: "inlineBlock",
    paddingX: t("space", "md"),
    paddingY: t("space", "sm"),
    marginRight: t("space", "sm"),
    marginBottom: t("space", "sm"),
  },
  surface: {
    fill: t("color", "surface"),
    radius: t("radius", "md"),
  },
  border: {
    width: 1,
    color: t("color", "border"),
    style: "solid",
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
    lineHeight: 1.25,
    weight: "semibold",
  },
});

const statefulButton = S.stateful("statefulButton", {
  description: "Actual button states lowered to data-state selectors.",
  base: S.compose(baseButton, primaryLayer),
  states: {
    hover: S.layer({
      surface: {
        fill: t("color", "primaryHover"),
      },
    }),
    loading: S.layer({
      surface: {
        fill: t("color", "info"),
      },
      text: {
        color: t("color", "onInfo"),
      },
    }),
    pressed: S.layer({
      surface: {
        fill: t("color", "primaryPressed"),
      },
    }),
    disabled: S.layer({
      surface: {
        opacity: 0.48,
      },
      text: {
        color: t("color", "textDisabled"),
      },
    }),
    selected: S.layer({
      border: {
        color: t("color", "selectedRing"),
        width: 2,
      },
      effect: {
        shadow: "0 0 0 3px rgba(144, 174, 252, 0.32)",
      },
    }),
  },
});

const baseBadge = S.style({
  box: {
    display: "inlineBlock",
    paddingX: t("space", "sm"),
    paddingY: t("space", "xs"),
    marginRight: t("space", "sm"),
    marginBottom: t("space", "sm"),
  },
  surface: {
    fill: t("color", "surfaceRaised"),
    radius: t("radius", "round"),
  },
  border: {
    width: 1,
    color: t("color", "border"),
    style: "solid",
  },
  text: {
    color: t("color", "text"),
    font: t("font", "ui"),
    size: 13,
    lineHeight: 1.2,
    weight: "semibold",
  },
});

const successLayer = S.layer({
  surface: {
    fill: t("color", "success"),
  },
  border: {
    color: t("color", "success"),
  },
  text: {
    color: t("color", "onSuccess"),
  },
});

const warningLayer = S.layer({
  surface: {
    fill: S.set(t("color", "warning")),
  },
  border: {
    color: S.set(t("color", "warning")),
  },
  text: {
    color: S.set(t("color", "onWarning")),
  },
});

const elevatedLayer = S.layer({
  surface: {
    fill: t("color", "surfaceRaised"),
  },
  effect: {
    shadow: t("shadow", "elevated"),
  },
});

const warningCardLayer = S.layer({
  surface: {
    fill: S.set(t("color", "warningSurface")),
  },
  border: {
    color: S.set(t("color", "warning")),
  },
});

const swatch = S.style({
  box: {
    display: "inlineBlock",
    width: 34,
    height: 34,
    marginRight: t("space", "sm"),
  },
  surface: {
    fill: t("color", "surface"),
    radius: t("radius", "sm"),
  },
  border: {
    width: 1,
    color: t("color", "border"),
    style: "solid",
  },
});

const fillPrimaryLayer = S.layer({ surface: { fill: t("color", "primary") } });
const fillDangerLayer = S.layer({ surface: { fill: t("color", "danger") } });
const fillWarningLayer = S.layer({ surface: { fill: t("color", "warning") } });
const fillSuccessLayer = S.layer({ surface: { fill: t("color", "success") } });

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
        fill: t("color", "warningSurface"),
        radius: t("radius", "md"),
      },
      text: {
        color: t("color", "onWarning"),
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
        gap: t("space", "lg"),
        marginBottom: t("space", "lg"),
      },
    }),
    cardWarning: S.compose(basePanel, borderedLayer, warningCardLayer),
    eyebrow: S.style({
      box: {
        margin: 0,
        marginBottom: t("space", "sm"),
      },
      text: {
        color: t("color", "primary"),
        font: t("font", "ui"),
        size: 13,
        weight: "bold",
        transform: "uppercase",
      },
    }),
    field: S.compose(basePanel, borderedLayer, {
      box: {
        padding: t("space", "md"),
        marginBottom: t("space", "lg"),
      },
      surface: {
        fill: t("color", "field"),
        radius: t("radius", "md"),
      },
      text: {
        color: t("color", "muted"),
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
        color: t("color", "muted"),
        font: t("font", "ui"),
        weight: "semibold",
      },
    }),
    matrixRow: S.style({
      box: {
        display: "block",
        paddingY: t("space", "sm"),
      },
    }),
    mutedText: S.style({
      text: {
        color: t("color", "muted"),
        font: t("font", "ui"),
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
        marginRight: t("space", "lg"),
        marginBottom: t("space", "sm"),
      },
      text: {
        color: t("color", "text"),
        font: t("font", "ui"),
      },
    }),
    tokenRow: S.style({
      box: {
        display: "block",
      },
    }),
  },
  stateful: {
    statefulButton,
  },
  responsive: {
    responsiveGrid,
    responsiveHero,
    responsivePanel,
    responsiveTokenGrid,
  },
});

export const classes = S.classes(sheet);
export const sheetDiagnostics = validateMachinaStyleSheet(sheet);
export const artifact = createMachinaStyleArtifact(sheet);
export const css = artifact.css;
