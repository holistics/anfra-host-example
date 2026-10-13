import type { InspectedControl } from '@holistics/anfra-sdk/common';
import { formatCondition } from '../../model/format';
import { Field, Fields } from '../shared/fields';
import { Drawn, EntityRow, type RowProps } from './entity-row';

export function ControlRow({ control, ...props }: RowProps & { control: InspectedControl }) {
  const summary = (
    <>
      <span className="shrink-0 font-medium">{props.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {control.condition.values?.length ? formatCondition(control.condition) : 'not set'}
      </span>
      {control.isDirty && (
        <span className="ml-auto shrink-0 text-xs text-amber-600 dark:text-amber-400">unapplied</span>
      )}
    </>
  );
  return (
    <EntityRow kind="control" summary={summary} {...props}>
      <Fields>
        <Field label="Kind">{control.kind === 'dateDrill' ? 'Date drill' : 'Filter'}</Field>
        <Field label="Set to">{formatCondition(control.condition)}</Field>
        <Field label="Applied">{formatCondition(control.appliedCondition)}</Field>
        {control.options && <Field label="Options">{control.options.join(', ')}</Field>}
        <Field label="Drawn">
          <Drawn kind="control" app={props.app} name={props.name} usage={props.usage} />
        </Field>
      </Fields>
    </EntityRow>
  );
}
