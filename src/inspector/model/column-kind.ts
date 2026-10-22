import type { ColumnMeta } from '@holistics/anfra-sdk/common';
import type { MetricDoc, MetricDocs } from './types';

/** What a result column is, in the words the inspector shows: "Metric · sum", "Dimension · date". */
export function columnKind(column: Pick<ColumnMeta, 'isMeasure' | 'aggregation' | 'semantic_type'>): string {
  return column.isMeasure
    ? `Metric${column.aggregation ? ` · ${column.aggregation}` : ''}`
    : `Dimension · ${column.semantic_type}`;
}

/** How the catalog keys a column's field: a dataset metric has no model, a model's field is `model.field`. */
export function fieldKey(column: Pick<ColumnMeta, 'fieldName' | 'modelId'>): string {
  return column.modelId ? `${column.modelId}.${column.fieldName}` : column.fieldName;
}

/** What the dataset states of a column. An ad hoc column is the query's own, so the catalog has nothing on it. */
export function columnDoc(
  column: Pick<ColumnMeta, 'fieldName' | 'modelId'> & { adhoc?: boolean },
  docs: MetricDocs[string] | undefined,
): MetricDoc | undefined {
  if (column.adhoc) return undefined;
  return docs?.[fieldKey(column)];
}
