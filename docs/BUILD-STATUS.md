# AstraForge web application — implementation status

This checkout is a working private browser workspace, not a completed multi-tenant production gateway. Public OpenRouter and Ollama catalogs were retrieved successfully. User-configured production OpenAI calls returned HTTP 429 in all four recorded runs; earlier code did not preserve the provider error code. Browserbase starts failed without creating a stored session; the prior catch handler hid the upstream reason. This revision preserves sanitized error details and adds read-only connection checks. Successful generation and browser startup remain unverified.

## Implemented in this application

- Platform-authenticated, owner-scoped D1 projects, files, chat, snapshots, connection records, exact command rules, approvals, audit events and engine runs.
- Locally bundled Monaco with language workers; tabs, multi-cursor editing, editor search, workspace content search, file creation/deletion, rename-project, automatic and manual saving with revision compare-and-swap.
- Resizable editor/chat/terminal panels, dark/light modes, keyboard shortcuts, command palette, desktop-first layout and mobile chat.
- Opaque-origin static HTML/CSS/JS preview with CSP blocking external subresources and fetch; sandbox denies top navigation, forms and popups. This is not a network-firewall guarantee against self-navigation. The included Orbit timer runs real JavaScript inside the iframe.
- Four project templates; bounded text ZIP import/export; file-version snapshots and reviewed restore.
- Searchable cloud selector initialized with 444 OpenRouter and 20 Ollama Cloud text-output routes retrieved on 2026-09-22. Removes speculative candidates. Refresh fetches provider-reported catalogs; direct connections discover on load/save. Supports 19 inference providers, exact custom IDs in connection settings, public-catalog fallback, capability/context metadata, and native pagination where configured. Catalog listing is not proof of account credit or successful generation.
- User-selected reasoning for supported OpenAI/Gemini models; output-token ceilings; provider-reported usage and rate-limit headers. Missing telemetry displays as unknown.
- OpenAI-compatible, Anthropic Messages and Gemini streaming adapters; bounded fallback attempts; suffix-validated continuation; partial text checkpoints; explicit pause/stop states. Refusals are not failed generations.
- AI-proposed complete-file patches, revision checks, user review, and pre-apply recovery snapshots. Includes a persisted foreground plan/action/observation agent with strict action schemas, step budgets, exclusive execution leases, revision-pinned approvals, denial recovery and unknown-outcome pauses. It advances while the Agent panel is open; it is not an unattended background worker.
- AES-GCM encrypted per-user API keys with owner-bound associated data and a runtime vault key. Keys never appear in project files or client responses.
- E2B SDK command path: explicit server-stored grants, exact-command persistence, single-use atomic claim, workspace revision pinning, no outbound internet, bounded runtime, non-root user, remote VM destruction.
- PowerShell command encoding and shell selection; a pwsh-enabled E2B template must be provisioned. No local host shell is used.
- GitHub API export creates a new branch against the current default branch; remote files absent from the workspace are preserved. Main is not overwritten. The returned compare URL opens the provider's real PR workflow.
- Higgsfield Streamable HTTP MCP initialization, tool discovery, exact argument review, one-use approval, execution, result presentation, and unknown-outcome handling. Requires a valid service-supported bearer credential. Existing ChatGPT plugin access cannot be inherited.
- Workspace-scoped tool enablement with server-side checks for E2B, Higgsfield and Browserbase. Connection credentials are separate from agent tool authorization.
- Browserbase session creation/release, encrypted session credentials, trusted live-view embedding and narrowly scoped CDP navigation/page-text read. Starts, navigation and reads require explicit grants; sessions expire after ten minutes. Requires a Browserbase account supporting persistent sessions; live service behavior has not been verified without credentials.
- WebMCP read-workspace and open-file actions, feature-detected. This preview browser does not expose modelContext, so live WebMCP validation was unavailable.

## Required before claiming the original full platform is complete

| Capability | Concrete remaining implementation / release gate |
|---|---|
| Free hosted inference | Configure a funded sponsor account, enforce per-user budgets and global circuit breakers, and publish fair-use limits. BYOK is functional account configuration, not sponsor-funded inference. |
| Every model / provider | Validate exact IDs and entitlement through provider discovery; add Azure deployment/auth and Bedrock SigV4 adapters; add native Responses/Codex and Gemini Live sessions. Run adapter conformance suites with real keys. |
| Dynamic production router | Deploy the gateway in the technical specification: signed registry versions, capability admission, real tokenizers, task-quality scoring, residual-quota reservations, Redis limit state, health loops, canary evaluation, sticky routing and cost ledger. |
| Universal invisible failover | Impossible as an unconditional guarantee. The shipped continuation is lexical suffix verification, not latent-state transfer. Deploy durable event replay and candidate validation; measure conditional p95 <800ms with warm standby under an explicit workload. |
| Background agents / native tool portability | The foreground loop and reviewed file, command, MCP and browser actions are implemented. Deploy a durable worker queue, provider-native tool-call normalization, cancellation propagation, artifact storage, idempotency reconciliation and live conformance tests for unattended execution. |
| Interactive terminal | Replace bounded one-shot commands with a session broker, PTY WebSockets, snapshots, attach leases and process-group termination. Import reviewed filesystem deltas rather than discarding ephemeral changes. |
| Package installs / egress | Deploy the egress proxy with DNS/IP pinning, loopback/link-local/metadata blocking, destination capabilities and tool/VM attribution. Package allow rules require lockfile/provenance review. Current runner denies outbound internet. |
| Full PowerShell grants | Ship a signed custom image with pwsh and test OS fidelity; bind grants to image, argv/script digest, mounts, egress and version; only then enable wildcard/persistent full-shell grants. |
| Browser runtime | Integrate WebContainers behind cross-origin-isolation detection and resource limits. Its dependency is installed but it is not presented as an active runtime. |
| Git parity | Implement repository import, index/status/diff, local commits, branches, merge conflicts, GitLab, LFS limits and OAuth installation permissions. Current snapshots are explicitly not Git. |
| Arbitrary plugin ecosystem | Implement the connector broker, signed manifests, host allowlisting, OAuth/PKCE, scoped grants, schema validation, idempotency and an action journal. Current native bridge is Higgsfield plus GitHub/E2B APIs. |
| Adobe / 3D / Remotion | Deploy licensed desktop bridge and signed local capability agent for AE. Discover 3D Jutsu/Seedance tools from authorized Higgsfield account; provision Blender/Remotion runtime templates, artifact storage and render queues. Do not claim universal Lottie fidelity. |
| Shared production scale | Deploy Postgres/Redis/object storage/queue topology from the specification; distributed rate/quota admission, backpressure, backup/restore, retention jobs and per-tenant concurrency controls. D1 serves this private initial workspace. |
| Security and compliance | Pen-test auth, tool broker, isolation, egress and SSRF; test deletions/backups/DSAR; complete access reviews, incident procedures and vendor DPAs. E2EE requires a separate local-only execution mode; server AI needs authorized plaintext. |
| Production qualification | Run provider and sandbox live tests, concurrent editing/approval races, fault injection, queue crash recovery, load/soak tests, accessibility audit and mobile browsers. Do not call this build SOC2 certified or production hardened. |

The original comprehensive technical specification and tested gateway reference live in the accompanying implementation package. Its contracts and acceptance tests remain the plan for the services above; documentation is not evidence those services are deployed.

## Validation for this revision

TypeScript compilation, twelve protocol/stream/catalog/error tests and six SQLite query/authorization/concurrency tests pass. Tests use local fixtures; they do not certify live paid integrations.

## Connection troubleshooting

Settings → AI & connections → Check performs read-only key/model or project discovery for saved OpenAI/Browserbase connections. It does not consume generation tokens or create a browser, and does not prove sufficient paid quota. Chat and Browserbase action failures now preserve sanitized provider codes/details in the UI. Browserbase live control currently requires keepAlive, a Hobby-or-higher feature; do not advertise the current broker as free-plan compatible. OpenAI 429 errors require the exact API error code to distinguish credit exhaustion, spending limits and temporary throttling. Never change billing or purchase credits automatically.
