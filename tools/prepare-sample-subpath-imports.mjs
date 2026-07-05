import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageName = "machinalayout";

function normalizeSampleArg(samplePath, cwd = process.cwd()) {
  return path.resolve(cwd, samplePath);
}

function relativeImportPath(fromFile, toFile) {
  const relativePath = path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function bridgeBaseName(exportKey) {
  return exportKey === "." ? "index" : exportKey.slice(2);
}

function bridgeExportTarget(bridgeBasePath, field) {
  return field === "import" ? `./${bridgeBasePath}.js` : `./${bridgeBasePath}.d.ts`;
}

function createBridgeFileText(targetFilePath) {
  return `export * from "${targetFilePath}";\n`;
}

async function ensureDirForFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function readRootExports(rootPath) {
  const packageJsonPath = path.join(rootPath, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const exportsField = packageJson.exports;

  if (!exportsField || typeof exportsField !== "object") {
    throw new Error(`Root package ${packageJsonPath} does not define exports.`);
  }

  return Object.entries(exportsField)
    .filter(([exportKey]) => exportKey !== "./package.json")
    .map(([exportKey, exportValue]) => {
      if (
        typeof exportValue !== "object" ||
        exportValue === null ||
        typeof exportValue.import !== "string" ||
        typeof exportValue.types !== "string"
      ) {
        throw new Error(`Unsupported export shape for ${exportKey} in ${packageJsonPath}.`);
      }

      return {
        exportKey,
        importTarget: exportValue.import,
        typesTarget: exportValue.types,
      };
    })
    .sort((left, right) => left.exportKey.localeCompare(right.exportKey));
}

export async function patchGeneratedJsImports(rootPath) {
  async function listJsFiles(currentPath) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listJsFiles(fullPath)));
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".js")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  const sourceRootStat = await stat(rootPath).catch(() => null);
  if (!sourceRootStat?.isDirectory()) {
    throw new Error(`Generated root not found: ${rootPath}`);
  }

  const importPattern = /((?:from|import)\s*["'])(\.\.?(?:\/[^"'.]+)+)(["'])/g;
  let patchedFileCount = 0;

  for (const filePath of await listJsFiles(rootPath)) {
    const sourceText = await readFile(filePath, "utf8");
    const patchedText = sourceText.replace(
      importPattern,
      (_match, prefix, specifier, suffix) => `${prefix}${specifier}.js${suffix}`,
    );

    if (patchedText !== sourceText) {
      await writeFile(filePath, patchedText, "utf8");
      patchedFileCount += 1;
    }
  }

  return patchedFileCount;
}

export async function prepareSampleSubpathImports(samplePaths, options = {}) {
  const rootPath = options.repoRoot ?? repoRoot;
  const resolvedSamples = samplePaths.map((samplePath) =>
    normalizeSampleArg(samplePath, options.cwd ?? process.cwd()),
  );

  if (resolvedSamples.length === 0) {
    throw new Error("Provide at least one sample path.");
  }

  const distPath = path.join(rootPath, "dist");
  const distStat = await stat(distPath).catch(() => null);
  if (!distStat?.isDirectory()) {
    throw new Error(`Root dist not found at ${distPath}. Run npm run build from repo root first.`);
  }

  const exportEntries = await readRootExports(rootPath);
  const results = [];

  for (const samplePath of resolvedSamples) {
    const sampleStat = await stat(samplePath).catch(() => null);
    if (!sampleStat?.isDirectory()) {
      throw new Error(`Sample path not found: ${samplePath}`);
    }

    const localPackageRoot = path.join(samplePath, "node_modules", packageName);
    await rm(localPackageRoot, { recursive: true, force: true });
    await mkdir(localPackageRoot, { recursive: true });

    const localExports = {};

    for (const entry of exportEntries) {
      const bridgeBasePath = bridgeBaseName(entry.exportKey);
      const bridgeJsPath = path.join(localPackageRoot, `${bridgeBasePath}.js`);
      const bridgeTypesPath = path.join(localPackageRoot, `${bridgeBasePath}.d.ts`);
      const importSourcePath = path.join(rootPath, entry.importTarget);
      await ensureDirForFile(bridgeJsPath);
      await ensureDirForFile(bridgeTypesPath);

      await writeFile(
        bridgeJsPath,
        createBridgeFileText(relativeImportPath(bridgeJsPath, importSourcePath)),
        "utf8",
      );
      await writeFile(
        bridgeTypesPath,
        createBridgeFileText(relativeImportPath(bridgeTypesPath, importSourcePath)),
        "utf8",
      );

      localExports[entry.exportKey] = {
        types: bridgeExportTarget(bridgeBasePath, "types"),
        import: bridgeExportTarget(bridgeBasePath, "import"),
      };
    }

    const localPackageJson = {
      name: packageName,
      private: true,
      type: "module",
      exports: localExports,
    };

    await writeFile(
      path.join(localPackageRoot, "package.json"),
      `${JSON.stringify(localPackageJson, null, 2)}\n`,
      "utf8",
    );

    results.push({
      samplePath,
      exportCount: exportEntries.length,
      localPackageRoot,
    });
  }

  return results;
}

async function runCli() {
  try {
    const args = process.argv.slice(2);
    const results = await prepareSampleSubpathImports(args);

    for (const result of results) {
      const displayPath = path.relative(process.cwd(), result.samplePath) || ".";
      console.log(
        `Prepared ${displayPath} with ${result.exportCount} machinalayout export bridge${result.exportCount === 1 ? "" : "s"}.`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
