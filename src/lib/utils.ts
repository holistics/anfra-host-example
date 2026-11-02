import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** The type roles in index.css (`--text-*`): without them, twMerge reads `text-title` as a color and drops it beside `text-weak`. */
const TYPE_ROLES = ['title', 'heading', 'body', 'label', 'caption', 'code'];

const twMerge = extendTailwindMerge<'icon-color'>({
  extend: {
    // The elevation and radius names index.css adds beside Tailwind's own, so `shadow-sm shadow-e2` keeps one.
    theme: { text: TYPE_ROLES, shadow: ['e1', 'e2'], radius: ['pill', 'control', 'card'] },
    // index.css's `icon-*` utility (an icon's color): a later one wins.
    classGroups: { 'icon-color': [{ icon: [() => true] }] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** A copy of `set` with `key` added, or removed if it was there. */
export function toggleIn<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}
