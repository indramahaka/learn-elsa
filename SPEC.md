# AWFS Elsa Academy — Project Specification

**Document version:** 1.0
**Owner:** Ime (Solution Architect, AGIT)
**Audience for handoff:** Claude Code
**Purpose:** Build an interactive, single-page HTML learning site that takes a solution architect from zero to TAM-CTO-pitch-ready on Elsa Workflows 3.x, organized in three depth tiers, for the Approval Workflow Service (AWFS) project at Toyota-Astra Motor.

---

## 1. Project Overview

### 1.1 What We Are Building

A self-contained, interactive **single-page web application** named **"AWFS Elsa Academy"** that serves as a personal learning reference for one solution architect (Ime) preparing to pitch and deliver the **Approval Workflow Service (AWFS)** to Toyota-Astra Motor (TAM).

The site covers **Elsa Workflows 3.x** at three depth tiers, with concept explanations, working code samples, hands-on labs, self-check quizzes, and a TAM CTO interview cheat sheet.

### 1.2 Why This Exists

The architect cannot deliver AWFS credibly without deep Elsa knowledge. Reading official Elsa docs is not enough because:

- Official docs are reference, not learning material
- Official docs do not connect features to AWFS-specific requirements (POA delegation, MDM integration, group approvals, SLA escalation)
- The architect needs an **AWFS-contextualized** reference that maps each Elsa feature to a TAM requirement
- The architect needs **drill-style self-check questions** that mirror how TAM's CTO will probe in the pitch meeting

### 1.3 Success Criteria

The site is "done" when the architect can:

- Open the site on any device and navigate to any topic in two clicks or less
- Read concept, see code, attempt a hands-on lab, and verify understanding via self-check, all without leaving the page
- Filter content by tier (1, 2, or 3) using a single toggle
- Search all content with a top-bar search box
- Track personal completion progress (in-memory only, resets on reload, no localStorage)
- Print or export any topic to PDF for offline reading

### 1.4 Non-Goals (Out of Scope)

- **No backend.** Pure static HTML, CSS, JavaScript
- **No accounts, login, or persistence across sessions.** In-memory progress only
- **No localStorage or sessionStorage.** Browser storage is forbidden
- **No external API calls** at runtime. All content baked into the file
- **No analytics, telemetry, or tracking**
- **No mobile-app wrapper.** Responsive web only
- **Not a public-facing product.** Internal personal use only

---

## 2. Target User and Voice

### 2.1 The User

- **Name:** Ime
- **Role:** Solution Architect and Pre-Sales at PT Astra Graphia IT (AGIT)
- **Primary language:** Bahasa Indonesia, with English as working language for technical content
- **Mental state:** Experienced .NET developer, new to Elsa specifically, under time pressure
- **Reads on:** Mobile (phone) most often, occasionally desktop

### 2.2 Voice and Tone

- **Direct.** No fluff, no padding, no apologies
- **Technical but explained.** Define jargon the first time it appears
- **Honest about limitations.** Say what Elsa cannot do, not just what it can
- **AWFS-anchored.** Every concept connects to a real TAM requirement
- **Indonesian context aware.** Reference WhatsApp, Bahasa, AWS Jakarta when relevant
- **No em dashes.** Use commas, semicolons, or parentheses instead. This is a hard rule
- **No emoji in body content.** Tier badges and UI affordances may use them sparingly

---

## 3. Design System

### 3.1 Brand Foundation

The site uses the **AGIT corporate identity** (Corporate Identity Guideline 2023):

- **Burgundy:** `#6C1D45` (primary anchor, headers, links)
- **Orange:** `#DE7C00` (accent, CTAs, highlights, tier-1 badges)
- **Astra Blue:** `#00537C` (secondary accent, info callouts, tier-3 badges)
- **Off-white background:** `#FAF7F2` (warm, editorial, easier on eyes than pure white)
- **Body text:** `#1A1A1A` (near-black, not pure black)
- **Muted text:** `#5A5A5A` (metadata, captions)
- **Border / divider:** `#E8E2D8` (warm neutral)
- **Code background (light):** `#F4EFE7`
- **Code background (dark):** `#1E1E2E` (Mocha-flavor dark, paired with #CDD6F4 text)

Use burgundy as the dominant chrome color. Orange is the accent. Astra Blue appears only in tier-3 sections and informational callouts. Avoid using all three at saturation in the same viewport.

### 3.2 Typography

- **Display / Headings:** `"Fraunces"` (variable, Google Fonts) — distinctive editorial serif for h1, h2, hero text
- **Body:** `"Plus Jakarta Sans"` (Google Fonts) — Indonesian-named, clean sans-serif for paragraphs and UI
- **Code:** `"JetBrains Mono"` (Google Fonts) — clear monospace for all code blocks and inline code
- **Fallback stack body:** `"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif`
- **Fallback stack display:** `"Fraunces", "Georgia", serif`

Type scale (rem, mobile-first, scales up at viewport breakpoints):

- h1: 2.25rem (mobile) / 3rem (desktop), Fraunces, weight 600, line-height 1.1
- h2: 1.75rem / 2.25rem, Fraunces, weight 600
- h3: 1.375rem / 1.625rem, Plus Jakarta Sans, weight 700
- h4: 1.125rem, Plus Jakarta Sans, weight 700, uppercase, letter-spacing 0.05em
- body: 1rem / 1.0625rem, weight 400, line-height 1.7
- small: 0.875rem
- code: 0.9375rem

### 3.3 Layout

**Desktop (>=1024px):**

- Three-column layout: left sidebar (260px, fixed), main content (max-width 720px), right sidebar (220px, "On this page" anchor links)
- Top fixed header (64px) with logo, search, tier filter, progress indicator
- Content max-width keeps line length readable (around 70-80 characters)

**Tablet (768-1023px):**

- Left sidebar collapses to hamburger toggle
- Right "On this page" sidebar hidden
- Main content takes full width minus padding

**Mobile (<768px):**

- Single column
- Sidebar opens as full-screen overlay drawer
- Top header simplified: logo + hamburger + search icon
- Tier filter moves into sidebar drawer

### 3.4 Visual Details

- **Subtle paper texture** on body background (CSS noise filter or SVG, very low opacity)
- **Tier badges:** rounded-pill, colored by tier (Tier 1 orange, Tier 2 burgundy, Tier 3 Astra blue)
- **Code blocks:** dark theme, generous padding, rounded corners (8px), copy button top-right that animates "Copied!" on click
- **Anchor links** on hover show a "#" symbol in burgundy
- **Hero section per tier:** large Fraunces heading, decorative burgundy accent line below, paragraph in Plus Jakarta Sans
- **Progress bar:** thin (3px) burgundy line at very top of viewport, fills as user marks topics complete
- **Microinteractions:** smooth scroll, fade-in on tab switch (150ms), gentle hover state on cards (subtle shadow lift)
- **No purple gradients. No glassmorphism. No generic AI-template aesthetics.**

### 3.5 Iconography

Use **Lucide icons** via CDN (`https://unpkg.com/lucide@latest`). Allowed icons:

- `book-open` for concept tabs
- `code` for code tabs
- `wrench` for hands-on tabs
- `circle-check` for self-check tabs
- `search` for search box
- `menu` for mobile hamburger
- `copy` and `check` for code copy button states
- `chevron-right`, `chevron-down` for collapsibles
- `external-link` for external references
- `circle` (empty) and `circle-check` (filled) for completion checkboxes

No other icon libraries. No custom SVG illustrations beyond the AGIT logomark.

---

## 4. Technical Stack

### 4.1 Required

- **Pure HTML, CSS, JavaScript.** No build step required for the final deliverable
- **Single self-contained `index.html`** with optional split CSS and JS files (see file structure)
- **Modern browsers only:** Chrome, Edge, Safari, Firefox latest two versions
- **No frameworks** (no React, Vue, Svelte, etc.)
- **No bundlers** (no Webpack, Vite, Parcel)
- **Native ES modules** allowed
- **Google Fonts via `<link>`** in `<head>`
- **Lucide icons via CDN script tag**
- **Prism.js via CDN** for syntax highlighting (themes: prism-one-dark for code blocks)

### 4.2 Forbidden

- **No localStorage, sessionStorage, IndexedDB, cookies.** All state in-memory only
- **No external runtime API calls** (no fetch to any backend or third-party service)
- **No npm install** in the final deliverable. Dependencies via CDN only
- **No tracking pixels, analytics, fingerprinting**

### 4.3 Performance Targets

- **First Contentful Paint:** under 1.5 seconds on 4G
- **Total page weight:** under 2 MB including fonts and Prism (content goal under 1 MB)
- **Lighthouse Accessibility score:** at least 95
- **Lighthouse Performance score:** at least 90

---

## 5. Information Architecture

### 5.1 Top-Level Sitemap

```
/ (Landing / Welcome)
├── /tier-1 — Tier 1: Must Know (9 topics)
├── /tier-2 — Tier 2: Should Know (7 topics)
├── /tier-3 — Tier 3: Nice to Know (5 topics)
├── /labs — Hands-On Labs (7 exercises)
├── /cheat-sheet — TAM CTO Interview Cheat Sheet
└── /glossary — Glossary of Elsa Terms
```

These are **client-side routes** using URL hash or History API. No server-side routing. The site is one HTML file.

### 5.2 Navigation Structure

**Top header (fixed):**

- Left: AGIT wordmark + "Elsa Academy" lockup
- Center: Search input (cmd+K to focus)
- Right: Tier filter dropdown (All / Tier 1 / Tier 2 / Tier 3), progress percentage, hamburger on mobile

**Left sidebar (desktop):**

- Section: Tier 1 (collapsible, 9 topics listed)
- Section: Tier 2 (collapsible, 7 topics listed)
- Section: Tier 3 (collapsible, 5 topics listed)
- Section: Hands-On Labs (collapsible, 7 labs listed)
- Section: References (Cheat Sheet, Glossary)
- Each topic link shows a completion circle (empty or filled)

**Right sidebar (desktop only):**

- "On this page" auto-generated from h2/h3 headings of the current topic
- Sticky as user scrolls
- Active heading highlighted in burgundy

**Bottom of each topic:**

- "Mark as complete" button (toggles completion state in-memory)
- Previous topic / Next topic navigation

---

## 6. Content Specification

This is the heart of the spec. Each topic gets a **Concept tab**, **Code tab**, **Hands-On tab**, and **Self-Check tab**.

### 6.1 Topic Card Structure (Apply to Every Topic)

Every topic must contain:

- **Title** (h1 in main content area)
- **Tier badge** (Tier 1, 2, or 3)
- **Estimated time** (e.g., "~20 min read + 30 min hands-on")
- **Prerequisites** (links to other topics that must be done first)
- **Tab 1: Concept** — what it is, why it matters, mental model, AWFS connection
- **Tab 2: Code** — working code samples with explanations, syntax-highlighted
- **Tab 3: Hands-On** — step-by-step exercise the user runs locally
- **Tab 4: Self-Check** — 4 to 6 questions, click to reveal answer
- **Footer** — completion checkbox + previous/next nav

### 6.2 Tier 1: Must Know (9 topics)

These are non-negotiable for the AWFS pitch. Architect must hold all of these in working memory.

**T1-01: Mental Model and Setup**

- Concept: Workflow as a graph of activities. Engine walks the graph. Bookmarks suspend, persistence preserves, triggers resume. Why this is fundamentally different from a procedural function call. Why AWFS approval flows are inherently long-running and require this model.
- Code: Empty .NET 9 project setup. NuGet packages: `Elsa`, `Elsa.Workflows.Core`, `Elsa.EntityFrameworkCore.PostgreSql`. `Program.cs` with `services.AddElsa(elsa => elsa.UseWorkflows())`. Run the empty host.
- Hands-On: Create the lab repo `awfs-elsa-lab`. Set up dev environment: .NET 9 SDK, Docker Desktop, PostgreSQL container via `docker-compose.yml`. Create the empty Elsa host. Verify it boots.
- Self-Check: What is a bookmark? What happens when an activity calls `Suspend`? What is the difference between a workflow definition and a workflow instance? Why does AWFS need persistence even for short approvals?

**T1-02: Programmatic Workflows (Authoring in C#)**

- Concept: The three authoring modes (programmatic, JSON, visual via Elsa Studio). Why programmatic is the foundation. `WorkflowBase<T>`, the `Build` method, composing activities. `Sequence`, `If`, `Parallel`, `ForEach` as composite activities.
- Code: Hello-world workflow with three `WriteLine` activities in sequence. Add a `Variable<string>` and pass data. Add an `If` with a condition. Run via `IWorkflowRunner.RunAsync`.
- Hands-On: Build a workflow that takes an input string, decides if it is "approve" or "reject", logs the result. Run it 3 times with different inputs.
- Self-Check: When would you use programmatic over JSON authoring? What is the role of `Variable<T>`? How do `Input<T>` and `Output<T>` differ from `Variable<T>`?

**T1-03: Persistence and Bookmarks**

- Concept: How Elsa serializes workflow state to storage. Bookmark records, what they contain, how they index. EF Core provider versus MongoDB. Why PostgreSQL is the right choice for AWFS (TAM has DBA bench strength for it).
- Code: Configure EF Core with PostgreSQL as workflow storage. Schema migrations. Inspecting the `Bookmarks`, `WorkflowInstances`, `WorkflowDefinitions` tables.
- Hands-On: Build a workflow with an `Event` activity that suspends. Resume it via REST API. **Stop and restart the host between suspend and resume.** Confirm state survives. Inspect the bookmark row in pgAdmin.
- Self-Check: What is stored in a bookmark? What happens to bookmarks if the workflow definition is deleted? How does Elsa decide which bookmark to resume when an event fires? Where is approver assignment data stored, in the bookmark or somewhere else?

**T1-04: Authoring Options (Code, JSON, Visual)**

- Concept: Each authoring mode has a use case. Programmatic for engine extension and AGIT-internal templates. JSON for storage, versioning, and API-driven creation (this is what the AWFS 4-step wizard generates). Visual for IT operations users who configure new workflow types.
- Code: Same workflow expressed in all three forms side by side. Show the JSON shape. Demonstrate loading a JSON workflow from a file at runtime.
- Hands-On: Take the workflow from T1-02, export it to JSON, modify the JSON manually, reload it, run it. See how a non-developer could edit the JSON.
- Self-Check: How does the JSON shape correspond to the activity tree? What does "definition versioning" mean in JSON terms? Which authoring mode does the AWFS wizard target?

**T1-05: Custom Activities**

- Concept: When and why to write custom activities. `CodeActivity` (synchronous, simple) versus `Activity` (asynchronous, can suspend). The lifecycle: `OnExecuteAsync`, `Complete`, `CreateBookmark`. How custom activities give AGIT its value-add over plain Elsa.
- Code: Implement `MdmLookupActivity` that takes an `employeeId` input and returns a mock org hierarchy as output. Register it. Use it in a workflow.
- Hands-On: Write `WhatsAppNotifyActivity` (mock, just logs) that takes a phone number and message. Wire it into the approval workflow as a notification step.
- Self-Check: When do you create a bookmark inside a custom activity? What is `ActivityExecutionContext`? How does dependency injection work inside a custom activity?

**T1-06: Hosting Models**

- Concept: Three hosting topologies. Embedded library inside an existing app. Dedicated Elsa Server as a microservice. Elsa Cluster for high availability. Trade-offs of each. Why AWFS will be a dedicated server (not embedded), not yet clustered (post-GA decision).
- Code: Same workflow hosted three ways: embedded in an ASP.NET Core API, as a standalone Elsa Server with REST endpoints exposed, with config notes for clustering.
- Hands-On: Convert your lab from embedded mode (T1-02) to dedicated server mode. Submit workflows over HTTP from a separate console app.
- Self-Check: What changes when you move from embedded to server? What does Elsa need from infrastructure to cluster (Redis lock, shared DB, etc.)? What is the impact on AWFS clients of clustering?

**T1-07: Storage Providers**

- Concept: Elsa's storage abstraction. EF Core (PostgreSQL, SQL Server, MySQL, SQLite). MongoDB. In-memory for testing. Schema considerations: workflow definitions, instances, bookmarks, execution log. Why TAM picks PostgreSQL.
- Code: Configure each provider via `services.AddElsa(elsa => elsa.UseEntityFrameworkCore(...))`. Show the connection string patterns. Schema migration commands.
- Hands-On: Switch your lab between SQLite (dev) and PostgreSQL (prod-like) using configuration. Run the same workflow on both.
- Self-Check: What tables does Elsa create? Which table grows fastest in production? What backup and retention strategy does AWFS need?

**T1-08: Long-Running Workflows (Timer, Delay, Cron)**

- Concept: How to express time in workflows. `Delay` (fixed wait), `Timer` (recurring), `Cron` (scheduled). How these create bookmarks behind the scenes. Why SLA tracking is more than just `Delay`.
- Code: Workflow with a 5-minute `Delay`. Workflow with a `Cron` trigger. Workflow that sets up an SLA timeout: "if no decision in 24 hours, escalate to manager."
- Hands-On: Add an SLA escalation to your approval workflow. Test with shortened intervals (60 seconds). Verify the bookmark survives a host restart and still fires.
- Self-Check: How does Elsa know when a `Delay` expires across host restarts? Why is `Cron` different from `Timer` semantically? What domain logic does AWFS need beyond what these primitives give?

**T1-09: Versioning and In-Flight Workflows**

- Concept: Workflow definition versions. `IsLatest`, `IsPublished`, retraction. What happens to running instances when you publish a new version. Why this is the most-asked CTO question for any BPM platform.
- Code: Publish v1 of a workflow. Start an instance, suspend it. Modify and publish v2. Resume the suspended instance. Inspect which version it uses.
- Hands-On: Same as code section but observed end-to-end. Document the answer in your `LEARNINGS.md`. **TAM will ask this exact question.**
- Self-Check: Does an in-flight instance migrate to a new version automatically? How would you migrate intentionally? What happens if you retract v1 while instances are still running?

### 6.3 Tier 2: Should Know (7 topics)

These come up in design sessions and detailed Q&A. Architect should be fluent, not necessarily fast.

**T2-01: Expression Languages (C#, JavaScript, Liquid, Python)**

- Concept: Where expressions appear (conditions in `If`, dynamic values, output mapping). Trade-offs between languages. C# for compiled performance and type safety. JavaScript for runtime flexibility and config-driven flows. Liquid for templating. Python for advanced rule logic. Recommendation for AWFS: JavaScript for wizard-defined conditions, C# for activity-internal logic.
- Code: Same condition expressed in all four languages. Performance comparison notes.
- Hands-On: Configure a workflow with a JavaScript condition that the wizard could generate (e.g., "amount greater than 10 million IDR"). Run it with two payloads.
- Self-Check: Why not pick one language and forbid the others? When is Liquid useful? What are the security implications of JavaScript expressions configured by IT operations?

**T2-02: HTTP Triggers and Webhooks**

- Concept: `HttpEndpoint` activity for inbound triggers. `SendHttpRequest` for outbound calls. The webhook callback pattern (workflow finishes, calls back the source app). Authentication concerns: how source apps prove identity to AWFS, how AWFS proves identity in callbacks.
- Code: Workflow triggered by `POST /awfs/api/approval-requests`. After completion, calls back `POST {source.callbackUrl}` with the result.
- Hands-On: Build the round-trip: a "source app" console that submits a request, AWFS workflow, callback received and logged. Use ngrok or a local mock server for the callback target.
- Self-Check: How do you handle callback delivery failures? What if the source app is offline when AWFS tries to call back? How do you secure the callback signature?

**T2-03: Multi-Tenancy Patterns**

- Concept: TAM has multiple business units (Service Parts, Tire, Merchandise, Body Builder). Should they share one Elsa instance or have separate instances? Logical multi-tenancy via tenant ID. Physical multi-tenancy via separate databases. Implications for AWFS deployment.
- Code: Tenant-scoped workflow execution. `TenantId` filter in queries.
- Hands-On: Run two "tenants" against the same Elsa instance, verify isolation in the bookmark and instance tables.
- Self-Check: What goes wrong if two tenants share workflow definition IDs? How does multi-tenancy interact with versioning? What is the AWFS recommendation for TAM business units?

**T2-04: Performance and Scaling**

- Concept: Throughput (workflows started per second), latency (time from submit to first response), memory footprint (workflows in memory simultaneously). What scales horizontally, what does not. Bottleneck analysis: usually the database.
- Code: Load test script using NBomber or a simple parallel runner. Configuration to cap in-memory instances.
- Hands-On: Run a load test that starts 1000 workflows in 60 seconds. Measure DB CPU, app memory, response times. Identify the bottleneck.
- Self-Check: What is the practical concurrency limit of single-instance Elsa with PostgreSQL? When do you cluster? What metrics does TAM care about?

**T2-05: Integration Patterns (Kafka, MQ, REST)**

- Concept: How Elsa integrates with messaging infrastructure. Kafka triggers (workflow starts when message arrives). RabbitMQ activities (publish to MQ from workflow). gRPC clients. AWFS likely uses REST primarily, with Kafka as future option.
- Code: Kafka trigger setup. RabbitMQ publish activity. Decision matrix for sync versus async integration.
- Hands-On: Add a step to your approval workflow that publishes a "decision-finalized" event to a local Kafka topic. Consume the event from a separate process.
- Self-Check: When is async integration better than sync callback? What are the failure modes of each? Does AWFS need a message broker on day one?

**T2-06: Security Model**

- Concept: Authentication of API callers. Authorization of who can start which workflow. Secrets handling (DB connection strings, third-party API keys). Audit and logging. Encryption at rest and in transit.
- Code: Add JWT bearer authentication to the Elsa Server. Restrict which roles can start which workflow. Configure secrets via environment variables or Azure Key Vault.
- Hands-On: Lock down your lab so a test user can submit approvals but not modify workflow definitions. An admin user can do both.
- Self-Check: How does AWFS know which TAM user is approving? How does AWFS prevent one app from starting a workflow it should not? What goes in audit log versus execution log?

**T2-07: Elsa Studio Extensibility**

- Concept: Elsa Studio as the visual workflow designer. What you get out of the box. What you can customize (themes, branding, custom activity panels). Why AWFS needs a custom UI (4-step wizard) and not Elsa Studio for end users, but may use Studio internally.
- Code: Embed Elsa Studio in a Next.js page. Customize the activity palette. Brand it AGIT-style.
- Hands-On: Run Elsa Studio against your local Elsa Server. Create a workflow visually. Save it. Reload it. Run it from the API.
- Self-Check: Why is Elsa Studio not the right end-user UI for TAM? What does it give the AGIT team internally? How much of the AWFS wizard is genuinely custom versus a Studio skin?

### 6.4 Tier 3: Nice to Know (5 topics)

These are escape hatches for deep questions. Architect should know they exist and where to find answers, not necessarily memorize.

**T3-01: WorkflowRunner Internals**

- Concept: What happens between `RunAsync` and the first activity executing. The execution pipeline. Middleware. Why this matters for debugging mysterious failures.
- Code: Walk through `WorkflowRunner.RunAsync` in the Elsa source. Identify each pipeline step.
- Hands-On: Add custom middleware that logs every activity entry and exit. Run a workflow and read the log.
- Self-Check: What is the role of the workflow runtime versus the runner? Where would you intercept to add custom telemetry?

**T3-02: Plugin and Module SDK**

- Concept: Elsa is built from modules (`Elsa.Http`, `Elsa.Workflows.Runtime`, etc.). How to write a custom module. When this is justified versus just custom activities.
- Code: Skeleton of a custom module that registers a set of related activities and services.
- Hands-On: Package your AWFS-specific activities (MDM lookup, POA delegation, escalation) as a custom module.
- Self-Check: Module versus library, what is the difference? How do modules participate in dependency injection?

**T3-03: Migration Between Versions**

- Concept: Upgrading Elsa from 3.x to 3.y. Breaking changes. Database migration scripts. Workflow definition compatibility.
- Code: Reading release notes, identifying breaking changes, running EF Core migrations.
- Hands-On: Simulate an upgrade on your lab from one minor version to another (use a real version pair from Elsa's release history).
- Self-Check: How does AWFS plan for ongoing Elsa upgrades? What is the SLA for upgrade lag?

**T3-04: Pipeline and Middleware**

- Concept: The activity execution pipeline. How middleware runs around each activity. Built-in middleware (logging, error handling, persistence). Custom middleware for cross-cutting concerns.
- Code: Custom middleware that wraps every activity execution with a try-catch, sends errors to Application Insights.
- Hands-On: Write middleware that records execution duration per activity to a metrics endpoint.
- Self-Check: When is middleware better than a base activity class? What is the order of middleware execution?

**T3-05: Advanced API Reference**

- Concept: Less-used but powerful API surfaces. `IWorkflowDispatcher` for fire-and-forget. `IWorkflowRuntime` for managed execution. `IWorkflowDefinitionService` for runtime introspection. When each is the right tool.
- Code: Examples of each, with notes on thread safety and async patterns.
- Hands-On: Build an admin dashboard endpoint that lists all running workflow instances and their current activity. Use `IWorkflowDefinitionService` and `IWorkflowInstanceStore`.
- Self-Check: Which API does the AWFS submission endpoint use? Which API does the troubleshooting UI use?

### 6.5 Hands-On Labs (Standalone Section)

These are larger end-to-end exercises that span multiple topics. Each lab has prerequisites listed. The goal is for the architect to **build the AWFS prototype piece by piece**.

**L-01: Environment Setup**

- Prereqs: T1-01
- Goal: Working dev environment, Postgres in Docker, empty Elsa host running
- Outcome: `docker-compose up` and `dotnet run` boot the lab cleanly

**L-02: Hello Workflow**

- Prereqs: T1-02, L-01
- Goal: First programmatic workflow with conditional branch
- Outcome: A workflow that decides "approve" or "reject" based on input

**L-03: Suspend and Resume**

- Prereqs: T1-03, T1-08, L-02
- Goal: Workflow that suspends on event, survives host restart, resumes on API call
- Outcome: Confidence in long-running workflow durability

**L-04: HTTP-Triggered Approval**

- Prereqs: T2-02, L-03
- Goal: Two-level sequential approval triggered by HTTP, with webhook callback
- Outcome: A working AWFS-shaped skeleton

**L-05: Custom MDM Lookup**

- Prereqs: T1-05, L-04
- Goal: Add a custom activity that resolves the next approver from a mock org hierarchy
- Outcome: Dynamic approver resolution working end-to-end

**L-06: SLA Escalation**

- Prereqs: T1-08, L-05
- Goal: Add timeout-based escalation to the workflow
- Outcome: If no decision within timeout, the workflow escalates and notifies

**L-07: Capstone Mini-AWFS**

- Prereqs: All Tier 1, T2-01, T2-02, T2-06, L-01 through L-06
- Goal: Build a coherent mini-AWFS combining all features: HTTP submission, dynamic 3-level approval, SLA escalation, audit log, webhook callback, simple admin endpoint to list pending approvals
- Outcome: Demoable artifact for the TAM pitch. The architect has personally built the thing they are selling.

Each lab has:

- **Goal statement**
- **Prerequisites** (linked topics and previous labs)
- **Step-by-step instructions** (numbered)
- **Expected output** (what the lab looks like when working)
- **Common pitfalls** (3-5 things that typically trip people up)
- **Code repository structure** (file names and purposes)
- **Verification checklist** (how to know you did it right)

### 6.6 TAM CTO Interview Cheat Sheet

A standalone section. **20 toughest questions** a TAM CTO might ask, with **ideal 2-3 sentence answers** plus optional "deep answer" toggle.

Sample questions to include (full list in implementation):

1. Why Elsa over Camunda or K2?
2. What happens to running approvals if we redeploy the host?
3. How do you handle workflow versioning for in-flight instances?
4. What is the SLA for adding a new approval workflow type? (Answer is "hours, not weeks" if the wizard works)
5. What is the failure mode if PostgreSQL goes down mid-approval?
6. How does AWFS prevent duplicate decisions if a user clicks Approve twice?
7. How does AWFS handle approver out-of-office and delegation?
8. What is the throughput ceiling? When do we hit it?
9. What is the upgrade path when Elsa releases a new version?
10. How do we recover an approval that got stuck?
11. What audit data does AWFS capture? Is it tamper-proof?
12. How does AWFS authenticate calls from source applications?
13. What is the disaster recovery story?
14. Why is open-source Elsa safe for a Toyota-Astra production system?
15. What is the cost difference vs Nintex K2 over 3 years?
16. Can we write our own activities or are we locked in?
17. What if AGIT walks away? Can TAM run AWFS alone?
18. How does AWFS scale for Astra Group expansion beyond TAM?
19. What is the testing strategy for new workflow types?
20. What are the realistic limits we should not promise to exceed?

Each answer must be:

- **Honest.** No vendor-marketing fluff
- **Specific.** Numbers, names, behaviors, not generalities
- **Anchored to AWFS architecture decisions** documented elsewhere in the project

### 6.7 Glossary

Alphabetical list of terms, each with a 2-3 sentence definition and a link to the topic where they are introduced. Include at least:

- Activity, Bookmark, Composite Activity, Cron Trigger, Custom Activity, Definition, Delay, Dispatcher, Elsa Studio, Event Activity, Expression, HTTP Endpoint, Input, Instance, Middleware, Module, Output, Persistence Provider, POA (Power of Attorney delegation), Runner, Runtime, Sequence, SLA, Suspend, Tenant, Timer, Trigger, Variable, Webhook, Workflow, Workflow Engine

---

## 7. Interactive Features

### 7.1 Required Features

**Search**

- Top-bar input, focuses on `Cmd+K` or `Ctrl+K`
- Searches across all topic titles, concept text, code, hands-on, self-check
- Results dropdown shows topic title, tier, snippet of matching text
- Click result jumps to topic with search term highlighted

**Tier Filter**

- Top-right dropdown: All / Tier 1 / Tier 2 / Tier 3 / Hands-On / References
- When set to a tier, sidebar shows only that tier's topics
- Persists during session (in-memory)

**Progress Tracking**

- Each topic and lab has a "Mark as complete" button at the bottom
- Sidebar shows filled circle for completed, empty for not
- Top header shows percentage: "X of Y topics complete (NN%)"
- **In-memory only.** Resets on page reload. This is intentional and documented in the welcome screen

**Tabs Within Topic**

- Concept / Code / Hands-On / Self-Check
- Click switches active tab, content fades in (150ms)
- URL hash updates to allow direct linking: `#t1-03/hands-on`
- Keyboard: `1`, `2`, `3`, `4` switch tabs when focused on the topic

**Code Copy Buttons**

- Top-right of every code block
- On click, copies code to clipboard, button shows checkmark + "Copied!" for 1.5 seconds
- Falls back gracefully if clipboard API unavailable

**Self-Check Reveal**

- Each question is a card with the question visible and answer hidden
- Click "Show answer" to reveal
- Answer fades in
- "Hide" button to collapse again

**Anchor Links on Headings**

- Every h2 and h3 has a clickable "#" link beside it on hover
- Clicking copies the deep link to clipboard

**On This Page (right sidebar, desktop)**

- Auto-generated from h2 and h3 of current topic
- Active heading highlighted in burgundy as user scrolls
- Smooth scroll on click

**Print View**

- `window.print()` triggered by a print icon in the top header
- CSS `@media print` strips sidebars, navigation, code copy buttons
- Code blocks print with light background, dark text
- Each topic prints starting on a new page

### 7.2 Optional Features (Nice-to-Have)

- Keyboard shortcut `j` and `k` for previous/next topic
- A "shuffle" button that picks a random self-check question across all topics (drilling mode)
- A "study session" mode that hides the sidebar and shows topics one at a time
- Time-spent-per-topic counter (in-memory)

---

## 8. File Structure

Recommended structure for the Claude Code project:

```
awfs-elsa-academy/
├── SPEC.md                    # this document
├── README.md                  # quick-start instructions
├── index.html                 # the deliverable (single-file build target)
├── src/
│   ├── index.html             # entry HTML
│   ├── styles/
│   │   ├── main.css           # design system, layout
│   │   ├── prism-agit.css     # custom Prism theme (AGIT colors)
│   │   └── print.css          # print stylesheet
│   ├── scripts/
│   │   ├── app.js             # main app logic (router, state, render)
│   │   ├── search.js          # client-side search
│   │   ├── tabs.js            # tab switching
│   │   └── progress.js        # in-memory progress tracking
│   └── content/
│       ├── tier-1/
│       │   ├── 01-mental-model.json
│       │   ├── 02-programmatic-workflows.json
│       │   ├── ... (one JSON per topic)
│       ├── tier-2/
│       │   ├── 01-expression-languages.json
│       │   ├── ...
│       ├── tier-3/
│       │   ├── ...
│       ├── labs/
│       │   ├── 01-environment-setup.json
│       │   ├── ...
│       ├── cheat-sheet.json
│       └── glossary.json
├── build/
│   └── build.js               # optional: concatenate src/ into single index.html
└── tests/
    ├── content-validation.js  # ensure every topic has all 4 tabs
    └── link-checker.js        # ensure all internal links resolve
```

**Content JSON shape** (per topic):

```json
{
  "id": "t1-03",
  "tier": 1,
  "title": "Persistence and Bookmarks",
  "slug": "persistence-and-bookmarks",
  "estimatedMinutes": 45,
  "prerequisites": ["t1-01", "t1-02"],
  "tabs": {
    "concept": "<markdown or HTML content>",
    "code": [
      {
        "language": "csharp",
        "title": "Configure EF Core with PostgreSQL",
        "code": "...",
        "explanation": "..."
      }
    ],
    "handsOn": {
      "goal": "...",
      "steps": ["...", "..."],
      "verification": ["...", "..."],
      "pitfalls": ["...", "..."]
    },
    "selfCheck": [
      {
        "question": "...",
        "answer": "...",
        "depth": "tier1"
      }
    ]
  }
}
```

The build step (optional) concatenates everything into a single `index.html` for the final deliverable. During development, the site can load JSON content via fetch from `src/content/`. For the final single-file artifact, content gets inlined as a JS object.

---

## 9. Build Phases (Sprints)

The work is broken into **5 sprints** so iteration is manageable. Each sprint produces a working artifact you can review.

### Sprint 1: Skeleton and Design System (estimated 1 day)

- Set up project structure
- Implement `main.css` with all design tokens (colors, fonts, type scale)
- Build the static layout: header, sidebar, main, right sidebar, footer
- Wire Google Fonts and Prism.js via CDN
- Build the welcome / landing page content
- Implement responsive breakpoints
- **Deliverable:** A pixel-perfect empty site with navigation, no content yet. AGIT branding visible. Mobile-responsive.

**Acceptance:**

- Layout matches design spec on desktop, tablet, mobile
- All AGIT colors and fonts loaded
- Empty sidebar shows tier sections (no topics yet)
- Welcome page reads cleanly

### Sprint 2: Tier 1 Content + Tab System (estimated 2 days)

- Implement the topic page template with 4 tabs
- Implement tab switching, deep-link to specific tab
- Write all 9 Tier 1 topics in full
- Wire syntax highlighting on all code blocks
- Implement code copy buttons
- Implement self-check reveal mechanism
- Implement progress checkbox at bottom of each topic
- Implement previous/next navigation between topics
- **Deliverable:** Tier 1 fully readable and usable end-to-end.

**Acceptance:**

- All 9 Tier 1 topics complete (concept + code + hands-on + self-check)
- Tabs switch smoothly with URL hash update
- Code blocks have working copy buttons
- Self-check questions reveal answers correctly
- Progress checkboxes update sidebar indicators

### Sprint 3: Tier 2 Content + Search (estimated 2 days)

- Write all 7 Tier 2 topics in full
- Implement client-side search (build search index from all topic content)
- Implement tier filter dropdown
- Implement the right sidebar "On this page"
- Implement print stylesheet
- **Deliverable:** Tier 1 and Tier 2 complete. Search works across all loaded content.

**Acceptance:**

- Search finds topics by title, concept text, code, self-check
- Tier filter hides/shows correctly
- Right sidebar updates as user scrolls within a topic
- Print view strips chrome correctly

### Sprint 4: Tier 3 + Hands-On Labs (estimated 2 days)

- Write all 5 Tier 3 topics
- Write all 7 hands-on labs
- Implement labs as a separate section with its own template (more emphasis on step-by-step, verification checklist, code repo structure)
- Cross-link labs to their prerequisite topics
- **Deliverable:** Full content coverage across tiers and labs.

**Acceptance:**

- All Tier 3 topics complete
- All 7 labs complete with goal, prereqs, steps, verification, pitfalls
- Cross-links between labs and topics resolve correctly

### Sprint 5: Cheat Sheet, Glossary, Polish, Bundle (estimated 1 day)

- Write the 20-question CTO cheat sheet
- Write the glossary (around 30 terms)
- Implement the optional features (keyboard nav, shuffle, study mode, time tracking) if time permits
- Run accessibility audit, fix issues
- Run performance audit, optimize if needed
- Build the single-file `index.html` for the final deliverable
- Write `README.md` with quick-start
- **Deliverable:** Production-ready single-file site.

**Acceptance:**

- Cheat sheet has all 20 questions with concise answers
- Glossary has at least 30 terms
- Lighthouse Performance >= 90, Accessibility >= 95
- `index.html` opens directly from filesystem with no build step needed by the user
- `README.md` explains how to update content for future iterations

---

## 10. Acceptance Criteria (Definition of Done)

The project is **done** when all of the following are true:

**Content**

- [ ] All 9 Tier 1 topics have all 4 tabs filled with substantive content
- [ ] All 7 Tier 2 topics complete
- [ ] All 5 Tier 3 topics complete
- [ ] All 7 hands-on labs complete with verification checklists
- [ ] Cheat sheet has 20 questions with answers
- [ ] Glossary has at least 30 terms

**Functionality**

- [ ] Site is a single self-contained `index.html` that runs from filesystem (no server required)
- [ ] No `localStorage`, `sessionStorage`, cookies, or browser storage anywhere
- [ ] No external API calls at runtime (only CDN fetches for fonts, icons, Prism)
- [ ] Search works across all content
- [ ] Tier filter works
- [ ] Progress tracking works in-memory
- [ ] Tabs switch with URL deep-link
- [ ] Code copy buttons work
- [ ] Self-check reveal works
- [ ] Print view works on all topics

**Design**

- [ ] AGIT brand colors used per spec
- [ ] Plus Jakarta Sans body, Fraunces display, JetBrains Mono code
- [ ] Responsive on mobile, tablet, desktop per breakpoints
- [ ] No em dashes anywhere in content
- [ ] No purple gradients, no glassmorphism, no generic AI aesthetics

**Quality**

- [ ] Lighthouse Performance >= 90
- [ ] Lighthouse Accessibility >= 95
- [ ] No console errors in any modern browser
- [ ] All internal links resolve
- [ ] All code samples are syntactically valid C# / JSON / JavaScript

---

## 11. Reference Materials for the Builder

When Claude Code writes content, it should ground itself in these sources. Do not fabricate Elsa behavior or APIs.

**Official Elsa Documentation**

- `https://docs.elsaworkflows.io` — primary reference for Elsa 3.x
- `https://github.com/elsa-workflows/elsa-core` — source code and discussions
- `https://github.com/elsa-workflows/elsa-samples` — example implementations

**Author's writing**

- Sipke Schoorstra (Elsa creator) on Medium

**For AGIT brand and AWFS context**

- AGIT Corporate Identity Guideline 2023
- AWFS pitch deck (separate file, not included here)
- `LEARNINGS.md` from prior architect-led Elsa sessions (separate file)

**For accuracy on code samples**

- Always verify Elsa 3.x API surface before writing example code
- Prefer the latest stable minor version
- Note version explicitly in any code that depends on a specific minor

If a fact is unclear, **mark it as unverified in the content** rather than guessing. The architect would rather see "verify this against current Elsa docs before pitch" than read a confident wrong answer.

---

## 12. Tone and Style Rules for Generated Content

- **No em dashes ever.** Use commas, semicolons, or parentheses
- **Bold key terms** on first appearance in each topic
- **Use headers liberally** (h2 every 200-400 words, h3 every 100-200 words)
- **Bullet lists are fine** for enumerations, but use prose for explanations
- **Avoid hedging language** ("perhaps," "might be," "you could say"). Be direct
- **Write for someone who knows .NET well** but is new to Elsa specifically
- **Connect everything back to AWFS.** Every concept needs a "this matters for TAM because..." sentence
- **Do not use emoji in body content.** OK in tier badges and UI affordances only
- **Honesty over marketing.** If Elsa cannot do something, say so plainly

---

## 13. Open Questions / Clarifications Needed

Before Claude Code starts Sprint 1, the architect should confirm:

1. **AGIT logo asset.** Is there an SVG of the AGIT wordmark to embed, or use a text lockup? (Default: text lockup with custom typography until SVG provided)
2. **Language of content.** Bahasa Indonesia, English, or mixed? (Default: English with Bahasa terms where relevant, e.g., "POA," "Persetujuan," matching AWFS pitch deck convention)
3. **Public hosting.** Will this be hosted somewhere, or strictly local? (Default: strictly local, no hosting concerns)
4. **Future content updates.** Should the JSON content structure prioritize easy non-developer editing? (Default: yes, hence the JSON-per-topic file structure)
5. **Mobile-first or desktop-first.** Most reading happens on mobile, but design has more affordances on desktop. (Default: mobile-first content, desktop-richer chrome)

If these are not answered, Claude Code should proceed with the defaults noted in parentheses and flag the assumption in the README.

---

## 14. How to Hand This Off to Claude Code

1. Create a new directory: `awfs-elsa-academy`
2. Copy this `SPEC.md` into the directory root
3. Open Claude Code in the directory: `claude`
4. First prompt to Claude Code:

> "Read SPEC.md in full. Then start Sprint 1: build the project skeleton, design system, layout, and welcome page per the spec. Do not start content writing yet. When you finish Sprint 1, stop and let me review before Sprint 2."

5. Review at the end of each sprint
6. Iterate on content within a sprint by asking Claude Code to revise specific topics

This sprint-by-sprint approach keeps each iteration small enough to review thoroughly and keeps you in control.

---

**End of specification.**

This document is the contract between the architect and Claude Code. Any deviation should be flagged in a `DECISIONS.md` log so the architect knows what was changed and why.
