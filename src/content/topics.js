/**
 * AWFS Elsa Academy: All topic content.
 * Wrapped in IIFE so const topics does not collide with app.js in shared global scope.
 */
(function () {

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

,
  // ── TIER 2 ──────────────────────────────────────────────────────────────────

  {
    id: 't2-01',
    tier: 2,
    title: 'Signal and Event Activities',
    slug: 'signal-and-event-activities',
    estimatedMinutes: 35,
    prerequisites: ['t1-03', 't1-04'],
    tabs: {
      concept: `<h2 id="concept-signals">The Event Activity as a Bookmark Mechanism</h2>
<p>When Elsa encounters an <code>Event</code> activity, it writes a <strong>bookmark</strong> to the persistence store and suspends the workflow instance. The bookmark records three things: the workflow instance ID, the activity ID, and the <em>event name</em> it is waiting for. The instance is now idle — no thread is held.</p>

<h3>SendSignal vs Trigger</h3>
<p><strong>Signals</strong> (sent via <code>IWorkflowRuntime.SendSignalAsync</code>) are routed to a specific running instance by <strong>correlationId</strong>. The caller says "resume the instance whose correlationId is <code>DOC-2024-001</code> and whose Event bookmark is named <code>ApprovalDecision</code>". Only one instance is targeted.</p>
<p><strong>Triggers</strong> (sent via <code>IWorkflowRuntime.TriggerWorkflowAsync</code>) identify a workflow <em>definition</em> by name or hash and start a new instance — or resume any suspended instance of that definition waiting on a matching bookmark, depending on the activity. Use triggers when you want to <em>start</em>; use signals when you want to <em>resume a specific instance</em>.</p>

<h3>CorrelationId Routing</h3>
<p>The correlationId is set at dispatch time and stored on the <code>WorkflowInstance</code> row. When you call <code>SendSignalAsync</code>, the runtime queries the bookmark table for a row matching <code>(eventName, correlationId)</code>. If exactly one match is found, that instance is loaded and resumed. If zero matches are found, the signal is silently dropped (or an exception is thrown, depending on configuration). If multiple matches are found, all are resumed — this is usually a bug caused by non-unique correlationIds.</p>

<h3>AWFS Connection</h3>
<p>In the Approval Workflow, after dispatching an instance for document <code>DOC-2024-001</code>, the frontend Approval UI collects the approver's decision and calls a thin API endpoint. That endpoint calls <code>SendSignalAsync</code> with <code>correlationId = "DOC-2024-001"</code> and an <code>ApproverDecision</code> payload carrying <code>{ decision: "Approved", comment: "Looks good" }</code>. The suspended instance resumes at the <code>Event</code> activity, reads the payload from the bookmark input, and continues to the next gate.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Workflow waiting for ApprovalDecision event',
          filename: 'ApprovalEventWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Contracts;

public class ApprovalEventWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        var decision = builder.WithVariable<string>();

        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("Workflow started. Waiting for approval decision..."),

                // Suspend here; resume when a signal named "ApprovalDecision"
                // arrives on this instance's correlationId.
                new Event("ApprovalDecision")
                {
                    // The signal payload is stored as the activity output.
                    // Access it via the activity's Output property.
                },

                new WriteLine(context =>
                {
                    // Read the event payload written by the resume call.
                    var payload = context.GetInput<ApproverDecision>("ApprovalDecision");
                    return $"Decision received: {payload?.Decision} — {payload?.Comment}";
                })
            }
        };
    }
}

public record ApproverDecision(string Decision, string Comment);`,
          explanation: 'The <code>Event</code> activity name is the signal name. The runtime matches incoming signals to bookmarks by this name plus the correlationId of the instance.'
        },
        {
          language: 'csharp',
          title: 'API endpoint that resumes the workflow via SendSignalAsync',
          filename: 'ApprovalController.cs',
          code: `using Elsa.Workflows.Runtime.Contracts;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/approvals")]
public class ApprovalController : ControllerBase
{
    private readonly IWorkflowRuntime _runtime;

    public ApprovalController(IWorkflowRuntime runtime)
        => _runtime = runtime;

    [HttpPost("{documentId}/decision")]
    public async Task<IActionResult> SubmitDecision(
        string documentId,
        [FromBody] ApproverDecision decision,
        CancellationToken cancellationToken)
    {
        // correlationId must match what was set at dispatch time.
        var result = await _runtime.SendSignalAsync(
            signal: "ApprovalDecision",
            input: decision,
            correlationId: documentId,
            cancellationToken: cancellationToken);

        if (!result.WorkflowInstanceIds.Any())
            return NotFound($"No workflow instance awaiting ApprovalDecision for {documentId}");

        return Ok(new { resumed = result.WorkflowInstanceIds });
    }
}`,
          explanation: '<code>SendSignalAsync</code> returns the IDs of all instances that were resumed. An empty list means the signal found no matching bookmark — check that the correlationId and event name are correct.'
        }
      ],

      handsOn: {
        goal: 'Build a workflow that suspends at a named Event bookmark and prints the payload when resumed via a signal.',
        steps: [
          'Create <code>SignalDemoWorkflow.cs</code> with a <code>Sequence</code> containing a <code>WriteLine("Waiting...")</code> followed by an <code>Event("PingReceived")</code> followed by a <code>WriteLine</code> that prints the payload.',
          'Register the workflow in <code>Program.cs</code> with <code>elsa.AddWorkflow&lt;SignalDemoWorkflow&gt;()</code>.',
          'Dispatch the workflow with a correlationId of <code>"ping-test-1"</code> from a startup hook or minimal API endpoint.',
          'Verify the console shows <code>Waiting...</code> and the instance is in <code>Suspended</code> state via the management API: <code>GET /elsa/api/workflow-instances?correlationId=ping-test-1</code>.',
          'Send the resume signal: <code>POST /elsa/api/workflow-instances/{id}/signal</code> with body <code>{"signalName":"PingReceived","input":{"message":"Hello from curl"}}</code>, or call <code>SendSignalAsync</code> from a test endpoint.',
          'Verify the console prints the payload message and the instance transitions to <code>Finished</code>.',
          'Test the not-found path: send the same signal again and confirm you get an empty resumed list (the bookmark is consumed on first resume).',
          'Add a second parallel dispatch with correlationId <code>"ping-test-2"</code> and confirm signals route independently.'
        ],
        verification: [
          'Console shows <code>Waiting...</code> immediately after dispatch.',
          'Instance status is <code>Suspended</code> before the signal is sent.',
          'Console shows the payload text after <code>SendSignalAsync</code> is called.',
          'Instance status is <code>Finished</code> after the signal is processed.'
        ],
        pitfalls: [
          '<strong>Wrong correlationId case.</strong> CorrelationIds are compared as strings; <code>"DOC-001"</code> and <code>"doc-001"</code> are different. Normalise to a consistent case (upper or lower) at all entry points.',
          '<strong>Duplicate correlationIds.</strong> If two instances share a correlationId and both wait on the same event name, both will be resumed. Ensure document IDs used as correlationIds are globally unique before dispatch.',
          '<strong>Signal dropped silently.</strong> By default, if no bookmark matches, <code>SendSignalAsync</code> returns an empty list without throwing. Add a guard in your API to return a 404 so the caller knows the signal did not land.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the difference between sending a signal and triggering a workflow?',
          answer: '<p>A <strong>signal</strong> targets a specific, already-running workflow instance identified by its correlationId plus an event name. It resumes a suspended bookmark. A <strong>trigger</strong> targets a workflow <em>definition</em> by name; it typically starts a new instance (or resumes any instance waiting on a trigger bookmark). Use signals to drive an in-progress approval; use triggers to start a new one.</p>'
        },
        {
          question: 'What happens if you call SendSignalAsync with a correlationId that does not match any suspended instance?',
          answer: '<p>By default, the call returns a result object with an empty <code>WorkflowInstanceIds</code> collection — the signal is silently discarded. No exception is thrown. Your calling code must check the collection and handle the not-found case explicitly, for example by returning HTTP 404 to the UI.</p>'
        },
        {
          question: 'Why would multiple workflow instances be resumed by a single SendSignalAsync call?',
          answer: '<p>Because multiple dispatched instances share the same correlationId. Elsa matches bookmarks by <em>both</em> event name and correlationId, so if two instances were dispatched with identical correlationIds and both are waiting on the same event name, both will be resumed simultaneously. This is almost always a bug. Ensure correlationIds are unique per approval request — for AWFS, the document ID is a natural unique key.</p>'
        }
      ]
    }
  },

  {
    id: 't2-02',
    tier: 2,
    title: 'HTTP Activities',
    slug: 'http-activities',
    estimatedMinutes: 30,
    prerequisites: ['t1-02', 't1-03'],
    tabs: {
      concept: `<h2 id="concept-http-activities">HTTP as a First-Class Workflow Trigger</h2>
<p>Elsa ships an <code>Elsa.Http</code> package that adds two fundamental activities: <code>HttpEndpoint</code> (inbound) and <code>SendHttpRequest</code> (outbound).</p>

<h3>HttpEndpoint — workflow started over HTTP</h3>
<p><code>HttpEndpoint</code> replaces a programmatic <code>DispatchWorkflowAsync</code> call entirely. You configure a path and HTTP method on the activity, and Elsa registers a matching ASP.NET route. When a request hits that route, Elsa starts (or resumes) a workflow instance. The request body, headers, and route values are available as activity outputs that downstream activities can read.</p>
<p>Compared to dispatching via <code>IWorkflowRuntime</code>, <code>HttpEndpoint</code> is simpler for external callers — no Elsa-specific API knowledge required, just a plain HTTP POST. The tradeoff is that the response is returned inline if the workflow uses <code>WriteHttpResponse</code>, so the HTTP connection stays open until the workflow reaches the response activity or times out.</p>

<h3>SendHttpRequest — outbound calls from within a workflow</h3>
<p><code>SendHttpRequest</code> makes an HTTP call to an external URL during workflow execution. You set the method, URL (which can be an expression using workflow variables), headers, and body. The response status code, headers, and parsed body are available as activity outputs. This is how a workflow calls a microservice — for example, fetching the approver chain from an MDM API.</p>

<h3>WriteHttpResponse</h3>
<p><code>WriteHttpResponse</code> writes the HTTP response back to the caller of an <code>HttpEndpoint</code>-triggered workflow. Set the status code, content type, and body. Once this activity executes, the HTTP connection is completed.</p>

<h3>JSON Body Extraction</h3>
<p>The request body from <code>HttpEndpoint</code> is exposed as a <code>JsonElement</code> (or deserialized to a typed model if you configure a content type). Use <code>context.GetActivityOutput&lt;JsonElement&gt;(httpEndpointActivityId)</code> or bind via activity input expressions to extract fields.</p>

<h3>AWFS Connection</h3>
<p>In AWFS, the approval submission endpoint — <code>POST /api/approvals/submit</code> — can be modeled as an <code>HttpEndpoint</code>-triggered workflow. The request body carries <code>DocumentId</code>, <code>RequesterId</code>, and <code>Amount</code>. No separate controller is needed; Elsa handles the routing. Alternatively, a thin controller dispatches the workflow programmatically — both patterns are valid. The MDM approver-chain lookup inside the workflow is a classic <code>SendHttpRequest</code> use case.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Workflow started via HttpEndpoint POST',
          filename: 'SubmitApprovalWorkflow.cs',
          code: `using Elsa.Http;
using Elsa.Workflows;
using Elsa.Workflows.Activities;

public class SubmitApprovalWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        // Define a variable to hold the parsed request body.
        var requestBody = builder.WithVariable<ApprovalRequest>();

        var httpEndpoint = new HttpEndpoint
        {
            Path = new("/api/approvals/submit"),
            SupportedMethods = new(new[] { HttpMethod.Post }),
            // Parse the body as ApprovalRequest automatically.
            ParsedContent = new Output<object>(requestBody)
        };

        builder.Root = new Sequence
        {
            Activities =
            {
                httpEndpoint,

                new WriteLine(ctx =>
                    $"Received approval request for doc: {ctx.Get(requestBody)?.DocumentId}"),

                // ... approval logic ...

                new WriteHttpResponse
                {
                    StatusCode = new(System.Net.HttpStatusCode.Accepted),
                    Content = new("{ \"status\": \"queued\" }"),
                    ContentType = new("application/json")
                }
            }
        };
    }
}

public record ApprovalRequest(string DocumentId, string RequesterId, decimal Amount);`,
          explanation: '<code>HttpEndpoint</code> registers the route automatically once the workflow definition is published. The <code>ParsedContent</code> output holds the deserialized request body.'
        },
        {
          language: 'csharp',
          title: 'Workflow using SendHttpRequest to call MDM API',
          filename: 'MdmLookupWorkflow.cs',
          code: `using Elsa.Http;
using Elsa.Workflows;
using Elsa.Workflows.Activities;
using System.Net.Http;

public class MdmLookupWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        var costCenter = builder.WithVariable<string>("CC-1001");
        var approverChain = builder.WithVariable<ApproverChain>();

        var mdmRequest = new SendHttpRequest
        {
            Url = new(ctx => $"https://mdm.internal/api/approvers/{ctx.Get(costCenter)}"),
            Method = new(HttpMethod.Get),
            // Deserialize the JSON response body into ApproverChain.
            ParsedContent = new Output<object>(approverChain)
        };

        builder.Root = new Sequence
        {
            Activities =
            {
                mdmRequest,
                new WriteLine(ctx =>
                {
                    var chain = ctx.Get(approverChain);
                    return $"Approvers: {string.Join(", ", chain?.Approvers ?? Array.Empty<string>())}";
                })
            }
        };
    }
}

public record ApproverChain(string[] Approvers);`,
          explanation: '<code>SendHttpRequest</code> blocks execution until the HTTP response is received. The <code>ParsedContent</code> output variable holds the deserialized JSON response body.'
        },
        {
          language: 'csharp',
          title: 'WriteHttpResponse with dynamic body',
          filename: 'WriteResponseSnippet.cs',
          code: `// Inside a workflow Build() method, after processing:
var resultVar = builder.WithVariable<string>();

// ... populate resultVar via earlier activities ...

new WriteHttpResponse
{
    StatusCode = new(System.Net.HttpStatusCode.OK),
    ContentType = new("application/json"),
    // Expression reads the workflow variable at runtime.
    Content = new(ctx => \$"{{\"result\":\"{ctx.Get(resultVar)}\"}}")
}`,
          explanation: 'The <code>Content</code> input accepts a lambda expression so the response body can include workflow variable values resolved at runtime.'
        }
      ],

      handsOn: {
        goal: 'Build a workflow that accepts a JSON POST, calls an external URL using SendHttpRequest, and writes the response back to the HTTP caller.',
        steps: [
          'Add the <code>Elsa.Http</code> NuGet package and call <code>elsa.UseHttp()</code> in <code>Program.cs</code>.',
          'Create <code>HttpProxyWorkflow.cs</code>. Add an <code>HttpEndpoint</code> activity on <code>POST /proxy/fetch</code> that expects a body like <code>{"url":"https://httpbin.org/get"}</code>.',
          'Declare a variable <code>targetUrl</code> and bind it from the parsed request body.',
          'Add a <code>SendHttpRequest</code> activity using <code>targetUrl</code> as its URL, method GET.',
          'Declare a variable <code>responseBody</code> and bind it to the <code>ResponseContent</code> output of <code>SendHttpRequest</code>.',
          'Add a <code>WriteHttpResponse</code> that echoes <code>responseBody</code> as <code>application/json</code> with status 200.',
          'Run the app and test: <code>curl -X POST http://localhost:5000/proxy/fetch -H "Content-Type: application/json" -d \'{"url":"https://httpbin.org/get"}\'</code>.',
          'Verify the response from httpbin.org is returned directly to the curl caller.'
        ],
        verification: [
          'The route <code>POST /proxy/fetch</code> responds without a 404.',
          '<code>SendHttpRequest</code> successfully calls the external URL (check logs for outbound request).',
          'The curl caller receives the upstream JSON response body.',
          'Status code returned is 200 OK.'
        ],
        pitfalls: [
          '<strong>Forgetting UseHttp().</strong> Without <code>elsa.UseHttp()</code>, the <code>HttpEndpoint</code> and <code>SendHttpRequest</code> activities are not registered and will throw at startup or resolve as unknown activities.',
          '<strong>HTTP connection timeout on inline response.</strong> If the workflow takes too long before reaching <code>WriteHttpResponse</code>, the caller times out. For long-running workflows, return HTTP 202 Accepted immediately and use a webhook callback instead of an inline response.',
          '<strong>Body parsing type mismatch.</strong> If the content type header is not set to <code>application/json</code>, Elsa may not attempt JSON deserialization. Always set <code>Content-Type: application/json</code> on requests to <code>HttpEndpoint</code> workflows.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the main difference between starting a workflow with HttpEndpoint versus calling DispatchWorkflowAsync from a controller?',
          answer: '<p><code>HttpEndpoint</code> makes the workflow itself the HTTP handler — no controller code is needed, and the HTTP connection stays open while the workflow runs synchronously up to a <code>WriteHttpResponse</code>. <code>DispatchWorkflowAsync</code> is a fire-and-forget dispatch from application code; the controller responds immediately with a 202 and the workflow runs asynchronously. Use <code>HttpEndpoint</code> for simple request/response flows; use <code>DispatchWorkflowAsync</code> for long-running workflows where the caller should not wait.</p>'
        },
        {
          question: 'How does a workflow read individual fields from the JSON body of an HttpEndpoint request?',
          answer: '<p>The <code>HttpEndpoint</code> activity exposes a <code>ParsedContent</code> output that holds the deserialized body. If you provide a target type, Elsa deserializes to that type automatically. You bind this output to a workflow variable, then read fields via <code>ctx.Get(myVariable)?.FieldName</code> in downstream activity input expressions. Alternatively, the raw <code>JsonElement</code> is available if you need dynamic property access.</p>'
        },
        {
          question: 'How can you correlate an HttpEndpoint-triggered workflow to resume it later with a signal?',
          answer: '<p>Extract a unique identifier from the request body (e.g., <code>DocumentId</code>) and use a <code>SetWorkflowContext</code> or a custom activity to call <code>context.WorkflowExecutionContext.CorrelationId = documentId</code> early in the workflow. Alternatively, set the correlationId expression on the <code>HttpEndpoint</code> activity itself so it is applied at instance creation. Future signal calls then target this correlationId.</p>'
        }
      ]
    }
  },

  {
    id: 't2-03',
    tier: 2,
    title: 'Error Handling and Fault Tolerance',
    slug: 'error-handling-and-fault-tolerance',
    estimatedMinutes: 30,
    prerequisites: ['t1-03', 't1-04'],
    tabs: {
      concept: `<h2 id="concept-error-handling">Faults vs Exceptions in Elsa</h2>
<p>When an activity throws an unhandled .NET exception, Elsa catches it and transitions the workflow instance to a <strong>Faulted</strong> state. The exception message is stored on the instance record. The workflow stops executing — no subsequent activities run. This is different from a <em>handled</em> exception inside a <code>TryCatch</code> activity, which keeps the workflow alive.</p>

<h3>TryCatch Activity</h3>
<p><code>TryCatch</code> wraps one or more activities in a try body. If any activity in the body throws, control jumps to the <code>Catch</code> branch. Inside <code>Catch</code>, you can inspect the exception via <code>context.GetActivityOutput&lt;Exception&gt;(tryCatchId)</code>, log it, set a variable, or take a compensating action. After <code>Catch</code> completes, the workflow continues normally — the instance remains <code>Running</code>, not <code>Faulted</code>.</p>

<h3>Retry Loops</h3>
<p>Elsa has no built-in <code>Retry</code> activity in version 3.x, but you can compose one using a <code>While</code> loop, a counter variable, and a <code>TryCatch</code>. The pattern: initialise <code>attempt = 0</code>; loop while <code>attempt &lt; maxRetries &amp;&amp; !succeeded</code>; inside the loop, wrap the risky activity in <code>TryCatch</code>; on success set <code>succeeded = true</code>; on catch increment <code>attempt</code>. After the loop, check if <code>succeeded</code> is false and fault gracefully.</p>

<h3>Compensation</h3>
<p>Elsa 3.x has a <code>Compensate</code> activity that triggers a named compensation handler registered on a <code>CompensableActivity</code>. This is useful for saga-style rollback: if a multi-step operation partially succeeds, the compensation handler undoes the completed steps. In AWFS, if the MDM write succeeds but the notification fails, compensation can roll back the MDM write.</p>

<h3>AWFS Connection</h3>
<p>The MDM API lookup inside an approval workflow is a prime candidate for <code>TryCatch</code>. A transient MDM outage should not kill the entire approval workflow. Instead: catch the exception, increment a retry counter, wait a short delay, and retry. After three failures, set a workflow variable <code>MdmLookupFailed = true</code> and branch to a fallback path that uses a hardcoded approver list or sends an alert to the workflow administrator.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'TryCatch around a failing activity',
          filename: 'TryCatchWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

public class TryCatchWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        var errorMessage = builder.WithVariable<string>();

        builder.Root = new Sequence
        {
            Activities =
            {
                new TryCatch
                {
                    Try = new Sequence
                    {
                        Activities =
                        {
                            new WriteLine("Attempting risky operation..."),
                            // This activity throws deliberately for demo purposes.
                            new InlineActivity(ctx =>
                                throw new InvalidOperationException("MDM service unavailable")),
                            new WriteLine("This line is never reached.")
                        }
                    },
                    Catch = new Sequence
                    {
                        Activities =
                        {
                            // Read the caught exception from TryCatch output.
                            new SetVariable<string>
                            {
                                Variable = errorMessage,
                                Value = new(ctx =>
                                {
                                    var ex = ctx.GetActivityOutput<Exception>("try-catch-1");
                                    return ex?.Message ?? "Unknown error";
                                })
                            },
                            new WriteLine(ctx =>
                                $"Caught exception: {ctx.Get(errorMessage)}. Continuing workflow.")
                        }
                    }
                },
                new WriteLine("Workflow completed despite the error.")
            }
        };
    }
}`,
          explanation: 'When the <code>InlineActivity</code> throws, the <code>TryCatch</code> catches the exception and executes the <code>Catch</code> branch. The instance stays <code>Running</code> and the sequence continues after the <code>TryCatch</code>.'
        },
        {
          language: 'csharp',
          title: 'Retry loop with a counter variable',
          filename: 'RetryLoopWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;

public class RetryLoopWorkflow : WorkflowBase
{
    protected override void Build(IWorkflowBuilder builder)
    {
        var attempt   = builder.WithVariable<int>(0);
        var succeeded = builder.WithVariable<bool>(false);
        const int maxAttempts = 3;

        builder.Root = new Sequence
        {
            Activities =
            {
                // Retry loop: up to maxAttempts times.
                new While(ctx => ctx.Get(attempt) < maxAttempts && !ctx.Get(succeeded))
                {
                    Body = new Sequence
                    {
                        Activities =
                        {
                            new TryCatch
                            {
                                Try = new Sequence
                                {
                                    Activities =
                                    {
                                        new WriteLine(ctx =>
                                            $"Attempt {ctx.Get(attempt) + 1} of {maxAttempts}"),
                                        // Replace with real HTTP call in production.
                                        new InlineActivity(ctx =>
                                        {
                                            // Simulate failure on first two attempts.
                                            if (ctx.Get(attempt) < 2)
                                                throw new HttpRequestException("Transient error");
                                            ctx.Set(succeeded, true);
                                        }),
                                        new WriteLine("Call succeeded!")
                                    }
                                },
                                Catch = new Sequence
                                {
                                    Activities =
                                    {
                                        new InlineActivity(ctx =>
                                            ctx.Set(attempt, ctx.Get(attempt) + 1)),
                                        new WriteLine(ctx =>
                                            $"Attempt failed. Retries used: {ctx.Get(attempt)}")
                                    }
                                }
                            }
                        }
                    }
                },

                // After the loop: check outcome.
                new If(ctx => !ctx.Get(succeeded))
                {
                    Then = new WriteLine("All retries exhausted. Faulting gracefully."),
                    Else = new WriteLine("Operation completed successfully.")
                }
            }
        };
    }
}`,
          explanation: 'The <code>While</code> condition checks both the attempt count and the success flag. The retry loop exits either on success or when all attempts are consumed. This pattern works for any transient failure — MDM lookups, notification calls, etc.'
        },
        {
          language: 'csharp',
          title: 'Inspecting a faulted workflow instance',
          filename: 'FaultInspection.cs',
          code: `using Elsa.Workflows.Runtime.Contracts;
using Elsa.Workflows.Management.Contracts;

// In a minimal API or controller:
app.MapGet("/instances/{id}/fault", async (
    string id,
    IWorkflowInstanceStore store) =>
{
    var instance = await store.FindAsync(
        new WorkflowInstanceFilter { Id = id });

    if (instance is null)
        return Results.NotFound();

    if (instance.Status != WorkflowStatus.Faulted)
        return Results.Ok(new { status = instance.Status.ToString() });

    return Results.Ok(new
    {
        status    = "Faulted",
        fault     = instance.Fault?.Message,
        activity  = instance.Fault?.FaultedActivityId,
        timestamp = instance.Fault?.Timestamp
    });
});`,
          explanation: 'The <code>WorkflowInstance.Fault</code> property carries the exception message, the ID of the activity that threw, and the timestamp. Use this in an operations dashboard to diagnose stuck workflows.'
        }
      ],

      handsOn: {
        goal: 'Build a workflow that retries an HTTP call up to 3 times before faulting gracefully, without letting the instance reach Faulted state on transient errors.',
        steps: [
          'Create <code>ResilientHttpWorkflow.cs</code> with variables: <code>attempt (int = 0)</code>, <code>succeeded (bool = false)</code>, <code>lastError (string)</code>.',
          'Add a <code>While</code> loop with condition <code>attempt &lt; 3 &amp;&amp; !succeeded</code>.',
          'Inside the loop, add a <code>TryCatch</code>. In the <code>Try</code> branch, add a <code>SendHttpRequest</code> targeting a URL that returns 500 for the first two calls (use <code>https://httpbin.org/status/500</code> and swap to <code>/get</code> after verifying retry logic).',
          'Check the response status code in the <code>Try</code> branch: if it is not 200, throw an exception manually so the catch is triggered.',
          'In the <code>Catch</code> branch, increment <code>attempt</code> and set <code>lastError</code> from the exception message.',
          'After the loop, add an <code>If</code>: if <code>!succeeded</code>, write "All retries exhausted: {lastError}" and let the workflow finish normally (not faulted).',
          'Verify in the management API that the instance ends as <code>Finished</code> (not <code>Faulted</code>) after exhausting retries.'
        ],
        verification: [
          'Console shows attempt 1, 2, 3 before giving up.',
          'Instance status is <code>Finished</code>, not <code>Faulted</code>, after three failures.',
          'When the target URL returns 200, the loop exits after the first successful attempt.',
          '<code>lastError</code> variable contains the exception message from the final failed attempt.'
        ],
        pitfalls: [
          '<strong>Forgetting to increment the counter inside Catch.</strong> If the counter is never incremented, the While loop runs forever. Always put the increment in the Catch branch, not the Try branch.',
          '<strong>Confusing Faulted state with graceful termination.</strong> A workflow that exits the retry loop and finishes normally is in <code>Finished</code> state — not <code>Faulted</code>. <code>Faulted</code> only occurs when an exception escapes all TryCatch wrappers.',
          '<strong>SendHttpRequest does not throw on non-2xx.</strong> By default, <code>SendHttpRequest</code> does not throw an exception for 4xx/5xx responses — it just exposes the status code as an output. You must read the status code and throw manually if you want retry logic to trigger.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the difference between a workflow in Faulted state and one that handled an exception via TryCatch?',
          answer: '<p>A <strong>Faulted</strong> instance has an unhandled exception that escaped all <code>TryCatch</code> wrappers — the workflow stopped, no further activities will run, and the fault details are stored on the instance record. A workflow that handled an exception via <code>TryCatch</code> remains in <strong>Running</strong> (or <strong>Suspended</strong>) state; execution continues normally after the Catch branch. Only unhandled exceptions cause the Faulted transition.</p>'
        },
        {
          question: 'How does SendHttpRequest behave on a 500 response from the remote server — does it throw automatically?',
          answer: '<p>No. By default, <code>SendHttpRequest</code> does not throw on non-2xx status codes. It completes normally and exposes the <code>StatusCode</code> output. You must explicitly check the status code in a downstream activity and throw (or branch to an error path) if needed. This means a 500 from MDM will silently pass through unless you add that check.</p>'
        },
        {
          question: 'When would you use a Compensate activity instead of a TryCatch retry?',
          answer: '<p>Use <code>Compensate</code> when a multi-step operation has <em>partially succeeded</em> and you need to undo the completed steps — a saga rollback. For example, if an MDM write succeeds but a downstream notification fails, compensation triggers the MDM rollback handler. Use <code>TryCatch</code> + retry for <em>transient failures</em> where you want to reattempt the same operation. Compensation is for irreversibility; retry is for transience.</p>'
        }
      ]
    }
  },

  {
    id: 't2-04',
    tier: 2,
    title: 'Workflow Input and Output',
    slug: 'workflow-input-and-output',
    estimatedMinutes: 25,
    prerequisites: ['t1-02', 't1-03'],
    tabs: {
      concept: `<h2 id="concept-input-output">Parameterising Workflows at Dispatch Time</h2>
<p>Workflow variables (covered in T1-03) hold state that evolves during execution. <strong>Workflow inputs</strong> are different: they are typed values supplied by the <em>caller</em> at dispatch time, before the workflow starts. They do not change during execution. Think of them as constructor parameters for the workflow instance.</p>

<h3>Declaring Typed Inputs</h3>
<p>In a code-based workflow, declare an input as a property of type <code>Input&lt;T&gt;</code> on your <code>WorkflowBase</code> subclass and decorate it with <code>[WorkflowInput]</code>. Elsa discovers these properties via reflection when the workflow definition is published. At dispatch time, the caller passes a dictionary of <code>{ "PropertyName": value }</code>. Elsa deserializes each value into the declared type and makes them available via the execution context.</p>

<h3>Reading Inputs Inside Activities</h3>
<p>Inside an activity's <code>ExecuteAsync</code> method, call <code>context.WorkflowExecutionContext.Input.GetValue&lt;T&gt;("PropertyName")</code>. In activity input expressions on the workflow, you can use the shorthand <code>context.GetInput&lt;T&gt;("PropertyName")</code> (extension method from <code>Elsa.Workflows.Helpers</code>).</p>

<h3>Workflow Output</h3>
<p>Declare an <code>Output&lt;T&gt;</code> property on the workflow class. Inside the workflow, use <code>context.WorkflowExecutionContext.Output.Set("PropertyName", value)</code>. After the workflow finishes, the caller can read the output from the <code>WorkflowInstance.Output</code> dictionary. This is useful when an approval workflow needs to return a final status or a decision summary to the dispatching service.</p>

<h3>AWFS Connection</h3>
<p>The AWFS approval workflow is dispatched with three typed inputs: <code>DocumentId (string)</code>, <code>RequesterId (string)</code>, and <code>Amount (decimal)</code>. These drive the MDM lookup URL, the notification recipient, and the approval threshold logic. No global state or headers are needed — everything the workflow needs is in its inputs, making each instance fully self-contained.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Workflow class with typed Input properties',
          filename: 'ApprovalWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Attributes;
using Elsa.Workflows.Activities;

public class ApprovalWorkflow : WorkflowBase
{
    // These properties are discovered by Elsa at publish time.
    [WorkflowInput(Description = "The document being approved.")]
    public Input<string> DocumentId { get; set; } = default!;

    [WorkflowInput(Description = "Employee who submitted the request.")]
    public Input<string> RequesterId { get; set; } = default!;

    [WorkflowInput(Description = "Total amount requiring approval.")]
    public Input<decimal> Amount { get; set; } = default!;

    // Output returned to the caller after the workflow finishes.
    [WorkflowOutput(Description = "Final approval decision.")]
    public Output<string> FinalDecision { get; set; } = default!;

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine(ctx =>
                {
                    var docId  = ctx.GetInput<string>(nameof(DocumentId));
                    var amount = ctx.GetInput<decimal>(nameof(Amount));
                    return $"Processing approval for {docId}, amount: {amount:C}";
                }),

                // ... approval gates ...

                // Write the output before finishing.
                new InlineActivity(ctx =>
                    ctx.WorkflowExecutionContext.Output
                       .Set(nameof(FinalDecision), "Approved"))
            }
        };
    }
}`,
          explanation: '<code>[WorkflowInput]</code> and <code>[WorkflowOutput]</code> attributes tell Elsa to surface these properties in the management API and Studio designer as typed parameters.'
        },
        {
          language: 'csharp',
          title: 'Dispatching with DispatchWorkflowAsync and passing typed inputs',
          filename: 'DispatchWithInputs.cs',
          code: `using Elsa.Workflows.Runtime.Contracts;
using Elsa.Workflows.Runtime.Requests;

public class ApprovalService
{
    private readonly IWorkflowRuntime _runtime;

    public ApprovalService(IWorkflowRuntime runtime)
        => _runtime = runtime;

    public async Task<string> SubmitAsync(
        string documentId,
        string requesterId,
        decimal amount,
        CancellationToken ct)
    {
        var request = new DispatchWorkflowDefinitionRequest
        {
            DefinitionId  = "ApprovalWorkflow",   // matches the class name by default
            VersionOptions = VersionOptions.Published,
            CorrelationId  = documentId,           // used by signals to target this instance

            // Input dictionary keys must match the [WorkflowInput] property names exactly.
            Input = new WorkflowInput(new Dictionary<string, object>
            {
                [nameof(ApprovalWorkflow.DocumentId)]  = documentId,
                [nameof(ApprovalWorkflow.RequesterId)] = requesterId,
                [nameof(ApprovalWorkflow.Amount)]      = amount
            })
        };

        var result = await _runtime.DispatchAsync(request, ct);
        return result.WorkflowInstanceId;
    }
}`,
          explanation: 'The input dictionary key names must match the C# property names on the workflow class exactly (case-sensitive). Mismatched names silently produce null inputs — use <code>nameof()</code> to avoid typos.'
        },
        {
          language: 'csharp',
          title: 'Reading workflow input inside a custom activity',
          filename: 'ReadInputActivity.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Attributes;

[Activity("AWFS", "Reads the approval workflow inputs for processing.")]
public class ProcessApprovalInputActivity : Activity
{
    protected override ValueTask ExecuteAsync(ActivityExecutionContext context)
    {
        // Read typed inputs from the workflow execution context.
        var documentId = context.WorkflowExecutionContext
            .Input.GetValue<string>("DocumentId");

        var amount = context.WorkflowExecutionContext
            .Input.GetValue<decimal>("Amount");

        // Use the inputs to drive logic.
        var threshold = amount > 50_000_000m ? "Director" : "Manager";

        context.WorkflowExecutionContext.Properties["RequiredApprover"] = threshold;

        return ValueTask.CompletedTask;
    }
}`,
          explanation: 'Custom activities access workflow-level inputs via <code>context.WorkflowExecutionContext.Input</code>. This is distinct from activity-level inputs, which are bound via <code>Input&lt;T&gt;</code> properties on the activity class itself.'
        }
      ],

      handsOn: {
        goal: 'Add typed inputs to the approval skeleton, dispatch with real values, and verify the inputs are readable inside activities.',
        steps: [
          'Open the approval workflow from T1 and add three <code>[WorkflowInput]</code> properties: <code>DocumentId (string)</code>, <code>RequesterId (string)</code>, <code>Amount (decimal)</code>.',
          'Add a <code>[WorkflowOutput]</code> property <code>FinalDecision (string)</code>.',
          'In the first activity of the workflow (a <code>WriteLine</code>), use <code>ctx.GetInput&lt;string&gt;(nameof(DocumentId))</code> to print the document ID.',
          'Create a <code>DispatchController</code> with a POST endpoint that accepts <code>{ documentId, requesterId, amount }</code> and calls <code>DispatchAsync</code> with the input dictionary.',
          'Register the controller and run. POST to the endpoint with real values.',
          'Check the console output to confirm the <code>WriteLine</code> activity printed the correct <code>DocumentId</code>.',
          'In the final activity, set the <code>FinalDecision</code> output to <code>"Approved"</code> and verify it appears on the instance record via <code>GET /elsa/api/workflow-instances/{id}</code>.'
        ],
        verification: [
          'Console prints the exact <code>DocumentId</code> passed at dispatch, not null or empty.',
          '<code>Amount</code> is readable as a <code>decimal</code> inside activities without casting errors.',
          'The workflow instance record shows the output dictionary with <code>FinalDecision: "Approved"</code>.',
          'A second dispatch with different input values produces a separate instance with its own correct values.'
        ],
        pitfalls: [
          '<strong>Input key case sensitivity.</strong> The dictionary key <code>"documentId"</code> (camelCase) will not match a property named <code>DocumentId</code> (PascalCase). Always use <code>nameof()</code> or match the exact property name.',
          '<strong>Decimal serialization over JSON.</strong> When dispatching via the HTTP management API (not C# code), JSON numbers are deserialized as <code>double</code> by default. Elsa re-serializes to the declared type, but very large decimal values may lose precision. For monetary amounts, pass as string and parse inside the workflow.',
          '<strong>Missing [WorkflowInput] attribute.</strong> Without the attribute, the property is not surfaced in the definition metadata. Dispatch still works by dictionary key, but the Studio designer will not show the input and validation is skipped.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the difference between a workflow variable and a workflow input?',
          answer: '<p>A <strong>workflow variable</strong> is mutable state owned by the workflow instance — it starts with a default value and changes as activities execute. A <strong>workflow input</strong> is an immutable value supplied by the caller at dispatch time; it cannot be changed during execution. Use inputs for parameters the caller controls (DocumentId, Amount); use variables for state the workflow accumulates (RetryCount, CurrentApprover).</p>'
        },
        {
          question: 'How do you ensure that a second dispatch with different inputs produces an independent instance, not corrupting a running instance?',
          answer: '<p>Each call to <code>DispatchAsync</code> creates a <strong>new</strong> workflow instance with its own isolated scope. Inputs are stored on the instance record, not shared globally. As long as you supply different correlationIds at dispatch, the two instances are completely independent. The only collision risk is if you intentionally re-use the same correlationId for two dispatches — do not do that for approval workflows.</p>'
        },
        {
          question: 'How does a calling service read the output of a completed workflow?',
          answer: '<p>After the workflow finishes, the caller queries the workflow instance via <code>IWorkflowInstanceStore.FindAsync</code> and reads the <code>WorkflowInstance.Output</code> dictionary. The output values are serialized as JSON in the persistence store. Alternatively, the workflow can push its output proactively via a webhook activity or by calling an external API as its last step — polling the instance for output is fine for demos but fragile in production.</p>'
        }
      ]
    }
  }

,
  {
    id: 't2-05',
    tier: 2,
    title: 'Correlation',
    slug: 'correlation',
    estimatedMinutes: 25,
    prerequisites: ['t2-01', 't2-04'],
    tabs: {
      concept: `<h2 id="concept-correlation">CorrelationId: the Routing Key for Running Instances</h2>
<p>A <strong>correlationId</strong> is a caller-supplied string stored on the <code>WorkflowInstance</code> row. Its sole job is to let external code locate a specific running instance without knowing its Elsa-internal GUID. When you call <code>SendSignalAsync("ApprovalDecision", payload, correlationId: "DOC-2024-001")</code>, the runtime queries the bookmark table for <code>WHERE CorrelationId = 'DOC-2024-001' AND EventName = 'ApprovalDecision'</code> and resumes the matching instance.</p>

<h3>Setting CorrelationId at Dispatch Time</h3>
<p>Pass <code>CorrelationId = documentId</code> in <code>DispatchWorkflowDefinitionRequest</code>. It is stored immediately when the instance is created, before any activity runs. You can also set it programmatically inside the workflow early on via <code>context.WorkflowExecutionContext.CorrelationId = value</code>, but setting it at dispatch is simpler and recommended.</p>

<h3>Querying Instances by CorrelationId</h3>
<p>Use <code>IWorkflowInstanceStore.FindAsync(new WorkflowInstanceFilter { CorrelationId = id })</code> in C# code, or hit the management API at <code>GET /elsa/api/workflow-instances?correlationId=DOC-2024-001</code>. Both return the matching instance(s).</p>

<h3>The Collision Problem</h3>
<p>If two dispatches share the same correlationId and both instances are waiting on the same event name, <code>SendSignalAsync</code> resumes <em>both</em>. This is almost never intentional. For AWFS, the natural unique key is the document ID — but if the same document is resubmitted after rejection, a new correlationId (e.g., <code>DOC-2024-001-v2</code>) must be used, or the previous faulted/cancelled instance must be explicitly terminated first.</p>

<h3>AWFS Connection</h3>
<p>Each approval request in AWFS is dispatched with <code>correlationId = documentId</code>. The frontend approval UI passes the document ID back when the approver submits a decision. The API endpoint resolves the correct workflow instance purely from that ID — no database join to a custom mapping table required.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Dispatching a workflow with a correlationId',
          filename: 'DispatchWithCorrelation.cs',
          code: `var result = await runtime.DispatchAsync(new DispatchWorkflowDefinitionRequest
{
    DefinitionId   = "ApprovalWorkflow",
    VersionOptions = VersionOptions.Published,
    CorrelationId  = documentId,   // <-- the routing key
    Input = new WorkflowInput(new Dictionary<string, object>
    {
        ["DocumentId"]  = documentId,
        ["RequesterId"] = requesterId,
        ["Amount"]      = amount
    })
}, cancellationToken);

Console.WriteLine($"Instance: {result.WorkflowInstanceId}, Correlation: {documentId}");`,
          explanation: 'The <code>CorrelationId</code> field on the dispatch request is stored on the instance row immediately. It does not need to match any activity name or variable — it is purely a lookup key.'
        },
        {
          language: 'csharp',
          title: 'Sending a signal targeting a specific correlationId',
          filename: 'SignalByCorrelation.cs',
          code: `// Resume the exact instance waiting for "ApprovalDecision" with correlationId = documentId.
var signalResult = await runtime.SendSignalAsync(
    signal: "ApprovalDecision",
    input: new ApproverDecision("Approved", "Budget within limit"),
    correlationId: documentId,
    cancellationToken: cancellationToken);

if (!signalResult.WorkflowInstanceIds.Any())
    throw new InvalidOperationException(
        $"No instance awaiting ApprovalDecision for document {documentId}. " +
        "The workflow may have already completed or the correlationId is wrong.");`,
          explanation: 'Always check <code>WorkflowInstanceIds.Any()</code> after sending a signal. A missing result means the correlationId or event name did not match any active bookmark.'
        },
        {
          language: 'sql',
          title: 'SQL query on WorkflowInstances by CorrelationId',
          filename: 'query_by_correlation.sql',
          code: `-- Find the active approval instance for a given document.
SELECT
    wi."Id",
    wi."Status",
    wi."SubStatus",
    wi."CorrelationId",
    wi."CreatedAt",
    wi."UpdatedAt"
FROM "WorkflowInstances" wi
WHERE wi."CorrelationId" = 'DOC-2024-001'
  AND wi."Status" NOT IN ('Finished', 'Cancelled')
ORDER BY wi."CreatedAt" DESC
LIMIT 1;

-- Find all bookmarks for a specific correlation to see what the workflow is waiting for.
SELECT
    b."Id",
    b."ActivityTypeName",
    b."Hash",
    b."WorkflowInstanceId"
FROM "Bookmarks" b
INNER JOIN "WorkflowInstances" wi ON wi."Id" = b."WorkflowInstanceId"
WHERE wi."CorrelationId" = 'DOC-2024-001';`,
          explanation: 'These queries are invaluable in production operations. The second query shows exactly which event name the instance is waiting for — useful when debugging a signal that is not landing.'
        }
      ],

      handsOn: {
        goal: 'Run two concurrent workflow instances with different correlationIds, send signals to each, and verify signals route to the correct instance.',
        steps: [
          'Dispatch <code>ApprovalEventWorkflow</code> twice: once with <code>correlationId = "DOC-A"</code> and once with <code>correlationId = "DOC-B"</code>.',
          'Verify both instances are in <code>Suspended</code> state via <code>GET /elsa/api/workflow-instances</code>.',
          'Send an <code>ApprovalDecision</code> signal for <code>"DOC-A"</code> with decision <code>"Approved"</code>.',
          'Verify only the DOC-A instance transitions to <code>Finished</code>; DOC-B remains <code>Suspended</code>.',
          'Send an <code>ApprovalDecision</code> signal for <code>"DOC-B"</code> with decision <code>"Rejected"</code>.',
          'Verify DOC-B transitions to <code>Finished</code>.',
          'Try sending a third signal with <code>correlationId = "DOC-C"</code> (no instance) and verify the returned instance IDs list is empty.'
        ],
        verification: [
          'Two separate instance IDs are created, one per dispatch.',
          'Signal for DOC-A does not affect DOC-B instance.',
          'Console output for each instance shows the correct decision payload.',
          'Signal with unknown correlationId returns empty instance list without error.'
        ],
        pitfalls: [
          '<strong>Reusing correlationIds after completion.</strong> Once an instance finishes, its correlationId is free again. But if you re-dispatch with the same correlationId while the old instance is still in <code>Finished</code> state (not purged), a query by correlationId returns multiple rows. Filter by <code>Status NOT IN (Finished, Cancelled)</code>.',
          '<strong>CorrelationId set inside workflow vs at dispatch.</strong> If you set <code>CorrelationId</code> inside the workflow (not at dispatch), there is a window between instance creation and the first activity execution where the instance has no correlationId. Signals sent during that window will not find it. Always set correlationId at dispatch time.',
          '<strong>Case sensitivity in different databases.</strong> PostgreSQL string comparisons are case-sensitive by default; SQL Server is usually case-insensitive depending on collation. Pick a canonical casing convention (e.g., always uppercase document IDs) and enforce it at the application layer.'
        ]
      },

      selfCheck: [
        {
          question: 'Why is the document ID a natural choice for the correlationId in AWFS?',
          answer: '<p>The document ID is already a unique, caller-visible identifier for each approval request. Using it as the correlationId means the approval UI only needs to know the document ID to send a signal — no internal Elsa GUIDs are exposed to the frontend. It also makes operational debugging straightforward: any engineer can query the workflow instance by the document ID they see in the UI.</p>'
        },
        {
          question: 'What happens if you dispatch the same workflow definition twice with identical correlationIds?',
          answer: '<p>Two separate instances are created, both with the same correlationId. When you call <code>SendSignalAsync</code> for that correlationId, Elsa finds two matching bookmarks and resumes <strong>both</strong> instances. This produces duplicate approvals and corrupted state. Prevent it by checking for an active instance with that correlationId before dispatching, and either reject the duplicate or cancel the existing instance first.</p>'
        },
        {
          question: 'How do you find which event name a suspended workflow instance is waiting for, without access to the source code?',
          answer: '<p>Query the <code>Bookmarks</code> table for rows whose <code>WorkflowInstanceId</code> matches the instance. Each bookmark row contains the activity type name and a hash that encodes the event name. For <code>Event</code> activities, the event name is embedded in the hash data. Alternatively, the management API endpoint <code>GET /elsa/api/workflow-instances/{id}/bookmarks</code> returns the bookmark list with human-readable metadata if the Elsa API is configured to expose it.</p>'
        }
      ]
    }
  },

  {
    id: 't2-06',
    tier: 2,
    title: 'The Approval Loop Pattern',
    slug: 'the-approval-loop-pattern',
    estimatedMinutes: 40,
    prerequisites: ['t2-01', 't2-04', 't2-05'],
    tabs: {
      concept: `<h2 id="concept-approval-loop">Modeling Multi-Level Sequential Approval</h2>
<p>The approval loop is the heart of AWFS. The requirement: route a document through N sequential approvers. Each approver must act before the next is notified. Any rejection terminates the chain immediately. Final approval only happens when all approvers approve.</p>

<h3>ForEach Over an Approver List</h3>
<p>Elsa's <code>ForEach</code> activity iterates over a collection variable, executing its body once per item. Each iteration is sequential by default (not parallel). Store the approver list as a workflow variable of type <code>List&lt;string&gt;</code>, populated either from workflow input or from an MDM lookup. <code>ForEach</code> exposes the current item via its <code>CurrentValue</code> output, which you bind to a variable inside the loop body.</p>

<h3>Storing Intermediate Decisions</h3>
<p>Declare a workflow variable <code>decisions</code> of type <code>List&lt;ApprovalDecision&gt;</code>. After each approver acts, append their decision to this list. If the workflow is later queried (e.g., for an audit trail), the full decision history is in that variable on the instance record.</p>

<h3>Early-Exit on Rejection</h3>
<p>Elsa does not have a <code>break</code> statement for <code>ForEach</code>. The standard pattern is a <strong>gate variable</strong>: declare <code>rejected (bool = false)</code>. Inside the loop body, after reading the signal, set <code>rejected = true</code> if the decision is <code>"Rejected"</code>. Wrap the loop's notification and Event activities in an <code>If(!rejected)</code> guard. After the loop, a final <code>If(rejected)</code> branches to a rejection notification path.</p>

<h3>AWFS: 3-Level Approval</h3>
<p>For Toyota-Astra Motor, the chain is fixed: <strong>Supervisor → Manager → Director</strong>. The approver IDs are resolved from MDM by cost center at dispatch time and stored as workflow input. The Event activity name at each gate is the same (<code>"ApprovalDecision"</code>) — the correlationId ensures the signal goes to the right instance, not the right gate. Within the instance, the loop iteration position identifies which gate is active.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'ForEach iterating over approver list with Event at each gate',
          filename: 'ApprovalLoopWorkflow.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Attributes;

public class ApprovalLoopWorkflow : WorkflowBase
{
    [WorkflowInput] public Input<string>   DocumentId { get; set; } = default!;
    [WorkflowInput] public Input<string[]> Approvers  { get; set; } = default!;

    protected override void Build(IWorkflowBuilder builder)
    {
        var approverList   = builder.WithVariable<string[]>();
        var currentApprover = builder.WithVariable<string>();
        var rejected        = builder.WithVariable<bool>(false);
        var decisions       = builder.WithVariable<List<string>>(new List<string>());

        builder.Root = new Sequence
        {
            Activities =
            {
                // Copy input into mutable variable.
                new InlineActivity(ctx =>
                    ctx.Set(approverList, ctx.GetInput<string[]>(nameof(Approvers)))),

                new ForEach<string>
                {
                    Items    = new(ctx => ctx.Get(approverList)!),
                    CurrentValue = new Output<string>(currentApprover),
                    Body = new Sequence
                    {
                        Activities =
                        {
                            // Skip remaining gates if already rejected.
                            new If(ctx => !ctx.Get(rejected))
                            {
                                Then = new Sequence
                                {
                                    Activities =
                                    {
                                        new WriteLine(ctx =>
                                            $"Waiting for {ctx.Get(currentApprover)} on {ctx.GetInput<string>(nameof(DocumentId))}"),

                                        // Suspend until signal arrives.
                                        new Event("ApprovalDecision"),

                                        // Read and record the decision.
                                        new InlineActivity(ctx =>
                                        {
                                            var decision = ctx.GetInput<ApproverDecision>("ApprovalDecision");
                                            var list     = ctx.Get(decisions)!;
                                            list.Add($"{ctx.Get(currentApprover)}: {decision?.Decision}");
                                            ctx.Set(decisions, list);

                                            if (decision?.Decision == "Rejected")
                                                ctx.Set(rejected, true);
                                        }),

                                        new WriteLine(ctx =>
                                        {
                                            var d = ctx.GetInput<ApproverDecision>("ApprovalDecision");
                                            return $"{ctx.Get(currentApprover)} decided: {d?.Decision}";
                                        })
                                    }
                                }
                            }
                        }
                    }
                },

                // After the loop: branch on outcome.
                new If(ctx => ctx.Get(rejected))
                {
                    Then = new WriteLine(ctx =>
                        $"Document {ctx.GetInput<string>(nameof(DocumentId))} REJECTED."),
                    Else = new WriteLine(ctx =>
                        $"Document {ctx.GetInput<string>(nameof(DocumentId))} APPROVED by all approvers.")
                }
            }
        };
    }
}`,
          explanation: 'The <code>If(!rejected)</code> guard inside the loop body is the early-exit mechanism. Once <code>rejected</code> is true, subsequent iterations skip the Event activity and pass through immediately, letting the loop complete without waiting for more signals.'
        },
        {
          language: 'csharp',
          title: 'Simulating each approval gate via signals in an integration test',
          filename: 'ApprovalLoopTest.cs',
          code: `// Helper: send a signal and wait briefly for the workflow to process it.
async Task SignalDecision(string correlationId, string decision, string comment)
{
    await runtime.SendSignalAsync(
        signal: "ApprovalDecision",
        input: new ApproverDecision(decision, comment),
        correlationId: correlationId);

    // Give the background job runner time to process the resume.
    await Task.Delay(500);
}

// Happy path: all three approve.
await dispatchService.SubmitAsync("DOC-001", "EMP-99", 1_000_000m, ct);
await SignalDecision("DOC-001", "Approved", "OK by supervisor");
await SignalDecision("DOC-001", "Approved", "OK by manager");
await SignalDecision("DOC-001", "Approved", "OK by director");
// Instance should now be Finished with all-approved message.

// Rejection path: manager rejects at gate 2.
await dispatchService.SubmitAsync("DOC-002", "EMP-99", 1_000_000m, ct);
await SignalDecision("DOC-002", "Approved", "OK by supervisor");
await SignalDecision("DOC-002", "Rejected", "Over budget");
// After rejection, loop should skip director gate.
// Only 2 signals needed; 3rd would find no bookmark.`,
          explanation: 'On the rejection path only two signals are needed. The third gate is skipped by the <code>If(!rejected)</code> guard, so no bookmark is created for the director — a third <code>SendSignalAsync</code> call returns an empty result.'
        }
      ],

      handsOn: {
        goal: 'Build a 3-approver sequential loop, simulate each approval via signals, and verify the rejection short-circuit works.',
        steps: [
          'Create <code>ApprovalLoopWorkflow.cs</code> with inputs <code>DocumentId (string)</code> and <code>Approvers (string[])</code>.',
          'Add variables <code>currentApprover</code>, <code>rejected (bool=false)</code>, <code>decisions (List&lt;string&gt;)</code>.',
          'Implement the <code>ForEach</code> loop with the <code>If(!rejected)</code> guard wrapping the <code>Event("ApprovalDecision")</code>.',
          'Dispatch the workflow with approvers <code>["supervisor@tam.co.id", "manager@tam.co.id", "director@tam.co.id"]</code> and <code>correlationId = "DOC-LOOP-01"</code>.',
          'Verify the console shows "Waiting for supervisor...".',
          'Send <code>Approved</code> signal; verify "Waiting for manager..." appears.',
          'Send <code>Approved</code> signal; verify "Waiting for director..." appears.',
          'Send final <code>Approved</code> signal; verify "APPROVED by all approvers" and instance is <code>Finished</code>.',
          'Repeat with <code>"DOC-LOOP-02"</code>: approve supervisor, reject manager. Verify only 2 signals needed and instance finishes with "REJECTED".'
        ],
        verification: [
          'Happy path requires exactly 3 signals to finish.',
          'Rejection at gate 2 requires exactly 2 signals; instance finishes (not faults) with rejected message.',
          'No bookmark remains after rejection (third signal returns empty instance list).',
          '<code>decisions</code> variable on the instance contains one entry per processed gate.'
        ],
        pitfalls: [
          '<strong>ForEach does not support break.</strong> You cannot exit a ForEach loop early in Elsa 3.x. The gate variable pattern is mandatory for early-exit semantics. Attempting to throw an exception inside the loop to force exit will fault the instance.',
          '<strong>Event bookmark is created even if guard is false.</strong> Actually the opposite: if the <code>If(!rejected)</code> guard evaluates to false, the <code>Event</code> activity is never reached, so no bookmark is created. This is correct — but it means you must not assume a bookmark exists for every iteration.',
          '<strong>Signal consumed by wrong gate.</strong> All gates use the same event name <code>"ApprovalDecision"</code>. Elsa only suspends at one gate at a time (the current loop iteration), so there is only ever one bookmark with that name for a given correlationId. Sending the signal at the right time is sufficient — no per-gate event naming is needed.'
        ]
      },

      selfCheck: [
        {
          question: 'Why does ForEach not need a break statement for the rejection path if you use a gate variable?',
          answer: '<p>When <code>rejected</code> is true, the <code>If(!rejected)</code> guard at the top of each loop body evaluates to false, so the body is skipped entirely — no <code>Event</code> activity is reached and no bookmark is created. The loop iteration still completes (the ForEach increments its index), so the loop finishes normally after all items are consumed. The net effect is identical to a break: remaining gates do not suspend, and the loop exits after touching all items without waiting for signals.</p>'
        },
        {
          question: 'How would you model parallel (AND-split) approval — where all three approvers must act simultaneously?',
          answer: '<p>Replace <code>ForEach</code> with <code>Fork</code> (parallel split). Create three branches, one per approver, each with its own <code>Event</code> activity using a unique event name or a unique correlationId suffix. Use <code>Join</code> (or <code>ParallelForEach</code> with <code>WaitAll</code>) to resume the main flow once all branches complete. This is more complex than sequential — each branch needs its own bookmark routing key to avoid signal ambiguity.</p>'
        },
        {
          question: 'Where are the intermediate decisions stored, and how can an audit system read them after the workflow finishes?',
          answer: '<p>The <code>decisions</code> workflow variable is serialized into the <code>WorkflowInstance.WorkflowState</code> JSON blob in the database when the instance is persisted. After the instance finishes, query the instance record and deserialize <code>WorkflowState.Variables</code> to extract the decisions list. Alternatively, the workflow can write decisions to an external audit table via a custom activity at each gate — this makes the audit data available without parsing the Elsa state blob.</p>'
        }
      ]
    }
  },

  {
    id: 't2-07',
    tier: 2,
    title: 'Elsa Management API',
    slug: 'elsa-management-api',
    estimatedMinutes: 25,
    prerequisites: ['t1-02', 't2-04'],
    tabs: {
      concept: `<h2 id="concept-management-api">The Elsa HTTP Management API</h2>
<p>Calling <code>elsa.UseWorkflowsApi()</code> in <code>Program.cs</code> mounts a set of REST endpoints under <code>/elsa/api</code> (configurable). These endpoints expose the full Elsa runtime and management surface over HTTP — no C# code required on the calling side. This is how the AWFS backend (a separate service) dispatches approval workflows, and how an operations dashboard inspects and cancels stuck instances.</p>

<h3>Key Endpoints</h3>
<ul>
  <li><code>POST /elsa/api/workflow-definitions/{definitionId}/dispatch</code> — start a new instance</li>
  <li><code>POST /elsa/api/workflow-instances/{id}/cancel</code> — cancel a running instance</li>
  <li><code>GET /elsa/api/workflow-instances/{id}</code> — get a single instance with full state</li>
  <li><code>GET /elsa/api/workflow-instances</code> — list instances with filters (status, correlationId, definitionId)</li>
  <li><code>GET /elsa/api/workflow-definitions</code> — list published definitions</li>
  <li><code>POST /elsa/api/signals/{signal}/dispatch</code> — send a signal (resume by event name + correlationId)</li>
</ul>

<h3>Authentication</h3>
<p>By default, the management API has <strong>no authentication</strong>. In production, protect it with JWT bearer tokens or API keys. Call <code>elsa.UseWorkflowsApi(options => options.RoutePrefix = "internal/elsa")</code> to move it off a public route, and add an ASP.NET authorization policy that gates the entire prefix. For the AWFS POC, placing the API behind the internal Kubernetes network boundary (not exposed via ingress) is sufficient.</p>

<h3>AWFS Connection</h3>
<p>The AWFS backend service (not the Elsa host itself) calls <code>POST /elsa/api/workflow-definitions/ApprovalWorkflow/dispatch</code> when a new document is submitted for approval. The admin UI calls <code>GET /elsa/api/workflow-instances?correlationId=DOC-2024-001</code> to show the current state, and <code>POST /elsa/api/workflow-instances/{id}/cancel</code> to unstick a workflow that an approver has left pending for too long.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Registering the management API in Program.cs',
          filename: 'Program.cs',
          code: `var builder = WebApplication.CreateBuilder(args);

builder.Services.AddElsa(elsa =>
{
    elsa.UseEntityFrameworkCore(ef =>
        ef.UsePostgreSql(builder.Configuration.GetConnectionString("Elsa")));

    elsa.UseWorkflowRuntime();

    // Mount the HTTP management API.
    elsa.UseWorkflowsApi(api =>
    {
        api.RoutePrefix = "elsa/api";  // default; change for security
    });

    elsa.AddWorkflow<ApprovalLoopWorkflow>();
});

// Required for the management API controllers.
builder.Services.AddControllers();

var app = builder.Build();

app.UseRouting();
app.UseAuthorization();   // Add JWT/policy here in production.
app.MapControllers();

app.Run();`,
          explanation: '<code>UseWorkflowsApi()</code> registers the management API controllers. You still need <code>AddControllers()</code> and <code>MapControllers()</code> in the middleware pipeline.'
        },
        {
          language: 'bash',
          title: 'Dispatch, inspect, and cancel via curl',
          filename: 'management_api_demo.sh',
          code: `# 1. Dispatch a new workflow instance.
curl -s -X POST http://localhost:5000/elsa/api/workflow-definitions/ApprovalWorkflow/dispatch \\
  -H "Content-Type: application/json" \\
  -d '{
    "correlationId": "DOC-CURL-01",
    "input": {
      "DocumentId": "DOC-CURL-01",
      "RequesterId": "EMP-42",
      "Amount": 5000000,
      "Approvers": ["sup@tam.co.id", "mgr@tam.co.id", "dir@tam.co.id"]
    }
  }' | jq .

# 2. List instances filtered by correlationId.
curl -s "http://localhost:5000/elsa/api/workflow-instances?correlationId=DOC-CURL-01" | jq .

# Capture the instance ID from the response above, then:
INSTANCE_ID="<paste-id-here>"

# 3. Get full instance details (status, variables, bookmarks).
curl -s "http://localhost:5000/elsa/api/workflow-instances/$INSTANCE_ID" | jq .

# 4. Send an approval signal to resume the suspended instance.
curl -s -X POST "http://localhost:5000/elsa/api/signals/ApprovalDecision/dispatch" \\
  -H "Content-Type: application/json" \\
  -d "{\"correlationId\":\"DOC-CURL-01\",\"input\":{\"Decision\":\"Approved\",\"Comment\":\"OK\"}}" | jq .

# 5. Cancel the instance if it gets stuck.
curl -s -X POST "http://localhost:5000/elsa/api/workflow-instances/$INSTANCE_ID/cancel" | jq .`,
          explanation: 'These five curl commands cover the full operations lifecycle: dispatch, observe, signal, and cancel. Replace the base URL and instance ID with real values from your environment.'
        },
        {
          language: 'csharp',
          title: 'Calling the management API from another .NET service (HttpClient)',
          filename: 'ElsaManagementClient.cs',
          code: `public class ElsaManagementClient
{
    private readonly HttpClient _http;

    public ElsaManagementClient(HttpClient http) => _http = http;

    public async Task<string> DispatchApprovalAsync(
        string documentId, string requesterId, decimal amount,
        string[] approvers, CancellationToken ct)
    {
        var payload = new
        {
            correlationId = documentId,
            input = new
            {
                DocumentId  = documentId,
                RequesterId = requesterId,
                Amount      = amount,
                Approvers   = approvers
            }
        };

        var response = await _http.PostAsJsonAsync(
            "elsa/api/workflow-definitions/ApprovalWorkflow/dispatch",
            payload, ct);

        response.EnsureSuccessStatusCode();

        var result = await response.Content
            .ReadFromJsonAsync<DispatchResult>(cancellationToken: ct);

        return result!.WorkflowInstanceId;
    }
}

public record DispatchResult(string WorkflowInstanceId);`,
          explanation: 'Register <code>ElsaManagementClient</code> as a typed <code>HttpClient</code> in DI with the Elsa host base URL. This decouples the AWFS backend from the Elsa assembly — it only needs the HTTP contract.'
        }
      ],

      handsOn: {
        goal: 'Use the management API via curl/Postman to dispatch, inspect, signal, and cancel a workflow instance without writing any extra C# code.',
        steps: [
          'Ensure <code>UseWorkflowsApi()</code> is called in <code>Program.cs</code> and the app is running.',
          'Use curl to dispatch <code>ApprovalLoopWorkflow</code> with <code>correlationId = "DOC-API-01"</code> and three approvers.',
          'List instances: <code>GET /elsa/api/workflow-instances?correlationId=DOC-API-01</code>. Confirm status is <code>Suspended</code>.',
          'Copy the instance ID from the response.',
          'Get the full instance detail: <code>GET /elsa/api/workflow-instances/{id}</code>. Locate the current bookmark.',
          'Send a signal: <code>POST /elsa/api/signals/ApprovalDecision/dispatch</code> with the correlationId and decision payload.',
          'Re-fetch the instance and confirm it advanced to the next gate (or finished if all approved).',
          'Dispatch a second instance, then immediately cancel it: <code>POST /elsa/api/workflow-instances/{id}/cancel</code>. Confirm status becomes <code>Cancelled</code>.'
        ],
        verification: [
          'Dispatch returns a <code>workflowInstanceId</code> in the response body.',
          'List endpoint returns the correct instance filtered by correlationId.',
          'Signal causes the workflow to advance (console shows next gate message).',
          'Cancel endpoint transitions the instance to <code>Cancelled</code> status.'
        ],
        pitfalls: [
          '<strong>Missing MapControllers().</strong> If <code>app.MapControllers()</code> is absent from the middleware pipeline, all management API routes return 404. This is the single most common setup error.',
          '<strong>DefinitionId casing.</strong> The <code>definitionId</code> URL segment is matched against the workflow definition name, which defaults to the C# class name. <code>approvalloopworkflow</code> will not match <code>ApprovalLoopWorkflow</code> — use the exact class name.',
          '<strong>Signal endpoint vs SendSignalAsync.</strong> The REST signal endpoint is <code>POST /elsa/api/signals/{signalName}/dispatch</code>, not <code>/elsa/api/workflow-instances/{id}/signal</code>. Check the Elsa 3.x route table in source if unsure — routes changed between minor versions.'
        ]
      },

      selfCheck: [
        {
          question: 'Why does AWFS call the Elsa management API over HTTP rather than referencing the Elsa NuGet packages directly?',
          answer: '<p>Decoupling. The AWFS backend (the service that receives document submissions) and the Elsa host (the service that runs workflows) can be deployed, scaled, and versioned independently. The AWFS backend only depends on an HTTP contract, not on Elsa assemblies. In a microservices architecture on Kubernetes, this also means the Elsa host can be scaled horizontally without the AWFS backend knowing about individual nodes.</p>'
        },
        {
          question: 'What is the minimum change needed to secure the management API so it is not publicly accessible?',
          answer: '<p>Two steps: (1) change the route prefix to a non-obvious internal path (<code>elsa.UseWorkflowsApi(o => o.RoutePrefix = "internal/elsa-mgmt")</code>), and (2) add an ASP.NET authorization policy that requires a valid API key or JWT bearer token on that path prefix. In Kubernetes, additionally configure the ingress to block external traffic to the internal prefix — only in-cluster service-to-service calls are allowed.</p>'
        },
        {
          question: 'How do you list all workflow instances that are currently Suspended (waiting for approval) across all document IDs?',
          answer: '<p>Call <code>GET /elsa/api/workflow-instances?status=Suspended&amp;workflowDefinitionId=ApprovalWorkflow</code>. The management API supports filtering by status and definition ID. The response is paginated — use the <code>page</code> and <code>pageSize</code> query parameters for large result sets. This query is the backbone of an operations dashboard that shows all pending approvals at a glance.</p>'
        }
      ]
    }
  }

,
  // ── TIER 3 ──────────────────────────────────────────────────────────────────

  {
    id: 't3-01',
    tier: 3,
    title: 'Distributed Hosting and Message Bus',
    slug: 'distributed-hosting-and-message-bus',
    estimatedMinutes: 45,
    prerequisites: ['t2-07'],
    tabs: {
      concept: `<h2 id="concept-distributed">Running Multiple Elsa Nodes</h2>
<p>A single Elsa process is fine for a POC, but production on Kubernetes requires multiple replicas for availability and throughput. Distributing Elsa introduces two fundamental problems: the <strong>competing-consumers problem</strong> and the <strong>distributed lock problem</strong>.</p>

<h3>Competing Consumers</h3>
<p>When a signal arrives at a load balancer in front of three Elsa pods, all three nodes may simultaneously try to resume the same workflow instance. Without coordination, two nodes load the same instance state, both run activities, and both write back — producing corrupted state or duplicate side effects (e.g., two approval notification emails).</p>

<h3>Distributed Locking</h3>
<p>Elsa 3.x solves this with a distributed lock around instance execution. Configure a <code>IDistributedLockProvider</code> backed by Redis, SQL, or Azure Blob Storage. Before any node resumes an instance, it acquires an exclusive lock keyed by instance ID. If the lock is already held, the node waits or backs off. Release the lock after the execution round completes.</p>

<h3>MassTransit for Distributed Dispatch</h3>
<p>Elsa integrates with <strong>MassTransit</strong> to dispatch workflow signals and triggers via a message broker (RabbitMQ, Azure Service Bus, Amazon SQS). Instead of resuming the instance inline on the node that received the HTTP signal, the signal is published as a message. A single consumer (or a competing-consumers group with locking) dequeues and processes it. This decouples signal ingestion from instance execution and enables reliable delivery even if a node crashes mid-execution.</p>

<h3>Sticky Sessions vs Distributed Locks</h3>
<p>An alternative to distributed locking is <strong>sticky sessions</strong>: route all signals for a given correlationId to the same pod (consistent hashing on the load balancer). This avoids lock contention but sacrifices availability — if the pinned pod restarts, inflight workflows are delayed until the pod recovers. For AWFS on Kubernetes with rolling deploys, distributed locking is the safer choice.</p>

<h3>AWFS Relevance</h3>
<p>TAM runs Kubernetes with 2–4 replicas per service. The Elsa host must use distributed locking (Redis is already in the TAM infrastructure) and MassTransit over RabbitMQ for signal dispatch. This guarantees that no approval decision is processed twice and no approval is lost on a pod restart.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Adding MassTransit transport to Elsa (RabbitMQ)',
          filename: 'Program.Distributed.cs',
          code: `builder.Services.AddElsa(elsa =>
{
    elsa.UseEntityFrameworkCore(ef =>
        ef.UsePostgreSql(connectionString));

    elsa.UseWorkflowRuntime(runtime =>
    {
        // Use MassTransit for workflow dispatch messages.
        runtime.UseMassTransitDispatcher();
    });

    elsa.UseWorkflowsApi();
    elsa.AddWorkflow<ApprovalLoopWorkflow>();
});

// Register MassTransit with RabbitMQ transport.
builder.Services.AddMassTransit(mt =>
{
    // Elsa registers its own consumers automatically via this extension.
    mt.AddElsaConsumers();

    mt.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host("rabbitmq://rabbitmq:5672", h =>
        {
            h.Username("elsa");
            h.Password("elsa-secret");
        });

        // Auto-configure queues for Elsa consumers.
        cfg.ConfigureEndpoints(ctx);
    });
});`,
          explanation: '<code>UseMassTransitDispatcher()</code> replaces the default in-process dispatcher with one that publishes messages to RabbitMQ. All Elsa nodes subscribe to the same queues, but distributed locking ensures only one processes each message.'
        },
        {
          language: 'csharp',
          title: 'Configuring distributed locking with Redis',
          filename: 'Program.DistributedLock.cs',
          code: `using Medallion.Threading.Redis;
using StackExchange.Redis;

builder.Services.AddElsa(elsa =>
{
    elsa.UseWorkflowRuntime(runtime =>
    {
        runtime.UseMassTransitDispatcher();

        // Replace the default (in-memory) lock with a Redis-backed lock.
        runtime.UseDistributedLockProvider(sp =>
        {
            var redis = sp.GetRequiredService<IConnectionMultiplexer>();
            return new RedisDistributedSynchronizationProvider(redis.GetDatabase());
        });
    });
});

// Register the Redis connection.
builder.Services.AddSingleton<IConnectionMultiplexer>(
    ConnectionMultiplexer.Connect(
        builder.Configuration.GetConnectionString("Redis")!));`,
          explanation: 'This uses the <code>Medallion.Threading.Redis</code> package, which is the recommended distributed lock provider for Elsa 3.x on Redis infrastructure. The lock is keyed by workflow instance ID, so concurrent resume attempts on different nodes serialize safely.'
        },
        {
          language: 'yaml',
          title: 'Docker Compose with 2 Elsa nodes',
          filename: 'docker-compose.distributed.yml',
          code: `version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: elsa
      POSTGRES_USER: elsa
      POSTGRES_PASSWORD: elsa-secret
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"]
    environment:
      RABBITMQ_DEFAULT_USER: elsa
      RABBITMQ_DEFAULT_PASS: elsa-secret

  elsa-node-1:
    image: awfs-elsa:latest
    environment:
      ConnectionStrings__Elsa: "Host=postgres;Database=elsa;Username=elsa;Password=elsa-secret"
      ConnectionStrings__Redis: "redis:6379"
      RabbitMQ__Host: "rabbitmq://rabbitmq:5672"
    depends_on: [postgres, redis, rabbitmq]
    ports: ["5001:8080"]

  elsa-node-2:
    image: awfs-elsa:latest
    environment:
      ConnectionStrings__Elsa: "Host=postgres;Database=elsa;Username=elsa;Password=elsa-secret"
      ConnectionStrings__Redis: "redis:6379"
      RabbitMQ__Host: "rabbitmq://rabbitmq:5672"
    depends_on: [postgres, redis, rabbitmq]
    ports: ["5002:8080"]`,
          explanation: 'Both nodes share the same PostgreSQL database, Redis lock store, and RabbitMQ broker. Signals dispatched to either node are routed via RabbitMQ; the distributed lock ensures exactly one node processes each instance execution round.'
        }
      ],

      handsOn: {
        goal: 'Run two Elsa nodes with Docker Compose, dispatch workflows to both, and confirm only one node processes each instance.',
        steps: [
          'Add MassTransit and Redis NuGet packages: <code>MassTransit.RabbitMQ</code>, <code>Medallion.Threading.Redis</code>, <code>StackExchange.Redis</code>.',
          'Update <code>Program.cs</code> to use <code>UseMassTransitDispatcher()</code> and <code>UseDistributedLockProvider()</code> as shown above.',
          'Create <code>docker-compose.distributed.yml</code> with postgres, redis, rabbitmq, and two Elsa nodes.',
          'Build the Docker image: <code>docker build -t awfs-elsa:latest .</code>',
          'Start the stack: <code>docker compose -f docker-compose.distributed.yml up</code>.',
          'Dispatch 10 workflows in parallel to both nodes alternately using curl.',
          'Check the logs of both nodes — each workflow instance log lines should appear on exactly one node.',
          'Send signals to the management API on either node and verify the correct instances resume regardless of which node receives the signal.'
        ],
        verification: [
          'RabbitMQ management UI (port 15672) shows Elsa queues receiving and consuming messages.',
          'No duplicate activity executions appear in the combined logs of both nodes.',
          'Redis contains lock keys during active instance processing (visible via <code>redis-cli KEYS *elsa*</code>).',
          'Stopping one node mid-flight does not permanently lose any instance — the message is requeued.'
        ],
        pitfalls: [
          '<strong>Missing AddElsaConsumers().</strong> Without this call in the MassTransit configuration, Elsa\'s message consumers are not registered and no workflow dispatch messages are processed.',
          '<strong>EF Core migrations not run on both nodes.</strong> If both nodes start simultaneously, both may try to run database migrations — use a startup job or InitDB container to run migrations before pods start.',
          '<strong>Redis connection string format.</strong> StackExchange.Redis expects <code>"host:port"</code> format, not a URI. <code>"redis://redis:6379"</code> is wrong; <code>"redis:6379"</code> is correct.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the competing-consumers problem in distributed Elsa, and how does distributed locking solve it?',
          answer: '<p>When multiple Elsa nodes all receive (or dequeue) the same resume message, they simultaneously load the workflow instance state, execute activities, and write back — producing duplicate side effects and corrupted state. Distributed locking solves it by serialising access: only the node that acquires the lock for a given instance ID proceeds; others wait or back off. The lock is held for the duration of one execution round and released before the next activity group can run.</p>'
        },
        {
          question: 'Why is MassTransit preferred over direct HTTP signal calls for distributed Elsa?',
          answer: '<p>HTTP signal calls are fire-and-forget with no delivery guarantee — if the target node crashes before processing, the signal is lost. MassTransit routes signals through a durable message broker (RabbitMQ, Azure Service Bus). If a node crashes mid-processing, the broker redelivers the message to a healthy node. This gives at-least-once delivery semantics, which combined with distributed locking and idempotent activities achieves exactly-once workflow progression.</p>'
        },
        {
          question: 'When would sticky sessions be acceptable instead of distributed locking for AWFS?',
          answer: '<p>Sticky sessions are acceptable when: (a) you have full control over the load balancer and can guarantee consistent hashing by correlationId, (b) the workflow SLA allows a delay of minutes on pod restart (no hard real-time requirement), and (c) the deployment model uses blue/green (not rolling) deploys so instances are not migrated mid-execution. For TAM\'s Kubernetes environment with rolling deploys and Redis already available, distributed locking is the right choice.</p>'
        }
      ]
    }
  },

  {
    id: 't3-02',
    tier: 3,
    title: 'Elsa Studio (Visual Designer)',
    slug: 'elsa-studio-visual-designer',
    estimatedMinutes: 30,
    prerequisites: ['t1-02', 't2-07'],
    tabs: {
      concept: `<h2 id="concept-studio">Elsa Studio as a Blazor Visual Designer</h2>
<p>Elsa Studio is a <strong>Blazor WebAssembly</strong> application (hosted in a Blazor Server shell) that connects to any Elsa server via the management API. It provides a drag-and-drop workflow designer, a workflow instance inspector, and a definition version manager — all without writing code.</p>

<h3>What You Can Do Visually</h3>
<ul>
  <li>Create and edit workflow definitions using a canvas with activity nodes and connection arrows.</li>
  <li>Configure activity properties (inputs, outputs, expressions) via property panels.</li>
  <li>Publish definitions and see version history.</li>
  <li>Inspect running instances: current activity, variable values, bookmark state.</li>
  <li>Retry or cancel faulted instances.</li>
</ul>

<h3>What Still Requires Code</h3>
<p>Custom activities must be written in C# and registered with the Elsa host. Studio can <em>use</em> custom activities once they are registered — it discovers them via the management API's activity descriptor endpoint — but it cannot create them. Complex C# expressions in activity inputs are written as JavaScript in Studio (Elsa evaluates JavaScript expressions at runtime via Jint). Very complex control flow (dynamic ForEach over typed objects) is easier in code.</p>

<h3>How Visual Definitions Map to JSON</h3>
<p>Every workflow created in Studio is stored as a JSON document (the workflow definition). The JSON describes the activity graph: activity type names, their property values (as literal values or expression strings), and the connections between activities. This JSON can be exported, committed to source control, imported programmatically, or loaded by a code-based Elsa host. Code-based workflows (subclasses of <code>WorkflowBase</code>) are compiled to the same internal graph at publish time.</p>

<h3>AWFS Relevance</h3>
<p>TAM's CTO and process owners can visualise the approval flow in Studio without reading C# code. During the pitch, opening Studio and walking through the approval workflow visually — showing each gate, the decision branch, the escalation timer — is far more persuasive than a code listing. Studio also serves as the production operations console for inspecting stuck instances.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Adding Elsa Studio NuGet packages and host',
          filename: 'ElsaStudio.Program.cs',
          code: `// This is a SEPARATE project from the Elsa workflow host.
// The Studio is a thin Blazor Server app that proxies requests to the Elsa API.

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Add Elsa Studio services, pointing to the Elsa host's management API.
builder.Services.AddElsaStudio(studio =>
{
    studio.BackendUrl = builder.Configuration["Elsa:BackendUrl"]
        ?? "http://localhost:5000";   // URL of the Elsa workflow host
});

var app = builder.Build();

app.UseStaticFiles();
app.UseRouting();
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();

// Required NuGet packages:
// Elsa.Studio
// Elsa.Studio.Core
// Elsa.Studio.Workflows
// Elsa.Studio.Shell`,
          explanation: 'Studio is a standalone app that talks to the Elsa host over HTTP. It does not run workflows itself — it is purely a UI layer. The <code>BackendUrl</code> must point to the Elsa host where <code>UseWorkflowsApi()</code> is registered.'
        },
        {
          language: 'json',
          title: 'JSON output from a visually-authored workflow',
          filename: 'simple_approval.workflow.json',
          code: `{
  "id": "visual-approval-v1",
  "definitionId": "VisualApproval",
  "name": "Visual Approval Workflow",
  "version": 1,
  "isPublished": true,
  "root": {
    "type": "Elsa.Sequence",
    "id": "seq-1",
    "activities": [
      {
        "type": "Elsa.WriteLine",
        "id": "log-1",
        "text": {
          "typeName": "String",
          "expression": {
            "type": "Literal",
            "value": "Waiting for approval decision..."
          }
        }
      },
      {
        "type": "Elsa.Event",
        "id": "event-1",
        "eventName": {
          "typeName": "String",
          "expression": {
            "type": "Literal",
            "value": "ApprovalDecision"
          }
        }
      },
      {
        "type": "Elsa.WriteLine",
        "id": "log-2",
        "text": {
          "typeName": "String",
          "expression": {
            "type": "JavaScript",
            "value": "\`Decision: \${getInput('ApprovalDecision')?.Decision}\`"
          }
        }
      }
    ]
  }
}`,
          explanation: 'This is the exact JSON Elsa stores when you save a workflow in Studio. Activity type names are fully qualified. Expressions carry a <code>type</code> field: <code>Literal</code>, <code>JavaScript</code>, or <code>CSharp</code>. You can import this JSON via the management API to load a visually-authored workflow programmatically.'
        },
        {
          language: 'csharp',
          title: 'Loading a JSON workflow definition programmatically',
          filename: 'LoadJsonDefinition.cs',
          code: `using Elsa.Workflows.Management.Contracts;
using System.Text.Json;

// In a startup service or migration helper:
public class WorkflowDefinitionSeeder : IHostedService
{
    private readonly IWorkflowDefinitionManager _manager;
    private readonly IWebHostEnvironment _env;

    public WorkflowDefinitionSeeder(
        IWorkflowDefinitionManager manager, IWebHostEnvironment env)
    {
        _manager = manager;
        _env = env;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var jsonPath = Path.Combine(_env.ContentRootPath,
            "Workflows", "simple_approval.workflow.json");

        if (!File.Exists(jsonPath)) return;

        var json = await File.ReadAllTextAsync(jsonPath, ct);
        var model = JsonSerializer.Deserialize<WorkflowDefinitionModel>(json);

        if (model is null) return;

        await _manager.PublishAsync(model, ct);
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}`,
          explanation: 'This seeds a JSON workflow definition at startup — useful for committing visually-authored workflows to source control and deploying them without manual Studio interaction. Register as a hosted service in <code>Program.cs</code>.'
        }
      ],

      handsOn: {
        goal: 'Spin up Studio locally, recreate the approval workflow visually, export its JSON, and load it into the Elsa host programmatically.',
        steps: [
          'Create a new Blazor Server project: <code>dotnet new blazorserver -n AwfsStudio</code>.',
          'Add Studio NuGet packages: <code>Elsa.Studio</code>, <code>Elsa.Studio.Workflows</code>, <code>Elsa.Studio.Shell</code>.',
          'Configure <code>Program.cs</code> with <code>AddElsaStudio(studio => studio.BackendUrl = "http://localhost:5000")</code>.',
          'Run the Studio project and navigate to <code>http://localhost:5001</code>.',
          'In the Studio designer, create a new workflow with a Sequence containing: WriteLine → Event("ApprovalDecision") → WriteLine.',
          'Publish the workflow definition.',
          'Export the workflow JSON (Studio → Definitions → Export).',
          'Save the JSON to <code>Workflows/visual_approval.json</code> in the Elsa host project.',
          'Add the <code>WorkflowDefinitionSeeder</code> hosted service to the Elsa host and verify the definition appears in the management API on startup.'
        ],
        verification: [
          'Studio loads with the Elsa host\'s workflow definitions visible in the sidebar.',
          'The visually created workflow is published and visible via <code>GET /elsa/api/workflow-definitions</code>.',
          'The exported JSON contains the correct activity types and event name.',
          'The seeder imports the JSON definition and it can be dispatched via the management API.'
        ],
        pitfalls: [
          '<strong>CORS errors from Studio to Elsa host.</strong> If Studio and the Elsa host run on different ports, configure CORS on the Elsa host: <code>app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader())</code> for local development.',
          '<strong>Studio version mismatch.</strong> Elsa Studio NuGet versions must match the Elsa host NuGet versions exactly. A Studio 3.1 connecting to an Elsa 3.0 host will encounter API schema mismatches.',
          '<strong>Blazor WASM loading time.</strong> The Studio Blazor WASM bundle is large (~15 MB). The first load takes 5–10 seconds on a development machine. This is normal — it is not a connection error.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the difference between a workflow created in Studio and one written as a C# WorkflowBase subclass?',
          answer: '<p>Both produce the same internal activity graph at runtime. A Studio-created workflow is stored as a JSON document in the workflow definitions table. A code-based workflow compiles its graph in the <code>Build()</code> method and is stored as a definition when the host starts. The key difference is tooling: code-based workflows have full IDE support, type safety, and version control via Git; Studio workflows are easier for non-developers to author and visualise but require the Studio app to edit.</p>'
        },
        {
          question: 'How do you use a custom C# activity (e.g., SendWhatsApp) in Studio?',
          answer: '<p>Register the custom activity on the Elsa host with <code>elsa.AddActivity&lt;SendWhatsAppActivity&gt;()</code>. Studio calls the management API\'s activity descriptors endpoint (<code>GET /elsa/api/activity-descriptors</code>) to discover all registered activities. The custom activity appears in Studio\'s activity palette automatically. You configure its input properties via the Studio property panel — no code editing required in Studio itself.</p>'
        },
        {
          question: 'Can you round-trip a workflow: edit it in Studio, export JSON, modify the JSON in a text editor, and re-import it?',
          answer: '<p>Yes. The workflow JSON is a plain document with no binary or platform-specific fields. Export it from Studio, edit activity expressions or add activities by hand, then import it via <code>POST /elsa/api/workflow-definitions/import</code> or via the seeder pattern. The imported version becomes a new version of the definition. Existing instances using the old version continue on the old version; new dispatches use the latest published version.</p>'
        }
      ]
    }
  },

  {
    id: 't3-03',
    tier: 3,
    title: 'Custom Storage Providers',
    slug: 'custom-storage-providers',
    estimatedMinutes: 40,
    prerequisites: ['t1-02', 't2-07'],
    tabs: {
      concept: `<h2 id="concept-custom-storage">The Elsa Storage Abstraction Layer</h2>
<p>Elsa 3.x stores three kinds of data, each behind its own interface: workflow instances (<code>IWorkflowInstanceStore</code>), bookmarks (<code>IBookmarkStore</code>), and workflow definitions (<code>IWorkflowDefinitionStore</code>). By default, the <code>Elsa.EntityFrameworkCore</code> package provides implementations backed by EF Core (supporting PostgreSQL, SQL Server, SQLite). You can replace any or all of these with custom implementations.</p>

<h3>When to Implement a Custom Provider</h3>
<ul>
  <li>Your organisation mandates a specific database (Oracle, MongoDB, Cassandra) not supported by the built-in EF Core provider.</li>
  <li>You need to co-locate Elsa state in an existing domain database with a non-standard schema.</li>
  <li>You need hybrid storage: definitions in blob storage (immutable, version-controlled), instances in a fast NoSQL store.</li>
  <li>You are writing integration tests and want a fast in-memory store that does not require a real database.</li>
</ul>

<h3>IWorkflowInstanceStore — Key Methods</h3>
<p><code>FindAsync(WorkflowInstanceFilter)</code> — find a single instance matching criteria (ID, correlationId, status).<br>
<code>FindManyAsync(WorkflowInstanceFilter)</code> — find all matching instances.<br>
<code>SaveAsync(WorkflowInstance)</code> — upsert an instance (insert or update by ID).<br>
<code>DeleteAsync(WorkflowInstanceFilter)</code> — delete matching instances.<br>
<code>CountAsync(WorkflowInstanceFilter)</code> — return the count of matching instances.</p>

<h3>Registration</h3>
<p>Call <code>services.AddSingleton&lt;IWorkflowInstanceStore, MyCustomStore&gt;()</code> (or <code>AddScoped</code> depending on your store's lifetime requirements) <em>after</em> the <code>AddElsa()</code> call. DI resolution resolves the last registered implementation, so your custom store overrides the default EF Core one.</p>

<h3>AWFS Connection</h3>
<p>TAM's infrastructure team may require workflow instance data to reside in the same Oracle database as the ERP system, for unified backup and compliance. Implementing <code>IWorkflowInstanceStore</code> against Oracle via Dapper is a straightforward path that does not require migrating the entire ERP to PostgreSQL.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Minimal IWorkflowInstanceStore implementation (in-memory)',
          filename: 'InMemoryWorkflowInstanceStore.cs',
          code: `using Elsa.Workflows.Management.Contracts;
using Elsa.Workflows.Management.Entities;
using Elsa.Workflows.Management.Filters;
using System.Collections.Concurrent;

/// <summary>
/// Thread-safe in-memory workflow instance store — for testing only.
/// </summary>
public class InMemoryWorkflowInstanceStore : IWorkflowInstanceStore
{
    private readonly ConcurrentDictionary<string, WorkflowInstance> _store = new();

    public ValueTask<WorkflowInstance?> FindAsync(
        WorkflowInstanceFilter filter,
        CancellationToken cancellationToken = default)
    {
        var instance = _store.Values.FirstOrDefault(i => Matches(i, filter));
        return ValueTask.FromResult(instance);
    }

    public ValueTask<IEnumerable<WorkflowInstance>> FindManyAsync(
        WorkflowInstanceFilter filter,
        CancellationToken cancellationToken = default)
    {
        var results = _store.Values.Where(i => Matches(i, filter));
        return ValueTask.FromResult(results);
    }

    public ValueTask SaveAsync(
        WorkflowInstance instance,
        CancellationToken cancellationToken = default)
    {
        _store[instance.Id] = instance;
        return ValueTask.CompletedTask;
    }

    public ValueTask<long> DeleteAsync(
        WorkflowInstanceFilter filter,
        CancellationToken cancellationToken = default)
    {
        var toDelete = _store.Values.Where(i => Matches(i, filter)).ToList();
        foreach (var instance in toDelete)
            _store.TryRemove(instance.Id, out _);
        return ValueTask.FromResult((long)toDelete.Count);
    }

    public ValueTask<long> CountAsync(
        WorkflowInstanceFilter filter,
        CancellationToken cancellationToken = default)
    {
        var count = _store.Values.Count(i => Matches(i, filter));
        return ValueTask.FromResult((long)count);
    }

    private static bool Matches(WorkflowInstance i, WorkflowInstanceFilter f)
    {
        if (f.Id         != null && i.Id            != f.Id)            return false;
        if (f.CorrelationId != null && i.CorrelationId != f.CorrelationId) return false;
        if (f.Status     != null && i.Status         != f.Status)        return false;
        if (f.DefinitionId != null && i.DefinitionId  != f.DefinitionId)  return false;
        return true;
    }
}`,
          explanation: 'This in-memory implementation is suitable for unit and integration tests. It is thread-safe via <code>ConcurrentDictionary</code>. The <code>Matches</code> helper implements only the filter fields used by AWFS — extend it for other filter properties as needed.'
        },
        {
          language: 'csharp',
          title: 'Registering a custom store in DI, overriding the EF Core default',
          filename: 'Program.CustomStorage.cs',
          code: `builder.Services.AddElsa(elsa =>
{
    // Optionally keep EF Core for definitions and bookmarks...
    elsa.UseEntityFrameworkCore(ef => ef.UsePostgreSql(connectionString));

    elsa.UseWorkflowRuntime();
    elsa.UseWorkflowsApi();
    elsa.AddWorkflow<ApprovalLoopWorkflow>();
});

// Override the EF Core workflow instance store with the in-memory implementation.
// Register AFTER AddElsa() so this takes precedence.
builder.Services.AddSingleton<IWorkflowInstanceStore, InMemoryWorkflowInstanceStore>();`,
          explanation: 'ASP.NET Core DI resolves the <strong>last</strong> registered implementation of an interface. Registering the custom store after <code>AddElsa()</code> ensures it overrides the EF Core store for <code>IWorkflowInstanceStore</code> only, while all other stores remain EF Core-backed.'
        },
        {
          language: 'csharp',
          title: 'Key method signatures for IBookmarkStore (reference)',
          filename: 'IBookmarkStore.Reference.cs',
          code: `// Elsa.Workflows.Runtime.Contracts — key methods to implement:

// Find bookmarks matching a filter (event name, workflow instance ID, hash, etc.)
ValueTask<IEnumerable<StoredBookmark>> FindManyAsync(
    BookmarkFilter filter,
    CancellationToken cancellationToken = default);

// Persist a new bookmark when a workflow suspends.
ValueTask SaveAsync(
    StoredBookmark bookmark,
    CancellationToken cancellationToken = default);

// Remove bookmarks when they are consumed (workflow resumes).
ValueTask<long> DeleteAsync(
    BookmarkFilter filter,
    CancellationToken cancellationToken = default);

// The BookmarkFilter has fields: WorkflowInstanceId, Hash, ActivityTypeName, CorrelationId.
// The Hash field is the key used by the signal routing logic to find the exact bookmark.`,
          explanation: 'The bookmark store is the most performance-critical store: signal routing queries it on every resume. Any custom implementation must support efficient lookup by Hash and CorrelationId — add a compound index if using a relational database.'
        }
      ],

      handsOn: {
        goal: 'Implement the in-memory store, register it to override the EF Core store, and verify it intercepts all workflow instance operations.',
        steps: [
          'Create <code>InMemoryWorkflowInstanceStore.cs</code> with the full implementation above.',
          'In <code>Program.cs</code>, after <code>AddElsa()</code>, add <code>builder.Services.AddSingleton&lt;IWorkflowInstanceStore, InMemoryWorkflowInstanceStore&gt;()</code>.',
          'Run the app and dispatch a workflow. Verify the console does not show EF Core SQL logs for WorkflowInstances table (add <code>EnableSensitiveDataLogging</code> to EF Core to confirm).',
          'Add a log statement to the <code>SaveAsync</code> method of your custom store (e.g., <code>Console.WriteLine($"[InMemoryStore] Saving instance {instance.Id}")</code>).',
          'Dispatch and signal a workflow; confirm the log appears for each save.',
          'Call <code>GET /elsa/api/workflow-instances</code> and verify the in-memory instances are returned.',
          'Restart the app and confirm instances are gone (in-memory is not durable — expected behavior for a test store).'
        ],
        verification: [
          '<code>[InMemoryStore] Saving instance ...</code> appears in logs during dispatch and resume.',
          'EF Core does not emit SQL SELECT/INSERT for WorkflowInstances table (check logs).',
          'Management API list endpoint returns instances from the in-memory store.',
          'Instances are cleared on app restart (confirming in-memory, not EF Core).'
        ],
        pitfalls: [
          '<strong>Registration order matters.</strong> If you register the custom store before <code>AddElsa()</code>, the EF Core registration inside <code>AddElsa()</code> overrides it. Always register custom stores <em>after</em> <code>AddElsa()</code>.',
          '<strong>Incomplete filter implementation.</strong> The <code>Matches</code> helper above only covers a subset of <code>WorkflowInstanceFilter</code> fields. If Elsa internally queries by a field your <code>Matches</code> does not check, it returns incorrect results. Review the full filter class and implement all fields.',
          '<strong>Thread safety with collections.</strong> Using a plain <code>Dictionary</code> instead of <code>ConcurrentDictionary</code> in a multi-threaded ASP.NET environment leads to intermittent KeyNotFoundException or data corruption. Always use thread-safe collections in custom stores.'
        ]
      },

      selfCheck: [
        {
          question: 'Why must the custom store be registered after AddElsa() to take effect?',
          answer: '<p>ASP.NET Core DI resolves an interface to the <strong>last</strong> registered implementation when <code>GetService&lt;T&gt;()</code> is called (for singleton/transient registrations). The EF Core store is registered inside <code>AddElsa()</code>. If your custom store is registered after, it is the last registration and wins. Registering before means the EF Core registration overwrites yours.</p>'
        },
        {
          question: 'What is the performance risk of a naive IBookmarkStore implementation that does a full table scan on FindManyAsync?',
          answer: '<p>Every signal dispatch and workflow resume queries the bookmark store by hash and correlationId. With thousands of concurrent suspended instances, a full scan reads all bookmark rows on every query — O(N) per resume. At TAM\'s scale (hundreds of pending approvals at peak), this causes measurable latency spikes. Any production bookmark store must support indexed lookups by <code>Hash</code> and <code>CorrelationId</code>.</p>'
        },
        {
          question: 'Can you mix custom stores for different data types — e.g., Oracle for instances and PostgreSQL for bookmarks?',
          answer: '<p>Yes. Each store interface is registered independently in DI. You can override <code>IWorkflowInstanceStore</code> with an Oracle/Dapper implementation while keeping <code>IBookmarkStore</code> and <code>IWorkflowDefinitionStore</code> on the default EF Core/PostgreSQL implementation. This is useful during incremental migrations: migrate the most performance-critical store first and leave others on the default until ready.</p>'
        }
      ]
    }
  },

  {
    id: 't3-04',
    tier: 3,
    title: 'Workflow Middleware and Events',
    slug: 'workflow-middleware-and-events',
    estimatedMinutes: 35,
    prerequisites: ['t1-04', 't2-07'],
    tabs: {
      concept: `<h2 id="concept-middleware">IActivityMiddleware — Cross-Cutting Concerns</h2>
<p>Elsa 3.x has a middleware pipeline for activity execution, similar to ASP.NET Core's HTTP middleware. Each activity execution passes through a chain of <code>IActivityMiddleware</code> implementations before and after the activity's own <code>ExecuteAsync</code> runs. This is the correct place for cross-cutting concerns: logging, authorization checks, timing, correlation ID propagation.</p>

<h3>Implementing IActivityMiddleware</h3>
<p>Implement the interface's single method: <code>InvokeAsync(ActivityExecutionContext context, ActivityMiddlewareDelegate next)</code>. Call <code>await next(context)</code> to execute the inner middleware chain and ultimately the activity itself. Code before <code>next()</code> runs pre-execution; code after runs post-execution. Throw an exception before <code>next()</code> to prevent the activity from executing.</p>

<h3>Workflow Lifecycle Events (Notifications)</h3>
<p>Elsa publishes .NET <strong>notifications</strong> (via its internal mediator) at key lifecycle points:
<ul>
  <li><code>WorkflowStarted</code> — fired when a new instance begins execution.</li>
  <li><code>WorkflowFinished</code> — fired when an instance reaches the terminal state.</li>
  <li><code>WorkflowFaulted</code> — fired when an instance transitions to Faulted.</li>
  <li><code>ActivityExecuted</code> — fired after each activity completes (success or fault).</li>
  <li><code>ActivityFaulted</code> — fired when an activity throws an unhandled exception.</li>
</ul>
Subscribe to these by implementing <code>INotificationHandler&lt;TNotification&gt;</code> from <code>Elsa.Mediator</code>.</p>

<h3>Middleware vs Notifications</h3>
<p>Use <strong>middleware</strong> when you need to intercept and potentially modify or block activity execution synchronously — e.g., an authorization check that prevents the activity from running if the current user lacks permission. Use <strong>notifications</strong> for passive observation — e.g., writing an audit log row after an activity completes, or sending an alert after a fault. Notifications are asynchronous and do not block the execution pipeline.</p>

<h3>AWFS Connection</h3>
<p>AWFS requires a complete audit trail: every activity execution must be logged with timestamp, instance ID, activity name, and duration. A middleware logs start time; the post-<code>next()</code> code logs end time and duration. A <code>WorkflowFaulted</code> notification handler sends an alert to the operations team via the notification service.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'IActivityMiddleware that logs activity start and end',
          filename: 'AuditActivityMiddleware.cs',
          code: `using Elsa.Workflows;
using Elsa.Workflows.Pipelines.ActivityExecution;
using Microsoft.Extensions.Logging;

public class AuditActivityMiddleware : IActivityMiddleware
{
    private readonly ILogger<AuditActivityMiddleware> _logger;

    public AuditActivityMiddleware(ILogger<AuditActivityMiddleware> logger)
        => _logger = logger;

    public async ValueTask InvokeAsync(
        ActivityExecutionContext context,
        ActivityMiddlewareDelegate next)
    {
        var instanceId   = context.WorkflowExecutionContext.Id;
        var activityId   = context.Activity.Id;
        var activityType = context.Activity.GetType().Name;
        var started      = DateTimeOffset.UtcNow;

        _logger.LogInformation(
            "[AUDIT] START | Instance: {InstanceId} | Activity: {Type} ({Id})",
            instanceId, activityType, activityId);

        try
        {
            await next(context);   // Run the activity (and inner middleware).
        }
        finally
        {
            var duration = DateTimeOffset.UtcNow - started;
            _logger.LogInformation(
                "[AUDIT] END   | Instance: {InstanceId} | Activity: {Type} ({Id}) | {Ms}ms",
                instanceId, activityType, activityId, duration.TotalMilliseconds);
        }
    }
}`,
          explanation: 'The <code>try/finally</code> ensures the END log is written even if the activity throws. The activity type name and ID are available directly from <code>context.Activity</code>. For a production audit trail, write these to a database table rather than a log file.'
        },
        {
          language: 'csharp',
          title: 'Subscribing to WorkflowFaulted notification',
          filename: 'WorkflowFaultedHandler.cs',
          code: `using Elsa.Mediator.Contracts;
using Elsa.Workflows.Notifications;

public class WorkflowFaultedHandler : INotificationHandler<WorkflowFaulted>
{
    private readonly INotificationService _notificationService;
    private readonly ILogger<WorkflowFaultedHandler> _logger;

    public WorkflowFaultedHandler(
        INotificationService notificationService,
        ILogger<WorkflowFaultedHandler> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task HandleAsync(
        WorkflowFaulted notification,
        CancellationToken cancellationToken)
    {
        var instance     = notification.WorkflowExecutionContext;
        var faultMessage = notification.WorkflowExecutionContext.Fault?.Message
                           ?? "Unknown fault";

        _logger.LogError(
            "[FAULT] Workflow {InstanceId} faulted: {Message}",
            instance.Id, faultMessage);

        // Alert the operations team.
        await _notificationService.SendAsync(
            recipient: "ops-team@tam.co.id",
            subject:   $"Workflow Faulted: {instance.Id}",
            body:      $"Instance {instance.Id} faulted at {DateTimeOffset.UtcNow}: {faultMessage}",
            cancellationToken: cancellationToken);
    }
}`,
          explanation: '<code>INotificationHandler&lt;WorkflowFaulted&gt;</code> is called asynchronously after the fault is recorded. It does not affect the faulted instance — it is purely observational. Replace <code>INotificationService</code> with your own email/WhatsApp/Teams notification implementation.'
        },
        {
          language: 'csharp',
          title: 'Registering middleware and notification handlers',
          filename: 'Program.Middleware.cs',
          code: `builder.Services.AddElsa(elsa =>
{
    elsa.UseEntityFrameworkCore(ef => ef.UsePostgreSql(connectionString));
    elsa.UseWorkflowRuntime();
    elsa.UseWorkflowsApi();
    elsa.AddWorkflow<ApprovalLoopWorkflow>();

    // Register activity middleware (runs for EVERY activity execution).
    elsa.UseActivityPipeline(pipeline =>
        pipeline.UseMiddleware<AuditActivityMiddleware>());
});

// Register notification handlers (workflow lifecycle events).
builder.Services.AddNotificationHandler<WorkflowFaultedHandler>();

// Or register all handlers in an assembly:
// builder.Services.AddNotificationHandlersFrom<WorkflowFaultedHandler>();`,
          explanation: '<code>UseActivityPipeline</code> adds the middleware to the global activity execution pipeline. Notification handlers are standard DI registrations — Elsa\'s mediator resolves all <code>INotificationHandler&lt;T&gt;</code> implementations when publishing a notification.'
        }
      ],

      handsOn: {
        goal: 'Add activity-level audit logging to the AWFS skeleton and verify it fires for every activity including the Event bookmark.',
        steps: [
          'Create <code>AuditActivityMiddleware.cs</code> with the implementation above.',
          'Register it in <code>Program.cs</code> using <code>elsa.UseActivityPipeline(p => p.UseMiddleware&lt;AuditActivityMiddleware&gt;())</code>.',
          'Create <code>WorkflowFaultedHandler.cs</code> (replace <code>INotificationService</code> with a simple <code>Console.WriteLine</code> for the lab).',
          'Register the handler with <code>builder.Services.AddNotificationHandler&lt;WorkflowFaultedHandler&gt;()</code>.',
          'Run the app and dispatch the approval loop workflow.',
          'Verify the console shows <code>[AUDIT] START</code> and <code>[AUDIT] END</code> for every activity including the <code>Event</code> activity.',
          'Introduce a deliberate fault (throw inside an InlineActivity outside TryCatch) and verify the <code>WorkflowFaulted</code> handler fires and logs the fault message.',
          'Confirm that after the fault, subsequent activities do NOT emit audit logs (the instance stopped).'
        ],
        verification: [
          '<code>[AUDIT] START | Activity: Event</code> appears when the workflow suspends at the approval gate.',
          '<code>[AUDIT] END | Activity: Event</code> appears when the signal resumes the workflow.',
          '<code>[FAULT]</code> log line appears when the deliberate fault is triggered.',
          'Duration (ms) in the END log is non-zero and plausible.'
        ],
        pitfalls: [
          '<strong>Middleware not firing.</strong> If <code>UseActivityPipeline</code> is called before <code>UseWorkflowRuntime()</code>, the pipeline may not be fully initialised. Ensure <code>UseWorkflowRuntime()</code> is called first.',
          '<strong>Notification handler not registered.</strong> <code>AddNotificationHandler&lt;T&gt;</code> must be called on <code>builder.Services</code>, not inside <code>AddElsa()</code>. Placing it inside the Elsa lambda has no effect in Elsa 3.x.',
          '<strong>Event activity audit logs appear in two separate runs.</strong> The START log fires when the workflow first reaches the Event activity (before suspension). The END log fires when the workflow resumes — which may be minutes or hours later, in a different process if the host restarted. This is normal and expected behaviour.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the difference between activity middleware and a WorkflowFaulted notification handler?',
          answer: '<p>Middleware runs <strong>synchronously inside the execution pipeline</strong> for every activity — it can inspect, modify, or block execution. A notification handler runs <strong>asynchronously outside the pipeline</strong> after an event occurs — it is purely observational and cannot affect the outcome. Use middleware for enforcement (auth, timing); use notifications for side effects (logging, alerting).</p>'
        },
        {
          question: 'If you have 10 different activity types in a workflow, how many times does the AuditActivityMiddleware run per workflow execution?',
          answer: '<p>Once per activity execution — so at least 10 times for a single pass through a 10-activity workflow. If activities are inside loops, the middleware runs once per loop iteration per activity. It fires for built-in activities (WriteLine, ForEach, If) as well as custom activities. The total count depends on the execution path taken, not just the number of activity definitions in the workflow.</p>'
        },
        {
          question: 'How would you implement an authorization middleware that prevents an activity from executing if the current user does not have a required role?',
          answer: '<p>In <code>InvokeAsync</code>, before calling <code>await next(context)</code>, resolve the current user identity from the execution context properties (or from a DI-injected <code>IHttpContextAccessor</code>) and check the required role. If the check fails, throw an <code>UnauthorizedAccessException</code> (or a custom exception) without calling <code>next()</code>. The thrown exception will be caught by any enclosing <code>TryCatch</code> activity, or will fault the workflow instance if unhandled.</p>'
        }
      ]
    }
  },

  {
    id: 't3-05',
    tier: 3,
    title: 'Performance and Observability',
    slug: 'performance-and-observability',
    estimatedMinutes: 40,
    prerequisites: ['t3-01', 't3-04'],
    tabs: {
      concept: `<h2 id="concept-performance">Bottlenecks in Elsa</h2>
<p>Elsa 3.x trades raw throughput for correctness and durability. Every activity execution that can yield (suspend) involves at minimum: one read of the workflow instance state, one write of updated state, one write/delete of bookmarks. For a 10-activity workflow with 3 suspension points, that is roughly 13 database round-trips per completion. Understanding this model is essential for sizing infrastructure at TAM's volume.</p>

<h3>Key Bottlenecks</h3>
<ul>
  <li><strong>Persistence round-trips per activity:</strong> each resume reads the full instance state blob (can be 50–200 KB for complex workflows with many variables). Keep variable payloads small; avoid storing large documents as workflow variables.</li>
  <li><strong>Bookmark table scans:</strong> signal routing queries bookmarks by <code>Hash</code> and <code>CorrelationId</code>. Without an index on these columns, every signal does a full table scan — catastrophic at scale.</li>
  <li><strong>Lock contention:</strong> with distributed locking (T3-01), high-frequency resume operations for the same instance serialize through a single Redis lock. Design workflows to minimize the number of sequential resume round-trips for the same instance.</li>
</ul>

<h3>OpenTelemetry Integration</h3>
<p>Elsa 3.x has built-in OpenTelemetry instrumentation. Adding the OTEL SDK to the host produces spans for workflow dispatch, activity execution, and instance persistence. Connect to any OTEL-compatible backend (Jaeger, Zipkin, Azure Monitor, Datadog). Key spans to watch: <code>elsa.workflow.execute</code>, <code>elsa.activity.execute</code>, <code>elsa.bookmark.find</code>.</p>

<h3>Key Metrics</h3>
<ul>
  <li><strong>Instance throughput:</strong> new instances dispatched per second.</li>
  <li><strong>Resume latency:</strong> time from signal received to workflow continuing — the critical SLA metric for AWFS.</li>
  <li><strong>Fault rate:</strong> percentage of instances that transition to Faulted — a rising fault rate signals a systemic problem.</li>
  <li><strong>Bookmark table size:</strong> row count in the Bookmarks table is a proxy for the number of suspended instances.</li>
</ul>

<h3>AWFS Volume Estimate</h3>
<p>TAM processes approximately 500–2,000 purchase approvals per day. At peak (end of month), 200 approvals might be submitted within an hour. Each approval involves 3–5 activity executions and 3 resume events (one per approval gate). This is 200 × 6 = 1,200 database round-trips per peak hour — well within PostgreSQL's capability on modest hardware. The main risk is bookmark table growth if old Finished instances are not purged regularly.</p>`,

      code: [
        {
          language: 'csharp',
          title: 'Adding OpenTelemetry to the Elsa host',
          filename: 'Program.Otel.cs',
          code: `using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("awfs-elsa-host"))
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            // Elsa registers its own ActivitySource under "Elsa".
            .AddSource("Elsa")
            .AddOtlpExporter(otlp =>
            {
                otlp.Endpoint = new Uri(
                    builder.Configuration["Otel:Endpoint"] ?? "http://localhost:4317");
            });
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddAspNetCoreInstrumentation()
            .AddRuntimeInstrumentation()
            .AddOtlpExporter();
    });`,
          explanation: 'Elsa\'s built-in <code>ActivitySource</code> named <code>"Elsa"</code> emits spans for workflow and activity execution. Adding <code>.AddSource("Elsa")</code> to the tracing builder captures all Elsa spans. Export to any OTEL-compatible backend by changing the <code>AddOtlpExporter</code> endpoint.'
        },
        {
          language: 'sql',
          title: 'Recommended PostgreSQL indexes on WorkflowInstances and Bookmarks',
          filename: 'elsa_performance_indexes.sql',
          code: `-- CorrelationId is queried on every signal dispatch.
CREATE INDEX IF NOT EXISTS idx_workflow_instances_correlation
    ON "WorkflowInstances" ("CorrelationId")
    WHERE "CorrelationId" IS NOT NULL;

-- Status filter is used by management UI and purge jobs.
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status
    ON "WorkflowInstances" ("Status");

-- Composite: definition + status for "list all pending approvals".
CREATE INDEX IF NOT EXISTS idx_workflow_instances_definition_status
    ON "WorkflowInstances" ("DefinitionId", "Status");

-- Bookmark Hash is the primary signal routing key — must be fast.
CREATE INDEX IF NOT EXISTS idx_bookmarks_hash
    ON "Bookmarks" ("Hash");

-- CorrelationId on bookmarks enables the compound signal lookup.
CREATE INDEX IF NOT EXISTS idx_bookmarks_correlation
    ON "Bookmarks" ("CorrelationId")
    WHERE "CorrelationId" IS NOT NULL;

-- Compound index for the most common query pattern in SendSignalAsync.
CREATE INDEX IF NOT EXISTS idx_bookmarks_hash_correlation
    ON "Bookmarks" ("Hash", "CorrelationId");`,
          explanation: 'Apply these indexes after running the Elsa EF Core migrations. The compound <code>(Hash, CorrelationId)</code> index on Bookmarks is the single most impactful index — it turns the signal routing query from a full scan into a near-instant lookup.'
        },
        {
          language: 'csharp',
          title: 'HealthCheck endpoint wiring for Elsa',
          filename: 'Program.HealthChecks.cs',
          code: `builder.Services
    .AddHealthChecks()
    // Check that the PostgreSQL connection is alive.
    .AddNpgsql(
        connectionString,
        name: "elsa-postgres",
        tags: new[] { "db", "elsa" })
    // Check that the Redis lock store is reachable.
    .AddRedis(
        builder.Configuration.GetConnectionString("Redis")!,
        name: "elsa-redis",
        tags: new[] { "cache", "elsa" })
    // Custom check: count faulted instances in the last hour.
    .AddAsyncCheck("elsa-fault-rate", async (ct) =>
    {
        await using var scope = app.Services.CreateAsyncScope();
        var store = scope.ServiceProvider
            .GetRequiredService<IWorkflowInstanceStore>();

        var faultedCount = await store.CountAsync(
            new WorkflowInstanceFilter
            {
                Status = WorkflowStatus.Faulted
            }, ct);

        return faultedCount > 10
            ? HealthCheckResult.Degraded(
                $"{faultedCount} faulted instances — investigate.")
            : HealthCheckResult.Healthy($"{faultedCount} faulted instances.");
    });

// Expose health endpoints.
app.MapHealthChecks("/health/live",  new() { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new() { Predicate = c => c.Tags.Contains("db") });
app.MapHealthChecks("/health/full",  new());`,
          explanation: 'The custom fault-rate health check returns <code>Degraded</code> when more than 10 instances are in Faulted state — a signal to the ops team that something systemic is wrong. Kubernetes liveness and readiness probes should point to the <code>/health/live</code> and <code>/health/ready</code> endpoints respectively.'
        }
      ],

      handsOn: {
        goal: 'Run a load test with 100 concurrent workflow instances, measure resume latency, and inspect OTEL spans in Jaeger.',
        steps: [
          'Add the OTEL packages: <code>OpenTelemetry.Extensions.Hosting</code>, <code>OpenTelemetry.Instrumentation.AspNetCore</code>, <code>OpenTelemetry.Exporter.OpenTelemetryProtocol</code>.',
          'Add the OTEL configuration to <code>Program.cs</code> as shown above, pointing to a local Jaeger instance.',
          'Start Jaeger locally: <code>docker run -d -p 16686:16686 -p 4317:4317 jaegertracing/all-in-one:latest</code>.',
          'Apply the performance indexes to your PostgreSQL database using <code>elsa_performance_indexes.sql</code>.',
          'Write a load test script that dispatches 100 workflow instances in parallel (use <code>Parallel.ForEachAsync</code> or a tool like k6).',
          'For each instance, record the time between dispatch and first "Waiting for supervisor..." log line.',
          'Send 100 approval signals (one per instance) and record the time between signal sent and "decided:" log line (resume latency).',
          'Open Jaeger at <code>http://localhost:16686</code> and filter by service <code>awfs-elsa-host</code>. Inspect <code>elsa.workflow.execute</code> spans and find the slowest.',
          'Run the same load test without the performance indexes and compare query durations in the spans.'
        ],
        verification: [
          'Jaeger shows spans with <code>elsa.workflow.execute</code> and <code>elsa.activity.execute</code> for each instance.',
          'Resume latency (signal → continuation) is below 500 ms for 95th percentile with indexes applied.',
          'The <code>/health/full</code> endpoint returns healthy after the load test completes.',
          'No instances are in Faulted state after the load test.'
        ],
        pitfalls: [
          '<strong>OTEL exporter endpoint blocked.</strong> The OTLP exporter uses gRPC on port 4317. If a firewall or Docker network blocks this port, spans are silently dropped. Verify connectivity with <code>grpc_health_probe</code> or check Jaeger\'s logs.',
          '<strong>Indexes not applied because migrations ran first.</strong> EF Core migrations create tables without the custom indexes. Always run <code>elsa_performance_indexes.sql</code> manually after migrations, or add the indexes to a custom migration.',
          '<strong>Workflow state blob size.</strong> If workflow variables hold large objects (e.g., full document contents), the state blob can exceed 1 MB. PostgreSQL handles large blobs but with increased I/O. Store only IDs in workflow variables; fetch full documents from external storage when needed.'
        ]
      },

      selfCheck: [
        {
          question: 'What is the single most impactful database index to add for AWFS, and why?',
          answer: '<p>The compound index on <code>Bookmarks(Hash, CorrelationId)</code>. Every call to <code>SendSignalAsync</code> executes a query of the form <code>WHERE Hash = ? AND CorrelationId = ?</code>. Without this index, the query scans the entire Bookmarks table — which grows proportionally to the number of concurrent suspended instances. With the index, the query is a near-O(1) B-tree lookup regardless of table size.</p>'
        },
        {
          question: 'What does resume latency measure, and what is an acceptable target for AWFS?',
          answer: '<p>Resume latency is the time from when <code>SendSignalAsync</code> is called (or the signal message is enqueued in the broker) to when the workflow\'s next activity begins executing. It includes bookmark lookup, distributed lock acquisition, instance state load, and activity execution start. For an interactive approval flow where the approver is waiting for a UI confirmation, a P95 resume latency under 1 second is acceptable. For background batch processing, 5 seconds is fine.</p>'
        },
        {
          question: 'How do you prevent the WorkflowInstances and Bookmarks tables from growing unboundedly in production?',
          answer: '<p>Implement a periodic purge job that deletes <code>Finished</code> and <code>Cancelled</code> instances (and their associated bookmarks) older than a retention period (e.g., 90 days). Use <code>IWorkflowInstanceStore.DeleteAsync(new WorkflowInstanceFilter { Status = WorkflowStatus.Finished })</code> filtered by <code>UpdatedAt &lt; retentionCutoff</code>. Run the purge as a background hosted service or a scheduled Kubernetes job. Archive the purged records to cold storage (e.g., blob storage) if compliance requires retention beyond 90 days.</p>'
        }
      ]
    }
  }

,
  // ── LABS ────────────────────────────────────────────────────────────────────

  {
    id: 'lab-01',
    tier: 'labs',
    title: 'Build the AWFS Skeleton',
    slug: 'build-the-awfs-skeleton',
    estimatedMinutes: 60,
    prerequisites: ['t1-02', 't1-03', 't1-04'],
    tabs: {
      concept: `<h2 id="lab01-goal">Goal</h2>
<p>Scaffold a minimal AWFS host: Elsa 3.x + PostgreSQL + a single approval workflow stub that accepts <code>DocumentId</code>, <code>RequesterId</code>, and <code>Amount</code> as typed inputs and logs each approval stage. By the end you have a runnable foundation that all subsequent labs extend.</p>`,

      code: [],

      handsOn: {
        goal: 'Scaffold a minimal AWFS host: Elsa + PostgreSQL + a single approval workflow stub that accepts a DocumentId and logs each approval stage.',
        steps: [
          '<strong>Create the project.</strong> Run <code>dotnet new web -n AwfsElsaHost</code> and <code>cd AwfsElsaHost</code>.',
          '<strong>Add NuGet packages.</strong> Add <code>Elsa</code>, <code>Elsa.EntityFrameworkCore</code>, <code>Elsa.EntityFrameworkCore.PostgreSql</code>, <code>Elsa.Http</code>, and <code>Npgsql.EntityFrameworkCore.PostgreSQL</code>.',
          '<strong>Configure Program.cs.</strong> Register Elsa with <code>builder.Services.AddElsa(elsa => { elsa.UseEntityFrameworkCore(ef => ef.UsePostgreSql(...)); elsa.UseWorkflowRuntime(); elsa.UseWorkflowsApi(); })</code>.',
          '<strong>Create ApprovalWorkflow.cs.</strong> Subclass <code>WorkflowBase</code>. Add <code>[WorkflowInput]</code> properties for <code>DocumentId (string)</code>, <code>RequesterId (string)</code>, <code>Amount (decimal)</code>. In <code>Build()</code>, add a <code>Sequence</code> with three <code>WriteLine</code> activities logging "Workflow started for {DocumentId}", "Awaiting Supervisor approval", and "Workflow complete".',
          '<strong>Register the workflow.</strong> Add <code>elsa.AddWorkflow&lt;ApprovalWorkflow&gt;()</code> inside the Elsa configuration.',
          '<strong>Run EF Core migrations.</strong> Run <code>dotnet ef migrations add InitialCreate</code> and <code>dotnet ef database update</code>. Confirm the Elsa tables appear in PostgreSQL.',
          '<strong>Dispatch a test instance.</strong> Add a minimal API endpoint <code>POST /test-dispatch</code> that calls <code>IWorkflowRuntime.DispatchAsync</code> with <code>correlationId = "DOC-TEST-01"</code> and the three inputs.',
          '<strong>Verify via management API.</strong> Call <code>GET /elsa/api/workflow-instances?correlationId=DOC-TEST-01</code> and confirm the instance is <code>Finished</code> with all three log lines in the console.'
        ],
        verification: [
          'The Elsa management API is reachable at <code>GET /elsa/api/workflow-definitions</code> and returns the <code>ApprovalWorkflow</code> definition.',
          'Dispatching via <code>POST /test-dispatch</code> creates an instance and logs "Workflow started for DOC-TEST-01".',
          'The instance transitions to <code>Finished</code> without errors.',
          'PostgreSQL contains the Elsa schema tables: <code>WorkflowInstances</code>, <code>Bookmarks</code>, <code>WorkflowDefinitions</code>.'
        ],
        pitfalls: [
          '<strong>EF Core tools not installed.</strong> Run <code>dotnet tool install --global dotnet-ef</code> if the <code>dotnet ef</code> command is not found. Also add <code>Microsoft.EntityFrameworkCore.Design</code> to the project.',
          '<strong>PostgreSQL connection string format.</strong> The Npgsql connection string format is <code>"Host=localhost;Database=awfs_elsa;Username=postgres;Password=secret"</code> — not a JDBC URL. Misformatted strings produce a cryptic startup exception.',
          '<strong>Missing AddControllers / MapControllers.</strong> The Elsa management API is controller-based. Without <code>builder.Services.AddControllers()</code> and <code>app.MapControllers()</code>, all <code>/elsa/api/*</code> routes return 404.'
        ]
      },

      selfCheck: []
    }
  },

  {
    id: 'lab-02',
    tier: 'labs',
    title: 'Three-Level Sequential Approval',
    slug: 'three-level-sequential-approval',
    estimatedMinutes: 75,
    prerequisites: ['lab-01', 't2-01', 't2-05', 't2-06'],
    tabs: {
      concept: `<h2 id="lab02-goal">Goal</h2>
<p>Extend the skeleton to route through three sequential approval gates (Supervisor → Manager → Director), each waiting for a named event signal carrying the approver's decision. Rejection at any gate short-circuits the remaining gates.</p>`,

      code: [],

      handsOn: {
        goal: 'Extend the skeleton to route through three sequential approval gates (Supervisor → Manager → Director), each waiting for a named event signal carrying the decision.',
        steps: [
          '<strong>Add Approvers input.</strong> Add <code>[WorkflowInput] public Input&lt;string[]&gt; Approvers { get; set; }</code> to <code>ApprovalWorkflow</code>.',
          '<strong>Add gate variables.</strong> Declare <code>currentApprover (string)</code>, <code>rejected (bool = false)</code>, <code>decisions (List&lt;string&gt; = new())</code> via <code>builder.WithVariable&lt;T&gt;()</code>.',
          '<strong>Replace the stub Sequence with a ForEach.</strong> Iterate over <code>Approvers</code>. In each iteration, wrap the gate logic in <code>If(!rejected)</code>.',
          '<strong>Inside the If: add the gate body.</strong> WriteLine "Waiting for {currentApprover}", Event("ApprovalDecision"), InlineActivity to read the decision, append to decisions list, set rejected=true if "Rejected".',
          '<strong>After the ForEach: add outcome branch.</strong> <code>If(rejected)</code> → WriteLine "REJECTED", Else → WriteLine "APPROVED by all".',
          '<strong>Update the dispatch endpoint.</strong> Pass <code>Approvers = new[] { "sup@tam.co.id", "mgr@tam.co.id", "dir@tam.co.id" }</code> in the input dictionary.',
          '<strong>Add a signal endpoint.</strong> <code>POST /approvals/{correlationId}/decision</code> that calls <code>SendSignalAsync("ApprovalDecision", payload, correlationId)</code>.',
          '<strong>Test happy path.</strong> Dispatch, send three Approved signals, verify APPROVED log. Test rejection path: send Approved, Rejected — verify REJECTED and only 2 signals consumed.'
        ],
        verification: [
          'Console shows "Waiting for sup@tam.co.id" immediately after dispatch.',
          'After three Approved signals, console shows "APPROVED by all" and instance is <code>Finished</code>.',
          'After one Approved and one Rejected, console shows "REJECTED" and instance is <code>Finished</code> after exactly 2 signals.',
          'Sending a third signal after rejection returns an empty instance list (no bookmark remains).'
        ],
        pitfalls: [
          '<strong>Input key for string array.</strong> When dispatching from C# code, pass the approver array as <code>string[]</code>, not <code>List&lt;string&gt;</code>. The Elsa input deserializer may not convert between the two. Declare the input type consistently.',
          '<strong>Signal payload class namespace.</strong> <code>ApproverDecision</code> must be visible to both the workflow class and the signal endpoint. Place it in a shared <code>Models</code> namespace or a shared project assembly.',
          '<strong>ForEach does not break on rejection.</strong> The gate variable approach means all loop iterations still execute (they just skip their bodies). Ensure the final outcome branch is after the ForEach, not inside it.'
        ]
      },

      selfCheck: []
    }
  },

  {
    id: 'lab-03',
    tier: 'labs',
    title: 'POA Delegation',
    slug: 'poa-delegation',
    estimatedMinutes: 60,
    prerequisites: ['lab-02', 't2-05'],
    tabs: {
      concept: `<h2 id="lab03-goal">Goal</h2>
<p>Add POA (Persetujuan / delegation) support: when the primary approver sends a "delegate" signal, the workflow reassigns the pending approval to a delegate ID and re-suspends at the same gate, waiting for the delegate's decision instead.</p>`,

      code: [],

      handsOn: {
        goal: 'Add POA delegation: when the primary approver sends a "delegate" signal, the workflow reassigns the pending approval to a delegate ID and re-suspends at the same gate.',
        steps: [
          '<strong>Add a delegation loop variable.</strong> Inside the ForEach body, introduce a <code>gateComplete (bool = false)</code> variable and a <code>While(!gateComplete)</code> loop that wraps the Event activity and decision logic.',
          '<strong>Listen for two event types.</strong> Inside the While loop, use an <code>Event("ApprovalDecision")</code> and detect in the InlineActivity whether the payload carries <code>Decision = "Delegate"</code>. If so, set <code>currentApprover</code> to the delegate ID from the payload and continue the While loop (do not set gateComplete). If "Approved" or "Rejected", set <code>gateComplete = true</code>.',
          '<strong>Add a DelegateId field to ApproverDecision.</strong> Update the record: <code>record ApproverDecision(string Decision, string Comment, string? DelegateId = null)</code>.',
          '<strong>Add a delegation signal endpoint.</strong> <code>POST /approvals/{correlationId}/delegate</code> that sends <code>ApproverDecision("Delegate", "Delegating to {delegateId}", DelegateId: delegateId)</code>.',
          '<strong>Log the delegation.</strong> Add a WriteLine after detecting Delegate: "Gate reassigned to {newApprover}".',
          '<strong>Test delegation.</strong> Dispatch, send a Delegate signal with <code>DelegateId = "deputy@tam.co.id"</code>, verify "Gate reassigned to deputy@tam.co.id", then send an Approved signal from the delegate and verify the gate completes.',
          '<strong>Test delegation + rejection.</strong> Dispatch, delegate, then reject from delegate. Verify the loop exits and the ForEach rejection path fires.'
        ],
        verification: [
          'After a Delegate signal, console shows the new approver name and the workflow remains Suspended.',
          'The delegate can approve or reject — the outcome is the same as if the original approver had acted.',
          'Multiple delegations in sequence (A delegates to B, B delegates to C) work correctly.'
        ],
        pitfalls: [
          '<strong>While loop inside ForEach.</strong> Elsa supports nested loops, but the gate variable must be reset at the start of each ForEach iteration (before the While). Otherwise, <code>gateComplete = true</code> from the previous gate persists into the next, causing the While to skip immediately.',
          '<strong>Signal payload parsing on delegation.</strong> Ensure <code>DelegateId</code> is included in the signal payload JSON. If omitted, the default value is null and the <code>currentApprover</code> is set to null — causing a "Waiting for (null)" log and a broken subsequent signal lookup.',
          '<strong>Infinite delegation chain.</strong> There is no guard preventing infinite delegation cycles (A→B→A→B…). For production, add a max-delegation counter variable and fault gracefully if exceeded.'
        ]
      },

      selfCheck: []
    }
  },

  {
    id: 'lab-04',
    tier: 'labs',
    title: 'Dynamic Approver via MDM Lookup',
    slug: 'dynamic-approver-via-mdm-lookup',
    estimatedMinutes: 60,
    prerequisites: ['lab-02', 't2-02', 't2-03'],
    tabs: {
      concept: `<h2 id="lab04-goal">Goal</h2>
<p>Replace the hardcoded approver list in the dispatch payload with a runtime lookup from a mock MDM endpoint. The workflow uses <code>SendHttpRequest</code> to fetch the approver chain for the document's cost center immediately after starting, before the first gate.</p>`,

      code: [],

      handsOn: {
        goal: 'Replace the hardcoded approver list with a runtime lookup from a mock MDM endpoint, using SendHttpRequest to fetch the approver chain for the document\'s cost center.',
        steps: [
          '<strong>Create a mock MDM endpoint.</strong> Add a minimal API endpoint <code>GET /mock/mdm/approvers/{costCenter}</code> that returns <code>{"approvers":["sup@tam.co.id","mgr@tam.co.id","dir@tam.co.id"]}</code> as JSON.',
          '<strong>Add CostCenter input.</strong> Add <code>[WorkflowInput] public Input&lt;string&gt; CostCenter { get; set; }</code> to <code>ApprovalWorkflow</code>. Remove the <code>Approvers</code> input.',
          '<strong>Add a dynamic approver variable.</strong> Declare <code>approverChain (string[])</code> as a workflow variable (no default).',
          '<strong>Add SendHttpRequest at the start of the workflow.</strong> Before the ForEach, add a <code>SendHttpRequest</code> activity that calls <code>http://localhost:5000/mock/mdm/approvers/{CostCenter}</code> and stores the parsed response in <code>approverChain</code>.',
          '<strong>Add TryCatch around the MDM call.</strong> Wrap the <code>SendHttpRequest</code> in a <code>TryCatch</code>. On catch, set <code>approverChain</code> to a fallback hardcoded array and log a warning.',
          '<strong>Use approverChain in ForEach.</strong> Update the ForEach <code>Items</code> expression to use <code>approverChain</code> instead of the removed Approvers input.',
          '<strong>Update the dispatch call.</strong> Pass <code>CostCenter = "CC-1001"</code> instead of an approver list. Remove the Approvers key from the input dictionary.'
        ],
        verification: [
          'Dispatch with <code>CostCenter = "CC-1001"</code> causes the MDM endpoint to be called and logs the resolved approver list.',
          'The approval loop works identically to Lab 02 — three gates, same signal flow.',
          'When the mock MDM endpoint returns 500, the fallback approver list is used and the workflow continues (not faulted).'
        ],
        pitfalls: [
          '<strong>ParsedContent type for string array.</strong> <code>SendHttpRequest.ParsedContent</code> deserializes the JSON response. The MDM mock returns <code>{"approvers":[...]}</code> — you need a DTO record like <code>record MdmResponse(string[] Approvers)</code> and bind <code>approverChain</code> to <code>response.Approvers</code> in an InlineActivity after the request.',
          '<strong>Localhost URL inside Docker.</strong> If running in Docker Compose, replace <code>localhost:5000</code> with the service name (e.g., <code>http://awfs-elsa-host:8080</code>). Use an environment variable for the MDM base URL to avoid hardcoding.',
          '<strong>SendHttpRequest does not throw on 500.</strong> Manually check the status code output and throw if not 200, so the TryCatch retry logic triggers on MDM failures (see T2-03 pitfalls).'
        ]
      },

      selfCheck: []
    }
  }

,
  {
    id: 'lab-05',
    tier: 'labs',
    title: 'SLA Escalation',
    slug: 'sla-escalation',
    estimatedMinutes: 75,
    prerequisites: ['lab-02', 't1-05'],
    tabs: {
      concept: `<h2 id="lab05-goal">Goal</h2>
<p>Add a parallel <code>Delay</code> branch that fires after 24 hours (shortened to 30 seconds in the lab), cancels the waiting approval gate, and triggers a WhatsApp notification activity to alert the approver that the SLA has been breached.</p>`,

      code: [],

      handsOn: {
        goal: 'Add a parallel Delay branch that fires after 24 hours (30 seconds in lab), cancels the waiting approval gate, and calls the WhatsApp notification activity.',
        steps: [
          '<strong>Create a stub SendWhatsApp activity.</strong> Create <code>SendWhatsAppActivity.cs</code> with <code>[Activity]</code> attribute, an <code>Input&lt;string&gt; Recipient</code> and <code>Input&lt;string&gt; Message</code>, and <code>ExecuteAsync</code> that logs "WhatsApp sent to {Recipient}: {Message}".',
          '<strong>Register the activity.</strong> Add <code>elsa.AddActivity&lt;SendWhatsAppActivity&gt;()</code> in <code>Program.cs</code>.',
          '<strong>Wrap each approval gate in a Fork.</strong> Replace the <code>If(!rejected)</code> gate body with a <code>Fork</code> containing two branches: Branch A (the existing Event + decision logic) and Branch B (a <code>Delay</code> activity set to 30 seconds followed by a <code>SendWhatsApp</code> and an InlineActivity that sets <code>escalated = true</code>).',
          '<strong>Configure the Fork join strategy.</strong> Set <code>JoinMode = First</code> (or equivalent) so the Fork completes as soon as either branch finishes — whichever arrives first wins.',
          '<strong>After the Fork: handle escalation.</strong> Check <code>escalated</code>: if true, set <code>rejected = true</code> and log "Gate escalated — approval bypassed".',
          '<strong>Add escalated variable.</strong> Declare <code>escalated (bool = false)</code>. Reset it to false at the start of each ForEach iteration so subsequent gates start fresh.',
          '<strong>Test normal path.</strong> Approve within 30 seconds — Delay branch should not fire. Verify WhatsApp activity does not log.',
          '<strong>Test escalation path.</strong> Dispatch and wait 35 seconds without sending a signal. Verify "WhatsApp sent" and "Gate escalated" appear, and the instance finishes (not hangs).'
        ],
        verification: [
          'Approving within the SLA window (30 seconds) completes the gate normally; no escalation message.',
          'Waiting past 30 seconds without a signal triggers the WhatsApp stub and escalates the gate.',
          'After escalation, the approval loop continues to the next gate (or exits if the escalation policy is to reject).',
          'The Delay duration is configurable via a workflow variable (not hardcoded) so it can be set to 24 hours in production.'
        ],
        pitfalls: [
          '<strong>Fork join semantics in Elsa 3.x.</strong> Elsa\'s <code>Fork</code> activity supports different join modes. Verify <code>JoinMode.First</code> (or its equivalent in the version you use) actually cancels the losing branch when one branch completes. In some versions the losing branch is left as a dangling bookmark — check for orphaned bookmarks after the gate completes.',
          '<strong>Delay not cancellable after approval.</strong> If the Delay branch bookmark is not cleaned up when the approval branch wins the race, the Delay will fire later and cause unexpected behaviour. Test by approving at second 5, then waiting 35 seconds and confirming no escalation fires.',
          '<strong>escalated variable not reset per iteration.</strong> If <code>escalated = true</code> from gate 1 is not reset before gate 2 starts, gate 2 immediately escalates without waiting. Add an InlineActivity at the top of each ForEach iteration to reset <code>escalated = false</code>.',
          '<strong>Delay activity timer not persisted on restart.</strong> The Delay timer is stored as a bookmark with a future expiry. If the app restarts, the timer is reloaded from the bookmark store and resumes correctly — this is Elsa\'s durability guarantee. Test it by restarting the app mid-Delay.'
        ]
      },

      selfCheck: []
    }
  },

  {
    id: 'lab-06',
    tier: 'labs',
    title: 'Full Mini-AWFS Demo',
    slug: 'full-mini-awfs-demo',
    estimatedMinutes: 90,
    prerequisites: ['lab-01', 'lab-02', 'lab-03', 'lab-04', 'lab-05'],
    tabs: {
      concept: `<h2 id="lab06-goal">Goal</h2>
<p>Wire labs 01–05 into a single demo-ready workflow: submit → MDM lookup → 3-level approval loop with POA support → SLA escalation → final status webhook. Run the complete happy-path and rejection-path end-to-end.</p>`,

      code: [],

      handsOn: {
        goal: 'Wire labs 01–05 into a single demo-ready workflow: submit → MDM lookup → 3-level approval loop with POA support → SLA escalation → final status webhook. Run the complete happy-path and rejection-path end-to-end.',
        steps: [
          '<strong>Merge the features.</strong> Integrate the MDM lookup (Lab 04), the POA delegation While loop (Lab 03), and the SLA Fork (Lab 05) into the single <code>ApprovalWorkflow</code> from Lab 02. Resolve any variable name conflicts.',
          '<strong>Add a final status webhook.</strong> After the approval loop\'s outcome If-branch, add a <code>SendHttpRequest</code> that POSTs to <code>http://localhost:5000/mock/callbacks/approval-result</code> with body <code>{"documentId":"...","decision":"Approved/Rejected","decisions":[...]}</code>.',
          '<strong>Add a mock callback endpoint.</strong> Add <code>POST /mock/callbacks/approval-result</code> that logs the received payload.',
          '<strong>Verify the complete input shape.</strong> Dispatch now requires only <code>DocumentId</code>, <code>RequesterId</code>, <code>Amount</code>, <code>CostCenter</code>. The approver chain is resolved at runtime.',
          '<strong>Run happy path.</strong> Dispatch with valid inputs. Approve at all three gates within the SLA window. Verify the callback receives <code>"decision":"Approved"</code> and all three decisions in the list.',
          '<strong>Run rejection path.</strong> Dispatch, approve supervisor, reject manager. Verify the callback receives <code>"decision":"Rejected"</code> after 2 signals.',
          '<strong>Run delegation path.</strong> Dispatch, send Delegate from supervisor to deputy, approve from deputy, approve manager, approve director. Verify all four signals land correctly and the callback fires with Approved.',
          '<strong>Run escalation path.</strong> Dispatch, approve supervisor, wait 35 seconds at manager gate. Verify escalation fires, the loop exits, and the callback receives the appropriate outcome.',
          '<strong>Prepare the demo script.</strong> Write a concise curl sequence for each of the four paths above. Practise running it end-to-end without errors.',
          '<strong>Test crash recovery.</strong> Dispatch a workflow, restart the app mid-Delay, confirm the Delay timer resumes and the workflow completes normally.'
        ],
        verification: [
          'All four paths (happy, rejection, delegation, escalation) complete without the instance reaching Faulted state.',
          'The final status webhook receives the correct payload for each path.',
          'App restart mid-workflow does not lose the instance or its bookmark state.',
          'The management API shows all instances as Finished (not stuck) after each test.',
          'The demo script runs end-to-end in under 5 minutes from a cold start.'
        ],
        pitfalls: [
          '<strong>Variable name collisions.</strong> Merging three labs into one workflow introduces multiple variables with similar names. Prefix variables with the feature name (e.g., <code>poaGateComplete</code>, <code>slaEscalated</code>) to avoid accidental reuse.',
          '<strong>Callback webhook unreachable.</strong> If the final SendHttpRequest cannot reach the callback endpoint (e.g., firewall, wrong port), wrap it in a TryCatch so a callback failure does not fault the entire workflow after all approvals are complete.',
          '<strong>Demo timing for the SLA path.</strong> A 30-second delay during a live demo is long. Reduce to 10 seconds for the demo and explain it represents 24 hours in production.'
        ]
      },

      selfCheck: []
    }
  },

  {
    id: 'lab-07',
    tier: 'labs',
    title: 'CTO Q&A Drill',
    slug: 'cto-qa-drill',
    estimatedMinutes: 45,
    prerequisites: ['lab-06'],
    tabs: {
      concept: `<h2 id="lab07-goal">Goal</h2>
<p>Simulate a CTO deep-dive Q&amp;A session. For each of the 10 questions below, write a concise spoken answer (2–3 sentences), then verify against the self-check answers in the T1–T3 topics. The goal is fluency under pressure — you should be able to answer any of these questions in under 30 seconds without looking at notes.</p>`,

      code: [],

      handsOn: {
        goal: 'Simulate a CTO deep-dive Q&A session. For each of the 10 questions, write a concise spoken answer (2–3 sentences) and verify against the topic self-check answers.',
        steps: [
          '<strong>Q1: "Why Elsa instead of Azure Logic Apps or Temporal?"</strong> — Cover: open-source, .NET-native, no vendor lock-in, runs on-prem for TAM\'s compliance requirements.',
          '<strong>Q2: "What happens if the Elsa host crashes while an approval is pending?"</strong> — Cover: bookmark durability in PostgreSQL, instance state persisted after every activity, resume on restart.',
          '<strong>Q3: "How do you ensure an approval signal goes to the right document and not someone else\'s?"</strong> — Cover: correlationId routing, one correlationId per document, signal matched by (eventName, correlationId).',
          '<strong>Q4: "Can we version the approval workflow without killing in-flight approvals?"</strong> — Cover: Elsa definition versioning, in-flight instances pin to their definition version, new dispatches use latest published.',
          '<strong>Q5: "How does POA delegation work technically?"</strong> — Cover: While loop inside ForEach, Delegate signal updates currentApprover variable, workflow re-suspends at same gate for the delegate.',
          '<strong>Q6: "What happens when MDM is down?"</strong> — Cover: TryCatch + retry loop, fallback approver list, MDM failure does not fault the approval workflow.',
          '<strong>Q7: "How does the SLA timer survive a server restart?"</strong> — Cover: Delay activity stores a future-expiry bookmark in PostgreSQL, timer is reloaded on restart from the bookmark store.',
          '<strong>Q8: "How many approvals per day can this handle on a single node?"</strong> — Cover: 500–2000/day at TAM is well within PostgreSQL capacity, scale to multiple nodes with Redis + MassTransit for higher loads.',
          '<strong>Q9: "Can non-developers change the approval logic?"</strong> — Cover: Elsa Studio visual designer, JSON workflow definitions exportable and importable, Studio connects to the production Elsa host.',
          '<strong>Q10: "How do you monitor stuck or faulted approvals in production?"</strong> — Cover: management API list by status=Faulted, WorkflowFaulted notification handler alerts ops team, OTEL spans for latency tracking.'
        ],
        verification: [
          'You can answer Q1–Q5 without referring to notes in under 30 seconds each.',
          'Your Q3 answer correctly uses the term "correlationId" and explains the matching logic.',
          'Your Q8 answer gives a concrete number (500–2000/day) and explains the scaling path.'
        ],
        pitfalls: [
          '<strong>Confusing correlationId with workflowInstanceId.</strong> The CTO may ask "how do you find the right instance?" — the answer is correlationId (business key), not the internal GUID. Practise using the right term.',
          '<strong>Overselling Elsa Studio.</strong> Studio is a visual designer, not a no-code platform. Custom activities still require C# development. Be precise: "business analysts can visualise and adjust routing logic; new activity types require an engineer."'
        ]
      },

      selfCheck: [
        {
          question: 'If a CTO asks "what is your biggest technical risk with this architecture?", what is the honest answer?',
          answer: '<p>The biggest technical risk is <strong>database contention at scale</strong>: every activity execution involves at least one read and one write of the workflow instance state blob. At TAM\'s current volume (500–2000 approvals/day) this is negligible. But if approval volume spikes 10x (e.g., year-end batch processing), the PostgreSQL write throughput and bookmark table size become bottlenecks. The mitigation plan is: Redis distributed locking, MassTransit for async dispatch, compound indexes on Bookmarks, and a regular instance purge job. All of these are documented and implementable within Sprint 4.</p>'
        },
        {
          question: 'What is the one-sentence pitch for why AWFS uses Elsa instead of a hand-rolled state machine?',
          answer: '<p>Elsa provides durable workflow persistence, visual observability via Studio, and a rich activity library out of the box — building equivalent capabilities from scratch (bookmark storage, distributed locking, definition versioning, a visual designer) would take months and introduce custom maintenance burden that grows with every new approval rule TAM adds.</p>'
        },
        {
          question: 'How do you answer "is this production-proven?" for Elsa 3.x?',
          answer: '<p>Elsa 3.x is used in production by multiple ISVs and enterprise teams globally; the GitHub repository has over 6,000 stars and active commercial support from the core maintainers. For TAM specifically, the AWFS POC demonstrates all critical paths end-to-end with PostgreSQL persistence, distributed locking, and crash recovery — the production readiness evidence is the running demo, not just vendor claims.</p>'
        }
      ]
    }
  }

]; // end topics array

window.topics = topics;

})();
