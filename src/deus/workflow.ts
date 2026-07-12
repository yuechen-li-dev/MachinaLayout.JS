import { DeusMachinaError } from "./types";
import { transitionsFromScopes } from "./scopedTransitions";
import type { DeusEvent, DeusTransitionRow, DeusWorkflowDefinition } from "./types";

/** Lowers an authoring-only workflow into the same ordinary rows used by Deus. */
export function transitionsFromWorkflow<TBoard, TEvent extends DeusEvent>(
  workflow: DeusWorkflowDefinition<TBoard, TEvent>,
): DeusTransitionRow<TBoard, TEvent>[] {
  if (!workflow || typeof workflow !== "object" || workflow.kind !== "deusWorkflow")
    throw new DeusMachinaError(
      "DEUS_WORKFLOW_INVALID_SCOPE",
      "workflow must be created with M.workflow",
    );
  if (
    !Array.isArray(workflow.root) ||
    workflow.root.length === 0 ||
    workflow.root.some(
      (segment) =>
        typeof segment !== "string" ||
        segment.trim().length === 0 ||
        segment === "." ||
        segment === "..",
    )
  )
    throw new DeusMachinaError(
      "DEUS_WORKFLOW_INVALID_ROOT",
      "workflow root must be a non-empty Deus path",
    );
  if (!Array.isArray(workflow.scopes) || workflow.scopes.length === 0)
    throw new DeusMachinaError("DEUS_WORKFLOW_EMPTY", "workflow scopes must be a non-empty array");
  if (workflow.scopes.some((scope) => !scope || scope.kind !== "deusTransitionScope"))
    throw new DeusMachinaError(
      "DEUS_WORKFLOW_INVALID_SCOPE",
      "workflow entries must be M.scope records",
    );
  return transitionsFromScopes(workflow.scopes);
}
