/* Globals set by topics.js, progress.js, tabs.js loaded before this script */
const topics = window.topics;
const { toggleComplete, isComplete, getProgress, subscribe } = window.progressModule;
const { initTabs } = window.tabsModule;

/* Safe Lucide wrapper — createIcons() can throw cross-origin errors on file:// */
function createIcons() {
  try { createIcons(); } catch (e) { /* icons won't render but app still works */ }
}

/* ---- Element refs ---- */
const hamburgerBtn   = document.getElementById('hamburgerBtn');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const searchInput    = document.getElementById('searchInput');
const otpList        = document.getElementById('otpList');
const mainContent    = document.getElementById('mainContent');
const progressBar    = document.getElementById('progressBar');
const progressText   = document.getElementById('progressText');

/* Snapshot welcome HTML before any navigation */
const welcomeHtml = mainContent.innerHTML;

let currentTopicId  = null;
let headingObserver = null;


/* ============================================================
   SIDEBAR POPULATION
   ============================================================ */
function populateSidebar() {
  const listIds = {
    1:    'nav-tier1-list',
    2:    'nav-tier2-list',
    3:    'nav-tier3-list',
    labs: 'nav-labs-list',
  };

  topics.forEach(topic => {
    const listEl = document.getElementById(listIds[topic.tier]);
    if (!listEl) return;

    const li = document.createElement('li');
    li.className = 'nav-topic-item';

    const a = document.createElement('a');
    a.href           = `#${topic.id}`;
    a.className      = 'nav-topic-link';
    a.dataset.topicId = topic.id;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', 'circle');
    icon.className = 'completion-icon';
    icon.setAttribute('aria-hidden', 'true');

    a.appendChild(icon);
    a.appendChild(document.createTextNode(' ' + topic.title));
    li.appendChild(a);
    listEl.appendChild(li);
  });
}


/* ============================================================
   UTILITIES
   ============================================================ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ============================================================
   CONTENT RENDERERS
   ============================================================ */
function renderCodePanel(blocks) {
  if (!blocks || blocks.length === 0) {
    return '<p style="color:var(--c-text-3);font-style:italic;padding:var(--sp-4) 0;">No code samples for this topic yet.</p>';
  }

  return blocks.map(block => `
    <div class="code-block">
      <div class="code-block-header">
        <span class="code-block-lang">${escapeHtml(block.language)}</span>
        ${block.filename
          ? `<span class="code-block-filename">${escapeHtml(block.filename)}</span>`
          : `<span></span>`}
        <button class="btn-copy" type="button" aria-label="Copy code to clipboard">
          <i data-lucide="copy" aria-hidden="true"></i>
          <span>Copy</span>
        </button>
      </div>
      ${block.title
        ? `<p style="font-size:0.875rem;font-weight:600;color:var(--c-text-2);padding:var(--sp-3) var(--sp-4) 0;margin:0;">${escapeHtml(block.title)}</p>`
        : ''}
      <pre class="language-${block.language}"><code class="language-${block.language}">${escapeHtml(block.code)}</code></pre>
      ${block.explanation
        ? `<p class="code-explanation">${block.explanation}</p>`
        : ''}
    </div>
  `).join('');
}

function renderHandsOnPanel(handsOn) {
  if (!handsOn) {
    return '<p style="color:var(--c-text-3);font-style:italic;padding:var(--sp-4) 0;">No hands-on exercise for this topic yet.</p>';
  }

  const stepsHtml   = (handsOn.steps        || []).map(s  => `<li>${s}</li>`).join('');
  const verifyHtml  = (handsOn.verification  || []).map(v  => `<li>${v}</li>`).join('');
  const pitfallsHtml = (handsOn.pitfalls     || []).map(p  => `<li>${p}</li>`).join('');

  return `
    ${handsOn.goal ? `<div class="lab-goal"><strong>Goal:</strong> ${handsOn.goal}</div>` : ''}
    ${stepsHtml   ? `<p class="lab-section-title">Steps</p><ol class="lab-steps">${stepsHtml}</ol>` : ''}
    ${verifyHtml  ? `<p class="lab-section-title">Verify it worked</p><ul class="lab-checklist">${verifyHtml}</ul>` : ''}
    ${pitfallsHtml ? `<p class="lab-section-title">Common pitfalls</p><ul class="pitfall-list">${pitfallsHtml}</ul>` : ''}
  `;
}

function renderSelfCheckPanel(items) {
  if (!items || items.length === 0) {
    return '<p style="color:var(--c-text-3);font-style:italic;padding:var(--sp-4) 0;">No self-check questions for this topic yet.</p>';
  }

  return `<ol class="self-check-list" style="list-style:none;padding:0;">` +
    items.map(item => `
      <li class="self-check-item">
        <div class="self-check-q">
          <p class="self-check-question-text">${item.question}</p>
          <button class="btn-reveal" type="button">Show answer</button>
        </div>
        <div class="self-check-answer">${item.answer}</div>
      </li>
    `).join('') +
  `</ol>`;
}


/* ============================================================
   BUILD TOPIC ARTICLE HTML
   ============================================================ */
function buildTopicHtml(topic, activeTab) {
  const tierLabel = topic.tier === 'labs' ? 'LAB' : `T${topic.tier}`;
  const tierClass = topic.tier === 'labs' ? 'tier-labs' : `tier-${topic.tier}`;

  const prereqHtml = (topic.prerequisites || []).length > 0
    ? `<div class="prereq-list">
         <span class="prereq-label">Requires:</span>
         ${topic.prerequisites.map(pid => {
           const pre = topics.find(t => t.id === pid);
           return `<a href="#${pid}" class="prereq-chip">${pre ? escapeHtml(pre.title) : pid}</a>`;
         }).join('')}
       </div>`
    : '';

  const idx  = topics.findIndex(t => t.id === topic.id);
  const prev = topics[idx - 1];
  const next = topics[idx + 1];

  const prevHtml = prev
    ? `<a href="#${prev.id}" class="btn-nav">
         <i data-lucide="arrow-left" aria-hidden="true"></i>
         <span>${escapeHtml(prev.title)}</span>
       </a>`
    : '';

  const nextHtml = next
    ? `<a href="#${next.id}" class="btn-nav btn-nav-next">
         <span>${escapeHtml(next.title)}</span>
         <i data-lucide="arrow-right" aria-hidden="true"></i>
       </a>`
    : '';

  const done = isComplete(topic.id);

  const tabDefs = [
    { id: 'concept',    label: 'Concept'    },
    { id: 'code',       label: 'Code'       },
    { id: 'hands-on',   label: 'Hands-On'   },
    { id: 'self-check', label: 'Self-Check' },
  ];

  const tabBtns = tabDefs.map(t => `
    <button class="tab-btn${t.id === activeTab ? ' is-active' : ''}"
            type="button"
            role="tab"
            data-tab="${t.id}"
            aria-selected="${t.id === activeTab}">${t.label}</button>
  `).join('');

  return `
<article class="topic-article" id="${topic.id}" data-topic-id="${topic.id}">

  <div class="topic-hero">
    <div class="topic-hero-eyebrow">
      <span class="tier-badge ${tierClass}">${tierLabel}</span>
      <span class="topic-time">
        <i data-lucide="clock" aria-hidden="true"></i>
        ${topic.estimatedMinutes}&thinsp;min
      </span>
    </div>
    <h1>${escapeHtml(topic.title)}</h1>
    <div class="hero-accent"></div>
    ${prereqHtml}
  </div>

  <div class="topic-tabs topic-tabs-bar" role="tablist" aria-label="Topic sections">
    ${tabBtns}
  </div>

  <div class="tab-panel${activeTab === 'concept'    ? ' is-active' : ''}" data-panel="concept">
    ${topic.tabs.concept || '<p>Concept content coming soon.</p>'}
  </div>

  <div class="tab-panel${activeTab === 'code'       ? ' is-active' : ''}" data-panel="code">
    ${renderCodePanel(topic.tabs.code)}
  </div>

  <div class="tab-panel${activeTab === 'hands-on'   ? ' is-active' : ''}" data-panel="hands-on">
    ${renderHandsOnPanel(topic.tabs.handsOn)}
  </div>

  <div class="tab-panel${activeTab === 'self-check' ? ' is-active' : ''}" data-panel="self-check">
    ${renderSelfCheckPanel(topic.tabs.selfCheck)}
  </div>

  <footer class="topic-footer">
    <div class="topic-footer-nav">${prevHtml}</div>
    <button class="btn-complete${done ? ' is-complete' : ''}"
            type="button"
            data-topic-id="${topic.id}"
            aria-pressed="${done}">
      <i data-lucide="${done ? 'circle-check' : 'circle'}" aria-hidden="true"></i>
      <span>${done ? 'Mark incomplete' : 'Mark complete'}</span>
    </button>
    <div class="topic-footer-nav">${nextHtml}</div>
  </footer>

</article>`;
}


/* ============================================================
   SIDEBAR STATE UPDATES
   ============================================================ */
function updateSidebarActive(topicId) {
  document.querySelectorAll('.nav-topic-link').forEach(link => {
    const active = link.dataset.topicId === topicId;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else        link.removeAttribute('aria-current');
  });
}

function updateSidebarCompletion() {
  topics.forEach(topic => {
    const link = document.querySelector(`.nav-topic-link[data-topic-id="${topic.id}"]`);
    if (!link) return;
    const existing = link.querySelector('.completion-icon');
    if (!existing) return;
    const done = isComplete(topic.id);
    link.classList.toggle('is-complete', done);
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', done ? 'circle-check' : 'circle');
    newIcon.className = 'completion-icon';
    newIcon.setAttribute('aria-hidden', 'true');
    existing.replaceWith(newIcon);
  });
  createIcons();
}


/* ============================================================
   PROGRESS BAR + CHIP
   ============================================================ */
function updateProgress() {
  const { done, total, pct } = getProgress(topics.length);
  progressBar.style.width = `${pct}%`;
  progressBar.setAttribute('aria-valuenow', pct);
  progressText.textContent = `${done} / ${total} (${pct}%)`;
  updateSidebarCompletion();
}


/* ============================================================
   COPY BUTTONS
   ============================================================ */
function wireCopyButtons(articleEl) {
  const preEls = Array.from(
    articleEl.querySelectorAll('.tab-panel[data-panel="code"] .code-block pre')
  );

  articleEl.querySelectorAll('.btn-copy').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const pre = preEls[i];
      if (!pre) return;
      const text = pre.textContent;
      const span = btn.querySelector('span');

      function flash() {
        span.textContent = 'Copied!';
        setTimeout(() => { span.textContent = 'Copy'; }, 2000);
      }

      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(flash).catch(() => fallbackCopy(text, flash));
      } else {
        fallbackCopy(text, flash);
      }
    });
  });
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  if (cb) cb();
}


/* ============================================================
   COMPLETE BUTTON
   ============================================================ */
function wireCompleteButton(articleEl) {
  const btn = articleEl.querySelector('.btn-complete');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const id   = btn.dataset.topicId;
    toggleComplete(id);
    const done = isComplete(id);
    btn.classList.toggle('is-complete', done);
    btn.setAttribute('aria-pressed', String(done));
    btn.innerHTML = `<i data-lucide="${done ? 'circle-check' : 'circle'}" aria-hidden="true"></i><span>${done ? 'Mark incomplete' : 'Mark complete'}</span>`;
    createIcons();
  });
}


/* ============================================================
   NAVIGATION / HASH ROUTER
   ============================================================ */
function navigate(rawHash) {
  const hash  = (rawHash || '').replace(/^#/, '');
  const parts = hash.split('/');
  const id    = parts[0];
  const tab   = parts[1] || 'concept';

  if (!id || id === 'welcome') {
    mainContent.innerHTML = welcomeHtml;
    currentTopicId = null;
    updateSidebarActive(null);
    createIcons();
    buildOnThisPage();
    addAnchorLinks();
    window.scrollTo(0, 0);
    return;
  }

  const topic = topics.find(t => t.id === id);

  if (!topic) {
    mainContent.innerHTML = welcomeHtml;
    currentTopicId = null;
    updateSidebarActive(null);
    createIcons();
    buildOnThisPage();
    addAnchorLinks();
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  mainContent.innerHTML = buildTopicHtml(topic, tab);
  currentTopicId = topic.id;

  const articleEl = mainContent.querySelector('.topic-article');
  initTabs(articleEl, topic.id, tab);
  wireCompleteButton(articleEl);
  wireCopyButtons(articleEl);

  if (window.Prism) Prism.highlightAll();
  createIcons();
  updateSidebarActive(topic.id);
  buildOnThisPage();
  addAnchorLinks();
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => navigate(location.hash));


/* ============================================================
   ON THIS PAGE
   ============================================================ */
function buildOnThisPage() {
  const article = mainContent.querySelector('.topic-article');
  if (!article) { otpList.innerHTML = ''; return; }

  const headings = Array.from(article.querySelectorAll('h2[id], h3[id]'));
  otpList.innerHTML = '';

  headings.forEach(h => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = `otp-link${h.tagName === 'H3' ? ' otp-h3' : ''}`;
    a.textContent = h.textContent.replace(/#\s*$/, '').trim();
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.getElementById(h.id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${h.id}`);
    });
    li.appendChild(a);
    otpList.appendChild(li);
  });

  observeHeadings(headings);
}


/* ============================================================
   ACTIVE HEADING (IntersectionObserver)
   ============================================================ */
function observeHeadings(headings) {
  if (headingObserver) headingObserver.disconnect();
  const topOffset = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10
  ) + 16;

  headingObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = otpList.querySelector(`a[href="#${entry.target.id}"]`);
      if (link) link.classList.toggle('is-active', entry.isIntersecting);
    });
  }, { rootMargin: `-${topOffset}px 0px -75% 0px`, threshold: 0 });

  headings.forEach(h => headingObserver.observe(h));
}


/* ============================================================
   ANCHOR LINKS ON HEADINGS
   ============================================================ */
function addAnchorLinks() {
  const article = mainContent.querySelector('.topic-article');
  if (!article) return;

  article.querySelectorAll('h2[id], h3[id]').forEach(h => {
    if (h.querySelector('.anchor-link')) return;
    const a = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = 'anchor-link';
    a.setAttribute('aria-label', `Permalink to "${h.textContent.trim()}"`);
    a.textContent = '#';
    a.addEventListener('click', e => {
      e.preventDefault();
      history.replaceState(null, '', `#${h.id}`);
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
    });
    h.appendChild(a);
  });
}


/* ============================================================
   MOBILE SIDEBAR
   ============================================================ */
function openSidebar() {
  sidebar.classList.add('is-open');
  sidebarOverlay.classList.add('is-visible');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  sidebarOverlay.removeAttribute('aria-hidden');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarOverlay.classList.remove('is-visible');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  sidebarOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

hamburgerBtn.addEventListener('click', () =>
  sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar()
);
sidebarOverlay.addEventListener('click', closeSidebar);


/* ============================================================
   SECTION COLLAPSE / EXPAND
   ============================================================ */
document.querySelectorAll('.nav-section-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
  });
});


/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
document.addEventListener('keydown', e => {
  /* Escape: close mobile sidebar */
  if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
    closeSidebar();
    hamburgerBtn.focus();
    return;
  }

  /* Ctrl+K / Cmd+K: focus search */
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  /* Skip if modifier keys or typing in a field */
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

  /* J / K: next / prev topic */
  if (e.key === 'j' || e.key === 'J') {
    const idx  = currentTopicId ? topics.findIndex(t => t.id === currentTopicId) : -1;
    const next = topics[idx + 1];
    if (next) location.hash = `#${next.id}`;
  } else if (e.key === 'k' || e.key === 'K') {
    const idx = currentTopicId ? topics.findIndex(t => t.id === currentTopicId) : -1;
    if (idx <= 0) { location.hash = '#welcome'; return; }
    const prev = topics[idx - 1];
    if (prev) location.hash = `#${prev.id}`;
  }
});


/* ============================================================
   INIT
   ============================================================ */
populateSidebar();
subscribe(updateProgress);

createIcons();
updateProgress();
navigate(location.hash);
