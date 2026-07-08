import type { PathObject } from "./sceneModel";

export type Point2 = readonly [number, number];

// MachinaCanvas arc helpers operate in SVG/canvas coordinates:
// +x points right and +y points down. ArcSweep values describe visual
// clockwise/counterclockwise motion in that y-down coordinate system.
export type ArcSweep = "clockwise" | "counterclockwise";

export type ArcPathResult = {
  readonly kind: "ok" | "err";
  readonly path?: string;
  readonly center?: Point2;
  readonly radius?: number;
  readonly start?: Point2;
  readonly end?: Point2;
  readonly startAngleRad?: number;
  readonly endAngleRad?: number;
  readonly sweep?: ArcSweep;
  readonly largeArcFlag?: 0 | 1;
  readonly error?: string;
};

export type ArcCentersResult = {
  readonly kind: "ok" | "err";
  readonly centers?: readonly [Point2, Point2];
  readonly error?: string;
};

export type ArcTangentReference =
  | {
      readonly kind: "line";
      readonly from: Point2;
      readonly to: Point2;
    }
  | {
      readonly kind: "circle";
      readonly center: Point2;
      readonly radius: number;
    };

const EPSILON = 1e-6;
const TAU = Math.PI * 2;

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "NaN";
  const rounded = Math.abs(value) < EPSILON ? 0 : value;
  return Number(rounded.toFixed(6)).toString();
}

function isFinitePoint(point: Point2): boolean {
  return Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

function subtract(a: Point2, b: Point2): Point2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function add(a: Point2, b: Point2): Point2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function scale(point: Point2, factor: number): Point2 {
  return [point[0] * factor, point[1] * factor];
}

function distance(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function dot(a: Point2, b: Point2): number {
  return a[0] * b[0] + a[1] * b[1];
}

function cross(a: Point2, b: Point2): number {
  return a[0] * b[1] - a[1] * b[0];
}

function normalize(point: Point2): Point2 | undefined {
  const length = Math.hypot(point[0], point[1]);
  if (length <= EPSILON) return undefined;
  return [point[0] / length, point[1] / length];
}

function rotateLeft(point: Point2): Point2 {
  return [-point[1], point[0]];
}

function angleFromCenter(center: Point2, point: Point2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function normalizeAngle(angle: number): number {
  let normalized = angle % TAU;
  if (normalized < 0) normalized += TAU;
  return normalized;
}

function sweepDelta(startAngle: number, endAngle: number, sweep: ArcSweep): number {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  if (sweep === "clockwise") {
    let delta = end - start;
    if (delta < 0) delta += TAU;
    return delta;
  }
  let delta = start - end;
  if (delta < 0) delta += TAU;
  return delta;
}

function pointOnArc(
  center: Point2,
  _radius: number,
  startAngle: number,
  endAngle: number,
  sweep: ArcSweep,
  point: Point2,
): boolean {
  const pointAngle = angleFromCenter(center, point);
  const arcDelta = sweepDelta(startAngle, endAngle, sweep);
  const pointDelta = sweepDelta(startAngle, pointAngle, sweep);
  return pointDelta <= arcDelta + 1e-5;
}

function buildArcPath(
  center: Point2,
  radius: number,
  start: Point2,
  end: Point2,
  sweep: ArcSweep,
): ArcPathResult {
  if (!isFinitePoint(center) || !isFinitePoint(start) || !isFinitePoint(end)) {
    return { kind: "err", error: "InvalidArcPoint" };
  }
  if (!Number.isFinite(radius) || radius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }

  const startAngleRad = angleFromCenter(center, start);
  const endAngleRad = angleFromCenter(center, end);
  const delta = sweepDelta(startAngleRad, endAngleRad, sweep);
  const largeArcFlag: 0 | 1 = delta > Math.PI + EPSILON ? 1 : 0;
  const sweepFlag = sweep === "clockwise" ? 1 : 0;
  const path = `M ${formatNumber(start[0])} ${formatNumber(start[1])} A ${formatNumber(radius)} ${formatNumber(radius)} 0 ${largeArcFlag} ${sweepFlag} ${formatNumber(end[0])} ${formatNumber(end[1])}`;

  return {
    kind: "ok",
    path,
    center,
    radius,
    start,
    end,
    startAngleRad,
    endAngleRad,
    sweep,
    largeArcFlag,
  };
}

export function sampleArcResult(arc: ArcPathResult, t: number): Point2 | undefined {
  if (
    arc.kind !== "ok" ||
    !arc.center ||
    !arc.radius ||
    arc.startAngleRad === undefined ||
    arc.endAngleRad === undefined ||
    !arc.sweep ||
    !Number.isFinite(t)
  ) {
    return undefined;
  }

  const clamped = Math.min(1, Math.max(0, t));
  const delta = sweepDelta(arc.startAngleRad, arc.endAngleRad, arc.sweep);
  const direction = arc.sweep === "clockwise" ? 1 : -1;
  const angle = arc.startAngleRad + direction * delta * clamped;
  return [
    arc.center[0] + arc.radius * Math.cos(angle),
    arc.center[1] + arc.radius * Math.sin(angle),
  ];
}

export function createArcFromThreePoints(input: {
  readonly start: Point2;
  readonly through: Point2;
  readonly end: Point2;
}): ArcPathResult {
  const { start, through, end } = input;
  if (!isFinitePoint(start) || !isFinitePoint(through) || !isFinitePoint(end)) {
    return { kind: "err", error: "InvalidArcPoint" };
  }

  const d =
    2 *
    (start[0] * (through[1] - end[1]) +
      through[0] * (end[1] - start[1]) +
      end[0] * (start[1] - through[1]));
  if (Math.abs(d) <= EPSILON) {
    return { kind: "err", error: "ArcPointsCollinear" };
  }

  const startSq = start[0] * start[0] + start[1] * start[1];
  const throughSq = through[0] * through[0] + through[1] * through[1];
  const endSq = end[0] * end[0] + end[1] * end[1];
  const center: Point2 = [
    (startSq * (through[1] - end[1]) +
      throughSq * (end[1] - start[1]) +
      endSq * (start[1] - through[1])) /
      d,
    (startSq * (end[0] - through[0]) +
      throughSq * (start[0] - end[0]) +
      endSq * (through[0] - start[0])) /
      d,
  ];
  const radius = distance(center, start);
  if (!Number.isFinite(radius) || radius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }

  const clockwiseCandidate = buildArcPath(center, radius, start, end, "clockwise");
  if (clockwiseCandidate.kind === "ok") {
    const passesThrough = pointOnArc(
      center,
      radius,
      clockwiseCandidate.startAngleRad as number,
      clockwiseCandidate.endAngleRad as number,
      "clockwise",
      through,
    );
    if (passesThrough) return clockwiseCandidate;
  }

  return buildArcPath(center, radius, start, end, "counterclockwise");
}

export function createArcFromCenterRadius(input: {
  readonly center: Point2;
  readonly radius: number;
  readonly startAngleDeg: number;
  readonly endAngleDeg: number;
  readonly sweep?: ArcSweep;
}): ArcPathResult {
  const { center, radius, startAngleDeg, endAngleDeg, sweep = "counterclockwise" } = input;
  if (!isFinitePoint(center) || !Number.isFinite(startAngleDeg) || !Number.isFinite(endAngleDeg)) {
    return { kind: "err", error: "InvalidArcPoint" };
  }
  if (!Number.isFinite(radius) || radius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }

  const startAngleRad = (startAngleDeg * Math.PI) / 180;
  const endAngleRad = (endAngleDeg * Math.PI) / 180;
  const start: Point2 = [
    center[0] + radius * Math.cos(startAngleRad),
    center[1] + radius * Math.sin(startAngleRad),
  ];
  const end: Point2 = [
    center[0] + radius * Math.cos(endAngleRad),
    center[1] + radius * Math.sin(endAngleRad),
  ];
  return buildArcPath(center, radius, start, end, sweep);
}

export function createArcFromCenterStartEnd(input: {
  readonly center: Point2;
  readonly start: Point2;
  readonly end: Point2;
  readonly sweep: ArcSweep;
}): ArcPathResult {
  const { center, start, end, sweep } = input;
  if (!isFinitePoint(center) || !isFinitePoint(start) || !isFinitePoint(end)) {
    return { kind: "err", error: "InvalidArcPoint" };
  }
  const startRadius = distance(center, start);
  const endRadius = distance(center, end);
  if (!Number.isFinite(startRadius) || startRadius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }
  if (Math.abs(startRadius - endRadius) > 1e-4) {
    return { kind: "err", error: "InvalidArcRadius" };
  }
  return buildArcPath(center, startRadius, start, end, sweep);
}

export function findArcCentersFromChordRadius(input: {
  readonly start: Point2;
  readonly end: Point2;
  readonly radius: number;
}): ArcCentersResult {
  const { start, end, radius } = input;
  if (!isFinitePoint(start) || !isFinitePoint(end)) {
    return { kind: "err", error: "InvalidArcPoint" };
  }
  if (!Number.isFinite(radius) || radius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }

  const chord = subtract(end, start);
  const chordLength = Math.hypot(chord[0], chord[1]);
  if (chordLength <= EPSILON) {
    return { kind: "err", error: "ArcPointsCollinear" };
  }
  const halfChord = chordLength / 2;
  if (radius + EPSILON < halfChord) {
    return { kind: "err", error: "ArcRadiusTooSmallForChord" };
  }

  const midpoint = scale(add(start, end), 0.5);
  const unitNormal = normalize(rotateLeft(chord));
  if (!unitNormal) {
    return { kind: "err", error: "ArcPointsCollinear" };
  }

  const height = Math.sqrt(Math.max(0, radius * radius - halfChord * halfChord));
  const centerA = add(midpoint, scale(unitNormal, height));
  const centerB = add(midpoint, scale(unitNormal, -height));
  const ordered = [centerA, centerB].sort((a, b) => {
    if (Math.abs(a[1] - b[1]) > EPSILON) return a[1] - b[1];
    return a[0] - b[0];
  }) as [Point2, Point2];
  return { kind: "ok", centers: ordered };
}

type LineReference = Extract<ArcTangentReference, { kind: "line" }>;

function intersectLines(
  originA: Point2,
  directionA: Point2,
  originB: Point2,
  directionB: Point2,
): Point2 | undefined {
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const delta = subtract(originB, originA);
  const t = cross(delta, directionB) / denominator;
  return add(originA, scale(directionA, t));
}

function closestPointOnLine(point: Point2, line: LineReference): Point2 | undefined {
  const direction = normalize(subtract(line.to, line.from));
  if (!direction) return undefined;
  const delta = subtract(point, line.from);
  const t = dot(delta, direction);
  return add(line.from, scale(direction, t));
}

function chooseBestCenter(candidates: readonly Point2[], preferredCenter?: Point2): Point2 {
  if (preferredCenter && isFinitePoint(preferredCenter)) {
    return [...candidates].sort(
      (a, b) => distance(a, preferredCenter) - distance(b, preferredCenter),
    )[0];
  }
  return [...candidates].sort((a, b) => {
    if (Math.abs(a[1] - b[1]) > EPSILON) return a[1] - b[1];
    return a[0] - b[0];
  })[0];
}

export function createTangentArcBetweenLines(input: {
  readonly startReference: Extract<ArcTangentReference, { kind: "line" }>;
  readonly endReference: Extract<ArcTangentReference, { kind: "line" }>;
  readonly radius: number;
  readonly preferredCenter?: Point2;
}): ArcPathResult {
  const { startReference, endReference, radius, preferredCenter } = input;
  if (!Number.isFinite(radius) || radius <= EPSILON) {
    return { kind: "err", error: "InvalidArcRadius" };
  }
  if (
    !isFinitePoint(startReference.from) ||
    !isFinitePoint(startReference.to) ||
    !isFinitePoint(endReference.from) ||
    !isFinitePoint(endReference.to)
  ) {
    return { kind: "err", error: "InvalidArcPoint" };
  }

  const startDirection = normalize(subtract(startReference.to, startReference.from));
  const endDirection = normalize(subtract(endReference.to, endReference.from));
  if (!startDirection || !endDirection) {
    return { kind: "err", error: "InvalidArcPoint" };
  }

  const startLeft = rotateLeft(startDirection);
  const endLeft = rotateLeft(endDirection);
  const centers: Point2[] = [];

  for (const startSign of [1, -1] as const) {
    for (const endSign of [1, -1] as const) {
      const offsetStart = add(startReference.from, scale(startLeft, radius * startSign));
      const offsetEnd = add(endReference.from, scale(endLeft, radius * endSign));
      const center = intersectLines(offsetStart, startDirection, offsetEnd, endDirection);
      if (!center) continue;
      if (centers.some((existing) => distance(existing, center) <= 1e-5)) continue;
      centers.push(center);
    }
  }

  if (centers.length === 0) {
    return { kind: "err", error: "NoTangentArcSolution" };
  }

  const center = chooseBestCenter(centers, preferredCenter);
  const start = closestPointOnLine(center, startReference);
  const end = closestPointOnLine(center, endReference);
  if (!start || !end) {
    return { kind: "err", error: "NoTangentArcSolution" };
  }

  const orientation = cross(subtract(start, center), subtract(end, center));
  const sweep: ArcSweep = orientation >= 0 ? "clockwise" : "counterclockwise";
  return createArcFromCenterStartEnd({ center, start, end, sweep });
}

export function createTangentArcBetweenReferences(input: {
  readonly startReference: ArcTangentReference;
  readonly endReference: ArcTangentReference;
  readonly radius: number;
  readonly preferredCenter?: Point2;
  readonly sweep?: ArcSweep;
}): ArcPathResult {
  if (input.startReference.kind === "line" && input.endReference.kind === "line") {
    return createTangentArcBetweenLines({
      startReference: input.startReference,
      endReference: input.endReference,
      radius: input.radius,
      preferredCenter: input.preferredCenter,
    });
  }
  return { kind: "err", error: "UnsupportedTangentReferenceCombination" };
}

export function createArcPathObject(input: {
  readonly id: string;
  readonly layerId?: string;
  readonly name?: string;
  readonly arc: ArcPathResult;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly strokeDasharray?: string;
  readonly fill?: string;
  readonly fillRule?: "nonzero" | "evenodd";
  readonly visible?: boolean;
  readonly tags?: readonly string[];
  readonly notes?: string;
}): PathObject {
  if (input.arc.kind !== "ok" || !input.arc.path || !input.arc.start || !input.arc.end) {
    throw new Error(input.arc.error ?? "Cannot create path object from invalid arc result.");
  }
  const minX = Math.min(input.arc.start[0], input.arc.end[0]);
  const minY = Math.min(input.arc.start[1], input.arc.end[1]);
  const maxX = Math.max(input.arc.start[0], input.arc.end[0]);
  const maxY = Math.max(input.arc.start[1], input.arc.end[1]);
  const pad = input.strokeWidth ?? 0.55;
  return {
    id: input.id,
    name: input.name ?? input.id,
    kind: "path",
    layerId: input.layerId ?? "geometry",
    visible: input.visible ?? true,
    x: minX - pad,
    y: minY - pad,
    width: Math.max(maxX - minX + pad * 2, pad * 2),
    height: Math.max(maxY - minY + pad * 2, pad * 2),
    fill: input.fill ?? "transparent",
    stroke: input.stroke ?? "#1c2430",
    strokeWidth: input.strokeWidth ?? 0.55,
    strokeDasharray: input.strokeDasharray,
    fillRule: input.fillRule,
    d: input.arc.path,
    tags: input.tags ? [...input.tags] : undefined,
    notes: input.notes,
  };
}
