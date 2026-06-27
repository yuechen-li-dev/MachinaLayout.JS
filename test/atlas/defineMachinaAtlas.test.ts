import { describe, expect, it } from "vitest";
import {
  defineMachinaAtlas,
  getMachinaAtlasSection,
  listMachinaAtlasSections,
  MachinaAtlasError,
} from "../../src/atlas";

describe("defineMachinaAtlas", () => {
  it("returns schemaVersion 1, defaults sections, and does not mutate input", () => {
    const input = { app: "Scheduling" };
    const atlas = defineMachinaAtlas(input);
    expect(atlas).toEqual({ schemaVersion: 1, app: "Scheduling", sections: [] });
    expect(input).toEqual({ app: "Scheduling" });
  });

  it("preserves section order", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [
        { key: "a", name: "A" },
        { key: "b", name: "B" },
      ],
    });
    expect(atlas.sections.map((section) => section.key)).toEqual(["a", "b"]);
  });

  it("throws coded validation errors", () => {
    expect(() => defineMachinaAtlas({ app: "" })).toThrowError(MachinaAtlasError);
    expect(() => defineMachinaAtlas({ app: "App", sections: [{ key: "", name: "A" }] })).toThrow(
      /key/,
    );
    expect(() => defineMachinaAtlas({ app: "App", sections: [{ key: "a", name: "" }] })).toThrow(
      /name/,
    );
    expect(() =>
      defineMachinaAtlas({
        app: "App",
        sections: [
          { key: "a", name: "A" },
          { key: "a", name: "B" },
        ],
      }),
    ).toThrowError(/Duplicate atlas section key/);
    expect(() =>
      defineMachinaAtlas({ app: "App", sections: [{ key: "a", name: "A", kind: "bad" as never }] }),
    ).toThrowError(/invalid kind/);
    expect(() =>
      defineMachinaAtlas({ app: "App", sections: [{ key: "a", name: "A", owns: [1] as never }] }),
    ).toThrowError(/invalid owns/);
  });

  it("gets sections by key, name, marker, and case-insensitive fallback", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [{ key: "front-page", name: "Front Page", marker: "Front" }],
    });
    expect(getMachinaAtlasSection(atlas, "front-page").name).toBe("Front Page");
    expect(getMachinaAtlasSection(atlas, "Front Page").key).toBe("front-page");
    expect(getMachinaAtlasSection(atlas, "Front").key).toBe("front-page");
    expect(getMachinaAtlasSection(atlas, "FRONT").key).toBe("front-page");
    expect(() => getMachinaAtlasSection(atlas, "missing")).toThrowError(/Unknown atlas section/);
  });

  it("throws on ambiguous case-insensitive atlas lookup", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [
        { key: "a", name: "Thing" },
        { key: "b", name: "thing" },
      ],
    });
    expect(() => getMachinaAtlasSection(atlas, "THING")).toThrowError(/Ambiguous atlas section/);
  });

  it("lists by kind and tags requiring all tags", () => {
    const atlas = defineMachinaAtlas({
      app: "App",
      sections: [
        { key: "a", name: "A", kind: "page", tags: ["x", "y"] },
        { key: "b", name: "B", kind: "shared", tags: ["x"] },
      ],
    });
    expect(listMachinaAtlasSections(atlas, { kind: "page" }).map((s) => s.key)).toEqual(["a"]);
    expect(listMachinaAtlasSections(atlas, { tags: ["x", "y"] }).map((s) => s.key)).toEqual(["a"]);
  });
});
