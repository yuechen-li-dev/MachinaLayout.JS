import type {
  BlockoutSidecarObject,
  CanvasDocument,
  CanvasObject,
  GuideSidecarObject,
  ImageObject,
  MechanicalAnnotationSidecarObject,
  SketchOverlayObject,
  SpriteSidecarObject,
} from "./sceneModel";
import {
  countMechanicalAnnotations,
  validateMechanicalAnnotationsForScene,
} from "./mechanicalAnnotations";

export type CanvasLayerTreeRelation =
  | "alphaMap"
  | "guideSidecar"
  | "blockoutSidecar"
  | "mechanicalAnnotationSidecar"
  | "spriteSidecar"
  | "sketchOverlay"
  | "child"
  | "unattached";

export type CanvasLayerTreeItem = {
  readonly id: string;
  readonly kind: "group" | "object" | "attachment";
  readonly objectId?: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly badge?: string;
  readonly warning?: string;
  readonly selected?: boolean;
  readonly visible?: boolean;
  readonly children?: readonly CanvasLayerTreeItem[];
  readonly relation?: CanvasLayerTreeRelation;
  readonly count?: number;
};

type LayerGroupSource = {
  id: string;
  title: string;
  description?: string;
  objectIds: readonly string[];
  collapsed?: boolean;
};

function basename(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const segments = path.split(/[\\/]/).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
}

function formatSize(width: number | undefined, height: number | undefined): string | undefined {
  if (!width || !height) return undefined;
  return `${width}x${height}`;
}

function getObjectBadge(object: CanvasObject): string {
  switch (object.kind) {
    case "rect":
      return "RECT";
    case "ellipse":
      return "OVAL";
    case "path":
      return "PATH";
    case "text":
      return "TEXT";
    case "image":
      return object.role === "alphaMap" ? "ALPHA" : object.role === "mask" ? "MASK" : "IMG";
    case "uiComponent":
      return "UI";
    case "sketchOverlay":
      return "SKETCH";
    case "spriteSidecar":
      return "SPRITE";
    case "guideSidecar":
      return "GUIDE";
    case "blockoutSidecar":
      return "BLOCK";
    case "mechanicalAnnotationSidecar":
      return "ANNO";
  }
}

function getDisplayTitle(object: CanvasObject): string {
  if (object.kind === "image") {
    return basename(object.src) ?? object.name;
  }
  if (object.kind === "spriteSidecar") {
    return object.spec.sourceName ?? object.name;
  }
  if (object.kind === "guideSidecar") {
    return object.name;
  }
  if (object.kind === "blockoutSidecar") {
    return object.name;
  }
  if (object.kind === "mechanicalAnnotationSidecar") {
    return object.name;
  }
  return object.name;
}

function getImageSubtitle(object: ImageObject): string | undefined {
  const size =
    formatSize(object.intrinsicWidth, object.intrinsicHeight) ??
    formatSize(object.width, object.height);
  if (object.role === "alphaMap" || object.role === "mask") {
    return size ? `${size} alpha image` : "Alpha image";
  }
  return size;
}

function getSpriteSubtitle(object: SpriteSidecarObject): string {
  const findings = object.spec.diagnostics.length;
  return `${object.spec.frames.length} frames · ${findings} finding${findings === 1 ? "" : "s"}`;
}

function getSketchSubtitle(object: SketchOverlayObject): string {
  return `${object.spec.primitives.length} primitive${object.spec.primitives.length === 1 ? "" : "s"}`;
}

function getGuideSubtitle(object: GuideSidecarObject): string {
  const visibility = object.visible ? "visible" : "hidden";
  return `Construction mask · ${visibility} · ${object.guide.regions.length} regions · ${object.guide.datums.length} datums · ${object.guide.dimensions.length} dimensions · ${object.guide.alignmentMarks.length} marks`;
}

function getBlockoutSubtitle(object: BlockoutSidecarObject): string {
  return `Blockout mask · ${object.blockout.boxes.length} boxes · ${object.blockout.points.length} points · ${object.blockout.curves.length} curves`;
}

function getObjectSubtitle(object: CanvasObject): string | undefined {
  switch (object.kind) {
    case "image":
      return getImageSubtitle(object);
    case "spriteSidecar":
      return getSpriteSubtitle(object);
    case "sketchOverlay":
      return getSketchSubtitle(object);
    case "guideSidecar":
      return getGuideSubtitle(object);
    case "blockoutSidecar":
      return getBlockoutSubtitle(object);
    case "mechanicalAnnotationSidecar":
      return undefined;
    case "text":
      return object.text;
    case "uiComponent":
      return object.componentId;
    default:
      return undefined;
  }
}

function makeLayerGroups(scene: CanvasDocument): readonly LayerGroupSource[] {
  if (scene.layerGroups?.length) {
    return scene.layerGroups.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      objectIds: group.objectIds,
      collapsed: group.collapsed,
    }));
  }

  return scene.layers.map((layer) => ({
    id: layer.id,
    title: layer.name,
    objectIds: layer.objectIds,
  }));
}

function getOrderedObjectIds(scene: CanvasDocument): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const layer of scene.layers) {
    for (const objectId of layer.objectIds) {
      if (scene.objects[objectId] && !seen.has(objectId)) {
        ids.push(objectId);
        seen.add(objectId);
      }
    }
  }
  for (const objectId of Object.keys(scene.objects)) {
    if (!seen.has(objectId)) ids.push(objectId);
  }
  return ids;
}

function getOwnerImageIdByAttachment(scene: CanvasDocument): ReadonlyMap<string, string> {
  const relations = new Map<string, string>();
  for (const object of Object.values(scene.objects)) {
    if (object.kind !== "image") continue;
    if (object.alphaMapId && scene.objects[object.alphaMapId]) {
      relations.set(object.alphaMapId, object.id);
    }
    if (object.spriteSidecarId && scene.objects[object.spriteSidecarId]) {
      relations.set(object.spriteSidecarId, object.id);
    }
    if (object.sketchOverlayId && scene.objects[object.sketchOverlayId]) {
      relations.set(object.sketchOverlayId, object.id);
    }
  }
  for (const object of Object.values(scene.objects)) {
    if (
      object.kind === "guideSidecar" &&
      object.targetId &&
      scene.objects[object.targetId]?.kind === "image"
    ) {
      relations.set(object.id, object.targetId);
    }
  }
  for (const object of Object.values(scene.objects)) {
    if (
      object.kind === "blockoutSidecar" &&
      object.targetObjectId &&
      scene.objects[object.targetObjectId] !== undefined
    ) {
      relations.set(object.id, object.targetObjectId);
    }
  }
  for (const object of Object.values(scene.objects)) {
    if (
      object.kind === "mechanicalAnnotationSidecar" &&
      object.targetObjectId &&
      scene.objects[object.targetObjectId] !== undefined
    ) {
      relations.set(object.id, object.targetObjectId);
    }
  }
  return relations;
}

function getAttachmentRelation(
  scene: CanvasDocument,
  objectId: string,
): CanvasLayerTreeRelation | undefined {
  const object = scene.objects[objectId];
  if (!object) return undefined;
  for (const candidate of Object.values(scene.objects)) {
    if (candidate.kind !== "image") continue;
    if (candidate.alphaMapId === objectId) return "alphaMap";
    if (candidate.spriteSidecarId === objectId) return "spriteSidecar";
    if (candidate.sketchOverlayId === objectId) return "sketchOverlay";
  }
  const guide = scene.objects[objectId];
  if (guide?.kind === "guideSidecar" && guide.targetId) return "guideSidecar";
  const blockout = scene.objects[objectId];
  if (blockout?.kind === "blockoutSidecar" && blockout.targetObjectId) return "blockoutSidecar";
  const mechanical = scene.objects[objectId];
  if (mechanical?.kind === "mechanicalAnnotationSidecar" && mechanical.targetObjectId) {
    return "mechanicalAnnotationSidecar";
  }
  return undefined;
}

function getAttachmentIdsForOwner(
  scene: CanvasDocument,
  owner: CanvasObject,
  orderedIds: readonly string[],
): readonly string[] {
  const ids = [
    ...(owner.kind === "image"
      ? [owner.alphaMapId, owner.spriteSidecarId, owner.sketchOverlayId].filter(
          (value): value is string => Boolean(value && scene.objects[value]),
        )
      : []),
  ];
  for (const objectId of orderedIds) {
    const object = scene.objects[objectId];
    if (object?.kind === "guideSidecar" && object.targetId === owner.id) {
      ids.push(object.id);
    }
    if (object?.kind === "blockoutSidecar" && object.targetObjectId === owner.id) {
      ids.push(object.id);
    }
    if (object?.kind === "mechanicalAnnotationSidecar" && object.targetObjectId === owner.id) {
      ids.push(object.id);
    }
  }
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  return [...ids].sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
}

function getAlphaWarning(
  _scene: CanvasDocument,
  image: ImageObject,
  alpha: ImageObject,
): string | undefined {
  const parentSize =
    formatSize(image.intrinsicWidth, image.intrinsicHeight) ??
    formatSize(image.width, image.height);
  const alphaSize =
    formatSize(alpha.intrinsicWidth, alpha.intrinsicHeight) ??
    formatSize(alpha.width, alpha.height);
  if (!parentSize || !alphaSize || parentSize === alphaSize) return undefined;
  return `Size mismatch: ${alphaSize} vs ${parentSize}`;
}

function makeAttachmentItem(
  scene: CanvasDocument,
  object: CanvasObject,
  relation: CanvasLayerTreeRelation,
  ownerImageId: string,
): CanvasLayerTreeItem {
  const owner = scene.objects[ownerImageId];
  const baseSubtitle =
    object.kind === "mechanicalAnnotationSidecar"
      ? getMechanicalLayerTreeSubtitle(scene, object)
      : getObjectSubtitle(object);
  const relationText =
    relation === "alphaMap"
      ? `attached alpha for ${getDisplayTitle(owner ?? object)}`
      : relation === "guideSidecar"
        ? `authoring guide for ${getDisplayTitle(owner ?? object)}`
        : relation === "blockoutSidecar"
          ? `attached blockout for ${getDisplayTitle(owner ?? object)}`
          : relation === "mechanicalAnnotationSidecar"
            ? undefined
            : relation === "spriteSidecar"
              ? `attached to ${getDisplayTitle(owner ?? object)}`
              : `attached to ${getDisplayTitle(owner ?? object)}`;

  const warning =
    relation === "alphaMap" && object.kind === "image" && owner?.kind === "image"
      ? getAlphaWarning(scene, owner, object)
      : undefined;
  const children =
    object.kind === "mechanicalAnnotationSidecar"
      ? [
          ...object.annotations.dimensions.map((dimension) => ({
            id: `mechanical-dimension:${object.id}:${dimension.id}`,
            kind: "attachment" as const,
            title: `DIM ${dimension.label ?? dimension.id}`,
            subtitle: undefined,
            badge: "DIM",
          })),
          ...object.annotations.notes.map((note) => ({
            id: `mechanical-note:${object.id}:${note.id}`,
            kind: "attachment" as const,
            title: `NOTE ${note.text}`,
            subtitle: undefined,
            badge: "NOTE",
          })),
          ...object.annotations.datums.map((datum) => ({
            id: `mechanical-datum:${object.id}:${datum.id}`,
            kind: "attachment" as const,
            title: `DATUM ${datum.label}`,
            subtitle: undefined,
            badge: "DATUM",
          })),
          ...object.annotations.blocks.map((block) => ({
            id: `mechanical-block:${object.id}:${block.id}`,
            kind: "attachment" as const,
            title: `BLOCK ${block.kind === "titleBlock" ? "title block" : block.kind === "revisionTable" ? "revision table" : "bom table"}`,
            subtitle: undefined,
            badge: "BLOCK",
          })),
        ]
      : undefined;
  const subtitleParts = [baseSubtitle, relationText].filter(Boolean);

  return {
    id: `attachment:${object.id}`,
    kind: "attachment",
    objectId: object.id,
    title: getDisplayTitle(object),
    subtitle: subtitleParts.join(" · "),
    badge: getObjectBadge(object),
    warning,
    selected: scene.selectedObjectId === object.id,
    visible: object.visible,
    relation,
    children,
  };
}

function makeObjectItem(
  scene: CanvasDocument,
  object: CanvasObject,
  orderedIds: readonly string[],
): CanvasLayerTreeItem {
  const subtitle =
    object.kind === "mechanicalAnnotationSidecar"
      ? getMechanicalLayerTreeSubtitle(scene, object)
      : getObjectSubtitle(object);
  const canOwnChildren =
    object.kind !== "image" || object.role === undefined || object.role === "image";
  if (canOwnChildren) {
    const children = getAttachmentIdsForOwner(scene, object, orderedIds)
      .map((attachmentId) => {
        const attachment = scene.objects[attachmentId];
        const relation = getAttachmentRelation(scene, attachmentId);
        if (!attachment || !relation) return undefined;
        return makeAttachmentItem(scene, attachment, relation, object.id);
      })
      .filter((item): item is CanvasLayerTreeItem => item !== undefined);
    return {
      id: `object:${object.id}`,
      kind: "object",
      objectId: object.id,
      title: getDisplayTitle(object),
      subtitle,
      badge: getObjectBadge(object),
      selected: scene.selectedObjectId === object.id,
      visible: object.visible,
      children,
    };
  }

  return {
    id: `object:${object.id}`,
    kind: "object",
    objectId: object.id,
    title: getDisplayTitle(object),
    subtitle,
    badge: getObjectBadge(object),
    selected: scene.selectedObjectId === object.id,
    visible: object.visible,
  };
}

function isAttachmentCapable(object: CanvasObject): boolean {
  return (
    object.kind === "mechanicalAnnotationSidecar" ||
    object.kind === "blockoutSidecar" ||
    object.kind === "spriteSidecar" ||
    object.kind === "guideSidecar" ||
    object.kind === "sketchOverlay" ||
    (object.kind === "image" && (object.role === "alphaMap" || object.role === "mask"))
  );
}

function makeUnattachedItem(scene: CanvasDocument, object: CanvasObject): CanvasLayerTreeItem {
  return {
    id: `unattached:${object.id}`,
    kind: "attachment",
    objectId: object.id,
    title: getDisplayTitle(object),
    subtitle: getObjectSubtitle(object) ?? "Not attached",
    badge: getObjectBadge(object),
    warning: object.kind === "image" ? "No image owner" : "No image owner",
    selected: scene.selectedObjectId === object.id,
    visible: object.visible,
    relation: "unattached",
  };
}

export function buildCanvasLayerTree(scene: CanvasDocument): readonly CanvasLayerTreeItem[] {
  const orderedIds = getOrderedObjectIds(scene);
  const ownerImageByAttachment = getOwnerImageIdByAttachment(scene);
  const grouped = makeLayerGroups(scene);
  const items: CanvasLayerTreeItem[] = [];
  const consumed = new Set<string>();

  for (const group of grouped) {
    const children: CanvasLayerTreeItem[] = [];
    for (const objectId of group.objectIds) {
      const object = scene.objects[objectId];
      if (!object || consumed.has(objectId)) continue;
      if (ownerImageByAttachment.has(objectId)) continue;
      children.push(makeObjectItem(scene, object, orderedIds));
      consumed.add(objectId);
      if (object.kind !== "image" || object.role === undefined || object.role === "image") {
        for (const attachmentId of getAttachmentIdsForOwner(scene, object, orderedIds)) {
          consumed.add(attachmentId);
        }
      }
    }
    if (children.length === 0) continue;
    items.push({
      id: `group:${group.id}`,
      kind: "group",
      title: group.title,
      subtitle: group.description,
      count: children.length,
      children,
    });
  }

  const remainingStandalone = orderedIds
    .map((id) => scene.objects[id])
    .filter((object): object is CanvasObject => Boolean(object))
    .filter(
      (object) =>
        !consumed.has(object.id) &&
        !ownerImageByAttachment.has(object.id) &&
        !isAttachmentCapable(object),
    )
    .map((object) => makeObjectItem(scene, object, orderedIds));
  if (remainingStandalone.length > 0) {
    items.push({
      id: "group:ungrouped",
      kind: "group",
      title: "Other layers",
      count: remainingStandalone.length,
      children: remainingStandalone,
    });
  }

  const unattached = orderedIds
    .map((id) => scene.objects[id])
    .filter((object): object is CanvasObject => Boolean(object))
    .filter((object) => isAttachmentCapable(object) && !ownerImageByAttachment.has(object.id))
    .filter((object) => {
      if (object.kind === "spriteSidecar" || object.kind === "sketchOverlay") {
        return true;
      }
      return !Object.values(scene.objects).some(
        (candidate) => candidate.kind === "image" && candidate.alphaMapId === object.id,
      );
    })
    .map((object) => makeUnattachedItem(scene, object));
  if (unattached.length > 0) {
    items.push({
      id: "group:unattached",
      kind: "group",
      title: "Unattached Sidecars",
      count: unattached.length,
      children: unattached,
    });
  }

  return items;
}

export function getMechanicalLayerTreeSubtitle(
  scene: CanvasDocument,
  sidecar: MechanicalAnnotationSidecarObject,
): string {
  const counts = countMechanicalAnnotations(sidecar.annotations);
  const target =
    sidecar.targetObjectId !== undefined ? scene.objects[sidecar.targetObjectId] : undefined;
  const base = `Sheet annotations · ${counts.dimensions} dimensions · ${counts.notes} notes`;
  const diagnostics = validateMechanicalAnnotationsForScene(scene, sidecar);
  const referenceDiagnostics = diagnostics.filter((diagnostic) =>
    [
      "MissingMechanicalReferenceObject",
      "UnsupportedMechanicalReferenceAnchor",
      "UnresolvedMechanicalReference",
      "MechanicalDimensionReferenceMismatch",
    ].includes(diagnostic.code),
  ).length;
  const attachment = target ? `Attached to ${target.name}` : undefined;
  const status =
    referenceDiagnostics > 0 ? `${referenceDiagnostics} reference warnings` : undefined;
  return [attachment, base, status].filter(Boolean).join(" · ");
}

export function findCanvasLayerGroupForObject(
  scene: CanvasDocument,
  objectId: string | undefined,
): string | undefined {
  if (!objectId) return undefined;
  const explicit = scene.layerGroups?.find((group) => group.objectIds.includes(objectId));
  if (explicit) return explicit.id;
  return scene.layers.find((layer) => layer.objectIds.includes(objectId))?.id;
}

export function createCanvasLayerGroup(scene: CanvasDocument, title: string): CanvasDocument {
  const nextGroups = [...(scene.layerGroups ?? [])];
  const baseId = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  let suffix = 1;
  let id = baseId || "layer-group";
  const existingIds = new Set(nextGroups.map((group) => group.id));
  while (existingIds.has(id)) {
    suffix += 1;
    id = `${baseId || "layer-group"}-${suffix}`;
  }
  nextGroups.push({ id, title: title.trim() || "New group", objectIds: [] });
  return { ...scene, layerGroups: nextGroups };
}

export function addCanvasObjectToLayerGroup(
  scene: CanvasDocument,
  groupId: string,
  objectId: string,
): CanvasDocument {
  const nextGroups = (scene.layerGroups ?? []).map((group) => ({
    ...group,
    objectIds:
      group.id === groupId && !group.objectIds.includes(objectId)
        ? [...group.objectIds, objectId]
        : group.objectIds.filter((candidate) => candidate !== objectId || group.id === groupId),
  }));
  return { ...scene, layerGroups: nextGroups };
}
