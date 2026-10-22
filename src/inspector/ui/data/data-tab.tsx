import type { ColumnMeta, InspectedApp, InspectedQuery, QueryDeclaration } from '@holistics/anfra-sdk/common';
import { ChevronRight, Database, Download, Search } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { columnDoc, columnKind } from '../../model/column-kind';
import { entityKey } from '../../model/format';
import { type QueryInput, queryInputs } from '../../model/inputs';
import type { RequestEntry } from '../../model/requests';
import type { MetricDoc, MetricDocs, RevealTarget } from '../../model/types';
import { AgoTime } from '../shared/ago-time';
import { Note } from '../shared/fields';
import { HoverPopover } from '../shared/hover-popover';
import { QueryIndicators, queryFilters } from '../shared/query-indicators';
import { ResultTable, rowCount } from '../shared/result-table';
import { scrollToAndFlash } from '../shared/reveal';
import { columnIcon } from '../shared/type-icon';

interface Props {
  apps: InspectedApp[] | undefined;
  /** Each query's requests, newest first, keyed `<app>/<name>`. */
  requests: Map<string, { entry: RequestEntry }[]>;
  /** Whether the reader may export data; without it there is no download. */
  canExport: boolean;
  /** What each dataset says of its fields, for a column's tooltip. */
  metricDocs?: MetricDocs;
  /** The tables opened, kept by the panel so they survive a switch of tab. */
  open: Set<string>;
  onToggle: (key: string) => void;
  /** A table to bring into view and flash, opened already; a new nonce repeats a request for the same table. */
  focus?: { key: string; nonce: number };
  onFocused: () => void;
  onReveal: (target: RevealTarget) => void;
}

/**
 * The tables behind the page, for someone who doesn't write queries: one per query, titled by its name, with the rows it last returned. See SPEC.md §4.11.
 */
export function DataTab({
  apps,
  requests,
  canExport,
  metricDocs,
  open,
  onToggle,
  focus,
  onFocused,
  onReveal,
}: Props) {
  const [search, setSearch] = useState('');
  // The filters narrowing each table, keyed `<app>/<name>`: worked out per snapshot, not per request.
  const filters = useMemo(() => {
    const filters = new Map<string, QueryInput[]>();
    apps?.forEach((app, index) => {
      for (const name of Object.keys(app.queries))
        filters.set(
          `${index}/${name}`,
          queryFilters(app.declaration.queries[name], queryInputs(app, name)).active,
        );
    });
    return filters;
  }, [apps]);

  // Held until the tables are there to find: a pick can land before the snapshot's apps.
  const ready = !!apps;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs per request, not per search
  useEffect(() => {
    if (!focus || !ready) return;
    // A search that would hide it goes.
    setSearch('');
    scrollToAndFlash(`[data-entity="${CSS.escape(focus.key)}"]`);
    onFocused();
  }, [focus, ready]);

  if (!apps) return <Note>Waiting for the Data App…</Note>;
  if (apps.length === 0) return <Note>This Data App hasn't created an SDK app.</Note>;

  const term = search.trim().toLowerCase();
  const total = apps.reduce((n, app) => n + Object.keys(app.queries).length, 0);
  return (
    <div>
      <div className="sticky top-0 z-10 bg-background px-3 pt-2.5 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
            placeholder="Search tables"
            aria-label="Search tables"
            className="pl-7"
          />
        </div>
      </div>
      <div className="space-y-6 px-3 pt-1 pb-3">
        {total === 0 && <Note>This app has no tables yet.</Note>}
        {apps.map((app, index) => {
          const tables = Object.entries(app.queries).filter(
            ([name]) => !term || name.toLowerCase().includes(term),
          );
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
            <section key={index} className="space-y-2">
              {apps.length > 1 && (
                <p className="px-1 text-xs font-medium">
                  App {index + 1} · {app.title || 'Untitled'}
                </p>
              )}
              {tables.length === 0 && term && <Note>No tables match "{search.trim()}".</Note>}
              {tables.map(([name, query]) => (
                <TableCard
                  key={name}
                  index={index}
                  name={name}
                  query={query}
                  // The first page's rows: a later page isn't the start of the table.
                  latest={
                    requests
                      .get(`${index}/${name}`)
                      ?.find(
                        (r) =>
                          r.entry.status === 'ok' && r.entry.preview && !(r.entry.page && r.entry.page > 1),
                      )?.entry
                  }
                  canExport={canExport}
                  docs={metricDocs?.[app.declaration.queries[name]?.dataset ?? '']}
                  declaration={app.declaration.queries[name]}
                  filters={filters.get(`${index}/${name}`) ?? []}
                  open={open.has(entityKey('query', index, name))}
                  onToggle={() => onToggle(entityKey('query', index, name))}
                  onTechnical={() => onReveal({ entity: 'query', app: index, name })}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TableCard({
  index,
  name,
  query,
  latest,
  canExport,
  docs,
  declaration,
  filters,
  open,
  onToggle,
  onTechnical,
}: {
  index: number;
  name: string;
  query: InspectedQuery;
  latest: RequestEntry | undefined;
  canExport: boolean;
  docs: MetricDocs[string] | undefined;
  declaration: QueryDeclaration | undefined;
  /** The filters narrowing the table now. */
  filters: QueryInput[];
  open: boolean;
  onToggle: () => void;
  onTechnical: () => void;
}) {
  const labels = Object.fromEntries(query.columns.filter((c) => c.label).map((c) => [c.name, c.label]));
  const rows =
    latest?.preview && latest.columns ? { columns: latest.columns, preview: latest.preview } : undefined;
  // A paged query's first page is only the whole table when no other page follows it.
  const complete = rows && !query.hasMore && query.page <= 1 && (latest?.numRows ?? 0) <= rows.preview.length;
  // When the rows came back, not when they were asked for.
  const returned = latest && new Date(new Date(latest.at).getTime() + (latest.durationMs ?? 0));
  const columns = new Map(query.columns.map((c) => [c.name, c]));
  const toolbar = (
    <div className="flex items-center gap-1">
      {canExport && complete && query.state !== 'error' && rows && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Download CSV"
              onClick={() => download(`${name}.csv`, toCsv(rows.columns, rows.preview, labels))}
            >
              <Download />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download CSV</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Query" onClick={onTechnical}>
            <Database />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Query</TooltipContent>
      </Tooltip>
    </div>
  );
  return (
    <Collapsible
      open={open}
      onOpenChange={onToggle}
      data-entity={entityKey('query', index, name)}
      className={cn('rounded-md border', open ? 'bg-muted/50' : 'bg-card')}
    >
      <div className="flex h-10 items-center gap-2.5 rounded-md pr-2 hover:bg-accent">
        {/* The heading holds the button, not the other way round: a button may hold only phrasing content. */}
        <h3 className="flex h-full min-w-0 flex-1">
          <CollapsibleTrigger className="flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-md pl-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <span className="min-w-0 truncate font-medium">{name}</span>
            {query.state === 'error' && (
              <span className="shrink-0 text-xs text-destructive">couldn't load</span>
            )}
            <span className="ml-auto" />
          </CollapsibleTrigger>
        </h3>
        <QueryIndicators query={query} declaration={declaration} active={filters} showState={false} />
        {toolbar}
        <CollapsibleTrigger
          aria-label={open ? 'Collapse' : 'Expand'}
          className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-3 px-3 pt-1.5 pb-3">
        {query.state === 'error' ? (
          // The rows before the error aren't today's answer, so they don't show.
          <p className="text-xs text-muted-foreground">This table couldn't load.</p>
        ) : rows ? (
          <>
            <ResultTable
              columns={rows.columns}
              rows={rows.preview}
              total={latest?.numRows}
              labels={labels}
              hideCount
              renderHeader={(column, label) => {
                const meta = columns.get(column);
                return meta ? (
                  <ColumnHeader label={label} column={meta} doc={columnDoc(meta, docs)} />
                ) : (
                  label
                );
              }}
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {rowCount(rows.preview.length, latest?.numRows)}
              {returned && (
                <>
                  <span aria-hidden>·</span>
                  <AgoTime at={returned.toISOString()} />
                </>
              )}
            </p>
          </>
        ) : query.state === 'success' ? (
          // Its request has left the log, or the log couldn't tell it from another query's.
          <p className="text-xs text-muted-foreground">This table's rows aren't available here.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Loading this table…</p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** A column's header: an icon for metric or dimension, and on hover what the dataset says of it. */
function ColumnHeader({
  label,
  column,
  doc,
}: {
  label: string;
  column: ColumnMeta;
  doc: MetricDoc | undefined;
}) {
  const Icon = columnIcon(column);
  const rows: [string, ReactNode][] = [
    ['Type', doc?.type ?? columnKind(column)],
    ['Format', doc?.format && <code className="font-mono">{doc.format}</code>],
    [
      'Formula',
      doc?.definition && (
        <code className="block rounded-md border bg-muted px-2 py-1.5 font-mono break-words whitespace-pre-wrap">
          {doc.definition}
        </code>
      ),
    ],
    ['Description', doc?.description],
  ];
  return (
    <HoverPopover
      side="bottom"
      align="start"
      className="w-72 space-y-2 p-3 text-xs font-normal tracking-normal normal-case"
      trigger={
        // Focusable, so a keyboard opens it too: Enter or Space clicks it.
        <button
          type="button"
          className="inline-flex cursor-help items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Icon className="size-3 shrink-0 text-muted-foreground" />
          {label}
        </button>
      }
    >
      <div className="text-sm font-medium">{doc?.label || label}</div>
      <dl className="space-y-1.5">
        {rows.map(
          ([term, value]) =>
            value && (
              <div key={term}>
                <dt className="text-muted-foreground">{term}</dt>
                <dd>{value}</dd>
              </div>
            ),
        )}
      </dl>
    </HoverPopover>
  );
}

/** One CSV field: empty for no value, and text a spreadsheet would run as a formula kept as text. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(columns: string[], rows: unknown[][], labels: Record<string, string>): string {
  const lines = [
    columns.map((c) => csvField(labels[c] || c)),
    ...rows.map((row) => columns.map((_, j) => csvField(row[j]))),
  ];
  // The BOM tells Excel the file is UTF-8; CRLF is the line end CSV readers expect.
  return `﻿${lines.map((line) => line.join(',')).join('\r\n')}`;
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers only follow a link that is in the page, and start the download after the click.
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
