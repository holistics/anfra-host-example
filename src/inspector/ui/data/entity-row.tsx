import type { EntityUsage, LocateKind, LocateTarget } from '@holistics/anfra-sdk/common';
import { ChevronRight, LocateFixed } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { entityAttribute, plural } from '../../model/format';
import type { RevealTarget } from '../../model/types';
import { CopyButton } from '../shared/copy-button';

/** What every query and control row takes. */
export interface RowProps {
  entityKey: string;
  open: boolean;
  onToggle: () => void;
  app: number;
  name: string;
  usage: EntityUsage | undefined;
  /** The structure node key of a block this entity is drawn in, to open it in the Structure tab. */
  blockKey: (block: string) => string | undefined;
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
    <div
      data-entity={props.entityKey}
      className={cn('rounded-md border', props.open ? 'bg-muted/50' : 'bg-card')}
    >
      <div className="group flex h-10 items-center gap-2.5 rounded-md pr-2 hover:bg-accent">
        <button
          type="button"
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-3 text-left text-sm"
          onClick={props.onToggle}
          aria-expanded={props.open}
        >
          {summary}
          <ChevronRight
            className={cn(
              'ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform',
              props.open && 'rotate-90',
            )}
          />
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!props.usage}
          title={props.usage ? 'Scroll to it on the page' : `No element is marked ${attribute} yet`}
          aria-label="Locate"
          onClick={() => props.onLocate({ app: props.app, kind, name: props.name })}
        >
          <LocateFixed />
        </Button>
      </div>
      {below}
      {props.open && <div className="space-y-3 px-3 pt-1.5 pb-3">{children}</div>}
    </div>
  );
}

/** Where an entity is drawn on the page, with its handle to copy. */
export function Drawn({
  kind,
  app,
  name,
  usage,
  blockKey,
  onReveal,
}: {
  kind: LocateKind;
  app: number;
  name: string;
  usage?: EntityUsage;
  blockKey: RowProps['blockKey'];
  onReveal: (target: RevealTarget) => void;
}) {
  const text = !usage
    ? 'Not drawn yet'
    : `In ${plural(usage.markers, 'place')}${usage.blocks.length ? ': ' : ', outside any block'}`;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {text}
      {usage?.blocks.map((block, i) => {
        const key = blockKey(block);
        return (
          <Fragment key={block}>
            {i > 0 && ', '}
            {key ? (
              <button
                type="button"
                className="font-mono hover:underline"
                onClick={() => onReveal({ node: key })}
              >
                {block}
              </button>
            ) : (
              block
            )}
          </Fragment>
        );
      })}
      <CopyButton text={entityAttribute(kind, app, name)} label="Copy the handle" className="-my-1" />
    </span>
  );
}
