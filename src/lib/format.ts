/** How long ago a time was, shortly: `< 1m ago`, `5m ago`, `3h ago`, `2d ago`. */
export function formatAgo(value: Date | string | undefined, now: number = Date.now()): string {
  if (!value) return '';
  const time = (value instanceof Date ? value : new Date(value)).getTime();
  if (Number.isNaN(time)) return String(value);
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return '< 1m ago';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
