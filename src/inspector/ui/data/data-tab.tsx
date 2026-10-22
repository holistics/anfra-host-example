import type {
  ColumnMeta,
  InspectedApp,
  InspectedQuery,
  InspectedStructure,
  StructureNode,
} from '@holistics/anfra-sdk/common';
import { ChevronRight, CircleHelp, Database, Download, Search, Sigma } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { columnDoc, columnKind } from '../../model/column-kind';
import { blockNodeKey, entityKey, usageOf } from '../../model/format';
import type { RequestEntry } from '../../model/requests';
import type { MetricDoc, MetricDocs, RevealTarget } from '../../model/types';
import { AgoTime } from '../shared/ago-time';
import { Note } from '../shared/fields';
import { ResultTable } from '../shared/result-table';
import { typeIcon } from '../shared/type-icon';

interface Props {
  apps: InspectedApp[] | undefined;
  structure: InspectedStructure | undefined;
  /** Each query's requests, newest first, keyed `<app>/<name>`. */
  requests: Map<string, { entry: RequestEntry }[]>;
  /** Whether the reader may export data; without it there is no download. */
  canExport: boolean;
  /** What each dataset says of its fields, for a column's tooltip. */
  metricDocs?: MetricDocs;
  /** The tables opened, kept by the panel so they survive a switch of tab. */
  open: Set<string>;
  onToggle: (key: string) => void;
  onReveal: (target: RevealTarget) => void;
}

/**
 * The tables behind the page, for someone who doesn't write queries: one per query, titled as the
 * page names it, with the rows it last returned. See SPEC.md §4.11.
 */
export function DataTab({
  apps,
  structure,
  requests,
  canExport,
  metricDocs,
  open,
  onToggle,
  onReveal,
}: Props) {
  const [search, setSearch] = useState('');
  const nodes = useMemo(() => nodesByKey(structure?.nodes ?? []), [structure]);
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
          const tables = Object.entries(app.queries)
            .map(([name, query]) => ({ name, query, title: titleOf(structure, nodes, index, name) }))
            .filter(({ title }) => !term || title.toLowerCase().includes(term));
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
            <section key={index} className="space-y-2">
              {apps.length > 1 && (
                <p className="px-1 text-xs font-medium">
                  App {index + 1} · {app.title || 'Untitled'}
                </p>
              )}
              {tables.length === 0 && term && <Note>No tables match "{search.trim()}".</Note>}
              {tables.map(({ name, query, title }) => (
                <TableCard
                  key={name}
                  index={index}
                  name={name}
                  title={title}
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

/** Every node in the structure by its key, for looking blocks up once per structure. */
function nodesByKey(nodes: StructureNode[], map = new Map<string, StructureNode>()) {
  for (const node of nodes) {
    map.set(node.key, node);
    nodesByKey(node.children, map);
  }
  return map;
}

/** What the page calls a query: the label of the first block that draws it, else the query's name. */
function titleOf(
  structure: InspectedStructure | undefined,
  nodes: Map<string, StructureNode>,
  app: number,
  name: string,
): string {
  const id = usageOf(structure, 'query', app, name)?.blocks[0];
  const key = id ? blockNodeKey(structure, id, 'query', app, name) : undefined;
  return (key && nodes.get(key)?.label) || name;
}

function TableCard({
  index,
  name,
  title,
  query,
  latest,
  canExport,
  docs,
  open,
  onToggle,
  onTechnical,
}: {
  index: number;
  name: string;
  title: string;
  query: InspectedQuery;
  latest: RequestEntry | undefined;
  canExport: boolean;
  docs: MetricDocs[string] | undefined;
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
  return (
    <Collapsible
      open={open}
      onOpenChange={onToggle}
      data-entity={entityKey('query', index, name)}
      className={cn('rounded-md border', open ? 'bg-muted/50' : 'bg-card')}
    >
      <CollapsibleTrigger className="group flex h-10 w-full items-center gap-2.5 rounded-md pr-2 pl-3 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50">
        <h3 className="min-w-0 truncate font-medium">{title}</h3>
        {query.state === 'error' && <span className="shrink-0 text-xs text-destructive">couldn't load</span>}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {returned && query.state !== 'error' ? <AgoTime at={returned.toISOString()} /> : null}
        </span>
        <span className="flex size-6 shrink-0 items-center justify-center">
          <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pt-1.5 pb-3">
        {query.state === 'error' ? (
          // The rows before the error aren't today's answer, so they don't show.
          <p className="text-xs text-muted-foreground">This table couldn't load.</p>
        ) : rows ? (
          <ResultTable
            columns={rows.columns}
            rows={rows.preview}
            total={latest?.numRows}
            labels={labels}
            renderHeader={(column, label) => {
              const meta = columns.get(column);
              return meta ? <ColumnHeader label={label} column={meta} doc={columnDoc(meta, docs)} /> : label;
            }}
          />
        ) : query.state === 'success' ? (
          // Its request has left the log, or the log couldn't tell it from another query's.
          <p className="text-xs text-muted-foreground">This table's rows aren't available here.</p>
        ) : (
          <p className="text-xs text-muted-foreground">Loading this table…</p>
        )}
        <div className="flex items-center gap-1">
          {canExport && complete && query.state !== 'error' && rows && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Download CSV"
                  onClick={() => download(`${title}.csv`, toCsv(rows.columns, rows.preview, labels))}
                >
                  <Download />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download CSV</TooltipContent>
            </Tooltip>
          )}
          <Button variant="ghost" size="xs" onClick={onTechnical}>
            <Database />
            Query
          </Button>
        </div>
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
  const Icon = column.isMeasure ? Sigma : (typeIcon[column.semantic_type] ?? CircleHelp);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3 shrink-0 text-muted-foreground" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-xs">
        <div className="font-medium">{columnKind(column)}</div>
        {doc?.description && <div className="mt-0.5">{doc.description}</div>}
      </TooltipContent>
    </Tooltip>
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
