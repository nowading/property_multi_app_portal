# PROJECT_PLAN — Property Multi-App Portal

> Multi-application Next.js portal hosting two independent apps (Property Value Estimator + Property Market Analysis) backed by FastAPI and Spring Boot, both integrating with the ML regression model container at `D:\DevDir\intw_prj\house_price_prediction`.
>
> This plan follows the agent workflow defined in `agent_rules.md §5`: mandatory planning → feature-by-feature development with testing gates → atomic conventional commits → production-ready runnable output.
>
> **Rule hierarchy** (read in order when in doubt):
> 1. `agent_rules.md §8` — Bug Investigation & Debugging SOP (mandatory for any runtime bug)
> 2. `agent_rules.md §9` — Testing Pyramid (three-layer verification: unit + integration + E2E)
> 3. `agent_rules.md §10` — Next.js RSC Architecture Rules (single source of truth)
> 4. `agent_rules.md §11` — Cross-Service Communication Audit Checklist
> 5. This document (milestone-level execution)

---

## 1. Overview

| Item | Detail |
| --- | --- |
| Goal | Unified Next.js portal with shared shell + two micro-apps, each with isolated backend |
| Frontend | Next.js (App Router) + TypeScript (strict) + Tailwind + Lucide + Recharts |
| Backend 1 (App 1) | Python 3.12 + FastAPI + Pydantic v2 + httpx (async) |
| Backend 2 (App 2) | Java 21 + Spring Boot 3.4.4 + Caffeine + Resilience4j |
| ML Service | Existing FastAPI container (port 8000) — `/predict`, `/predict/batch`, `/model-info`, `/health` |
| ML Features (7) | `square_footage`, `bedrooms`, `bathrooms`, `year_built`, `lot_size`, `distance_to_city_center`, `school_rating` |
| Architecture | Microservices + BFF; Clean / Hexagonal Architecture per backend |

---

## 2. Repository Layout (Monorepo)

```
property_multi_app_portal/
├── PROJECT_PLAN.md
├── README.md
├── .gitignore
├── .env.example                      # all service URLs & secrets template
├── docker-compose.yml                # orchestrates web + 2 backends + ML container
│
├── apps/
│   ├── web/                          # Next.js unified portal (port 3000)
│   │   ├── src/app/
│   │   │   ├── layout.tsx            # shared shell: nav, header, design system
│   │   │   ├── page.tsx              # landing / overview
│   │   │   ├── estimator/            # App 1 routes
│   │   │   │   ├── page.tsx          # form + results
│   │   │   │   ├── history/page.tsx  # history list
│   │   │   │   ├── compare/page.tsx  # side-by-side compare
│   │   │   │   ├── loading.tsx
│   │   │   │   └── error.tsx
│   │   │   └── analytics/            # App 2 routes
│   │   │       ├── page.tsx          # dashboard
│   │   │       ├── what-if/page.tsx
│   │   │       ├── loading.tsx
│   │   │       └── error.tsx
│   │   ├── src/components/           # shared UI primitives
│   │   ├── src/lib/                  # api clients, hooks, utils
│   │   ├── src/hooks/                # custom hooks (useEstimator, useAnalytics…)
│   │   ├── tailwind.config.ts
│   │   ├── next.config.mjs
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── estimator-api/                # FastAPI (port 8001)
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI entry, middleware, routers
│   │   │   ├── domain/               # core models, ports (ModelInferencePort)
│   │   │   ├── application/          # use cases (PredictUseCase…)
│   │   │   ├── adapters/
│   │   │   │   ├── web/              # routers, DTOs
│   │   │   │   ├── ml_client/        # httpx async client → ML container
│   │   │   │   └── persistence/      # in-memory history store
│   │   │   ├── schemas/              # Pydantic v2 models
│   │   │   ├── core/                 # config (env), envelope, logging
│   │   │   └── utils/
│   │   ├── tests/                    # pytest unit + integration
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── pyproject.toml
│   │
│   └── analytics-api/                # Spring Boot (port 8002)
│       ├── src/main/java/com/portal/analytics/
│       │   ├── AnalyticsApplication.java
│       │   ├── domain/               # records, ports (ModelInferencePort)
│       │   ├── application/          # services / use cases
│       │   └── adapters/
│       │       ├── web/              # @RestControllers, DTO records
│       │       ├── mlclient/         # RestClient → ML container
│       │       └── persistence/      # dataset loader, cache config
│       ├── src/main/resources/
│       │   ├── application.yml
│       │   └── data/housing.csv      # embedded dataset copy for stats
│       ├── src/test/java/...         # JUnit 5 + MockMvc
│       ├── pom.xml
│       └── Dockerfile
│
├── logs/                             # Postmortem & bug investigation logs
│
├── packages/                         # (optional) shared TS types
│   └── shared-types/
```

---

## 3. Cross-Cutting Conventions (from agent_rules.md)

1. **Unified API Envelope** — every backend response:
   ```json
   { "success": true, "data": { ... }, "error": { "code": "...", "message": "..." } }
   ```
2. **Environment variables only** — never hardcode URLs/secrets. Backends read `ML_SERVICE_URL` (default `http://localhost:8000`). Web reads `ESTIMATOR_API_URL` / `ANALYTICS_API_URL`.
3. **Timeouts** — inter-service HTTP: Connect=2s, Read=5s.
4. **Graceful fallback** — ML unreachable → structured `ML_SERVICE_TIMEOUT` error, never 500 leak.
5. **Health endpoints** — FastAPI `/healthz`; Spring Boot `/actuator/health`.
6. **Structured logs** — JSON with `timestamp, level, trace_id, service_name`.
7. **Clean Architecture** — Domain has zero framework deps; ports define interfaces; adapters implement.
8. **Three-layer testing gate** — a feature is NOT complete until unit + integration + E2E tests pass (see §5 and §11). No stubs, no `// TODO`.
9. **Runtime evidence required** — every feature ships only after `docker compose logs <service>` proves the expected request counts and no errors (see §11 Cross-Service Audit).
10. **RSC single source of truth** — when `page.tsx` is RSC, the client component MUST NOT independently fetch the same data (see agent_rules.md §10).

### 3.1 Caching Strategy (end-to-end, decided)

Three-layer caching with explicit ownership boundaries to avoid double-cache overhead:

| Layer | Tool | Cache Targets | TTL | Eviction Cap |
| --- | --- | --- | --- | --- |
| **Backend — Spring Boot** | Caffeine + `@Cacheable` | (a) Aggregate stats [key=filters hash] (b) ML `/model-info` (c) What-if predictions [key=features hash] | (a) 10 min / (b) 60 s / (c) 60 s | (a) 1000 / (b) 1 / (c) 500 |
| **Backend — FastAPI** | None | — | — | — |
| **Frontend — RSC** | Next.js `fetch()` cache | `/model-info`; default `/stats` (no filters) | `revalidate: 300` (5 min) | automatic |
| **Frontend — Client** | Custom `useApi` hook + module-level `Map` | Filtered stats (filter toggle back/forth) | 60 s | manual `invalidate(key)` |
| **Frontend — Persistent** | `localStorage` | Estimator history (max 50, FIFO); compare selection | permanent | user / cap |

**Key decisions:**

- **FastAPI Estimator API does NOT add backend cache.** Predictions are unique per input; `/model-info` is consumed via RSC fetch cache on the web side. Adding `cachetools` would be over-engineering for this scope.
- **No SWR / React Query.** ~10 endpoints don't justify the dependency; a ~30-line custom `useApi` hook satisfies the "custom hooks" business requirement.
- **HTTP `Cache-Control` headers** set by backends:
  - `/model-info`, default `/stats`: `public, max-age=60, stale-while-revalidate=300`
  - `/predict`, `/predict/batch`, `/what-if`: `no-store`
- **Boundary rule:** frontend cache reduces HTTP calls; backend Caffeine reduces CPU. They compose, never overlap on the same concern.
- **Cache invalidation must NOT cause duplicate requests.** When the user changes filters, only one round of RSC re-fetch should happen; client must dedup against RSC's served key (see agent_rules.md §10.4).

### 3.2 Next.js Version Compatibility (mandatory pre-edit checklist)

Before editing any `app/**/page.tsx` or `app/**/layout.tsx`, confirm:

- [ ] `searchParams` is typed as `Promise<...>` and `await`ed (mandatory in Next.js 16+).
- [ ] `params` is typed as `Promise<...>` and `await`ed (mandatory in Next.js 16+).
- [ ] `cookies()`, `headers()` are awaited (mandatory in Next.js 16+).
- [ ] After editing server-component files, `/app/.next` cache must be cleared before declaring the fix verified (see agent_rules.md §7.6).

Run this checklist in PR review; failing items must be fixed before merge.

---

## 4. Phased Milestones

Each phase = a verifiable deliverable with its own test gate and atomic commit(s). **Every milestone MUST include runtime evidence (see §11)**, not just unit-test assertions.

### Phase 0 — Foundation & Scaffolding
**Goal:** runnable empty skeleton with all four services wired.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 0.1 | Monorepo dirs, `.gitignore`, `.env.example`, `README.md` skeleton | `ls apps/` shows 3 dirs | — |
| 0.2 | Next.js app `create-next-app` (App Router, TS strict, Tailwind) boots on :3000 | `curl localhost:3000` 200 | `npm run build` passes |
| 0.3 | FastAPI app skeleton returns `{success:true}` on `/healthz` :8001 | `curl :8001/healthz` | `pytest tests/test_health.py` |
| 0.4 | Spring Boot app skeleton returns `/actuator/health` UP :8002 | `curl :8002/actuator/health` | `mvn test` (context loads) |
| 0.5 | `docker-compose.yml` bringing up ML container (build from `house_price_prediction`) | `docker compose up` healthy | manual smoke `curl :8000/health` |
| 0.6 | Initial git repo + first commit `chore: scaffold monorepo` | `git log` | — |

### Phase 1 — Shared Frontend Shell & Design System
**Goal:** unified portal shell with navigation between two apps.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 1.1 | Root `layout.tsx`: header, left nav (Estimator / Analytics / Home), footer, responsive | Visual + DOM has `<nav>` | Jest: layout renders nav links |
| 1.2 | Design tokens in `tailwind.config.ts` (colors, spacing, typography) + base UI primitives (`Button`, `Card`, `Input`, `Badge`) | Storybook-free; primitives render | Jest: Button variants snapshot |
| 1.3 | Root `loading.tsx` + `error.tsx` (App Router boundaries) | Trigger error → boundary catches | Jest: error boundary renders fallback |
| 1.4 | Landing `page.tsx` (RSC) showing portal overview + service status cards | `/` renders cards | Jest: page renders title |
| 1.5 | API client libs in `src/lib/api.ts` (typed fetch + envelope + timeout) **AND** `useApi` hook with module-level in-memory cache (TTL 60s + `invalidate(key)`); RSC `fetch(..., { next: { revalidate: 300 } })` for `/model-info` & default `/stats` per §3.1 | Second identical call hits cache; invalidate forces refetch | Jest: envelope error throws typed error; cache hit returns cached data; invalidate refetches |
| 1.6 | Commit `feat(web): add shared shell and design system` | — | — |

### Phase 2 — App 1: Estimator Frontend
**Goal:** complete estimator UI talking to FastAPI (mocked until Phase 3).

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 2.1 | `/estimator` form with all 7 fields, typed state, client-side validation (zod) | Invalid input → inline errors | RTL: validation messages render |
| 2.2 | Submit → calls `POST /estimator/predict` (via api client); loading + error states | Network panel shows call | RTL: loading skeleton + error UI |
| 2.3 | Results display: tabular breakdown + Recharts bar/feature-contribution chart | Chart canvas present | RTL: results table renders |
| 2.4 | History feature: persist estimates to `localStorage` via `useEstimatorHistory` hook; `/estimator/history` list | Reload keeps entries | RTL: history persists across reload (jsdom + storage mock) |
| 2.5 | Compare view `/estimator/compare`: select 2–4 history items → side-by-side table + grouped chart | UI toggles items | RTL: compare renders N rows |
| 2.6 | `/estimator/loading.tsx` + `/estimator/error.tsx` | — | RTL: boundary renders |
| 2.7 | Commit `feat(estimator): implement estimator UI with history and compare` | — | — |

### Phase 3 — App 1: FastAPI Backend (Clean Architecture)
**Goal:** production-ready Estimator API integrating with ML container.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 3.1 | Domain layer: `PropertyFeatures` entity + `PredictionResult` value object + `ModelInferencePort` interface | Imports only stdlib | Unit: domain invariants |
| 3.2 | Application layer: `PredictUseCase`, `BatchPredictUseCase`, `GetModelInfoUseCase` | Pure functions | Unit: use case orchestrates port mock |
| 3.3 | ML client adapter: `httpx.AsyncClient` with Connect=2s/Read=5s, env `ML_SERVICE_URL`, fallback → `ML_SERVICE_TIMEOUT` | Mock httpx returns prediction | Unit: timeout → typed error |
| 3.4 | Web adapter: routers `/predict`, `/predict/batch`, `/model-info`, `/history`, `/healthz`; Pydantic v2 DTOs; unified envelope; `Cache-Control` headers per §3.1 (`no-store` on predict; `max-age=60, stale-while-revalidate=300` on `/model-info`) — **no backend cache added** | `curl :8001/predict` returns envelope; headers present | Integration: TestClient end-to-end + header assertions |
| 3.5 | Persistence adapter: in-memory history store (thread-safe) + endpoints to add/list/clear | `/history` returns list | Integration: history persists in process |
| 3.6 | Structured JSON logging middleware + `trace_id` propagation | Logs include fields | Unit: log capture asserts fields |
| 3.7 | Dockerfile + wire into compose | `docker compose up estimator-api` healthy | — |
| 3.8 | Commit `feat(estimator-api): add FastAPI estimator with ML integration` + `test(...)` | — | full pytest green |

### Phase 4 — App 2: Analytics Frontend
**Goal:** market analysis dashboard with filters, what-if, export.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 4.1 | `/analytics` dashboard: KPI cards (avg price, count, ranges) + Recharts visuals (histogram, scatter price vs sqft, box plot by bedrooms) | Charts render from API | RTL: KPIs + chart canvases present |
| 4.2 | Filters component: bedrooms range, year built range, distance radius, school rating | Filters update URL + refetch | RTL: filter change triggers fetch |
| 4.3 | Responsive data table (sort + paginate) of dataset rows | Sort icons work | RTL: sort click reorders rows |
| 4.4 | What-if tool: sliders for the 7 features → live prediction + delta vs baseline | Slider → prediction updates | RTL: slider fires callback |
| 4.5 | Export: CSV (client-side) + PDF (via `jsPDF` + `html2canvas`) | File download triggered | Unit: CSV serializer produces rows |
| 4.6 | `/analytics/loading.tsx` + `/analytics/error.tsx` | — | RTL: boundary |
| 4.7 | Commit `feat(analytics): add market analysis dashboard with what-if and export` | — | — |

**Phase 4 — RSC Architecture Compliance (MANDATORY before §4.7 commit):**

> All `/analytics/*` client components MUST obey agent_rules.md §10. Specifically:
>
> - When `page.tsx` is RSC and passes `initialStats` / `initialDataset` / `initialFilters` as props, the client component MUST dedup against those props and MUST NOT fire a second round of fetches when filters change via `router.replace` (see §10.4).
> - Do NOT use `useRef` one-shot guards (`hasHydrated`, `isFirstRender`); use value-based comparison (`JSON.stringify(filters) === rscFiltersKey`).
> - The fetch-dependency array MUST include `initialFilters` (or `rscFiltersKey` derived from it), not a frozen snapshot taken on first mount.
>
> Verification (REQUIRED before declaring §4 done):
>
> - [ ] `docker compose logs analytics-api` shows exactly 2 requests per user action (1× `/api/stats` + 1× `/api/dataset`), not 4.
> - [ ] Run `scripts/test-analytics-dedup.ps1` and confirm pass.
> - [ ] Run unit tests in `AnalyticsDashboard.test.tsx`: all pass, including Strict-Mode + filter-change cases.

### Phase 5 — App 2: Spring Boot Backend (Clean Architecture)
**Goal:** production-ready Analytics API with caching and dataset stats.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 5.1 | Domain: Java 21 records `PropertyFeatures`, `PredictionResult`, `MarketStats`; `ModelInferencePort` interface | No Spring imports in domain | Unit: record contracts |
| 5.2 | Application: `MarketStatsService`, `WhatIfAnalysisService`, `SegmentAnalysisService` | Pure logic | Unit: stats math correct on sample data |
| 5.3 | Persistence adapter: load `housing.csv` from resources at startup into in-memory dataset; expose query methods | `/stats` returns counts | Unit: dataset loader parses N rows |
| 5.4 | ML client adapter: `RestClient` with Connect=2s/Read=5s, env `ML_SERVICE_URL`, Resilience4j circuit breaker + fallback | Mock server returns prediction | Unit: timeout → fallback result |
| 5.5 | Cache (per §3.1): `CacheConfig.java` declaring Caffeine with 3 named caches — `stats` (TTL 10min, cap 1000), `modelInfo` (TTL 60s, cap 1), `whatIf` (TTL 60s, cap 500); `@Cacheable` on `MarketStatsService.getAggregateStats(filters)`, `MlModelInfoService.getInfo()`, `WhatIfAnalysisService.predict(features)` | Second identical call returns cached bean; log `cache=HIT` | Unit: cache config + TTL eviction + key derivation |
| 5.6 | Web adapter: `@RestController` endpoints `/api/stats`, `/api/segments`, `/api/what-if`, `/api/dataset`; unified envelope via `@ControllerAdvice`; records as DTOs; `Cache-Control` headers per §3.1 (`no-store` on `/what-if`; `max-age=60, stale-while-revalidate=300` on default `/stats` & `/model-info`) | `curl :8002/api/stats` returns envelope; headers present | MockMvc: status + envelope shape + header assertions |
| 5.7 | Actuator health + structured JSON logging (`logback-spring.xml` with JSON encoder) + trace_id filter | `/actuator/health` UP; logs JSON | Unit: log capture |
| 5.8 | Dockerfile (multi-stage Maven) + compose wiring | `docker compose up analytics-api` healthy | — |
| 5.9 | Commit `feat(analytics-api): add Spring Boot analytics with caching and ML integration` + `test(...)` | — | `mvn test` green |

**Phase 5 — Cross-Service Audit (MANDATORY before §5.9 commit):**

> Spring Boot endpoints are consumed by Next.js RSC. Per agent_rules.md §11, every shipped endpoint MUST be audited:
>
> - [ ] Backend logs `/api/*` GET count per RSC page request ≤ the minimum required data set (typically 2: stats + dataset).
> - [ ] `docker compose exec web netstat -tn | grep 8002` shows ≤ 1 persistent keep-alive ESTABLISHED connection per backend service (not a fresh connection per request).
> - [ ] RSC payload in browser Network tab confirms `initialStats`, `initialDataset`, `initialFilters` are present and consistent with the URL.
> - [ ] All three test layers pass per §5 and §11.

### Phase 6 — Integration, Polish & Documentation
**Goal:** end-to-end runnable system, demo-ready.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 6.1 | `docker-compose.yml` final: 4 services (web, estimator-api, analytics-api, ml) on one network; env injection | `docker compose up` all healthy | — |
| 6.2 | End-to-end smoke script (`scripts/smoke.ps1`): predict → history → stats → what-if | All return success envelopes | — |
| 6.3 | `README.md` full: architecture diagram, run instructions (local + docker), env vars, ports, demo flow | Renders on GitHub | — |
| 6.4 | Accessibility pass: keyboard nav, ARIA, contrast | Lighthouse a11y ≥ 90 | — |
| 6.5 | Final commit `docs: add README and integration smoke test` | — | — |

**Phase 6 — Runtime Evidence (MANDATORY before §6.5 commit):**

> Per agent_rules.md §8.5 and §11, the smoke script MUST include not just HTTP-status checks but also **request-count assertions** derived from `docker compose logs`:
>
> - [ ] Trigger each user action N times; assert backend log shows exactly N×(expected endpoints per action).
> - [ ] Assert no duplicate `/api/*` calls within a single RSC request.
> - [ ] Assert no 5xx errors in any service log during the smoke run.

---

## 5. Testing Strategy

| Layer | Tool | Coverage target | Reference |
| --- | --- | --- | --- |
| Next.js (unit) | Jest + React Testing Library | components, hooks, validation, boundaries, **Strict-Mode + filter-change dedup** | agent_rules.md §9.1 |
| Next.js (integration) | Jest + MSW / real HTTP against running stack | RSC payloads, serverFetch behavior, cache hit/miss | agent_rules.md §9.1 |
| FastAPI | pytest + httpx AsyncClient + `pytest-asyncio` | domain, use cases, adapters, API (TestClient) | — |
| Spring Boot | JUnit 5 + MockMvc + Mockito | domain, services, controllers, cache, ML fallback | — |
| E2E / Docker stack | `scripts/*.ps1` + docker compose logs assertion | full user journey + backend request count | agent_rules.md §9.1, §11 |

**Three-layer verification gate** (agent_rules.md §9.2):

1. **Unit tests** — logic, validation, edge cases.
2. **Integration tests** — real backend services via testcontainers or running compose stack.
3. **E2E / runtime evidence** — user flow against live stack + `docker compose logs` showing expected request counts.

Every feature commit MUST be accompanied by passing tests at all three applicable layers (rule §5.2). **"Tests pass" alone is NOT sufficient** — runtime evidence from `docker compose logs <service>` is required to declare a feature complete (rule §5.5 and §11).

---

## 6. Git Workflow

- Conventional Commits: `feat(scope):`, `fix(scope):`, `test(scope):`, `docs:`, `chore:`, `refactor(scope):`.
- Atomic commits per completed & tested feature.
- Branch strategy: `main` for stable; feature branches `feat/<phase>-<topic>`.
- Never commit `.env`, secrets, or build artifacts.
- **Bug-fix commits MUST include**: (a) the regression test, (b) a `logs/<feature>-postmortem-YYYYMMDD.md` entry, (c) a reference to the §11 cross-service audit if applicable.

---

## 7. Environment Variables (`.env.example`)

```
# Web (Next.js)
ESTIMATOR_API_URL=http://localhost:8001
ANALYTICS_API_URL=http://localhost:8002

# Estimator API (FastAPI)
ML_SERVICE_URL=http://localhost:8000
ESTIMATOR_API_PORT=8001
LOG_LEVEL=INFO

# Analytics API (Spring Boot) — in application.yml
ML_SERVICE_URL=http://localhost:8000
SERVER_PORT=8002
```

---

## 8. Bug Investigation & Debugging SOP (REQUIRED READING)

**Read agent_rules.md §8 in full before investigating any non-trivial runtime bug.** The SOP enforces a 5-step workflow that has repeatedly caught issues the unit tests miss:

```
Step 1: Reproduce & Capture Evidence
  ↓
Step 2: Trace the Request Path (Identify ALL data sources)
  ↓
Step 3: Form Hypotheses from EVIDENCE, Not Assumptions
  ↓
Step 4: Apply Minimal Fix + Verify in Runtime
  ↓
Step 5: Update Tests + Postmortem
```

### 8.1 Quick Reference — Evidence Commands (Windows / PowerShell)

```powershell
# Backend API calls — the source of truth
docker compose logs analytics-api --since 5m | Select-String "GET"

# Frontend compile errors and RSC handling
docker compose logs web --since 5m

# Outbound connections from web container
docker compose exec web netstat -tn | Select-String "ESTABLISHED"

# Endpoint health
Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 10
Invoke-WebRequest "http://localhost:3000/analytics?schoolRatingMin=9" -UseBasicParsing -TimeoutSec 15

# Container status
docker compose ps --format "table {{.Name}}`t{{.Status}}"
```

### 8.2 Critical Anti-Patterns (from agent_rules.md §8.7)

NEVER do these — they were observed in failed fix attempts:

- "I think this should fix it" — no evidence.
- "Tests pass, so it's fixed" — tests with mocks hide integration bugs.
- "The fix doesn't seem to take effect" — first rule out a stale compile cache (`docker compose exec web rm -rf /app/.next && docker compose restart web`).
- Stacking new fixes on top of unverified fixes.
- Stopping when "the user can see the data" — may be a symptom, not a root cause fix.

### 8.3 Bug Postmortem Template

Every bug fix MUST produce a `logs/<feature>-postmortem-YYYYMMDD.md` file. Sections:

1. **Bug** — what the user reported (user-visible behavior).
2. **Root cause** — with timestamp evidence from `docker compose logs`.
3. **Why was it not caught earlier** — test gap, UAT gap, missing observability.
4. **Fix** — file paths + diff summary + commit SHA.
5. **Verification evidence** — `docker compose logs <service>` snippets before/after.
6. **Lessons learned** — concrete rule changes (with diff to `agent_rules.md`).

Reference postmortems:

- `logs/analytics-dedup-fix-20260808.md` — analytics duplicate-request bug.
- `logs/rsc-protocol-explained.md` — RSC protocol reference (background).
- `logs/api-request-origination-verification.md` — proof that web container issues API calls.
- `logs/bug-prevention-postmortem.md` — meta-analysis of why the bug lasted months.

---

## 9. Out of Scope (explicit non-goals)

- Authentication / multi-tenancy
- Persistent database (history is in-memory/localStorage per requirements)
- CI/CD pipelines (manual docker-compose demo is sufficient)
- Mobile-native builds

---

## 10. Definition of Done

- All 6 phases complete with every milestone's tests green at **all three layers** (unit, integration, E2E).
- `docker compose up` brings the full system healthy.
- Smoke script passes end-to-end **with request-count assertions** (not just status checks).
- `README.md` documents run + demo.
- No `// TODO`, no stubs, no hardcoded secrets.
- **Cross-Service Audit** (agent_rules.md §11) checklist passes for every shipped endpoint.
- **No duplicate `/api/*` calls** per user action (verified in `docker compose logs <backend>`).
- **All bug fixes ship with a postmortem** in `logs/`.

---

## 11. Cross-Service Communication Audit Checklist (REQUIRED before merge)

Per agent_rules.md §11, every PR that crosses the RSC ↔ Backend boundary MUST pass this audit:

- [ ] **Request count**: `docker compose logs <backend> | grep -E "GET /api/"` shows ≤ (expected endpoints per action) per user-triggered action. For analytics: ≤ 2 (1 stats + 1 dataset). For estimator: ≤ 1 (1 predict).
- [ ] **No duplicate round-trips**: rapid filter changes / slider drags do not produce 2× the expected request count (no client fetch racing with RSC).
- [ ] **Connection footprint**: `docker compose exec web netstat -tn | grep <backend-port>` shows ≤ 1 persistent keep-alive connection, NOT a fresh connection per request.
- [ ] **RSC payload integrity**: in browser Network tab, the `?_rsc=...` response contains `initialStats` / `initialDataset` (or equivalent) AND `initialFilters` matches the URL.
- [ ] **Three-layer tests pass**: unit + integration + runtime evidence all green per §5.
- [ ] **Postmortem written**: if the audit fails and requires a fix, a postmortem per §8.3 must accompany the fix.

### 11.1 When to Re-run the Audit

- Before merging any change to `apps/web/src/app/**/page.tsx`.
- Before merging any change to `apps/web/src/components/**/AnalyticsDashboard.tsx` (or similar data-driven client components).
- Before merging any change to `apps/estimator-api/**/routers/` or `apps/analytics-api/**/controllers/`.
- Before upgrading Next.js, FastAPI, or Spring Boot.
- Whenever a user reports "duplicate requests" / "slow loading" / "weird errors".

### 11.2 Audit Failure Resolution

If the audit fails (e.g. > expected requests per action):

1. **Do not patch over the symptom.** Follow agent_rules.md §8.5: re-capture evidence, re-hypothesize, fix the root cause.
2. **Common root causes** (from agent_rules.md §10.4):
   - RSC + Client-side useEffect both fetching the same data → enforce §10 dedup.
   - `useRef` one-shot guard bypassed by React Strict Mode → switch to value-based comparison.
   - Stale `useMemo` snapshot frozen on first mount → make it depend on `initialFilters` props.
   - `router.replace` triggers RSC re-render AND client fetch in parallel → cancel the client fetch when RSC responds.
3. **Add a regression test** per agent_rules.md §9.3 that asserts request count.

---

**Document changelog:**

- 2026-08-08: Added §3.2 (Next.js version checklist), §4 Phase 4/5/6 runtime-evidence gates, §8 (Bug SOP summary), §11 (Cross-Service Audit). References to `agent_rules.md §8/§9/§10/§11` woven through the document. Reflects lessons learned from the 2026-08-08 analytics duplicate-request bug postmortem.