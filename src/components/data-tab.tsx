import { ChevronRight, LocateFixed } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { CopyButton } from '@/components/copy-button';
import { Button } from '@/components/ui/button';
import type { InspectedApp, InspectedStructure, LocateTarget } from '@/data-app';
import {
  type EntityUsage,
  entityAttribute,
  formatCondition,
  formatTime,
  type InspectedControl,
  type InspectedQuery,
  type InspectedSelection,
  type LocateKind,
  usageOf,
} from '@/lib/inspect';
import { cn } from '@/lib/utils';

/** An entity's key, as the structure's usage names it: `query:<app>/<name>`. */
export const entityKey = (kind: LocateKind, app: number, name: string) => `${kind}:${app}/${name}`;

type CodeTab = 'aql' | 'sql' | 'signature';

interface Props {
  apps: InspectedApp[] | undefined;
  structure: InspectedStructure | undefined;
  /** An entity to open and scroll to, asked for from the Structure tab; the nonce repeats a request. */
  focus: { key: string; nonce: number } | undefined;
  onLocate: (target: LocateTarget) => void;
}

/**
 * Every app's queries, controls and selection, one line each until opened. Which rows and
 * sections are open, and which code tab shows, survive the snapshots the frame keeps posting.
 */
export function DataTab({ apps, structure, focus, onLocate }: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  const [codeTab, setCodeTab] = useState<CodeTab>('aql');

  const toggleIn = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (!next.delete(key)) next.add(key);
    return next;
  };

  useEffect(() => {
    if (!focus) return;
    const app = focus.key.split(':')[1]?.split('/')[0];
    setOpen((prev) => new Set(prev).add(focus.key));
    setClosedSections((prev) => {
      const next = new Set(prev);
      next.delete(`${app}:${focus.key.split(':')[0]}`);
      return next;
    });
    requestAnimationFrame(() =>
      document
        .querySelector(`[data-entity="${CSS.escape(focus.key)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }, [focus]);

  if (!apps) return <Note>Waiting for the Data App…</Note>;
  if (apps.length === 0) return <Note>This Data App hasn't created an SDK app.</Note>;

  return (
    <div className="space-y-5 p-2">
      {apps.map((app, index) => {
        const queries = Object.entries(app.queries);
        const controls = Object.entries(app.controls);
        const section = (name: string) => ({
          open: !closedSections.has(`${index}:${name}`),
          onToggle: () => setClosedSections((prev) => toggleIn(prev, `${index}:${name}`)),
        });
        const row = (kind: LocateKind, name: string) => {
          const key = entityKey(kind, index, name);
          return {
            entityKey: key,
            open: open.has(key),
            onToggle: () => setOpen((prev) => toggleIn(prev, key)),
            app: index,
            name,
            usage: usageOf(structure, kind, index, name),
            onLocate,
          };
        };
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
          <section key={index} className="space-y-3">
            <p className="px-1 text-xs text-muted-foreground">
              {apps.length > 1 && <span className="font-medium text-foreground">App {index + 1} · </span>}
              {app.title || 'Untitled'} · {app.timezone || 'tenant timezone'} ·{' '}
              {app.hasChanges ? (
                <span className="text-amber-600 dark:text-amber-400">unapplied changes</span>
              ) : (
                'no unapplied changes'
              )}
            </p>

            <Section title="Queries" count={queries.length} {...section('query')}>
              {queries.map(([name, query]) => (
                <QueryRow
                  key={name}
                  query={query}
                  codeTab={codeTab}
                  onCodeTab={setCodeTab}
                  {...row('query', name)}
                />
              ))}
            </Section>

            <Section title="Controls" count={controls.length} {...section('control')}>
              {controls.map(([name, control]) => (
                <ControlRow key={name} control={control} {...row('control', name)} />
              ))}
            </Section>

            {(app.selection || app.appliedSelection) && (
              <Section
                title="Selection"
                count={[app.selection, app.appliedSelection].filter(Boolean).length}
                {...section('selection')}
              >
                {app.selection && <Selection label="Current" selection={app.selection} />}
                {app.appliedSelection && <Selection label="Applied" selection={app.appliedSelection} />}
              </Section>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Section(props: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground"
        onClick={props.onToggle}
        aria-expanded={props.open}
      >
        <ChevronRight className={cn('size-3 transition-transform', props.open && 'rotate-90')} />
        {props.title}
        <span className="font-normal">{props.count}</span>
      </button>
      {props.open && (
        <div className="mt-1 space-y-px">{props.count === 0 ? <Note>None.</Note> : props.children}</div>
      )}
    </div>
  );
}

interface RowProps {
  entityKey: string;
  open: boolean;
  onToggle: () => void;
  app: number;
  name: string;
  usage: EntityUsage | undefined;
  onLocate: (target: LocateTarget) => void;
}

/** A row's shell: one clickable line, a locate button, and what shows when it is open. */
function Row({
  kind,
  summary,
  below,
  children,
  ...props
}: RowProps & { kind: LocateKind; summary: ReactNode; below?: ReactNode; children: ReactNode }) {
  const attribute = entityAttribute(kind, props.app, props.name);
  return (
    <div data-entity={props.entityKey} className={cn('rounded-md', props.open && 'bg-muted/50')}>
      <div className="group flex h-7 items-center gap-1.5 rounded-md pr-1 hover:bg-accent">
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-1 text-left text-sm"
          onClick={props.onToggle}
          aria-expanded={props.open}
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform',
              props.open && 'rotate-90',
            )}
          />
          {summary}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          disabled={!props.usage}
          title={props.usage ? 'Scroll to it on the page' : `No element is marked ${attribute} yet`}
          aria-label="Locate"
          onClick={() => props.onLocate({ app: props.app, kind, name: props.name })}
        >
          <LocateFixed className="size-3.5" />
        </Button>
      </div>
      {below}
      {props.open && <div className="space-y-2 px-2 pt-1 pb-2 pl-6">{children}</div>}
    </div>
  );
}

function Drawn({
  kind,
  app,
  name,
  usage,
}: {
  kind: LocateKind;
  app: number;
  name: string;
  usage?: EntityUsage;
}) {
  const text = !usage
    ? 'Not drawn yet'
    : `In ${usage.markers} place${usage.markers === 1 ? '' : 's'}${usage.blocks.length ? `: ${usage.blocks.join(', ')}` : ', outside any block'}`;
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <CopyButton text={entityAttribute(kind, app, name)} label="Copy the handle" className="-my-1 size-5" />
    </span>
  );
}

const stateDot: Record<string, string> = {
  success: 'bg-emerald-500',
  error: 'bg-destructive',
  executing: 'bg-sky-500 animate-pulse',
  idle: 'bg-muted-foreground/40',
};

function QueryRow({
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
    <Row kind="query" summary={summary} below={below} {...props}>
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
      <Code
        tab={codeTab}
        onTab={onCodeTab}
        sources={{
          aql: query.debug?.executedAql,
          sql: query.debug?.executedSql,
          signature: prettyJson(query.signature),
        }}
      />
    </Row>
  );
}

/** JSON indented for reading; anything else as it is. */
function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

const codeLabels: Record<CodeTab, string> = { aql: 'AQL', sql: 'SQL', signature: 'Signature' };

/** The executed AQL, SQL and the query's signature, one at a time. */
function Code({
  tab,
  onTab,
  sources,
}: {
  tab: CodeTab;
  onTab: (tab: CodeTab) => void;
  sources: Record<CodeTab, string | undefined>;
}) {
  const tabs = Object.keys(codeLabels) as CodeTab[];
  // The reader's tab, or the first with something in it.
  const shown = sources[tab] ? tab : (tabs.find((t) => sources[t]) ?? tab);
  const code = sources[shown];
  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center border-b">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            disabled={!sources[t]}
            className={cn(
              '-mb-px border-b-2 border-transparent px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
              t === shown && 'border-foreground font-medium text-foreground',
            )}
            onClick={() => onTab(t)}
            title={sources[t] ? undefined : t === 'signature' ? 'No signature' : 'Not run yet'}
          >
            {codeLabels[t]}
          </button>
        ))}
        {code && (
          <CopyButton text={code} label={`Copy the ${codeLabels[shown]}`} className="mr-1 ml-auto size-6" />
        )}
      </div>
      {code ? (
        <pre className="max-h-56 overflow-auto p-2 font-mono text-[11px] leading-snug">{code}</pre>
      ) : (
        <p className="p-2 text-xs text-muted-foreground">Not run yet.</p>
      )}
    </div>
  );
}

function ControlRow({ control, ...props }: RowProps & { control: InspectedControl }) {
  const unapplied = control.isDirty;
  const summary = (
    <>
      <span className="shrink-0 font-medium">{props.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {control.condition.values?.length ? formatCondition(control.condition) : 'not set'}
      </span>
      {unapplied && (
        <span className="ml-auto shrink-0 text-xs text-amber-600 dark:text-amber-400">unapplied</span>
      )}
    </>
  );
  return (
    <Row kind="control" summary={summary} {...props}>
      <Fields>
        <Field label="Kind">{control.kind === 'dateDrill' ? 'Date drill' : 'Filter'}</Field>
        <Field label="Set to">{formatCondition(control.condition)}</Field>
        <Field label="Applied">{formatCondition(control.appliedCondition)}</Field>
        {control.options && <Field label="Options">{control.options.join(', ')}</Field>}
        <Field label="Drawn">
          <Drawn kind="control" app={props.app} name={props.name} usage={props.usage} />
        </Field>
      </Fields>
    </Row>
  );
}

function Selection({ label, selection }: { label: string; selection: InspectedSelection }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5">
      <p className="text-sm font-medium">
        {label}
        {selection.lossy && <span className="ml-1.5 text-xs font-normal text-amber-600">lossy</span>}
      </p>
      <Fields>
        <Field label="From">{selection.source}</Field>
        <Field label="Rows">{selection.rowCount}</Field>
        {selection.expression && (
          <Field label="Expression">
            <code className="break-all">{selection.expression}</code>
          </Field>
        )}
        {selection.conditions.map((condition, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: conditions have no identity of their own
          <Field key={i} label={condition.field}>
            {formatCondition(condition)}
          </Field>
        ))}
      </Fields>
    </div>
  );
}

function Fields({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">{children}</dl>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="p-1 text-sm text-muted-foreground">{children}</p>;
}
