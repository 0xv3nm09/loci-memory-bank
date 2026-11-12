/**
 * Palace-health pill — shows total notes and due-for-review count in the
 * DOM overlay at #palace-health.  Updated every 30 seconds while the app
 * is running.
 */

import { loadPalace, countDue } from './palace-store';

let intervalId: ReturnType<typeof setInterval> | null = null;

function refresh(): void {
  const notesEl = document.getElementById('health-notes');
  const dueEl   = document.getElementById('health-due');
  const pill    = document.getElementById('palace-health');
  if (!notesEl || !dueEl || !pill) return;

  const palace = loadPalace();
  if (!palace) {
    pill.classList.remove('visible');
    return;
  }

  const total = palace.notes.length;
  if (total === 0) {
    pill.classList.remove('visible');
    return;
  }

  const noteIds = palace.notes.map(n => n.id);
  const due = countDue(palace.recall ?? {}, noteIds);

  notesEl.textContent = `${total} note${total !== 1 ? 's' : ''}`;

  if (due > 0) {
    dueEl.textContent = `${due} due`;
    dueEl.className = 'health-val amber';
  } else {
    dueEl.textContent = 'all fresh';
    dueEl.className = 'health-val green';
  }

  pill.classList.add('visible');
}

/** Start the health indicator — call once after the world is ready. */
export function startHealthIndicator(): void {
  refresh();
  intervalId = setInterval(refresh, 30_000);
}

/** Stop updating (optional, for cleanup). */
export function stopHealthIndicator(): void {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
