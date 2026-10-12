// Formatting for the inspect panel. What it shows is what the frame posts while it is inspected:
// every app's state and the page's structure, as the SDK types them. Rows are never part of it.
import type {
  Condition,
  EntityUsage,
  InspectedStructure,
  LocateKind,
  StructureNode,
} from '@holistics/anfra-sdk/common';

export type {
  EntityUsage,
  InspectedApp,
  InspectedControl,
  InspectedQuery,
  InspectedSelection,
  LocateKind,
} from '@holistics/anfra-sdk/common';

export function formatCondition(condition: Condition | undefined): string {
  if (!condition) return 'not applied yet';
  const parts = [condition.operator, condition.modifier, ...(condition.values ?? []).map(String)];
  return parts.filter((part) => part !== undefined && part !== '').join(' ');
}

export function formatTime(value: Date | string | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString();
}

/** The attribute a marked element carries for an entity, as the definition writes it. */
export function entityAttribute(kind: LocateKind, app: number, name: string): string {
  return `data-anfra-${kind}="${app === 0 ? '' : `${app}/`}${name}"`;
}

/**
 * A node's identity, to hand to an agent: a Markdown-style link whose text is the label and whose
 * target is the attribute as written, `[River](data-anfra-block="river")`; with no label, the
 * attribute alone. Either is one search away in the definition.
 */
export function handleFor(node: StructureNode): string {
  const attribute =
    node.kind === 'container' || node.kind === 'block'
      ? `data-anfra-${node.kind}="${node.id ?? ''}"`
      : entityAttribute(node.kind, node.app ?? 0, node.name ?? '');
  return node.label ? `[${node.label}](${attribute})` : attribute;
}

/** Where an entity is drawn, from the structure: how many marked elements, in which blocks. */
export function usageOf(
  structure: InspectedStructure | undefined,
  kind: LocateKind,
  app: number,
  name: string,
): EntityUsage | undefined {
  return structure?.usage[`${kind}:${app}/${name}`];
}

export function countProblems(nodes: StructureNode[]): number {
  return nodes.reduce((n, node) => n + node.problems.length + countProblems(node.children), 0);
}

/** Copy text, reporting whether the clipboard took it. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
