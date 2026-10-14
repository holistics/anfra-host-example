import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTime, plural } from '../../model/format';
import type { RequestEntry } from '../../model/requests';
import { CodeBlock } from '../shared/code-block';
import { stateDot } from '../shared/tone';

/** How many of a query's requests show before "Show all". */
const FIRST = 5;

/** A request's dot, colored as the query state it amounts to. */
const statusColor: Record<RequestEntry['status'], string | undefined> = {
  ok: stateDot.success,
  error: stateDot.error,
  pending: stateDot.executing,
  aborted: stateDot.idle,
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
        <Button variant="link" size="xs" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </Button>
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
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-sm hover:bg-accent"
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
  if (entry.method === 'exportQuery') {
    const parts = [`export${entry.format ? ` ${entry.format}` : ''}`];
    if (entry.status === 'ok') parts.push(`${entry.numRows ?? 0} rows`);
    else if (entry.status !== 'pending') parts.push(entry.status);
    return parts.join(' · ');
  }
  const parts = [entry.fromCache === undefined ? undefined : entry.fromCache ? 'cache' : 'database'];
  if (entry.page && entry.page > 1) parts.push(`page ${entry.page}`);
  if (entry.status === 'ok') parts.push(`${entry.numRows ?? 0} rows`);
  else if (entry.status !== 'pending') parts.push(entry.status);
  return parts.filter(Boolean).join(' · ');
}

function inputOf(entry: RequestEntry): string | undefined {
  const {
    input,
    page,
    pageSize,
    timezone,
    bustCache,
    dataset,
    aql,
    field,
    q,
    format,
    formatOptions,
    filename,
  } = entry;
  const shown =
    entry.method === 'submitQuery'
      ? { dataset, page, pageSize, timezone, bustCache, ...input }
      : entry.method === 'exportQuery'
        ? { dataset, timezone, format, formatOptions, filename, ...input }
        : { dataset, field, q };
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
            : plural(rows.length, 'row')}
      </p>
      {rows.length > 0 && (
        // The table scrolls within its own container, so the cap goes there for the header to stick.
        <div className="rounded-md border bg-background [&_[data-slot=table-container]]:max-h-60 [&_[data-slot=table-container]]:overflow-auto">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead key={column} className="h-6 px-2">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono">
              {rows.map((row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                <TableRow key={i}>
                  {columns.map((column, j) => (
                    <TableCell key={column} className="max-w-48 truncate px-2 py-0.5">
                      {cell(row[j])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
