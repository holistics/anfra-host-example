import { History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { dedent } from '@/inspector/model/declaration-code';
import { formatAgo } from '@/inspector/model/format';
import { cn } from '@/lib/utils';
import type { EditRecord } from '../model/history';

/**
 * The app's saved edits, newest first: the Versions panel's list once the host edits (`EDIT=1`).
 * Each save can be reverted on its own while what it wrote is still in the file.
 */
export function EditHistory({
  edits,
  onRevert,
}: {
  edits: EditRecord[];
  /** Resolves once reverted; rejects with why it couldn't be. */
  onRevert: (id: string) => Promise<void>;
}) {
  const reverted = new Set(edits.filter((r) => r.kind === 'revert').map((r) => r.of));
  const newest = [...edits].reverse();
  return (
    <div className="space-y-3">
      <div
        role="note"
        className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground"
      >
        <History className="mt-px size-3.5 shrink-0" />
        <p>
          Edits saved from the Edit panel, written into the app's files and kept beside it in a{' '}
          <code>.edits.json</code>. They are uncommitted: review them with <code>git diff</code>.
        </p>
      </div>
      {newest.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No edits saved yet.</p>
      ) : (
        <ol className="space-y-2">
          {newest.map((record) => (
            <li key={record.id}>
              <EditRow record={record} reverted={reverted.has(record.id)} onRevert={onRevert} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EditRow({
  record,
  reverted,
  onRevert,
}: {
  record: EditRecord;
  reverted: boolean;
  onRevert: (id: string) => Promise<void>;
}) {
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  const revert = () => {
    setState({ busy: true });
    onRevert(record.id).then(
      () => setState({}),
      (err: Error) => setState({ error: err.message }),
    );
  };
  return (
    <div className={cn('space-y-2 rounded-lg border p-3', reverted && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={record.kind === 'save' ? 'default' : 'outline'}>
          {record.kind === 'save' ? 'Edit' : 'Revert'}
        </Badge>
        <span className="font-mono text-xs">{record.query}</span>
        {reverted && <span className="text-xs text-muted-foreground">reverted</span>}
        <span className="ml-auto text-xs text-muted-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatAgo(record.at)}</span>
            </TooltipTrigger>
            <TooltipContent>{new Date(record.at).toLocaleString()}</TooltipContent>
          </Tooltip>
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground" title={record.file}>
        {record.file}
      </p>
      <Diff before={record.before} after={record.after} />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {record.kind === 'save' && !reverted && (
        <Button variant="outline" size="xs" onClick={revert} disabled={state.busy}>
          <RotateCcw />
          {state.busy ? 'Reverting…' : 'Revert'}
        </Button>
      )}
    </div>
  );
}

/** The lines that changed, as removed and added: enough to see what an edit did. */
function Diff({ before, after }: { before: string; after: string }) {
  const was = dedent(before).split('\n');
  const now = dedent(after).split('\n');
  const removed = was.filter((line) => !now.includes(line));
  const added = now.filter((line) => !was.includes(line));
  return (
    <pre className="overflow-x-auto rounded-md border bg-code px-2 py-1.5 font-mono text-[11px] leading-relaxed">
      {removed.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a diff's lines repeat; their order is their identity
        <div key={`-${i}`} className="text-destructive">
          - {line.trim()}
        </div>
      ))}
      {added.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a diff's lines repeat; their order is their identity
        <div key={`+${i}`} className="text-emerald-700 dark:text-emerald-400">
          + {line.trim()}
        </div>
      ))}
    </pre>
  );
}
