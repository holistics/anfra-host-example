// What a draft would break on the page, said before it is previewed (SPEC.md §6).
import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { controlMappings, crossFilters } from '@/inspector/model/checks';
import type { ExploreParts } from './aql';
import { aliasesOf, mentions } from './draft';

export interface Warning {
  level: 'warn' | 'info';
  message: string;
}

/** What changing `name` from `base` to `draft` does to the page around it. */
export function draftWarnings(
  app: InspectedApp | undefined,
  name: string,
  base: ExploreParts,
  draft: ExploreParts,
  /** Whether the page's code reads a column (`model/reads.ts`); without it, every column counts as read. */
  reads: (alias: string) => boolean = () => true,
): Warning[] {
  const warnings: Warning[] = [];
  const before = aliasesOf(base);
  const after = aliasesOf(draft);
  // Only what the code reads leaves a gap; only what it never reads won't show.
  const removed = before.filter((alias) => !after.includes(alias) && reads(alias));
  const added = after.filter((alias) => !before.includes(alias) && !reads(alias));

  if (removed.length) {
    warnings.push({
      level: 'warn',
      message: `The page's code reads ${list(removed)}, which the query won't return, so what it draws from ${removed.length === 1 ? 'it' : 'them'} goes blank.`,
    });
  }
  if (added.length) {
    warnings.push({
      level: 'info',
      message: `The query will return ${list(added)}, but the page's code never reads ${added.length === 1 ? 'it' : 'them'}, so nothing will show ${added.length === 1 ? 'it' : 'them'}. Once saved, the agent can draw ${added.length === 1 ? 'it' : 'them'}.`,
    });
  }
  if (!app) return warnings;

  const removedDimensions = base.dimensions.filter(
    (entry) => entry.alias && !draft.dimensions.some((d) => d.alias === entry.alias),
  );
  const crossTargets = crossFilters(app).filter((c) => c.from.name === name && c.to.name !== name);
  if (removedDimensions.length && crossTargets.length) {
    warnings.push({
      level: 'warn',
      message: `Clicking this block filters ${list(crossTargets.map((c) => c.to.name))} by its dimensions. Without ${list(removedDimensions.map((d) => d.alias ?? d.expression))}, those clicks stop filtering them.`,
    });
  }

  for (const mapping of controlMappings(app).filter((m) => m.to.name === name)) {
    if (!app.declaration.dateDrills[mapping.from.name]) continue;
    const uses = (parts: ExploreParts) => parts.dimensions.some((d) => mentions(d.expression, mapping.field));
    if (uses(base) && !uses(draft)) {
      warnings.push({
        level: 'warn',
        message: `The ${mapping.from.name} control changes the grain of ${mapping.field}. No dimension uses that field now, so the control does nothing for this query.`,
      });
    }
  }
  return warnings;
}

const list = (names: string[]) => {
  const quoted = names.map((n) => `\`${n}\``);
  return quoted.length < 2 ? (quoted[0] ?? '') : `${quoted.slice(0, -1).join(', ')} and ${quoted.at(-1)}`;
};
