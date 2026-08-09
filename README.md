[English](./README.md) · [简体中文](./README.zh-CN.md)

---

# Property Multi-App Portal

## Overview

Property Multi-App Portal is a unified Next.js multi-application portal that integrates two independent real-estate microservices: **Property Value Estimator** and **Property Market Analysis**. Each application has its own dedicated backend service (FastAPI and Spring Boot), both communicating with a shared ML regression model container via REST APIs. Together they provide a complete feature set for users, including single/batch price predictions, history queries, a market dashboard, what-if analysis, and data export.

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│             Next.js Web Portal (:3000)                           │
│        Shared Shell · Navigation · Design System                 │
└──────────────┬───────────────────────────────┬───────────────────┘
               │                               │
    (App 1)    │                               │  (App 2)
               ▼                               ▼
┌─────────────────────────────┐    ┌──────────────────────────────┐
│  FastAPI Estimator API      │    │  Spring Boot Analytics API   │
│  Python 3.12 · Pydantic v2  │    │  Java 21 · Caffeine          │
│  httpx (async) · :8001      │    │  Resilience4j · :8002        │
└──────────────┬──────────────┘    └──────────────┬───────────────┘
               │                                  │
               │         REST (Connect=2s, Read=5s)│
               └──────────────┬───────────────────┘
                              ▼
                 ┌────────────────────────────┐
                 │  ML Model Container        │
                 │  FastAPI · scikit-learn    │
                 │  House Price Regression    │
                 │  (:8000)                   │
                 └────────────────────────────┘
```

## Tech Stack

| Service             | Tech                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Web Portal**      | Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · React 19 · Lucide · Recharts · Jest + RTL |
| **Estimator API**   | Python 3.12+ · FastAPI · Pydantic v2 · httpx (async) · pytest + pytest-asyncio                |
| **Analytics API**   | Java 21 · Spring Boot 3.4.4 · Caffeine · Resilience4j · JUnit 5 + MockMvc                      |
| **ML Container**    | FastAPI · scikit-learn · Linear Regression Model                                                |

## Directory Structure

```
property_multi_app_portal/
├── README.md                      # Project documentation (English, default)
├── README.zh-CN.md                # 项目文档（简体中文）
├── PROJECT_PLAN.md                # Phased execution plan
├── docker-compose.yml             # 4-service orchestration
├── .env.example                   # Environment variable template
├── scripts/
│   └── smoke.ps1                  # Smoke test script
├── apps/
│   ├── web/                       # Next.js unified portal (:3000)
│   │   ├── src/app/               # App Router routes
│   │   ├── src/components/        # Shared UI components
│   │   ├── src/lib/               # API clients · utility libraries
│   │   └── src/hooks/             # Custom React hooks
│   ├── estimator-api/             # FastAPI estimator backend (:8001)
│   │   ├── app/domain/            # Domain models · port interfaces
│   │   ├── app/application/       # Use case orchestration
│   │   ├── app/adapters/          # Web/ML/persistence adapters
│   │   └── tests/                 # pytest tests
│   └── analytics-api/             # Spring Boot analytics backend (:8002)
│       ├── src/main/java/.../domain/      # Domain models · port interfaces
│       ├── src/main/java/.../application/ # Service layer
│       ├── src/main/java/.../adapters/    # Web/ML/persistence adapters
│       └── src/test/java/.../             # JUnit 5 + MockMvc tests
└── packages/
    └── shared-types/              # Shared TS types (optional)
```

## Quick Start — Local Development Mode

### Prerequisites

| Tool          | Version                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| Node.js       | **22 LTS** (v25+ is NOT supported — Next.js 16 native bindings are incompatible with ABI 141)         |
| Python        | 3.12+                                                                                                |
| JDK           | 21                                                                                                   |
| Maven         | 3.9+ (Spring Boot bundles `mvnw` as an alternative)                                                  |
| Docker        | 27+                                                                                                  |
| Docker Compose| 2+                                                                                                   |

> **Note**: The ML container depends on the external repo `house_price_prediction`, which must reside in a sibling directory of this project.
>
> **Switching Node version** (Windows PowerShell):
>
> ```powershell
> $env:PATH = "D:\DevEnv\node-v22.23.2-win-x64;" + $env:PATH
> node --version  # Should output v22.x.x
> ```

### Step 1: Start the ML Container

```bash
# Build and start the ML container (from the house_price_prediction repo)
cd ../house_price_prediction
docker build -t house-price-api .
docker run -d --name house-price-ml -p 8000:8000 house-price-api
```

### Step 2: Start the Estimator API (FastAPI)

```bash
cd apps/estimator-api
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Step 3: Start the Analytics API (Spring Boot)

```bash
cd apps/analytics-api
./mvnw spring-boot:run        # Linux / macOS
# or
.\mvnw.cmd spring-boot:run    # Windows
```

### Step 4: Start the Web Portal (Next.js)

```bash
cd apps/web
npm install
npm run dev
```

Open <http://localhost:3000> to access the portal.

## Docker Compose Deployment (Recommended)

One-command orchestration of all 4 services (ml-container → estimator-api / analytics-api → web), including health checks and dependency waiting.

### First Startup (build images + start)

```bash
# Build all images and start in the background (first build of ml-container trains the model, ~1-2 minutes)
docker compose up -d --build
```

### Day-to-Day Operations

```bash
# Start with existing images (no rebuild)
docker compose up -d --no-build

# View service status (wait for all containers to become healthy)
docker compose ps

# Tail logs from all services
docker compose logs -f

# Tail logs from a single service
docker compose logs -f web
docker compose logs -f estimator-api
docker compose logs -f analytics-api
docker compose logs -f ml-container

# Stop and remove containers (keep images)
docker compose down

# Stop and remove containers + delete images (full cleanup)
docker compose down --rmi all
```

### Rebuilding a Single Service

When code or the Dockerfile of a service changes, you only need to rebuild that service:

```bash
# Rebuild the web frontend (e.g. after modifying Next.js code or build args)
docker compose up -d --build web

# Rebuild estimator-api (e.g. after modifying FastAPI code)
docker compose up -d --build estimator-api

# Rebuild analytics-api (e.g. after modifying Spring Boot code)
docker compose up -d --build analytics-api

# Rebuild ml-container (e.g. after modifying the ML model code)
docker compose up -d --build ml-container
```

### Debugging Inside Containers

```bash
# Enter a container shell
docker compose exec web sh
docker compose exec estimator-api bash
docker compose exec analytics-api sh

# Test inter-container network connectivity (Docker internal network)
docker compose exec web wget -qO- http://estimator-api:8001/healthz
docker compose exec web wget -qO- http://analytics-api:8002/actuator/health
docker compose exec estimator-api curl -s http://ml-container:8000/health
```

### Startup Order and Health Checks

`docker-compose.yml` defines the dependency chain and health-check gates:

```
ml-container (healthy) ──► estimator-api (healthy) ──► web
                      └──► analytics-api (healthy) ──┘
```

- `ml-container` must pass `/health` after startup (start_period: 60s)
- `estimator-api` / `analytics-api` wait for the ML container to become healthy before starting
- `web` waits for both backends to become healthy before starting

### Verifying Service Availability

Run the following commands to verify all endpoints after startup:

```powershell
# ML container health
curl http://localhost:8000/health
# Expected: {"status":"healthy","model_loaded":true}

# Estimator API health (includes downstream ML status)
curl http://localhost:8001/healthz
# Expected: {"success":true,"data":{"status":"healthy","ml_healthy":true,...}}

# Analytics API health (Spring Actuator)
curl http://localhost:8002/actuator/health
# Expected: {"status":"UP","components":{"mlService":{"status":"UP"},...}}

# Web portal homepage
curl -o /dev/null -s -w "%{http_code}" http://localhost:3000/
# Expected: 200

# Web proxy → Estimator API
curl http://localhost:3000/api/estimator/healthz
# Expected: {"success":true,"data":{"status":"healthy",...}}

# Web proxy → Analytics API
curl http://localhost:3000/api/analytics/actuator/health
# Expected: {"status":"UP",...}

# End-to-end prediction (Estimator → ML)
curl -X POST http://localhost:8001/predict `
  -H "Content-Type: application/json" `
  -d '{"features":{"square_footage":2000,"bedrooms":3,"bathrooms":2,"year_built":2010,"lot_size":5000,"distance_to_city_center":10,"school_rating":8}}'
# Expected: {"success":true,"data":{"predicted_price":258775.97,...}}

# Aggregate market stats (Analytics internal dataset)
curl http://localhost:8002/api/stats
# Expected: {"success":true,"data":{"kpis":{"count":50,"avg_price":304760.0,...}}}
```

## Environment Variables

Copy `.env.example` to `.env` and adjust per environment:

| Variable                            | Service                                  | Purpose                                                  | Default                       |
| ----------------------------------- | ---------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_ESTIMATOR_API_URL`     | Web Portal                               | Client-side URL for Estimator API                        | `http://localhost:8001`       |
| `NEXT_PUBLIC_ANALYTICS_API_URL`     | Web Portal                               | Client-side URL for Analytics API                        | `http://localhost:8002`       |
| `ESTIMATOR_API_URL`                 | Web Portal                               | Server-side URL for Estimator API                        | `http://localhost:8001`       |
| `ANALYTICS_API_URL`                 | Web Portal                               | Server-side URL for Analytics API                        | `http://localhost:8002`       |
| `ML_SERVICE_URL`                    | Estimator API                            | ML container URL                                         | `http://localhost:8000`       |
| `ESTIMATOR_API_HOST`                | Estimator API                            | Listen address                                           | `0.0.0.0`                     |
| `ESTIMATOR_API_PORT`                | Estimator API                            | Listen port                                              | `8001`                        |
| `LOG_LEVEL`                         | Estimator / Analytics                    | Log level (DEBUG/INFO/WARNING/ERROR)                      | `INFO`                        |
| `ML_SERVICE_URL`                    | Analytics API                            | ML container URL (Spring Boot)                           | `http://localhost:8000`       |
| `SERVER_PORT`                       | Analytics API                            | Service port                                             | `8002`                        |
| `JAVA_OPTS`                         | Analytics API                            | JVM arguments                                            | `-Xms256m -Xmx512m`           |
| `ML_CONTAINER_PORT`                 | ML Container                             | ML container port                                        | `8000`                        |
| `WEB_PORT`                          | Web Portal                               | Portal port                                              | `3000`                        |
| `ESTIMATOR_API_PORT`                | Estimator API                            | API port (Docker mapping)                                | `8001`                        |
| `ANALYTICS_API_PORT`                | Analytics API                            | API port (Docker mapping)                                | `8002`                        |
| `INTERNAL_SERVICE_TOKEN`            | Web / Estimator / Analytics / ML         | Shared internal service token (Phase B)                   | none (must be 32-byte base64) |
| `ML_CA_BUNDLE_PATH`                 | Estimator                                | Python httpx trusted CA certificate (Phase C)             | `/app/certs/ca.crt`           |
| `ML_TRUST_STORE_PATH`               | Analytics                                | JDK HttpClient trusted PKCS#12 (Phase C)                  | `/app/certs/ca.p12`           |
| `ML_TRUST_STORE_PASSWORD`           | Analytics                                | PKCS#12 truststore password                              | `changeit`                    |

## Port Mapping

| Port     | Service                       | Description                      | Host port binding (after Phase A) |
| -------- | ----------------------------- | -------------------------------- | --------------------------------- |
| `3000`   | Next.js Web Portal            | Unified frontend portal          | Yes                               |
| `8001`   | FastAPI Estimator API         | Property value estimator backend | No (intra-cluster DNS only)       |
| `8002`   | Spring Boot Analytics API     | Property market analysis backend | No (intra-cluster DNS only)       |
| `8000`   | ML Container                  | House price regression model     | No (intra-cluster DNS only, TLS)  |

> Only `WEB_PORT` is exposed to the host. Other services are accessed via `docker compose exec` (see the [Security](#security) section).

## API Endpoints

### Estimator API (FastAPI, port 8001)

| Method    | Endpoint                | Description                              | Cache                                       |
| --------- | ----------------------- | ---------------------------------------- | ------------------------------------------- |
| `GET`     | `/healthz`              | Health check (includes downstream ML)    | —                                           |
| `POST`    | `/predict`              | Single property price prediction         | `no-store`                                  |
| `POST`    | `/predict/batch`        | Batch property price predictions         | `no-store`                                  |
| `GET`     | `/model-info`           | Fetch ML model metadata                  | `max-age=60, stale-while-revalidate=300`    |
| `GET`     | `/history`              | List prediction history                  | `no-store`                                  |
| `GET`     | `/history/{entry_id}`   | Get a single history entry               | `no-store`                                  |
| `DELETE`  | `/history/{entry_id}`   | Delete a single history entry            | `no-store`                                  |
| `DELETE`  | `/history`              | Clear all history                        | `no-store`                                  |

### Analytics API (Spring Boot, port 8002)

| Method    | Endpoint                          | Description                                       | Cache                  |
| --------- | --------------------------------- | ------------------------------------------------- | ---------------------- |
| `GET`     | `/actuator/health`                | Spring Actuator health check                      | —                      |
| `GET`     | `/api/stats`                      | Aggregate market stats (supports query filters)   | Caffeine · 10min TTL   |
| `POST`    | `/api/stats`                      | Aggregate market stats (JSON body filters)        | Caffeine · 10min TTL   |
| `GET`     | `/api/dataset`                    | Paginated dataset query (`page`, `page_size`)     | —                      |
| `GET`     | `/api/model/info`                 | ML model metadata                                 | Caffeine · 60s TTL     |
| `DELETE`  | `/api/model/cache`                | Clear model info cache                            | —                      |
| `POST`    | `/api/what-if`                    | What-if analysis (custom baseline)                | Caffeine · 60s TTL     |
| `POST`    | `/api/what-if/analyze-default`    | What-if analysis (default baseline)               | Caffeine · 60s TTL     |
| `GET`     | `/api/export/stats/csv`           | Market stats CSV export                           | —                      |

### ML Container (port 8000)

| Method  | Endpoint          | Description                 |
| ------- | ----------------- | --------------------------- |
| `GET`   | `/health`         | ML container health check   |
| `POST`  | `/predict`        | Single prediction           |
| `POST`  | `/predict/batch`  | Batch prediction            |
| `GET`   | `/model-info`     | Model metadata              |

## Smoke Test

Use the PowerShell script to verify end-to-end service availability with one command:

```powershell
# Run after all services are up
.\scripts\smoke.ps1

# Customize BaseUrl or timeout
.\scripts\smoke.ps1 -BaseUrl "http://localhost" -TimeoutSec 15
```

The script automatically tests the following scenarios:

1. **Service health checks** — Estimator API / Analytics API / Web Portal
2. **Single prediction** — `POST /predict`
3. **History query** — `GET /history`
4. **Market stats** — `GET /api/stats`
5. **Paginated dataset** — `GET /api/dataset?page=1&page_size=10`
6. **What-if analysis** — `POST /api/what-if`

The script exits with code `0` on success, or `1` on failure.

## Demo Flow

### Preparation

```bash
# Ensure the ML container is running
curl http://localhost:8000/health
# Should return {"status": "healthy", ...}

# Start all services
docker compose up -d --build
```

### Demo Steps

**Step 1: Visit the Portal Home**

- Open <http://localhost:3000>
- View the portal overview and service status cards

**Step 2: Property Estimator — Single Prediction**

- Navigate to `/estimator`
- Fill in the 7 feature fields (square footage, bedrooms, bathrooms, year built, lot size, distance to city center, school rating)
- Submit and view the predicted price plus feature-contribution chart

**Step 3: Property Estimator — History & Comparison**

- Navigate to `/estimator/history` to view history records
- Navigate to `/estimator/compare` to select 2–4 records for comparison

**Step 4: Market Analysis Dashboard**

- Navigate to `/analytics`
- View the KPI cards (average, median, max/min prices)
- Interact with filters (bedrooms, year built, distance, school rating)
- View price histograms, scatter plots, and box plots

**Step 5: What-If Analysis**

- Navigate to `/analytics/what-if`
- Drag the sliders to adjust feature values and watch the predicted price change in real time

**Step 6: Data Export**

- Use the "Export" feature on the dashboard to download a CSV market-stats report

**Step 7: Run the Smoke Test**

```powershell
.\scripts\smoke.ps1
```

## Troubleshooting

| Issue                                        | Solution                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ML container connection timeout (`ML_SERVICE_TIMEOUT`) | Confirm the `house_price_prediction` container is running and port 8000 is reachable. In Docker, check connectivity: `docker compose exec estimator-api curl http://ml-container:8000/health` |
| Estimator API returns `degraded` status      | Means the API itself is healthy but the ML downstream is unavailable; check ML container health                                                                            |
| Spring Boot fails to start (port conflict)   | Modify `ANALYTICS_API_PORT` or `SERVER_PORT` in `.env` to ensure port 8002 is not in use                                                                                  |
| Next.js page is blank or API calls fail      | Ensure `NEXT_PUBLIC_*` vars in `.env` point to the correct ports. Dev mode defaults to `localhost`; Docker mode uses container names                              |
| Maven dependency download fails              | Check network connectivity; configure a proxy in `mvnw` or use the local Maven repository cache if needed                                                                |
| Docker Compose health check fails            | First ML container startup takes longer; `docker-compose.yml` already configures a 60s `start_period`. Inspect manually: `docker compose logs ml-container`           |
| `house_price_prediction` directory missing   | The ML container must be built from the sibling dir `../house_price_prediction`; ensure that repo is cloned                                                              |
| Incompatible Python version                  | Estimator API requires Python ≥ 3.12; verify with `python --version`                                                                                                    |
| Incompatible JDK version                     | Analytics API requires JDK 21; verify with `java -version`                                                                                                              |
| Insufficient Docker Desktop memory           | Spring Boot + JVM needs at least 1 GB; allocate 2 GB+ to Docker                                                                                                         |

***

## Security

This section describes the three-phase hardening: network least-privilege (Phase A), shared internal token (Phase B), and backend↔ML container mTLS (Phase C).

**Why three rounds of hardening are necessary:**

- Before hardening, all internal services (ML / Estimator / Analytics / MySQL / Redis) were bound directly to the host via the `ports:` field of `docker-compose.yml`. An attacker who could reach a host port could call an internal interface.
- At the same time, inter-container calls had no authentication or encryption: any container that joined the same Docker network could impersonate callers and read prediction results or sensitive stats.
- After these three rounds of hardening, the "host-port attack surface" is reduced to only Web (`:3000`); all inter-service calls must carry a shared token; and the wire-level traffic is encrypted via mTLS.

### Three-Phase Hardening Overview

| Phase | Name                  | Vulnerability Closed                                                                                  |
| ----- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| A     | Network least-privilege | Remove `ports:` bindings from internal services on the host, keep only `expose:` (intra-cluster DNS only) |
| B     | Shared internal token | Require `x-internal-token` header on all non-health-check inter-service calls; missing/wrong → 401      |
| C     | mTLS encryption        | Backend↔ML traffic forced over HTTPS with a self-signed CA; clients without the CA bundle fail the TLS handshake; plaintext ports are removed |

### Generating `INTERNAL_SERVICE_TOKEN`

This token is a 32-byte base64 random string, stored only in `.env` (covered by `.gitignore`), and injected into the Web / Estimator / Analytics / ML containers by the `environment` section of `docker-compose.yml`:

```bash
# Generate a strong random token
openssl rand -base64 32
```

Paste the output into the `INTERNAL_SERVICE_TOKEN=<value>` line in `.env`. All four containers MUST use the same `INTERNAL_SERVICE_TOKEN` value, otherwise requests will fail with 401.

> Windows PowerShell equivalent:
> ```powershell
> powershell -File scripts/generate-internal-token.ps1
> ```

### Generating mTLS Certificates

The CA and service certificates required for mTLS are generated by `scripts/generate_certs.py` (PowerShell wrapper: `scripts/generate-certs.ps1`):

```powershell
# Windows
powershell -File scripts/generate-certs.ps1
```

```bash
# Cross-platform / Linux / macOS
python scripts/generate_certs.py
```

The script is **idempotent**: re-running it only regenerates certificates that are within 30 days of expiry, so it won't break a running trust chain.

The script writes the following files under `certs/` at the repo root (the entire directory is in `.gitignore`):

| File                  | Purpose                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ca.crt`              | Self-signed CA certificate (trust anchor; loaded by Estimator in PEM form)                                              |
| `ca.key`              | CA private key (reused when re-issuing)                                                                                |
| `ca.p12`              | CA in PKCS#12 form (loaded by Analytics JDK; password `changeit`)                                                      |
| `ml-container.crt`    | ML container server certificate (SAN: `DNS:ml-container, DNS:localhost, IP:127.0.0.1`)                                  |
| `ml-container.key`    | ML container server private key (mounted into the container for Uvicorn to start TLS)                                   |
| `ml-container.p12`    | ML container key+cert+CA chain bundled into PKCS#12 (optional backup)                                                  |

> `certs/` is in `.gitignore` and must never be committed to version control.

### Debug Access to Internal Services

After Phase A, internal service ports (8000 / 8001 / 8002 / 3306 / 6379) are **no longer bound to the host**. All debug access must go through `docker compose exec` to enter the container, then call the intra-container localhost or other containers via their DNS names. Endpoints covered by Phase B / C also require the `x-internal-token` header.

```bash
# ML predict (HTTPS + token + CA bundle)
docker exec estimator-api python3 -c "import urllib.request, ssl, json, os; ctx=ssl.create_default_context(cafile='/app/certs/ca.crt'); r=urllib.request.urlopen(urllib.request.Request('https://ml-container:8000/predict', data=json.dumps({'features':{'square_footage':1500,'bedrooms':3,'bathrooms':2,'year_built':2010,'lot_size':5000,'distance_to_city_center':5,'school_rating':7}}).encode(), headers={'x-internal-token':os.environ['INTERNAL_SERVICE_TOKEN'],'Content-Type':'application/json'}, method='POST'), context=ctx); print(r.read().decode())"

# Analytics market stats (HTTP + token)
docker exec analytics-api wget --ca-certificate=/app/certs/ca.crt -qO- --header="x-internal-token: $INTERNAL_SERVICE_TOKEN" http://analytics-api:8002/api/stats

# ML health check (HTTPS, /health is token-exempt)
docker exec estimator-api python3 -c "import urllib.request, ssl; ctx=ssl.create_default_context(cafile='/app/certs/ca.crt'); print(urllib.request.urlopen('https://ml-container:8000/health', context=ctx, timeout=4).status)"
```

> `/health` (and the ML container's `https://ml-container:8000/health`) is a health-probe exemption endpoint and does NOT require the `x-internal-token` header, so health-check flows stay unblocked.

### Verifying the Phase C Gate

`scripts/verify_phase_c.py` runs 6 independent gates inside the estimator-api container; any failure means the mTLS / token configuration is incorrect:

```bash
docker exec -e INTERNAL_SERVICE_TOKEN=<value> estimator-api python3 /app/verify_phase_c.py
```

Expected output (`Passed: 6 / 6`):

```
=== Phase C: mTLS + Token Verification ===
  [PASS] HTTPS + correct token: status=200
  [PASS] HTTPS + no token: status=401
  [PASS] HTTPS + wrong token: status=401
  [PASS] HTTPS + untrusted CA: TLS rejected (cert verify failed)
  [PASS] /health exempt: status=200
  [PASS] Plaintext refused: TLS handshake bytes (no HTTP listener)
=== Summary ===
Passed: 6 / 6
All Phase C gates pass.
```

The six gates respectively cover:

1. **HTTPS + correct token** → 200 (legitimate call path)
2. **HTTPS + no token** → 401 (mandatory auth)
3. **HTTPS + wrong token** → 401 (unguessable)
4. **HTTPS + untrusted CA** → certificate verification failure (isolating unauthorized clients)
5. **`/health` exempt** → 200 (health probes do not block)
6. **Plaintext HTTP** → refused (container only listens on TLS; plaintext handshakes are dropped)

### Security-Related Environment Variables

| Variable                    | Used By                               | Purpose                                                  |
| --------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `INTERNAL_SERVICE_TOKEN`    | Web / Estimator / Analytics / ML      | Shared internal service token (Phase B)                  |
| `ML_SERVICE_URL`            | Estimator / Analytics                 | ML container URL (intra-cluster DNS, HTTPS)              |
| `ML_CA_BUNDLE_PATH`         | Estimator                             | Python `httpx` trusted CA certificate (Phase C)          |
| `ML_TRUST_STORE_PATH`       | Analytics                             | JDK `HttpClient` trusted PKCS#12 (Phase C)               |
| `ML_TRUST_STORE_PASSWORD`   | Analytics                             | PKCS#12 truststore password (default `changeit`)         |

For the full environment variable list, see the "Environment Variables" section above.

***

## License

MIT
