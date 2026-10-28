import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StructureNode } from '@holistics/anfra-sdk/common';
import { buildCommentPrompt, checkComment, handleFor, nameOf } from './model';

const node = (fields: Partial<StructureNode> & Pick<StructureNode, 'kind'>): StructureNode => ({
  key: '0',
  problems: [],
  children: [],
  ...fields,
});

const revenue = node({ key: '0.0', kind: 'block', id: 'revenue', label: 'Revenue by month' });
const kpis = node({ kind: 'container', id: 'kpis', label: 'KPIs' });

describe('handleFor', () => {
  it('links the label to the attribute, or gives the attribute alone', () => {
    assert.equal(handleFor(revenue), '[Revenue by month](data-anfra-block="revenue")');
    assert.equal(handleFor(node({ kind: 'query', name: 'sales', app: 1 })), 'data-anfra-query="1/sales"');
    assert.equal(handleFor(node({ kind: 'control', name: 'region', app: 0 })), 'data-anfra-control="region"');
  });
});

describe('nameOf', () => {
  it('prefers the label, then the id or name', () => {
    assert.equal(nameOf(revenue), 'Revenue by month');
    assert.equal(nameOf(node({ kind: 'block', id: 'river' })), 'river');
    assert.equal(nameOf(node({ kind: 'query', name: 'sales', app: 2 })), '2/sales');
  });
});

describe('buildCommentPrompt', () => {
  it('says the app, the node, where it sits, its problems and the comment', () => {
    const prompt = buildCommentPrompt({
      app: { label: 'Sales Overview', file: 'apps/sales/overview.html' },
      node: { ...revenue, problems: ['Block "revenue" has no label.'] },
      ancestors: [kpis],
      comment: '  The y axis should start at zero.\n',
    });
    assert.equal(
      prompt,
      [
        'Comment on the Data App "Sales Overview" (apps/sales/overview.html).',
        '',
        'Element: block [Revenue by month](data-anfra-block="revenue")',
        'Inside: container [KPIs](data-anfra-container="kpis")',
        '',
        'Markup problems:',
        '- Block "revenue" has no label.',
        '',
        'Comment:',
        'The y axis should start at zero.',
      ].join('\n'),
    );
  });

  it('leaves out where a top-level node sits, and problems it has none of', () => {
    const prompt = buildCommentPrompt({
      app: { label: 'A', file: 'apps/a.html' },
      node: kpis,
      ancestors: [],
      comment: 'x',
    });
    assert.ok(!prompt.includes('Inside:'));
    assert.ok(!prompt.includes('Markup problems'));
  });
});

describe('checkComment', () => {
  it('takes a node, its ancestors and some text', () => {
    const request = { node: revenue, ancestors: [kpis], comment: 'Start at zero' };
    assert.deepEqual(checkComment(request), request);
  });

  it('refuses anything else the frame sends', () => {
    for (const request of [
      undefined,
      'comment',
      { node: revenue, ancestors: [], comment: '   ' },
      { node: revenue, ancestors: [], comment: 'x'.repeat(10_001) },
      { node: { ...revenue, kind: 'script' }, ancestors: [], comment: 'x' },
      { node: { ...revenue, problems: [1] }, ancestors: [], comment: 'x' },
      { node: revenue, ancestors: [{}], comment: 'x' },
      { node: revenue, ancestors: 'none', comment: 'x' },
    ]) {
      assert.equal(checkComment(request), undefined, JSON.stringify(request));
    }
  });
});
