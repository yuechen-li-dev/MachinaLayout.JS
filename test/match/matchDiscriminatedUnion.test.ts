import { describe, expect, it } from "vitest";
import {
  type DiscriminatedCaseMap,
  type KindCaseMap,
  type KindCaseMapWithDefault,
  matchDiscriminated,
  matchKind,
  MatchUnionError,
} from "../../src/match";

type Result = { kind: "ok"; value: number } | { kind: "err"; message: string; code: number };

describe("matchKind", () => {
  it("dispatches the ok payload and returns the handler result", () => {
    const result = matchKind<Result, string>(
      { kind: "ok", value: 42 },
      {
        ok: (value) => `value ${value.value}`,
        err: (value) => `error ${value.code}: ${value.message}`,
      },
    );

    expect(result).toBe("value 42");
  });

  it("dispatches the err payload with full narrowing", () => {
    const result = matchKind<Result, string>(
      { kind: "err", message: "denied", code: 403 },
      {
        ok: (value) => `value ${value.value}`,
        err: (value) => `${value.code}:${value.message}`,
      },
    );

    expect(result).toBe("403:denied");
  });

  it("supports compile-time exhaustive maps and payload narrowing", () => {
    const value: Result =
      Math.random() > 0.5 ? { kind: "ok", value: 1 } : { kind: "err", message: "boom", code: 500 };
    const output = matchKind(value, {
      ok: (result) => {
        const payload: number = result.value;
        return `value ${payload}`;
      },
      err: (result) => {
        const payload: string = result.message;
        return `error ${payload}`;
      },
    });

    // @ts-expect-error Missing err is intentionally non-exhaustive.
    const missingCases: KindCaseMap<Result, string> = {
      ok: (result) => `value ${result.value}`,
    };

    matchKind(value, {
      ok: (result) => {
        // @ts-expect-error err payload fields should not exist on ok.
        return result.message;
      },
      err: (result) => result.message,
    });

    expect(output === "value 1" || output === "error boom").toBe(true);
    void missingCases;
  });

  it("throws MatchUnionError for an unknown runtime discriminant", () => {
    const cases = {
      ok: (value: Extract<Result, { kind: "ok" }>) => `value ${value.value}`,
      err: (value: Extract<Result, { kind: "err" }>) => `error ${value.code}: ${value.message}`,
    } as unknown as KindCaseMap<Result, string>;

    expect(() => matchKind({ kind: "missing", detail: true } as unknown as Result, cases)).toThrow(
      MatchUnionError,
    );

    try {
      matchKind({ kind: "missing", detail: true } as unknown as Result, cases);
    } catch (error) {
      expect(error).toBeInstanceOf(MatchUnionError);
      expect((error as MatchUnionError).discriminantKey).toBe("kind");
      expect((error as MatchUnionError).discriminantValue).toBe("missing");
      expect((error as MatchUnionError).availableCases).toEqual(["ok", "err"]);
      expect((error as MatchUnionError).message).toContain("kind");
      expect((error as MatchUnionError).message).toContain("missing");
      expect((error as MatchUnionError).message).toContain("ok");
      expect((error as MatchUnionError).message).toContain("err");
    }
  });

  it("supports a wildcard arm for unhandled variants", () => {
    const value: Result = { kind: "err", message: "denied", code: 403 };
    const output = matchKind<Result, string>(value, {
      ok: (result) => `value ${result.value}`,
      _: (result) => `fallback ${result.kind}`,
    });
    const wildcardCases: KindCaseMapWithDefault<Result, string> = {
      ok: (result) => `value ${result.value}`,
      _: (result) => `fallback ${result.kind}`,
    };

    expect(output).toBe("fallback err");
    void wildcardCases;
  });
});

describe("matchDiscriminated", () => {
  it("supports configurable discriminator keys", () => {
    type Event = { type: "click"; x: number; y: number } | { type: "submit"; formId: string };

    const output = matchDiscriminated<Event, "type", string>(
      { type: "click", x: 3, y: 7 },
      "type",
      {
        click: (event) => `${event.x},${event.y}`,
        submit: (event) => event.formId,
      },
    );

    expect(output).toBe("3,7");
  });

  it("supports number discriminants", () => {
    type Step = { step: 0; label: string } | { step: 1; label: string; done: boolean };

    const output = matchDiscriminated<Step, "step", string>(
      { step: 1, label: "render", done: true },
      "step",
      {
        0: (value) => value.label,
        1: (value) => `${value.label}:${value.done}`,
      },
    );

    expect(output).toBe("render:true");
  });

  it("supports symbol discriminants", () => {
    const ready = Symbol("ready");
    const done = Symbol("done");
    type SymbolEvent = { tag: typeof ready; value: number } | { tag: typeof done; total: number };

    const output = matchDiscriminated<SymbolEvent, "tag", string>({ tag: done, total: 9 }, "tag", {
      [ready]: (value) => `${value.value}`,
      [done]: (value) => `${value.total}`,
    });

    expect(output).toBe("9");
  });

  it("supports compile-time narrowing for configurable discriminators", () => {
    type Event = { type: "click"; x: number; y: number } | { type: "submit"; formId: string };

    const value: Event =
      Math.random() > 0.5 ? { type: "click", x: 1, y: 2 } : { type: "submit", formId: "f-1" };
    const output = matchDiscriminated(value, "type", {
      click: (event) => {
        const x: number = event.x;
        return `${x},${event.y}`;
      },
      submit: (event) => {
        const formId: string = event.formId;
        return formId;
      },
    });

    // @ts-expect-error Missing submit is intentionally non-exhaustive.
    const missingCases: DiscriminatedCaseMap<Event, "type", string> = {
      click: (event) => `${event.x},${event.y}`,
    };

    expect(typeof output).toBe("string");
    void missingCases;
  });

  it("supports wildcard matching for configurable discriminators", () => {
    type Event = { type: "click"; x: number; y: number } | { type: "submit"; formId: string };

    const output = matchDiscriminated<Event, "type", string>(
      { type: "submit", formId: "f-1" },
      "type",
      {
        click: (event) => `${event.x},${event.y}`,
        _: (event) => event.type,
      },
    );

    expect(output).toBe("submit");
  });
});
