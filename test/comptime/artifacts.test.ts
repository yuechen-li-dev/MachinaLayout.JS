import { describe, expect, it } from "vitest";
import { CT, formatArtifactDiagnostics, manifestFileName } from "../../src/comptime";
import { T } from "../../src/concept";

const codes = (diagnostics: readonly { code: string }[]) => diagnostics.map((d) => d.code);

function config(...artifacts: Parameters<typeof CT.artifacts>[0]["artifacts"]) {
  return CT.artifacts({ outDir: "out", artifacts });
}

describe("CT.write / CT.check round trip", () => {
  it("writes artifacts plus a manifest, then checks clean", async () => {
    const fs = CT.memoryFs({ "src/data.json": '{"title":"Hi"}' });
    const cfg = config(
      CT.text(
        "page.html",
        (ctx) => `<h1>${(ctx.json("src/data.json") as { title: string }).title}</h1>\n`,
        {
          inputs: ["src/data.json"],
        },
      ),
      CT.json("data.json", () => ({ b: 1, a: [1, 2] })),
    );
    const report = await CT.write(cfg, { fs, root: "" });
    expect(report.diagnostics).toEqual([]);
    expect(report.written).toEqual(["page.html", "data.json"]);
    expect(fs.files.get("out/page.html")).toBe("<h1>Hi</h1>\n");
    expect(fs.files.get("out/data.json")).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}\n');
    expect(
      JSON.parse(fs.files.get(`out/${manifestFileName}`)!).artifacts["page.html"].inputs,
    ).toHaveProperty("src/data.json");
    expect(await CT.check(cfg, { fs, root: "" })).toEqual([]);

    const again = await CT.write(cfg, { fs, root: "" });
    expect(again.unchanged).toEqual(["page.html", "data.json"]);
  });

  it("reports a stale artifact with a compact diff after the input changes", async () => {
    const fs = CT.memoryFs({ "src/data.json": '{"title":"Hi"}' });
    const cfg = config(
      CT.text(
        "page.html",
        (ctx) => `<h1>${(ctx.json("src/data.json") as { title: string }).title}</h1>\n`,
        {
          inputs: ["src/data.json"],
        },
      ),
    );
    await CT.write(cfg, { fs, root: "" });
    fs.files.set("src/data.json", '{"title":"Bye"}');
    const diagnostics = await CT.check(cfg, { fs, root: "" });
    expect(formatArtifactDiagnostics(diagnostics)).toMatchInlineSnapshot(`
      "[error] StaleArtifact page.html: differs from what the generator produces now; run CT.write
      @@ line 1 @@
      - <h1>Hi</h1>
      + <h1>Bye</h1>"
    `);
  });

  it("distinguishes hand edits from stale output, and refuses to overwrite them", async () => {
    const fs = CT.memoryFs();
    const cfg = config(CT.text("a.txt", () => "generated\n"));
    await CT.write(cfg, { fs, root: "" });
    fs.files.set("out/a.txt", "generated\nplus a quick fix\n");

    expect(codes(await CT.check(cfg, { fs, root: "" }))).toEqual(["HandEditedArtifact"]);
    const refused = await CT.write(cfg, { fs, root: "" });
    expect(codes(refused.diagnostics)).toEqual(["HandEditedArtifact"]);
    expect(fs.files.get("out/a.txt")).toBe("generated\nplus a quick fix\n");

    const forced = await CT.write(cfg, { fs, root: "", force: true });
    expect(forced.written).toEqual(["a.txt"]);
  });

  it("recognizes formatter rewrites of generated files", async () => {
    const fs = CT.memoryFs();
    const cfg = config(CT.json("a.json", () => ({ ids: ["a", "b"] })));
    await CT.write(cfg, { fs, root: "" });
    fs.files.set("out/a.json", '{\n  "ids": ["a", "b"]\n}\n');
    const [diagnostic] = await CT.check(cfg, { fs, root: "" });
    expect(diagnostic?.code).toBe("HandEditedArtifact");
    expect(diagnostic?.message).toContain("a formatter probably rewrote it");
  });

  it("never clobbers a file it does not own", async () => {
    const fs = CT.memoryFs({ "out/a.txt": "hand-written\n" });
    const report = await CT.write(config(CT.text("a.txt", () => "generated\n")), { fs, root: "" });
    expect(codes(report.diagnostics)).toEqual(["UnownedFile"]);
    expect(fs.files.get("out/a.txt")).toBe("hand-written\n");
  });

  it("reports and removes orphans it owns", async () => {
    const fs = CT.memoryFs();
    await CT.write(
      config(
        CT.text("a.txt", () => "a\n"),
        CT.text("b.txt", () => "b\n"),
      ),
      { fs, root: "" },
    );
    const smaller = config(CT.text("a.txt", () => "a\n"));
    expect(codes(await CT.check(smaller, { fs, root: "" }))).toEqual(["OrphanArtifact"]);
    const report = await CT.write(smaller, { fs, root: "" });
    expect(report.removed).toEqual(["b.txt"]);
    expect(fs.files.has("out/b.txt")).toBe(false);
    expect(await CT.check(smaller, { fs, root: "" })).toEqual([]);
  });

  it("writes nothing when any generator fails", async () => {
    const fs = CT.memoryFs();
    const report = await CT.write(
      config(
        CT.text("ok.txt", () => "ok\n"),
        CT.text("bad.txt", () => {
          throw new Error("boom");
        }),
      ),
      { fs, root: "" },
    );
    expect(codes(report.diagnostics)).toEqual(["GeneratorError"]);
    expect(fs.files.size).toBe(0);
  });
});

describe("determinism", () => {
  it("blocks ambient time and randomness, and restores them afterwards", async () => {
    const fs = CT.memoryFs();
    const report = await CT.write(
      config(
        CT.text("now.txt", () => `${Date.now()}`),
        CT.text("date.txt", () => new Date().toISOString()),
        CT.text("fixed.txt", () => new Date(0).toISOString()),
        CT.text("rand.txt", () => `${Math.random()}`),
      ),
      { fs, root: "" },
    );
    expect(report.diagnostics.map((d) => `${d.code}:${d.artifact}`)).toEqual([
      "NondeterministicComptime:now.txt",
      "NondeterministicComptime:date.txt",
      "NondeterministicComptime:rand.txt",
    ]);
    expect(report.diagnostics[0]?.message).toContain("Date.now() was called during generation");
    expect(typeof Date.now()).toBe("number");
    expect(typeof Math.random()).toBe("number");
    expect(new Date(0) instanceof Date).toBe(true);
  });

  it("catches leaks the guard cannot see by evaluating twice", async () => {
    let counter = 0;
    const diagnostics = await CT.check(config(CT.text("count.txt", () => `${counter++}\n`)), {
      fs: CT.memoryFs(),
      root: "",
    });
    expect(codes(diagnostics)).toEqual(["NondeterministicComptime"]);
    expect(diagnostics[0]?.message).toContain("two evaluations produced different output");
  });

  it("keeps the guard active across awaits in async generators", async () => {
    const diagnostics = await CT.check(
      config(
        CT.text("late.txt", async () => {
          await Promise.resolve();
          return `${Date.now()}`;
        }),
        CT.text("async-ok.txt", async () => {
          await Promise.resolve();
          return "fine\n";
        }),
      ),
      { fs: CT.memoryFs(), root: "" },
    );
    expect(diagnostics.map((d) => `${d.code}:${d.artifact}`)).toEqual([
      "NondeterministicComptime:late.txt",
      "MissingArtifact:async-ok.txt",
    ]);
  });
});

describe("inputs and paths", () => {
  it("rejects undeclared reads with the declared list", async () => {
    const fs = CT.memoryFs({ "src/a.json": "{}", "src/b.json": "{}" });
    const diagnostics = await CT.check(
      config(CT.json("x.json", (ctx) => ctx.json("src/b.json"), { inputs: ["src/a.json"] })),
      { fs, root: "" },
    );
    expect(diagnostics[0]).toMatchObject({
      code: "UndeclaredInput",
      message:
        "ctx.read('src/b.json') is not a declared input; add it to `inputs` (declared: src/a.json)",
    });
  });

  it("reports missing inputs, generated inputs, and escaping paths", async () => {
    const diagnostics = await CT.check(
      config(
        CT.text("a.txt", () => "a", { inputs: ["src/missing.txt"] }),
        CT.text("b.txt", () => "b", { inputs: ["out/a.txt"] }),
        CT.text("../escape.txt", () => "x"),
        CT.text("a.txt", () => "dup"),
      ),
      { fs: CT.memoryFs(), root: "" },
    );
    expect(codes(diagnostics)).toEqual([
      "ArtifactInputMissing",
      "ComptimeCycle",
      "InvalidArtifactPath",
      "DuplicateArtifact",
    ]);
  });
});

describe("JSON and module artifacts", () => {
  const Point = T.concept({
    id: "Point",
    fields: { x: T.number({ finite: true }), y: T.number() },
  });

  it("validates JSON artifacts against a concept before writing", async () => {
    const diagnostics = await CT.check(
      config(CT.json("p.json", () => ({ x: 1 }), { concept: Point })),
      { fs: CT.memoryFs(), root: "" },
    );
    expect(diagnostics[0]).toMatchObject({ code: "InvalidArtifactData" });
    expect(diagnostics[0]?.message).toBe("y: missing required number");
  });

  it("refuses values that are not plain data, with a path", async () => {
    const diagnostics = await CT.check(
      config(
        CT.module("bad.ts", () => CT.ts.exportConst("Bad", { nested: { check: () => true } })),
        CT.json("bad.json", () => ({ when: new Date(0) })),
      ),
      { fs: CT.memoryFs(), root: "" },
    );
    expect(diagnostics.map((d) => d.message)).toEqual([
      "Bad.nested.check: function is not plain data",
      "when: Date is not plain data",
    ]);
  });

  it("emits typed literal modules", async () => {
    const fs = CT.memoryFs();
    await CT.write(
      config(
        CT.module("point.ts", () => [
          CT.ts.exportConst(
            "Origin",
            { x: 0, y: 0, "odd-key": [true, null] },
            {
              satisfies: { type: "Point", from: "./types" },
              description: "The origin.",
            },
          ),
        ]),
      ),
      { fs, root: "" },
    );
    expect(fs.files.get("out/point.ts")).toMatchInlineSnapshot(`
      "// Generated by machinalayout/comptime from artifact "point.ts". Do not edit: change the generator and re-run CT.write.

      import type { Point } from "./types";

      /** The origin. */
      export const Origin = {
        x: 0,
        y: 0,
        "odd-key": [
          true,
          null,
        ],
      } as const satisfies Point;
      "
    `);
  });
});
