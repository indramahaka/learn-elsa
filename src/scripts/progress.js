/**
 * In-memory progress tracking. No localStorage. Resets on reload.
 */

const completed = new Set();
const listeners = new Set();

export function toggleComplete(id) {
  if (completed.has(id)) completed.delete(id);
  else completed.add(id);
  notify();
}

export function isComplete(id) {
  return completed.has(id);
}

export function getProgress(total) {
  const done = completed.size;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => fn());
}
