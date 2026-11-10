import { T } from "../concept/authoring";
import type { ConceptFieldConstraint } from "../concept/types";
import { validateConceptValue } from "../concept/validate";
import { format as formatDiagnostics } from "../diagnostics/format";
import type { DiagnosticOf } from "../diagnostics/types";
import { assertJsonSafe, UnserializableValueError } from "../iter/effects";
import { renderTsModule, type TsDeclaration } from "./emit";

// ---------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------

/** Read-only view of declared inputs, available to generators. */
export type ArtifactContext = {
  /** Path of the artifact being generated (relative to `outDir`). */
  readonly path: string;
  /** Text of a declared input (path relative to the config `root`). */
  readonly read: (inputPath: string) => string;
  /** Parsed JSON of a declared input. */
  readonly json: (inputPath: string) => unknown;
};

type ArtifactBase = {
  readonly path: string;
  /** Files (relative to root) the generator may read via `ctx`. Read before it runs. */
  readonly inputs?: readonly string[];
  readonly description?: string;
};

export type ArtifactDefinition =
  | (ArtifactBase & {
      readonly kind: "text";
      readonly generate: (ctx: ArtifactContext) => string | Promise<string>;
    })
  | (ArtifactBase & {
      readonly kind: "json";
      readonly generate: (ctx: ArtifactContext) => unknown;
      readonly concept?: ConceptFieldConstraint;
    })
  | (ArtifactBase & {
      readonly kind: "module";
      readonly generate: (
        ctx: ArtifactContext,
      ) =>
        | TsDeclaration
        | readonly TsDeclaration[]
        | Promise<TsDeclaration | readonly TsDeclaration[]>;
    });

export type ArtifactConfig = {
  readonly kind: "artifactConfig";
  /** Output directory, relative to the root passed to write/check. */
  readonly outDir: string;
  readonly artifacts: readonly ArtifactDefinition[];
};

type ArtifactOptions = Pick<ArtifactBase, "inputs" | "description">;

/** Text artifact (HTML, CSS, Markdown, …): the generator returns the exact file text. */
export function text(
  path: string,
  generate: (ctx: ArtifactContext) => string | Promise<string>,
  options: ArtifactOptions = {},
): ArtifactDefinition {
  return { kind: "text", path, generate, ...options };
}

/** JSON artifact: plain data, optionally checked against a concept before writing. */
export function json(
  path: string,
  generate: (ctx: ArtifactContext) => unknown,
  options: ArtifactOptions & { readonly concept?: ConceptFieldConstraint } = {},
): ArtifactDefinition {
  return { kind: "json", path, generate, ...options };
}

/**
 * TypeScript module of `export const … as const satisfies …` declarations:
 * the way to turn values computed at build time into exact types.
 */
export function module(
  path: string,
  generate: (
    ctx: ArtifactContext,
  ) => TsDeclaration | readonly TsDeclaration[] | Promise<TsDeclaration | readonly TsDeclaration[]>,
  options: ArtifactOptions = {},
): ArtifactDefinition {
  if (!path.endsWith(".ts")) {
    throw new Error(`Module artifact '${path}' must end with .ts.`);
  }
  return { kind: "module", path, generate, ...options };
}

export function artifacts(input: {
  readonly outDir: string;
  readonly artifacts: readonly ArtifactDefinition[];
}): ArtifactConfig {
  return { kind: "artifactConfig", outDir: input.outDir, artifacts: input.artifacts };
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type ArtifactDiagnosticCode =
  | "InvalidArtifactPath"
  | "DuplicateArtifact"
  | "ArtifactInputMissing"
  | "UndeclaredInput"
  | "ComptimeCycle"
  | "GeneratorError"
  | "NondeterministicComptime"
  | "UnserializableArtifact"
  | "InvalidArtifactData"
  | "MissingArtifact"
  | "StaleArtifact"
  | "OrphanArtifact"
  | "HandEditedArtifact"
  | "UnownedFile"
  | "InvalidManifest";

export type ArtifactDiagnostic = DiagnosticOf<
  { readonly severity: "error" | "warning" },
  ArtifactDiagnosticCode
>;

export function formatArtifactDiagnostics(diagnostics: readonly ArtifactDiagnostic[]): string {
  return formatDiagnostics(diagnostics, { style: "line", empty: "No artifact diagnostics." });
}

// ---------------------------------------------------------------------------
// Files and manifest
// ---------------------------------------------------------------------------

/** Minimal file access; `machinalayout/comptime/node` provides the Node implementation. */
export type ArtifactFs = {
  /** File text, or `undefined` when it does not exist. */
  readonly readText: (path: string) => Promise<string | undefined>;
  readonly writeText: (path: string, text: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
};

export type ArtifactRunOptions = {
  readonly fs: ArtifactFs;
  /** Directory that `outDir` and inputs are relative to. */
  readonly root: string;
};

export const manifestFileName = ".machina-artifacts.json";

export type ArtifactManifest = {
  readonly version: 1;
  readonly artifacts: {
    readonly [path: string]: {
      readonly hash: string;
      readonly inputs?: { readonly [path: string]: string };
    };
  };
};

/** cyrb53: fast, deterministic, non-cryptographic. Used for hand-edit detection only. */
export function contentHash(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `cyrb53:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)}`;
}

function joinPath(...parts: readonly string[]): string {
  return parts
    .filter((part) => part !== "" && part !== ".")
    .join("/")
    .replace(/\/{2,}/g, "/");
}

function pathProblem(path: string): string | undefined {
  if (typeof path !== "string" || path.trim() === "") return "path is empty";
  if (path.includes("\\")) return "use forward slashes";
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return "path must be relative";
  if (path.split("/").some((segment) => segment === ".." || segment === "")) {
    return "path must not contain '..' or empty segments";
  }
  if (path.split("/").pop() === manifestFileName) return `${manifestFileName} is reserved`;
  return undefined;
}

// ---------------------------------------------------------------------------
// Determinism guard
// ---------------------------------------------------------------------------

class NondeterminismError extends Error {
  constructor(what: string) {
    super(
      `${what} was called during generation; pass time/randomness in as a declared input instead`,
    );
    this.name = "NondeterminismError";
  }
}

/**
 * Run `fn` with ambient time and randomness disabled. The guard stays active
 * across awaits (generators run strictly one at a time), so CT.check/CT.write
 * must not run concurrently with unrelated code — true for build scripts and tests.
 */
async function withAmbientGuard<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult> {
  const RealDate = globalThis.Date;
  const realRandom = Math.random;
  const GuardedDate = function (this: unknown, ...args: unknown[]) {
    if (args.length === 0) {
      throw new NondeterminismError("new Date()");
    }
    // biome-ignore lint/complexity/noBannedTypes: forwarding to the real constructor
    return new (RealDate as unknown as Function & (new (...a: unknown[]) => Date))(...args);
  } as unknown as DateConstructor;
  Object.setPrototypeOf(GuardedDate, RealDate);
  (GuardedDate as { now: () => number }).now = () => {
    throw new NondeterminismError("Date.now()");
  };
  (GuardedDate as { prototype: Date }).prototype = RealDate.prototype;
  globalThis.Date = GuardedDate;
  Math.random = () => {
    throw new NondeterminismError("Math.random()");
  };
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
    Math.random = realRandom;
  }
}

// ---------------------------------------------------------------------------
// Generation (pure: inputs in, file texts out)
// ---------------------------------------------------------------------------

export type GeneratedArtifact = {
  readonly path: string;
  /** Path relative to root. */
  readonly filePath: string;
  readonly text: string;
  readonly hash: string;
  readonly inputs: { readonly [path: string]: string };
};

export type GenerationResult = {
  readonly artifacts: readonly GeneratedArtifact[];
  readonly manifest: ArtifactManifest;
  readonly diagnostics: readonly ArtifactDiagnostic[];
};

async function renderOnce(
  definition: ArtifactDefinition,
  ctx: ArtifactContext,
): Promise<{ readonly text: string } | { readonly diagnostic: ArtifactDiagnostic }> {
  const fail = (code: ArtifactDiagnosticCode, message: string) => ({
    diagnostic: { severity: "error" as const, code, path: definition.path, message },
  });
  let output: unknown;
  try {
    output = await withAmbientGuard(() => definition.generate(ctx));
  } catch (error) {
    if (error instanceof NondeterminismError) {
      return fail("NondeterministicComptime", error.message);
    }
    if (error instanceof UndeclaredInputError) {
      return fail("UndeclaredInput", error.message);
    }
    return fail("GeneratorError", error instanceof Error ? error.message : String(error));
  }
  try {
    switch (definition.kind) {
      case "text":
        if (typeof output !== "string") {
          return fail(
            "GeneratorError",
            `text generator must return a string, got ${typeof output}`,
          );
        }
        return { text: output };
      case "json": {
        assertJsonSafe(output);
        if (definition.concept) {
          const wrapper = T.concept({ id: definition.path, fields: { value: definition.concept } });
          const problems = validateConceptValue(wrapper, { value: output }).filter(
            (diagnostic) => diagnostic.severity === "error",
          );
          if (problems.length > 0) {
            return fail(
              "InvalidArtifactData",
              problems
                .map(
                  (problem) =>
                    `${(problem.path ?? "").replace(/^value\.?/, "") || "<root>"}: ${problem.message}`,
                )
                .join("; "),
            );
          }
        }
        return { text: `${JSON.stringify(output, null, 2)}\n` };
      }
      case "module": {
        const declarations = Array.isArray(output) ? output : [output];
        return { text: renderTsModule(definition.path, declarations as readonly TsDeclaration[]) };
      }
    }
  } catch (error) {
    if (error instanceof UnserializableValueError) {
      return fail("UnserializableArtifact", error.message);
    }
    return fail("GeneratorError", error instanceof Error ? error.message : String(error));
  }
}

class UndeclaredInputError extends Error {}

function firstDifference(left: string, right: string): string {
  const a = left.split("\n");
  const b = right.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  return `first difference at line ${start + 1}`;
}

/**
 * Run every generator (twice, under the ambient guard) against pre-read
 * inputs. Pure apart from reading inputs; nothing is written.
 */
export async function generateArtifacts(
  config: ArtifactConfig,
  options: ArtifactRunOptions,
): Promise<GenerationResult> {
  const diagnostics: ArtifactDiagnostic[] = [];
  const outputs = new Set(
    config.artifacts.map((definition) => joinPath(config.outDir, definition.path)),
  );
  const seen = new Set<string>();
  const generated: GeneratedArtifact[] = [];

  const outDirProblem = config.outDir === "." ? undefined : pathProblem(config.outDir);
  if (outDirProblem) {
    return {
      artifacts: [],
      manifest: { version: 1, artifacts: {} },
      diagnostics: [
        {
          severity: "error",
          code: "InvalidArtifactPath",
          message: `outDir '${config.outDir}': ${outDirProblem}`,
        },
      ],
    };
  }

  for (const definition of config.artifacts) {
    const problem = pathProblem(definition.path);
    if (problem) {
      diagnostics.push({
        severity: "error",
        code: "InvalidArtifactPath",
        path: definition.path,
        message: problem,
      });
      continue;
    }
    if (seen.has(definition.path)) {
      diagnostics.push({
        severity: "error",
        code: "DuplicateArtifact",
        path: definition.path,
        message: "declared more than once",
      });
      continue;
    }
    seen.add(definition.path);

    const inputs = new Map<string, string>();
    let inputsOk = true;
    for (const inputPath of definition.inputs ?? []) {
      const inputProblem = pathProblem(inputPath);
      if (inputProblem) {
        diagnostics.push({
          severity: "error",
          code: "InvalidArtifactPath",
          path: definition.path,
          message: `input '${inputPath}': ${inputProblem}`,
        });
        inputsOk = false;
        continue;
      }
      if (outputs.has(inputPath)) {
        diagnostics.push({
          severity: "error",
          code: "ComptimeCycle",
          path: definition.path,
          message: `input '${inputPath}' is itself a generated artifact; generators must read sources, not outputs`,
        });
        inputsOk = false;
        continue;
      }
      const textValue = await options.fs.readText(joinPath(options.root, inputPath));
      if (textValue === undefined) {
        diagnostics.push({
          severity: "error",
          code: "ArtifactInputMissing",
          path: definition.path,
          message: `declared input '${inputPath}' does not exist`,
        });
        inputsOk = false;
        continue;
      }
      inputs.set(inputPath, textValue);
    }
    if (!inputsOk) continue;

    const read = (inputPath: string) => {
      const value = inputs.get(inputPath);
      if (value === undefined) {
        throw new UndeclaredInputError(
          `ctx.read('${inputPath}') is not a declared input; add it to \`inputs\` (declared: ${[...inputs.keys()].join(", ") || "none"})`,
        );
      }
      return value;
    };
    const ctx: ArtifactContext = {
      path: definition.path,
      read,
      json: (inputPath) => {
        const raw = read(inputPath);
        try {
          return JSON.parse(raw);
        } catch (error) {
          throw new Error(`input '${inputPath}' is not valid JSON: ${(error as Error).message}`);
        }
      },
    };

    const first = await renderOnce(definition, ctx);
    if ("diagnostic" in first) {
      diagnostics.push(first.diagnostic);
      continue;
    }
    const second = await renderOnce(definition, ctx);
    if ("diagnostic" in second) {
      diagnostics.push(second.diagnostic);
      continue;
    }
    if (first.text !== second.text) {
      diagnostics.push({
        severity: "error",
        code: "NondeterministicComptime",
        path: definition.path,
        message: `two evaluations produced different output (${firstDifference(first.text, second.text)}); something outside the declared inputs (module state, iteration order, identity) leaks into the output`,
      });
      continue;
    }

    generated.push({
      path: definition.path,
      filePath: joinPath(config.outDir, definition.path),
      text: first.text,
      hash: contentHash(first.text),
      inputs: Object.fromEntries([...inputs].map(([path, value]) => [path, contentHash(value)])),
    });
  }

  const manifest: ArtifactManifest = {
    version: 1,
    artifacts: Object.fromEntries(
      generated.map((artifact) => [
        artifact.path,
        Object.keys(artifact.inputs).length > 0
          ? { hash: artifact.hash, inputs: artifact.inputs }
          : { hash: artifact.hash },
      ]),
    ),
  };
  return { artifacts: generated, manifest, diagnostics };
}

function manifestText(manifest: ArtifactManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

const ManifestConcept = T.concept({
  id: "ArtifactManifest",
  closed: true,
  fields: { version: T.literal(1), artifacts: T.object() },
});

async function readManifest(
  config: ArtifactConfig,
  options: ArtifactRunOptions,
): Promise<{ manifest?: ArtifactManifest; diagnostic?: ArtifactDiagnostic }> {
  const raw = await options.fs.readText(joinPath(options.root, config.outDir, manifestFileName));
  if (raw === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    const problems = validateConceptValue(ManifestConcept, parsed).filter(
      (d) => d.severity === "error",
    );
    if (problems.length > 0) {
      throw new Error(problems.map((problem) => `${problem.path}: ${problem.message}`).join("; "));
    }
    return { manifest: parsed as ArtifactManifest };
  } catch (error) {
    return {
      diagnostic: {
        severity: "error",
        code: "InvalidManifest",
        path: manifestFileName,
        message: `cannot read manifest: ${(error as Error).message}`,
      },
    };
  }
}

function formattingOnly(left: string, right: string): boolean {
  return left !== right && left.replace(/\s+/g, "") === right.replace(/\s+/g, "");
}

const formatterHint =
  "it differs only in whitespace, so a formatter probably rewrote it; exclude this outDir from your formatter (generated files are owned by their generator)";

function compactDiff(current: string, next: string, maxLines = 12): string {
  const a = current.split("\n");
  const b = next.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA -= 1;
    endB -= 1;
  }
  const removed = a.slice(start, endA + 1);
  const added = b.slice(start, endB + 1);
  const lines = [
    `@@ line ${start + 1} @@`,
    ...removed.slice(0, maxLines).map((line) => `- ${line}`),
    ...(removed.length > maxLines ? [`- … ${removed.length - maxLines} more`] : []),
    ...added.slice(0, maxLines).map((line) => `+ ${line}`),
    ...(added.length > maxLines ? [`+ … ${added.length - maxLines} more`] : []),
  ];
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// check / write
// ---------------------------------------------------------------------------

/**
 * Regenerate everything in memory and compare with disk. Never writes.
 * An empty result means the checked-in artifacts are exactly what the
 * generators produce now. Use it as the one "artifacts in sync" test.
 */
export async function checkArtifacts(
  config: ArtifactConfig,
  options: ArtifactRunOptions,
): Promise<readonly ArtifactDiagnostic[]> {
  const generation = await generateArtifacts(config, options);
  const diagnostics: ArtifactDiagnostic[] = [...generation.diagnostics];
  const { manifest: onDisk, diagnostic } = await readManifest(config, options);
  if (diagnostic) diagnostics.push(diagnostic);

  for (const artifact of generation.artifacts) {
    const current = await options.fs.readText(joinPath(options.root, artifact.filePath));
    if (current === undefined) {
      diagnostics.push({
        severity: "error",
        code: "MissingArtifact",
        path: artifact.path,
        message: "not on disk; run CT.write",
      });
      continue;
    }
    if (current === artifact.text) continue;
    const recorded = onDisk?.artifacts[artifact.path]?.hash;
    const handEdited = recorded !== undefined && recorded !== contentHash(current);
    diagnostics.push({
      severity: "error",
      code: handEdited ? "HandEditedArtifact" : "StaleArtifact",
      path: artifact.path,
      message: formattingOnly(current, artifact.text)
        ? formatterHint
        : handEdited
          ? "the file was modified after generation; move the change into the generator (or its inputs)"
          : "differs from what the generator produces now; run CT.write",
      details: compactDiff(current, artifact.text).split("\n"),
    });
  }

  const declared = new Set(generation.artifacts.map((artifact) => artifact.path));
  const failed = new Set(generation.diagnostics.map((d) => d.path));
  for (const path of Object.keys(onDisk?.artifacts ?? {})) {
    if (!declared.has(path) && !failed.has(path)) {
      diagnostics.push({
        severity: "error",
        code: "OrphanArtifact",
        path: path,
        message: "in the manifest but no longer declared; CT.write will remove it",
      });
    }
  }

  if (diagnostics.length === 0) {
    const currentManifest = await options.fs.readText(
      joinPath(options.root, config.outDir, manifestFileName),
    );
    if (currentManifest !== manifestText(generation.manifest)) {
      diagnostics.push({
        severity: "error",
        code: "StaleArtifact",
        path: manifestFileName,
        message: "manifest is missing or out of date (input hashes changed); run CT.write",
      });
    }
  }
  return diagnostics;
}

export type ArtifactWriteReport = {
  readonly written: readonly string[];
  readonly unchanged: readonly string[];
  readonly removed: readonly string[];
  readonly diagnostics: readonly ArtifactDiagnostic[];
};

/**
 * Regenerate and write. Writes nothing if any generator fails, if a target
 * file is not owned by the manifest, or if an owned file was hand-edited —
 * unless `force` (never the default).
 */
export async function writeArtifacts(
  config: ArtifactConfig,
  options: ArtifactRunOptions & { readonly force?: boolean },
): Promise<ArtifactWriteReport> {
  const generation = await generateArtifacts(config, options);
  const { manifest: onDisk, diagnostic } = await readManifest(config, options);
  const diagnostics: ArtifactDiagnostic[] = [...generation.diagnostics];
  if (diagnostic && !options.force) diagnostics.push(diagnostic);

  const plans: { artifact: GeneratedArtifact; current: string | undefined }[] = [];
  for (const artifact of generation.artifacts) {
    const current = await options.fs.readText(joinPath(options.root, artifact.filePath));
    const recorded = onDisk?.artifacts[artifact.path]?.hash;
    if (current !== undefined && current !== artifact.text && !options.force) {
      if (recorded === undefined) {
        diagnostics.push({
          severity: "error",
          code: "UnownedFile",
          path: artifact.path,
          message: formattingOnly(current, artifact.text)
            ? `not created by CT.write; ${formatterHint}. Run CT.write once with \`force: true\` to adopt it`
            : "a file not created by CT.write already exists here with different content; if it came from an older hand-rolled generator, run CT.write once with `force: true` to adopt it, otherwise move it",
        });
      } else if (recorded !== contentHash(current)) {
        diagnostics.push({
          severity: "error",
          code: "HandEditedArtifact",
          path: artifact.path,
          message: formattingOnly(current, artifact.text)
            ? formatterHint
            : "the file was modified after generation; move the change into the generator (or pass force)",
          details: compactDiff(current, artifact.text).split("\n"),
        });
      }
    }
    plans.push({ artifact, current });
  }

  const declared = new Set(generation.artifacts.map((artifact) => artifact.path));
  const orphans: string[] = [];
  for (const [path, entry] of Object.entries(onDisk?.artifacts ?? {})) {
    if (declared.has(path)) continue;
    const current = await options.fs.readText(joinPath(options.root, config.outDir, path));
    if (current !== undefined && contentHash(current) !== entry.hash && !options.force) {
      diagnostics.push({
        severity: "error",
        code: "HandEditedArtifact",
        path: path,
        message:
          "orphaned artifact was hand-edited; not removing it (delete it yourself or pass force)",
      });
      continue;
    }
    if (current !== undefined) orphans.push(path);
  }

  if (diagnostics.some((d) => d.severity === "error")) {
    return { written: [], unchanged: [], removed: [], diagnostics };
  }

  const written: string[] = [];
  const unchanged: string[] = [];
  for (const { artifact, current } of plans) {
    if (current === artifact.text) {
      unchanged.push(artifact.path);
      continue;
    }
    await options.fs.writeText(joinPath(options.root, artifact.filePath), artifact.text);
    written.push(artifact.path);
  }
  for (const path of orphans) {
    await options.fs.remove(joinPath(options.root, config.outDir, path));
  }
  await options.fs.writeText(
    joinPath(options.root, config.outDir, manifestFileName),
    manifestText(generation.manifest),
  );
  return { written, unchanged, removed: orphans, diagnostics };
}

/** In-memory `ArtifactFs` for tests and dry runs. */
export function memoryFs(initial: Record<string, string> = {}): ArtifactFs & {
  readonly files: Map<string, string>;
} {
  const files = new Map(Object.entries(initial));
  return {
    files,
    readText: async (path) => files.get(path),
    writeText: async (path, value) => {
      files.set(path, value);
    },
    remove: async (path) => {
      files.delete(path);
    },
  };
}
