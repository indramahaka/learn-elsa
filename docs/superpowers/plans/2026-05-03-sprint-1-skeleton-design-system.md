# Sprint 1: Skeleton and Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AWFS Elsa Academy project skeleton with full AGIT design system, three-column responsive layout, CDN wiring, and welcome page. No topic content yet.

**Architecture:** `src/index.html` is the dev entry. CSS lives in `src/styles/` split into main, prism-agit, and print. JS in `src/scripts/app.js` (ES module). Three-column grid: fixed 260px left sidebar, fluid 720px-max main, sticky 220px right sidebar. All design tokens as CSS custom properties on `:root`.

**Tech Stack:** HTML5, CSS3 (custom properties, grid, flexbox), vanilla ES modules, Google Fonts CDN (Fraunces + Plus Jakarta Sans + JetBrains Mono), Lucide icons CDN (UMD), Prism.js CDN (core + autoloader)

---

## File Map

| File | Role |
|------|------|
| `src/index.html` | Entry point, HTML structure, CDN link tags |
| `src/styles/main.css` | Design tokens, reset, layout, all component styles |
| `src/styles/prism-agit.css` | Custom Prism syntax highlight theme (dark, #1E1E2E bg) |
| `src/styles/print.css` | `@media print` overrides |
| `src/scripts/app.js` | Lucide init, mobile toggle, sidebar collapse, on-this-page |

---

### Task 1: Initialize git and project structure

**Files:** `c:\POC\Elsa Academy\` root

- [ ] **Step 1: Initialize git**
```bash
cd "c:\POC\Elsa Academy"
git init
git add SPEC.md
git commit -m "chore: add project spec"
```

- [ ] **Step 2: Verify all directories exist**
```
src/
  styles/
  scripts/
  content/
    tier-1/  tier-2/  tier-3/  labs/
docs/superpowers/plans/
build/
tests/
```
Expected: `ls src/` shows `styles/  scripts/  content/`

---

### Task 2: Create src/index.html

**Files:**
- Create: `src/index.html`

- [ ] **Step 1: Write src/index.html**

Full HTML structure with CDN links, fixed header, mobile overlay, left sidebar, layout wrapper (main + right sidebar). Welcome article content inline.

Key decisions:
- Lucide UMD from `unpkg.com/lucide@latest/dist/umd/lucide.min.js` (not ESM, loaded before module scripts)
- Prism core + autoloader via cdnjs for lazy language loading
- Progress bar (3px) at `top: 0`; header at `top: 3px`
- `aria-expanded` on all collapsible section buttons
- Welcome page uses semantic `<article>` with `<section>` children
- `<kbd>` elements for keyboard shortcuts
- All nav topic lists empty (`<!-- Populated by app.js -->`) per Sprint 1 acceptance criteria

- [ ] **Step 2: Open in browser**

Open `src/index.html` from filesystem. Expected: page loads with no console errors. Fonts may not load if CORS blocks file:// protocol — that's OK for verification; use a local HTTP server (`python -m http.server 8080` in `src/`) if needed.

- [ ] **Step 3: Commit**
```bash
git add src/index.html
git commit -m "feat: add HTML skeleton with CDN links and layout structure"
```

---

### Task 3: Create src/styles/main.css

**Files:**
- Create: `src/styles/main.css`

- [ ] **Step 1: Write design tokens section**

```css
:root {
  /* Colors */
  --c-burgundy:   #6C1D45;
  --c-orange:     #DE7C00;
  --c-blue:       #00537C;
  --c-bg:         #FAF7F2;
  --c-text:       #1A1A1A;
  --c-muted:      #5A5A5A;
  --c-border:     #E8E2D8;
  --c-code-light: #F4EFE7;
  --c-code-bg:    #1E1E2E;
  --c-code-text:  #CDD6F4;

  /* Typography */
  --f-display: "Fraunces", "Georgia", serif;
  --f-body:    "Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif;
  --f-code:    "JetBrains Mono", "Consolas", monospace;

  /* Layout */
  --progress-h:    3px;
  --header-h:      64px;
  --sidebar-w:     260px;
  --rsidebar-w:    220px;
  --content-max:   720px;

  /* Space scale */
  --sp-1: 0.25rem;  --sp-2: 0.5rem;  --sp-3: 0.75rem;
  --sp-4: 1rem;     --sp-6: 1.5rem;  --sp-8: 2rem;
  --sp-12: 3rem;    --sp-16: 4rem;

  /* Radii */
  --r-sm:   4px;
  --r-md:   8px;
  --r-pill: 999px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(108,29,69,0.08);
  --shadow-md: 0 4px 16px rgba(108,29,69,0.12);

  /* Transitions */
  --t-fast: 150ms ease;
  --t-mid:  250ms ease;
}
```

- [ ] **Step 2: Write reset + base**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }

body {
  font-family: var(--f-body);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--c-text);
  background-color: var(--c-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  padding-top: calc(var(--header-h) + var(--progress-h));
}

img, svg { max-width: 100%; display: block; }
a { color: var(--c-burgundy); text-decoration: underline; text-underline-offset: 3px; }
a:hover { color: var(--c-orange); }
button { cursor: pointer; font-family: inherit; }
ul, ol { padding-left: var(--sp-6); }
li + li { margin-top: var(--sp-1); }
kbd {
  font-family: var(--f-code);
  font-size: 0.8125rem;
  background: var(--c-code-light);
  border: 1px solid var(--c-border);
  border-radius: var(--r-sm);
  padding: 0.1em 0.4em;
  color: var(--c-burgundy);
}
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

- [ ] **Step 3: Write progress bar + header**

```css
/* Progress bar */
.progress-bar {
  position: fixed;
  top: 0; left: 0;
  height: var(--progress-h);
  width: 0%;
  background: var(--c-orange);
  z-index: 200;
  transition: width var(--t-mid);
}

/* Header */
.site-header {
  position: fixed;
  top: var(--progress-h); left: 0; right: 0;
  height: var(--header-h);
  background: var(--c-burgundy);
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: 0 var(--sp-6);
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.header-left  { display: flex; align-items: center; gap: var(--sp-3); flex-shrink: 0; }
.header-center { flex: 1; min-width: 0; max-width: 400px; margin: 0 var(--sp-4); }
.header-right { display: flex; align-items: center; gap: var(--sp-3); flex-shrink: 0; margin-left: auto; }

/* Logo */
.site-logo {
  display: flex; align-items: center; gap: var(--sp-2);
  text-decoration: none; color: white;
  font-family: var(--f-body); white-space: nowrap;
}
.logo-agit {
  font-weight: 700; font-size: 1.125rem; letter-spacing: 0.05em;
  color: white;
}
.logo-sep { color: rgba(255,255,255,0.4); font-size: 1rem; }
.logo-product {
  font-family: var(--f-display); font-size: 1.125rem; font-weight: 600;
  color: rgba(255,255,255,0.9);
}
.site-logo:hover { color: white; }

/* Hamburger button */
.btn-hamburger {
  display: none;
  background: transparent; border: none; color: white;
  padding: var(--sp-2); border-radius: var(--r-sm);
  transition: background var(--t-fast);
}
.btn-hamburger:hover { background: rgba(255,255,255,0.15); }
.btn-hamburger svg { width: 22px; height: 22px; }

/* Search box */
.search-box {
  position: relative; display: flex; align-items: center; width: 100%;
}
.search-icon {
  position: absolute; left: var(--sp-3);
  width: 16px; height: 16px; color: rgba(255,255,255,0.5);
  pointer-events: none;
}
.search-input {
  width: 100%; height: 38px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--r-pill);
  padding: 0 var(--sp-4) 0 calc(var(--sp-3) + 16px + var(--sp-2));
  font-family: var(--f-body); font-size: 0.875rem; color: white;
  outline: none; transition: border-color var(--t-fast), background var(--t-fast);
}
.search-input::placeholder { color: rgba(255,255,255,0.45); }
.search-input:focus {
  background: rgba(255,255,255,0.18);
  border-color: rgba(255,255,255,0.5);
}

/* Tier filter */
.tier-filter {
  height: 34px; padding: 0 var(--sp-3);
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: var(--r-sm);
  color: white; font-family: var(--f-body); font-size: 0.8125rem;
  outline: none; cursor: pointer;
  transition: border-color var(--t-fast);
}
.tier-filter:focus { border-color: rgba(255,255,255,0.5); }
.tier-filter option { background: var(--c-burgundy); color: white; }

/* Progress chip */
.progress-chip {
  font-size: 0.8125rem; color: rgba(255,255,255,0.8);
  white-space: nowrap; padding: 0 var(--sp-2);
}

/* Icon button */
.btn-icon {
  background: transparent; border: none; color: rgba(255,255,255,0.7);
  padding: var(--sp-2); border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  transition: color var(--t-fast), background var(--t-fast);
}
.btn-icon:hover { color: white; background: rgba(255,255,255,0.15); }
.btn-icon svg { width: 18px; height: 18px; }
```

- [ ] **Step 4: Write sidebar**

```css
/* Overlay (mobile) */
.sidebar-overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 49;
  backdrop-filter: blur(2px);
}
.sidebar-overlay.is-visible { display: block; }

/* Sidebar */
.sidebar {
  position: fixed;
  top: calc(var(--header-h) + var(--progress-h));
  left: 0;
  width: var(--sidebar-w);
  height: calc(100vh - var(--header-h) - var(--progress-h));
  overflow-y: auto;
  background: white;
  border-right: 1px solid var(--c-border);
  z-index: 50;
  overscroll-behavior: contain;
}
/* Scrollbar */
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }

.sidebar-scroller { padding: var(--sp-4) 0 var(--sp-8); }

/* Nav section */
.nav-section { border-bottom: 1px solid var(--c-border); }
.nav-section:last-child { border-bottom: none; }

.nav-section-btn {
  width: 100%; display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-3) var(--sp-4);
  background: transparent; border: none;
  font-family: var(--f-body); font-size: 0.8125rem;
  color: var(--c-text); text-align: left;
  transition: background var(--t-fast);
}
.nav-section-btn:hover { background: var(--c-bg); }

.nav-section-label { flex: 1; font-weight: 700; font-size: 0.8125rem; color: var(--c-muted); text-transform: uppercase; letter-spacing: 0.05em; }

.nav-chevron { width: 14px; height: 14px; color: var(--c-muted); transition: transform var(--t-fast); flex-shrink: 0; }
.nav-section-btn[aria-expanded="false"] .nav-chevron { transform: rotate(-90deg); }

/* Nav topic list */
.nav-topic-list { list-style: none; padding: var(--sp-1) 0 var(--sp-2); }
.nav-section-btn[aria-expanded="false"] + .nav-topic-list { display: none; }

.nav-topic-item { margin: 0; }

.nav-topic-link {
  display: flex; align-items: center; gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4) var(--sp-2) calc(var(--sp-4) + var(--sp-2));
  font-size: 0.875rem; color: var(--c-text); text-decoration: none;
  transition: background var(--t-fast), color var(--t-fast);
  border-left: 3px solid transparent;
}
.nav-topic-link:hover { background: var(--c-bg); color: var(--c-burgundy); }
.nav-topic-link.is-active {
  background: #f9f0f4;
  color: var(--c-burgundy);
  border-left-color: var(--c-burgundy);
  font-weight: 600;
}
.nav-topic-link:hover { color: var(--c-burgundy); }

.completion-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--c-border); transition: color var(--t-fast); }
.nav-topic-link.is-complete .completion-icon { color: var(--c-orange); }
```

- [ ] **Step 5: Write tier badges**

```css
.tier-badge {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: var(--f-body); font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.03em;
  padding: 0.2em 0.6em;
  border-radius: var(--r-pill);
  flex-shrink: 0; white-space: nowrap;
}
.tier-badge.tier-1        { background: #FFF0D6; color: #8A4D00; }  /* orange family */
.tier-badge.tier-2        { background: #F5E6EE; color: var(--c-burgundy); }  /* burgundy family */
.tier-badge.tier-3        { background: #DFF0F8; color: #004060; }  /* astra blue family */
.tier-badge.tier-labs     { background: #E8F5E9; color: #1B5E20; }  /* green */
.tier-badge.tier-welcome  { background: var(--c-border); color: var(--c-muted); }
```

- [ ] **Step 6: Write layout wrapper + main content**

```css
/* Layout wrapper: right of the fixed sidebar */
.layout-wrapper {
  margin-left: var(--sidebar-w);
  display: grid;
  grid-template-columns: 1fr var(--rsidebar-w);
  min-height: calc(100vh - var(--header-h) - var(--progress-h));
  align-items: start;
}

.main-content {
  max-width: var(--content-max);
  width: 100%;
  padding: var(--sp-12) var(--sp-8);
  margin: 0 auto;
}

/* Topic article */
.topic-article { }

/* Topic hero */
.topic-hero {
  margin-bottom: var(--sp-12);
  padding-bottom: var(--sp-8);
  border-bottom: 1px solid var(--c-border);
}
.topic-hero-eyebrow { margin-bottom: var(--sp-4); }

.topic-hero h1 {
  font-family: var(--f-display);
  font-size: clamp(2.25rem, 4vw, 3rem);
  font-weight: 600;
  line-height: 1.1;
  color: var(--c-burgundy);
  margin-bottom: var(--sp-4);
}

.hero-accent {
  width: 64px; height: 4px;
  background: var(--c-orange);
  border-radius: 2px;
  margin-bottom: var(--sp-6);
}

.topic-lead {
  font-size: 1.125rem;
  color: var(--c-muted);
  line-height: 1.6;
  max-width: 600px;
}

/* Typography */
.topic-article h2 {
  font-family: var(--f-display);
  font-size: clamp(1.75rem, 2.5vw, 2.25rem);
  font-weight: 600; line-height: 1.2;
  color: var(--c-burgundy);
  margin-top: var(--sp-12); margin-bottom: var(--sp-4);
  position: relative;
}

.topic-article h3 {
  font-family: var(--f-body);
  font-size: clamp(1.375rem, 2vw, 1.625rem);
  font-weight: 700; line-height: 1.3;
  color: var(--c-text);
  margin-top: var(--sp-8); margin-bottom: var(--sp-3);
}

.topic-article h4 {
  font-family: var(--f-body);
  font-size: 1.125rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--c-muted);
  margin-top: var(--sp-6); margin-bottom: var(--sp-2);
}

.topic-article p {
  margin-bottom: var(--sp-4); max-width: 68ch;
}
.topic-article li { max-width: 66ch; }

.topic-article section { margin-bottom: var(--sp-8); }

/* Anchor links on headings */
.topic-article h2,
.topic-article h3 {
  scroll-margin-top: calc(var(--header-h) + var(--progress-h) + var(--sp-4));
}
.anchor-link {
  opacity: 0; margin-left: var(--sp-2);
  font-size: 0.8em; color: var(--c-burgundy); text-decoration: none;
  transition: opacity var(--t-fast);
}
.topic-article h2:hover .anchor-link,
.topic-article h3:hover .anchor-link { opacity: 1; }
```

- [ ] **Step 7: Write right sidebar**

```css
/* Right sidebar */
.right-sidebar {
  position: sticky;
  top: calc(var(--header-h) + var(--progress-h) + var(--sp-8));
  max-height: calc(100vh - var(--header-h) - var(--progress-h) - var(--sp-8));
  overflow-y: auto;
  padding: var(--sp-8) var(--sp-4) var(--sp-8) var(--sp-6);
  border-left: 1px solid var(--c-border);
}
.right-sidebar::-webkit-scrollbar { width: 3px; }
.right-sidebar::-webkit-scrollbar-thumb { background: var(--c-border); }

.right-sidebar-inner { }
.right-sidebar-title {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-muted);
  margin-bottom: var(--sp-4);
}

.otp-list { list-style: none; padding: 0; }
.otp-list li + li { margin-top: var(--sp-1); }
.otp-link {
  display: block; font-size: 0.8125rem; color: var(--c-muted);
  text-decoration: none; padding: var(--sp-1) 0;
  border-left: 2px solid transparent;
  padding-left: var(--sp-3);
  transition: color var(--t-fast), border-color var(--t-fast);
}
.otp-link:hover { color: var(--c-burgundy); }
.otp-link.is-active { color: var(--c-burgundy); border-left-color: var(--c-burgundy); font-weight: 600; }
.otp-link.otp-h3 { padding-left: calc(var(--sp-3) + var(--sp-4)); font-size: 0.75rem; }
```

- [ ] **Step 8: Write responsive breakpoints**

```css
/* === TABLET (768-1023px) === */
@media (max-width: 1023px) {
  .btn-hamburger { display: flex; }

  .sidebar {
    transform: translateX(-100%);
    transition: transform var(--t-mid);
    box-shadow: var(--shadow-md);
  }
  .sidebar.is-open { transform: translateX(0); }

  .layout-wrapper {
    margin-left: 0;
    grid-template-columns: 1fr;
  }

  .right-sidebar { display: none; }

  .header-right .progress-chip { display: none; }
}

/* === MOBILE (<768px) === */
@media (max-width: 767px) {
  .header-center { display: none; }
  /* Search accessible via sidebar or a search icon button */

  .main-content {
    padding: var(--sp-8) var(--sp-4);
  }

  .topic-hero h1 { font-size: 2rem; }

  .tier-filter { font-size: 0.75rem; }
}
```

- [ ] **Step 9: Run verification in browser**

Resize window to 1280px, 900px, 375px widths. Verify:
- Desktop: three columns visible, sidebar fixed, right sidebar visible
- Tablet: hamburger shows, sidebar hidden until hamburger clicked, right sidebar gone
- Mobile: header simplified, full-width content

- [ ] **Step 10: Commit**
```bash
git add src/styles/main.css
git commit -m "feat: add design system and three-column responsive layout"
```

---

### Task 4: Create src/styles/prism-agit.css

**Files:**
- Create: `src/styles/prism-agit.css`

- [ ] **Step 1: Write custom Prism theme**

Colors: bg `#1E1E2E`, base text `#CDD6F4`, comments `#6C7086`, strings `#A6E3A1`, keywords `#CBA6F7`, numbers `#FAB387`, operators `#89DCEB`, functions `#89B4FA`, class-names `#F5C2E7`

```css
/* AGIT dark code theme — Catppuccin Mocha-inspired */
code[class*="language-"],
pre[class*="language-"] {
  color: #CDD6F4;
  font-family: var(--f-code, "JetBrains Mono", monospace);
  font-size: 0.9375rem;
  direction: ltr; text-align: left;
  white-space: pre; word-spacing: normal; word-break: normal;
  tab-size: 2; hyphens: none;
  line-height: 1.6;
}
pre[class*="language-"] {
  background: #1E1E2E;
  border-radius: var(--r-md, 8px);
  padding: 1.25rem 1.5rem;
  overflow: auto;
  position: relative;
  margin: 1.5rem 0;
}
:not(pre) > code[class*="language-"],
:not([class*="language-"]) > code {
  background: var(--c-code-light, #F4EFE7);
  color: var(--c-burgundy, #6C1D45);
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
}
.token.comment, .token.prolog, .token.doctype, .token.cdata { color: #6C7086; font-style: italic; }
.token.punctuation { color: #BAC2DE; }
.token.namespace { opacity: 0.7; }
.token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol { color: #FAB387; }
.token.selector, .token.attr-name, .token.string, .token.char, .token.builtin { color: #A6E3A1; }
.token.operator, .token.entity, .token.url, .token.variable { color: #89DCEB; }
.token.keyword, .token.control { color: #CBA6F7; }
.token.function, .token.function-name { color: #89B4FA; }
.token.class-name { color: #F5C2E7; }
.token.regex, .token.important { color: #FAB387; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
.token.deleted { color: #F38BA8; }
.token.inserted { color: #A6E3A1; }
```

- [ ] **Step 2: Commit**
```bash
git add src/styles/prism-agit.css
git commit -m "feat: add custom Prism AGIT dark theme"
```

---

### Task 5: Create src/styles/print.css

**Files:**
- Create: `src/styles/print.css`

- [ ] **Step 1: Write print stylesheet**

```css
@media print {
  /* Strip chrome */
  .site-header,
  .sidebar,
  .sidebar-overlay,
  .progress-bar,
  .right-sidebar,
  .topic-footer-nav,
  .btn-copy,
  .topic-tabs,
  #printBtn,
  #tierFilter,
  .progress-chip { display: none !important; }

  body {
    padding: 0;
    font-size: 11pt;
    color: #000;
    background: white;
    background-image: none;
  }

  .layout-wrapper { display: block; margin: 0; }
  .main-content { max-width: 100%; padding: 0; }

  /* Light code blocks for print */
  pre[class*="language-"],
  code[class*="language-"] {
    background: #f5f5f5 !important;
    color: #1A1A1A !important;
    border: 1px solid #ddd;
    font-size: 9pt;
  }

  .token.comment { color: #555 !important; }
  .token.keyword { color: #004 !important; font-weight: bold; }
  .token.string { color: #060 !important; }
  .token.number { color: #C05 !important; }
  .token.function { color: #006 !important; }

  /* Page breaks */
  .topic-article { page-break-before: always; }
  .topic-article:first-child { page-break-before: auto; }

  h2, h3 { page-break-after: avoid; }
  pre, blockquote, figure { page-break-inside: avoid; }

  a[href]::after { content: " (" attr(href) ")"; font-size: 0.85em; color: #555; }
  a[href^="#"]::after { content: ""; }
}
```

- [ ] **Step 2: Commit**
```bash
git add src/styles/print.css
git commit -m "feat: add print stylesheet"
```

---

### Task 6: Create src/scripts/app.js

**Files:**
- Create: `src/scripts/app.js`

- [ ] **Step 1: Write app.js**

Responsibilities in Sprint 1: Lucide icon init, mobile hamburger toggle, sidebar section collapse/expand, "on this page" generator from current article h2/h3 headings, Ctrl+K search focus.

```js
// Initialize Lucide icons (library loaded as UMD global)
lucide.createIcons();

// --- Elements ---
const hamburgerBtn   = document.getElementById('hamburgerBtn');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const searchInput    = document.getElementById('searchInput');
const otpList        = document.getElementById('otpList');
const mainContent    = document.getElementById('mainContent');

// --- Mobile sidebar toggle ---
function openSidebar() {
  sidebar.classList.add('is-open');
  sidebarOverlay.classList.add('is-visible');
  hamburgerBtn.setAttribute('aria-expanded', 'true');
  sidebarOverlay.removeAttribute('aria-hidden');
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebarOverlay.classList.remove('is-visible');
  hamburgerBtn.setAttribute('aria-expanded', 'false');
  sidebarOverlay.setAttribute('aria-hidden', 'true');
}

hamburgerBtn.addEventListener('click', () => {
  sidebar.classList.contains('is-open') ? closeSidebar() : openSidebar();
});

sidebarOverlay.addEventListener('click', closeSidebar);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
});

// --- Sidebar section collapse/expand ---
document.querySelectorAll('.nav-section-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!expanded));
    // Lucide icon update: chevron rotation handled via CSS [aria-expanded="false"] .nav-chevron
  });
});

// --- Ctrl+K / Cmd+K: focus search ---
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

// --- On This Page: generate from h2/h3 in current article ---
function buildOnThisPage() {
  const article = mainContent.querySelector('.topic-article');
  if (!article) return;

  const headings = article.querySelectorAll('h2[id], h3[id]');
  otpList.innerHTML = '';

  headings.forEach(h => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href      = `#${h.id}`;
    a.className = `otp-link${h.tagName === 'H3' ? ' otp-h3' : ''}`;
    a.textContent = h.textContent.replace(/#\s*$/, '').trim();
    a.addEventListener('click', e => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${h.id}`);
    });
    li.appendChild(a);
    otpList.appendChild(li);
  });
}

buildOnThisPage();

// --- Active heading highlight in right sidebar ---
const headingObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    const id   = entry.target.id;
    const link = otpList.querySelector(`a[href="#${id}"]`);
    if (link) link.classList.toggle('is-active', entry.isIntersecting);
  });
}, {
  rootMargin: `-${64 + 3 + 16}px 0px -80% 0px`
});

document.querySelectorAll('.topic-article h2[id], .topic-article h3[id]')
  .forEach(h => headingObserver.observe(h));

// --- Anchor links on headings ---
document.querySelectorAll('.topic-article h2[id], .topic-article h3[id]').forEach(h => {
  const a    = document.createElement('a');
  a.href     = `#${h.id}`;
  a.className = 'anchor-link';
  a.setAttribute('aria-label', `Permalink to "${h.textContent.trim()}"`);
  a.textContent = '#';
  a.addEventListener('click', e => {
    e.preventDefault();
    navigator.clipboard?.writeText(location.origin + location.pathname + `#${h.id}`);
    history.replaceState(null, '', `#${h.id}`);
  });
  h.appendChild(a);
});
```

- [ ] **Step 2: Verify no console errors**

Open `src/index.html` via local HTTP server. Check browser console is clean.

Expected: Lucide icons render, hamburger shows on tablet/mobile, section chevrons toggle, Ctrl+K focuses search, "On this page" lists 4 sections from welcome page.

- [ ] **Step 3: Commit**
```bash
git add src/scripts/app.js
git commit -m "feat: add app.js with Lucide init, sidebar toggle, on-this-page"
```

---

### Task 7: Visual verification

- [ ] **Step 1: Check desktop layout (>=1024px)**
  - Three columns visible
  - Header burgundy, fonts loaded (Fraunces for h1, Plus Jakarta Sans for body)
  - Left sidebar shows 5 collapsible sections with no topic items
  - Right sidebar shows "On this page" with 4 welcome page sections
  - Progress bar orange, 0% width at top
  - Paper texture subtle on background

- [ ] **Step 2: Check tablet layout (768-1023px)**
  - Hamburger button shows in header
  - Sidebar hidden by default
  - Click hamburger: sidebar slides in from left, overlay darkens background
  - Right sidebar absent
  - Main content full-width

- [ ] **Step 3: Check mobile layout (<768px)**
  - Single column
  - Tier filter still visible in header
  - Content readable with generous padding

- [ ] **Step 4: Final commit**
```bash
git add -A
git commit -m "feat: Sprint 1 complete - skeleton, design system, welcome page"
```
