import type { InspectedQuery, QueryDeclaration } from '@holistics/anfra-sdk/common';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { dedent } from '../../model/declaration-code';
import { formatTime, prettyJson } from '../../model/format';
import type { QueryInput } from '../../model/inputs';
import type { RequestEntry } from '../../model/requests';
import type { RevealTarget } from '../../model/types';
import { CodeBlock } from '../shared/code-block';
import { Field, Fields } from '../shared/fields';
import { MiniTable } from '../shared/mini-table';
import { stateDot } from '../shared/tone';
import { Drawn, EntityRow, type RowProps } from './entity-row';
import { RequestList } from './request-list';

type CodeTab = 'declared' | 'aql' | 'sql' | 'signature';

export function QueryRow({
  query,
  declaration,
  inputs,
  requests,
  canViewSql,
  onReveal,
  ...props
}: RowProps & {
  query: InspectedQuery;
  declaration: QueryDeclaration | undefined;
  inputs: QueryInput[];
  /** This query's requests, newest first. */
  requests: { entry: RequestEntry; shared: boolean }[];
  /** Whether the reader may see generated SQL; without it, none comes back. */
  canViewSql: boolean;
  onReveal: (target: RevealTarget) => void;
}) {
  // Opens on what ran; each query keeps its own tab.
  const [codeTab, setCodeTab] = useState<CodeTab>('aql');
  const latest = requests.find(({ entry }) => entry.status === 'ok')?.entry;
  const rows = query.state === 'success' ? `${query.rowCount} row${query.rowCount === 1 ? '' : 's'}` : '—';
  const notRun = query.state === 'success' || query.state === 'error' ? 'Not returned.' : 'Not run yet.';

  const summary = (
    <>
      <span className="truncate font-medium">{props.name}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', stateDot[query.state])} />
        {query.state}
      </span>
      {query.isDirty && <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">dirty</span>}
      {query.debug?.fromCache && <span className="shrink-0 text-xs text-muted-foreground">cache</span>}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{rows}</span>
    </>
  );
  // An error shows open or not: it is what a failing app is inspected for.
  const below = query.error && (
    <p className="px-2 pb-1.5 pl-6 text-xs break-words text-destructive" role="alert">
      {query.error.name}
      {query.error.status && ` (${query.error.status})`}: {query.error.message}
    </p>
  );

  const link = (name: string, entity: 'query' | 'control') => (
    <button
      type="button"
      className="font-mono hover:underline"
      onClick={() => onReveal({ entity, app: props.app, name })}
    >
      {name}
    </button>
  );

  return (
    <EntityRow kind="query" summary={summary} below={below} {...props}>
      <Fields>
        <Field label="Dataset">{declaration?.dataset || 'none declared'}</Field>
        <Field label="Drawn">
          <Drawn kind="query" app={props.app} name={props.name} usage={props.usage} />
        </Field>
        {query.selectedRowCount > 0 && <Field label="Selected">{query.selectedRowCount} rows</Field>}
        {query.debug && (
          <Field label="Source">
            {query.debug.fromCache ? 'cache' : 'database'}
            {query.debug.executedAt && ` at ${formatTime(query.debug.executedAt)}`}
          </Field>
        )}
        {latest?.durationMs !== undefined && <Field label="Took">{latest.durationMs} ms</Field>}
        {(query.hasMore || query.page > 1) && (
          <Field label="Page">
            {query.page}
            {query.hasMore && ', more available'}
          </Field>
        )}
      </Fields>

      {inputs.length > 0 && (
        <MiniTable
          caption="Inputs"
          head={['from · on', 'now']}
          rows={inputs.map((input) => ({
            key: `${input.kind}:${input.source}`,
            cells: [
              // The field goes under its source, so the value keeps the width a narrow panel has.
              <div key="from" className="min-w-0">
                {input.self ? (
                  <span className="text-muted-foreground">itself</span>
                ) : (
                  link(input.source, input.kind === 'control' ? 'control' : 'query')
                )}
                <div className="font-mono text-[11px] break-all text-muted-foreground">{input.field}</div>
              </div>,
              <span
                key="now"
                className={cn(
                  input.value === 'not set' || input.value === 'no selection' ? 'text-muted-foreground' : '',
                )}
              >
                {input.value}
              </span>,
            ],
          }))}
        />
      )}

      {query.columns.length > 0 && (
        <MiniTable
          caption={`Columns (${query.columns.length})`}
          head={['name', 'label', 'kind']}
          rows={query.columns.map((column) => ({
            key: column.name,
            cells: [
              <span key="name" className="font-mono">
                {column.name}
              </span>,
              column.label,
              <span key="kind" className="whitespace-nowrap text-muted-foreground">
                {column.isMeasure ? (column.aggregation ?? 'measure') : 'dimension'}
                {column.adhoc && <span className="ml-1 text-amber-600 dark:text-amber-400">ad hoc</span>}
              </span>,
            ],
          }))}
        />
      )}

      <CodeBlock
        tab={codeTab}
        onTab={setCodeTab}
        sources={{
          declared: {
            label: 'Declared',
            code: declaration?.aql && dedent(declaration.aql),
            lang: 'aql',
            empty: 'Not declared.',
          },
          aql: { label: 'AQL', code: query.debug?.executedAql, lang: 'aql', empty: notRun },
          sql: {
            label: 'SQL',
            code: query.debug?.executedSql,
            lang: 'sql',
            empty: canViewSql ? notRun : 'Needs canViewGeneratedSql.',
          },
          signature: { label: 'Signature', code: prettyJson(query.signature), empty: 'No signature.' },
        }}
      />

      {requests.length > 0 && (
        <div>
          <p className="mb-0.5 px-1 text-xs text-muted-foreground">Requests ({requests.length})</p>
          <RequestList items={requests} />
        </div>
      )}
    </EntityRow>
  );
}
