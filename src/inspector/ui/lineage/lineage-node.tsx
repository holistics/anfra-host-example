import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { Crosshair, Database, ListTree, ScanSearch, TriangleAlert } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { LineageGraphNode, LineageKind } from '../../model/lineage';
import type { RevealTarget } from '../../model/types';
import { CodeBlock } from '../shared/code-block';

/** Each kind's name on its card, as the reader knows it. */
export const kindLabels: Record<LineageKind, string> = {
  block: 'Block',
  query: 'Query',
  metric: 'Metric',
  dimension: 'Dimension',
  dataset: 'Dataset',
  model: 'Model',
  table: 'Database table',
};

/** Each kind's accent: the bar down a card's left edge, and its filter chip's dot. */
export const kindAccents: Record<LineageKind, { bar: string; dot: string }> = {
  block: { bar: 'border-l-indigo-500', dot: 'bg-indigo-500' },
  query: { bar: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  metric: { bar: 'border-l-teal-500', dot: 'bg-teal-500' },
  dimension: { bar: 'border-l-sky-500', dot: 'bg-sky-500' },
  dataset: { bar: 'border-l-amber-500', dot: 'bg-amber-500' },
  model: { bar: 'border-l-violet-500', dot: 'bg-violet-500' },
  table: { bar: 'border-l-slate-500', dot: 'bg-slate-500' },
};

/** How a card stands against a pinned path: on it, the one picked, or off it. */
export type NodeTone = 'normal' | 'selected' | 'on-path' | 'dim';

export type LineageFlowNode = Node<{ node: LineageGraphNode; tone: NodeTone }, 'lineage'>;

/** What a card's hover buttons do, given once for every card. */
export interface LineageActions {
  locate: (structureKey: string) => void;
  reveal: (target: RevealTarget) => void;
  focus: (id: string) => void;
}

export const LineageActionsContext = createContext<LineageActions | undefined>(undefined);

/** One entity on the canvas: its kind, label and name, and what the catalog says of it. */
export function LineageNodeCard({ data }: NodeProps<LineageFlowNode>) {
  const { node, tone } = data;
  const actions = useContext(LineageActionsContext);
  const mono = node.kind === 'table';
  return (
    <div
      className={cn(
        'group relative w-60 rounded-lg border border-l-[3px] bg-card text-card-foreground shadow-sm transition-[opacity,box-shadow]',
        kindAccents[node.kind].bar,
        tone === 'selected' && 'ring-2 ring-violet-500/70',
        tone === 'on-path' && 'border-violet-300 dark:border-violet-500/50',
        tone === 'dim' && 'opacity-30',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
      <div className="space-y-1 px-3 py-2.5">
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {kindLabels[node.kind]}
        </div>
        <div className={cn('text-sm leading-tight font-semibold break-words', mono && 'font-mono')}>
          {node.label}
        </div>
        {node.name && node.name !== node.label && (
          <div className="truncate font-mono text-[11px] text-muted-foreground">{node.name}</div>
        )}
        {node.description && (
          <p className="line-clamp-3 text-xs leading-snug text-muted-foreground">{node.description}</p>
        )}
        {node.definition && (
          <div className="pt-1">
            <CodeBlock
              tab="aql"
              onTab={() => {}}
              className="nowheel max-h-28 px-2.5 py-2 pr-8 text-[11px] break-words whitespace-pre-wrap"
              sources={{ aql: { label: 'AQL', code: node.definition, lang: 'aql', empty: '' } }}
            />
          </div>
        )}
        {node.chips && node.chips.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {node.chips.map((chip) => (
              <span
                key={chip}
                className="rounded bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
        {node.error && (
          <div className="flex items-start gap-1 pt-1 text-[11px] text-amber-700 dark:text-amber-400">
            <TriangleAlert className="mt-px size-3 shrink-0" />
            <span className="line-clamp-2">Lineage: {node.error}</span>
          </div>
        )}
      </div>
      {actions && <HoverActions node={node} actions={actions} />}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0"
      />
    </div>
  );
}

/** Small buttons over a hovered card's corner: find it on the page, open it in its tab, or focus on it. */
function HoverActions({ node, actions }: { node: LineageGraphNode; actions: LineageActions }) {
  const { structureKey, entity } = node;
  const onPage = node.kind === 'block' || node.kind === 'query';
  return (
    <div className="nodrag absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm group-hover:flex">
      {onPage && structureKey && (
        <ActionButton label="Locate on the page" onClick={() => actions.locate(structureKey)}>
          <Crosshair />
        </ActionButton>
      )}
      {onPage && structureKey && (
        <ActionButton label="Show in Structure" onClick={() => actions.reveal({ node: structureKey })}>
          <ListTree />
        </ActionButton>
      )}
      {entity && node.kind !== 'block' && (
        <ActionButton
          label={node.kind === 'query' ? 'Show in Data' : `Show ${entity.name} in Data`}
          onClick={() => actions.reveal({ entity: 'query', app: entity.app, name: entity.name })}
        >
          <Database />
        </ActionButton>
      )}
      <ActionButton label="Focus on its lineage" onClick={() => actions.focus(node.id)}>
        <ScanSearch />
      </ActionButton>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          // The card's click pins its path; a button's is its own.
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground [&_svg]:size-3.5"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
