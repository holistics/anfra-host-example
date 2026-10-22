import assert from 'node:assert/strict';
import { test } from 'node:test';
import { columnDoc, columnKind } from './column-kind';

test('a metric names its aggregation, a dimension its type', () => {
  assert.equal(columnKind({ isMeasure: true, aggregation: 'sum', semantic_type: 'number' }), 'Metric · sum');
  assert.equal(columnKind({ isMeasure: true, semantic_type: 'number' }), 'Metric');
  assert.equal(columnKind({ isMeasure: false, semantic_type: 'date' }), 'Dimension · date');
});

test('docs are keyed by model.field, or by field for a dataset metric', () => {
  const docs = { 'orders.status': { label: 'Status' }, revenue: { label: 'Revenue' } };
  assert.equal(columnDoc({ modelId: 'orders', fieldName: 'status' }, docs)?.label, 'Status');
  assert.equal(columnDoc({ fieldName: 'revenue' }, docs)?.label, 'Revenue');
  assert.equal(columnDoc({ adhoc: true, fieldName: 'revenue' }, docs), undefined);
  assert.equal(columnDoc({ fieldName: 'revenue' }, undefined), undefined);
});
