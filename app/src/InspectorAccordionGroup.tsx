import type { ReactNode } from "react";

export type InspectorAccordionGroupProps = {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly open: boolean;
  readonly children: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
};

export function InspectorAccordionGroup({
  id,
  title,
  subtitle,
  open,
  children,
  onOpenChange,
}: InspectorAccordionGroupProps) {
  const panelId = `inspector-accordion-panel-${id}`;

  const toggle = () => {
    onOpenChange(!open);
  };

  return (
    <section className={`inspector-accordion ${open ? "is-open" : "is-collapsed"}`}>
      <h3>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className="inspector-accordion__trigger"
          onClick={toggle}
          type="button"
        >
          <span>{title}</span>
          <small>{subtitle ?? (open ? "Collapse" : "Expand")}</small>
        </button>
      </h3>
      <div className="inspector-accordion__panel" hidden={!open} id={panelId}>
        <div className="inspector-rows">{children}</div>
      </div>
    </section>
  );
}
