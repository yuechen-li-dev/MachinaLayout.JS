import { describe, expect, it } from "vitest";
import { matchKind } from "../../src/match";
import {
  D,
  type DiagnosticResult,
  type MachinaDiagnostic,
  type MachinaDiagnosticSeverity,
} from "../../src/diagnostics";

function createDiagnostic(
  severity: MachinaDiagnosticSeverity,
  code: string,
  message: string,
  path?: string,
  source?: string,
): MachinaDiagnostic {
  return { severity, code, message, path, source };
}

describe("diagnostics toolkit", () => {
  it("creates error diagnostics", () => {
    expect(
      D.error({
        code: "ExampleError",
        message: "Something failed.",
        path: "orders[0]",
        source: "sample",
        details: ["value: 1"],
      }),
    ).toEqual({
      severity: "error",
      code: "ExampleError",
      message: "Something failed.",
      path: "orders[0]",
      source: "sample",
      details: ["value: 1"],
    });
  });

  it("creates warning diagnostics", () => {
    expect(D.warning({ code: "ExampleWarning", message: "Something is odd." }).severity).toBe(
      "warning",
    );
  });

  it("creates info diagnostics", () => {
    expect(D.info({ code: "ExampleInfo", message: "FYI." }).severity).toBe("info");
  });

  it("rejects empty code and message", () => {
    expect(() => D.error({ code: "", message: "x" })).toThrow(
      "Machina diagnostic code must be non-empty.",
    );
    expect(() => D.error({ code: "x", message: "   " })).toThrow(
      "Machina diagnostic message must be non-empty.",
    );
  });

  it("collect flattens groups", () => {
    const a = [D.error({ code: "A", message: "a" })];
    const b = [D.warning({ code: "B", message: "b" })];

    expect(D.collect(a, b)).toEqual([...a, ...b]);
  });

  it("collect ignores undefined groups", () => {
    const diagnostics = [D.error({ code: "A", message: "a" })];
    expect(D.collect(undefined, diagnostics, undefined)).toEqual(diagnostics);
  });

  it("collect does not mutate inputs", () => {
    const left = [D.error({ code: "A", message: "a" })];
    const right = [D.warning({ code: "B", message: "b" })];
    const leftBefore = [...left];
    const rightBefore = [...right];

    const collected = D.collect(left, right);
    collected.push(D.info({ code: "C", message: "c" }));

    expect(left).toEqual(leftBefore);
    expect(right).toEqual(rightBefore);
  });

  it("hasErrors works", () => {
    expect(D.hasErrors([D.error({ code: "A", message: "a" })])).toBe(true);
    expect(D.hasErrors([D.warning({ code: "B", message: "b" })])).toBe(false);
  });

  it("hasWarnings works", () => {
    expect(D.hasWarnings([D.warning({ code: "A", message: "a" })])).toBe(true);
    expect(D.hasWarnings([D.info({ code: "B", message: "b" })])).toBe(false);
  });

  it("sort orders by severity, source, path, code, and message", () => {
    const diagnostics = [
      createDiagnostic("warning", "B", "msg-b", "beta", "zeta"),
      createDiagnostic("error", "B", "msg-b", "beta", "zeta"),
      createDiagnostic("error", "A", "msg-b", "beta", "zeta"),
      createDiagnostic("error", "A", "msg-a", "beta", "zeta"),
      createDiagnostic("error", "A", "msg-a", "alpha", "zeta"),
      createDiagnostic("error", "A", "msg-a", "alpha", "alpha"),
      createDiagnostic("info", "A", "msg-a", "alpha", "alpha"),
    ];

    expect(D.sort(diagnostics)).toEqual([
      createDiagnostic("error", "A", "msg-a", "alpha", "alpha"),
      createDiagnostic("error", "A", "msg-a", "alpha", "zeta"),
      createDiagnostic("error", "A", "msg-a", "beta", "zeta"),
      createDiagnostic("error", "A", "msg-b", "beta", "zeta"),
      createDiagnostic("error", "B", "msg-b", "beta", "zeta"),
      createDiagnostic("warning", "B", "msg-b", "beta", "zeta"),
      createDiagnostic("info", "A", "msg-a", "alpha", "alpha"),
    ]);
  });

  it("sort does not mutate input", () => {
    const diagnostics = [
      createDiagnostic("warning", "B", "msg-b"),
      createDiagnostic("error", "A", "msg-a"),
    ];
    const before = [...diagnostics];

    const sorted = D.sort(diagnostics);
    sorted.reverse();

    expect(diagnostics).toEqual(before);
  });

  it("groups missing source under unknown", () => {
    expect(
      D.groupBySource([
        D.error({ code: "A", message: "a" }),
        D.error({ code: "B", message: "b", source: "concept" }),
      ]),
    ).toEqual({
      "(unknown)": [D.error({ code: "A", message: "a" })],
      concept: [D.error({ code: "B", message: "b", source: "concept" })],
    });
  });

  it("formats severity, code, path, message, and details", () => {
    expect(
      D.format([
        D.error({
          code: "ORDER_NEGATIVE_TOTAL",
          message: "Order total must be non-negative.",
          path: "orders[2].totalCents",
          source: "toolkit-pipeline",
          details: ["value: -100"],
        }),
      ]),
    ).toBe(
      [
        "error ORDER_NEGATIVE_TOTAL at orders[2].totalCents",
        "  source: toolkit-pipeline",
        "  Order total must be non-negative.",
        "  - value: -100",
      ].join("\n"),
    );
  });

  it("from converts compatible diagnostics", () => {
    expect(
      D.from([
        {
          severity: "warning",
          code: "ExampleWarning",
          message: "Something is odd.",
          path: "value",
          details: ["note: kept"],
        },
      ]),
    ).toEqual([
      {
        severity: "warning",
        code: "ExampleWarning",
        message: "Something is odd.",
        path: "value",
        details: ["note: kept"],
      },
    ]);
  });

  it("from applies default source", () => {
    expect(D.from([{ severity: "error", code: "A", message: "a" }], { source: "concept" })).toEqual(
      [{ severity: "error", code: "A", message: "a", source: "concept" }],
    );
  });

  it("ok creates ok results", () => {
    expect(D.ok(123, [D.info({ code: "I", message: "i" })])).toEqual({
      kind: "ok",
      value: 123,
      diagnostics: [{ severity: "info", code: "I", message: "i" }],
    });
  });

  it("err creates err results", () => {
    expect(D.err([D.error({ code: "E", message: "e" })])).toEqual({
      kind: "err",
      diagnostics: [{ severity: "error", code: "E", message: "e" }],
    });
  });

  it("DiagnosticResult works with matchKind", () => {
    const result: DiagnosticResult<number> = D.ok(42, [D.info({ code: "I", message: "i" })]);

    expect(
      matchKind(result, {
        ok: (value) => value.value + value.diagnostics.length,
        err: (value) => value.diagnostics.length,
      }),
    ).toBe(43);
  });

  it("exports diagnostics helpers from the diagnostics subpath", async () => {
    const diagnostics = await import("../../src/diagnostics");

    expect(diagnostics.D.error).toBeTypeOf("function");
    expect(diagnostics.D.collect).toBeTypeOf("function");
    expect(diagnostics.D.format).toBeTypeOf("function");
  });
});
