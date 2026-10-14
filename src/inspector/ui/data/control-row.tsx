import type { DateDrillDeclaration, FilterDeclaration, InspectedControl } from '@holistics/anfra-sdk/common';
import { Fragment } from 'react';
import { formatCondition } from '../../model/format';
import type { controlTargets } from '../../model/inputs';
import type { RevealTarget } from '../../model/types';
import { EntityLink } from '../shared/entity-link';
import { Field, Fields } from '../shared/fields';
import { Drawn, EntityRow, type RowProps } from './entity-row';

export function ControlRow({
  control,
  declaration,
  targets,
  onReveal,
  ...props
}: RowProps & {
  control: InspectedControl;
  declaration: FilterDeclaration | DateDrillDeclaration | undefined;
  /** The queries it is mapped to. */
  targets: ReturnType<typeof controlTargets>;
  onReveal: (target: RevealTarget) => void;
}) {
  const summary = (
    <>
      <span className="shrink-0 font-medium">{props.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {control.condition.values?.length ? formatCondition(control.condition) : 'not set'}
      </span>
      {control.isDirty && (
        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">unapplied</span>
      )}
    </>
  );
  const filter = declaration && 'field' in declaration ? declaration : undefined;
  const fallback = declaration?.default;
  const fixed = filter?.options;

  return (
    <EntityRow kind="control" summary={summary} {...props}>
      <Fields>
        <Field label="Kind">
          {control.kind === 'dateDrill' ? 'Date drill' : 'Filter'}
          {filter?.field && <span className="text-muted-foreground"> on {filter.field}</span>}
          {filter?.type && <span className="text-muted-foreground"> · {filter.type}</span>}
        </Field>
        {declaration?.label && <Field label="Label">{declaration.label}</Field>}
        <Field label="Set to">{formatCondition(control.condition)}</Field>
        <Field label="Applied">{formatCondition(control.appliedCondition)}</Field>
        {fallback && (
          <Field label="Default">{typeof fallback === 'string' ? fallback : formatCondition(fallback)}</Field>
        )}
        {fixed ? (
          <Field label="Options">
            {fixed.length} fixed: {fixed.join(', ')}
          </Field>
        ) : control.options ? (
          <Field label="Options">
            {control.options.length} loaded: {control.options.join(', ')}
          </Field>
        ) : (
          control.kind === 'filter' && <Field label="Options">not loaded</Field>
        )}
        <Field label="Maps to">
          {targets.length === 0 ? (
            <span className="text-amber-600 dark:text-amber-400">no query</span>
          ) : (
            targets.map((target, i) => (
              <Fragment key={target.query}>
                {i > 0 && ', '}
                <EntityLink entity="query" app={props.app} name={target.query} onReveal={onReveal} />
                <span className="text-muted-foreground"> on {target.field}</span>
              </Fragment>
            ))
          )}
        </Field>
        <Field label="Drawn">
          <Drawn
            kind="control"
            app={props.app}
            name={props.name}
            usage={props.usage}
            blockKey={props.blockKey}
            onReveal={onReveal}
          />
        </Field>
      </Fields>
    </EntityRow>
  );
}
