import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { InspectedApp } from '@holistics/anfra-sdk/common';
import { parseExplore, writeExplore } from './aql';
import {
  addField,
  addFilter,
  conditionText,
  keepAliases,
  removeField,
  setSorts,
  sortsOf,
  swapMeasure,
} from './draft';
import { encodeLike, replaceOnce } from './preview';
import { draftWarnings } from './warnings';

// anfra-demo-data's dashboards/ecommerce-overview.html, as declared.
const BY_COUNTRY = `explore {
        dimensions { country: customers.country }
        measures { revenue: revenue }
        sorts { revenue desc }
      }`;
const KPIS = 'explore { measures { revenue: revenue, orders: order_count } }';
const MULTI = `explore {
  measures {
    m0: job_count,
    m1: tib_billed
  }
}`;

const parts = (aql: string) => {
  const read = parseExplore(aql);
  assert.ok(read);
  return read;
};

describe('writeExplore', () => {
  test('a section written on one line stays on one line; the others keep their text', () => {
    const draft = addFilter(parts(BY_COUNTRY), "orders.status == 'completed'");
    assert.equal(
      writeExplore(BY_COUNTRY, swapMeasure(draft, 'revenue', 'net_revenue')),
      `explore {
        dimensions { country: customers.country }
        measures { revenue: net_revenue }
        sorts { revenue desc }
        filters { orders.status == 'completed' }
      }`,
    );
  });

  test('a section written one entry per line stays that way', () => {
    const draft = addField(parts(MULTI), { ref: 'slot_hours', label: '', kind: 'metric', type: 'number' });
    assert.equal(
      writeExplore(MULTI, draft),
      `explore {
  measures {
    m0: job_count,
    m1: tib_billed,
    slot_hours: slot_hours
  }
}`,
    );
  });

  test('an explore on one line gets new sections on that line, and an emptied one goes', () => {
    const withSort = setSorts(parts(KPIS), [{ alias: 'revenue', direction: 'desc' }]);
    assert.equal(
      writeExplore(KPIS, withSort),
      'explore { measures { revenue: revenue, orders: order_count } sorts { revenue desc } }',
    );
    const noSorts = setSorts(parts(BY_COUNTRY), []);
    assert.equal(writeExplore(BY_COUNTRY, noSorts).includes('sorts'), false);
    assert.equal(writeExplore(BY_COUNTRY, noSorts).split('\n').length, BY_COUNTRY.split('\n').length - 1);
  });

  test('nothing changed is the same text, comments and all', () => {
    const commented = 'explore {\n  // the headline\n  measures { revenue: revenue }\n}';
    assert.equal(writeExplore(commented, parts(commented)), commented);
  });

  test('each write reads back as the draft', () => {
    const draft = addFilter(removeField(parts(BY_COUNTRY), 'customers.country'), 'orders.amount > 10');
    assert.deepEqual(parseExplore(writeExplore(BY_COUNTRY, draft)), draft);
  });
});

describe('draft', () => {
  test('a new field gets a unique alias', () => {
    const draft = addField(parts(KPIS), { ref: 'orders.revenue', label: '', kind: 'metric', type: 'number' });
    assert.deepEqual(draft.measures.at(-1), { alias: 'revenue_2', expression: 'orders.revenue' });
  });

  test('unticking a field takes the dimensions built on it, and the sorts on them', () => {
    const trend = parts(
      'explore { dimensions { period: date_trunc(orders.ordered_at, "month") } measures { revenue: revenue } sorts { period asc } }',
    );
    const draft = removeField(trend, 'orders.ordered_at');
    assert.deepEqual(draft.dimensions, []);
    assert.deepEqual(draft.sorts, []);
    assert.equal(removeField(trend, 'orders.ordered').dimensions.length, 1);
  });

  test('conditions as AQL', () => {
    assert.equal(conditionText('orders.status', 'text', '==', 'completed'), "orders.status == 'completed'");
    assert.equal(conditionText('orders.amount', 'number', '>', '10'), 'orders.amount > 10');
    assert.equal(
      conditionText('orders.ordered_at', 'date', '>=', '2026-01-01'),
      'orders.ordered_at >= @2026-01-01',
    );
    assert.equal(
      conditionText('customers.name', 'text', 'contains', "O'Brien"),
      "customers.name like '%O\\'Brien%'",
    );
  });

  test('sorts read back as alias and direction', () => {
    assert.deepEqual(sortsOf(parts(BY_COUNTRY)), [{ alias: 'revenue', direction: 'desc' }]);
  });
});

describe('draftWarnings', () => {
  const app = {
    declaration: {
      queries: {},
      filters: {},
      dateDrills: { grain: {} },
      mappings: [
        {
          kind: 'crossFilter',
          id: 'x',
          from: { kind: 'query', name: 'byCountry' },
          to: { kind: 'query', name: 'kpis' },
        },
        {
          kind: 'control',
          id: 'g',
          from: { kind: 'dateDrill', name: 'grain' },
          to: { kind: 'query', name: 'byCountry' },
          field: 'customers.country',
        },
      ],
    },
  } as unknown as InspectedApp;

  test('a removed column, a broken cross-filter and an orphaned grain control', () => {
    const draft = removeField(parts(BY_COUNTRY), 'customers.country');
    const messages = draftWarnings(app, 'byCountry', parts(BY_COUNTRY), draft).map((w) => w.message);
    assert.equal(messages.length, 3);
    assert.match(messages[0] ?? '', /`country`/);
    assert.match(messages[1] ?? '', /filters `kpis`/);
    assert.match(messages[2] ?? '', /grain control/);
  });

  test('a swap that keeps its alias warns of nothing', () => {
    const draft = swapMeasure(parts(BY_COUNTRY), 'revenue', 'net_revenue');
    assert.deepEqual(draftWarnings(app, 'byCountry', parts(BY_COUNTRY), draft), []);
  });
});

describe('preview', () => {
  test('a draft is written as its string was: escaped in a template literal', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: AQL text with a placeholder in it, on purpose
    assert.equal(encodeLike('aql: `x`', 6, 'a `b` ${c}'), 'a \\`b\\` \\${c}');
    assert.equal(encodeLike("aql: 'x'", 6, "it's\nhere"), "it\\'s\\nhere");
  });
});

describe('replaceOnce', () => {
  test('replaces the one occurrence, escaped as its string was; refuses none or several', () => {
    assert.equal(replaceOnce('q = `a`', 'a', 'b`'), 'q = `b\\``');
    assert.equal(replaceOnce('a a', 'a', 'b'), undefined);
    assert.equal(replaceOnce('x', 'a', 'b'), undefined);
  });
});

describe('keepAliases', () => {
  test('untick one measure and tick another, in either order: the new one takes the old name', () => {
    const base = parts(BY_COUNTRY);
    const option = { ref: 'net_revenue', label: '', kind: 'metric' as const, type: 'number' };
    const untickFirst = keepAliases(base, addField(removeField(base, 'revenue'), option));
    const tickFirst = keepAliases(base, removeField(addField(base, option), 'revenue'));
    for (const draft of [untickFirst, tickFirst]) {
      assert.deepEqual(draft.measures, [{ alias: 'revenue', expression: 'net_revenue' }]);
      assert.deepEqual(draft.sorts, [{ expression: 'revenue desc' }]);
    }
  });

  test('a removal with nothing added keeps its warning', () => {
    const base = parts(BY_COUNTRY);
    assert.deepEqual(keepAliases(base, removeField(base, 'revenue')).measures, []);
  });
});
