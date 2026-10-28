import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PermissionError, ValidationError } from '@holistics/anfra-sdk/common';
import { createHost } from '@holistics/anfra-sdk/host';
import { corePlugin } from '@holistics/anfra-sdk/plugins';
import { askAiPlugin, sendTargets } from './plugin';

// No frame is mounted here: the calls are made as the host page.
const host = createHost({
  plugins: [
    corePlugin({} as never),
    askAiPlugin(
      { appOf: () => ({ label: 'A', file: 'apps/a.html' }), copy: async () => true },
      { setup: '' },
    ),
  ],
});

describe('askai', () => {
  it('lists the send targets, each saying why it is off', async () => {
    assert.deepEqual(await host.call('askai.targets'), sendTargets);
    assert.ok(sendTargets.every((target) => target.disabled === 'Disabled by admin'));
  });

  it('refuses to send', async () => {
    await assert.rejects(host.call('askai.send', {}), PermissionError);
  });

  it('refuses to copy a request that is not a comment on a node', async () => {
    await assert.rejects(host.call('askai.copy', { comment: 'x' }), ValidationError);
  });

  it('copies only for a mounted app', async () => {
    const node = { key: '0', kind: 'block', id: 'a', problems: [], children: [] };
    await assert.rejects(
      host.call('askai.copy', { node, ancestors: [], comment: 'x' }),
      /No Data App is open/,
    );
  });

  it('adds Comment on an element, with its shortcut, to the host commands', () => {
    const command = host.commands.find((each) => each.id === 'askai.comment');
    assert.equal(command?.shortcut, 'Alt+Shift+C');
    assert.deepEqual(command?.run, { call: 'askai.comment' });
  });
});
