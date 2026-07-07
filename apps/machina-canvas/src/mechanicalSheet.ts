export const MECHANICAL_A4_LANDSCAPE_MM = {
  width: 297,
  height: 210,
} as const;

export const MECHANICAL_A4_PRINT_MARGIN_MM = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
} as const;

export type MechanicalSheetLayout = {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly marginMm: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly contentBoxMm: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

export function getMechanicalA4LandscapeLayout(): MechanicalSheetLayout {
  const marginMm = { ...MECHANICAL_A4_PRINT_MARGIN_MM };
  return {
    widthMm: MECHANICAL_A4_LANDSCAPE_MM.width,
    heightMm: MECHANICAL_A4_LANDSCAPE_MM.height,
    marginMm,
    contentBoxMm: {
      x: marginMm.left,
      y: marginMm.top,
      width: MECHANICAL_A4_LANDSCAPE_MM.width - marginMm.left - marginMm.right,
      height: MECHANICAL_A4_LANDSCAPE_MM.height - marginMm.top - marginMm.bottom,
    },
  };
}
