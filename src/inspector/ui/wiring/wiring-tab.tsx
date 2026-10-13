import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type CheckLevel, controlMappings, crossFilters, wiringChecks } from '../../model/checks';
import { declarationCode } from '../../model/declaration-code';
import type { RevealTarget } from '../../model/types';
import { CodeBlock } from '../shared/code-block';
import { Note, SectionTitle } from '../shared/fields';
import { scrollToAndFlash } from '../shared/reveal';

interface Props {
  apps: InspectedApp[] | undefined;
  /** A check to scroll to, asked for from elsewhere in the panel; the nonce repeats a request. */
  focus: { app: number; check: number; nonce: number } | undefined;
  onReveal: (target: RevealTarget) => void;
}

/** How every app is put together, from its declaration. See SPEC.md §4.6. */
export function WiringTab({ apps, focus, onReveal }: Props) {
  useEffect(() => {
    if (focus) scrollToAndFlash(`[data-check="${focus.app}:${focus.check}"]`);
  }, [focus]);

  if (!apps) return <Note>Waiting for the Data App…</Note>;
  if (apps.length === 0) return <Note>This Data App hasn't created an SDK app.</Note>;

  return (
    <div className="space-y-6 p-2">
      {apps.map((app, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: an app's index is its identity in the frame
        <section key={index} className="space-y-4">
          {apps.length > 1 && (
            <p className="px-1 text-xs font-medium">
              App {index + 1} · {app.title || 'Untitled'}
            </p>
          )}
          <Counts app={app} />
          <Matrix app={app} index={index} onReveal={onReveal} />
          <Checks app={app} index={index} onReveal={onReveal} />
          <Declaration app={app} />
        </section>
      ))}
    </div>
  );
}

function Counts({ app }: { app: InspectedApp }) {
  const { queries, filters, dateDrills } = app.declaration;
  const counts = [
    [Object.keys(queries).length, 'queries'],
    [Object.keys(filters).length + Object.keys(dateDrills).length, 'controls'],
    [controlMappings(app).length, 'mappings'],
    [crossFilters(app).length, 'cross-filters'],
  ] as const;
  return (
    <div className="flex flex-wrap gap-1 px-1">
      {counts.map(([n, label]) => (
        <Badge key={label} variant="outline" className="font-normal">
          {n} {label}
        </Badge>
      ))}
    </div>
  );
}

/** Queries down, controls across: which control filters which query, and on what. */
function Matrix({
  app,
  index,
  onReveal,
}: {
  app: InspectedApp;
  index: number;
  onReveal: (target: RevealTarget) => void;
}) {
  const queries = Object.keys(app.declaration.queries);
  const controls = [...Object.keys(app.declaration.filters), ...Object.keys(app.declaration.dateDrills)];
  const mappings = controlMappings(app);
  const crosses = crossFilters(app);
  if (queries.length === 0) return null;

  const link = (entity: 'query' | 'control', name: string) => (
    <button
      type="button"
      className="font-mono hover:underline"
      onClick={() => onReveal({ entity, app: index, name })}
    >
      {name}
    </button>
  );

  return (
    <div>
      <SectionTitle>Wiring</SectionTitle>
      <div className="mt-1 overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50 text-muted-foreground">
              <th className="sticky left-0 bg-muted px-2 py-1 text-left font-medium">query</th>
              {controls.map((name) => (
                <th key={name} className="px-2 py-1 font-medium whitespace-nowrap">
                  {link('control', name)}
                </th>
              ))}
              <th className="px-2 py-1 text-left font-medium whitespace-nowrap">cross-filtered by</th>
            </tr>
          </thead>
          <tbody>
            {queries.map((query) => {
              const by = crosses.filter((c) => c.to.name === query).map((c) => c.from.name);
              return (
                <tr key={query} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="sticky left-0 bg-background px-2 py-1 whitespace-nowrap">
                    {link('query', query)}
                  </td>
                  {controls.map((control) => {
                    const m = mappings.find((x) => x.from.name === control && x.to.name === query);
                    return (
                      <td key={control} className="px-2 py-1 text-center">
                        {m ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">●</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {m.field}
                              {m.aggregation && ` (${m.aggregation})`}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground/50">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 whitespace-nowrap text-muted-foreground">
                    {by.length ? by.join(', ') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const checkIcon: Record<CheckLevel, ReactNode> = {
  error: <CircleAlert className="mt-px size-3.5 shrink-0 text-destructive" aria-label="error" />,
  warn: <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-500" aria-label="warning" />,
  info: <Info className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-label="info" />,
};

function Checks({
  app,
  index,
  onReveal,
}: {
  app: InspectedApp;
  index: number;
  onReveal: (target: RevealTarget) => void;
}) {
  const checks = wiringChecks(app);
  return (
    <div>
      <SectionTitle>Checks</SectionTitle>
      {checks.length === 0 ? (
        <Note>No issues found.</Note>
      ) : (
        <ul className="mt-1 space-y-px">
          {checks.map((check, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a check's index is how the panel links to it
            <li key={i} data-check={`${index}:${i}`} className="rounded-md">
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-accent',
                  check.level === 'info' && 'text-muted-foreground',
                )}
                onClick={() => onReveal({ entity: check.about.entity, app: index, name: check.about.name })}
              >
                {checkIcon[check.level]}
                <span className="min-w-0 break-words">{check.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Declaration({ app }: { app: InspectedApp }) {
  const code = declarationCode(app);
  return (
    <div>
      <SectionTitle>Declaration</SectionTitle>
      <div className="mt-1">
        <CodeBlock
          tab="js"
          onTab={() => {}}
          className="max-h-96"
          sources={{ js: { label: 'JS', code: code || undefined, lang: 'js', empty: 'Nothing declared.' } }}
        />
      </div>
    </div>
  );
}
