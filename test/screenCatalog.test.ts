import { describe, expect, it } from "vitest";
import {
  createViewportMatrix,
  defineMachinaScreens,
  defineMachinaViewports,
  expandScreenViewportTasks,
  getMachinaViewport,
  slugMachinaArtifactName,
} from "../src";

function expectCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(expect.objectContaining({ code }));
}

describe("screen catalog and viewport matrix", () => {
  it("creates standard responsive viewport matrix by default", () => {
    expect(
      createViewportMatrix().map(({ key, width, height }) => ({ key, width, height })),
    ).toEqual([
      { key: "desktop", width: 1440, height: 900 },
      { key: "tablet", width: 1024, height: 768 },
      { key: "phone", width: 390, height: 844 },
    ]);
  });

  it("creates desktop-only and mobile-first presets", () => {
    expect(createViewportMatrix("desktop-only").map((viewport) => viewport.key)).toEqual([
      "desktop",
    ]);
    expect(createViewportMatrix("mobile-first").map((viewport) => viewport.key)).toEqual([
      "phone",
      "tablet",
      "desktop",
    ]);
  });

  it("defines valid viewports with fresh copied objects", () => {
    const input = [{ key: "wide", width: 1600, height: 900, tags: ["desktop"] }];
    const before = JSON.stringify(input);
    const viewports = defineMachinaViewports(input);
    expect(viewports.map((viewport) => viewport.key)).toEqual(["wide"]);
    expect(JSON.stringify(input)).toBe(before);
    expect(viewports[0]).not.toBe(input[0]);
    expect(viewports[0].tags).not.toBe(input[0].tags);
  });

  it("validates viewport keys and dimensions", () => {
    expectCode(
      () =>
        defineMachinaViewports([
          { key: "same", width: 1, height: 1 },
          { key: "same", width: 2, height: 2 },
        ]),
      "DuplicateViewportKey",
    );
    expectCode(() => defineMachinaViewports([{ key: "", width: 1, height: 1 }]), "InvalidViewport");
    expectCode(
      () => defineMachinaViewports([{ key: "bad", width: 0, height: 1 }]),
      "InvalidViewport",
    );
    expectCode(
      () => defineMachinaViewports([{ key: "bad", width: 1, height: -1 }]),
      "InvalidViewport",
    );
    expectCode(
      () => defineMachinaViewports([{ key: "bad", width: 1, height: 1, deviceScaleFactor: 0 }]),
      "InvalidViewport",
    );
  });

  it("defines valid screens with order and fresh copied objects", () => {
    const input = [{ key: "setup", route: "/setup", viewports: ["desktop"], tags: ["setup"] }];
    const before = JSON.stringify(input);
    const catalog = defineMachinaScreens(input);
    expect(catalog.order).toEqual(["setup"]);
    expect(catalog.screens.setup.route).toBe("/setup");
    expect(JSON.stringify(input)).toBe(before);
    expect(catalog.screens.setup).not.toBe(input[0]);
    expect(catalog.screens.setup.tags).not.toBe(input[0].tags);
  });

  it("validates screen keys and routes", () => {
    expectCode(
      () =>
        defineMachinaScreens([
          { key: "same", route: "/a" },
          { key: "same", route: "/b" },
        ]),
      "DuplicateScreenKey",
    );
    expectCode(() => defineMachinaScreens([{ key: "", route: "/a" }]), "InvalidScreen");
    expectCode(() => defineMachinaScreens([{ key: "a", route: "" }]), "InvalidScreen");
  });

  it("expands all tasks in screen order then viewport order", () => {
    const catalog = defineMachinaScreens([
      { key: "a", route: "/a" },
      { key: "b", route: "/b" },
    ]);
    const viewports = defineMachinaViewports([
      { key: "desktop", width: 1, height: 1 },
      { key: "phone", width: 2, height: 2 },
    ]);
    expect(expandScreenViewportTasks(catalog, viewports).map((task) => task.key)).toEqual([
      "a__desktop",
      "a__phone",
      "b__desktop",
      "b__phone",
    ]);
  });

  it("honors screen viewport subsets and viewport filters", () => {
    const catalog = defineMachinaScreens([
      { key: "a", route: "/a", viewports: ["phone"] },
      { key: "b", route: "/b" },
    ]);
    const viewports = createViewportMatrix();
    expect(expandScreenViewportTasks(catalog, viewports).map((task) => task.key)).toContain(
      "a__phone",
    );
    expect(expandScreenViewportTasks(catalog, viewports).map((task) => task.key)).not.toContain(
      "a__desktop",
    );
    expect(
      expandScreenViewportTasks(catalog, viewports, { viewportKeys: ["tablet"] }).map(
        (task) => task.key,
      ),
    ).toEqual(["b__tablet"]);
  });

  it("filters by screen keys", () => {
    const catalog = defineMachinaScreens([
      { key: "a", route: "/a" },
      { key: "b", route: "/b" },
    ]);
    expect(
      expandScreenViewportTasks(catalog, createViewportMatrix("desktop-only"), {
        screenKeys: ["b"],
      }).map((task) => task.screenKey),
    ).toEqual(["b"]);
  });

  it("throws for unknown requested or referenced keys", () => {
    const catalog = defineMachinaScreens([{ key: "a", route: "/a", viewports: ["missing"] }]);
    const viewports = createViewportMatrix("desktop-only");
    expectCode(
      () => expandScreenViewportTasks(catalog, viewports, { screenKeys: ["missing"] }),
      "UnknownScreenKey",
    );
    expectCode(
      () => expandScreenViewportTasks(catalog, viewports, { viewportKeys: ["missing"] }),
      "UnknownViewportKey",
    );
    expectCode(() => expandScreenViewportTasks(catalog, viewports), "UnknownViewportKey");
    expectCode(() => getMachinaViewport(viewports, "missing"), "UnknownViewportKey");
  });

  it("filters by merged task tags and de-duplicates tags", () => {
    const catalog = defineMachinaScreens([
      { key: "setup", route: "/setup", tags: ["scheduling"], viewports: ["phone"] },
      { key: "other", route: "/other", tags: ["other"] },
    ]);
    const viewports = defineMachinaViewports([
      { key: "phone", width: 1, height: 1, tags: ["mobile"] },
      { key: "desktop", width: 2, height: 2 },
    ]);
    const tasks = expandScreenViewportTasks(catalog, viewports, { tags: ["scheduling", "mobile"] });
    expect(tasks.map((task) => task.key)).toEqual(["setup__phone"]);
    expect(tasks[0].tags).toEqual(["scheduling", "mobile"]);
  });

  it("uses raw task keys and slugged artifact base names", () => {
    const catalog = defineMachinaScreens([{ key: "Provider Setup", route: "/setup" }]);
    const viewports = defineMachinaViewports([{ key: "Phone XL", width: 1, height: 1 }]);
    const [task] = expandScreenViewportTasks(catalog, viewports);
    expect(task.key).toBe("Provider Setup__Phone XL");
    expect(task.artifactBaseName).toBe("provider-setup__phone-xl");
  });

  it("slugs artifact names", () => {
    expect(slugMachinaArtifactName("Provider Setup!")).toBe("provider-setup");
    expect(slugMachinaArtifactName("  PHONE XL  ")).toBe("phone-xl");
    expect(slugMachinaArtifactName("!!!")).toBe("artifact");
  });

  it("does not mutate inputs while expanding", () => {
    const catalog = defineMachinaScreens([{ key: "a", route: "/a", tags: ["x"] }]);
    const viewports = createViewportMatrix();
    const beforeCatalog = JSON.stringify(catalog);
    const beforeViewports = JSON.stringify(viewports);
    expandScreenViewportTasks(catalog, viewports);
    expect(JSON.stringify(catalog)).toBe(beforeCatalog);
    expect(JSON.stringify(viewports)).toBe(beforeViewports);
  });
});
