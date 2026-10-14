import type { EntityUsage, LocateKind, LocateTarget } from '@holistics/anfra-sdk/common';
import { ChevronRight, LocateFixed } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { entityAttribute, plural } from '../../model/format';
import { CopyButton } from '../shared/copy-button';

/** What every query and control row takes. */
export interface RowProps {
  entityKey: string;
  open: boolean;
  onToggle: () => void;
  app: number;
  name: string;
  usage: EntityUsage | undefined;
  onLocate: (target: LocateTarget) => void;
}

/** A row's shell: one clickable line, a locate button, and what shows when it is open. */
export function EntityRow({
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

/** Where an entity is drawn on the page, with its handle to copy. */
export function Drawn({
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
    : `In ${plural(usage.markers, 'place')}${usage.blocks.length ? `: ${usage.blocks.join(', ')}` : ', outside any block'}`;
  return (
    <span className="inline-flex items-center gap-1">
      {text}
      <CopyButton text={entityAttribute(kind, app, name)} label="Copy the handle" className="-my-1 size-5" />
    </span>
  );
}
