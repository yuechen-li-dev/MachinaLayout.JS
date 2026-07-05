/* @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";

import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MachinaLayoutError,
  MachinaReactErrorBoundary,
  MachinaReactErrorSurface,
  MachinaReactView,
  normalizeMachinaError,
  type ResolvedLayoutDocument,
} from "../src";

afterEach(() => {
  cleanup();
});

function withSuppressedConsoleError(run: () => void): void {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    run();
  } finally {
    consoleError.mockRestore();
  }
}

describe("normalizeMachinaError", () => {
  it("normalizes a MachinaLayoutError with code and message", () => {
    const diagnostic = normalizeMachinaError(
      new MachinaLayoutError(
        "MissingParent",
        'row "sidebar" references missing parent "app-shell".',
      ),
    );

    expect(diagnostic).toMatchObject({
      code: "MissingParent",
      name: "MachinaLayoutError",
      message: 'row "sidebar" references missing parent "app-shell".',
    });
  });

  it("normalizes a standard Error with stack", () => {
    const error = new Error("plain runtime failure");
    error.name = "TypeError";
    error.stack = "stack-line";

    const diagnostic = normalizeMachinaError(error);

    expect(diagnostic).toMatchObject({
      code: "RuntimeError",
      name: "TypeError",
      message: "plain runtime failure",
      stack: "stack-line",
    });
  });

  it("normalizes non-Error throws", () => {
    expect(normalizeMachinaError(42)).toEqual({
      code: "NonErrorThrow",
      name: "NonErrorThrow",
      message: "42",
    });
  });

  it("collects relevant diagnostic context from enumerable fields", () => {
    const diagnostic = normalizeMachinaError({
      code: "MissingParentRow",
      name: "MachinaRuntimeError",
      message: 'Row "sidebar" references missing parent "app-shell".',
      diagnostics: ["row id: sidebar", "parent id: app-shell"],
      phase: "resolve",
    });

    expect(diagnostic.details).toEqual([
      "row id: sidebar",
      "parent id: app-shell",
      "phase: resolve",
    ]);
  });

  it("does not throw during normalization", () => {
    const thrown = {
      get message(): string {
        throw new Error("message getter failed");
      },
    };

    expect(() => normalizeMachinaError(thrown)).not.toThrow();
    expect(normalizeMachinaError(thrown).code).toBe("ErrorNormalizationFailure");
  });
});

describe("MachinaReactErrorSurface", () => {
  const diagnostic = {
    code: "MissingParentRow",
    name: "MachinaLayoutError",
    message: 'Row "sidebar" references missing parent "app-shell".',
    details: ["row id: sidebar", "parent id: app-shell"],
    stack: "stack-line",
  } as const;

  it("renders a plain visible diagnostic surface", () => {
    render(<MachinaReactErrorSurface diagnostic={diagnostic} />);

    expect(screen.getByText("MachinaLayout render failed")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("MissingParentRow")).toBeInTheDocument();
    expect(screen.getByText("Message")).toBeInTheDocument();
    expect(
      screen.getByText('Row "sidebar" references missing parent "app-shell".'),
    ).toBeInTheDocument();
    expect(screen.getByText(/The error was also reported to the console\./)).toBeInTheDocument();
  });

  it("renders diagnostics and stable data attributes", () => {
    const { container } = render(<MachinaReactErrorSurface diagnostic={diagnostic} />);
    const surface = container.querySelector("[data-machina-error-surface]");

    expect(surface).toHaveAttribute("data-machina-error-code", "MissingParentRow");
    expect(surface).toHaveAttribute("data-machina-error-name", "MachinaLayoutError");
    expect(screen.getByText(/row id: sidebar/)).toBeInTheDocument();
    expect(screen.getByText(/parent id: app-shell/)).toBeInTheDocument();
  });

  it("hides stack by default and shows it when requested", () => {
    const { rerender } = render(<MachinaReactErrorSurface diagnostic={diagnostic} />);
    expect(screen.queryByText("Stack")).not.toBeInTheDocument();

    rerender(<MachinaReactErrorSurface diagnostic={diagnostic} showStack />);
    expect(screen.getByText("Stack")).toBeInTheDocument();
    expect(screen.getByText("stack-line")).toBeInTheDocument();
  });

  it("does not use cute generic error copy", () => {
    render(<MachinaReactErrorSurface diagnostic={diagnostic} />);
    expect(document.body.textContent ?? "").not.toMatch(
      /oops|whoops|doo-doo|something went wrong/i,
    );
  });
});

describe("MachinaReactErrorBoundary", () => {
  function ThrowingChild(): React.ReactElement {
    throw new MachinaLayoutError("Cycle", "cycle detected at 'root'");
  }

  it("catches render errors and shows the default surface", () => {
    withSuppressedConsoleError(() => {
      render(
        <MachinaReactErrorBoundary>
          <ThrowingChild />
        </MachinaReactErrorBoundary>,
      );
    });

    expect(screen.getByText("MachinaLayout render failed")).toBeInTheDocument();
    expect(screen.getByText("Cycle")).toBeInTheDocument();
    expect(screen.getByText("cycle detected at 'root'")).toBeInTheDocument();
  });

  it("uses a custom fallback when provided", () => {
    const CustomFallback = ({ diagnostic }: { diagnostic: { code: string } }) => (
      <div>custom fallback {diagnostic.code}</div>
    );

    withSuppressedConsoleError(() => {
      render(
        <MachinaReactErrorBoundary fallback={CustomFallback}>
          <ThrowingChild />
        </MachinaReactErrorBoundary>,
      );
    });

    expect(screen.getByText("custom fallback Cycle")).toBeInTheDocument();
  });

  it("passes the normalized diagnostic to onError", () => {
    const onError = vi.fn();

    withSuppressedConsoleError(() => {
      render(
        <MachinaReactErrorBoundary onError={onError}>
          <ThrowingChild />
        </MachinaReactErrorBoundary>,
      );
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      code: "Cycle",
      name: "MachinaLayoutError",
      message: "cycle detected at 'root'",
    });
  });
});

describe("MachinaReactView error handling", () => {
  const invalidLayout: ResolvedLayoutDocument = {
    rootId: "missing-root",
    nodes: {
      root: {
        id: "root",
        rect: { x: 0, y: 0, width: 100, height: 100 },
        frame: { kind: "root" },
      },
    },
    children: { root: [] },
  };

  it("renders a visible diagnostic surface instead of blanking when layout resolution fails", () => {
    const onMachinaError = vi.fn();

    render(<MachinaReactView layout={invalidLayout} onMachinaError={onMachinaError} />);

    expect(screen.getByText("MachinaLayout render failed")).toBeInTheDocument();
    expect(screen.getByText("MissingRoot")).toBeInTheDocument();
    expect(screen.getByText(/root node 'missing-root' is missing/)).toBeInTheDocument();
    expect(document.querySelector("[data-machina-error-surface]")).toBeInTheDocument();
    expect(onMachinaError).toHaveBeenCalledTimes(1);
    expect(onMachinaError.mock.calls[0]?.[0]).toMatchObject({ code: "MissingRoot" });
  });

  it("preserves throw-through behavior when errorBoundary is false", () => {
    expect(() => render(<MachinaReactView layout={invalidLayout} errorBoundary={false} />)).toThrow(
      /root node 'missing-root' is missing/,
    );
  });

  it("catches descendant React render errors with the boundary path", () => {
    const BadView = (): React.ReactElement => {
      throw new Error("slot render failed");
    };
    const layout: ResolvedLayoutDocument = {
      rootId: "root",
      nodes: {
        root: {
          id: "root",
          rect: { x: 0, y: 0, width: 200, height: 120 },
          frame: { kind: "root" },
        },
        panel: {
          id: "panel",
          rect: { x: 10, y: 10, width: 120, height: 50 },
          frame: { kind: "absolute", x: 10, y: 10, width: 120, height: 50 },
          view: "Panel",
        },
      },
      children: { root: ["panel"], panel: [] },
    };

    withSuppressedConsoleError(() => {
      render(<MachinaReactView layout={layout} views={{ Panel: BadView }} />);
    });

    expect(screen.getByText("MachinaLayout render failed")).toBeInTheDocument();
    expect(screen.getByText("RuntimeError")).toBeInTheDocument();
    expect(screen.getByText("slot render failed")).toBeInTheDocument();
  });
});
