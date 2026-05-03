/**
 * Tab switching for topic pages.
 * Keyboard: 1-4 while focused inside article switches to that tab.
 * Exposed as window.tabsModule for file:// compatibility.
 */
window.tabsModule = (function () {

  function initTabs(articleEl, topicId, activeTabName) {
    articleEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(articleEl, btn.dataset.tab, topicId));
    });

    articleEl.addEventListener('keydown', e => {
      if (['1', '2', '3', '4'].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const names = ['concept', 'code', 'hands-on', 'self-check'];
        const name  = names[parseInt(e.key, 10) - 1];
        if (name) switchTab(articleEl, name, topicId);
      }
    });

    wireSelfCheckReveals(articleEl);
  }

  function switchTab(articleEl, tabName, topicId) {
    articleEl.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    articleEl.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('is-active', panel.dataset.panel === tabName);
    });

    history.replaceState(null, '', `#${topicId}/${tabName}`);
  }

  function wireSelfCheckReveals(articleEl) {
    articleEl.querySelectorAll('.btn-reveal').forEach(btn => {
      btn.addEventListener('click', () => {
        const answer = btn.closest('.self-check-item').querySelector('.self-check-answer');
        const open   = answer.classList.toggle('is-visible');
        btn.textContent = open ? 'Hide' : 'Show answer';
        btn.classList.toggle('is-open', open);
      });
    });
  }

  return { initTabs, switchTab };
})();
