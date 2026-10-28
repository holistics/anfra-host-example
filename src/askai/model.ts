// Pure: what both halves of the plugin say about a node. Imports SDK types only, so the frame half
// can bundle it.
import type { StructureNode } from '@holistics/anfra-sdk/common';

/** What a reader calls a node: its label, else the id or name the markup gives it. */
export function nameOf(node: StructureNode): string {
  if (node.label) return node.label;
  if (node.kind === 'container' || node.kind === 'block') return node.id ?? node.kind;
  return node.app ? `${node.app}/${node.name ?? ''}` : (node.name ?? node.kind);
}

/** The attribute that marks a node, as the definition writes it: `data-anfra-block="river"`. */
export function attributeFor(node: StructureNode): string {
  if (node.kind === 'container' || node.kind === 'block') return `data-anfra-${node.kind}="${node.id ?? ''}"`;
  return `data-anfra-${node.kind}="${node.app ? `${node.app}/` : ''}${node.name ?? ''}"`;
}

/**
 * A node's identity, to hand to an agent: a Markdown-style link whose text is the label and whose
 * target is the attribute as written, `[River](data-anfra-block="river")`; with no label, the
 * attribute alone. Either is one search away in the definition.
 */
export function handleFor(node: StructureNode): string {
  const attribute = attributeFor(node);
  return node.label ? `[${node.label}](${attribute})` : attribute;
}

export interface CommentPromptInput {
  /** The app's label and its definition's file, as anfra serves it: `apps/sales/overview.html`. */
  app: { label: string; file: string };
  node: StructureNode;
  ancestors: StructureNode[];
  comment: string;
}

/** The comment as a prompt an agent can act on: the app, the node, where it sits, and the comment (SPEC §4.4). */
export function buildCommentPrompt({ app, node, ancestors, comment }: CommentPromptInput): string {
  const lines = [`Comment on the Data App "${app.label}" (${app.file}).`, ''];
  lines.push(`Element: ${node.kind} ${handleFor(node)}`);
  if (ancestors.length) {
    lines.push(`Inside: ${ancestors.map((a) => `${a.kind} ${handleFor(a)}`).join(' › ')}`);
  }
  if (node.problems.length) {
    lines.push('', 'Markup problems:', ...node.problems.map((p) => `- ${p}`));
  }
  lines.push('', 'Comment:', comment.trim());
  return lines.join('\n');
}

/** Where a prompt can be sent, and why it can't be: all disabled in this demo (SPEC §8). */
export interface SendTarget {
  id: string;
  label: string;
  disabled?: string;
}

/** What the frame asks the host to copy or send: the comment, and the node as its menu target has it. */
export interface CommentRequest {
  node: StructureNode;
  ancestors: StructureNode[];
  comment: string;
}

/** The node and comment out of a frame's request, or undefined when it isn't one: the frame is untrusted. */
export function checkComment(request: unknown): CommentRequest | undefined {
  if (typeof request !== 'object' || request === null) return undefined;
  const { node, ancestors, comment } = request as Record<string, unknown>;
  if (typeof comment !== 'string' || !comment.trim() || comment.length > 10_000) return undefined;
  if (!isNode(node) || !Array.isArray(ancestors) || !ancestors.every(isNode)) return undefined;
  return { node, ancestors, comment };
}

const KINDS = ['container', 'block', 'query', 'control'];
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';

function isNode(value: unknown): value is StructureNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return (
    typeof node.key === 'string' &&
    KINDS.includes(node.kind as string) &&
    optionalString(node.id) &&
    optionalString(node.label) &&
    optionalString(node.name) &&
    (node.app === undefined || typeof node.app === 'number') &&
    Array.isArray(node.problems) &&
    node.problems.every((p) => typeof p === 'string') &&
    Array.isArray(node.children)
  );
}
