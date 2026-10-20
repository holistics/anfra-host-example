import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { codeOf, readsColumn } from './reads';

const TREND =
  'explore { dimensions { period: orders.ordered_at } measures { revenue: revenue, orders: order_count, units_sold: units_sold } }';
const page = `
  const trend = app.createQuery('trend', { dataset: 'ecommerce', aql: \`${TREND}\` });
  function renderTrend () {
    const rows = trend.result.rows;
    bars(rows.map((r) => num(r.revenue)));
    line(rows.map((r) => row['orders']));
    document.getElementById('k-aov').textContent = fmt(currency2, aov);
  }
`;

describe('readsColumn', () => {
  const code = codeOf([{ file: 'app.html', text: page }], [TREND]);

  test('columns the code reads, whichever way', () => {
    assert.equal(readsColumn(code, 'revenue'), true);
    assert.equal(readsColumn(code, 'orders'), true);
  });

  test('a column only the AQL names is not read', () => {
    assert.equal(readsColumn(code, 'units_sold'), false);
  });

  test('a variable or an id that only contains the name is not a read', () => {
    assert.equal(readsColumn(code, 'aov'), false);
  });

  test('taken apart, or indexed by name; a block id is not a read', () => {
    assert.equal(readsColumn('const { units, revenue } = row;', 'units'), true);
    assert.equal(readsColumn('row["units"]', 'units'), true);
    assert.equal(readsColumn('<div data-anfra-block="aov">', 'aov'), false);
  });
});
