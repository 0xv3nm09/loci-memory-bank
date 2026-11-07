/** Shared time-ago formatting — Rewind's dial and the return greeting. */
export function agoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return 'just now';
  }
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }
  const days = Math.round(hours / 24);
  if (days > 30) {
    const weeks = Math.round(days / 7);
    if (weeks <= 8) {
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
