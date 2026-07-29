# Property Multi-App Portal

Unified Next.js portal hosting two independent applications, each backed by a different technology, both integrating with the ML regression model container from [`house_price_prediction`](../house_price_prediction).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Unified Frontend Portal — Next.js (App Router)       │
│           Shared Shell · Navigation · Design System          │
└───────────────┬─────────────────────────┬───────────────────┘
                │                         │
   (App 1)      │                         │  (App 2)
                ▼                         ▼
   ┌────────────────────────┐  ┌────────────────────────────┐
   │ Backend 1: FastAPI      │  │ Backend 2: Spring Boot     │
   │ Property Value Estimator│  │ Property Market Analysis   │
   │ (Python 3.12, :8001)    │  │ (Java 21, :8002)           │
   └───────────┬────────────┘  └─────────────┬──────────────┘
               │                              │
               └──────────────┬───────────────┘
                              │  REST (Connect=2s, Read=5s)
                              ▼
                  ┌────────────────────────────┐
                  │  ML Model Container        │
                  │  FastAPI · scikit-learn    │
                  │  (:8000)                   │
                  └────────────────────────────┘
```

## Apps

| App | Route | Frontend | Backend | Purpose |
| --- | --- | --- | --- | --- |
| Estimator | `/estimator` | Next.js | FastAPI (`:8001`) | Single & batch price prediction, history, comparison |
| Analytics | `/analytics` | Next.js | Spring Boot (`:8002`) | Market dashboard, filters, what-if, export |

## Tech Stack

- **Frontend**: Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Lucide · Recharts
- **Estimator API**: Python 3.12+ · FastAPI · Pydantic v2 · httpx (async)
- **Analytics API**: Java 21 · Spring Boot 3.4.4 · Caffeine · Resilience4j
- **ML Service**: existing FastAPI container at `../house_price_prediction`

## Repository Layout

```
property_multi_app_portal/
├── PROJECT_PLAN.md            # phased execution plan
├── docker-compose.yml         # orchestrates all 4 services
├── apps/
│   ├── web/                   # Next.js unified portal (:3000)
│   ├── estimator-api/         # FastAPI (:8001)
│   └── analytics-api/         # Spring Boot (:8002)
└── packages/
    └── shared-types/          # shared TS types (optional)
```

## Quick Start

> Detailed instructions will be filled in Phase 6. For now, see [PROJECT_PLAN.md](./PROJECT_PLAN.md).

### Prerequisites

- Node.js 20+
- Python 3.12+
- Java 21 (JDK)
- Maven 3.9+
- Docker & Docker Compose

### Run All Services (Docker Compose)

```bash
docker compose up --build
```

### Run Individually (Development)

```bash
# ML container (from house_price_prediction)
cd ../house_price_prediction && docker build -t house-price-api . && docker run -p 8000:8000 house-price-api

# Estimator API
cd apps/estimator-api && uvicorn app.main:app --reload --port 8001

# Analytics API
cd apps/analytics-api && mvn spring-boot:run

# Web portal
cd apps/web && npm run dev
```

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Copy to `.env` and adjust.

## Ports

| Service | Port |
| --- | --- |
| Web portal | 3000 |
| Estimator API (FastAPI) | 8001 |
| Analytics API (Spring Boot) | 8002 |
| ML container | 8000 |

## License

MIT
