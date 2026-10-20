// Which queries a picked node is about.
import type { InspectedStructure, StructureNode } from '@holistics/anfra-sdk/common';

/** A query by the app it belongs to and its name. */
export interface QueryRef {
  app: number;
  name: string;
}

function find(nodes: StructureNode[], key: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.key === key) return node;
    const found = find(node.children, key);
    if (found) return found;
  }
  return undefined;
}

/**
 * The queries a node shows: the query nodes at or under it, in document order. A block marked
 * without them falls back to the usage, which names the blocks each query is drawn in.
 */
export function queriesOfNode(structure: InspectedStructure | undefined, key: string): QueryRef[] {
  const root = structure && find(structure.nodes, key);
  if (!root) return [];
  const refs: QueryRef[] = [];
  const seen = new Set<string>();
  const add = (app: number, name: string) => {
    const id = `${app}/${name}`;
    if (seen.has(id)) return;
    seen.add(id);
    refs.push({ app, name });
  };
  const walk = (node: StructureNode) => {
    if (node.kind === 'query' && node.name) add(node.app ?? 0, node.name);
    node.children.forEach(walk);
  };
  walk(root);
  if (refs.length || root.kind !== 'block' || !root.id) return refs;
  for (const [usageKey, usage] of Object.entries(structure.usage)) {
    const match = /^query:(\d+)\/(.+)$/.exec(usageKey);
    if (match?.[1] && match[2] && usage.blocks.includes(root.id)) add(Number(match[1]), match[2]);
  }
  return refs;
}

/** What a reader calls a node: its label, else the id or name its markup gives it. */
export function nodeTitle(structure: InspectedStructure | undefined, key: string): string | undefined {
  const node = structure && find(structure.nodes, key);
  return node && (node.label ?? node.id ?? node.name ?? node.kind);
}
