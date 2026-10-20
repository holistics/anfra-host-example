// Copy prompt: an edit the host can't make itself, written for the agent that wrote the app.
import type { StructureNode } from '@holistics/anfra-sdk/common';
import { handleFor } from '@/inspector/model/format';
import type { TierResult } from './tier';

export interface EditPromptInput {
  /** The app's label and its definition's file, as anfra serves it: `apps/sales/overview.html`. */
  app: { label: string; file: string };
  /** The block the edit was made on, and the nodes it sits in, outermost first. */
  node?: StructureNode;
  ancestors?: StructureNode[];
  query: string;
  dataset: string;
  /** Why the host couldn't save it, or that it could and the page's code needs a change too. */
  tier: TierResult;
  /** The AQL the query declares now, and the AQL it should run, checked by anfra. */
  from: string;
  to: string;
  /** Columns the edit adds, which the page's code doesn't draw yet; columns it takes away. */
  added: string[];
  removed: string[];
}

const fence = (aql: string) => ['```aql', aql.trim(), '```'];

/** Every part the agent needs to make the change on its own: where, what, from, to, and why the host didn't. */
export function buildEditPrompt(input: EditPromptInput): string {
  const { app, node, ancestors = [], query, dataset, tier, from, to, added, removed } = input;
  const lines = [`Edit the Data App "${app.label}" (${app.file}).`, ''];
  if (node) {
    lines.push(`Block: ${node.kind} ${handleFor(node)}`);
    if (ancestors.length)
      lines.push(`Inside: ${ancestors.map((a) => `${a.kind} ${handleFor(a)}`).join(' › ')}`);
  }
  lines.push(`Query: \`${query}\` on the \`${dataset}\` dataset${tier.file ? `, in ${tier.file}` : ''}.`, '');

  if (from.trim() !== to.trim()) {
    lines.push('Change its AQL from:', ...fence(from), 'to:', ...fence(to), '');
    lines.push(
      tier.tier === 4
        ? 'The new AQL is checked with anfra and valid.'
        : 'The new AQL is checked with anfra and valid. It was tried in the running app first.',
    );
    if (tier.tier === 3) {
      lines.push(
        'The AQL is built while the app runs, so it is not written anywhere as above: change the code that builds it, so it builds the new AQL.',
      );
    } else if (tier.tier === 4) {
      lines.push(`${tier.reason} Change only \`${query}\`.`);
    }
    lines.push('');
  }
  if (added.length) {
    lines.push(
      `The query returns ${added.map((a) => `\`${a}\``).join(', ')}, which the page's code doesn't draw yet. Show ${added.length === 1 ? 'it' : 'them'} in this block, in the style the block already has.`,
    );
  }
  if (removed.length) {
    lines.push(
      `The query no longer returns ${removed.map((a) => `\`${a}\``).join(', ')}. Remove what the page draws from ${removed.length === 1 ? 'it' : 'them'}.`,
    );
  }
  lines.push('Keep everything else as it is.');
  return lines.join('\n');
}
