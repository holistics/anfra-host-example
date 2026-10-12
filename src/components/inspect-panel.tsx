import { Box, ChevronRight, LayoutGrid, SlidersHorizontal, Table2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InspectedStructure, StructureNode } from '@/data-app';
import { cn } from '@/lib/utils';

interface Props {
  structure: InspectedStructure | undefined;
  /** The node picked on the page, to select and reveal in the tree. */
  picked: string | undefined;
  onHighlight: (node: string | null) => void;
  onLocate: (node: string) => void;
  onClose: () => void;
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
 * The Data App's structure, as its markup declares it: hover a node to highlight it on the page,
 * click it to scroll it into view.
 */
export function InspectPanel({ structure, picked, onHighlight, onLocate, onClose }: Props) {
  const [selected, setSelected] = useState<string>();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!picked || !structure) return;
    setSelected(picked);
    const ancestors = ancestorsOf(structure.nodes, picked) ?? [];
    setCollapsed((prev) => new Set([...prev].filter((key) => !ancestors.includes(key))));
    document.querySelector(`[data-node="${CSS.escape(picked)}"]`)?.scrollIntoView({ block: 'nearest' });
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
    return (
      <li key={node.key}>
        <div
          data-node={node.key}
          className={cn(
            'flex h-7 cursor-pointer items-center gap-1.5 rounded-md pr-2 text-sm hover:bg-accent',
            node.key === selected && 'bg-accent font-medium',
          )}
          style={{ paddingLeft: depth * 14 + 4 }}
          onMouseEnter={() => onHighlight(node.key)}
          onMouseLeave={() => onHighlight(null)}
          onClick={() => {
            setSelected(node.key);
            onLocate(node.key);
          }}
          onKeyDown={(event) => event.key === 'Enter' && onLocate(node.key)}
          role="treeitem"
          aria-expanded={node.children.length > 0 ? open : undefined}
          tabIndex={0}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              className="grid size-4 place-items-center text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                toggle(node.key);
              }}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
            </button>
          ) : (
            <span className="size-4" />
          )}
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{nameOf(node)}</span>
          <span className="ml-auto text-xs text-muted-foreground">{node.kind}</span>
          {node.problems.length > 0 && (
            <span title={node.problems.join('\n')}>
              <TriangleAlert className="size-3.5 text-amber-500" />
            </span>
          )}
        </div>
        {open && node.children.length > 0 && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col border-l">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
        <span className="text-sm font-medium">Structure</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close the inspect panel"
        >
          <X />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {!structure && <p className="p-2 text-sm text-muted-foreground">Waiting for the Data App…</p>}
          {structure?.nodes.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              This Data App declares no structure. Mark its parts with <code>data-anfra-container</code> and{' '}
              <code>data-anfra-block</code> attributes to see them here.
            </p>
          )}
          {structure && structure.nodes.length > 0 && (
            <div role="tree" onMouseLeave={() => onHighlight(null)}>
              <ul>{structure.nodes.map((node) => renderNode(node, 0))}</ul>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
