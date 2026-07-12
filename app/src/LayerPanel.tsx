import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import {
  buildCanvasLayerTree,
  findCanvasLayerGroupForObject,
  type CanvasLayerTreeItem,
} from "./layerTree";
import type { CanvasDocument, CanvasImageRole, CanvasObject, ImageObject } from "./sceneModel";

type LayerPanelProps = {
  activeModeTitle: string;
  document: CanvasDocument;
  onClearSelection: () => void;
  onCreateGroup: (title: string) => void;
  onLoadAlphaMask: (
    file: File,
    options?: { attachToImageId?: string; groupId?: string },
  ) => Promise<void> | void;
  onLoadImage: (
    file: File,
    options?: { groupId?: string; role?: CanvasImageRole },
  ) => Promise<void> | void;
  onLoadSketchToml: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void> | void;
  onLoadGuideToml: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void> | void;
  onLoadBlockoutToml: (
    file: File,
    options?: { targetObjectId?: string; groupId?: string },
  ) => Promise<void> | void;
  onCreateMechanicalAnnotations: (options?: {
    targetObjectId?: string;
    groupId?: string;
  }) => Promise<void> | void;
  onLoadSpriteToml: (
    file: File,
    options?: { targetId?: string; groupId?: string },
  ) => Promise<void> | void;
  onReturnToModeSelection: () => void;
  onSelectObject: (id: string) => void;
  onToggleObjectVisibility?: (id: string, visible: boolean) => void;
};

type CanvasLayerPanelViewProps = {
  activeModeTitle: string;
  collapsedGroups: ReadonlySet<string>;
  document: CanvasDocument;
  isAddMenuOpen: boolean;
  onCloseAddMenu: () => void;
  tree: readonly CanvasLayerTreeItem[];
  onAddAlphaMask: () => void;
  onAddGuideToml: () => void;
  onAddBlockoutToml: () => void;
  onAddGroup: () => void;
  onAddImage: () => void;
  onAddMechanicalAnnotations: () => void;
  onAddSketchToml: () => void;
  onAddSpriteToml: () => void;
  onClearSelection: () => void;
  onReturnToModeSelection: () => void;
  onSelectObject: (id: string) => void;
  onToggleObjectVisibility?: (id: string, visible: boolean) => void;
  onToggleAddMenu: () => void;
  onToggleGroup: (id: string) => void;
};

const LAYER_ADD_ACTIONS = [
  {
    id: "group",
    title: "Group",
    description: "Organize layers",
    action: "group",
  },
  {
    id: "image",
    title: "Image",
    description: "Add a source image",
    action: "image",
  },
  {
    id: "blockout",
    title: "Blockout TOML",
    description: "Attach blockout feature IR",
    action: "blockout",
  },
  {
    id: "mechanical",
    title: "Mechanical annotations",
    description: "Add drafting dimensions and notes",
    action: "mechanical",
  },
  {
    id: "guide",
    title: "Guide TOML",
    description: "Attach authoring guide IR",
    action: "guide",
  },
  {
    id: "sprite",
    title: "Sprite TOML",
    description: "Attach sprite metadata",
    action: "sprite",
  },
  {
    id: "sketch",
    title: "Sketch TOML",
    description: "Attach sketch overlay",
    action: "sketch",
  },
  {
    id: "alpha",
    title: "Alpha mask",
    description: "Attach alpha mask to image",
    action: "alpha",
  },
] as const;

function getOwnerImageForObject(
  document: CanvasDocument,
  selected: CanvasObject | undefined,
): ImageObject | undefined {
  if (!selected) return undefined;
  if (selected.kind === "image" && (selected.role === undefined || selected.role === "image")) {
    return selected;
  }
  if (
    selected.kind === "spriteSidecar" ||
    selected.kind === "sketchOverlay" ||
    selected.kind === "guideSidecar" ||
    selected.kind === "blockoutSidecar" ||
    selected.kind === "mechanicalAnnotationSidecar"
  ) {
    const targetId =
      selected.kind === "guideSidecar"
        ? (selected.targetId ?? selected.guide.target)
        : selected.kind === "blockoutSidecar"
          ? selected.targetObjectId
          : selected.kind === "mechanicalAnnotationSidecar"
            ? selected.targetObjectId
            : (selected.targetId ?? selected.spec.targetId);
    const target = targetId ? document.objects[targetId] : undefined;
    return target?.kind === "image" ? target : undefined;
  }
  if (selected.kind === "image" && (selected.role === "alphaMap" || selected.role === "mask")) {
    return Object.values(document.objects).find(
      (candidate): candidate is ImageObject =>
        candidate.kind === "image" &&
        (candidate.role === undefined || candidate.role === "image") &&
        candidate.alphaMapId === selected.id,
    );
  }
  return undefined;
}

function getLayerGroupSelection(document: CanvasDocument): { groupId?: string; imageId?: string } {
  const selected = document.selectedObjectId
    ? document.objects[document.selectedObjectId]
    : undefined;
  const ownerImage = getOwnerImageForObject(document, selected);
  return {
    groupId: findCanvasLayerGroupForObject(document, ownerImage?.id ?? selected?.id),
    imageId: ownerImage?.id,
  };
}

function LayerTreeRow({
  item,
  collapsedGroups,
  onSelectObject,
  onToggleObjectVisibility,
  onToggleGroup,
}: {
  item: CanvasLayerTreeItem;
  collapsedGroups: ReadonlySet<string>;
  onSelectObject: (id: string) => void;
  onToggleObjectVisibility?: (id: string, visible: boolean) => void;
  onToggleGroup: (id: string) => void;
}) {
  if (item.kind === "group") {
    const collapsed = collapsedGroups.has(item.id);
    return (
      <section className="tree-layer" key={item.id}>
        <button
          aria-expanded={!collapsed}
          className="layer-row layer-group-row"
          type="button"
          onClick={() => onToggleGroup(item.id)}
        >
          <span>{item.title}</span>
          <small>{item.count ?? item.children?.length ?? 0}</small>
        </button>
        {!collapsed ? (
          <div className="tree-objects">
            {item.children?.map((child) => (
              <LayerTreeRow
                collapsedGroups={collapsedGroups}
                item={child}
                key={child.id}
                onSelectObject={onSelectObject}
                onToggleObjectVisibility={onToggleObjectVisibility}
                onToggleGroup={onToggleGroup}
              />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <button
        className={`tree-object ${item.selected ? "is-selected" : ""} ${
          item.kind === "attachment" ? "is-attachment" : ""
        } ${item.warning ? "has-warning" : ""}`}
        title={item.title}
        type="button"
        onClick={() => item.objectId && onSelectObject(item.objectId)}
      >
        <span className="kind-pill">{item.badge}</span>
        <span className="tree-object-main">
          <strong>{item.title}</strong>
          {item.subtitle ? <small>{item.subtitle}</small> : null}
          {item.warning ? <em>{item.warning}</em> : null}
        </span>
        {item.kind === "attachment" &&
        item.objectId &&
        item.visible !== undefined &&
        onToggleObjectVisibility ? (
          <button
            className={`tree-visibility ${item.visible ? "is-visible" : "is-hidden"}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleObjectVisibility(item.objectId as string, !item.visible);
            }}
          >
            {item.visible ? "Visible" : "Hidden"}
          </button>
        ) : null}
      </button>
      {item.children?.length ? (
        <div className="tree-children">
          {item.children.map((child) => (
            <LayerTreeRow
              collapsedGroups={collapsedGroups}
              item={child}
              key={child.id}
              onSelectObject={onSelectObject}
              onToggleObjectVisibility={onToggleObjectVisibility}
              onToggleGroup={onToggleGroup}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

export function CanvasLayerPanelView(props: CanvasLayerPanelViewProps) {
  const {
    activeModeTitle,
    collapsedGroups,
    document,
    isAddMenuOpen,
    onCloseAddMenu,
    tree,
    onAddAlphaMask,
    onAddBlockoutToml,
    onAddGuideToml,
    onAddGroup,
    onAddImage,
    onAddMechanicalAnnotations,
    onAddSketchToml,
    onAddSpriteToml,
    onClearSelection,
    onReturnToModeSelection,
    onSelectObject,
    onToggleObjectVisibility,
    onToggleAddMenu,
    onToggleGroup,
  } = props;
  const addMenuActions = {
    alpha: onAddAlphaMask,
    blockout: onAddBlockoutToml,
    guide: onAddGuideToml,
    group: onAddGroup,
    image: onAddImage,
    mechanical: onAddMechanicalAnnotations,
    sketch: onAddSketchToml,
    sprite: onAddSpriteToml,
  } as const;
  const onAddMenuEscape = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && isAddMenuOpen) {
      event.stopPropagation();
      onCloseAddMenu();
    }
  };

  return (
    <aside className="scene-tree panel">
      <header className="app-wordmark">
        <span>MachinaCanvas</span>
        <small>LLM geometry editor</small>
        <div className="mode-meta">
          <p>{`Mode: ${activeModeTitle}`}</p>
          <button type="button" onClick={onReturnToModeSelection}>
            New canvas
          </button>
        </div>
      </header>

      <section className="layer-panel-actions">
        <div className="layer-panel__header">
          <div className="layer-panel-actions-header">
            <strong>Layers</strong>
            <small>Ownership tree</small>
          </div>
          <div className="layer-panel__add-shell">
            <button
              aria-expanded={isAddMenuOpen}
              aria-haspopup="menu"
              className="layer-panel__add"
              type="button"
              onKeyDown={onAddMenuEscape}
              onClick={onToggleAddMenu}
            >
              + Add
            </button>
            {isAddMenuOpen ? (
              <div aria-label="Add layer item" className="layer-panel__add-menu" role="menu">
                {LAYER_ADD_ACTIONS.map((item) => (
                  <button
                    className="layer-panel__add-menu-item"
                    key={item.id}
                    role="menuitem"
                    type="button"
                    onKeyDown={onAddMenuEscape}
                    onClick={() => {
                      addMenuActions[item.action]();
                      onCloseAddMenu();
                    }}
                  >
                    <span className="layer-panel__add-menu-item-title">{item.title}</span>
                    <span className="layer-panel__add-menu-item-description">
                      {item.description}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <nav aria-label="Scene layers">
        <button className="layer-row" type="button" onClick={onClearSelection}>
          <span>Scene</span>
          <small>{Object.keys(document.objects).length}</small>
        </button>
        {tree.map((item) => (
          <LayerTreeRow
            collapsedGroups={collapsedGroups}
            item={item}
            key={item.id}
            onSelectObject={onSelectObject}
            onToggleObjectVisibility={onToggleObjectVisibility}
            onToggleGroup={onToggleGroup}
          />
        ))}
      </nav>
    </aside>
  );
}

export function CanvasLayerPanel(props: LayerPanelProps) {
  const {
    activeModeTitle,
    document,
    onClearSelection,
    onCreateGroup,
    onCreateMechanicalAnnotations,
    onLoadAlphaMask,
    onLoadBlockoutToml,
    onLoadGuideToml,
    onLoadImage,
    onLoadSketchToml,
    onLoadSpriteToml,
    onReturnToModeSelection,
    onSelectObject,
    onToggleObjectVisibility,
  } = props;
  const imageInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const guideInputRef = useRef<HTMLInputElement>(null);
  const blockoutInputRef = useRef<HTMLInputElement>(null);
  const sketchInputRef = useRef<HTMLInputElement>(null);
  const alphaInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildCanvasLayerTree(document), [document]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      for (const item of tree) {
        if (item.kind !== "group") continue;
        if (
          !document.layerGroups?.some((group) => `group:${group.id}` === item.id && group.collapsed)
        ) {
          next.delete(item.id);
        }
      }
      return next;
    });
  }, [document.layerGroups, tree]);

  useEffect(() => {
    if (!isAddMenuOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!addMenuRef.current?.contains(event.target)) {
        setIsAddMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isAddMenuOpen]);

  const selection = getLayerGroupSelection(document);

  const onInput =
    (
      callback: (
        file: File,
        options?: {
          attachToImageId?: string;
          groupId?: string;
          targetId?: string;
          targetObjectId?: string;
        },
      ) => Promise<void> | void,
      options?: {
        attachToImageId?: string;
        groupId?: string;
        targetId?: string;
        targetObjectId?: string;
      },
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) void callback(file, options);
    };

  return (
    <>
      <input
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="asset-file-input"
        ref={imageInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadImage(file, { groupId: selection.groupId, role: "image" }),
        )}
      />
      <input
        accept=".toml,.sprite.toml,.spriteforge.toml,text/plain"
        className="asset-file-input"
        ref={spriteInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadSpriteToml(file, { groupId: selection.groupId, targetId: selection.imageId }),
        )}
      />
      <input
        accept=".toml,.guide.toml,text/plain"
        className="asset-file-input"
        ref={guideInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadGuideToml(file, { groupId: selection.groupId, targetId: selection.imageId }),
        )}
      />
      <input
        accept=".toml,.blockout.toml,text/plain"
        className="asset-file-input"
        ref={blockoutInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadBlockoutToml(file, {
            groupId: selection.groupId,
            targetObjectId: document.selectedObjectId,
          }),
        )}
      />
      <input
        accept=".toml,.sketch.toml,text/plain"
        className="asset-file-input"
        ref={sketchInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadSketchToml(file, { groupId: selection.groupId, targetId: selection.imageId }),
        )}
      />
      <input
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="asset-file-input"
        ref={alphaInputRef}
        type="file"
        onChange={onInput((file) =>
          onLoadAlphaMask(file, {
            attachToImageId: selection.imageId,
            groupId: selection.groupId,
          }),
        )}
      />
      <div ref={addMenuRef}>
        <CanvasLayerPanelView
          activeModeTitle={activeModeTitle}
          collapsedGroups={collapsedGroups}
          document={document}
          isAddMenuOpen={isAddMenuOpen}
          tree={tree}
          onAddAlphaMask={() => alphaInputRef.current?.click()}
          onAddBlockoutToml={() => blockoutInputRef.current?.click()}
          onAddGuideToml={() => guideInputRef.current?.click()}
          onAddGroup={() => onCreateGroup(window.prompt("Group name", "New group") ?? "New group")}
          onAddImage={() => imageInputRef.current?.click()}
          onAddMechanicalAnnotations={() =>
            onCreateMechanicalAnnotations({
              groupId: selection.groupId,
              targetObjectId: selection.imageId,
            })
          }
          onAddSketchToml={() => sketchInputRef.current?.click()}
          onAddSpriteToml={() => spriteInputRef.current?.click()}
          onClearSelection={onClearSelection}
          onCloseAddMenu={() => setIsAddMenuOpen(false)}
          onReturnToModeSelection={onReturnToModeSelection}
          onSelectObject={onSelectObject}
          onToggleObjectVisibility={onToggleObjectVisibility}
          onToggleAddMenu={() => setIsAddMenuOpen((current) => !current)}
          onToggleGroup={(id) =>
            setCollapsedGroups((current) => {
              const next = new Set(current);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
      </div>
    </>
  );
}
