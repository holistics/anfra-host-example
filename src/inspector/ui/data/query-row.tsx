import type { ColumnMeta, InspectedQuery, QueryDeclaration } from '@holistics/anfra-sdk/common';
import {
  Binary,
  Braces,
  Calendar,
  CalendarClock,
  ChartColumn,
  CircleHelp,
  Hash,
  Info,
  type LucideIcon,
  SlidersHorizontal,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { dedent } from '../../model/declaration-code';
import { formatTime, plural, prettyJson } from '../../model/format';
import type { QueryInput } from '../../model/inputs';
import type { RequestEntry } from '../../model/requests';
import { queryTrust, TRUST_LEVELS } from '../../model/trust';
import type { RevealTarget } from '../../model/types';
import { CodeBlock } from '../shared/code-block';
import { EntityLink } from '../shared/entity-link';
import { Field, Fields } from '../shared/fields';
import { MiniTable } from '../shared/mini-table';
import { stateDot, toneText } from '../shared/tone';
import { TrustBars } from '../shared/trust-bars';
import { Drawn, EntityRow, type RowProps } from './entity-row';
import { RequestList } from './request-list';

type CodeTab = 'declared' | 'aql' | 'sql' | 'signature';

/** The icon of a column's semantic type. */
const typeIcon: Record<ColumnMeta['semantic_type'], LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  datetime: CalendarClock,
  truefalse: ToggleLeft,
  bit: Binary,
  json: Braces,
  unknown: CircleHelp,
};

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
  // The newest run that ended, however it did; one another query may have made isn't this one's.
  const latest = requests.find(
    ({ entry, shared }) => !shared && entry.method === 'submitQuery' && entry.status !== 'pending',
  )?.entry;
  const rows = query.state === 'success' ? plural(query.rowCount, 'row') : '—';
  const notRun = query.state === 'success' || query.state === 'error' ? 'Not returned.' : 'Not run yet.';
  const trust = queryTrust(declaration, query);

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
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="img" className="flex h-3 shrink-0 items-end" aria-label={`Trust level ${trust.level}`}>
            <TrustBars trust={trust} size="sm" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          Level {trust.level} · {TRUST_LEVELS[trust.level].name}
        </TooltipContent>
      </Tooltip>
    </>
  );
  // An error shows open or not: it is what a failing app is inspected for.
  const below = query.error && (
    <p className="px-2 pb-1.5 pl-6 text-xs break-words text-destructive" role="alert">
      {query.error.name}
      {query.error.status !== undefined && ` (${query.error.status})`}: {query.error.message}
    </p>
  );

  return (
    <EntityRow kind="query" summary={summary} below={below} {...props}>
      <Fields>
        <Field label="Trust">
          <span className={cn('font-medium', toneText[trust.tone])}>
            Level {trust.level} · {TRUST_LEVELS[trust.level].name}
          </span>
          <span className="block text-muted-foreground">{trust.text}</span>
        </Field>
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

      <Definition>
        {query.columns.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            {notRun === 'Not run yet.' ? 'Known once it runs.' : 'No fields.'}
          </p>
        ) : (
          <MiniTable
            caption={`Fields (${query.columns.length})`}
            head={['name', 'label', 'kind']}
            rows={query.columns.map((column) => {
              const Icon = typeIcon[column.semantic_type] ?? CircleHelp;
              return {
                key: column.name,
                cells: [
                  <span key="name" className="inline-flex items-center gap-1.5 font-mono">
                    <Icon
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label={column.semantic_type}
                    >
                      <title>{column.semantic_type}</title>
                    </Icon>
                    {column.name}
                  </span>,
                  column.label,
                  <span key="kind" className="whitespace-nowrap text-muted-foreground">
                    {column.isMeasure
                      ? `metric${column.aggregation ? ` · ${column.aggregation}` : ''}`
                      : 'dimension'}
                    {column.adhoc && <span className="ml-1 text-amber-600 dark:text-amber-400">ad hoc</span>}
                  </span>,
                ],
              };
            })}
          />
        )}

        {inputs.length > 0 && (
          <MiniTable
            caption={`Inputs (${inputs.length})`}
            head={['from · on', 'now']}
            rows={inputs.map((input) => {
              const Icon = input.kind === 'control' ? SlidersHorizontal : ChartColumn;
              const from = input.kind === 'control' ? 'From a control' : 'Cross-filter from a chart';
              return {
                key: `${input.kind}:${input.source}`,
                cells: [
                  // The field goes under its source, so the value keeps the width a narrow panel has.
                  <div key="from" className="min-w-0">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-label={from}>
                        <title>{from}</title>
                      </Icon>
                      {input.self ? (
                        <span className="text-muted-foreground">itself</span>
                      ) : (
                        <EntityLink
                          entity={input.kind === 'control' ? 'control' : 'query'}
                          app={props.app}
                          name={input.source}
                          onReveal={onReveal}
                        />
                      )}
                    </span>
                    <div className="pl-5 font-mono text-[11px] break-all text-muted-foreground">
                      {input.field}
                    </div>
                  </div>,
                  <span
                    key="now"
                    className={cn(
                      input.value === 'not set' || input.value === 'no selection'
                        ? 'text-muted-foreground'
                        : '',
                    )}
                  >
                    {input.value}
                  </span>,
                ],
              };
            })}
          />
        )}
      </Definition>

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

/** How the query is defined: its fields, then what filters it. */
function Definition({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-1 text-xs font-medium">
        Definition
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="About the definition"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64">
            How the query is defined: the metrics and dimensions it returns, and the controls and
            cross-filters that filter it.
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}
