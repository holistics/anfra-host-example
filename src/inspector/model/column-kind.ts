import type { ColumnMeta } from '@holistics/anfra-sdk/common';
import type { MetricDoc, MetricDocs } from './types';

/** What a result column is, in the words the Data tab shows: "Metric · sum", "Dimension · date". */
export function columnKind(column: Pick<ColumnMeta, 'isMeasure' | 'aggregation' | 'semantic_type'>): string {
  return column.isMeasure
    ? `Metric${column.aggregation ? ` · ${column.aggregation}` : ''}`
    : `Dimension · ${column.semantic_type}`;
}

/**
 * What the dataset states of a column: a dataset metric has no model, a model's field is keyed
 * `model.field`. An ad hoc column is the query's own, so the catalog has nothing on it.
 */
export function columnDoc(
  column: Pick<ColumnMeta, 'fieldName' | 'modelId'> & { adhoc?: boolean },
  docs: MetricDocs[string] | undefined,
): MetricDoc | undefined {
  if (column.adhoc) return undefined;
  return docs?.[column.modelId ? `${column.modelId}.${column.fieldName}` : column.fieldName];
}
