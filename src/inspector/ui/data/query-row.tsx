import type { ColumnMeta, InspectedQuery, QueryDeclaration } from '@holistics/anfra-sdk/common';
import {
  Binary,
  Boxes,
  Braces,
  Calendar,
  CalendarClock,
  ChartColumn,
  CircleHelp,
  Hash,
  Info,
  type LucideIcon,
  Sigma,
  SlidersHorizontal,
  ToggleLeft,
  Type,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
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
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{rows}</span>
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
    <p className="px-3 pb-1.5 text-xs break-words text-destructive" role="alert">
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
        <Field label="Dataset">
          <span className="inline-flex items-center gap-1.5">
            <Boxes className="size-3.5 shrink-0 text-muted-foreground" />
            {declaration?.dataset || 'none declared'}
          </span>
        </Field>
        <Field label="On the page">
          <Drawn
            kind="query"
            app={props.app}
            name={props.name}
            usage={props.usage}
            blockKey={props.blockKey}
            onReveal={onReveal}
            onLocate={props.onLocate}
          />
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

      <Section title="Definition" info="The metrics and dimensions the query returns.">
        {query.columns.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            {notRun === 'Not run yet.' ? 'Known once it runs.' : 'No fields.'}
          </p>
        ) : (
          <MiniTable
            head={['', 'name', 'label']}
            rows={query.columns.map((column) => {
              const Icon = column.isMeasure ? Sigma : (typeIcon[column.semantic_type] ?? CircleHelp);
              const title = column.isMeasure
                ? `metric${column.aggregation ? ` · ${column.aggregation}` : ''}`
                : `dimension · ${column.semantic_type}`;
              return {
                key: column.name,
                cells: [
                  <TypeIcon key="type" icon={Icon} label={title} />,
                  <span key="name" className="font-mono text-xs leading-5">
                    {column.name}
                    {column.adhoc && <span className="ml-1 text-amber-600 dark:text-amber-400">ad hoc</span>}
                  </span>,
                  column.label,
                ],
              };
            })}
          />
        )}
      </Section>

      {inputs.length > 0 && (
        <Section title="Inputs" info="The controls and cross-filters that filter the query.">
          <MiniTable
            head={['', 'from · on', 'applied']}
            rows={inputs.map((input) => {
              const Icon = input.kind === 'control' ? SlidersHorizontal : ChartColumn;
              const from = input.kind === 'control' ? 'From a control' : 'Cross-filter from a chart';
              return {
                key: `${input.kind}:${input.source}`,
                cells: [
                  <TypeIcon key="type" icon={Icon} label={from} />,
                  // The field goes under its source, so the value keeps the width a narrow panel has.
                  <div key="from" className="min-w-0">
                    <span className="text-xs leading-5">
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
                    <div className="font-mono text-xs break-all text-muted-foreground">{input.field}</div>
                  </div>,
                  <div key="applied" className="min-w-0">
                    <span
                      className={cn(
                        input.value === 'not set' || input.value === 'no selection'
                          ? 'text-muted-foreground'
                          : '',
                      )}
                    >
                      {input.value}
                    </span>
                    {input.pending && (
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        pending: {input.pending}
                      </div>
                    )}
                  </div>,
                ],
              };
            })}
          />
        </Section>
      )}

      <CodeBlock
        tab={codeTab}
        onTab={setCodeTab}
        sources={{
          declared: {
            label: 'Declared AQL',
            code: declaration?.aql && dedent(declaration.aql),
            lang: 'aql',
            empty: 'Not declared.',
          },
          aql: { label: 'Executed AQL', code: query.debug?.executedAql, lang: 'aql', empty: notRun },
          sql: {
            label: 'Executed SQL',
            code: query.debug?.executedSql,
            lang: 'sql',
            empty: canViewSql ? notRun : 'Needs canViewGeneratedSql.',
          },
          signature: { label: 'Signature', code: prettyJson(query.signature), empty: 'No signature.' },
        }}
      />

      {requests.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-xs text-muted-foreground">Requests ({requests.length})</p>
          <RequestList items={requests} />
        </div>
      )}
    </EntityRow>
  );
}

/** A titled part of an opened query, with a hint on what it holds. */
function Section({ title, info, children }: { title: string; info: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 px-1 text-sm font-medium">
        {title}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`About ${title.toLowerCase()}`}>
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-64">
            {info}
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

/** An icon that says what it stands for on hover. */
function TypeIcon({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={label} className="inline-flex h-5 items-center text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
