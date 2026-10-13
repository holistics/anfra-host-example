import type { InspectedQuery } from '@holistics/anfra-sdk/common';
import { cn } from '@/lib/utils';
import { formatTime, prettyJson } from '../../model/format';
import { CodeBlock } from '../shared/code-block';
import { Field, Fields } from '../shared/fields';
import { Drawn, EntityRow, type RowProps } from './entity-row';

export type CodeTab = 'aql' | 'sql' | 'signature';

const stateDot: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-destructive',
  executing: 'bg-sky-500 animate-pulse',
  idle: 'bg-muted-foreground/40',
};

export function QueryRow({
  query,
  codeTab,
  onCodeTab,
  ...props
}: RowProps & { query: InspectedQuery; codeTab: CodeTab; onCodeTab: (tab: CodeTab) => void }) {
  const rows = query.state === 'success' ? `${query.rowCount} row${query.rowCount === 1 ? '' : 's'}` : '—';
  const summary = (
    <>
      <span className="truncate font-medium">{props.name}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span className={cn('size-1.5 rounded-full', stateDot[query.state])} />
        {query.state}
      </span>
      {query.isDirty && <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">dirty</span>}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{rows}</span>
    </>
  );
  // An error shows open or not: it is what a failing app is inspected for.
  const below = query.error && (
    <p className="px-2 pb-1.5 pl-6 text-xs break-words text-destructive" role="alert">
      {query.error.name}: {query.error.message}
    </p>
  );
  return (
    <EntityRow kind="query" summary={summary} below={below} {...props}>
      <Fields>
        <Field label="Drawn">
          <Drawn kind="query" app={props.app} name={props.name} usage={props.usage} />
        </Field>
        {query.selectedRowCount > 0 && <Field label="Selected">{query.selectedRowCount} rows</Field>}
        {query.debug && (
          <Field label="Source">
            {query.debug.fromCache ? 'cache' : 'fresh run'}
            {query.debug.executedAt && ` at ${formatTime(query.debug.executedAt)}`}
          </Field>
        )}
      </Fields>
      <CodeBlock
        tab={codeTab}
        onTab={onCodeTab}
        sources={{
          aql: { label: 'AQL', code: query.debug?.executedAql, empty: 'Not run yet.' },
          sql: { label: 'SQL', code: query.debug?.executedSql, empty: 'Not run yet.' },
          signature: { label: 'Signature', code: prettyJson(query.signature), empty: 'No signature.' },
        }}
      />
    </EntityRow>
  );
}
