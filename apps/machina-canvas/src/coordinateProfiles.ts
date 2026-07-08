export type CanvasCoordinateYAxis = "down" | "up";

export type CanvasCoordinateOrigin = "topLeft" | "bottomLeft" | "sheetDatum" | "imageTopLeft";

export type CanvasCoordinateProfileId = "screen" | "image" | "drafting";

export type CanvasCoordinateProfile = {
  readonly id: CanvasCoordinateProfileId;
  readonly label: string;
  readonly yAxis: CanvasCoordinateYAxis;
  readonly origin: CanvasCoordinateOrigin;
  readonly description?: string;
};

export type CanvasVisualDirection = "up" | "down" | "left" | "right";

export const SCREEN_COORDINATES: CanvasCoordinateProfile = {
  id: "screen",
  label: "Screen coordinates",
  yAxis: "down",
  origin: "topLeft",
  description: "SVG/React-style render coordinates with +X right and +Y down.",
};

export const IMAGE_COORDINATES: CanvasCoordinateProfile = {
  id: "image",
  label: "Image coordinates",
  yAxis: "down",
  origin: "imageTopLeft",
  description: "Image/atlas coordinates with +X right and Y measured down from the top-left.",
};

export const DRAFTING_COORDINATES: CanvasCoordinateProfile = {
  id: "drafting",
  label: "Drafting coordinates",
  yAxis: "up",
  origin: "bottomLeft",
  description: "Mechanical drafting authoring coordinates with +X right and +Y up.",
};

export const CANVAS_COORDINATE_PROFILES: readonly CanvasCoordinateProfile[] = [
  SCREEN_COORDINATES,
  IMAGE_COORDINATES,
  DRAFTING_COORDINATES,
];

export function getCoordinateProfile(id: string | undefined): CanvasCoordinateProfile {
  return CANVAS_COORDINATE_PROFILES.find((profile) => profile.id === id) ?? SCREEN_COORDINATES;
}

export function authoringPointToRenderPoint(input: {
  readonly point: readonly [number, number];
  readonly profile: CanvasCoordinateProfile;
  readonly viewportHeight: number;
}): readonly [number, number] {
  const [x, y] = input.point;
  return input.profile.yAxis === "up" ? [x, input.viewportHeight - y] : [x, y];
}

export function renderPointToAuthoringPoint(input: {
  readonly point: readonly [number, number];
  readonly profile: CanvasCoordinateProfile;
  readonly viewportHeight: number;
}): readonly [number, number] {
  const [x, y] = input.point;
  return input.profile.yAxis === "up" ? [x, input.viewportHeight - y] : [x, y];
}

export function visualDirectionDelta(input: {
  readonly direction: CanvasVisualDirection;
  readonly amount: number;
  readonly profile: CanvasCoordinateProfile;
}): readonly [number, number] {
  const amount = Math.abs(input.amount);
  if (input.direction === "left") return [-amount, 0];
  if (input.direction === "right") return [amount, 0];
  if (input.direction === "up") return [0, input.profile.yAxis === "up" ? amount : -amount];
  return [0, input.profile.yAxis === "up" ? -amount : amount];
}

export function formatCoordinateProfileSummary(profile: CanvasCoordinateProfile): string {
  const yDirection = profile.yAxis === "up" ? "+Y up" : "+Y down";
  return `${profile.label} (${yDirection})`;
}
