import type { ResolvedLayoutNode, ResolvedLayoutTree } from "./types";

export function flattenResolvedTree(tree: ResolvedLayoutTree): ResolvedLayoutNode[] {
  const out: ResolvedLayoutNode[] = [];

  const visit = (node: ResolvedLayoutTree): void => {
    out.push({
      id: node.id,
      rect: { ...node.rect },
      frame: node.frame,
      arrange: node.arrange,
      slot: node.slot,
      debugLabel: node.debugLabel,
    });

    for (const child of node.children) {
      visit(child);
    }
  };

  visit(tree);
  return out;
}
