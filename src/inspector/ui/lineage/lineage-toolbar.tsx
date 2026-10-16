import { LoaderCircle, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type LineageGraphNode, type LineageKind, lineageKinds } from '../../model/lineage';
import { kindAccents, kindLabels } from './lineage-node';

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
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      shown ? kindAccents[kind].dot : 'bg-muted-foreground/40',
                    )}
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
