import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildEditPrompt } from './prompt';

const base = {
  app: { label: 'Ecommerce Overview', file: 'apps/dashboards/ecommerce-overview.html' },
  query: 'trend',
  dataset: 'ecommerce',
  from: 'explore { measures { revenue: revenue } }',
  to: 'explore { measures { revenue: revenue, net: net_revenue } }',
  added: [] as string[],
  removed: [] as string[],
};

describe('buildEditPrompt', () => {
  test('a query built at runtime: the AQL from and to, and where to change it', () => {
    const prompt = buildEditPrompt({
      ...base,
      node: {
        key: '0.1',
        kind: 'block',
        id: 'trend',
        label: 'Revenue over time',
        problems: [],
        children: [],
      },
      tier: { tier: 3, reason: 'built while the app runs' },
    });
    assert.match(
      prompt,
      /^Edit the Data App "Ecommerce Overview" \(apps\/dashboards\/ecommerce-overview\.html\)\./,
    );
    assert.match(prompt, /Block: block \[Revenue over time\]\(data-anfra-block="trend"\)/);
    assert.match(prompt, /```aql\nexplore \{ measures \{ revenue: revenue \} \}\n```\nto:/);
    assert.match(prompt, /change the code that builds it/);
  });

  test('a query whose AQL another shares: change only this one', () => {
    const prompt = buildEditPrompt({
      ...base,
      tier: { tier: 4, reason: 'It declares the same AQL as kpis.' },
    });
    assert.match(prompt, /same AQL as kpis\. Change only `trend`\./);
  });

  test('a saved edit that adds a column: no AQL to change, only the drawing', () => {
    const prompt = buildEditPrompt({
      ...base,
      from: base.to,
      tier: { tier: 2, reason: 'written once', file: 'dashboards/ecommerce-overview.html' },
      added: ['net'],
    });
    assert.doesNotMatch(prompt, /Change its AQL/);
    assert.match(prompt, /returns `net`, which the page's code doesn't draw yet\. Show it in this block/);
  });
});
