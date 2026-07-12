import type {
  DeusEvent,
  DeusPathInput,
  DeusStatePath,
  DeusWorkflowAuthoringContext,
  DeusWorkflowDefinition,
  DeusWorkflowPathInput,
  DeusWorkflowRelativePath,
} from "../deus";
import { DeusMachinaError } from "../deus";
import { goto, on, pop, push, scope, stay } from "./machine";

function copiedPath(path: DeusPathInput, code: string, label: string): DeusStatePath {
  const candidate = typeof path === "string" ? path.replace(/^\//, "").split("/") : path;
  if (
    !Array.isArray(candidate) ||
    candidate.length === 0 ||
    candidate.some(
      (segment) =>
        typeof segment !== "string" ||
        segment.trim().length === 0 ||
        segment === "." ||
        segment === "..",
    )
  )
    throw new DeusMachinaError(
      code,
      `${label} must be a non-empty Deus path without . or .. segments`,
    );
  return Object.freeze([...candidate]);
}

function relativePath(...args: readonly unknown[]): DeusWorkflowRelativePath {
  const candidate = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const segments = copiedPath(
    candidate as DeusPathInput,
    "DEUS_WORKFLOW_INVALID_RELATIVE_PATH",
    "relative path",
  );
  return Object.freeze({ kind: "deusWorkflowRelativePath", segments });
}

function isRelativePath(path: DeusWorkflowPathInput): path is DeusWorkflowRelativePath {
  return (
    !Array.isArray(path) &&
    typeof path === "object" &&
    (path as { kind?: unknown }).kind === "deusWorkflowRelativePath"
  );
}

function resolveWorkflowPath(root: DeusStatePath, path: DeusWorkflowPathInput): DeusStatePath {
  if (typeof path === "string") {
    if (path.includes("/"))
      throw new DeusMachinaError(
        "DEUS_WORKFLOW_INVALID_RELATIVE_PATH",
        "workflow string paths are one local segment; use relative(...) for multiple segments",
      );
    return Object.freeze([
      ...root,
      ...copiedPath(path, "DEUS_WORKFLOW_INVALID_RELATIVE_PATH", "local path"),
    ]);
  }
  if (isRelativePath(path))
    return Object.freeze([
      ...root,
      ...copiedPath(path.segments, "DEUS_WORKFLOW_INVALID_RELATIVE_PATH", "relative path"),
    ]);
  return copiedPath(path, "DEUS_WORKFLOW_PATH_RESOLUTION_FAILED", "absolute path");
}

/** Creates a typed, root-relative workflow authoring record. Its factory only runs now. */
export function workflow<TBoard, TEvent extends DeusEvent>(
  root: DeusPathInput,
  factory: (
    context: DeusWorkflowAuthoringContext<TBoard, TEvent>,
  ) => readonly import("../deus").DeusTransitionScope<TBoard, TEvent>[],
): DeusWorkflowDefinition<TBoard, TEvent> {
  const normalizedRoot = copiedPath(root, "DEUS_WORKFLOW_INVALID_ROOT", "workflow root");
  const context: DeusWorkflowAuthoringContext<TBoard, TEvent> = Object.freeze({
    scope: (from, rows) => scope(resolveWorkflowPath(normalizedRoot, from), rows),
    on: (event, options) => on<TBoard, TEvent, typeof event>(event, options),
    goto: (state) => goto(resolveWorkflowPath(normalizedRoot, state)),
    push: (state) => push(resolveWorkflowPath(normalizedRoot, state)),
    pop,
    stay,
    relative: relativePath as DeusWorkflowAuthoringContext<TBoard, TEvent>["relative"],
  });
  const scopes = factory(context);
  if (!Array.isArray(scopes) || scopes.length === 0)
    throw new DeusMachinaError("DEUS_WORKFLOW_EMPTY", "workflow scopes must be a non-empty array");
  if (scopes.some((candidate) => !candidate || candidate.kind !== "deusTransitionScope"))
    throw new DeusMachinaError(
      "DEUS_WORKFLOW_INVALID_SCOPE",
      "workflow entries must be M.scope records",
    );
  return Object.freeze({
    kind: "deusWorkflow" as const,
    root: normalizedRoot,
    scopes: Object.freeze([...scopes]),
  });
}
