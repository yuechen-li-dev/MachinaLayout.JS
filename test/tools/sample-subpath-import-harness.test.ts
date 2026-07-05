import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const toolModuleUrl = pathToFileURL(path.resolve("tools/prepare-sample-subpath-imports.mjs")).href;

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((rootPath) => rm(rootPath, { recursive: true, force: true })),
  );
});

async function createTempRepo() {
  const rootPath = await mkdtemp(path.join(tmpdir(), "machinalayout-sample-harness-"));
  tempRoots.push(rootPath);

  await mkdir(path.join(rootPath, "dist", "async"), { recursive: true });
  await mkdir(path.join(rootPath, "dist", "text"), { recursive: true });
  await mkdir(path.join(rootPath, "dist", "text", "react"), { recursive: true });
  await mkdir(path.join(rootPath, "sample"), { recursive: true });

  await writeFile(
    path.join(rootPath, "package.json"),
    `${JSON.stringify(
      {
        name: "machinalayout",
        type: "module",
        exports: {
          ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
          },
          "./async": {
            types: "./dist/async/index.d.ts",
            import: "./dist/async/index.js",
          },
          "./text": {
            types: "./dist/text/index.d.ts",
            import: "./dist/text/index.js",
          },
          "./text/react": {
            types: "./dist/text/react/index.d.ts",
            import: "./dist/text/react/index.js",
          },
          "./package.json": "./package.json",
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    path.join(rootPath, "dist", "index.js"),
    'export const rootValue = "root";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "index.d.ts"),
    'export declare const rootValue: "root";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "async", "index.js"),
    'export const asyncValue = "async";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "async", "index.d.ts"),
    'export declare const asyncValue: "async";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "text", "index.js"),
    'export const textValue = "text";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "text", "index.d.ts"),
    'export declare const textValue: "text";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "text", "react", "index.js"),
    'export const reactTextValue = "text-react";\n',
    "utf8",
  );
  await writeFile(
    path.join(rootPath, "dist", "text", "react", "index.d.ts"),
    'export declare const reactTextValue: "text-react";\n',
    "utf8",
  );

  return rootPath;
}

describe("prepareSampleSubpathImports", () => {
  async function loadToolModule() {
    const toolModule = await import(toolModuleUrl);
    return toolModule as {
      patchGeneratedJsImports: (rootPath: string) => Promise<number>;
      prepareSampleSubpathImports: (
        samplePaths: string[],
        options?: { repoRoot?: string; cwd?: string },
      ) => Promise<Array<{ samplePath: string; exportCount: number; localPackageRoot: string }>>;
    };
  }

  it("fails clearly for a missing sample path", async () => {
    const repoRoot = await createTempRepo();
    const { prepareSampleSubpathImports } = await loadToolModule();

    await expect(
      prepareSampleSubpathImports(["sample/missing"], { repoRoot, cwd: repoRoot }),
    ).rejects.toThrow(`Sample path not found: ${path.join(repoRoot, "sample", "missing")}`);
  });

  it("fails clearly when the root dist is missing", async () => {
    const repoRoot = await createTempRepo();
    const { prepareSampleSubpathImports } = await loadToolModule();
    await rm(path.join(repoRoot, "dist"), { recursive: true, force: true });

    await expect(
      prepareSampleSubpathImports(["sample"], { repoRoot, cwd: repoRoot }),
    ).rejects.toThrow(
      `Root dist not found at ${path.join(repoRoot, "dist")}. Run npm run build from repo root first.`,
    );
  });

  it("creates deterministic local bridges from the root package exports", async () => {
    const repoRoot = await createTempRepo();
    const sampleRoot = path.join(repoRoot, "sample");
    const { prepareSampleSubpathImports } = await loadToolModule();

    const firstRun = await prepareSampleSubpathImports(["sample"], { repoRoot, cwd: repoRoot });
    const packageJsonPath = path.join(sampleRoot, "node_modules", "machinalayout", "package.json");
    const asyncBridgePath = path.join(sampleRoot, "node_modules", "machinalayout", "async.js");
    const textBridgePath = path.join(sampleRoot, "node_modules", "machinalayout", "text.js");
    const nestedBridgePath = path.join(
      sampleRoot,
      "node_modules",
      "machinalayout",
      "text",
      "react.js",
    );

    expect(firstRun).toHaveLength(1);
    expect(firstRun[0]?.exportCount).toBe(4);

    const packageJsonText = await readFile(packageJsonPath, "utf8");
    const asyncBridgeText = await readFile(asyncBridgePath, "utf8");
    const textBridgeText = await readFile(textBridgePath, "utf8");
    const nestedBridgeText = await readFile(nestedBridgePath, "utf8");

    expect(JSON.parse(packageJsonText)).toEqual({
      name: "machinalayout",
      private: true,
      type: "module",
      exports: {
        ".": {
          types: "./index.d.ts",
          import: "./index.js",
        },
        "./async": {
          types: "./async.d.ts",
          import: "./async.js",
        },
        "./text": {
          types: "./text.d.ts",
          import: "./text.js",
        },
        "./text/react": {
          types: "./text/react.d.ts",
          import: "./text/react.js",
        },
      },
    });
    expect(asyncBridgeText).toBe('export * from "../../../dist/async/index.js";\n');
    expect(textBridgeText).toBe('export * from "../../../dist/text/index.js";\n');
    expect(nestedBridgeText).toBe('export * from "../../../../dist/text/react/index.js";\n');

    await prepareSampleSubpathImports(["sample"], { repoRoot, cwd: repoRoot });

    expect(await readFile(packageJsonPath, "utf8")).toBe(packageJsonText);
    expect(await readFile(asyncBridgePath, "utf8")).toBe(asyncBridgeText);
    expect(await readFile(textBridgePath, "utf8")).toBe(textBridgeText);
    expect(await readFile(nestedBridgePath, "utf8")).toBe(nestedBridgeText);
  });

  it("patches extensionless relative js imports idempotently", async () => {
    const repoRoot = await createTempRepo();
    const generatedRoot = path.join(repoRoot, "sample", ".generated");
    const { patchGeneratedJsImports } = await loadToolModule();
    await mkdir(path.join(generatedRoot, "nested"), { recursive: true });
    await writeFile(
      path.join(generatedRoot, "entry.js"),
      'import "./nested/child";\nexport { value } from "./nested/value";\n',
      "utf8",
    );
    await writeFile(
      path.join(generatedRoot, "nested", "child.js"),
      "export const child = true;\n",
      "utf8",
    );
    await writeFile(
      path.join(generatedRoot, "nested", "value.js"),
      "export const value = 1;\n",
      "utf8",
    );

    expect(await patchGeneratedJsImports(generatedRoot)).toBe(1);
    expect(await readFile(path.join(generatedRoot, "entry.js"), "utf8")).toBe(
      'import "./nested/child.js";\nexport { value } from "./nested/value.js";\n',
    );
    expect(await patchGeneratedJsImports(generatedRoot)).toBe(0);
  });
});
