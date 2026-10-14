import type { InspectedApp } from '@holistics/anfra-sdk/common';
import {
  ChevronRight,
  CircleAlert,
  Clock,
  Database,
  Info,
  SlidersHorizontal,
  TriangleAlert,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Check } from '../../model/checks';
import { formatTime, plural } from '../../model/format';
import { type Issue, issuesOf, queryCounts } from '../../model/issues';
import { queriesOf, type RequestEntry } from '../../model/requests';
import { appTrust, LEVELS, TRUST_LEVELS } from '../../model/trust';
import type { InspectorEnv, RevealTarget } from '../../model/types';
import type { InspectorSnapshot } from '../../source';
import { Field, Fields, Note, SectionTitle } from '../shared/fields';
import { toneText } from '../shared/tone';
import { TrustBars } from '../shared/trust-bars';

interface Props {
  snapshot: InspectorSnapshot | undefined;
  env: InspectorEnv;
  requests: readonly RequestEntry[];
  /** Each app's wiring checks, by index. */
  checks: Check[][];
  onReveal: (target: RevealTarget) => void;
}

/** How many issues the list shows before "Show all". */
const FIRST_ISSUES = 5;

/** The landing tab: is this app healthy, and where to look. See SPEC.md §4.3. */
export function OverviewTab({ snapshot, env, requests, checks, onReveal }: Props) {
  if (!snapshot) return <Note>Waiting for the Data App…</Note>;
  const { apps } = snapshot;
  const issues = issuesOf(snapshot, checks);

  return (
    <div className="space-y-4 p-2">
      {apps.length === 0 ? (
        <Note>This Data App hasn't created an SDK app.</Note>
      ) : (
        apps.map((app, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
          <TrustCard key={index} app={app} label={apps.length > 1 ? `App ${index + 1}` : undefined} />
        ))
      )}
      <Stats apps={apps} issues={issues} requests={requests} onReveal={onReveal} />
      <Issues issues={issues} onReveal={onReveal} />
      <Environment apps={apps} env={env} requests={requests.length} />
    </div>
  );
}

function TrustCard({ app, label }: { app: InspectedApp; label?: string }) {
  const trust = appTrust(app);
  return (
    <Card className="py-3">
      <CardContent className="px-3">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {label && <span className="font-medium text-foreground">{label} · </span>}
            Trust level
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" aria-label="About trust levels">
                <Info />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-72 space-y-1.5 py-2">
              {LEVELS.map((level) => (
                <p key={level}>
                  <span className="font-medium">
                    {level}. {TRUST_LEVELS[level].name}
                  </span>
                  : {TRUST_LEVELS[level].hint}
                </p>
              ))}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <TrustBars trust={trust} />
          <div>
            <p className={cn('text-sm font-medium', toneText[trust.tone])}>
              Level {trust.level} · {TRUST_LEVELS[trust.level].name}
            </p>
            <p className="text-xs text-muted-foreground">{trust.text}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stats({
  apps,
  issues,
  requests,
  onReveal,
}: {
  apps: InspectedApp[];
  issues: Issue[];
  requests: readonly RequestEntry[];
  onReveal: (target: RevealTarget) => void;
}) {
  const counts = queryCounts(apps);
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;
  const controls = apps.flatMap((app) => Object.values(app.controls));
  const unapplied = counts.dirtyControls;
  const last = requests.findLast((r) => r.method === 'submitQuery' && r.status !== 'pending');
  const lastQuery = last?.aql ? queriesOf({ ...last, aql: last.aql }, apps)[0] : undefined;
  const firstIssue = issues[0];

  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat
        icon={<CircleAlert />}
        title="Issues"
        value={issues.length}
        tone={errors ? 'error' : warnings ? 'warn' : undefined}
        detail={issues.length ? `${plural(errors, 'error')} · ${plural(warnings, 'warning')}` : 'None found'}
        onClick={firstIssue ? () => onReveal(firstIssue.target) : undefined}
      />
      <Stat
        icon={<Database />}
        title="Queries"
        value={counts.total}
        tone={counts.error ? 'error' : undefined}
        detail={[
          `${counts.success} ok`,
          counts.error && `${counts.error} failed`,
          counts.executing && `${counts.executing} running`,
          counts.idle && `${counts.idle} idle`,
        ]
          .filter(Boolean)
          .join(' · ')}
        onClick={() => onReveal({ tab: 'data' })}
      />
      <Stat
        icon={<SlidersHorizontal />}
        title="Controls"
        value={controls.length}
        tone={unapplied ? 'warn' : undefined}
        detail={unapplied ? `${unapplied} unapplied` : 'All applied'}
        onClick={() => onReveal({ tab: 'data' })}
      />
      <Stat
        icon={<Clock />}
        title="Last request"
        value={last ? formatTime(last.at) : '—'}
        tone={last?.status === 'error' ? 'error' : undefined}
        detail={
          last
            ? [
                lastQuery?.name ?? 'no query',
                `${last.durationMs} ms`,
                last.status === 'ok' ? (last.fromCache ? 'cache' : 'database') : last.status,
              ].join(' · ')
            : 'Nothing has run yet'
        }
        onClick={lastQuery ? () => onReveal({ entity: 'query', ...lastQuery }) : undefined}
      />
    </div>
  );
}

function Stat(props: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  detail: string;
  tone?: 'warn' | 'error';
  onClick?: () => void;
}) {
  return (
    <Item
      asChild
      variant="outline"
      size="sm"
      className="min-w-0 flex-col items-start gap-0.5 text-left hover:bg-accent"
    >
      <button type="button" disabled={!props.onClick} onClick={props.onClick}>
        <ItemDescription className="flex items-center gap-1.5 [&_svg]:size-3.5">
          {props.icon}
          {props.title}
        </ItemDescription>
        <ItemTitle className={cn('text-lg tabular-nums', props.tone && toneText[props.tone])}>
          {props.value}
        </ItemTitle>
        <ItemDescription className="w-full truncate">{props.detail}</ItemDescription>
      </button>
    </Item>
  );
}

function Issues({ issues, onReveal }: { issues: Issue[]; onReveal: (target: RevealTarget) => void }) {
  const [all, setAll] = useState(false);
  if (issues.length === 0) return null;
  const shown = all ? issues : issues.slice(0, FIRST_ISSUES);
  return (
    <div>
      <SectionTitle>Issues</SectionTitle>
      <ul className="mt-1 space-y-px">
        {shown.map((issue, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: issues have no identity of their own
          <li key={i}>
            <Item asChild size="sm" className="w-full cursor-pointer text-left hover:bg-accent">
              <button type="button" onClick={() => onReveal(issue.target)}>
                <ItemMedia variant="default">
                  {issue.level === 'error' ? (
                    <CircleAlert className="text-destructive" />
                  ) : (
                    <TriangleAlert className="text-amber-500" />
                  )}
                </ItemMedia>
                <ItemContent className="break-words">{issue.message}</ItemContent>
              </button>
            </Item>
          </li>
        ))}
      </ul>
      {issues.length > FIRST_ISSUES && (
        <Button variant="link" size="xs" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${issues.length}`}
        </Button>
      )}
    </div>
  );
}

function Environment({ apps, env, requests }: { apps: InspectedApp[]; env: InspectorEnv; requests: number }) {
  const { reader } = env;
  const datasets = Object.values(env.datasets).map((d) => d.label || d.name);
  // An app without a timezone of its own runs in the tenant's, which the host doesn't know.
  const mismatched = apps
    .map((app, index) => ({ app, label: apps.length > 1 ? `App ${index + 1}` : 'the app' }))
    .filter(({ app }) => app.timezone && app.timezone !== reader.timezone);
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group w-full justify-start">
          <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
          Environment
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-1 pt-1.5">
        {mismatched.length > 0 && (
          <p className="flex gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            The reader is in {reader.timezone}, but{' '}
            {mismatched.map(({ app, label }) => `${label} runs in ${app.timezone}`).join(', ')}: dates are
            computed in the app's timezone.
          </p>
        )}
        <Fields>
          <Field label="Host">{env.hostName}</Field>
          {env.sdkVersion && <Field label="SDK">{env.sdkVersion}</Field>}
          <Field label="Reader">
            {reader.name} · {reader.email} · {reader.role}
          </Field>
          <Field label="Reader timezone">{reader.timezone}</Field>
          {apps.map((app, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
            <Field key={index} label={apps.length > 1 ? `App ${index + 1} timezone` : 'App timezone'}>
              {app.timezone || 'tenant default'}
            </Field>
          ))}
          <Field label="Generated SQL">
            {reader.permissions.canViewGeneratedSql ? 'can view' : 'hidden'}
          </Field>
          <Field label="Export">{reader.permissions.canExportData ? 'allowed' : 'not allowed'}</Field>
          <Field label="Requests">{requests} since the app loaded</Field>
          <Field label={`Datasets (${datasets.length})`}>{datasets.join(', ') || 'none'}</Field>
        </Fields>
      </CollapsibleContent>
    </Collapsible>
  );
}
