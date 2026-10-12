import { ArrowRight, ChevronRight, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import type { InspectedStructure, StructureNode } from '@/data-app';
import { handleFor } from '@/lib/inspect';
import { cn } from '@/lib/utils';

interface Props {
  structure: InspectedStructure;
  /** The node picked on the page, to select and reveal. */
  picked: string | undefined;
  onHighlight: (node: string | null) => void;
  onLocate: (node: string) => void;
  /** Open a query's or control's row in the Data tab. */
  onShowInData: (node: StructureNode) => void;
}

/** Each kind's pill, colored so a glance tells containers, blocks, queries and controls apart. */
const pills: Record<StructureNode['kind'], string> = {
  container: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  block: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  query: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  control: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
};

/** What the markup names a node by: its id (a container or block) or name (a query or control). */
function idOf(node: StructureNode): string {
  if (node.kind === 'container' || node.kind === 'block') return node.id ?? '';
  return node.app ? `${node.app}/${node.name ?? ''}` : (node.name ?? '');
}

/** The keys of the nodes on the way to `key`, so a picked node can be revealed. */
function ancestorsOf(nodes: StructureNode[], key: string, trail: string[] = []): string[] | undefined {
  for (const node of nodes) {
    if (node.key === key) return trail;
    const found = ancestorsOf(node.children, key, [...trail, node.key]);
    if (found) return found;
  }
  return undefined;
}

/**
 * The page's structure as a tree: hover a node to highlight it on the page, click it to scroll it
 * into view, and copy its handle (the attribute that marks it) to point an agent at it.
 */
export function StructureTree({ structure, picked, onHighlight, onLocate, onShowInData }: Props) {
  const [selected, setSelected] = useState<string>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!picked) return;
    setSelected(picked);
    const ancestors = ancestorsOf(structure.nodes, picked) ?? [];
    setCollapsed((prev) => new Set([...prev].filter((key) => !ancestors.includes(key))));
    requestAnimationFrame(() =>
      document.querySelector(`[data-node="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: 'nearest' }),
    );
  }, [picked, structure]);

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const renderNode = (node: StructureNode) => {
    const open = !collapsed.has(node.key);
    const id = idOf(node);
    const select = () => {
      setSelected(node.key);
      onLocate(node.key);
    };
    return (
      <li key={node.key}>
        <div
          data-node={node.key}
          className={cn(
            'group flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-sm hover:bg-accent',
            node.key === selected && 'bg-accent',
          )}
          onMouseEnter={() => onHighlight(node.key)}
          onClick={select}
          onKeyDown={(event) => event.key === 'Enter' && select()}
          role="treeitem"
          aria-expanded={node.children.length > 0 ? open : undefined}
          aria-selected={node.key === selected}
          tabIndex={0}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              className="grid size-4 shrink-0 place-items-center text-muted-foreground/60 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                toggle(node.key);
              }}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
            </button>
          ) : (
            <span className="size-4 shrink-0" />
          )}
          <span
            className={cn(
              'shrink-0 rounded px-2 py-px text-[11px] font-medium tracking-wide uppercase',
              pills[node.kind],
            )}
          >
            {node.kind}
          </span>
          {id && <span className="shrink truncate font-semibold">{id}</span>}
          {node.label && node.label !== id && (
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{node.label}</span>
          )}
          {node.problems.length > 0 && (
            <span title={node.problems.join('\n')} className="shrink-0">
              <TriangleAlert className="size-3.5 text-amber-500" />
            </span>
          )}
          <span className="ml-auto" />
          {(node.kind === 'query' || node.kind === 'control') && node.problems.length === 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              title="Show in Data"
              aria-label="Show in Data"
              onClick={(event) => {
                event.stopPropagation();
                onShowInData(node);
              }}
            >
              <ArrowRight className="size-3.5" />
            </Button>
          )}
          <CopyButton
            text={handleFor(node)}
            label="Copy the handle"
            className="shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
          />
        </div>
        {open && node.children.length > 0 && (
          // The guide runs down from under the parent's chevron, one per level.
          <ul className="ml-2 border-l pl-5">{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  return (
    <div role="tree" onMouseLeave={() => onHighlight(null)}>
      <ul>{structure.nodes.map(renderNode)}</ul>
    </div>
  );
}
