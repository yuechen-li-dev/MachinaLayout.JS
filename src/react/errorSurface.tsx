import React from "react";

import { normalizeMachinaError, type MachinaErrorDiagnostic } from "../errors";

export type MachinaReactErrorSurfaceProps = {
  diagnostic: MachinaErrorDiagnostic;
  title?: string;
  showStack?: boolean;
};

export type MachinaReactErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ComponentType<MachinaReactErrorSurfaceProps>;
  showStack?: boolean;
  onError?: (diagnostic: MachinaErrorDiagnostic, error: unknown) => void;
  title?: string;
};

type MachinaReactErrorBoundaryState = {
  diagnostic?: MachinaErrorDiagnostic;
  error?: unknown;
};

function renderPreformattedBlock(value: string): React.ReactElement {
  return (
    <pre
      style={{
        margin: 0,
        padding: "12px 14px",
        borderRadius: 6,
        border: "1px solid #d1d5db",
        background: "#ffffff",
        color: "#111827",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily:
          'ui-monospace, "SFMono-Regular", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {value}
    </pre>
  );
}

function renderSurface(
  diagnostic: MachinaErrorDiagnostic,
  fallback: React.ComponentType<MachinaReactErrorSurfaceProps> | undefined,
  title: string | undefined,
  showStack: boolean | undefined,
): React.ReactElement {
  const surfaceProps: MachinaReactErrorSurfaceProps = {
    diagnostic,
    title,
    showStack,
  };

  if (!fallback) {
    return <MachinaReactErrorSurface {...surfaceProps} />;
  }

  try {
    return React.createElement(fallback, surfaceProps);
  } catch (fallbackError) {
    const fallbackDiagnostic = normalizeMachinaError(fallbackError);
    const nextDetails = [
      ...(diagnostic.details ?? []),
      `Fallback render failed: ${fallbackDiagnostic.name}: ${fallbackDiagnostic.message}`,
    ];
    return (
      <MachinaReactErrorSurface
        diagnostic={{ ...diagnostic, details: nextDetails }}
        title={title}
        showStack={showStack}
      />
    );
  }
}

export function MachinaReactErrorSurface(props: MachinaReactErrorSurfaceProps): React.ReactElement {
  const { diagnostic, title = "MachinaLayout render failed", showStack = false } = props;
  const sections: Array<{ label: string; value: string }> = [
    { label: "Code", value: diagnostic.code },
    { label: "Name", value: diagnostic.name },
    { label: "Message", value: diagnostic.message },
  ];

  if (diagnostic.cause) {
    sections.push({ label: "Cause", value: diagnostic.cause });
  }

  return (
    <div
      data-machina-error-surface=""
      data-machina-error-code={diagnostic.code}
      data-machina-error-name={diagnostic.name}
      style={{
        boxSizing: "border-box",
        minHeight: "100%",
        width: "100%",
        padding: 24,
        background: "#f3f4f6",
        color: "#111827",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          boxSizing: "border-box",
          maxWidth: 960,
          margin: "0 auto",
          padding: 20,
          border: "1px solid #dc2626",
          borderRadius: 8,
          background: "#f9fafb",
          boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 20px", fontSize: 24, lineHeight: 1.2, fontWeight: 700 }}>
          {title}
        </h1>
        <div style={{ display: "grid", gap: 16 }}>
          {sections.map((section) => (
            <section key={section.label}>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 14,
                  lineHeight: 1.3,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                {section.label}
              </h2>
              {renderPreformattedBlock(section.value)}
            </section>
          ))}
          {diagnostic.details?.length ? (
            <section>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 14,
                  lineHeight: 1.3,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Diagnostics
              </h2>
              {renderPreformattedBlock(
                diagnostic.details.map((detail) => `- ${detail}`).join("\n"),
              )}
            </section>
          ) : null}
          {showStack && diagnostic.stack ? (
            <section>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 14,
                  lineHeight: 1.3,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  textTransform: "uppercase",
                }}
              >
                Stack
              </h2>
              {renderPreformattedBlock(diagnostic.stack)}
            </section>
          ) : null}
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            The error was also reported to the console.
          </p>
        </div>
      </div>
    </div>
  );
}

export class MachinaReactErrorBoundary extends React.Component<
  MachinaReactErrorBoundaryProps,
  MachinaReactErrorBoundaryState
> {
  override state: MachinaReactErrorBoundaryState = {};

  static getDerivedStateFromError(error: unknown): MachinaReactErrorBoundaryState {
    return {
      diagnostic: normalizeMachinaError(error),
      error,
    };
  }

  override componentDidCatch(error: unknown): void {
    const diagnostic = this.state.diagnostic ?? normalizeMachinaError(error);
    this.props.onError?.(diagnostic, error);
  }

  override render(): React.ReactNode {
    if (!this.state.diagnostic) {
      return this.props.children;
    }

    return renderSurface(
      this.state.diagnostic,
      this.props.fallback,
      this.props.title,
      this.props.showStack,
    );
  }
}

export function renderMachinaReactErrorSurface(
  diagnostic: MachinaErrorDiagnostic,
  options?: Omit<MachinaReactErrorBoundaryProps, "children" | "onError">,
): React.ReactElement {
  return renderSurface(diagnostic, options?.fallback, options?.title, options?.showStack);
}
