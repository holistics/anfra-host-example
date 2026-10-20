import type {
  InspectedApp,
  InspectedQuery,
  InspectedStructure,
  StructureNode,
} from '@holistics/anfra-sdk/common';
import { Download, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usageOf } from '../../model/format';
import type { RequestEntry } from '../../model/requests';
import type { RevealTarget } from '../../model/types';
import { AgoTime } from '../shared/ago-time';
import { Note } from '../shared/fields';
import { cell, ResultTable } from '../shared/result-table';

interface Props {
  apps: InspectedApp[] | undefined;
  structure: InspectedStructure | undefined;
  /** Each query's requests, newest first, keyed `<app>/<name>`. */
  requests: Map<string, { entry: RequestEntry }[]>;
  /** Whether the reader may export data; without it there is no download. */
  canExport: boolean;
  onReveal: (target: RevealTarget) => void;
}

/**
 * The tables behind the page, for someone who doesn't write queries: one per query, titled as the
 * page names it, with the rows it last returned. See SPEC.md §4.11.
 */
export function DataTab({ apps, structure, requests, canExport, onReveal }: Props) {
  const [search, setSearch] = useState('');
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
      <div className="space-y-6 px-3 pt-2 pb-3">
        {total === 0 && <Note>This app has no tables yet.</Note>}
        {apps.map((app, index) => {
          const tables = Object.entries(app.queries)
            .map(([name, query]) => ({ name, query, title: titleOf(structure, index, name) }))
            .filter(({ title }) => !term || title.toLowerCase().includes(term));
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
            <section key={index} className="space-y-4">
              {apps.length > 1 && (
                <p className="px-1 text-xs font-medium">
                  App {index + 1} · {app.title || 'Untitled'}
                </p>
              )}
              {tables.length === 0 && term && <Note>No tables match "{search.trim()}".</Note>}
              {tables.map(({ name, query, title }) => (
                <TableCard
                  key={name}
                  title={title}
                  query={query}
                  latest={
                    requests.get(`${index}/${name}`)?.find((r) => r.entry.status === 'ok' && r.entry.preview)
                      ?.entry
                  }
                  canExport={canExport}
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

/** What the page calls a query: the label of the first block that draws it, else the query's name. */
function titleOf(structure: InspectedStructure | undefined, app: number, name: string): string {
  const id = usageOf(structure, 'query', app, name)?.blocks[0];
  const block = id ? findBlock(structure?.nodes ?? [], id) : undefined;
  return block?.label || name;
}

function findBlock(nodes: StructureNode[], id: string): StructureNode | undefined {
  for (const node of nodes) {
    if (node.kind === 'block' && node.id === id) return node;
    const found = findBlock(node.children, id);
    if (found) return found;
  }
  return undefined;
}

function TableCard({
  title,
  query,
  latest,
  canExport,
  onTechnical,
}: {
  title: string;
  query: InspectedQuery;
  latest: RequestEntry | undefined;
  canExport: boolean;
  onTechnical: () => void;
}) {
  const failed = query.state === 'error';
  const labels = Object.fromEntries(query.columns.map((c) => [c.name, c.label]));
  const complete = latest?.preview && latest.columns && (latest.numRows ?? 0) <= latest.preview.length;
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium">{title}</h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {latest ? <AgoTime at={latest.at} /> : null}
        </span>
      </div>
      {latest?.preview && latest.columns ? (
        <ResultTable columns={latest.columns} rows={latest.preview} total={latest.numRows} labels={labels} />
      ) : failed ? (
        <p className="text-xs text-muted-foreground">This table couldn't load.</p>
      ) : (
        <p className="text-xs text-muted-foreground">Loading this table…</p>
      )}
      <div className="mt-2 flex items-center gap-1">
        {canExport && complete && latest?.columns && latest.preview && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() =>
              download(`${title}.csv`, toCsv(latest.columns ?? [], latest.preview ?? [], labels))
            }
          >
            <Download />
            Download CSV
          </Button>
        )}
        <Button variant="link" size="xs" className="ml-auto" onClick={onTechnical}>
          Technical details
        </Button>
      </div>
    </div>
  );
}

function toCsv(columns: string[], rows: unknown[][], labels: Record<string, string>): string {
  const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [
    columns.map((c) => quote(labels[c] ?? c)),
    ...rows.map((row) => columns.map((_, j) => quote(cell(row[j])))),
  ];
  return lines.map((line) => line.join(',')).join('\n');
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
