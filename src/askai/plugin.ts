// The Ask AI plugin's host half: it builds the prompt, copies it, says where it may be sent, and
// adds "Comment on an element" to the host's commands. The frame half (./frame.ts) draws the card.
import { PermissionError, ValidationError } from '@holistics/anfra-sdk/common';
import { definePlugin, type FrameHalf, type MountContext, type Plugin } from '@holistics/anfra-sdk/host';
import { buildCommentPrompt, checkComment, type SendTarget } from './model';

export interface AskAiOptions {
  /** The Data App a mount runs: its label, and its definition's file as anfra serves it. */
  appOf: (mount: MountContext) => { label: string; file: string } | undefined;
  /** Put text on the host page's clipboard: whether it took it. */
  copy: (text: string) => Promise<boolean>;
}

/** Why Send can't run: every target is off in this demo, and this host half is what holds it. */
const disabled = 'Disabled by admin';

export const sendTargets: SendTarget[] = [
  { id: 'claude', label: 'Claude', disabled },
  { id: 'chatgpt', label: 'ChatGPT', disabled },
  { id: 'cursor', label: 'Cursor', disabled },
];

export function askAiPlugin(options: AskAiOptions, frame: FrameHalf): Plugin {
  // Whether each mount is in comment mode or has a card open, as its frame reports.
  const active = new WeakMap<MountContext, boolean>();

  const promptFor = (request: unknown, mount: MountContext | undefined) => {
    const comment = checkComment(request);
    if (!comment) throw new ValidationError('A comment needs a node and some text.');
    const app = mount && options.appOf(mount);
    if (!app) throw new ValidationError('No Data App is open.');
    return buildCommentPrompt({ app, ...comment });
  };

  return definePlugin({
    name: 'askai',
    version: '1.0.0',
    host: {
      calls: {
        // A sandboxed frame can't reliably write to the clipboard, so the host page does. The prompt
        // comes back too, for the frame to copy itself when the page isn't focused.
        copy: {
          frame: true,
          handler: async (request, call) => {
            const prompt = promptFor(request, call.mount);
            return { prompt, copied: await options.copy(prompt) };
          },
        },
        targets: { frame: true, handler: () => sendTargets },
        send: {
          frame: true,
          handler: () => {
            throw new PermissionError(disabled);
          },
        },
        // The command's: start or stop comment mode in the frame.
        comment: (_request, call) => call.mount?.call('askai.pick'),
      },
      events: {
        state: (payload) =>
          typeof (payload as { active?: unknown })?.active === 'boolean'
            ? { active: (payload as { active: boolean }).active }
            : undefined,
      },
      mount(mount) {
        const set = (on: boolean) => {
          active.set(mount, on);
          mount.commandsChanged();
        };
        const stops = [
          mount.on('askai.state', ({ active: on }: { active: boolean }) => set(on)),
          // A reloaded document has no card and isn't picking.
          mount.onReady(() => set(false)),
        ];
        return () => {
          for (const stop of stops) stop();
        };
      },
      commands: [
        {
          id: 'comment',
          title: 'Comment on an element',
          icon: 'comment',
          placement: 'primary',
          shortcut: 'Alt+Shift+C',
          run: { call: 'askai.comment' },
          state: ({ mount }) => ({ pressed: active.get(mount) === true }),
        },
      ],
    },
    frame,
  });
}
