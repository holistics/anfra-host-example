// What a dataset offers, and which of it a query uses.
import type { ColumnMeta, DatasetDescriptor } from '@holistics/anfra-sdk/common';
import type { ExploreParts } from './aql';

/** A metric or a model field, as a query refers to it: `revenue`, or `orders.status`. */
export interface FieldOption {
  ref: string;
  label: string;
  kind: 'metric' | 'dimension';
  type: string;
  /** The model it belongs to; absent for a dataset metric. */
  model?: string;
}

/** A dataset's metrics, then each model's fields, as the panel lists them. */
export interface FieldGroup {
  name: string;
  label: string;
  options: FieldOption[];
}

/**
 * Every metric of the dataset, then every field of each model. A model's custom measure is a
 * metric. An `id` field, or one ending in `_id`, is left out: a key is not something to chart.
 */
export function fieldGroups(dataset: DatasetDescriptor | undefined): FieldGroup[] {
  if (!dataset) return [];
  const metrics: FieldOption[] = dataset.metrics.map((metric) => ({
    ref: metric.name,
    label: metric.label ?? metric.name,
    kind: 'metric',
    type: metric.type,
  }));
  const models = dataset.data_models.map((model) => ({
    name: model.name,
    label: model.label ?? model.name,
    options: model.fields
      .filter((field) => field.is_custom_measure || !(field.name === 'id' || field.name.endsWith('_id')))
      .map(
        (field): FieldOption => ({
          ref: `${model.name}.${field.name}`,
          label: field.label ?? field.name,
          kind: field.is_custom_measure ? 'metric' : 'dimension',
          type: field.type,
          model: model.name,
        }),
      ),
  }));
  return [{ name: 'metrics', label: 'Metrics', options: metrics }, ...models];
}

/** A bare metric or `model.field`: a measure written as one is a dataset field, anything else is the query's own. */
const BARE_REF = /^[A-Za-z_]\w*(\.[A-Za-z_]\w*)?$/;

/**
 * Whether a column is the query's own expression rather than a dataset field. The SDK says so for
 * most, but an aggregate over a dimension, `count(bq_jobs.creation_time)`, comes back as that
 * field: a measure whose AQL is not a bare ref is one too. A dimension's transform, `date_trunc(…)`,
 * still shows its field.
 */
export function isAdhoc(column: ColumnMeta, parts: ExploreParts | undefined): boolean {
  if (column.adhoc) return true;
  if (!column.isMeasure) return false;
  const expression = parts?.measures.find((entry) => entry.alias === column.name)?.expression;
  return expression !== undefined && !BARE_REF.test(expression);
}

/**
 * The refs a query's columns use. A column names its model as the query does, which can be the
 * model's fqn, so a model is matched by name or by the fqn's last part. Ad hoc columns are not
 * dataset fields and are left out.
 */
export function usedRefs(
  columns: ColumnMeta[],
  dataset: DatasetDescriptor | undefined,
  parts?: ExploreParts,
): Set<string> {
  const used = new Set<string>();
  const modelName = (id: string) =>
    dataset?.data_models.find(
      (model) => model.name === id || String(model.id) === id || id.endsWith(`.${model.name}`),
    )?.name ?? id;
  for (const column of columns) {
    if (isAdhoc(column, parts)) continue;
    used.add(column.modelId ? `${modelName(column.modelId)}.${column.fieldName}` : column.fieldName);
  }
  return used;
}
