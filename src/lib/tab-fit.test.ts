import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitTabs } from './tab-fit';

const tabs = ['a', 'b', 'c', 'd'].map((id) => ({ id, width: 50 }));

describe('fitTabs', () => {
  it('shows every tab when they all fit', () => {
    assert.deepEqual(fitTabs(tabs, 206, 2, 30), { shown: ['a', 'b', 'c', 'd'], more: [] });
  });

  it('keeps room for More, and shows the tabs that fit in order', () => {
    assert.deepEqual(fitTabs(tabs, 150, 2, 30), { shown: ['a', 'b'], more: ['c', 'd'] });
  });

  it('always shows the selected tab, in its place', () => {
    assert.deepEqual(fitTabs(tabs, 150, 2, 30, 'd'), { shown: ['a', 'd'], more: ['b', 'c'] });
  });
});
