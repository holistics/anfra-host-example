import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ColumnMeta, DatasetDescriptor, InspectedStructure } from '@holistics/anfra-sdk/common';
import { parseExplore } from './aql';
import { queriesOfNode } from './block';
import { fieldGroups, isAdhoc, usedRefs } from './fields';
import { localScripts, tierOf } from './tier';

// The trend query of anfra-demo-data's dashboards/ecommerce-overview.html, as declared.
const TREND = `explore {
        dimensions { period: orders.ordered_at }
        measures { revenue: revenue, orders: order_count }
        sorts { period asc }
      }`;

describe('parseExplore', () => {
  test('reads each section, aliases and all', () => {
    assert.deepEqual(parseExplore(TREND), {
      dimensions: [{ alias: 'period', expression: 'orders.ordered_at' }],
      measures: [
        { alias: 'revenue', expression: 'revenue' },
        { alias: 'orders', expression: 'order_count' },
      ],
      filters: [],
      sorts: [{ expression: 'period asc' }],
    });
  });

  test('keeps a call with commas in it whole, and filters unsplit at their colons', () => {
    const parts = parseExplore(`explore {
      measures { buyers: count_distinct(customers.id), share: revenue / of_all(revenue, products.category) }
      filters { orders.ordered_at matches @(last 12 months) // the window
        orders.status == 'completed' }
    }`);
    assert.deepEqual(parts?.measures, [
      { alias: 'buyers', expression: 'count_distinct(customers.id)' },
      { alias: 'share', expression: 'revenue / of_all(revenue, products.category)' },
    ]);
    assert.deepEqual(parts?.filters, [
      { expression: 'orders.ordered_at matches @(last 12 months)' },
      { expression: "orders.status == 'completed'" },
    ]);
  });

  test('is undefined for anything that is not an explore', () => {
    assert.equal(parseExplore('orders | count()'), undefined);
    assert.equal(parseExplore(undefined), undefined);
  });
});

describe('tierOf', () => {
  const html = (body: string) => ({ file: 'dashboards/app.html', text: body });

  test('1: named in the manifest', () => {
    const source = html(`<script type="application/json" id="anfra-queries">{"trend":{"aql":"x"}}</script>`);
    assert.equal(tierOf('trend', TREND, [source], { trend: TREND }).tier, 1);
  });

  test('2: the AQL written once, in whichever file', () => {
    const result = tierOf(
      'trend',
      TREND,
      [html('<html>'), { file: 'shared.js', text: `aql: \`${TREND}\`` }],
      {
        trend: TREND,
      },
    );
    assert.equal(result.tier, 2);
    assert.equal(result.file, 'shared.js');
  });

  test('3: built at runtime', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the app's source text, placeholder and all
    assert.equal(tierOf('trend', TREND, [html('aql: `explore { ${dims} }`')], { trend: TREND }).tier, 3);
  });

  test('4: another query declares the same AQL', () => {
    const result = tierOf('a', TREND, [html('')], { a: TREND, b: TREND });
    assert.equal(result.tier, 4);
    assert.match(result.reason, /as b\b/);
  });
});

describe('localScripts', () => {
  test('resolves relative scripts and drops remote ones', () => {
    const page = `<script src="https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js"></script>
      <script src="shared.js"></script><script src="../_lib/inspector.js?v=1"></script>`;
    assert.deepEqual(localScripts(page, 'football-predictions'), [
      'football-predictions/shared.js',
      '_lib/inspector.js',
    ]);
  });
});

describe('queriesOfNode', () => {
  const node = (over: Partial<InspectedStructure['nodes'][number]>) => ({
    key: '',
    kind: 'block' as const,
    problems: [],
    children: [],
    ...over,
  });
  const structure: InspectedStructure = {
    nodes: [
      node({
        key: '0',
        kind: 'container',
        id: 'page',
        children: [
          node({
            key: '0.0',
            id: 'trend',
            children: [node({ key: '0.0.0', kind: 'query', app: 0, name: 'trend' })],
          }),
          node({ key: '0.1', id: 'kpis' }),
        ],
      }),
    ],
    usage: {
      'query:0/trend': { markers: 1, blocks: ['trend'] },
      'query:0/kpis': { markers: 5, blocks: ['kpis'] },
    },
  };

  test('the query nodes under a node', () => {
    assert.deepEqual(queriesOfNode(structure, '0.0'), [{ app: 0, name: 'trend' }]);
  });

  test('a block without query nodes falls back to the usage', () => {
    assert.deepEqual(queriesOfNode(structure, '0.1'), [{ app: 0, name: 'kpis' }]);
  });
});

describe('fields', () => {
  const dataset: DatasetDescriptor = {
    id: 'ecommerce',
    name: 'ecommerce',
    data_models: [
      {
        id: 'orders',
        name: 'orders',
        fields: [
          { name: 'id', type: 'number', is_custom_measure: false },
          { name: 'customer_id', type: 'number', is_custom_measure: false },
          { name: 'ordered_at', type: 'date', is_custom_measure: false },
          { name: 'status', type: 'text', is_custom_measure: false },
        ],
      },
    ],
    metrics: [{ name: 'revenue', label: 'Revenue', type: 'number' }],
  };

  test('metrics first, then each model without its keys', () => {
    const groups = fieldGroups(dataset);
    assert.deepEqual(
      groups.map((g) => g.options.map((o) => o.ref)),
      [['revenue'], ['orders.ordered_at', 'orders.status']],
    );
  });

  test('a column names its field by model and name, or a metric by name; ad hoc ones are skipped', () => {
    const column = (over: Partial<ColumnMeta>) => over as ColumnMeta;
    const used = usedRefs(
      [
        column({ fieldName: 'revenue', adhoc: false, isMeasure: true }),
        column({ fieldName: 'ordered_at', modelId: 'demo.orders', adhoc: false, isMeasure: false }),
        column({ fieldName: 'buyers', adhoc: true, isMeasure: true }),
      ],
      dataset,
    );
    assert.deepEqual([...used], ['revenue', 'orders.ordered_at']);
  });

  test('an aggregate over a dimension is ad hoc, though the SDK reports its field', () => {
    const rowCount = {
      name: 'row_count',
      fieldName: 'ordered_at',
      modelId: 'orders',
      adhoc: false,
      isMeasure: true,
    } as ColumnMeta;
    const parts = parseExplore('explore { measures { m0: revenue, row_count: count(orders.ordered_at) } }');
    assert.equal(isAdhoc(rowCount, parts), true);
    assert.deepEqual([...usedRefs([rowCount], dataset, parts)], []);
  });
});
