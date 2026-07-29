# PROJECT_PLAN — Property Multi-App Portal

> Multi-application Next.js portal hosting two independent apps (Property Value Estimator + Property Market Analysis) backed by FastAPI and Spring Boot, both integrating with the ML regression model container at `D:\DevDir\intw_prj\house_price_prediction`.
>
> This plan follows the agent workflow defined in `agent_rules.md §5`: mandatory planning → feature-by-feature development with testing gates → atomic conventional commits → production-ready runnable output.

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
└── packages/                         # (optional) shared TS types
    └── shared-types/
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
8. **Testing gate** — a feature is NOT complete until its tests pass. No stubs, no `// TODO`.

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

---

## 4. Phased Milestones

Each phase = a verifiable deliverable with its own test gate and atomic commit(s).

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

### Phase 6 — Integration, Polish & Documentation
**Goal:** end-to-end runnable system, demo-ready.

| # | Milestone | Verifiable | Tests |
| --- | --- | --- | --- |
| 6.1 | `docker-compose.yml` final: 4 services (web, estimator-api, analytics-api, ml) on one network; env injection | `docker compose up` all healthy | — |
| 6.2 | End-to-end smoke script (`scripts/smoke.ps1`): predict → history → stats → what-if | All return success envelopes | — |
| 6.3 | `README.md` full: architecture diagram, run instructions (local + docker), env vars, ports, demo flow | Renders on GitHub | — |
| 6.4 | Accessibility pass: keyboard nav, ARIA, contrast | Lighthouse a11y ≥ 90 | — |
| 6.5 | Final commit `docs: add README and integration smoke test` | — | — |

---

## 5. Testing Strategy

| Layer | Tool | Coverage target |
| --- | --- | --- |
| Next.js | Jest + React Testing Library | components, hooks, validation, boundaries |
| FastAPI | pytest + httpx AsyncClient + `pytest-asyncio` | domain, use cases, adapters, API (TestClient) |
| Spring Boot | JUnit 5 + MockMvc + Mockito | domain, services, controllers, cache, ML fallback |
| Integration | docker-compose + smoke script | end-to-end happy paths |

Every feature commit MUST be accompanied by passing tests (rule §5.2).

---

## 6. Git Workflow

- Conventional Commits: `feat(scope):`, `fix(scope):`, `test(scope):`, `docs:`, `chore:`, `refactor(scope):`.
- Atomic commits per completed & tested feature.
- Branch strategy: `main` for stable; feature branches `feat/<phase>-<topic>`.
- Never commit `.env`, secrets, or build artifacts.

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

## 8. External Dependencies & Risks

| Risk | Mitigation |
| --- | --- |
| ML container not running | Backends return structured `ML_SERVICE_UNAVAILABLE`; health endpoints reflect degraded state |
| Network blocks Maven/pip | Use proxy per agent_rules.md §6 (`HTTP_PROXY=http://127.0.0.1:26406`) |
| Dataset drift between ML model and analytics copy | Pin the CSV snapshot; document refresh procedure in README |
| LocalStorage not available (SSR) | Guard with `typeof window !== 'undefined'` and fallback to in-memory |

---

## 9. Out of Scope (explicit non-goals)

- Authentication / multi-tenancy
- Persistent database (history is in-memory/localStorage per requirements)
- CI/CD pipelines (manual docker-compose demo is sufficient)
- Mobile-native builds

---

## 10. Definition of Done

- All 6 phases complete with every milestone's tests green.
- `docker compose up` brings the full system healthy.
- Smoke script passes end-to-end.
- `README.md` documents run + demo.
- No `// TODO`, no stubs, no hardcoded secrets.
