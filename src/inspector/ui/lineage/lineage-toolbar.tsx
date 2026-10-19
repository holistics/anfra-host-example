import { CircleHelp, LoaderCircle, Maximize2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type LineageGraphNode, type LineageKind, lineageKinds } from '../../model/lineage';
import { KindBadge, kindLabels } from './lineage-node';

interface Props {
  /** How many of each kind the whole graph has: a kind it has none of gets no chip. */
  counts: Partial<Record<LineageKind, number>>;
  hidden: ReadonlySet<LineageKind>;
  onHidden: (hidden: Set<LineageKind>) => void;
  focus: LineageGraphNode | undefined;
  onClearFocus: () => void;
  loading: boolean;
  /** Opens the large view; absent in it. */
  onExpand?: () => void;
}

/** Above the canvas: a chip per kind to show or hide it, what it is focused on, and the large view. */
export function LineageToolbar({ counts, hidden, onHidden, focus, onClearFocus, loading, onExpand }: Props) {
  const toggle = (kind: LineageKind) => {
    const next = new Set(hidden);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    onHidden(next);
  };
  return (
    <div className="space-y-1.5 border-b px-2 py-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {lineageKinds
            .filter((kind) => counts[kind])
            .map((kind) => {
              const shown = !hidden.has(kind);
              return (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={shown}
                  onClick={() => toggle(kind)}
                  className={cn(
                    'flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors',
                    shown
                      ? 'bg-background text-foreground'
                      : 'border-dashed text-muted-foreground opacity-60',
                  )}
                >
                  <KindBadge
                    kind={kind}
                    className={cn('size-4 [&_svg]:size-3', !shown && 'bg-muted text-muted-foreground')}
                  />
                  {kindLabels[kind]}
                  <span className="text-muted-foreground tabular-nums">{counts[kind]}</span>
                </button>
              );
            })}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {loading && (
            <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-label="Tracing" />
          )}
          <EdgeLegend />
          {onExpand && (
            <Button variant="ghost" size="icon-xs" aria-label="Open in a large view" onClick={onExpand}>
              <Maximize2 />
            </Button>
          )}
        </div>
      </div>
      {focus && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Focused on</span>
          <span className="flex min-w-0 items-center gap-1 rounded-md bg-violet-100 py-0.5 pr-0.5 pl-2 font-medium text-violet-800 dark:bg-violet-500/20 dark:text-violet-200">
            <span className="truncate">
              {kindLabels[focus.kind]}: {focus.label}
            </span>
            <button
              type="button"
              aria-label="Show everything"
              onClick={onClearFocus}
              className="rounded p-0.5 hover:bg-violet-200 dark:hover:bg-violet-500/30"
            >
              <X className="size-3" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** What an arrow means: the two kinds of edge, drawn as they are on the canvas. */
function EdgeLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label="What the arrows mean">
          <CircleHelp />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 text-xs">
        <LegendRow
          line={<line x1="0" y1="6" x2="40" y2="6" stroke="#a78bfa" strokeWidth="1.5" />}
          title="Is built from"
        >
          Points from what uses to what it uses: a block draws a query, a query returns a field, a field comes
          from a dataset, a model, a table.
        </LegendRow>
        <LegendRow
          line={<line x1="0" y1="6" x2="40" y2="6" stroke="#fb923c" strokeWidth="1.5" />}
          title="Filters, with a value"
        >
          A control the reader has set, mapped to a query: its value, shown on the control's card, changes
          that query's numbers. The control is not part of where they come from.
        </LegendRow>
        <LegendRow
          line={<line x1="0" y1="6" x2="40" y2="6" stroke="#e5e7eb" strokeWidth="1.5" />}
          title="Filters, not set"
        >
          The control is mapped to the query but has no value yet, so it changes nothing for now.
        </LegendRow>
      </PopoverContent>
    </Popover>
  );
}

function LegendRow({ line, title, children }: { line: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 font-medium">
        <svg width="44" height="12" aria-hidden="true">
          {line}
        </svg>
        {title}
      </div>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
