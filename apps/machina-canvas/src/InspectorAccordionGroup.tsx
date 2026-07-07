import type { ReactNode } from "react";

export function InspectorAccordionGroup({
  id,
  title,
  summary,
  open,
  children,
  onToggle,
}: {
  readonly id: string;
  readonly title: string;
  readonly summary?: ReactNode;
  readonly open: boolean;
  readonly children: ReactNode;
  readonly onToggle: (id: string) => void;
}) {
  return (
    <section className={`inspector-accordion ${open ? "is-open" : "is-collapsed"}`}>
      <h3>
        <button
          aria-controls={`inspector-accordion-panel-${id}`}
          aria-expanded={open}
          className="inspector-accordion__trigger"
          onClick={() => onToggle(id)}
          type="button"
        >
          <span>{title}</span>
          <small>{summary ?? (open ? "Collapse" : "Expand")}</small>
        </button>
      </h3>
      {open ? (
        <div className="inspector-accordion__panel" id={`inspector-accordion-panel-${id}`}>
          <div className="inspector-rows">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
