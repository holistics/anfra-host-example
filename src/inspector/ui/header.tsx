import { Check, ClipboardCopy, SquareMousePointer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { queryCounts } from '../model/issues';
import type { DataFilter } from '../model/types';
import { copyText } from './shared/copy-button';
import { stateDot } from './shared/tone';

interface Props {
  title: string;
  /** Undefined until the frame has reported. */
  counts: ReturnType<typeof queryCounts> | undefined;
  /** Whether the frame is in pick mode. */
  picking: boolean;
  onTogglePicking: () => void;
  /** Open the Data tab on the queries counted, filtered to them. */
  onShowQueries: (filter: DataFilter['filter']) => void;
  /** The report, as JSON, built when asked for. */
  report: () => string;
  onClose: () => void;
}

/** The panel's top: what is inspected, its queries at a glance, Pick, Copy report and close. */
export function InspectorHeader({
  title,
  counts,
  picking,
  onTogglePicking,
  onShowQueries,
  report,
  onClose,
}: Props) {
  return (
    <div className="shrink-0 space-y-1 border-b px-2 pt-1.5 pb-2">
      <div className="flex h-7 items-center gap-1">
        <h2 className="min-w-0 flex-1 truncate pl-1 text-sm font-medium">{title}</h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(picking && 'bg-accent text-accent-foreground')}
              onClick={onTogglePicking}
              aria-pressed={picking}
            >
              <SquareMousePointer />
              Pick
            </Button>
          </TooltipTrigger>
          <TooltipContent>{picking ? 'Stop picking' : 'Pick an element on the page'}</TooltipContent>
        </Tooltip>
        <CopyReport report={report} />
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close the inspect panel">
          <X />
        </Button>
      </div>
      {counts && <StatusBar counts={counts} onClick={onShowQueries} />}
    </div>
  );
}

/**
 * Query counts by state, and dirty queries and controls; each opens Data on them. A zero count is
 * left out.
 */
function StatusBar({
  counts,
  onClick,
}: {
  counts: ReturnType<typeof queryCounts>;
  onClick: (filter: DataFilter['filter']) => void;
}) {
  const items = [
    { n: counts.success, label: 'ok', dot: stateDot.success, filter: 'all' },
    { n: counts.error, label: 'error', dot: stateDot.error, filter: 'errors' },
    { n: counts.executing, label: 'running', dot: stateDot.executing, filter: 'all' },
    { n: counts.idle, label: 'idle', dot: stateDot.idle, filter: 'all' },
    { n: counts.dirty + counts.dirtyControls, label: 'dirty', dot: 'bg-amber-500', filter: 'dirty' },
  ] as const;
  const shown = items.filter((item) => item.n > 0);
  return (
    <div className="flex flex-wrap items-center gap-x-1 px-0.5 text-xs text-muted-foreground">
      {shown.length === 0 && <span className="px-1">No queries</span>}
      {shown.map((item) => (
        <Button
          key={item.label}
          variant="ghost"
          size="xs"
          className="tabular-nums"
          onClick={() => onClick(item.filter)}
        >
          <span className={cn('size-1.5 rounded-full', item.dot)} />
          {item.n} {item.label}
        </Button>
      ))}
    </div>
  );
}

/** Copies the report; when the clipboard refuses, logs it so it is still one step away. */
function CopyReport({ report }: { report: () => string }) {
  const [status, setStatus] = useState<'copied' | 'logged'>();
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(undefined), 1800);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    const text = report();
    if (await copyText(text)) return setStatus('copied');
    console.log(text);
    setStatus('logged');
  };

  const label =
    status === 'copied'
      ? 'Report copied'
      : status === 'logged'
        ? "Couldn't copy: logged to the console"
        : 'Copy report';
  return (
    <Tooltip open={status ? true : undefined}>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={label}>
          {status === 'copied' ? <Check /> : <ClipboardCopy />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
