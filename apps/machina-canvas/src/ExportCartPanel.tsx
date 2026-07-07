import type {
  CanvasExportArtifact,
  CanvasExportCart,
  CanvasExportCheckoutResult,
  CanvasExportPreset,
} from "./exportCart";

function formatArtifactKind(kind: CanvasExportArtifact["kind"]): string {
  switch (kind) {
    case "documentJson":
      return "document.json";
    case "handoffToml":
      return "handoff.toml";
    case "renderSvg":
      return "render.svg";
    case "renderPng":
      return "render.png";
    case "spriteToml":
      return "sprite.toml";
    case "spriteCompileReport":
      return "compile report";
    case "guideToml":
      return "guide.toml";
    case "sketchToml":
      return "sketch.toml";
    case "spriteAudit":
      return "sprite audit";
    case "diagnostics":
      return "diagnostics";
    case "frameTable":
      return "frame table";
    case "checkpoint":
      return "checkpoint";
    case "mcanvas":
      return ".mcanvas";
    default:
      return "other";
  }
}

export function ExportCartPanel({
  artifacts,
  cart,
  presets,
  checkpointNote,
  lastCheckout,
  status,
  onApplyPreset,
  onToggleArtifact,
  onCheckout,
  onCheckpointNoteChange,
  onSaveCheckpoint,
}: {
  artifacts: readonly CanvasExportArtifact[];
  cart: CanvasExportCart;
  presets: readonly CanvasExportPreset[];
  checkpointNote: string;
  lastCheckout?: CanvasExportCheckoutResult;
  status: string;
  onApplyPreset: (presetId: string) => void;
  onToggleArtifact: (artifactId: string) => void;
  onCheckout: () => void;
  onCheckpointNoteChange: (value: string) => void;
  onSaveCheckpoint: () => void;
}) {
  const selectedCount = cart.selectedArtifactIds.length;

  return (
    <div className="export-cart-panel">
      <div className="export-cart-panel__intro">
        <h4>Export cart</h4>
        <p>
          Export is a cart: choose a preset or individual artifacts, then check out the bundle you
          actually need.
        </p>
        <p>Checkpoint keeps editor state. Export checkout produces handoff artifacts.</p>
      </div>

      <ul className="export-cart-presets" aria-label="Export presets">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              className={`export-cart-preset ${cart.presetId === preset.id ? "is-active" : ""}`}
              onClick={() => onApplyPreset(preset.id)}
              type="button"
            >
              <strong>{preset.title}</strong>
              <span>{preset.description}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="export-cart-summary">
        <strong>{selectedCount} selected</strong>
        <span>{artifacts.length} available artifacts</span>
      </div>

      <div className="export-artifact-grid">
        {artifacts.map((artifact) => {
          const checked = cart.selectedArtifactIds.includes(artifact.id);
          return (
            <label
              className={`export-artifact-card ${checked ? "is-selected" : ""} ${artifact.required ? "is-required" : ""}`}
              key={artifact.id}
            >
              <input
                checked={checked}
                disabled={artifact.required}
                onChange={() => onToggleArtifact(artifact.id)}
                type="checkbox"
              />
              <div className="export-artifact-card__body">
                <div className="export-artifact-card__top">
                  <strong>{artifact.title}</strong>
                  <small>{formatArtifactKind(artifact.kind)}</small>
                </div>
                <p>{artifact.description}</p>
                <span>{artifact.filename}</span>
                {artifact.sourceObjectId ? (
                  <em>{`Source object: ${artifact.sourceObjectId}`}</em>
                ) : null}
              </div>
            </label>
          );
        })}
      </div>

      <div className="export-cart-actions">
        <button type="button" onClick={onCheckout} disabled={cart.selectedArtifactIds.length === 0}>
          Checkout selected
        </button>
      </div>

      <div className="export-checkpoint-row">
        <input
          aria-label="Checkpoint note"
          onChange={(event) => onCheckpointNoteChange(event.currentTarget.value)}
          placeholder="Checkpoint note"
          type="text"
          value={checkpointNote}
        />
        <button type="button" onClick={onSaveCheckpoint}>
          Save checkpoint
        </button>
      </div>

      {status ? <p className="export-status">{status}</p> : null}
      {lastCheckout ? (
        <div className={`validation-result ${lastCheckout.kind === "ok" ? "is-ok" : "is-error"}`}>
          <strong>
            {lastCheckout.kind === "ok" ? "Last checkout succeeded" : "Last checkout failed"}
          </strong>
          {lastCheckout.kind === "ok" ? (
            <p>{lastCheckout.filenames.join(", ")}</p>
          ) : (
            <p>
              {lastCheckout.failedArtifactId ? `${lastCheckout.failedArtifactId}: ` : ""}
              {lastCheckout.message}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
