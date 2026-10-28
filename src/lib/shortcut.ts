/** Whether the reader is on a Mac, whose keyboards say ⌘ where others say Ctrl. */
export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

/** The modifier the host's shortcuts use, as the reader's keyboard labels it. */
export const modKey = isMac ? '⌘' : 'Ctrl';

/** The Alt key, as the reader's keyboard labels it. */
export const altKey = isMac ? '⌥' : 'Alt';

/** The Shift key, as the reader's keyboard labels it. */
export const shiftKey = isMac ? '⇧' : 'Shift';

/** A command's shortcut, `Alt+Shift+I`, as the keys to show: `⌥ ⇧ I` on a Mac. */
export function shortcutKeys(shortcut: string): string[] {
  const names: Record<string, string> = {
    ctrl: 'Ctrl',
    alt: altKey,
    shift: shiftKey,
    meta: isMac ? '⌘' : 'Meta',
  };
  return shortcut.split('+').map((part) => names[part.trim().toLowerCase()] ?? part.trim().toUpperCase());
}
