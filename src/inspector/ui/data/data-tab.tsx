import type { InspectedApp, InspectedStructure, LocateKind, LocateTarget } from '@holistics/anfra-sdk/common';
import { ChevronRight } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { entityKey, usageOf } from '../../model/format';
import { Note } from '../shared/fields';
import { scrollToAndFlash } from '../shared/reveal';
import { ControlRow } from './control-row';
import { type CodeTab, QueryRow } from './query-row';
import { SelectionCard } from './selection-card';

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
    scrollToAndFlash(`[data-entity="${CSS.escape(focus.key)}"]`);
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
                {app.selection && <SelectionCard label="Current" selection={app.selection} />}
                {app.appliedSelection && <SelectionCard label="Applied" selection={app.appliedSelection} />}
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
