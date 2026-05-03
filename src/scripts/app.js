/**
 * AWFS Elsa Academy — app.js (Sprint 1)
 * Responsibilities:
 *   - Initialize Lucide icons
 *   - Mobile hamburger sidebar toggle
 *   - Left sidebar section collapse / expand
 *   - Build "On This Page" list from article headings
 *   - Highlight active heading in right sidebar on scroll
 *   - Append anchor links to headings
 *   - Ctrl+K / Cmd+K: focus search
 */

/* ---- Lucide icons ---- */
lucide.createIcons();

/* ---- Element references ---- */
const hamburgerBtn    = document.getElementById('hamburgerBtn');
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebarOverlay');
const searchInput     = document.getElementById('searchInput');
const otpList         = document.getElementById('otpList');
const mainContent     = document.getElementById('mainContent');


/* ============================================================
   MOBILE SIDEBAR TOGGLE
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

hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
    closeSidebar();
    hamburgerBtn.focus();
  }
});


/* ============================================================
   SIDEBAR SECTION COLLAPSE / EXPAND
   ============================================================ */
document.querySelectorAll('.nav-section-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    // CSS handles visibility via [aria-expanded="false"] + .nav-topic-list { display: none }
    // CSS handles chevron rotation via [aria-expanded="false"] .nav-chevron { transform: rotate(-90deg) }
  });
});


/* ============================================================
   CTRL+K / CMD+K — FOCUS SEARCH
   ============================================================ */
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});


/* ============================================================
   ON THIS PAGE — BUILD FROM ARTICLE HEADINGS
   ============================================================ */
function buildOnThisPage() {
  const article  = mainContent.querySelector('.topic-article');
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
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${h.id}`);
      }
    });
    li.appendChild(a);
    otpList.appendChild(li);
  });

  /* Set up active heading observer after list is built */
  observeHeadings(headings);
}


/* ============================================================
   ACTIVE HEADING HIGHLIGHT (IntersectionObserver)
   ============================================================ */
let headingObserver = null;

function observeHeadings(headings) {
  if (headingObserver) headingObserver.disconnect();

  const topOffset = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--header-h'), 10) + 3 + 16;

  headingObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = otpList.querySelector(`a[href="#${entry.target.id}"]`);
      if (link) link.classList.toggle('is-active', entry.isIntersecting);
    });
  }, {
    rootMargin: `-${topOffset}px 0px -75% 0px`,
    threshold:  0
  });

  headings.forEach(h => headingObserver.observe(h));
}


/* ============================================================
   ANCHOR LINKS ON HEADINGS
   ============================================================ */
function addAnchorLinks() {
  const article = mainContent.querySelector('.topic-article');
  if (!article) return;

  article.querySelectorAll('h2[id], h3[id]').forEach(h => {
    if (h.querySelector('.anchor-link')) return; /* already added */
    const a = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = 'anchor-link';
    a.setAttribute('aria-label', `Permalink to "${h.textContent.trim()}"`);
    a.textContent = '#';
    a.addEventListener('click', e => {
      e.preventDefault();
      history.replaceState(null, '', `#${h.id}`);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(location.href).catch(() => {});
      }
    });
    h.appendChild(a);
  });
}


/* ============================================================
   INIT
   ============================================================ */
buildOnThisPage();
addAnchorLinks();
