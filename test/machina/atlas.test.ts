import { describe, expect, it } from "vitest";
import { MachinaAtlasError } from "../../src/atlas";
import { M, atlas, section } from "../../src/machina";

describe("machina atlas builders", () => {
  it("M.section returns a valid section", () => {
    expect(
      M.section("provider-setup", {
        name: "Provider Setup",
        kind: "page",
        marker: "Provider Setup",
        owns: ["ProviderSetupView"],
      }),
    ).toMatchObject({ key: "provider-setup", name: "Provider Setup", kind: "page" });
  });

  it("M.section copies arrays", () => {
    const owns = ["ProviderSetupView"];
    const tags = ["setup"];
    const built = section("provider-setup", { name: "Provider Setup", owns, tags });
    owns.push("Mutated");
    tags.push("mutated");
    expect(built.owns).toEqual(["ProviderSetupView"]);
    expect(built.tags).toEqual(["setup"]);
  });

  it("M.section rejects invalid key", () => {
    expect(() => section("", { name: "Provider Setup" })).toThrowError(MachinaAtlasError);
  });

  it("M.section rejects invalid name", () => {
    expect(() => section("provider-setup", { name: "" })).toThrowError(MachinaAtlasError);
  });

  it("M.atlas delegates to defineMachinaAtlas", () => {
    expect(atlas({ app: "Scheduling" })).toEqual({
      schemaVersion: 1,
      app: "Scheduling",
      sections: [],
      tags: undefined,
      notes: undefined,
      metadata: undefined,
    });
  });

  it("M.atlas rejects duplicate section keys through Atlas validation", () => {
    expect(() =>
      atlas({
        app: "Scheduling",
        sections: [section("a", { name: "A" }), section("a", { name: "Again" })],
      }),
    ).toThrowError(/Duplicate atlas section key/);
  });

  it("M namespace includes section and atlas", () => {
    expect(typeof M.section).toBe("function");
    expect(typeof M.atlas).toBe("function");
  });

  it("named exports include section and atlas", () => {
    expect(typeof section).toBe("function");
    expect(typeof atlas).toBe("function");
  });
});
