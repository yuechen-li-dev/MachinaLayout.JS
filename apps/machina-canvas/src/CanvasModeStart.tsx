import {
  CANVAS_EDITOR_MODE_TEMPLATES,
  type CanvasEditorModeId,
  type CanvasEditorModeTemplate,
} from "./editorModes";

export function CanvasModeStart({
  onSelectMode,
}: {
  onSelectMode: (mode: CanvasEditorModeId) => void;
}) {
  return (
    <main className="canvas-mode-start">
      <section className="canvas-mode-start__hero">
        <p className="canvas-mode-start__eyebrow">MachinaCanvas</p>
        <h1>Choose what you want to author first.</h1>
        <p className="canvas-mode-start__intro">
          MachinaCanvas is one editor engine with mode-based templates for different authoring
          starts.
        </p>
      </section>
      <section className="canvas-mode-start__grid" aria-label="Canvas editor modes">
        {CANVAS_EDITOR_MODE_TEMPLATES.map((template) => (
          <ModeCard key={template.id} template={template} onSelectMode={onSelectMode} />
        ))}
      </section>
    </main>
  );
}

function ModeCard({
  template,
  onSelectMode,
}: {
  template: CanvasEditorModeTemplate;
  onSelectMode: (mode: CanvasEditorModeId) => void;
}) {
  return (
    <button
      className="canvas-mode-card"
      type="button"
      onClick={() => onSelectMode(template.id)}
      aria-label={`Open ${template.title}`}
    >
      <div className="canvas-mode-card__header">
        <span>{template.subtitle}</span>
        <strong>{template.title}</strong>
      </div>
      <p>{template.description}</p>
      <div className="canvas-mode-card__tags">
        {template.tags.map((tag) => (
          <small key={tag}>{tag}</small>
        ))}
      </div>
    </button>
  );
}
