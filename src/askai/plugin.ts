// The Ask AI plugin's host half: it builds the prompt, copies it, says where it may be sent, and
// adds "Ask AI" to the host's commands. The frame half (./frame.ts) draws the card.
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
  // Whether each mount is in Ask AI mode or has a card open, as its frame reports.
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
        // The command's: start or stop Ask AI mode in the frame, or close its card.
        toggle: (_request, call) => call.mount?.call('askai.pick'),
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
        // Escape on the host page leaves the mode, or closes the card, as it does in the frame:
        // starting from the toolbar or the palette leaves focus on the page.
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Escape' || event.defaultPrevented || !active.get(mount)) return;
          if (isTyping(event.target)) return;
          event.preventDefault();
          mount.call('askai.pick').catch(() => {});
        };
        mount.document.addEventListener('keydown', onKeyDown);
        const stops = [
          mount.on('askai.state', ({ active: on }: { active: boolean }) => set(on)),
          // A reloaded document has no card and isn't picking.
          mount.onReady(() => set(false)),
        ];
        return () => {
          mount.document.removeEventListener('keydown', onKeyDown);
          for (const stop of stops) stop();
        };
      },
      commands: [
        {
          id: 'ask',
          title: 'Ask AI',
          icon: 'comment',
          placement: 'primary',
          shortcut: 'Alt+Shift+C',
          run: { call: 'askai.toggle' },
          state: ({ mount }) => ({ pressed: active.get(mount) === true }),
        },
      ],
    },
    frame,
  });
}

/** Whether a key went to something that takes text, whose Escape is its own. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName ?? ''));
}
