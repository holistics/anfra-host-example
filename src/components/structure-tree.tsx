import {
  ArrowRight,
  Box,
  ChevronRight,
  LayoutGrid,
  SlidersHorizontal,
  Table2,
  TriangleAlert,
} from 'lucide-react';
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

const icons = { container: LayoutGrid, block: Box, query: Table2, control: SlidersHorizontal };

/** A node's name: its label, else its id (a container or block) or name (a query or control). */
const nameOf = (node: StructureNode) => node.label ?? node.id ?? node.name ?? node.kind;

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

  const renderNode = (node: StructureNode, depth: number) => {
    const Icon = icons[node.kind];
    const open = !collapsed.has(node.key);
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
            node.key === selected && 'bg-accent font-medium',
          )}
          style={{ paddingLeft: depth * 14 + 4 }}
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
              className="grid size-4 shrink-0 place-items-center text-muted-foreground"
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
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{nameOf(node)}</span>
          {node.problems.length > 0 && (
            <span title={node.problems.join('\n')} className="shrink-0">
              <TriangleAlert className="size-3.5 text-amber-500" />
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">{node.kind}</span>
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
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div role="tree" onMouseLeave={() => onHighlight(null)}>
      <ul>{structure.nodes.map((node) => renderNode(node, 0))}</ul>
    </div>
  );
}
