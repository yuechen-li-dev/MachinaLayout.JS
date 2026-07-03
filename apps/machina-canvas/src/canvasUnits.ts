import type { CanvasUnitName, CanvasUnitSystem } from "./sceneModel";

const builtInCanvasUnitSystems = {
  px: {
    unit: "px",
    label: "px",
    unitsPerInch: 96,
    pixelsPerUnit: 1,
    precision: 0,
  },
  pt: {
    unit: "pt",
    label: "pt",
    unitsPerInch: 72,
    pixelsPerUnit: 96 / 72,
    precision: 2,
  },
  mm: {
    unit: "mm",
    label: "mm",
    unitsPerInch: 25.4,
    pixelsPerUnit: 96 / 25.4,
    precision: 2,
  },
  cm: {
    unit: "cm",
    label: "cm",
    unitsPerInch: 2.54,
    pixelsPerUnit: 96 / 2.54,
    precision: 2,
  },
  in: {
    unit: "in",
    label: "in",
    unitsPerInch: 1,
    pixelsPerUnit: 96,
    precision: 3,
  },
  cu: {
    unit: "cu",
    label: "cu",
    pixelsPerUnit: 1,
    precision: 2,
  },
} satisfies Record<CanvasUnitName, CanvasUnitSystem>;

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertUnitSystem(unitSystem: CanvasUnitSystem): void {
  if (!Number.isFinite(unitSystem.pixelsPerUnit) || unitSystem.pixelsPerUnit <= 0) {
    throw new Error("pixelsPerUnit must be a finite positive number.");
  }

  if (!Number.isInteger(unitSystem.precision) || unitSystem.precision < 0) {
    throw new Error("precision must be a non-negative integer.");
  }
}

export function createCanvasUnitSystem(
  unit: CanvasUnitName = "px",
  overrides?: Partial<CanvasUnitSystem>,
): CanvasUnitSystem {
  const base = builtInCanvasUnitSystems[unit];
  const next = {
    ...base,
    ...overrides,
    unit,
    label: overrides?.label ?? base.label,
  };

  assertUnitSystem(next);
  return { ...next };
}

export function getCanvasUnitSystem(document: {
  unit?: CanvasUnitName;
  unitSystem?: CanvasUnitSystem;
}): CanvasUnitSystem {
  if (document.unitSystem) {
    assertUnitSystem(document.unitSystem);
    return document.unitSystem;
  }

  return createCanvasUnitSystem(document.unit ?? "px");
}

export function unitsToPixels(value: number, unitSystem: CanvasUnitSystem): number {
  assertFiniteNumber(value, "value");
  assertUnitSystem(unitSystem);
  return value * unitSystem.pixelsPerUnit;
}

export function pixelsToUnits(value: number, unitSystem: CanvasUnitSystem): number {
  assertFiniteNumber(value, "value");
  assertUnitSystem(unitSystem);
  return value / unitSystem.pixelsPerUnit;
}

export function formatCanvasMeasurement(
  value: number,
  unitSystem: CanvasUnitSystem,
  options?: {
    precision?: number;
    includeUnit?: boolean;
  },
): string {
  assertFiniteNumber(value, "value");
  assertUnitSystem(unitSystem);

  const precision = options?.precision ?? unitSystem.precision;
  if (!Number.isInteger(precision) || precision < 0) {
    throw new Error("precision must be a non-negative integer.");
  }

  const formatted = value.toFixed(precision);
  return options?.includeUnit === false ? formatted : `${formatted} ${unitSystem.label}`;
}

export function formatCanvasRect(
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  unitSystem: CanvasUnitSystem,
): string {
  const x = formatCanvasMeasurement(rect.x, unitSystem, { includeUnit: false });
  const y = formatCanvasMeasurement(rect.y, unitSystem, { includeUnit: false });
  const width = formatCanvasMeasurement(rect.width, unitSystem, { includeUnit: false });
  const height = formatCanvasMeasurement(rect.height, unitSystem, { includeUnit: false });
  return `x=${x} y=${y} w=${width} h=${height} ${unitSystem.label}`;
}
