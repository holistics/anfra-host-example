import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatTime } from '../../model/format';
import type { RequestEntry } from '../../model/requests';
import { CodeBlock } from '../shared/code-block';

/** How many of a query's requests show before "Show all". */
const FIRST = 5;

const statusColor: Record<RequestEntry['status'], string> = {
  ok: 'bg-emerald-500',
  error: 'bg-destructive',
  pending: 'bg-sky-500 animate-pulse',
  aborted: 'bg-muted-foreground/40',
};

/** Requests, newest first: one line each, opened to their input and first rows. */
export function RequestList({ items }: { items: { entry: RequestEntry; shared?: boolean }[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, FIRST);
  return (
    <div>
      <ul className="space-y-px">
        {shown.map(({ entry, shared }) => (
          <RequestItem key={entry.id} entry={entry} shared={shared} />
        ))}
      </ul>
      {items.length > FIRST && (
        <button
          type="button"
          className="mt-0.5 px-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setAll(!all)}
        >
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </div>
  );
}

function RequestItem({ entry, shared }: { entry: RequestEntry; shared?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cn('rounded-md', open && 'bg-background')}>
      <button
        type="button"
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs hover:bg-accent"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn('size-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')}
        />
        <span className={cn('size-1.5 shrink-0 rounded-full', statusColor[entry.status])} />
        <span className="shrink-0 tabular-nums">{formatTime(entry.at)}</span>
        <span className="min-w-0 truncate text-muted-foreground">{summaryOf(entry)}</span>
        {shared && <span className="shrink-0 text-muted-foreground">shared</span>}
        <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
          {entry.durationMs === undefined ? '…' : `${entry.durationMs} ms`}
        </span>
      </button>
      {open && (
        <div className="space-y-2 px-1 pt-1 pb-2 pl-5">
          {entry.error && <p className="text-xs break-words text-destructive">{entry.error}</p>}
          {entry.preview && entry.columns && (
            <Preview columns={entry.columns} rows={entry.preview} total={entry.numRows} />
          )}
          <CodeBlock
            tab="input"
            onTab={() => {}}
            sources={{ input: { label: 'Input', code: inputOf(entry), lang: 'js', empty: 'No input.' } }}
          />
        </div>
      )}
    </li>
  );
}

/** What a line says after its time: the source, the page, and the rows or how it ended. */
function summaryOf(entry: RequestEntry): string {
  if (entry.method === 'fieldSuggestions') {
    return `suggestions for ${entry.field}${entry.q ? ` "${entry.q}"` : ''}${entry.numRows === undefined ? '' : ` · ${entry.numRows}`}`;
  }
  const parts = [entry.fromCache === undefined ? undefined : entry.fromCache ? 'cache' : 'database'];
  if (entry.page && entry.page > 1) parts.push(`page ${entry.page}`);
  if (entry.status === 'ok') parts.push(`${entry.numRows ?? 0} rows`);
  else if (entry.status !== 'pending') parts.push(entry.status);
  return parts.filter(Boolean).join(' · ');
}

function inputOf(entry: RequestEntry): string | undefined {
  const { input, page, pageSize, bustCache, dataset, aql, field, q } = entry;
  const shown =
    entry.method === 'submitQuery' ? { dataset, page, pageSize, bustCache, ...input } : { dataset, field, q };
  // Without the declared AQL, which the query shows already, and empty lists.
  const kept = Object.entries(shown).filter(
    ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0),
  );
  return kept.length ? JSON.stringify(Object.fromEntries(kept), null, 2) : aql;
}

/** The first rows of a result, as a table that scrolls both ways within its box. */
function Preview({ columns, rows, total }: { columns: string[]; rows: unknown[][]; total?: number }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        {rows.length === 0
          ? 'No rows.'
          : total !== undefined && total > rows.length
            ? `First ${rows.length} of ${total} rows`
            : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
      </p>
      {rows.length > 0 && (
        <div className="max-h-60 overflow-auto rounded-md border">
          <table className="text-[11px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                <tr key={i} className="border-t">
                  {columns.map((column, j) => (
                    <td key={column} className="max-w-48 truncate px-2 py-0.5 whitespace-nowrap">
                      {cell(row[j])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return '∅';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
