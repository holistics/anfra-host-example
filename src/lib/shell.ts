// This host's own commands, as a host-only plugin: the prompt and versions panels, the command
// palette, the sidebar and its filter. As commands they get the SDK's shortcuts, which a frame
// forwards while focus is in it, and the action bar and palette draw them like any plugin's. Each
// call only tells the page (`onShell`), which owns the state.
import { definePlugin, type MountContext, type Plugin } from '@holistics/anfra-sdk/host';
import { isMac } from './shortcut';

export type ShellAction = 'prompt' | 'versions' | 'palette' | 'sidebar' | 'filter';

/** What the page tells the commands about its own state: whether each panel is open, and the app has a prompt. */
export interface ShellState {
  prompting: boolean;
  versioning: boolean;
  hasPrompt: boolean;
}

const listeners = new Set<(action: ShellAction) => void>();
const mounts = new Set<MountContext>();
let state: ShellState = { prompting: false, versioning: false, hasPrompt: false };

/** Hear each shell command run, from the action bar, the palette or a shortcut. */
export function onShell(listener: (action: ShellAction) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Tell the commands the page's state changed, so they show it. */
export function setShellState(next: ShellState) {
  if (
    next.prompting === state.prompting &&
    next.versioning === state.versioning &&
    next.hasPrompt === state.hasPrompt
  ) {
    return;
  }
  state = next;
  for (const mount of mounts) mount.commandsChanged();
}

/** Commands the page draws in its own place, never in the action bar or the palette's command list. */
export const hiddenCommands = new Set(['shell.palette', 'shell.sidebar', 'shell.filter']);

const mod = isMac ? 'Meta' : 'Ctrl';
const run = (action: ShellAction) => ({ call: `shell.${action}` });

export function shellPlugin(): Plugin {
  const call = (action: ShellAction) => () => {
    for (const listener of listeners) listener(action);
    return null;
  };
  return definePlugin({
    name: 'shell',
    version: '1.0.0',
    host: {
      calls: {
        prompt: call('prompt'),
        versions: call('versions'),
        palette: call('palette'),
        sidebar: call('sidebar'),
        filter: call('filter'),
      },
      mount(mount) {
        mounts.add(mount);
        return () => mounts.delete(mount);
      },
      commands: [
        {
          id: 'versions',
          title: 'Version history',
          icon: 'history',
          placement: 'primary',
          shortcut: 'Alt+Shift+V',
          run: run('versions'),
          state: () => ({ pressed: state.versioning }),
        },
        {
          id: 'prompt',
          title: 'Prompt that made this app',
          icon: 'prompt',
          placement: 'primary',
          shortcut: 'Alt+Shift+P',
          run: run('prompt'),
          state: () =>
            state.hasPrompt ? { pressed: state.prompting } : { disabled: 'No prompt recorded for this app' },
        },
        { id: 'palette', title: 'Command palette', shortcut: `${mod}+K`, run: run('palette') },
        { id: 'sidebar', title: 'Toggle the app browser', shortcut: `${mod}+B`, run: run('sidebar') },
        { id: 'filter', title: 'Filter the apps', shortcut: '/', run: run('filter') },
      ],
    },
  });
}
