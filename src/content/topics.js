/**
 * AWFS Elsa Academy: All topic content.
 * Format: JS module (works on file:// without a server).
 * Code samples target Elsa Workflows 3.x. Items marked [verify]
 * should be confirmed against current docs before the TAM pitch.
 */

const topics = [

  /* ===========================================================
     T1-01: Mental Model and Setup
     =========================================================== */
  {
    id: 't1-01',
    tier: 1,
    title: 'Mental Model and Setup',
    slug: 'mental-model-and-setup',
    estimatedMinutes: 50,
    prerequisites: [],
    tabs: {

      concept: `
<h2 id="what-is-a-workflow-engine">What is a workflow engine?</h2>
<p>A <strong>workflow engine</strong> is a runtime that executes a predefined graph of activities, one step at a time. Unlike a procedural function call that runs synchronously from start to finish in memory, a workflow can <em>suspend</em> indefinitely and resume later, potentially on a different machine or after a process restart.</p>
<p>Elsa Workflows 3.x is a .NET workflow engine. You define workflows as a graph of <strong>activities</strong> (the nodes). The <strong>Elsa runtime</strong> loads a workflow definition, creates a <strong>workflow instance</strong> (a running copy of that definition), and walks the graph, executing each activity in sequence or in parallel depending on the graph structure.</p>

<h2 id="three-core-concepts">The three core concepts</h2>
<h3 id="bookmarks">Bookmarks</h3>
<p>A <strong>bookmark</strong> is a saved position in the workflow graph. When an activity needs to wait for something external (an approver's click, a timer expiry, a message from another system), it calls <code>Suspend</code>. Elsa serializes the current execution state to the persistence store and writes a bookmark record that identifies where to resume. The bookmark contains the activity ID, the expected trigger type, and an optional payload the resuming signal must provide.</p>
<p>Think of a bookmark as a dog-eared page: it tells the engine "when signal X arrives, open to activity Y and continue." Without bookmarks, a long-running workflow would require the host process to remain alive for hours or days, which is both impractical and fragile.</p>

<h3 id="persistence">Persistence</h3>
<p><strong>Persistence</strong> means the workflow's in-memory state is serialized to a database. After a workflow suspends and the host process restarts, the engine queries the bookmark table for matching signals. When a signal arrives, the engine loads the serialized instance state, reconstructs the in-memory execution context, and resumes from the bookmarked activity.</p>
<p>This is fundamentally different from a web API handler that lives only for the duration of an HTTP request. Elsa workflow instances are durable: their state outlives the host process. AWFS persistence stores are covered in detail in T1-03 and T1-07.</p>

<h3 id="triggers">Triggers and resumption</h3>
<p>A <strong>trigger</strong> is anything that either starts a new workflow instance or resumes a suspended one. Triggers include an inbound HTTP request, a timer expiry, an explicit signal from application code, or a message arriving on a queue. The runtime matches incoming triggers against the bookmark table. If a match is found, the corresponding instance resumes. If no match is found but the trigger matches a workflow definition's start activity, a new instance is created.</p>

<h2 id="awfs-connection">Why AWFS needs this model</h2>
<p>Approval workflows at Toyota-Astra Motor are inherently long-running. A purchase order approval might be submitted on Monday and not acted on until Thursday. The first approver might be on leave and delegate (POA, Persetujuan) to a deputy in a different timezone. SLA escalation must fire after 24 hours with no decision. Multi-level approvals require the workflow to suspend after each level and resume only after a decision is recorded.</p>
<p>None of this can be modeled as a synchronous function call. Elsa's bookmark-plus-persistence model gives AWFS exactly what it needs: a workflow that starts when a document is submitted, suspends at each approval gate, resumes when a decision arrives via the approval UI, and escalates automatically if no decision comes in time. Pending approvals survive server reboots because their state lives in PostgreSQL, not in application memory.</p>
`,

      code: [
        {
          language: 'xml',
          title: 'NuGet package references',
          filename: 'awfs-elsa-lab.csproj',
          code: `<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <ItemGroup>
    <!-- Core Elsa meta-package -->
    <PackageReference Include="Elsa" Version="3.*-*" />
    <!-- EF Core persistence with PostgreSQL -->
    <PackageReference Include="Elsa.EntityFrameworkCore.PostgreSql" Version="3.*-*" />
    <!-- REST API endpoints for workflow management -->
    <PackageReference Include="Elsa.Http" Version="3.*-*" />
  </ItemGroup>

</Project>`,
          explanation: 'The <code>Elsa</code> meta-package pulls in the workflow engine core. <code>Elsa.EntityFrameworkCore.PostgreSql</code> adds the EF Core persistence provider wired to PostgreSQL (the right choice for AWFS). Version wildcards <code>3.*-*</code> allow pre-release 3.x packages; pin to a specific version before production.'
        },
        {
          language: 'csharp',
          title: 'Minimal Elsa host',
          filename: 'Program.cs',
          code: `using Elsa.EntityFrameworkCore.Extensions;
using Elsa.EntityFrameworkCore.Modules.Management;
using Elsa.EntityFrameworkCore.Modules.Runtime;
using Elsa.Extensions;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration
    .GetConnectionString("Postgres")
    ?? throw new InvalidOperationException("Postgres connection string missing");

builder.Services.AddElsa(elsa =>
{
    // Persist workflow definitions and instances to PostgreSQL
    elsa.UseWorkflowManagement(management =>
        management.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));

    // Persist bookmarks and execution log to PostgreSQL
    elsa.UseWorkflowRuntime(runtime =>
        runtime.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));

    // HTTP trigger and send-request activities
    elsa.UseHttp();
});

var app = builder.Build();

// Apply EF Core schema migrations at startup [verify: check migration extension name]
await app.Services.ApplyMigrationsAsync();

app.UseRouting();
app.UseWorkflowsApi();   // REST endpoints for management
app.UseWorkflows();      // Middleware for HTTP-triggered workflows

await app.RunAsync();`,
          explanation: 'Elsa 3.x splits configuration into modules. <code>UseWorkflowManagement</code> handles workflow definitions and instances; <code>UseWorkflowRuntime</code> handles bookmarks and execution. Both are pointed at the same PostgreSQL database. <code>ApplyMigrationsAsync</code> runs EF Core schema migrations on boot. Mark <strong>[verify]</strong> against current Elsa 3.x docs before using in production.'
        },
        {
          language: 'yaml',
          title: 'PostgreSQL via Docker',
          filename: 'docker-compose.yml',
          code: `version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: awfs_elsa
      POSTGRES_USER: awfs
      POSTGRES_PASSWORD: awfs_dev_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U awfs -d awfs_elsa"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:`,
          explanation: 'Spin up a local PostgreSQL 16 instance for development. The health check ensures the container is ready before your app tries to connect. Run with <code>docker compose up -d</code>.'
        },
        {
          language: 'json',
          title: 'Connection string configuration',
          filename: 'appsettings.Development.json',
          code: `{
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Port=5432;Database=awfs_elsa;Username=awfs;Password=awfs_dev_password"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Elsa": "Debug"
    }
  }
}`,
          explanation: 'Keep credentials out of source control. In production, supply the connection string via environment variable or Azure Key Vault. The <code>Elsa: Debug</code> log level emits verbose engine trace, which is invaluable during initial development.'
        }
      ],

      handsOn: {
        goal: 'Create the <strong>awfs-elsa-lab</strong> repository, configure a local .NET 9 + PostgreSQL + Elsa 3.x environment, and verify the host boots cleanly with no errors.',
        steps: [
          'Install prerequisites: <code>.NET 9 SDK</code> (check with <code>dotnet --version</code>) and <code>Docker Desktop</code> (check with <code>docker --version</code>).',
          'Create the project directory and initialize git: <code>mkdir awfs-elsa-lab && cd awfs-elsa-lab && git init</code>',
          'Scaffold a new Web project: <code>dotnet new web -n AwfsElsaLab --framework net9.0</code>',
          'Add the NuGet packages: <code>dotnet add package Elsa --version 3.*-*</code> and <code>dotnet add package Elsa.EntityFrameworkCore.PostgreSql --version 3.*-*</code>',
          'Create the <code>docker-compose.yml</code> from the Code tab and start PostgreSQL: <code>docker compose up -d</code>. Wait for the health check to pass: <code>docker compose ps</code>.',
          'Replace <code>Program.cs</code> with the minimal Elsa host from the Code tab. Add <code>appsettings.Development.json</code> with the connection string.',
          'Run the application: <code>dotnet run</code>. Watch the console for "Now listening on..." and no error messages. The first run applies EF Core migrations; expect a few seconds of schema creation output.',
          'Open a PostgreSQL client (pgAdmin or <code>psql</code>) and verify the Elsa tables were created: you should see tables including <code>WorkflowDefinitions</code>, <code>WorkflowInstances</code>, <code>Bookmarks</code>, and <code>ActivityExecutionRecords</code>.',
          'Commit: <code>git add . && git commit -m "chore: initial Elsa 3.x host with PostgreSQL"</code>'
        ],
        verification: [
          '<code>dotnet run</code> starts without exception and prints the listening URL',
          'PostgreSQL tables for Elsa are visible in pgAdmin or psql',
          'Navigating to <code>http://localhost:5000/elsa/api/workflow-definitions</code> returns an empty JSON array (not a 404 or 500)',
          'Re-running <code>dotnet run</code> after stopping and restarting produces no migration errors (idempotent)'
        ],
        pitfalls: [
          '<strong>Docker Desktop not running.</strong> <code>docker compose up</code> fails silently or with a daemon error. Confirm Docker Desktop is started before running compose.',
          '<strong>Port 5432 already in use.</strong> A local PostgreSQL installation may be listening. Change the host port in docker-compose.yml to <code>5433:5432</code> and update the connection string accordingly.',
          '<strong>Version mismatch.</strong> Elsa 3.x package names changed between minor releases. If <code>UseWorkflowManagement</code> is not found, check the current API in the Elsa GitHub README for your installed version.',
          '<strong>Migration not applied.</strong> If the app starts but returns 500 on the API endpoint, the schema may not have been created. Verify <code>ApplyMigrationsAsync</code> is called and that the connection string is correct.'
        ]
      },

      selfCheck: [
        {
          question: 'What is a bookmark in Elsa, and what information does it store?',
          answer: '<p>A <strong>bookmark</strong> is a persistent record that marks a suspension point in a workflow instance. It stores the workflow instance ID, the ID of the activity that created it, the trigger type that will resume it (for example, an HTTP request or an event signal), and an optional payload hash for matching. When the matching trigger arrives, the runtime looks up the bookmark, loads the workflow instance, and resumes execution at the bookmarked activity.</p>'
        },
        {
          question: 'What happens when an activity calls Suspend?',
          answer: '<p>Calling <code>Suspend</code> instructs Elsa to stop executing the current workflow instance and serialize its state to the persistence store. A bookmark record is written. The in-memory execution context is released. The host process thread is freed immediately. The workflow instance stays in a "Suspended" state in the database until a matching trigger arrives and resumes it.</p><p>Critically, the host process does not wait. It can serve other requests or be restarted entirely. The workflow will resume correctly as long as the database state is intact.</p>'
        },
        {
          question: 'What is the difference between a workflow definition and a workflow instance?',
          answer: '<p>A <strong>workflow definition</strong> is the template: it describes the graph of activities, their connections, and their configuration. It is analogous to a class in object-oriented programming. A <strong>workflow instance</strong> is a running copy of that definition, analogous to an object. Multiple instances can be running from the same definition simultaneously, each with its own state, variables, and bookmark positions. Changing the definition does not retroactively change running instances (see T1-09 for the full versioning story).</p>'
        },
        {
          question: 'Why does AWFS need workflow persistence even for approvals that are completed in minutes?',
          answer: '<p>Even if an approval is completed in five minutes, the AWFS host might be redeployed, restarted due to a crash, or scaled across multiple nodes during those five minutes. Without persistence, the in-flight approval state would be lost. More importantly, the 24-hour SLA escalation timer requires the workflow to survive host restarts by definition. Designing for the short path but not for persistence introduces a hidden failure mode that is very hard to detect in testing and very damaging in production.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-02: Programmatic Workflows
     =========================================================== */
  {
    id: 't1-02',
    tier: 1,
    title: 'Programmatic Workflows (Authoring in C#)',
    slug: 'programmatic-workflows',
    estimatedMinutes: 45,
    prerequisites: ['t1-01'],
    tabs: {

      concept: `
<h2 id="three-authoring-modes">The three authoring modes</h2>
<p>Elsa supports three ways to define a workflow. <strong>Programmatic</strong> authoring writes the workflow as C# code, typically by extending <code>WorkflowBase</code> and overriding the <code>Build</code> method. <strong>JSON/DSL</strong> authoring expresses the workflow as a JSON document that the engine loads at runtime. <strong>Visual</strong> authoring uses Elsa Studio, a browser-based designer that generates JSON behind the scenes.</p>
<p>For AWFS, programmatic is the foundation. Every concept you learn in C# translates directly to JSON and visual authoring. Understand programmatic first; the other two become obvious.</p>

<h2 id="workflowbase">WorkflowBase and the Build method</h2>
<p>To define a workflow programmatically, extend <code>WorkflowBase</code> and override <code>Build(IWorkflowBuilder builder)</code>. Inside <code>Build</code> you compose activities into a graph and assign it to <code>builder.Root</code>. The root activity is the entry point; execution begins there.</p>
<p><strong>Composite activities</strong> are activities that contain other activities. The most important ones are:</p>
<ul>
  <li><strong>Sequence</strong>: executes its child activities in order, one after another.</li>
  <li><strong>Parallel</strong>: starts all children simultaneously and waits for all to complete.</li>
  <li><strong>If</strong>: evaluates a condition and branches to either a <code>Then</code> or <code>Else</code> activity.</li>
  <li><strong>ForEach</strong>: iterates over a collection, executing its body for each item.</li>
</ul>

<h2 id="variables-inputs-outputs">Variables, Inputs, and Outputs</h2>
<p>A <strong>Variable&lt;T&gt;</strong> is a typed slot that persists in the workflow instance's state between activities. You declare it outside the activity tree and reference it from multiple activities. This is the primary way to pass data between steps in a programmatic workflow.</p>
<p><strong>Input&lt;T&gt;</strong> and <strong>Output&lt;T&gt;</strong> are different: they belong to a single activity and describe what that activity receives and produces. An activity's <code>Input&lt;T&gt;</code> can be bound to a <code>Variable&lt;T&gt;</code>, a literal value, or a dynamic expression. <code>Output&lt;T&gt;</code> captures what the activity produces so the next activity can consume it.</p>
<p>For AWFS, Variables hold the approval request payload, approver decisions, and delegation chains throughout a potentially multi-day workflow. Keep them typed and named clearly.</p>

<h2 id="running-a-workflow">Running a workflow</h2>
<p>Register your workflow class with the DI container using <code>elsa.AddWorkflow&lt;MyWorkflow&gt;()</code>. Inject <code>IWorkflowRunner</code> where you need to start a workflow, then call <code>RunAsync</code>. For long-running workflows, prefer <code>IWorkflowDispatcher</code> which fires without waiting for the result (covered in T3-05).</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'Hello-world sequential workflow',
          filename: 'HelloWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

public class HelloWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("Step 1: AWFS request received"),
                new WriteLine("Step 2: Routing to first approver"),
                new WriteLine("Step 3: Workflow complete")
            }
        };
    }
}`,
          explanation: '<code>WorkflowBase</code> is the base class for all programmatic workflows. <code>Build</code> is called once when the definition is registered. <code>Sequence</code> runs its children in order. <code>WriteLine</code> is a built-in activity that writes to the workflow execution log.'
        },
        {
          language: 'csharp',
          title: 'Using Variables to pass data between activities',
          filename: 'VariableWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;

public class ApprovalInputWorkflow : WorkflowBase
{
    // Declare a typed variable shared across activities
    private readonly Variable<string> _requestId = new();
    private readonly Variable<string> _decision  = new();

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Variables = { _requestId, _decision },
            Activities =
            {
                // Read the workflow input and store in a variable
                new SetVariable<string>
                {
                    Variable = _requestId,
                    Value    = new(context => context.GetInput<string>("requestId"))
                },

                new WriteLine(context =>
                    $"Processing request: {_requestId.Get(context)}"),

                // Simulate a decision (in real AWFS, this would be a suspend point)
                new SetVariable<string>
                {
                    Variable = _decision,
                    Value    = new(_ => "approved")
                },

                new WriteLine(context =>
                    $"Decision for {_requestId.Get(context)}: {_decision.Get(context)}")
            }
        };
    }
}`,
          explanation: 'Variables are declared as fields on the workflow class and registered in the <code>Variables</code> collection of the composite activity that owns them. <code>context.GetInput&lt;T&gt;</code> reads a named workflow input passed at start time. Lambda expressions like <code>new(context =&gt; ...)</code> create dynamic values evaluated at runtime, not at build time.'
        },
        {
          language: 'csharp',
          title: 'Conditional branching with If',
          filename: 'ConditionalWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;

public class ApproveOrRejectWorkflow : WorkflowBase
{
    private readonly Variable<string> _action = new();

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Variables = { _action },
            Activities =
            {
                new SetVariable<string>
                {
                    Variable = _action,
                    Value    = new(ctx => ctx.GetInput<string>("action"))
                },

                new If(ctx => _action.Get(ctx) == "approve")
                {
                    Then = new WriteLine("Document APPROVED. Notifying requester."),
                    Else = new WriteLine("Document REJECTED. Returning to requester.")
                }
            }
        };
    }
}`,
          explanation: '<code>If</code> takes a boolean condition as a lambda. The lambda receives the current <code>ActivityExecutionContext</code> so it can read variables. <code>Then</code> and <code>Else</code> can each be any activity, including another <code>Sequence</code> for multi-step branches.'
        },
        {
          language: 'csharp',
          title: 'Registering and running the workflow',
          filename: 'Program.cs (additions)',
          code: `// In Program.cs, register your workflow in AddElsa:
builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(mgmt => mgmt.UseEntityFrameworkCore(...));
    elsa.UseWorkflowRuntime(rt => rt.UseEntityFrameworkCore(...));

    // Register the workflow definition
    elsa.AddWorkflow<ApproveOrRejectWorkflow>();
});

// --- In a controller or minimal API endpoint: ---
app.MapPost("/run-test", async (IWorkflowRunner runner) =>
{
    var result = await runner.RunAsync(new ApproveOrRejectWorkflow(), new RunWorkflowOptions
    {
        Input = new Dictionary<string, object>
        {
            ["action"] = "approve"
        }
    });

    return Results.Ok(new { result.Status });
});`,
          explanation: 'Register the workflow with <code>AddWorkflow&lt;T&gt;</code> during startup. <code>IWorkflowRunner.RunAsync</code> starts a new instance synchronously (waiting for the first suspend or completion). Pass named inputs via the <code>Input</code> dictionary. For fire-and-forget dispatch, use <code>IWorkflowDispatcher</code> instead (T3-05). [verify: RunWorkflowOptions shape in current 3.x release]'
        }
      ],

      handsOn: {
        goal: 'Build a workflow that reads a string input, branches on "approve" or "reject", and logs the result. Run it three times with different inputs to confirm the branch logic works.',
        steps: [
          'In your <code>awfs-elsa-lab</code> project, create <code>Workflows/ApproveOrRejectWorkflow.cs</code> using the <code>ConditionalWorkflow</code> code sample from the Code tab.',
          'Register the workflow in <code>Program.cs</code> by adding <code>elsa.AddWorkflow&lt;ApproveOrRejectWorkflow&gt;()</code> inside the <code>AddElsa</code> call.',
          'Add a test endpoint to <code>Program.cs</code>: <code>app.MapPost("/test-decision", async (string action, IWorkflowRunner runner) =&gt; { ... })</code> that accepts an <code>action</code> query parameter and runs the workflow.',
          'Run the application: <code>dotnet run</code>.',
          'Test with approve: <code>curl -X POST "http://localhost:5000/test-decision?action=approve"</code>. Check the console output for "Document APPROVED".',
          'Test with reject: <code>curl -X POST "http://localhost:5000/test-decision?action=reject"</code>. Check for "Document REJECTED".',
          'Test with an unexpected value (for example <code>action=pending</code>). Observe that the Else branch fires. Note: in real AWFS you would validate input before reaching the workflow.',
          'Inspect the <code>ActivityExecutionRecords</code> table in pgAdmin. Observe that a new row was written for each activity execution.'
        ],
        verification: [
          'Each of the three test runs produces the correct log message in the console',
          'No exceptions appear in the host output',
          '<code>WorkflowInstances</code> table gains one row per test run, each with status "Finished"',
          '<code>ActivityExecutionRecords</code> shows execution records for every activity in the sequence'
        ],
        pitfalls: [
          '<strong>GetInput returns null.</strong> The input key is case-sensitive. <code>"action"</code> and <code>"Action"</code> are different. Match the key exactly between the endpoint and the <code>GetInput</code> call.',
          '<strong>Workflow not found at runtime.</strong> If you forget <code>elsa.AddWorkflow&lt;T&gt;()</code>, the runner will throw an exception. Every workflow class must be explicitly registered.',
          '<strong>Lambda evaluated at build time.</strong> Do not put runtime-dependent code (database calls, configuration reads) in the <code>Build</code> method. It runs once at startup. Use activity lambdas for runtime evaluation.'
        ]
      },

      selfCheck: [
        {
          question: 'When would you choose programmatic authoring over JSON authoring for AWFS?',
          answer: '<p>Programmatic authoring is the right choice when the workflow structure is fixed at development time, when you want compile-time type safety, and when the workflow is part of the AGIT-provided engine layer (not user-configurable). Use it for the core AWFS approval patterns: multi-level sequential approval, SLA escalation, POA delegation logic. JSON authoring is more appropriate for workflow configurations that TAM\'s IT operations team will create or modify at runtime using the AWFS wizard, without redeploying code.</p>'
        },
        {
          question: 'What is the role of Variable&lt;T&gt; in a workflow, and how does it differ from a workflow Input?',
          answer: '<p>A <code>Variable&lt;T&gt;</code> is a typed slot in the workflow instance\'s persistent state. It can be read and written by any activity inside the workflow and lives as long as the instance lives. It persists through suspend/resume cycles. A workflow <strong>Input</strong> is data passed in from outside when the workflow is started; it is read-only and available at start time. Think of <code>Variable&lt;T&gt;</code> as local variables within the workflow, and Input as method parameters passed to the workflow from the caller.</p>'
        },
        {
          question: 'How do Input&lt;T&gt; and Output&lt;T&gt; on an activity differ from Variable&lt;T&gt;?',
          answer: '<p><code>Input&lt;T&gt;</code> and <code>Output&lt;T&gt;</code> are activity-level descriptors. <code>Input&lt;T&gt;</code> declares what value an activity expects to receive, and it can be bound to a <code>Variable&lt;T&gt;</code>, a literal, or a dynamic expression. <code>Output&lt;T&gt;</code> declares what value the activity produces, and it can be captured into a <code>Variable&lt;T&gt;</code> for use in subsequent activities. They are the interface contract of a single activity, while <code>Variable&lt;T&gt;</code> is shared state that crosses activity boundaries inside a workflow.</p>'
        },
        {
          question: 'What is a composite activity and why does AWFS need them?',
          answer: '<p>A <strong>composite activity</strong> is an activity that contains and orchestrates other activities. Examples include <code>Sequence</code>, <code>Parallel</code>, <code>If</code>, and <code>ForEach</code>. AWFS needs them because an approval workflow is not a single action: it is a sequence of steps (submit, route, notify, wait for decision, escalate if late, notify result) that may branch based on the outcome. Composite activities are how you express that branching and sequencing structure in code without coupling the individual actions to each other.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-03: Persistence and Bookmarks
     =========================================================== */
  {
    id: 't1-03',
    tier: 1,
    title: 'Persistence and Bookmarks',
    slug: 'persistence-and-bookmarks',
    estimatedMinutes: 55,
    prerequisites: ['t1-01', 't1-02'],
    tabs: {

      concept: `
<h2 id="what-bookmarks-store">What a bookmark record contains</h2>
<p>Every time a workflow suspends, Elsa writes a <strong>bookmark record</strong> to the persistence store. The record includes: the workflow instance ID, the activity ID that suspended (so the runtime knows where to resume), the <strong>trigger type</strong> (a string identifying the class of event that will resume it, such as <code>"HttpEndpointBookmarkPayload"</code> or <code>"EventBookmarkPayload"</code>), and a <strong>correlation payload hash</strong> used for fast lookup when a matching trigger fires.</p>
<p>When a trigger arrives (a POST to an endpoint, a timer firing, an explicit signal), the runtime hashes the trigger payload and queries the <code>Bookmarks</code> table for a matching record. If found, it loads the workflow instance, deserializes the execution context, and calls <code>ResumeAsync</code> on the engine, which continues execution from the bookmarked activity.</p>

<h2 id="persistence-providers">Persistence providers</h2>
<p>Elsa 3.x separates persistence into two concerns: <strong>workflow management</strong> (definitions and instances) and <strong>workflow runtime</strong> (bookmarks and execution log). Both can use the same provider but they are configured independently, allowing you to optimize each separately.</p>
<p>Available providers include <strong>EF Core</strong> (PostgreSQL, SQL Server, MySQL, SQLite), <strong>MongoDB</strong>, and <strong>in-memory</strong> (testing only, no durability). For AWFS, PostgreSQL via EF Core is the right choice: TAM has established DBA bench strength for it, it supports transactions that ensure bookmark creation and instance state update are atomic, and it works with the existing AGIT infrastructure.</p>

<h2 id="schema-overview">Schema overview</h2>
<p>After applying migrations, Elsa creates these key tables:</p>
<ul>
  <li><strong>WorkflowDefinitions</strong>: versioned workflow templates. One row per published version.</li>
  <li><strong>WorkflowInstances</strong>: running and completed workflow instances, including the full serialized execution context JSON.</li>
  <li><strong>Bookmarks</strong>: suspension points. This table is queried on every incoming trigger. Keep it indexed.</li>
  <li><strong>ActivityExecutionRecords</strong>: audit log of every activity that executed, with input, output, and status. This is what you show in an AWFS admin view.</li>
</ul>
<p>The <code>WorkflowInstances</code> table grows fastest in a busy system because the execution context JSON can be large for complex workflows. Plan for archiving or pruning completed instances in a production AWFS deployment.</p>

<h2 id="awfs-connection">Persistence decisions for AWFS</h2>
<p>For AWFS specifically: approver assignment data (who is the next approver for request X) belongs in the workflow instance's variable state, not in the bookmark. The bookmark only needs to know "which signal resumes this instance" (the correlation ID of the approval request). The approver's identity, the document payload, and the approval history are all stored in workflow variables and serialized as part of the instance state.</p>
<p>This means the <code>WorkflowInstances</code> table is effectively the source of truth for all in-flight approval state. Your AWFS admin UI can query it directly to show pending approvals, without needing a separate approval database table.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'EF Core with PostgreSQL (management + runtime)',
          filename: 'Program.cs',
          code: `builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(management =>
        management.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));

    elsa.UseWorkflowRuntime(runtime =>
        runtime.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
});`,
          explanation: 'Each Elsa module has its own EF Core DbContext and migration assembly. Configuring both modules to use the same PostgreSQL connection string is correct: EF Core creates distinct table sets per DbContext but they coexist in one database.'
        },
        {
          language: 'csharp',
          title: 'Workflow that creates a bookmark via Event activity',
          filename: 'PersistenceTestWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;

public class SuspendAndResumeWorkflow : WorkflowBase
{
    private readonly Variable<string> _correlationId = new();

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Variables = { _correlationId },
            Activities =
            {
                new SetVariable<string>
                {
                    Variable = _correlationId,
                    Value    = new(ctx => ctx.GetInput<string>("correlationId"))
                },

                new WriteLine(ctx =>
                    $"Workflow started. Waiting for approval of {_correlationId.Get(ctx)}"),

                // This activity suspends and creates a bookmark.
                // Resume by sending a signal with the matching event name.
                new Event("ApprovalReceived"),

                new WriteLine("Approval signal received. Workflow resuming."),
                new WriteLine(ctx =>
                    $"Processing final outcome for {_correlationId.Get(ctx)}")
            }
        };
    }
}`,
          explanation: 'The <code>Event</code> activity is the standard way to create a named bookmark. It suspends the workflow until a signal named <code>"ApprovalReceived"</code> is dispatched externally. This is the pattern AWFS uses for each approval gate: the workflow suspends waiting for a human decision, and the approval UI sends the signal when the approver acts.'
        },
        {
          language: 'bash',
          title: 'Inspecting Elsa tables in psql',
          filename: 'psql commands',
          code: `-- Connect to the Elsa database
psql -h localhost -U awfs -d awfs_elsa

-- List all Elsa tables
\\dt

-- View running workflow instances
SELECT id, "DefinitionId", "Status", "CreatedAt"
FROM "WorkflowInstances"
WHERE "Status" = 'Running'
ORDER BY "CreatedAt" DESC;

-- View active bookmarks
SELECT "WorkflowInstanceId", "Name", "ActivityId", "CreatedAt"
FROM "Bookmarks"
ORDER BY "CreatedAt" DESC;

-- View execution log for a specific instance
SELECT "ActivityId", "ActivityType", "Status", "StartedAt", "CompletedAt"
FROM "ActivityExecutionRecords"
WHERE "WorkflowInstanceId" = 'your-instance-id-here'
ORDER BY "StartedAt";`,
          explanation: 'Direct SQL inspection is the fastest way to understand what Elsa is doing at the persistence layer. Run these queries while a workflow is suspended to see its bookmark. Run them after completion to verify all activities executed.'
        }
      ],

      handsOn: {
        goal: 'Build a workflow that suspends on an <code>Event</code> bookmark, survive a host restart with the bookmark intact, and resume via a REST signal. Inspect the bookmark row before and after resumption.',
        steps: [
          'Add <code>SuspendAndResumeWorkflow</code> from the Code tab to your lab project. Register it with <code>elsa.AddWorkflow&lt;SuspendAndResumeWorkflow&gt;()</code>.',
          'Add a start endpoint: <code>app.MapPost("/start", async (string correlationId, IWorkflowRunner runner) =&gt; { ... })</code> that runs the workflow with <code>correlationId</code> as input.',
          'Run the app: <code>dotnet run</code>. Start a workflow instance: <code>curl -X POST "http://localhost:5000/start?correlationId=REQ-001"</code>. Observe the console log "Workflow started. Waiting for approval...".',
          'Query the <code>Bookmarks</code> table in psql. Confirm a row exists with <code>Name = "ApprovalReceived"</code>.',
          '<strong>Stop the host process.</strong> This simulates a deployment or crash. The bookmark row should remain in the database.',
          'Restart the host: <code>dotnet run</code>. Query the <code>Bookmarks</code> table again. Confirm the bookmark survived the restart.',
          'Add a resume endpoint: <code>app.MapPost("/resume", async (string correlationId, IEventPublisher publisher) =&gt; { await publisher.PublishAsync("ApprovalReceived", correlationId); })</code> [verify: IEventPublisher API in current 3.x].',
          'Call the resume endpoint: <code>curl -X POST "http://localhost:5000/resume?correlationId=REQ-001"</code>. Observe the console: "Approval signal received. Workflow resuming."',
          'Query <code>Bookmarks</code> again: the row should be gone. Query <code>WorkflowInstances</code>: the status should be "Finished".'
        ],
        verification: [
          'Console shows "Workflow started. Waiting..." after the start call',
          'A row exists in <code>Bookmarks</code> before resumption',
          'The bookmark row survives a host restart',
          'After the resume call, the console shows the completion log line',
          '<code>Bookmarks</code> row is deleted, <code>WorkflowInstances</code> status is "Finished"'
        ],
        pitfalls: [
          '<strong>Event name case-sensitive.</strong> The event name in the <code>Event</code> activity and in the <code>PublishAsync</code> call must match exactly. "ApprovalReceived" and "approvalReceived" are different.',
          '<strong>Correlation ID mismatch.</strong> If the resume signal uses a different correlation ID than the start, the bookmark will not be matched and the workflow stays suspended indefinitely. Log correlation IDs at every step during development.',
          '<strong>Multiple matching bookmarks.</strong> If you start two instances with the same correlation ID, both will have matching bookmarks. The first matching one will resume. Design correlation IDs to be unique per request (for example, use a GUID or the document number).'
        ]
      },

      selfCheck: [
        {
          question: 'What information is stored in a bookmark record, and where is it stored?',
          answer: '<p>A bookmark record stores: the workflow instance ID (so the engine knows which instance to resume), the activity ID that created the bookmark (so the engine knows where to resume within that instance), the trigger type name (a string used for lookup when a signal arrives), and a correlation payload hash (for fast indexed lookup). It is stored in the <code>Bookmarks</code> table in whatever persistence provider is configured: PostgreSQL for AWFS.</p>'
        },
        {
          question: 'What happens to bookmarks if a workflow definition is deleted while instances are still running?',
          answer: '<p>The bookmark records remain in the database and still point to the deleted definition. If a resume signal arrives and the engine tries to load the definition to reconstruct the activity, it will fail with an exception because the definition no longer exists. This is why you should never delete a workflow definition that has active instances. Elsa provides a concept of "retiring" a definition (marking it as not the latest) without deleting it, precisely for this reason. This is covered in T1-09.</p>'
        },
        {
          question: 'How does Elsa decide which bookmark to resume when an event fires?',
          answer: '<p>The engine computes a hash of the incoming trigger\'s payload (including the trigger type and any correlation data) and queries the <code>Bookmarks</code> table for a matching hash. This means the resume signal must provide the same correlation information that was present when the bookmark was created. For <code>Event</code> activities, the event name is part of the hash. For HTTP triggers, the URL path and method are part of it. This is why correlation IDs matter: they are part of the hash that makes each bookmark uniquely addressable.</p>'
        },
        {
          question: 'Where should approver assignment data be stored: in the bookmark or in workflow variables?',
          answer: '<p>In <strong>workflow variables</strong>, not the bookmark. The bookmark only needs to contain the minimum correlation data required to route an incoming signal to the right instance. Approver identity, document payload, approval history, and delegation chains are application state that belongs in typed workflow variables, serialized as part of the <code>WorkflowInstances</code> record. Storing too much in bookmarks makes them slow to query and hard to index. Storing too little in variables means you lose business state if the instance must be inspected or migrated.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-04: Authoring Options
     =========================================================== */
  {
    id: 't1-04',
    tier: 1,
    title: 'Authoring Options (Code, JSON, Visual)',
    slug: 'authoring-options',
    estimatedMinutes: 40,
    prerequisites: ['t1-02'],
    tabs: {

      concept: `
<h2 id="three-modes">Three authoring modes, one runtime</h2>
<p>All three authoring modes produce the same thing at runtime: a <strong>workflow definition</strong> stored in the <code>WorkflowDefinitions</code> table. The engine does not care how the definition was authored; it executes from the stored representation. The choice of authoring mode is about who creates the workflow and when.</p>

<h2 id="programmatic">Mode 1: Programmatic (C#)</h2>
<p>Best for: AGIT-internal engine logic, fixed workflow templates, anything where compile-time type safety matters. The workflow is a C# class that Elsa registers as a definition at startup. Changing it requires a code change and a redeployment.</p>
<p>For AWFS: use programmatic for the core approval engine (multi-level sequential approval with SLA escalation). These are AGIT's intellectual property and should not be editable by TAM's IT operations.</p>

<h2 id="json">Mode 2: JSON / DSL</h2>
<p>Best for: workflow configurations that are stored in the database, can be created or modified at runtime without redeployment, and are the output of the AWFS 4-step wizard. The JSON shape mirrors the C# activity tree: an array of activity objects with their properties and connections.</p>
<p>For AWFS: the wizard generates a JSON workflow definition that TAM's IT department can configure (which approver roles to route to, how many levels, what the SLA timeout is). AGIT deploys the engine; TAM configures the workflows. This is the correct separation of concerns for a SaaS-like product.</p>

<h2 id="visual">Mode 3: Visual (Elsa Studio)</h2>
<p>Best for: AGIT developers building and testing new workflow types visually, and optionally for advanced TAM IT users. Elsa Studio is a React-based designer that talks to the Elsa Server REST API. It reads and writes JSON workflow definitions. Under the hood, dragging activities in the canvas produces the same JSON that Mode 2 writes directly.</p>
<p>For AWFS: Elsa Studio is an internal AGIT tool. It is not the end-user UI for TAM employees. The 4-step wizard (custom UI) is the right user experience for TAM, because it guides non-technical users through a constrained set of choices rather than exposing the full Elsa activity palette.</p>

<h2 id="awfs-wizard">The AWFS wizard and JSON authoring</h2>
<p>The 4-step wizard your team will build collects approval configuration (approver roles, levels, SLA, notification settings) and calls the Elsa management API to POST a new workflow definition JSON. When a business user submits an approval request via the source application, AWFS starts an instance of the matching workflow definition. This is the runtime loop: wizard creates JSON definition, user action triggers JSON-defined instance.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'The same workflow in C# (programmatic)',
          filename: 'DecisionWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;

public class DecisionWorkflow : WorkflowBase
{
    private readonly Variable<string> _action = new();

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Variables = { _action },
            Activities =
            {
                new SetVariable<string>
                {
                    Variable = _action,
                    Value    = new(ctx => ctx.GetInput<string>("action"))
                },
                new If(ctx => _action.Get(ctx) == "approve")
                {
                    Then = new WriteLine("Approved"),
                    Else = new WriteLine("Rejected")
                }
            }
        };
    }
}`,
          explanation: 'The C# version: type-safe, discoverable via IntelliSense, redeployed when changed. Good for engine-layer logic.'
        },
        {
          language: 'json',
          title: 'The same workflow expressed as JSON',
          filename: 'decision-workflow.json',
          code: `{
  "id": "decision-workflow-v1",
  "definitionId": "decision-workflow",
  "name": "DecisionWorkflow",
  "version": 1,
  "isLatest": true,
  "isPublished": true,
  "root": {
    "type": "Elsa.Sequence",
    "id": "seq1",
    "activities": [
      {
        "type": "Elsa.SetVariable",
        "id": "set1",
        "variable": { "name": "action", "type": "String" },
        "value": { "typeName": "Input", "expression": { "type": "Object", "value": "action" } }
      },
      {
        "type": "Elsa.If",
        "id": "if1",
        "condition": {
          "typeName": "JavaScript",
          "expression": "getVariable('action') === 'approve'"
        },
        "then": {
          "type": "Elsa.WriteLine",
          "id": "approve1",
          "text": { "typeName": "Literal", "expression": "Approved" }
        },
        "else": {
          "type": "Elsa.WriteLine",
          "id": "reject1",
          "text": { "typeName": "Literal", "expression": "Rejected" }
        }
      }
    ]
  }
}`,
          explanation: 'The JSON version: activities are identified by string type names, expressions can use different languages (Literal, JavaScript, C#, Liquid). This is what the AWFS wizard generates and POSTs to the Elsa management API. Note the <code>expression</code> objects where C# had lambda closures. [verify: exact JSON shape against current Elsa 3.x schema]'
        },
        {
          language: 'csharp',
          title: 'Loading a JSON definition from a file at runtime',
          filename: 'JsonWorkflowLoader.cs',
          code: `using Elsa.Workflows.Management;

// Inject IWorkflowDefinitionImporter (or similar) to load JSON at runtime [verify API name]
app.MapPost("/import-workflow", async (
    IFormFile jsonFile,
    IWorkflowDefinitionPublisher publisher) =>
{
    using var stream = jsonFile.OpenReadStream();
    using var reader = new StreamReader(stream);
    var json = await reader.ReadToEndAsync();

    // Deserialize and import the definition
    // [verify: check current Elsa 3.x import/publish API]
    var definition = await publisher.ImportAsync(json);
    await publisher.PublishAsync(definition);

    return Results.Ok(new { definition.Id, definition.Version });
});`,
          explanation: 'This pattern lets you ship new workflow configurations without redeploying code. The AWFS wizard uses the same management API endpoints to push JSON definitions into the running Elsa server. The exact import API name should be verified against current Elsa 3.x docs.'
        }
      ],

      handsOn: {
        goal: 'Take the workflow from T1-02, export it to JSON, modify the JSON manually to change the decision text, reload it, and run it. Confirm a non-developer could make meaningful edits to the JSON.',
        steps: [
          'Ensure your lab has <code>ApproveOrRejectWorkflow</code> registered and the Elsa management API exposed (<code>app.UseWorkflowsApi()</code>).',
          'Start the host. Call the Elsa management API to list workflow definitions: <code>curl http://localhost:5000/elsa/api/workflow-definitions</code>. Note the definition ID for <code>ApproveOrRejectWorkflow</code>.',
          'Fetch the full definition JSON: <code>curl http://localhost:5000/elsa/api/workflow-definitions/{id}/export</code> and save it to <code>decision-workflow.json</code>.',
          'Open the JSON file. Find the <code>WriteLine</code> activity text values. Change "Document APPROVED" to "Purchase Order APPROVED by AWFS" and "Document REJECTED" to "Purchase Order REJECTED by AWFS".',
          'POST the modified JSON back: <code>curl -X POST http://localhost:5000/elsa/api/workflow-definitions/import -H "Content-Type: application/json" -d @decision-workflow.json</code>.',
          'Run the workflow again via your test endpoint. Confirm the new text appears in the console log.',
          'Reflect: which part of the JSON was easy for a non-developer to edit (the text strings) and which would be confusing (the expression objects, type names, IDs)?'
        ],
        verification: [
          'The modified text appears in the console after running the workflow from the imported definition',
          'The Elsa management API shows two versions of the definition: the original and the imported one',
          'Running the workflow uses the latest published version'
        ],
        pitfalls: [
          '<strong>Schema validation errors.</strong> Elsa validates the JSON shape on import. Any missing required field causes a 400 error. Start from an exported definition rather than writing JSON from scratch.',
          '<strong>Duplicate definition IDs.</strong> If you import with the same <code>definitionId</code>, Elsa creates a new version rather than a new definition. If you want a separate definition, change the <code>definitionId</code> in the JSON.',
          '<strong>Expression syntax.</strong> Editing expression objects (conditions, dynamic values) in JSON requires understanding the expression language. Do not modify these during the hands-on without understanding the syntax.'
        ]
      },

      selfCheck: [
        {
          question: 'What does the AWFS 4-step wizard produce, and how does it interact with Elsa?',
          answer: '<p>The wizard collects approval configuration from a TAM IT user (approver roles, number of levels, SLA duration, notification settings) and uses it to generate a JSON workflow definition. It then POSTs that JSON to the Elsa Server management API, which stores it as a versioned workflow definition in PostgreSQL. When a business user submits an approval request, the source application calls AWFS to start an instance of the matching definition. The wizard is a configuration tool; it does not run workflows. It only creates the definition templates that the engine uses.</p>'
        },
        {
          question: 'What does "definition versioning" mean in JSON terms?',
          answer: '<p>Every workflow definition in Elsa has a <code>definitionId</code> (stable across versions) and a <code>version</code> number (increments with each publish). When you import a modified JSON with the same <code>definitionId</code>, Elsa creates a new version row in <code>WorkflowDefinitions</code> with an incremented version number and sets <code>isLatest: true</code>. The previous version has <code>isLatest: false</code> but remains in the database. New workflow instances start from the latest published version. Existing suspended instances continue on their original version. This is the correct and safe behavior for a production approval system.</p>'
        },
        {
          question: 'Which authoring mode does the AWFS wizard target, and why not Elsa Studio?',
          answer: '<p>The wizard targets JSON authoring via the Elsa management API. Elsa Studio is not the right UI for TAM users because it exposes the full Elsa activity palette and requires understanding of workflow concepts. TAM\'s IT department should not need to know what a <code>Sequence</code> or <code>Event</code> activity is; they should only choose approver roles, levels, and SLA settings. The wizard wraps those choices in a business-language UI and translates them to valid workflow JSON behind the scenes. Elsa Studio remains useful for AGIT engineers building and testing new activity types.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-05: Custom Activities
     =========================================================== */
  {
    id: 't1-05',
    tier: 1,
    title: 'Custom Activities',
    slug: 'custom-activities',
    estimatedMinutes: 55,
    prerequisites: ['t1-02', 't1-03'],
    tabs: {

      concept: `
<h2 id="when-to-write-custom">When to write a custom activity</h2>
<p>Built-in Elsa activities cover control flow (Sequence, If, Parallel), communication (HTTP, email), and timing (Delay, Timer). Custom activities are for domain-specific actions that Elsa does not know about: querying TAM's MDM org hierarchy, sending a WhatsApp notification through Twilio, recording an approval decision in the AWFS audit table, or checking POA delegation rules.</p>
<p>Every piece of AGIT's value-add in AWFS is expressed as a custom activity. The engine is a commodity; the custom activities are the product. If you can demo a <code>MdmLookupActivity</code> that resolves the next approver from the real MDM hierarchy, you have demonstrated something TAM cannot buy off-the-shelf from Nintex or K2.</p>

<h2 id="codeactivity-vs-activity">CodeActivity vs Activity</h2>
<p>Choose <strong>CodeActivity&lt;TResult&gt;</strong> when your activity: runs synchronously to completion, does not need to suspend and wait for an external event, and produces a single typed output. MDM lookup, audit record insert, and notification dispatch all fit this pattern.</p>
<p>Choose the lower-level <strong>Activity</strong> base class when your activity needs to suspend and create a bookmark (waiting for an external callback, a user click, or an event), or when it needs to manually schedule child activities. The built-in <code>Event</code> activity is an example: it explicitly calls <code>context.CreateBookmark(...)</code> and then <code>context.Suspend()</code>.</p>
<p>For AWFS: the approval gate activity (waiting for an approver to click Approve or Reject) must extend <code>Activity</code> and create a bookmark. MDM lookup, WhatsApp notification, and POA validation can all extend <code>CodeActivity&lt;T&gt;</code>.</p>

<h2 id="lifecycle">Activity lifecycle</h2>
<p>The primary method to override is <code>ExecuteAsync(ActivityExecutionContext context)</code>. This is called when the engine reaches your activity. For <code>CodeActivity&lt;T&gt;</code>, calling <code>context.SetResult(value)</code> completes the activity and makes the result available to subsequent activities. For a suspending activity, call <code>context.CreateBookmark(payload)</code> to register the resume point, then call <code>context.Suspend()</code> to pause. When the resume signal arrives, <code>ResumeAsync</code> is called on your activity.</p>

<h2 id="dependency-injection">Dependency injection inside activities</h2>
<p>Elsa creates activity instances via the DI container when executing. You can declare constructor parameters or use <code>[FromServices]</code>-style service location via <code>context.GetService&lt;T&gt;()</code>. For AWFS activities that call external services (MDM API, WhatsApp gateway), inject the appropriate typed HTTP clients via constructor injection. This keeps activities testable.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'MdmLookupActivity: custom CodeActivity with typed output',
          filename: 'MdmLookupActivity.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Attributes;
using Elsa.Workflows.Models;

[Activity("Awfs", "MDM lookup")]
public class MdmLookupActivity : CodeActivity<string>
{
    // Input: employee ID whose manager chain we want
    [Input(Description = "Employee ID to look up in MDM")]
    public Input<string> EmployeeId { get; set; } = default!;

    private readonly IMdmService _mdm;

    public MdmLookupActivity(IMdmService mdm)
    {
        _mdm = mdm;
    }

    protected override async ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        var employeeId = EmployeeId.Get(context);

        // In a real implementation, call the MDM REST API
        var managerId = await _mdm.GetDirectManagerIdAsync(employeeId);

        // Set the typed result (available as Output<string> to next activities)
        context.SetResult(managerId);
    }
}

// Mock MDM service interface
public interface IMdmService
{
    Task<string> GetDirectManagerIdAsync(string employeeId);
}

// Mock implementation for the lab
public class MockMdmService : IMdmService
{
    private static readonly Dictionary<string, string> OrgChart = new()
    {
        ["EMP-001"] = "MGR-010",
        ["EMP-002"] = "MGR-010",
        ["MGR-010"] = "DIR-100",
        ["DIR-100"] = "VP-001"
    };

    public Task<string> GetDirectManagerIdAsync(string employeeId)
    {
        OrgChart.TryGetValue(employeeId, out var managerId);
        return Task.FromResult(managerId ?? "VP-001");
    }
}`,
          explanation: 'The <code>[Activity]</code> attribute registers the activity in the Elsa activity catalog with a namespace and display name, making it discoverable in Elsa Studio. <code>Input&lt;string&gt;</code> declares a configurable input. <code>context.SetResult(value)</code> sets the typed output that the next activity or variable binding can consume. Dependency injection via constructor is the cleanest pattern for testability.'
        },
        {
          language: 'csharp',
          title: 'WhatsAppNotifyActivity: mock notification activity',
          filename: 'WhatsAppNotifyActivity.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Attributes;
using Elsa.Workflows.Models;

[Activity("Awfs", "WhatsApp notification")]
public class WhatsAppNotifyActivity : CodeActivity
{
    [Input(Description = "Recipient phone number in E.164 format (+62xxx)")]
    public Input<string> PhoneNumber { get; set; } = default!;

    [Input(Description = "Message body")]
    public Input<string> Message { get; set; } = default!;

    private readonly ILogger<WhatsAppNotifyActivity> _logger;

    public WhatsAppNotifyActivity(ILogger<WhatsAppNotifyActivity> logger)
    {
        _logger = logger;
    }

    protected override ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        var phone   = PhoneNumber.Get(context);
        var message = Message.Get(context);

        // In production: call Twilio, Vonage, or Zenziva WhatsApp Business API
        _logger.LogInformation(
            "[WhatsApp MOCK] To: {Phone} | Message: {Message}", phone, message);

        return ValueTask.CompletedTask;
    }
}`,
          explanation: 'This activity has no result (<code>CodeActivity</code> without a generic parameter) because notification is fire-and-forget. The mock logs instead of calling the real WhatsApp API. Replace the body with a real API call in production. Injecting <code>ILogger&lt;T&gt;</code> is always correct for activities that interact with external systems.'
        },
        {
          language: 'csharp',
          title: 'Registering custom activities and services',
          filename: 'Program.cs (additions)',
          code: `builder.Services.AddElsa(elsa =>
{
    // ... persistence config ...

    // Register custom activities so Elsa discovers them
    elsa.AddActivity<MdmLookupActivity>();
    elsa.AddActivity<WhatsAppNotifyActivity>();
});

// Register the MDM service implementation
builder.Services.AddSingleton<IMdmService, MockMdmService>();`,
          explanation: '<code>AddActivity&lt;T&gt;</code> registers the activity class with the Elsa activity catalog. The DI container resolves activity constructor parameters automatically: <code>IMdmService</code> is injected into <code>MdmLookupActivity</code> because it is registered in the service collection. Custom activities must be registered before the app starts.'
        }
      ],

      handsOn: {
        goal: 'Implement <code>WhatsAppNotifyActivity</code> (the mock version) and wire it into a two-step approval workflow: (1) MDM lookup to find the approver, (2) WhatsApp notification to the approver. Run it and verify the mock notification fires.',
        steps: [
          'Create <code>Activities/WhatsAppNotifyActivity.cs</code> using the code sample from the Code tab.',
          'Create <code>Activities/MdmLookupActivity.cs</code> and the <code>MockMdmService</code> using the code sample from the Code tab.',
          'Register both activities and <code>MockMdmService</code> in <code>Program.cs</code> as shown in the third code sample.',
          'Create a new workflow <code>Workflows/NotifyApproverWorkflow.cs</code>: it takes <code>requesterId</code> as input, uses <code>MdmLookupActivity</code> to find the approver, stores the manager ID in a variable, then calls <code>WhatsAppNotifyActivity</code> with a constructed message.',
          'Register the workflow with <code>elsa.AddWorkflow&lt;NotifyApproverWorkflow&gt;()</code>.',
          'Add a test endpoint that starts the workflow with <code>requesterId = "EMP-001"</code>.',
          'Run the app. Call the endpoint. Check the console for the <code>[WhatsApp MOCK]</code> log line. Verify the approver is <code>MGR-010</code> (the direct manager of EMP-001 in the mock org chart).',
          'Try with <code>requesterId = "MGR-010"</code>. The approver should now be <code>DIR-100</code>.'
        ],
        verification: [
          'Console shows <code>[WhatsApp MOCK] To: ... | Message: ...</code>',
          'The approver ID in the message matches the mock org chart',
          '<code>ActivityExecutionRecords</code> shows both <code>MdmLookupActivity</code> and <code>WhatsAppNotifyActivity</code> with status "Completed"'
        ],
        pitfalls: [
          '<strong>Activity not found at runtime.</strong> If you forget <code>elsa.AddActivity&lt;T&gt;()</code>, the engine cannot instantiate the activity and throws a resolution error. Every custom activity must be explicitly registered.',
          '<strong>Null result from MDM lookup.</strong> If the input employee ID is not in the mock org chart, <code>GetDirectManagerIdAsync</code> returns null. The downstream notification activity will receive null as the phone number. Add a null check or a default fallback.',
          '<strong>DI constructor failure.</strong> If <code>IMdmService</code> is not registered in the service container but <code>MdmLookupActivity</code> requires it, the DI container throws at runtime when Elsa tries to instantiate the activity. Register all activity dependencies before calling <code>app.Build()</code>.'
        ]
      },

      selfCheck: [
        {
          question: 'When do you extend Activity instead of CodeActivity for a custom activity?',
          answer: '<p>Extend <strong>Activity</strong> (the lower-level base) when your custom activity needs to suspend the workflow and wait for an external event. Examples: an approval gate that waits for a human decision, an activity that waits for a callback from an external system, or an activity that polls an external status endpoint repeatedly. Extend <strong>CodeActivity&lt;T&gt;</strong> when your activity runs to completion synchronously (or asynchronously but without suspending): MDM lookup, notification dispatch, audit logging. The distinction is whether you call <code>context.Suspend()</code> or not.</p>'
        },
        {
          question: 'What is ActivityExecutionContext and what can you do with it?',
          answer: '<p><code>ActivityExecutionContext</code> is the object passed to <code>ExecuteAsync</code> that gives your activity access to the workflow runtime. Through it you can: read workflow variables (<code>variable.Get(context)</code>), write workflow variables (<code>variable.Set(context, value)</code>), read the workflow input, create bookmarks for suspension, set the activity result, access DI services (<code>context.GetService&lt;T&gt;()</code>), cancel the workflow, and schedule child activities. It is the single entry point for all interactions between an activity and the Elsa engine.</p>'
        },
        {
          question: 'How does dependency injection work inside a custom activity?',
          answer: '<p>Elsa resolves custom activities through the .NET DI container. If your activity class has constructor parameters, the container injects the registered services. You register activities with <code>elsa.AddActivity&lt;T&gt;()</code> and register their dependencies with <code>builder.Services.Add...()</code>. Alternatively, you can call <code>context.GetService&lt;T&gt;()</code> inside <code>ExecuteAsync</code> for services you cannot declare in the constructor (for example, scoped services in a singleton activity). Constructor injection is the cleaner and more testable pattern for most cases.</p>'
        },
        {
          question: 'Why are custom activities AGIT\'s primary value-add in the AWFS pitch?',
          answer: '<p>Elsa itself is open source and available to anyone. The workflow engine, persistence, and HTTP trigger capabilities are not differentiators. What TAM cannot buy off the shelf is: an activity that calls TAM\'s specific MDM API to resolve the next approver from the actual org hierarchy, an activity that enforces TAM\'s POA delegation rules, an activity that sends WhatsApp notifications through the vendor TAM already uses, and an activity that writes to TAM\'s specific audit database schema. These custom activities encapsulate AGIT\'s knowledge of TAM\'s environment. They are the moat, not the engine.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-06: Hosting Models
     =========================================================== */
  {
    id: 't1-06',
    tier: 1,
    title: 'Hosting Models',
    slug: 'hosting-models',
    estimatedMinutes: 40,
    prerequisites: ['t1-01'],
    tabs: {

      concept: `
<h2 id="three-topologies">Three hosting topologies</h2>
<p>Elsa can be deployed in three fundamentally different ways, each with different operational and integration trade-offs. Choosing the wrong topology for AWFS will either create tight coupling with TAM's existing applications or require infrastructure TAM cannot support at launch.</p>

<h3 id="embedded">Embedded library</h3>
<p>The Elsa engine runs inside an existing ASP.NET Core application as a library (NuGet packages added to the host app). The application and the workflow engine share one process, one database connection, and one deployment unit. Simpler to operate, but it means the workflow state and the application state are tightly coupled. If the application is redeployed, all workflows must survive or be disrupted. If the workflow engine needs to be scaled, the entire application must scale.</p>
<p>Appropriate for: small projects where the workflow logic is an internal detail of one application. Not appropriate for AWFS, where multiple source applications (Service Parts, Tire, Merchandise) will submit requests to one approval service.</p>

<h3 id="dedicated-server">Dedicated Elsa Server (AWFS choice)</h3>
<p>A standalone ASP.NET Core application that only runs Elsa. It exposes REST API endpoints for workflow management and execution. Source applications call AWFS over HTTP to submit requests, check status, and receive callbacks. The Elsa process can be deployed, scaled, and updated independently of the applications it serves.</p>
<p>This is the correct topology for AWFS. TAM has multiple source systems that need approval routing. AGIT delivers a single AWFS service; the source systems integrate via API. Upgrades to the workflow engine do not require coordinated redeployment of all source systems.</p>

<h3 id="cluster">Elsa Cluster</h3>
<p>Multiple instances of the Elsa Server running behind a load balancer, sharing one PostgreSQL database and one Redis instance (for distributed locking). Required for high availability and throughput beyond what a single process can handle. Adds operational complexity: you need a Redis deployment, distributed lock management, and careful attention to race conditions around bookmark matching.</p>
<p>Post-launch decision for AWFS. Start with a single Elsa Server. Add clustering when TAM demonstrates a throughput need that exceeds single-instance capacity.</p>

<h2 id="awfs-decision">The AWFS hosting decision, explained to the CTO</h2>
<p>AWFS is a dedicated Elsa Server, not embedded. This means TAM's existing ERP and source applications do not need to change their technology stack to integrate with AWFS. They call a REST API and receive callbacks. AWFS can be upgraded or replaced without touching the source applications. The service can be monitored and operated independently. Clustering is available when needed but is not required at launch.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'Mode 1: Embedded in an existing ASP.NET Core app',
          filename: 'Program.cs (embedded)',
          code: `// Your existing application
var builder = WebApplication.CreateBuilder(args);

// Add Elsa as a library to the existing app
builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(mgmt =>
        mgmt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
    elsa.UseWorkflowRuntime(rt =>
        rt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
    elsa.AddWorkflow<YourWorkflow>();
});

var app = builder.Build();

// Your existing middleware
app.UseAuthentication();
app.UseAuthorization();

// Elsa workflow execution middleware
app.UseWorkflows();

// Your existing controllers
app.MapControllers();

app.Run();`,
          explanation: 'In embedded mode, Elsa is just another library. It shares the host process with your application. Simple to set up, but tightly couples your application\'s lifecycle to the workflow engine. Every deployment of your app also redeploys the workflow engine.'
        },
        {
          language: 'csharp',
          title: 'Mode 2: Dedicated Elsa Server (AWFS deployment)',
          filename: 'Program.cs (dedicated server)',
          code: `// This application does nothing except run Elsa
var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Postgres")!;

builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(mgmt =>
        mgmt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
    elsa.UseWorkflowRuntime(rt =>
        rt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
    elsa.UseHttp(); // Expose HTTP trigger and management endpoints

    // AWFS custom activities
    elsa.AddActivity<MdmLookupActivity>();
    elsa.AddActivity<WhatsAppNotifyActivity>();

    // Core AWFS workflow templates (programmatic)
    elsa.AddWorkflow<MultiLevelApprovalWorkflow>();
});

var app = builder.Build();

await app.Services.ApplyMigrationsAsync();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

// Elsa REST management API (CRUD on definitions, instances, etc.)
app.UseWorkflowsApi();

// Middleware for HTTP-triggered workflows (the AWFS submission endpoint)
app.UseWorkflows();

await app.RunAsync();`,
          explanation: 'The dedicated server is a purpose-built Elsa host. Source applications call it over HTTP. AGIT controls the deployment pipeline, can scale it independently, and can upgrade Elsa without coordinating with TAM\'s application teams. This is the AWFS production topology.'
        },
        {
          language: 'csharp',
          title: 'Calling the dedicated server from a source application',
          filename: 'AwfsClient.cs',
          code: `// In a source application (ERP, SAP, custom app)
// This is a simple HTTP client wrapper around the AWFS REST API

public class AwfsClient
{
    private readonly HttpClient _http;

    public AwfsClient(HttpClient http)
    {
        _http = http;
    }

    // Submit a new approval request to AWFS
    public async Task<string> SubmitApprovalRequestAsync(ApprovalRequest request)
    {
        var response = await _http.PostAsJsonAsync(
            "/awfs/api/approval-requests",
            request);

        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SubmitResult>();
        return result!.WorkflowInstanceId;
    }

    // Check the status of a pending approval
    public async Task<ApprovalStatus> GetStatusAsync(string instanceId)
    {
        return await _http.GetFromJsonAsync<ApprovalStatus>(
            $"/awfs/api/approval-requests/{instanceId}/status")
            ?? throw new InvalidOperationException("Status not found");
    }
}`,
          explanation: 'Source applications treat AWFS as an external service. They call it over HTTP to submit requests and check status. They receive callbacks (webhooks) when the workflow completes. The source applications have no knowledge of Elsa, bookmarks, or workflow internals. This clean API boundary is possible only because AWFS is a dedicated server.'
        }
      ],

      handsOn: {
        goal: 'Convert your lab from embedded mode (Elsa inside the lab app) to dedicated server mode. Submit a workflow from a separate console application over HTTP.',
        steps: [
          'Your existing lab already runs as a dedicated server (the setup from T1-01 exposed <code>UseWorkflowsApi()</code>). Confirm the management API is accessible: <code>curl http://localhost:5000/elsa/api/workflow-definitions</code>.',
          'Create a new console project alongside your lab: <code>mkdir AwfsClient && cd AwfsClient && dotnet new console -n AwfsClient</code>. Add <code>System.Net.Http.Json</code>.',
          'In the console app, write a simple client that calls the lab\'s workflow trigger endpoint to start a workflow. Use <code>HttpClient</code> with the lab\'s base URL.',
          'Start the lab: <code>dotnet run --project AwfsElsaLab</code>.',
          'In a second terminal, run the console client: <code>dotnet run --project AwfsClient</code>. Confirm the workflow starts in the lab\'s console output.',
          'Stop the lab. Observe that the console client fails with a connection error. This demonstrates the independence of the two processes: the workflow server can be restarted without affecting the client code.',
          'Restart the lab. Run the client again. Observe it succeeds. Note that any suspended workflows from before the restart are still present (bookmark durability from T1-03).'
        ],
        verification: [
          'The console client successfully triggers a workflow on the running lab server',
          'The lab console shows workflow execution log from the client-triggered run',
          'Stopping and restarting the lab does not require changes to the client code',
          'The Elsa management API returns workflow definitions even when accessed from the client process'
        ],
        pitfalls: [
          '<strong>CORS errors in browser clients.</strong> If you test from a browser instead of curl or HttpClient, you may hit CORS. Configure <code>app.UseCors()</code> in the Elsa server for browser-based clients.',
          '<strong>Missing UseWorkflowsApi.</strong> Without <code>app.UseWorkflowsApi()</code>, the management REST endpoints are not registered and all calls return 404.',
          '<strong>Authentication not configured.</strong> In a real deployment, the Elsa management API must be protected. For this lab, authentication is disabled. Do not expose an unprotected Elsa management API outside a development environment.'
        ]
      },

      selfCheck: [
        {
          question: 'What changes when you move from embedded mode to dedicated Elsa Server mode?',
          answer: '<p>The workflow engine moves from being a library inside your application to being a standalone service. Source applications no longer import Elsa NuGet packages; they call HTTP endpoints. The Elsa server has its own deployment pipeline, its own scaling policy, and its own database connections. The operational model changes from "redeploy the app to update the engine" to "deploy the Elsa server independently." The trade-off is that you now have two services to operate instead of one, but the isolation benefit outweighs this for a shared approval service used by multiple source systems.</p>'
        },
        {
          question: 'What infrastructure does Elsa need to cluster (run on multiple nodes)?',
          answer: '<p>A clustered Elsa deployment requires: a <strong>shared PostgreSQL database</strong> (all nodes read and write the same instance/bookmark tables), a <strong>Redis instance</strong> for distributed locking (so two nodes do not try to resume the same workflow instance simultaneously), and a load balancer to distribute incoming requests. The distributed lock is critical: without it, two nodes could both match the same bookmark and attempt to resume the same workflow instance concurrently, producing duplicate execution or data corruption.</p>'
        },
        {
          question: 'Why is the dedicated server topology the right choice for AWFS at TAM?',
          answer: '<p>TAM has multiple source applications (Service Parts, Tire, Merchandise, Body Builder) that will submit approval requests. If AWFS were embedded in each source application, every source app would need Elsa NuGet packages, schema migrations, and workflow definitions. Updating the approval logic would require coordinated deployment of every source app. The dedicated server provides a single service that all source applications call over HTTP. AGIT deploys and maintains one service. TAM\'s application teams integrate via a stable REST API without knowing anything about Elsa internals.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-07: Storage Providers
     =========================================================== */
  {
    id: 't1-07',
    tier: 1,
    title: 'Storage Providers',
    slug: 'storage-providers',
    estimatedMinutes: 35,
    prerequisites: ['t1-03'],
    tabs: {

      concept: `
<h2 id="storage-abstraction">Elsa's storage abstraction</h2>
<p>Elsa abstracts all persistence behind store interfaces (<code>IWorkflowInstanceStore</code>, <code>IBookmarkStore</code>, <code>IWorkflowDefinitionStore</code>, etc.). You plug in a provider by calling the appropriate <code>Use...</code> extension method. The engine code does not depend on any specific database; only the provider implementation does. This makes switching providers a configuration change rather than a code change.</p>

<h2 id="available-providers">Available providers</h2>
<p><strong>EF Core</strong> supports PostgreSQL, SQL Server, MySQL, and SQLite. The EF Core provider is the most mature, most tested, and the default recommendation for production. It supports transactions, which ensures that when a workflow suspends, both the instance state update and the bookmark creation happen atomically or not at all.</p>
<p><strong>MongoDB</strong> is an alternative for teams already running MongoDB infrastructure. It is schema-less, which simplifies schema evolution but makes querying harder (no SQL). MongoDB does not support multi-document ACID transactions in the same way PostgreSQL does, which requires care around bookmark/instance atomicity.</p>
<p><strong>In-memory</strong> is available for unit tests. No durability, no transactions. Do not use in production or integration tests.</p>

<h2 id="schema">Key tables and growth patterns</h2>
<p>For a production AWFS deployment on PostgreSQL:</p>
<ul>
  <li><strong>WorkflowDefinitions</strong>: grows slowly. One row per published version. Low query volume.</li>
  <li><strong>WorkflowInstances</strong>: grows continuously. One row per approval request ever submitted. The <code>Data</code> column (serialized execution context JSON) can be large for complex workflows. <em>This is the table to watch in production.</em></li>
  <li><strong>Bookmarks</strong>: always small for AWFS. At any time it contains only the active suspension points. Rows are deleted when the instance resumes. Keep this table indexed; it is queried on every incoming trigger.</li>
  <li><strong>ActivityExecutionRecords</strong>: grows fast. One row per activity per instance. For a 10-activity workflow, each approval request creates 10 rows. Plan for archiving or partitioning.</li>
</ul>
<p>The right backup strategy for AWFS: daily full backups of the entire database, continuous WAL archiving for point-in-time recovery. The <code>WorkflowInstances</code> and <code>ActivityExecutionRecords</code> tables together constitute the complete audit trail for every approval in the system.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'EF Core with PostgreSQL (production)',
          filename: 'Program.cs',
          code: `builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(mgmt =>
        mgmt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));

    elsa.UseWorkflowRuntime(rt =>
        rt.UseEntityFrameworkCore(ef =>
            ef.UsePostgreSql(connectionString)));
});`,
          explanation: 'The standard PostgreSQL setup. Both modules use the same connection string. EF Core creates separate DbContext classes per module with their own migration history tables, so they coexist without conflict in one database.'
        },
        {
          language: 'csharp',
          title: 'SQLite for local development (no Docker required)',
          filename: 'Program.cs (SQLite variant)',
          code: `// In development, swap PostgreSQL for SQLite:
// builder.Services.AddSqlite(connectionString) equivalent for Elsa:
elsa.UseWorkflowManagement(mgmt =>
    mgmt.UseEntityFrameworkCore(ef =>
        ef.UseSqlite("Data Source=awfs-dev.db")));

elsa.UseWorkflowRuntime(rt =>
    rt.UseEntityFrameworkCore(ef =>
        ef.UseSqlite("Data Source=awfs-dev.db")));

// Requires: dotnet add package Elsa.EntityFrameworkCore.Sqlite`,
          explanation: 'SQLite is useful for developers who do not have Docker available or want a zero-infrastructure local dev setup. The database is a single file (<code>awfs-dev.db</code>) in the project directory. Do not use SQLite in production: it does not support concurrent writes at the scale of a shared approval service.'
        },
        {
          language: 'bash',
          title: 'Schema migrations',
          filename: 'CLI commands',
          code: `# Apply migrations at runtime (done in Program.cs via ApplyMigrationsAsync)
# OR use the EF Core CLI for explicit control:

# Install EF Core tools globally (once)
dotnet tool install --global dotnet-ef

# Generate a new migration (only needed if you extend Elsa's DbContext)
dotnet ef migrations add InitialElsaSchema \
  --context ElsaDbContext \
  --output-dir Migrations/Elsa

# Apply pending migrations manually (alternative to ApplyMigrationsAsync)
dotnet ef database update --connection "Host=localhost;..."

# List applied migrations
dotnet ef migrations list`,
          explanation: 'Elsa ships with built-in migrations for all supported databases. You only need to run <code>dotnet ef migrations add</code> if you are extending Elsa\'s DbContext with your own tables. For AWFS, run <code>ApplyMigrationsAsync()</code> at startup to apply Elsa\'s built-in migrations automatically on each deployment.'
        }
      ],

      handsOn: {
        goal: 'Switch your lab between SQLite (no Docker) and PostgreSQL (production-like) using environment-based configuration. Run the same workflow on both providers and confirm data is not shared between them.',
        steps: [
          'Add the SQLite package: <code>dotnet add package Elsa.EntityFrameworkCore.Sqlite</code>.',
          'Update <code>Program.cs</code> to read a <code>UseProvider</code> configuration key and branch between SQLite and PostgreSQL based on its value.',
          'Add <code>"UseProvider": "sqlite"</code> to <code>appsettings.Development.json</code>. Run the app. A new file <code>awfs-dev.db</code> should appear. Start a workflow and confirm it runs.',
          'Open <code>awfs-dev.db</code> using a SQLite browser (DB Browser for SQLite, or the VS Code SQLite extension). View the <code>WorkflowInstances</code> table.',
          'Stop the app. Change <code>"UseProvider": "postgres"</code>. Start Docker: <code>docker compose up -d</code>. Run the app again. Confirm Elsa creates the PostgreSQL schema.',
          'Start the same workflow again. Confirm the instance appears in PostgreSQL but NOT in the SQLite file (they are separate databases with separate data).',
          'Reflection: which provider would you choose for integration tests that need realistic persistence behavior? (Answer: PostgreSQL in Docker, not SQLite, because SQLite has different concurrency and transaction semantics.)'
        ],
        verification: [
          'With SQLite provider: <code>awfs-dev.db</code> exists and contains Elsa tables',
          'With PostgreSQL provider: Elsa tables appear in the <code>awfs_elsa</code> database on Docker',
          'Running a workflow on SQLite does not create a record in PostgreSQL, and vice versa',
          'Switching providers requires only a config change, not a code change'
        ],
        pitfalls: [
          '<strong>SQLite concurrency limit.</strong> SQLite cannot handle concurrent writes. If you run integration tests in parallel against SQLite, some will fail with "database is locked." Use PostgreSQL in Docker for integration tests.',
          '<strong>Migration conflicts.</strong> SQLite and PostgreSQL have different migration histories. Switching providers requires creating the schema from scratch on the new provider; you cannot migrate data between them with EF Core migrations alone.',
          '<strong>Missing migrations on PostgreSQL.</strong> If PostgreSQL migrations fail (for example, due to a permissions issue), the app may start but all Elsa operations fail with "relation does not exist" errors. Check the startup logs for migration output.'
        ]
      },

      selfCheck: [
        {
          question: 'What tables does Elsa create, and which one grows fastest in a production AWFS deployment?',
          answer: '<p>Elsa creates: <code>WorkflowDefinitions</code> (workflow templates), <code>WorkflowInstances</code> (all running and completed instances), <code>Bookmarks</code> (active suspension points), and <code>ActivityExecutionRecords</code> (audit log of every activity execution). In a production AWFS deployment, <code>ActivityExecutionRecords</code> grows fastest because every approval request creates one row per activity, and a multi-level approval workflow might execute 15 or more activities per request. <code>WorkflowInstances</code> is the second fastest grower and the one with the largest rows due to the serialized execution context JSON.</p>'
        },
        {
          question: 'Why is PostgreSQL the right storage choice for AWFS over SQL Server or MongoDB?',
          answer: '<p>PostgreSQL is the right choice because: TAM has existing DBA expertise for it (lowering operational risk), it is open source (no licensing cost beyond infrastructure), it supports ACID transactions with row-level locking (ensuring atomic bookmark/instance updates), and it runs well on the AWS Jakarta region that TAM already uses. SQL Server would also work technically but carries licensing cost. MongoDB lacks the same multi-document transaction guarantees, which creates risk around the atomicity of bookmark creation during workflow suspension.</p>'
        },
        {
          question: 'What backup and retention strategy should AWFS plan for?',
          answer: '<p>AWFS needs: daily full PostgreSQL backups for point-in-time recovery, continuous WAL archiving so any approved-but-not-committed transaction can be recovered, and a data retention policy for <code>ActivityExecutionRecords</code> and completed <code>WorkflowInstances</code>. Approval records may have a regulatory retention requirement (for example, 5 years for purchase approvals). Plan for either table partitioning by month or an archival pipeline that moves old records to cold storage while keeping the hot tables small for query performance.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-08: Long-Running Workflows
     =========================================================== */
  {
    id: 't1-08',
    tier: 1,
    title: 'Long-Running Workflows (Timer, Delay, Cron)',
    slug: 'long-running-workflows',
    estimatedMinutes: 50,
    prerequisites: ['t1-03'],
    tabs: {

      concept: `
<h2 id="time-in-workflows">Expressing time in workflows</h2>
<p>Elsa provides three built-in activities for time-based behavior. <strong>Delay</strong> pauses a workflow instance for a fixed duration. <strong>Timer</strong> fires repeatedly at a fixed interval, creating a new workflow instance each time (or resuming an existing one, depending on usage). <strong>Cron</strong> fires on a schedule expressed as a cron expression, similar to Timer but with more flexible scheduling.</p>
<p>All three work through the same underlying mechanism: when a time-based activity executes, it creates a bookmark with a future fire time. Elsa's background scheduler polls the bookmark table for expired time bookmarks and dispatches resume signals for them. This means time-based workflows survive host restarts: if the host goes down at 11:59 and a timer was set to fire at 12:00, the timer fires when the host comes back up, not when the host went down.</p>

<h2 id="delay-timer-cron">Delay, Timer, and Cron compared</h2>
<p><strong>Delay(TimeSpan)</strong>: waits once for a specific duration within a running workflow instance. Use for the SLA window in AWFS: "if no decision in 24 hours, escalate." The delay is relative to when the workflow reached that point.</p>
<p><strong>Timer(TimeSpan)</strong>: creates a workflow instance on a repeating interval (for example, every 5 minutes). Semantically different from Delay: Timer triggers new work periodically, Delay pauses existing work. Use Timer for scheduled reports or periodic cleanup jobs.</p>
<p><strong>Cron(string)</strong>: fires on a cron schedule (for example, <code>"0 8 * * MON-FRI"</code> for every weekday at 8 AM). Use for business-hours-aware escalation: "escalate at 9 AM on the next business day if still pending."</p>

<h2 id="sla-pattern">The SLA escalation pattern for AWFS</h2>
<p>A real AWFS SLA escalation is more complex than a simple <code>Delay</code>. The pattern is: run the approval activity and the delay activity in <strong>parallel</strong>. Whichever finishes first cancels the other. If the approval finishes first, the delay is cancelled and execution continues normally. If the delay fires first, the approval gate is timed out and the workflow escalates to the next level or notifies the manager.</p>
<p>This is expressed using Elsa's <strong>Fork</strong> pattern or a custom composite activity that races two branches. Elsa 3.x does not have a built-in "race" activity; you implement it with <code>Parallel</code> and cancellation tokens, or with a custom activity. The hands-on exercise covers a simplified version using <code>Delay</code> in sequence as a starting point.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'Workflow with a Delay activity',
          filename: 'DelayWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Models;

public class SlaEscalationWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("Approval request started. Waiting for approver..."),

                // In production, this would be a custom approval gate activity.
                // For the lab, use Event to simulate the suspension.
                new Event("ApprovalDecision"),

                new WriteLine("Decision received. Processing...")
            }
        };
    }
}

// Simplified SLA pattern: start approval, then race against a delay
public class SlaWithTimeoutWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("Request submitted. SLA clock started."),

                // Wait up to 24 hours (use 60 seconds for testing)
                new Delay(TimeSpan.FromSeconds(60)),

                // This point is reached only if no approval came in time
                new WriteLine("SLA BREACH: No decision within timeout. Escalating..."),
                new WhatsAppNotifyActivity { /* escalation message */ }
            }
        };
    }
}`,
          explanation: 'This simplified version shows the Delay activity in sequence. A real SLA implementation races the approval event against the delay in parallel branches and cancels the loser. The sequential version here is useful for testing that the delay survives host restarts. Use 60 seconds during development to avoid waiting 24 hours.'
        },
        {
          language: 'csharp',
          title: 'Cron-triggered workflow for scheduled tasks',
          filename: 'DailyReportWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

// This workflow starts on a cron schedule, not from a manual trigger
public class DailyEscalationSweepWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                // [verify: Cron activity availability and parameter in Elsa 3.x]
                // new Cron("0 8 * * MON-FRI"), // Fires at 8 AM Mon-Fri

                new WriteLine("Running SLA sweep: checking for overdue approvals"),

                // In a real implementation:
                // 1. Query WorkflowInstances for suspended instances older than SLA threshold
                // 2. For each: dispatch a reminder notification
                // 3. If past hard deadline: escalate to next level

                new WriteLine("SLA sweep complete")
            }
        };
    }
}`,
          explanation: 'Cron-triggered workflows run on a schedule. The Cron activity creates a recurring bookmark that the scheduler fires at each scheduled time. [verify: exact Cron activity name and usage in current Elsa 3.x] For AWFS, a daily sweep that finds all approvals older than the SLA threshold and sends reminder notifications is a natural use of Cron.'
        },
        {
          language: 'csharp',
          title: 'Testing time-based behavior with shortened intervals',
          filename: 'Program.cs (test configuration)',
          code: `// Make SLA timeouts configurable so you can test with seconds, not hours
builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowManagement(/* ... */);
    elsa.UseWorkflowRuntime(/* ... */);

    elsa.AddWorkflow<SlaEscalationWorkflow>();
});

// Inject SLA duration from configuration so tests can use short values
builder.Services.Configure<AwfsOptions>(
    builder.Configuration.GetSection("Awfs"));

// In appsettings.Development.json:
// "Awfs": { "SlaTimeoutSeconds": 60 }
// In appsettings.Production.json:
// "Awfs": { "SlaTimeoutSeconds": 86400 }

public class AwfsOptions
{
    public int SlaTimeoutSeconds { get; set; } = 86400; // 24 hours default
}`,
          explanation: 'Never hard-code time durations in workflow definitions. Inject them from configuration so you can test with 60-second intervals without changing code. This is a production-critical pattern: you will need to adjust SLA thresholds based on TAM feedback, and that must not require code changes and redeployment.'
        }
      ],

      handsOn: {
        goal: 'Add SLA escalation to your approval workflow using a <code>Delay</code> activity. Test with a 60-second timeout. Stop and restart the host between the workflow start and the timeout to confirm the delay bookmark survives.',
        steps: [
          'Add <code>SlaWithTimeoutWorkflow</code> to your lab. Set the <code>Delay</code> to 60 seconds. Register it with <code>elsa.AddWorkflow&lt;SlaWithTimeoutWorkflow&gt;()</code>.',
          'Add an endpoint: <code>app.MapPost("/start-sla-test", ...)</code> that starts the workflow.',
          'Start the app. Trigger the workflow: <code>curl -X POST http://localhost:5000/start-sla-test</code>. Observe the "SLA clock started" log line.',
          'Query the <code>Bookmarks</code> table. Find the time-based bookmark. Note the <code>ScheduledAt</code> or similar timestamp column showing the fire time.',
          '<strong>Stop the host.</strong> Wait 30 seconds. Restart the host.',
          'Observe the console after restart. After the remaining 30 seconds (from the original start), the delay should fire and log "SLA BREACH: No decision within timeout. Escalating..."',
          'Verify the fire time was relative to when the workflow started, not when the host restarted. This is the critical test: the SLA clock does not reset on host restart.'
        ],
        verification: [
          'The delay fires approximately 60 seconds after the workflow started (not after host restart)',
          'The "SLA BREACH" log line appears in the console after the timeout',
          'The <code>Bookmarks</code> table shows a time-based bookmark before the timeout fires',
          'After the delay fires, the bookmark row is deleted and the instance status is "Finished"'
        ],
        pitfalls: [
          '<strong>Timer not firing after restart.</strong> If the host does not start the background scheduler on restart, time bookmarks will not fire. Verify that Elsa\'s background services are configured and running. Look for "BackgroundService started" in the startup log.',
          '<strong>Fire time reset by restart.</strong> If the SLA fires 60 seconds after host restart rather than 60 seconds after workflow start, the delay duration is being recalculated from the current time instead of the original scheduled time. This indicates a bug in the bookmark payload deserialization. Verify the bookmark stores an absolute timestamp, not a relative duration.',
          '<strong>Delay too long to test.</strong> Do not use hour-scale delays during development. Make the delay configurable from settings so you can use seconds in development without code changes.'
        ]
      },

      selfCheck: [
        {
          question: 'How does Elsa know when a Delay expires across host restarts?',
          answer: '<p>When a <code>Delay</code> activity executes, it calculates the absolute future timestamp (current time plus the delay duration) and stores it in the bookmark record. It does not store the duration; it stores the target time. Elsa\'s background scheduler polls the <code>Bookmarks</code> table for records whose scheduled time has passed. When the host restarts, the scheduler resumes polling and finds the expired bookmark immediately, regardless of how long the host was down. The SLA clock does not reset on restart because the target time was stored absolutely when the workflow reached the <code>Delay</code> activity.</p>'
        },
        {
          question: 'Why is Cron semantically different from Timer?',
          answer: '<p><code>Timer</code> suspends an existing workflow instance and resumes it after a fixed interval, repeatedly. <code>Cron</code> starts a new workflow instance (or resumes an existing one) on a calendar-based schedule. The key semantic difference is that Timer is attached to a running instance, while Cron is typically a trigger that starts new work. For AWFS: use <code>Delay</code> within an approval workflow for the per-request SLA clock, and <code>Cron</code> for system-level scheduled tasks like daily overdue sweeps or SLA summary reports.</p>'
        },
        {
          question: 'What domain logic does AWFS need beyond what Delay and Timer primitives provide?',
          answer: '<p>The Delay primitive just waits for a duration. AWFS needs: (1) a way to <strong>cancel the delay</strong> if the approval arrives before the timeout (the parallel-race pattern), (2) an awareness of <strong>business hours</strong> (SLA should not count weekend time or Indonesian public holidays), (3) a <strong>multi-level escalation chain</strong> (first escalate to direct manager, then to department head, not just a single notification), and (4) an <strong>audit record</strong> of the escalation event for compliance. These are all domain behaviors that AGIT implements as custom activities and workflow patterns on top of the Elsa primitives.</p>'
        }
      ]
    }
  },

  /* ===========================================================
     T1-09: Versioning and In-Flight Workflows
     =========================================================== */
  {
    id: 't1-09',
    tier: 1,
    title: 'Versioning and In-Flight Workflows',
    slug: 'versioning-in-flight-workflows',
    estimatedMinutes: 60,
    prerequisites: ['t1-03', 't1-04'],
    tabs: {

      concept: `
<h2 id="why-versioning-matters">Why versioning is the most-asked CTO question</h2>
<p>Every CTO evaluating a workflow platform for production use asks this question: "What happens to running approvals when we deploy a new version of the workflow?" The wrong answer (or a vague answer) ends the pitch. You need the specific, honest answer for Elsa 3.x, and you need to have personally tested it in your lab (see the hands-on exercise).</p>

<h2 id="definition-versioning">How Elsa versions workflow definitions</h2>
<p>Every workflow definition in Elsa has two identifiers: a <strong>definitionId</strong> (stable across versions, identifies the "family" of workflows) and a <strong>version</strong> number (integer, increments with each publish). When you publish a new version:</p>
<ul>
  <li>A new row is written to <code>WorkflowDefinitions</code> with an incremented version number and <code>isLatest = true</code>.</li>
  <li>The previous version row has <code>isLatest = false</code> updated, but remains in the database.</li>
  <li>All new workflow instances start from the latest published version.</li>
  <li>Existing suspended instances <strong>continue on their original version</strong>. They do not migrate automatically.</li>
</ul>
<p>The previous version row is retained because suspended instances reference it. If you delete the definition row while instances are still running on that version, those instances cannot be resumed (the engine cannot load the activity graph they were running on).</p>

<h2 id="retraction">Retraction vs deletion</h2>
<p><strong>Retracting</strong> a version sets <code>isPublished = false</code> on that version. Retracted versions do not start new instances. Existing suspended instances on that version can still be resumed because the definition row is still present. <strong>Deleting</strong> a definition version permanently removes it. Only delete a version after confirming zero running instances are on it.</p>

<h2 id="no-auto-migration">In-flight instances do NOT migrate automatically</h2>
<p>This is the answer to the CTO's question: an in-flight workflow instance does not automatically migrate to a new definition version. It continues running on the version it started on. This is the <em>correct</em> and <em>safe</em> behavior. Automatic migration would be dangerous: the new version might have different activity IDs, different variable names, or a different execution path. Auto-migrating a suspended instance into a different activity graph would produce undefined behavior.</p>
<p>For AWFS, this means: a purchase order that was submitted before the workflow was updated will complete on the old workflow version. Purchase orders submitted after the update will use the new version. This is exactly what TAM expects: in-progress approvals are not disrupted by a workflow configuration change.</p>

<h2 id="intentional-migration">Intentional migration (if needed)</h2>
<p>If you must migrate in-flight instances to a new version (for example, a critical bug fix in the approval routing logic), you do it by: (1) identifying all suspended instances on the old version, (2) completing or cancelling them explicitly via the management API, (3) resubmitting the original requests against the new version. This is a deliberate, logged business decision, not an automated migration. AGIT should include this procedure in the AWFS runbook.</p>
`,

      code: [
        {
          language: 'csharp',
          title: 'Publishing v1 of a workflow',
          filename: 'ApprovalWorkflowV1.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

// Version 1: single-level approval
public class ApprovalWorkflowV1 : WorkflowBase
{
    // Assign a stable definitionId so versioning works correctly
    public override string? Id => "awfs-approval-workflow";

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("V1: Request received. Routing to single approver."),
                new Event("ApprovalDecision"),
                new WriteLine("V1: Decision received.")
            }
        };
    }
}`,
          explanation: 'Setting a stable <code>Id</code> on the workflow class ensures that when you register V2 with the same ID, Elsa treats it as a new version of the same definition rather than a separate definition. Without a stable ID, Elsa auto-generates one and V1 and V2 become unrelated definitions.'
        },
        {
          language: 'csharp',
          title: 'Publishing v2 while a v1 instance is suspended',
          filename: 'ApprovalWorkflowV2.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

// Version 2: two-level approval (new requirement from TAM)
public class ApprovalWorkflowV2 : WorkflowBase
{
    // Same stable ID as V1
    public override string? Id => "awfs-approval-workflow";

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("V2: Request received. Routing to level-1 approver."),
                new Event("ApprovalLevel1"),

                new WriteLine("V2: Level-1 approved. Routing to level-2 approver."),
                new Event("ApprovalLevel2"),

                new WriteLine("V2: Both levels approved. Processing.")
            }
        };
    }
}

// In Program.cs, when you deploy V2, register the new class:
// elsa.AddWorkflow<ApprovalWorkflowV2>();
// Elsa will detect the same definitionId with new content and create a new version.`,
          explanation: 'V2 adds a second approval level. When you deploy the code with <code>ApprovalWorkflowV2</code> registered, Elsa detects that the <code>"awfs-approval-workflow"</code> definition has changed and creates version 2 in the database. Any V1 instance that is currently suspended (waiting for <code>"ApprovalDecision"</code>) will continue on V1. New requests will start on V2.'
        },
        {
          language: 'bash',
          title: 'Inspecting which version an instance is running on',
          filename: 'psql queries',
          code: `-- Find all suspended instances and their definition version
SELECT
    wi."Id"               AS instance_id,
    wi."DefinitionId"     AS definition_id,
    wi."Version"          AS running_version,
    wi."CreatedAt"        AS started_at,
    wi."Status"
FROM "WorkflowInstances" wi
WHERE wi."Status" = 'Running'
ORDER BY wi."CreatedAt";

-- Check how many instances are on each version
SELECT
    "DefinitionId",
    "Version",
    COUNT(*) AS instance_count
FROM "WorkflowInstances"
GROUP BY "DefinitionId", "Version"
ORDER BY "DefinitionId", "Version";

-- Find the latest published version of each definition
SELECT
    "DefinitionId",
    MAX("Version") AS latest_version,
    COUNT(CASE WHEN "IsPublished" THEN 1 END) AS published_count
FROM "WorkflowDefinitions"
GROUP BY "DefinitionId";`,
          explanation: 'These queries are what you run in a production migration assessment. The first query shows all in-flight instances and their version. If you are about to retire V1 but instances are still running on it, do not delete V1 yet. The second query gives a count of instances per version, which tells you how many approvals will be disrupted if you forcibly cancel V1 instances.'
        }
      ],

      handsOn: {
        goal: 'Publish V1 of a workflow, start and suspend an instance, publish V2, confirm the suspended instance remains on V1, resume it, and document the observed behavior in your <code>LEARNINGS.md</code>. TAM will ask this exact scenario.',
        steps: [
          'Register <code>ApprovalWorkflowV1</code> in <code>Program.cs</code>. Start the app. Start a workflow instance: <code>curl -X POST "http://localhost:5000/start?correlationId=VERS-TEST-001"</code>. Confirm it is suspended.',
          'Query <code>WorkflowInstances</code>: note the <code>Version</code> column is 1.',
          'Query <code>WorkflowDefinitions</code>: confirm version 1 exists with <code>IsLatest = true</code>.',
          'Stop the app. Replace the registration with <code>ApprovalWorkflowV2</code> (keeping the same stable <code>Id</code>). Restart the app.',
          'Query <code>WorkflowDefinitions</code> again: you should now see version 1 with <code>IsLatest = false</code> and version 2 with <code>IsLatest = true</code>.',
          'Query <code>WorkflowInstances</code>: confirm the suspended instance still shows <code>Version = 1</code>.',
          'Start a NEW workflow instance: <code>curl -X POST "http://localhost:5000/start?correlationId=VERS-TEST-002"</code>. Query WorkflowInstances: the new instance should show <code>Version = 2</code>.',
          'Resume the V1 instance: send the <code>"ApprovalDecision"</code> event with correlationId <code>VERS-TEST-001</code>. Confirm it completes on V1 (the console shows the V1 log messages, not V2\'s).',
          'Create a <code>LEARNINGS.md</code> file in your lab repo. Document: what you observed, the SQL queries you used, and the conclusion (in-flight instances do not auto-migrate).'
        ],
        verification: [
          'V1 instance remains on version 1 after V2 is published',
          'New instance starts on version 2',
          'V1 instance resumes and completes with V1 log messages',
          'V2 instance (if also started and resumed) shows V2 log messages',
          '<code>WorkflowDefinitions</code> retains the V1 row with <code>IsLatest = false</code>'
        ],
        pitfalls: [
          '<strong>Both versions show the same behavior.</strong> If you did not set a stable <code>Id</code> on the workflow class, V1 and V2 are treated as separate definitions, not as versions of the same definition. Verify you override <code>public override string? Id</code> with the same value on both classes.',
          '<strong>V1 definition missing after restart.</strong> If Elsa deletes the V1 definition row when V2 is published, V1 instances cannot be resumed. This would be a bug. If you observe this, check the Elsa version and file an issue. In correctly functioning Elsa 3.x, the old version row is retained.',
          '<strong>New instances starting on V1.</strong> If new instances start on V1 after V2 is published, V2 was not properly marked as the latest. Check the <code>IsLatest</code> column in <code>WorkflowDefinitions</code>.'
        ]
      },

      selfCheck: [
        {
          question: 'Does an in-flight workflow instance automatically migrate to a new definition version when you publish it?',
          answer: '<p><strong>No.</strong> An in-flight instance continues running on the version it started on. This is by design. The new version may have different activity IDs, different variable names, or different execution paths. Auto-migrating a suspended instance into a changed activity graph would produce undefined behavior and likely break the workflow. In Elsa 3.x, publishing a new version marks the previous version as <code>IsLatest = false</code> but retains the definition row so existing instances can still be loaded and resumed.</p>'
        },
        {
          question: 'What is the difference between retracting and deleting a workflow definition version?',
          answer: '<p><strong>Retracting</strong> (setting <code>IsPublished = false</code>) prevents new instances from starting on that version but leaves the definition row in the database so existing suspended instances can still be resumed. The definition is still readable by the runtime. <strong>Deleting</strong> permanently removes the definition row. After deletion, any instance that was running on that version cannot be resumed because the engine cannot load the activity graph. Only delete a version after confirming through a database query that zero instances are running on it.</p>'
        },
        {
          question: 'How would you handle a critical bug fix in the approval routing logic that affects in-flight instances?',
          answer: '<p>There is no safe automatic migration path. The deliberate procedure is: (1) use the management API or direct SQL to identify all instances running on the buggy version, (2) decide which can be safely cancelled (for example, those in the earliest stage), (3) cancel them via the management API, (4) notify requesters that their request must be resubmitted, (5) resubmit against the new version. This is a planned business incident, not a technical operation. For AWFS, include this procedure in the runbook and ensure the AWFS admin UI can identify and cancel instances by definition version. Do not try to manipulate instance state directly in the database.</p>'
        },
        {
          question: 'Why does Elsa retain the definition row for older versions?',
          answer: '<p>Because running instances hold a reference to their definition version. When the engine resumes a suspended instance, it loads the definition to reconstruct the activity graph: which activity is at the bookmark position, what its inputs and outputs are, what the graph edges look like. If the definition row is deleted, the engine cannot load the graph and the resume fails. Retaining old definition rows is the only way to guarantee that all in-flight instances can complete, even if the definition has been superseded multiple times since they started.</p>'
        }
      ]
    }
  }

]; // end topics array

export default topics;
