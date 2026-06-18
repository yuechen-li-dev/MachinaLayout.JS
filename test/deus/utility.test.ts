import { describe, expect, it } from "vitest";
import { DeusMachinaError, judgeUtility } from "../../src/deus";

describe("judgeUtility", () => {
  it("selects highest eligible score and traces ineligible candidates", () => {
    const result = judgeUtility({ ok: true }, [
      { key: "a", score: 1 },
      { key: "b", when: () => false, score: 100 },
      { key: "c", score: () => 3, reason: "best" },
    ]);
    expect(result.selected?.key).toBe("c");
    expect(result.candidates[1]).toMatchObject({ key: "b", eligible: false, score: 0 });
    expect(result.selected?.reason).toBe("best");
  });
  it("breaks ties by order and returns null when none eligible", () => {
    expect(
      judgeUtility({}, [
        { key: "a", score: 1 },
        { key: "b", score: 1 },
      ]).selected?.key,
    ).toBe("a");
    expect(judgeUtility({}, [{ key: "a", when: () => false, score: 1 }]).selected).toBeNull();
  });
  it("validates scores and hysteresis", () => {
    expect(() => judgeUtility({}, [{ key: "bad", score: Number.NaN }])).toThrow(DeusMachinaError);
    expect(() => judgeUtility({}, [{ key: "a", score: 1 }], { hysteresis: -1 })).toThrow(
      /hysteresis/,
    );
  });
  it("applies hysteresis without mutating inputs", () => {
    const candidates = [
      { key: "old", score: 10 },
      { key: "new", score: 11 },
    ];
    const result = judgeUtility({}, candidates, { previousKey: "old", hysteresis: 2 });
    expect(result.selected?.key).toBe("old");
    expect(judgeUtility({}, candidates, { previousKey: "old", hysteresis: 1 }).selected?.key).toBe(
      "new",
    );
    expect(candidates).toEqual([
      { key: "old", score: 10 },
      { key: "new", score: 11 },
    ]);
  });
});
