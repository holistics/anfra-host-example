import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import type {
  ColumnMeta,
  InspectedApp,
  InspectedStructure,
  LineageResult,
} from '@holistics/anfra-sdk/common';
import {
  buildLineageGraph,
  filterGraph,
  focusGraph,
  type LineageCatalog,
  type LineageGraph,
  lineagePresets,
  lineageTargets,
  matchPreset,
  orderForLayout,
  pathOf,
  targetKey,
} from './lineage';
import type { ModelTable } from './types';

// What core.lineage answered for ecommerce.revenue, ecommerce.order_count and orders.status.
const answered: LineageResult = JSON.parse(
  readFileSync(new URL('./fixtures/ecommerce-lineage.json', import.meta.url), 'utf8'),
);

const column = (fieldName: string, modelId?: string, extra: Partial<ColumnMeta> = {}): ColumnMeta =>
  ({
    name: fieldName,
    fieldName,
    modelId,
    label: fieldName,
    adhoc: false,
    isMeasure: !modelId,
    ...extra,
  }) as ColumnMeta;

const app = {
  title: 'Sales',
  declaration: {
    queries: {
      revenueByStatus: { dataset: 'ecommerce', aql: '' },
      orders: { dataset: 'ecommerce', aql: '' },
      later: { dataset: 'ecommerce', aql: '' },
    },
    filters: {},
    dateDrills: {},
    mappings: [],
  },
  queries: {
    revenueByStatus: {
      columns: [column('status', 'orders'), column('revenue'), column('x', undefined, { adhoc: true })],
    },
    orders: { columns: [column('order_count')] },
    later: { columns: [] },
  },
} as unknown as InspectedApp;

const structure: InspectedStructure = {
  nodes: [
    {
      key: '0',
      kind: 'block',
      id: 'revenue',
      label: 'Revenue',
      problems: [],
      children: [{ key: '0.0', kind: 'query', app: 0, name: 'revenueByStatus', problems: [], children: [] }],
    },
    { key: '1', kind: 'block', id: 'kpis', problems: [], children: [] },
  ],
  usage: {
    'query:0/orders': { markers: 1, blocks: ['kpis'] },
    'query:0/later': { markers: 1, blocks: ['kpis'] },
  },
};

const model = (fqn: string, table: string): ModelTable => ({
  model: { fqn, name: fqn, label: fqn },
  table,
  dataSource: 'ecommerce_duckdb',
});

const catalog: LineageCatalog = {
  traced: new Map(answered.results.map((r) => [targetKey(r.target), r])),
  tables: {
    orders: model('orders', 'public.orders'),
    order_items: model('order_items', 'public.order_items'),
    products: model('products', 'public.products'),
  },
};

const graph = buildLineageGraph([app], structure, catalog, undefined, { ecommerce: 'E-commerce' });
const ids = (g: LineageGraph) => g.nodes.map((n) => n.id).sort();
const edgeIds = (g: LineageGraph) => g.edges.map((e) => e.id).sort();

describe('lineage', () => {
  test('targets: each field once, ad hoc columns left out', () => {
    assert.deepEqual(lineageTargets([app]), [
      { parent: 'ecommerce', child: 'order_count' },
      { parent: 'ecommerce', child: 'revenue' },
      { parent: 'orders', child: 'status' },
    ]);
  });

  test('a control links to the queries it is mapped to, carrying their fields', () => {
    const withControl = {
      ...app,
      controls: { status: { condition: { values: ['paid'] } }, other: { condition: undefined } },
      declaration: {
        ...app.declaration,
        mappings: [
          {
            kind: 'control',
            from: { kind: 'filter', name: 'status' },
            to: { name: 'orders' },
            field: 'orders.status',
          },
          { kind: 'control', from: { kind: 'filter', name: 'gone' }, to: { name: 'missing' }, field: 'x' },
        ],
      },
    } as unknown as InspectedApp;
    const g = buildLineageGraph([withControl], structure, undefined, undefined);
    assert.equal(g.nodes.find((n) => n.id === 'control:0/status')?.kind, 'control');
    assert.equal(g.nodes.find((n) => n.id === 'control:0/status')?.isSet, true);
    assert.equal(
      g.nodes.some((n) => n.id === 'control:0/gone'),
      false,
    );
    assert.deepEqual(g.edges.find((e) => e.id === 'control:0/status->query:0/orders')?.fields, [
      'metric:ecommerce.order_count',
    ]);
  });

  test('a cross-filter links two queries, active while its source is selected', () => {
    const base = {
      ...app,
      declaration: {
        ...app.declaration,
        mappings: [
          { kind: 'crossFilter', id: 'x1', from: { name: 'orders' }, to: { name: 'orders' } },
          { kind: 'crossFilter', id: 'x2', from: { name: 'orders' }, to: { name: 'missing' } },
        ],
      },
    };
    const idle = buildLineageGraph([base as unknown as InspectedApp], structure, undefined, undefined);
    const edge = idle.edges.find((e) => e.kind === 'crossFilter');
    assert.equal(edge?.id, 'crossFilter:0/x1');
    assert.equal(edge?.active, false);
    assert.equal(idle.edges.filter((e) => e.kind === 'crossFilter').length, 1);

    const applied = { ...base, appliedSelection: { source: 'orders' } } as unknown as InspectedApp;
    const live = buildLineageGraph([applied], structure, undefined, undefined);
    assert.equal(live.edges.find((e) => e.kind === 'crossFilter')?.active, true);

    assert.equal(
      filterGraph(live, new Set(), { crossFilters: false }).edges.some((e) => e.kind === 'crossFilter'),
      false,
    );
    assert.equal(
      filterGraph(live, new Set(['block']), { crossFilters: true }).edges.some(
        (e) => e.kind === 'crossFilter',
      ),
      true,
    );
    assert.equal(
      filterGraph(live, new Set(['query']), { crossFilters: true }).edges.some(
        (e) => e.kind === 'crossFilter',
      ),
      false,
    );
  });

  test('layout order puts cross-filtered queries side by side', () => {
    const q = (id: string) => ({ id, kind: 'query' as const, label: id });
    const e = (source: string, target: string) => ({
      id: `${source}->${target}`,
      source,
      target,
      fields: [],
      kind: 'crossFilter' as const,
    });
    const nodes = [q('a'), q('b'), q('c'), { id: 'm', kind: 'metric' as const, label: 'm' }];
    const order = orderForLayout({ nodes, edges: [e('a', 'c')] }).map((n) => n.id);
    assert.deepEqual(order, ['a', 'c', 'b', 'm']);
    assert.equal(orderForLayout({ nodes, edges: [] }), nodes);
  });

  test('presets match the view they set, and only that', () => {
    for (const p of lineagePresets)
      assert.equal(matchPreset({ hidden: new Set(p.hidden), crossFilters: p.crossFilters })?.id, p.id);
    assert.equal(matchPreset({ hidden: new Set(['table']), crossFilters: false }), undefined);
  });

  test('the page down to its tables, shared models and tables once', () => {
    assert.deepEqual(ids(graph), [
      'block:kpis',
      'block:revenue',
      'dataset:ecommerce',
      'dimension:orders.status',
      'metric:ecommerce.order_count',
      'metric:ecommerce.revenue',
      'model:order_items',
      'model:orders',
      'model:products',
      'query:0/later',
      'query:0/orders',
      'query:0/revenueByStatus',
      'table:ecommerce_duckdb/public.order_items',
      'table:ecommerce_duckdb/public.orders',
      'table:ecommerce_duckdb/public.products',
    ]);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    assert.deepEqual(byId.get('model:orders')?.chips, ['id', 'status']);
    assert.deepEqual(byId.get('model:order_items')?.chips, ['quantity']);
    assert.equal(byId.get('dataset:ecommerce')?.label, 'E-commerce');
    assert.equal(byId.get('block:revenue')?.structureKey, '0');
    assert.equal(byId.get('query:0/revenueByStatus')?.structureKey, '0.0');
  });

  test("a metric's path reaches the models it reads, not every model of its dataset", () => {
    const path = pathOf(graph, 'metric:ecommerce.revenue');
    assert.deepEqual([...path.nodes].sort(), [
      'block:revenue',
      'dataset:ecommerce',
      'metric:ecommerce.revenue',
      'model:order_items',
      'model:products',
      'query:0/revenueByStatus',
      'table:ecommerce_duckdb/public.order_items',
      'table:ecommerce_duckdb/public.products',
    ]);
  });

  test("a model's path goes up through the fields that read it", () => {
    const path = pathOf(graph, 'model:orders');
    assert.deepEqual([...path.nodes].sort(), [
      'block:kpis',
      'block:revenue',
      'dataset:ecommerce',
      'dimension:orders.status',
      'metric:ecommerce.order_count',
      'model:orders',
      'query:0/orders',
      'query:0/revenueByStatus',
      'table:ecommerce_duckdb/public.orders',
    ]);
  });

  test('a query that has not run still links to its block', () => {
    assert.ok(pathOf(graph, 'query:0/later').nodes.has('block:kpis'));
  });

  test('hiding a kind joins across it, keeping what each edge carries', () => {
    const shown = filterGraph(graph, new Set(['query', 'dataset']));
    assert.ok(!ids(shown).some((id) => id.startsWith('query:') || id.startsWith('dataset:')));
    assert.ok(edgeIds(shown).includes('block:revenue->metric:ecommerce.revenue'));
    assert.ok(edgeIds(shown).includes('metric:ecommerce.revenue->model:products'));
    assert.ok(!edgeIds(shown).includes('metric:ecommerce.revenue->model:orders'));
    assert.ok(!edgeIds(shown).includes('block:revenue->metric:ecommerce.order_count'));
  });

  test('focus keeps the node and its path', () => {
    const focused = focusGraph(graph, 'metric:ecommerce.order_count');
    assert.deepEqual(ids(focused), [
      'block:kpis',
      'dataset:ecommerce',
      'metric:ecommerce.order_count',
      'model:orders',
      'query:0/orders',
      'table:ecommerce_duckdb/public.orders',
    ]);
  });

  test('without the catalog, a dimension still reaches its model, a metric stops at its dataset', () => {
    const bare = buildLineageGraph([app], structure, undefined, undefined);
    assert.ok(ids(bare).includes('model:orders'));
    assert.ok(!ids(bare).some((id) => id.startsWith('table:')));
    assert.deepEqual(
      bare.edges.filter((e) => e.source === 'dataset:ecommerce').map((e) => e.target),
      ['model:orders'],
    );
  });
});
