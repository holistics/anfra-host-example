import type { StructureNode } from '@holistics/anfra-sdk/common';
import { Code, GitFork, ListTree, Sheet } from 'lucide-react';
import type { CSSProperties } from 'react';
import { type AnchorRect, nameOf } from '@/comments';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { attributeFor, firstEntityUnder, kindIcons, kindPills, type PickTarget } from '@/inspector';
import { cn } from '@/lib/utils';

interface Props {
  node: StructureNode;
  /** The nodes of the page, to tell whether the picked one holds a query. */
  nodes: StructureNode[];
  /** Where the node is drawn; without one the menu sits at the top centre of the stage. */
  rect: AnchorRect | undefined;
  onChoose: (target: PickTarget) => void;
  onClose: () => void;
}

const choices: { target: PickTarget; label: string; hint: string; icon: typeof Sheet }[] = [
  { target: 'data', label: 'Data', hint: 'Underlying data', icon: Sheet },
  { target: 'queries', label: 'Queries', hint: 'How data is constructed', icon: Code },
  { target: 'lineage', label: 'Lineage', hint: 'Where it comes from', icon: GitFork },
  { target: 'structure', label: 'Structure', hint: 'Its place in the page', icon: ListTree },
];

/**
 * What to look at for a picked node, floating beside it in the stage. Render it inside the stage's
 * `relative` wrapper: its anchor is placed at `rect` there. See the inspector's SPEC §3.
 */
export function PickMenu({ node, nodes, rect, onChoose, onClose }: Props) {
  const Icon = kindIcons[node.kind];
  const holdsQuery = !!firstEntityUnder(nodes, node.key, 'query');
  const holdsEntity = !!firstEntityUnder(nodes, node.key);
  const missing: Partial<Record<PickTarget, boolean>> = { data: !holdsQuery, queries: !holdsEntity };

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverAnchor asChild>
        <div aria-hidden className="pointer-events-none absolute" style={anchorStyle(rect)} />
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={8}
        updatePositionStrategy="always"
        aria-label={`Check ${nameOf(node)}`}
        className="w-64 max-w-[calc(100vw-16px)] p-1"
      >
        <div className="flex items-center gap-2 px-2 pt-1.5 pb-1">
          <span
            className={cn(
              'inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-xs font-medium capitalize',
              kindPills[node.kind],
            )}
          >
            <Icon className="size-3" />
            {node.kind}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={attributeFor(node)}>
            {nameOf(node)}
          </span>
        </div>
        <div role="menu" className="flex flex-col">
          {choices.map(({ target, label, hint, icon: ChoiceIcon }) => {
            const disabled = missing[target];
            return (
              <button
                key={target}
                type="button"
                role="menuitem"
                aria-disabled={disabled || undefined}
                onClick={() => !disabled && onChoose(target)}
                className="group flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden hover:bg-accent focus-visible:bg-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
              >
                <ChoiceIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <span className="hidden text-xs text-muted-foreground group-hover:inline group-focus-visible:inline">
                  {disabled ? 'None here' : hint}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The anchor at the node's rect, kept inside the stage so the menu never floats off it. */
function anchorStyle(rect: AnchorRect | undefined): CSSProperties {
  if (!rect) return { left: '50%', top: 0, width: 0, height: 0 };
  return {
    left: `clamp(0px, ${rect.x}px, calc(100% - ${Math.min(rect.width, 1)}px))`,
    top: `clamp(0px, ${rect.y}px, calc(100% - ${Math.min(rect.height, 1)}px))`,
    width: rect.width,
    height: rect.height,
  };
}
