/**
 * In-memory progress tracking. No localStorage. Resets on reload.
 * Exposed as window.progressModule for file:// compatibility.
 */
window.progressModule = (function () {
  const completed = new Set();
  const listeners = new Set();

  function toggleComplete(id) {
    if (completed.has(id)) completed.delete(id);
    else completed.add(id);
    notify();
  }

  function isComplete(id) {
    return completed.has(id);
  }

  function getProgress(total) {
    const done = completed.size;
    const pct  = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify() {
    listeners.forEach(fn => fn());
  }

  return { toggleComplete, isComplete, getProgress, subscribe };
})();
